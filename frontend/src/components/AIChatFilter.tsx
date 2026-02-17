import { useEffect, useState } from 'react'
import { Loader2, RefreshCcw } from 'lucide-react'
import type { AIFilterResponse } from '../lib/apiService'

export interface PromptHistoryItem {
  prompt: string
  count: number
  timestamp: string
}

interface AIChatFilterProps {
  initialPrompt?: string
  isLoading?: boolean
  lastResult?: AIFilterResponse | null
  history: PromptHistoryItem[]
  onSubmitPrompt: (prompt: string) => Promise<void> | void
  onSelectHistory?: (prompt: string) => void
}

export const AIChatFilter: React.FC<AIChatFilterProps> = ({
  initialPrompt = '',
  isLoading = false,
  lastResult,
  history,
  onSubmitPrompt,
  onSelectHistory,
}) => {
  const [prompt, setPrompt] = useState(initialPrompt)
  const [error, setError] = useState<string | null>(null)
  const [justSubmittedPrompt, setJustSubmittedPrompt] = useState<string | null>(null)

  useEffect(() => {
    setPrompt(initialPrompt)
  }, [initialPrompt])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!prompt.trim()) {
      setError('Please describe your acquisition thesis.')
      return
    }
    setError(null)
    setJustSubmittedPrompt(prompt.trim())
    await onSubmitPrompt(prompt.trim())
  }

  const handleHistoryClick = async (historyPrompt: string) => {
    setPrompt(historyPrompt)
    onSelectHistory?.(historyPrompt)
    setJustSubmittedPrompt(historyPrompt)
    await onSubmitPrompt(historyPrompt)
  }

  const handleSuggestionClick = async (suggestion: string) => {
    if (!suggestion) return
    setPrompt(suggestion)
    setJustSubmittedPrompt(suggestion)
    await onSubmitPrompt(suggestion)
  }

  const copyWhereClause = async () => {
    if (!lastResult?.parsed_where_clause || typeof navigator === 'undefined' || !navigator.clipboard) {
      return
    }
    try {
      await navigator.clipboard.writeText(lastResult.parsed_where_clause)
    } catch {
      // no-op
    }
  }

  const currentMetadata = lastResult?.metadata
  const matchesShown = lastResult?.result_count ?? lastResult?.count ?? 0
  const totalMatches = lastResult?.total ?? currentMetadata?.total_matches ?? matchesShown
  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString('sv-SE', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: 'short',
      })
    } catch {
      return timestamp
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-sm font-semibold text-foreground">Acquisition Thesis</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Find profitable logistics firms in Sweden with >100M SEK revenue"
          className="min-h-[140px] w-full rounded-lg border border-border px-3 py-3 text-sm focus:border-border focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-card px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-card/90 disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Searching…' : 'Run AI Filter'}
          </button>
          {justSubmittedPrompt && (
            <div className="text-xs text-muted-foreground">
              Last run: <span className="font-medium text-foreground">{justSubmittedPrompt}</span>
            </div>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>

      {lastResult && (
        <div className="space-y-4 rounded-xl border border-border p-4">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Matches</p>
                <p className="text-lg font-semibold text-foreground">
                  {totalMatches.toLocaleString()} total{' '}
                  {matchesShown < totalMatches && (
                    <span className="text-sm font-normal text-muted-foreground">(showing {matchesShown})</span>
                  )}
                </p>
              </div>
              {currentMetadata && (
                <div className="flex flex-col items-end gap-1 text-[11px] text-muted-foreground">
                  <span className="rounded-full bg-muted px-2 py-0.5">Limit {currentMetadata.limit}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5">Offset {currentMetadata.offset}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 capitalize">
                    {currentMetadata.used_llm ? 'OpenAI parser' : 'Heuristic parser'}
                  </span>
                  {typeof currentMetadata.duration_ms === 'number' && (
                    <span className="rounded-full bg-muted px-2 py-0.5">
                      {currentMetadata.duration_ms} ms
                    </span>
                  )}
                </div>
              )}
            </div>
            {currentMetadata?.sql && (
              <p className="text-xs text-muted-foreground">Parsed SQL preview generated from your thesis.</p>
            )}
          </div>
          <div className="space-y-3">
            <div className="mb-2 flex items-center justify-between text-sm font-semibold text-foreground">
              SQL WHERE clause
              <button
                type="button"
                onClick={copyWhereClause}
                className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground hover:text-foreground"
              >
                <RefreshCcw className="h-3 w-3" />
                Copy
              </button>
            </div>
            <pre className="max-h-56 overflow-auto rounded-lg bg-card p-3 text-xs text-primary-foreground">
              {lastResult.parsed_where_clause}
            </pre>
            {lastResult.capped && lastResult.refinement_message && (
              <div className="rounded-lg border border-accent bg-accent/60 px-3 py-2 text-xs text-foreground">
                {lastResult.refinement_message}
              </div>
            )}
            {lastResult.suggestions && lastResult.suggestions.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Refinement ideas</p>
                <div className="flex flex-wrap gap-2">
                  {lastResult.suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="rounded-full border border-border px-3 py-1 text-xs text-foreground hover:bg-muted/40"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {lastResult.excluded_types && lastResult.excluded_types.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Automatically excluding:{' '}
                <span className="font-semibold text-foreground">
                  {lastResult.excluded_types.join(', ')}
                </span>
              </p>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Prompt History</h3>
          {history.length > 0 && (
            <span className="text-xs text-muted-foreground">{history.length} saved</span>
          )}
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No prompts yet. Your last 10 prompts will appear here.</p>
        ) : (
          <ul className="space-y-2 text-sm text-foreground">
            {history.map((item) => (
              <li
                key={`${item.timestamp}-${item.prompt}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
              >
                <button
                  type="button"
                  onClick={() => handleHistoryClick(item.prompt)}
                  className="flex-1 truncate text-left text-foreground hover:underline"
                >
                  {item.prompt}
                </button>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{item.count.toLocaleString()} hits</p>
                  <p>{formatTimestamp(item.timestamp)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

