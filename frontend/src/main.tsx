import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { applyFontVariables } from './styles/fonts'

applyFontVariables()

function showBootstrapError(err: unknown) {
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML = `
      <div style="min-height:100vh;padding:2rem;font-family:system-ui,sans-serif;background:#f5f5f5;color:#333">
        <h1 style="color:#c00;margin-bottom:1rem">Failed to start app</h1>
        <pre style="background:#fff;padding:1rem;overflow:auto;font-size:13px;border:1px solid #ccc;border-radius:4px">${String(err instanceof Error ? err.message : err)}</pre>
        <p style="margin-top:1rem;font-size:14px">Check DevTools (F12) → Console for details.</p>
      </div>
    `
  }
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div style={{
          minHeight: '100vh',
          padding: '2rem',
          fontFamily: 'system-ui, sans-serif',
          background: '#f5f5f5',
          color: '#333',
        }}>
          <h1 style={{ color: '#c00', marginBottom: '1rem' }}>Something went wrong</h1>
          <pre style={{
            background: '#fff',
            padding: '1rem',
            overflow: 'auto',
            fontSize: '13px',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}>
            {this.state.error.message}
          </pre>
          <p style={{ marginTop: '1rem', fontSize: '14px' }}>
            Open DevTools (F12) → Console for details. Try <a href="/">refresh</a> or <a href="/deep-research">Deep Research</a>.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

async function bootstrap() {
  try {
    const { default: App } = await import('./App.tsx')
    const rootEl = document.getElementById('root')
    if (!rootEl) return
    createRoot(rootEl).render(
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    )
  } catch (err) {
    showBootstrapError(err)
  }
}

bootstrap()
