import { app } from 'electron'
import { logger } from '../utils/logger'
import { storage } from '../storage'
import path from 'path'
import fs from 'fs'

// Hugging Face Transformers imports
import { pipeline, env } from '@huggingface/transformers'

// Configure environment for Electron
// env.allowRemoteModels = true  // Allow remote for downloading
// env.allowLocalModels = true

// // Configure ONNX runtime for Electron compatibility
// if (env.backends && env.backends.onnx && env.backends.onnx.wasm) {
//   env.backends.onnx.wasm.numThreads = 1  // Limit ONNX threads for Electron
//   env.backends.onnx.wasm.simd = false   // Disable SIMD for compatibility
// }

type AIGatewayResponse = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      tool_calls: any[];
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  cost: {
    inputCostCents: number;
    outputCostCents: number;
    totalCostCents: number;
  };
};

export interface AIModelInfo {
  name: string;
  modelId: string;
  sizeDescription: string;
  isDownloaded: boolean;
  downloadProgress?: number;
}

export interface DownloadProgress {
  progress: number;
  loaded: number;
  total: number;
  status: string;
}

export class AIService {
  private currentModel: any = null
  private modelLoadingState: boolean = false
  private modelCachePath: string
  private availableModels: AIModelInfo[] = [
    {
      name: "SmolLM2-135M-Instruct",
      modelId: "HuggingFaceTB/SmolLM2-135M-Instruct",
      sizeDescription: "135M parameters - Smallest, fastest",
      isDownloaded: false
    },
    {
      name: "SmolLM2-360M-Instruct", 
      modelId: "HuggingFaceTB/SmolLM2-360M-Instruct",
      sizeDescription: "360M parameters - Medium size, balanced",
      isDownloaded: false
    },
    {
      name: "SmolLM2-1.7B-Instruct",
      modelId: "HuggingFaceTB/SmolLM2-1.7B-Instruct", 
      sizeDescription: "1.7B parameters - Largest, best quality",
      isDownloaded: false
    }
  ]

  constructor() {
    this.modelCachePath = path.join(app.getPath('userData'), 'ai-models')
    
    // Ensure cache directory exists
    if (!fs.existsSync(this.modelCachePath)) {
      fs.mkdirSync(this.modelCachePath, { recursive: true })
    }

    // Set HF cache path
    env.cacheDir = this.modelCachePath
    
    logger.info('AI Service initialized with both local and remote support')
    this.initializeService()
  }

  private async initializeService(): Promise<void> {
    try {
      // Check which models are already downloaded
      await this.updateDownloadedModelsStatus()
      
      // Try to auto-load saved model if in local mode
      const aiMode = await storage.getAIMode()
      const savedModel = await storage.getCurrentAIModel()
      
      if (aiMode === 'local' && savedModel) {
        const modelInfo = this.availableModels.find(m => m.modelId === savedModel)
        if (modelInfo && modelInfo.isDownloaded) {
          try {
            await this.loadModel(savedModel)
          } catch (error) {
            logger.error('Failed to auto-load saved model:', error)
          }
        }
      }
    } catch (error) {
      logger.error('Failed to initialize AI service:', error)
    }
  }

  private async updateDownloadedModelsStatus(): Promise<void> {
    const downloadedModels = await storage.getDownloadedModels()
    
    this.availableModels = this.availableModels.map(model => ({
      ...model,
      isDownloaded: downloadedModels.includes(model.modelId)
    }))
  }

  getAvailableModels(): AIModelInfo[] {
    return this.availableModels
  }

  getCurrentModel(): string | null {
    return this.currentModel ? this.availableModels.find(m => m.modelId === this.currentModel?.model)?.modelId || null : null
  }

  isModelLoading(): boolean {
    return this.modelLoadingState
  }

  getModelCachePath(): string {
    return this.modelCachePath
  }

