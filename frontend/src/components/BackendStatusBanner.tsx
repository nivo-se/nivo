import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getBackendStatus } from '@/lib/api/status/service'

const SESSION_KEY = 'nivo_backend_banner_dismissed_session'

/**
 * Dismissible banner when DB is down or Redis is not healthy (enrichment queue may fall back to sync).
 */
export function BackendStatusBanner() {
  const [show, setShow] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESSION_KEY) === '1') {
      return
    }
    let cancelled = false
    getBackendStatus()
      .then((s) => {
        if (cancelled) return
        const redis = typeof s.redis === 'string' ? s.redis : ''
        const redisBad = redis && redis !== 'healthy'
        const dbBad = s.db_ok === false
        if (!redisBad && !dbBad) return
        const parts: string[] = []
        if (dbBad) parts.push('Database check failed — screening and enrichment may not work.')
        if (redisBad) {
          parts.push(
            'Redis is not healthy — enrichment jobs may run synchronously or be slower until the queue is available.'
          )
        }
        setMessage(parts.join(' '))
        setShow(true)
      })
      .catch(() => {
        /* ignore — status optional */
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!show || !message) return null

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground"
    >
      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">Backend notice</p>
        <p className="text-muted-foreground mt-1">{message}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0 h-8 w-8 p-0"
        aria-label="Dismiss backend notice"
        onClick={() => {
          sessionStorage.setItem(SESSION_KEY, '1')
          setShow(false)
        }}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
