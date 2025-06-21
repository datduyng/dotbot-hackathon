import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";
import { registerInstrumentations } from "@opentelemetry/instrumentation";

if (process.env.TELEMETRY_ENABLED == "true") {
  const provider = new NodeTracerProvider();
  provider.register();
  
  registerInstrumentations({
    instrumentations: [new OpenAIInstrumentation()],
  });
}

console.log('🚀 Renderer process starting...')
console.log('Environment:', {
  isDev: import.meta.env.DEV,
  mode: import.meta.env.MODE,
  electronAPI: typeof window.electronAPI,
  ipcRenderer: typeof window.ipcRenderer
})

// Check if APIs are available
if (typeof window.electronAPI === 'undefined') {
  console.error('❌ electronAPI is not available - preload script may not have loaded correctly')
} else {
  console.log('✅ electronAPI is available')
}

if (typeof window.ipcRenderer === 'undefined') {
  console.error('❌ ipcRenderer is not available - preload script may not have loaded correctly')
} else {
  console.log('✅ ipcRenderer is available')
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  console.error('❌ Root element not found')
} else {
  console.log('✅ Root element found, creating React root...')
  
  try {
    const root = ReactDOM.createRoot(rootElement)
    console.log('✅ React root created, rendering app...')
    
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
    console.log('✅ App rendered successfully')
  } catch (error) {
    console.error('❌ Failed to render app:', error)
  }
}

// Use contextBridge APIs instead of direct ipcRenderer access
if (window.ipcRenderer) {
  window.ipcRenderer.on('main-process-message', (_event, message) => {
    console.log('📨 Message from main process:', message)
  })
}