  async downloadModel(
    modelId: string, 
    sessionId: string, 
    progressCallback?: (progress: DownloadProgress) => void
  ): Promise<boolean> {
    try {
      logger.info(`Starting download for model: ${modelId}`)
      this.modelLoadingState = true

      // Find model info
      const modelInfo = this.availableModels.find(m => m.modelId === modelId)
      if (!modelInfo) {
        throw new Error(`Model ${modelId} not found in available models`)
      }

      // Create progress tracking
      let lastProgress = 0
      const progressHandler = (progress: any) => {
        const progressPercent = Math.round((progress.loaded / progress.total) * 100)
        if (progressPercent !== lastProgress) {
          lastProgress = progressPercent
          if (progressCallback) {
            progressCallback({
              progress: progressPercent,
              loaded: progress.loaded,
              total: progress.total,
              status: `Downloading ${modelInfo.name}...`
            })
          }
        }
      }

      // Override fetch to track progress
      const originalFetch = global.fetch
      global.fetch = async (input: RequestInfo | URL, options?: RequestInit) => {
        const response = await originalFetch(input, options)
        
        if (response.body && typeof input === 'string' && input.includes('huggingface.co')) {
          const contentLength = response.headers.get('content-length')
          if (contentLength) {
            const total = parseInt(contentLength, 10)
            let loaded = 0
            
            const reader = response.body.getReader()
            const stream = new ReadableStream({
              start(controller) {
                function pump(): Promise<void> {
                  return reader.read().then(({ done, value }) => {
                    if (done) {
                      controller.close()
                      return
                    }
                    
                    loaded += value.length
                    progressHandler({ loaded, total })
                    
                    controller.enqueue(value)
                    return pump()
                  })
                }
                return pump()
              }
            })
            
            return new Response(stream, {
              headers: response.headers,
              status: response.status,
              statusText: response.statusText
            })
          }
        }
        
        return response
      }

      try {
        // Initialize the pipeline to trigger download
        const tempPipeline = await pipeline('text-generation', modelId, {
          cache_dir: this.modelCachePath,
          local_files_only: false,
          revision: 'main',
          device: 'cpu',  // Force CPU device for compatibility
          dtype: 'fp32'   // Use fp32 for better compatibility
        })
        
        // Clean up the temporary pipeline
        if (tempPipeline && typeof tempPipeline.dispose === 'function') {
          tempPipeline.dispose()
        }

        // Mark as downloaded in storage
        await storage.addDownloadedModel(modelId)
        
        // Update local status
        const modelIndex = this.availableModels.findIndex(m => m.modelId === modelId)
        if (modelIndex !== -1) {
          this.availableModels[modelIndex].isDownloaded = true
        }

        logger.info(`Successfully downloaded model: ${modelId}`)
        
        if (progressCallback) {
          progressCallback({
            progress: 100,
            loaded: 1,
            total: 1,
            status: 'Download complete!'
          })
        }

        return true
      } finally {
        // Restore original fetch
        global.fetch = originalFetch
      }
    } catch (error) {
      logger.error(`Failed to download model ${modelId}:`, error)
      throw error
    } finally {
      this.modelLoadingState = false
    }
  }

  async loadModel(modelId: string): Promise<boolean> {
    try {
      logger.info(`Loading model: ${modelId}`)
      this.modelLoadingState = true

      // Check if model is downloaded
      const downloadedModels = await storage.getDownloadedModels()
      if (!downloadedModels.includes(modelId)) {
        throw new Error(`Model ${modelId} is not downloaded. Please download it first.`)
      }

      // Load the model pipeline (only from local cache)
      this.currentModel = await pipeline('text-generation', modelId, {
        cache_dir: this.modelCachePath,
        local_files_only: true,
        revision: 'main',
        device: 'cpu',  // Force CPU device for compatibility
        dtype: 'fp32'   // Use fp32 for better compatibility
      })

      // Save as current model
      await storage.setCurrentAIModel(modelId)

      logger.info(`Successfully loaded model: ${modelId}`)
      return true
    } catch (error) {
      logger.error(`Failed to load model ${modelId}:`, error)
      throw error
    } finally {
      this.modelLoadingState = false
    }
  }

  private chunkText(text: string, maxChunkSize: number = 8000): string[] {
    if (text.length <= maxChunkSize) {
      return [text]
    }

    const chunks: string[] = []
    let currentIndex = 0

    while (currentIndex < text.length) {
      let endIndex = currentIndex + maxChunkSize

      // If we're not at the end, try to find a good breaking point
      if (endIndex < text.length) {
        // Look for sentence endings near the chunk boundary
        const searchStart = Math.max(currentIndex, endIndex - 200)
        const searchText = text.substring(searchStart, endIndex + 200)
        const sentenceEndings = ['. ', '! ', '? ', '\n\n']

        let bestBreak = -1
        for (const ending of sentenceEndings) {
          const lastIndex = searchText.lastIndexOf(ending)
          if (lastIndex > -1) {
            const absoluteIndex = searchStart + lastIndex + ending.length
            if (absoluteIndex > currentIndex && absoluteIndex <= endIndex + 200) {
              bestBreak = absoluteIndex
              break
            }
          }
        }

        if (bestBreak > -1) {
          endIndex = bestBreak
        }
      }

      chunks.push(text.substring(currentIndex, endIndex))
      currentIndex = endIndex
    }

    return chunks
  }

