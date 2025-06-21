import { app } from 'electron'
import { logger } from '../utils/logger'
import { storage } from '../storage'
import path from 'path'
import fs from 'fs'

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

export class AIService {
  constructor() {
    logger.info('AI Service initialized with AI Gateway support')
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

      const response = await fetch('https://ai-gateway.domng.net/api/ai-gateway/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // not a secret really
          'Authorization': 'Bearer gYx5zIniBwWKiL289138637590828556476256LUp2pcrWwd'
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

  async summarizeText(text: string): Promise<string> {
    try {
      logger.info(`Summarizing text of length: ${text.length}`)

      const chunks = this.chunkText(text, 8000)
      const summaries: string[] = []

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        logger.info(`Processing chunk ${i + 1}/${chunks.length} (length: ${chunk.length})`)

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

        logger.info(`Processing chunk ${i + 1} of ${chunks.length}`)

        const summary = await this.generateTextUsingAiGateway(messages)
        summaries.push(summary || 'Failed to generate summary for this chunk')
      }

      // If we had multiple chunks, summarize the summaries
      if (summaries.length > 1) {
        logger.info(`Combining ${summaries.length} chunk summaries`)

        const combinedSummaries = summaries.join('\n\n')
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

        const finalSummary = await this.generateTextUsingAiGateway(finalMessages)
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
      logger.info('AI service cleaned up')
    } catch (error) {
      logger.error('Error cleaning up AI service:', error)
    }
  }
} 