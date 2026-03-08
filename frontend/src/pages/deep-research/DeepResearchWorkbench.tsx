import { Outlet, Link, useParams, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  FileText,
  History,
  ShieldCheck,
  Users,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { label: 'Report', path: 'report/latest', icon: FileText },
  { label: 'Versions', path: 'report/versions', icon: History },
  { label: 'Verification', path: 'verification', icon: ShieldCheck },
  { label: 'Competitors', path: 'competitors', icon: Users },
  { label: 'Assumptions', path: 'assumptions', icon: Settings },
] as const

export default function DeepResearchWorkbench() {
  const { companyId } = useParams<{ companyId: string }>()
  const location = useLocation()

  const basePath = `/deep-research/company/${companyId}`

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-6 py-4 border-b">
        <Link
          to="/deep-research/runs"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-lg font-semibold">Deep Research</h1>
          <span className="text-xs text-muted-foreground font-mono truncate">
            {companyId}
          </span>
        </div>
      </header>

      <nav className="flex items-center gap-1 px-6 border-b bg-muted/30">
        {tabs.map((tab) => {
          const href = `${basePath}/${tab.path}`
          const isActive = location.pathname.startsWith(href)
          const Icon = tab.icon

          return (
            <Link
              key={tab.path}
              to={href}
              className={cn(
                'relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {isActive && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-foreground rounded-full" />
              )}
            </Link>
          )
        })}
      </nav>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