  async generateTextUsingAiGateway(messages: Array<{ role: string; content: string }>): Promise<any> {
    try {
      logger.info('Generating text using AI Gateway')

      // Get API key from storage first, fallback to process.env
      const storedApiKey = await storage.getAIGatewayApiKey()
      const apiKey = storedApiKey || process.env.AI_GATEWAY_API_KEY

      if (!apiKey) {
        throw new Error('AI Gateway API key not configured. Please set your API key in the AI model settings.')
      }

      const response = await fetch('https://ai-gateway.domng.net/api/ai-gateway/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'cheap-summarizer',
          messages: messages
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI Gateway request failed: ${response.status} ${errorText}`);
      }

      const data: AIGatewayResponse = await response.json();
      logger.info('Successfully generated text using AI Gateway');
      return data.choices[0].message.content;
    } catch (error) {
      logger.error('Error generating text using AI Gateway:', error);
      throw error;
    }
  }

  async generateTextUsingLocalModel(prompt: string): Promise<string> {
    if (!this.currentModel) {
      throw new Error('No local model loaded. Please load a model first.')
    }

    try {
      logger.info('Generating text using local model')
      
      const result = await this.currentModel(prompt, {
        max_new_tokens: 500,
        temperature: 0.7,
        do_sample: true,
        top_p: 0.9,
        repetition_penalty: 1.1
      })

      return result[0].generated_text.replace(prompt, '').trim()
    } catch (error) {
      logger.error('Error generating text using local model:', error)
      throw error
    }
  }

  async summarizeText(text: string): Promise<string> {
    try {
      logger.info(`Summarizing text of length: ${text.length}`)

      const aiMode = await storage.getAIMode()
      const chunks = this.chunkText(text, 8000)
      const summaries: string[] = []

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        logger.info(`Processing chunk ${i + 1}/${chunks.length} (length: ${chunk.length})`)

        let summary: string

        if (aiMode === 'local' && this.currentModel) {
          // Use local model
          const prompt = `Please summarize the following text concisely, capturing the key points and main ideas:\n\n${chunk}\n\nSummary:`
          summary = await this.generateTextUsingLocalModel(prompt)
        } else {
          // Use remote AI Gateway
          const messages = [
            {
              role: 'system',
              content: 'You are a helpful assistant that summarizes text content. Provide a clear, concise summary that captures the key points and main ideas.'
            },
            {
              role: 'user',
              content: `Please summarize the following text:\n\n${chunk}`
            }
          ]
          summary = await this.generateTextUsingAiGateway(messages)
        }

        summaries.push(summary || 'Failed to generate summary for this chunk')
      }

      // If we had multiple chunks, summarize the summaries
      if (summaries.length > 1) {
        logger.info(`Combining ${summaries.length} chunk summaries`)

        const combinedSummaries = summaries.join('\n\n')
        let finalSummary: string

        if (aiMode === 'local' && this.currentModel) {
          const prompt = `Please create a final comprehensive summary from these individual summaries:\n\n${combinedSummaries}\n\nFinal Summary:`
          finalSummary = await this.generateTextUsingLocalModel(prompt)
        } else {
          const finalMessages = [
            {
              role: 'system',
              content: 'You are a helpful assistant that creates final summaries. Combine the provided summaries into one coherent, comprehensive summary.'
            },
            {
              role: 'user',
              content: `Please create a final summary from these individual summaries:\n\n${combinedSummaries}`
            }
          ]
          finalSummary = await this.generateTextUsingAiGateway(finalMessages)
        }

        return finalSummary || 'Failed to generate final summary'
      }

      return summaries[0] || 'Failed to generate summary'
    } catch (error) {
      logger.error('Failed to summarize text:', error)
      throw error
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.currentModel) {
        // Clean up model resources if needed
        this.currentModel = null
      }
      logger.info('AI service cleaned up')
    } catch (error) {
      logger.error('Error cleaning up AI service:', error)
    }
  }

  private generateCacheKey(query: string, documents: string[], scoreThreshold: number): string {
    // Create a hash-like key from query, documents, and threshold
    const content = JSON.stringify({ query, documents, scoreThreshold })
    return `rerank_${Buffer.from(content).toString('base64')}`
  }

  async rerankDocuments(query: string, documents: string[], scoreThreshold: number = 0.30): Promise<Array<{corpus_id: number, score: number, text: string}>> {
    console.log('reranking documents', query, documents, scoreThreshold)
    
    // Check database cache first
    const cacheKey = this.generateCacheKey(query, documents, scoreThreshold)
    const cachedResult = await storage.cacheGet<Array<{corpus_id: number, score: number, text: string}>>(cacheKey)
    if (cachedResult) {
      logger.info(`Returning cached rerank result for ${documents.length} documents`)
      return cachedResult
    }

    try {
      // Get API key from storage first, fallback to process.env
      const storedApiKey = await storage.getAIGatewayApiKey()
      const apiKey = storedApiKey || process.env.AI_GATEWAY_API_KEY
      
      if (!apiKey) {
        throw new Error('AI Gateway API key not configured. Please set your API key in the AI model settings.')
      }

      const response = await fetch('https://ai-gateway.domng.net/api/ai-gateway/v1/rerank', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          query,
          documents
        })
      })

      if (!response.ok) {
        throw new Error(`Rerank API request failed: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      
      // Filter results by score threshold
      const filteredResults = result.data.filter((item: any) => item.score > scoreThreshold)
      
      // Cache the result in database (cache for 1 hour = 3600 seconds)
      await storage.cacheSet(cacheKey, filteredResults, 3600)
      
      logger.info(`Reranked ${documents.length} documents, ${filteredResults.length} above threshold ${scoreThreshold}`)
      
      return filteredResults
    } catch (error) {
      logger.error('Failed to rerank documents:', error)
      throw error
    }
  }
} 
