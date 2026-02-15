import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { ExternalLink, Database, Play, Settings, Activity, BarChart3, AlertTriangle } from 'lucide-react'
import SessionTrackingDashboard from './SessionTrackingDashboard'
import DataValidationView from './DataValidationView'

const ScraperInterface: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  const glassPanelClass =
    'rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md shadow-[0_28px_60px_-35px_rgba(15,23,42,0.8)]'

  const handleOpenScraper = () => {
    setIsLoading(true)
    // Open local scraper in new tab
    window.open('http://localhost:3000', '_blank')
    setTimeout(() => setIsLoading(false), 1000)
  }

  const handleSessionSelect = (sessionId: string) => {
    setSelectedSessionId(sessionId)
    setActiveTab('validation')
  }

  return (
    <div className="relative isolate overflow-hidden rounded-3xl border border-white/10 bg-[#0B121F] p-8 text-slate-100 shadow-2xl md:p-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-16 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -bottom-36 right-0 h-80 w-80 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-transparent" />
      </div>

      <div className="relative space-y-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <span className="text-xs uppercase tracking-[0.35em] text-slate-400">Scraper suite</span>
            <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Company data pipeline
            </h2>
            <p className="max-w-2xl text-sm text-slate-300">
              Launch and monitor scraping sessions, inspect live throughput, and validate financial data from one calm workspace.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleOpenScraper}
              disabled={isLoading}
              variant="secondary"
              className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2 text-slate-100 transition hover:bg-white/20"
            >
              <Database className="h-4 w-4 text-emerald-300" />
              {isLoading ? 'Opening...' : 'Open scraper'}
              <ExternalLink className="h-4 w-4 text-emerald-300" />
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-6 text-amber-100 shadow-[0_18px_45px_-30px_rgba(245,158,11,0.6)]">
          <div className="flex items-start gap-4">
            <AlertTriangle className="h-5 w-5 text-amber-200" />
            <div className="space-y-2">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-amber-100">Large session performance</h4>
              <p className="text-sm text-amber-100/80">
                Runs exceeding 10k companies (2+ hours) work best with manual refresh and focused stage monitoring. Auto-refresh stays off by default for heavy sessions.
              </p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="grid w-full grid-cols-3 rounded-full border border-white/10 bg-white/5 p-1 text-slate-300">
            <TabsTrigger
              value="overview"
              className="flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition data-[state=active]:bg-[#0B121F] data-[state=active]:text-white data-[state=active]:shadow-[0_18px_35px_-25px_rgba(56,189,248,0.9)]"
            >
              <Database className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="sessions"
              className="flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition data-[state=active]:bg-[#0B121F] data-[state=active]:text-white data-[state=active]:shadow-[0_18px_35px_-25px_rgba(56,189,248,0.9)]"
            >
              <Activity className="h-4 w-4" />
              Sessions
            </TabsTrigger>
            <TabsTrigger
              value="validation"
              className="flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition data-[state=active]:bg-[#0B121F] data-[state=active]:text-white data-[state=active]:shadow-[0_18px_35px_-25px_rgba(56,189,248,0.9)] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40"
              disabled={!selectedSessionId}
            >
              <BarChart3 className="h-4 w-4" />
              Data validation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card className={`${glassPanelClass} p-6`}>
                <CardHeader className="border-none p-0 pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
                    <Play className="h-5 w-5 text-sky-300" />
                    3-stage process
                  </CardTitle>
                  <CardDescription className="text-sm text-slate-300">
                    Advanced scraping engine orchestrated across segmentation, identification, and financial enrichment.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="space-y-2 text-sm text-slate-300">
                    <li>• Stage 1: Company segmentation</li>
                    <li>• Stage 2: ID resolution</li>
                    <li>• Stage 3: Financial enrichment</li>
                    <li>• Live progress telemetry</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className={`${glassPanelClass} p-6`}>
                <CardHeader className="border-none p-0 pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
                    <Settings className="h-5 w-5 text-emerald-300" />
                    Precision targeting
                  </CardTitle>
                  <CardDescription className="text-sm text-slate-300">
                    Configure sophisticated filters to focus on the exact companies you need.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="space-y-2 text-sm text-slate-300">
                    <li>• Revenue and profitability bands</li>
                    <li>• Industry & geography filters</li>
                    <li>• Ownership and size criteria</li>
                    <li>• Custom inclusion lists</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className={`${glassPanelClass} p-6`}>
                <CardHeader className="border-none p-0 pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
                    <BarChart3 className="h-5 w-5 text-violet-300" />
                    Data validation
                  </CardTitle>
                  <CardDescription className="text-sm text-slate-300">
                    Quality safeguards ensure consistent, analysis-ready output for every session.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="space-y-2 text-sm text-slate-300">
                    <li>• Multi-year financial snapshots</li>
                    <li>• Completeness scoring</li>
                    <li>• Error surfacing & retries</li>
                    <li>• Export-ready datasets</li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Card className={`${glassPanelClass} p-6`}>
              <CardHeader className="border-none p-0 pb-4">
                <CardTitle className="text-lg font-semibold text-white">Getting started</CardTitle>
                <CardDescription className="text-sm text-slate-300">
                  Navigate between session telemetry and validation tools without leaving this workspace.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-6 p-0 md:grid-cols-2">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-200">Session management</h4>
                  <ul className="space-y-2 text-sm text-slate-300">
                    <li>• Review all active and historical runs</li>
                    <li>• Track stage completion in real time</li>
                    <li>• Control execution with pause/stop/restart</li>
                    <li>• Project throughput and completion</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-200">Data validation</h4>
                  <ul className="space-y-2 text-sm text-slate-300">
                    <li>• Inspect company-level records</li>
                    <li>• Compare historical financials</li>
                    <li>• Flag and retry problem cases</li>
                    <li>• Export curated datasets</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-6">
            <SessionTrackingDashboard
              onSessionSelect={handleSessionSelect}
              selectedSessionId={selectedSessionId}
              autoRefresh={false}
            />
          </TabsContent>

          <TabsContent value="validation" className="space-y-6">
            {selectedSessionId ? (
              <DataValidationView
                sessionId={selectedSessionId}
                onRefresh={() => {
                  // Refresh session data if needed
                }}
              />
            ) : (
              <Card className={`${glassPanelClass} p-6`}>
                <CardContent className="flex items-center justify-center p-8">
                  <div className="text-center space-y-2">
                    <BarChart3 className="mx-auto h-12 w-12 text-slate-500" />
                    <p className="text-sm text-slate-300">Select a session to review validation insights.</p>
                    <p className="text-xs text-slate-400">Head to the Sessions tab and choose a run to begin.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default ScraperInterface
