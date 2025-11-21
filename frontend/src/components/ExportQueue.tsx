import { useState } from 'react'
import { apiService, type CopperExportResponse } from '../lib/apiService'
import type { CompanyRow } from './CompanyExplorer'

interface ExportQueueProps {
  selected: CompanyRow[]
}

export const ExportQueue: React.FC<ExportQueueProps> = ({ selected }) => {
  const [apiToken, setApiToken] = useState('')
  const [status, setStatus] = useState<CopperExportResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleExport = async () => {
    if (selected.length === 0) {
      setError('Select at least one company')
      return
    }
    setError(null)
    setIsLoading(true)
    try {
      const response = await apiService.exportToCopper(
        selected.map((item) => item.orgnr),
        apiToken || undefined
      )
      setStatus(response)
    } catch (err: any) {
      setError(err?.message || 'Export failed')
      setStatus(null)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 p-4">
      <div>
        <p className="text-sm font-semibold text-gray-800">Export Queue</p>
        <p className="text-xs text-gray-500">{selected.length} companies selected</p>
      </div>
      <input
        value={apiToken}
        onChange={(e) => setApiToken(e.target.value)}
        placeholder="Copper API token (optional, can be provided later)"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
      />
      <button
        onClick={handleExport}
        disabled={isLoading}
        className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/90 disabled:opacity-50"
      >
        {isLoading ? 'Exporting…' : 'Export to Copper'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {status && (
        <div className="rounded-md border border-gray-100 p-3 text-sm text-gray-700">
          <p>Export success: {status.success ? 'Yes' : 'No'}</p>
          <p>Companies exported: {status.exported}</p>
          {status.message && <p className="text-xs text-gray-500">{status.message}</p>}
        </div>
      )}
    </div>
  )
}

