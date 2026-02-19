import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  RefreshCw,
  Database,
  CheckCircle,
  Clock,
  AlertCircle,
  Play,
  RotateCcw,
  Eye,
  Settings,
  Timer,
  Activity,
  PauseCircle,
  PlayCircle,
  StopCircle,
  ActivitySquare,
  BarChart2,
  AlertTriangle,
  ArrowRight,
  CalendarClock
} from 'lucide-react';
import { buildScraperApiUrl } from '@/lib/scraperUrls';

interface SessionInfo {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'completed' | 'error';
  stages: {
    stage1: {
      status: 'pending' | 'running' | 'completed' | 'error';
      companies: number;
      completedAt?: string;
    };
    stage2: {
      status: 'pending' | 'running' | 'completed' | 'error';
      companyIds: number;
      completedAt?: string;
    };
    stage3: {
      status: 'pending' | 'running' | 'completed' | 'error';
      financials: number;
      completedAt?: string;
    };
  };
  totalCompanies: number;
  totalCompanyIds: number;
  totalFinancials: number;
  filters?: any;
  progress?: {
    stage1Progress: number;
    stage2Progress: number;
    stage3Progress: number;
    overallProgress: number;
  };
}

interface MonitoringStageProgress {
  completed: number;
  total: number;
  percentage: number;
  ratePerMinute?: number;
  etaMinutes?: number;
  lastUpdated?: string;
}

interface MonitoringData {
  jobId: string;
  timestamp: string;
  status: {
    current: string;
    isRunning: boolean;
    isCompleted: boolean;
  };
  progress?: {
    total?: {
      companies?: number;
      companyIds?: number;
      financials?: number;
    };
    rates?: {
      companiesPerMinute?: number;
      idsPerMinute?: number;
      financialsPerMinute?: number;
    };
    etaMinutes?: number;
    estimatedCompletionTime?: string;
  };
  stages?: {
    stage1?: MonitoringStageProgress;
    stage2?: MonitoringStageProgress;
    stage3?: MonitoringStageProgress;
  };
  errors?: {
    total?: number;
    byStage?: {
      stage1?: number;
      stage2?: number;
      stage3?: number;
    };
    byType?: Record<string, number>;
    recent?: Array<{
      id: string;
      companyName?: string;
      orgnr?: string;
      stage: 'stage1' | 'stage2' | 'stage3';
      errorType: string;
      message: string;
      occurredAt: string;
      retryable?: boolean;
    }>;
  };
}

interface SessionTrackingDashboardProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
  onSessionSelect?: (sessionId: string) => void;
  selectedSessionId?: string;
}

const SessionTrackingDashboard: React.FC<SessionTrackingDashboardProps> = ({ 
  autoRefresh = false, 
  refreshInterval = 5000,
  onSessionSelect,
  selectedSessionId
}) => {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(selectedSessionId || null);
  const [sessionDetails, setSessionDetails] = useState<SessionInfo | null>(null);
  const [enableAutoRefresh, setEnableAutoRefresh] = useState(autoRefresh);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [monitoringData, setMonitoringData] = useState<MonitoringData | null>(null);
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [processActionLoading, setProcessActionLoading] = useState<null | 'pause' | 'resume' | 'stop' | 'restart'>(null);
  const [retryingErrorId, setRetryingErrorId] = useState<string | null>(null);

  const fetchSessions = async () => {
    try {
      setRefreshing(true);

      const apiUrl = buildScraperApiUrl('/api/sessions');

      const response = await fetch(apiUrl);
      const data = await response.json();
      
      if (data.success) {
        setSessions(data.sessions);
        setLastUpdated(new Date());
        
        // Auto-select first session if none selected
        if (!selectedSession && data.sessions.length > 0) {
          const firstSession = data.sessions[0];
          setSelectedSession(firstSession.sessionId);
          if (onSessionSelect) {
            onSessionSelect(firstSession.sessionId);
          }
        }
      } else {
        console.error('Failed to fetch sessions:', data.error);
      }
      
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchSessionDetails = async (sessionId: string) => {
    try {
      const apiUrl = buildScraperApiUrl(`/api/sessions/${sessionId}`);

      const response = await fetch(apiUrl);
      const data = await response.json();

      if (data.success) {
        setSessionDetails(data.session);
        await fetchMonitoringData(sessionId);
      } else {
        console.error('Failed to fetch session details:', data.error);
      }
    } catch (error) {
      console.error('Error fetching session details:', error);
    }
  };

  const fetchMonitoringData = async (sessionId: string) => {
    try {
      setMonitoringLoading(true);
      const apiUrl = buildScraperApiUrl(`/api/monitoring/dashboard?jobId=${encodeURIComponent(sessionId)}`);

      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Monitoring request failed with status ${response.status}`);
      }

      const data = await response.json();
      setMonitoringData(data);
    } catch (error) {
      console.error('Error fetching monitoring data:', error);
      setMonitoringData(null);
    } finally {
      setMonitoringLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();

    if (enableAutoRefresh) {
      const interval = setInterval(() => {
        fetchSessions();
        if (selectedSession) {
          fetchSessionDetails(selectedSession);
        }
      }, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [enableAutoRefresh, refreshInterval, selectedSession]);

  useEffect(() => {
    if (selectedSession) {
      fetchSessionDetails(selectedSession);
    }
  }, [selectedSession]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
      case 'active':
        return <Clock className="h-4 w-4 text-sky-300" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-emerald-300" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-rose-400" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge
            variant="outline"
            className="border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
          >
            Active
          </Badge>
        );
      case 'completed':
        return (
          <Badge
            variant="outline"
            className="border-sky-400/40 bg-sky-400/10 text-sky-100"
          >
            Completed
          </Badge>
        );
      case 'error':
        return (
          <Badge
            variant="outline"
            className="border-rose-500/40 bg-rose-500/10 text-rose-200"
          >
            Error
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="border-border/40 bg-muted/20 text-muted-foreground"
          >
            Unknown
          </Badge>
        );
    }
  };

  const getStageBadge = (stage: string, status: string) => {
    const baseClasses = 'text-[0.65rem] tracking-wide px-2.5 py-1 rounded-full border';
    switch (status) {
      case 'completed':
        return (
          <span className={`${baseClasses} border-sky-400/40 bg-sky-400/10 text-sky-100`}>
            {stage}
          </span>
        );
      case 'running':
        return (
          <span className={`${baseClasses} border-emerald-400/40 bg-emerald-400/10 text-emerald-100`}>
            {stage}
          </span>
        );
      case 'error':
        return (
          <span className={`${baseClasses} border-rose-500/40 bg-rose-500/10 text-rose-200`}>
            {stage}
          </span>
        );
      default:
        return (
          <span className={`${baseClasses} border-border/40 bg-muted/20 text-muted-foreground`}>
            {stage}
          </span>
        );
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('sv-SE');
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('sv-SE').format(num);
  };

  const getOverallProgress = (session: SessionInfo) => {
    const stages = [session.stages.stage1, session.stages.stage2, session.stages.stage3];
    const completedStages = stages.filter(stage => stage.status === 'completed').length;
    return Math.round((completedStages / 3) * 100);
  };

  const handleSessionSelect = (sessionId: string) => {
    setSelectedSession(sessionId);
    if (onSessionSelect) {
      onSessionSelect(sessionId);
    }
  };

  const handleProcessControl = async (action: 'pause' | 'resume' | 'stop' | 'restart') => {
    if (!selectedSession) return;

    try {
      setProcessActionLoading(action);
      const apiUrl = buildScraperApiUrl('/api/monitoring/control');

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId: selectedSession,
          action,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || `Failed to ${action} job ${selectedSession}`);
      }

      await fetchSessionDetails(selectedSession);
    } catch (error) {
      console.error(`Error executing ${action}:`, error);
    } finally {
      setProcessActionLoading(null);
    }
  };

  const handleRetryError = async (errorId: string) => {
    if (!selectedSession) return;

    try {
      setRetryingErrorId(errorId);
      const apiUrl = buildScraperApiUrl(`/api/sessions/${selectedSession}/errors/${errorId}/retry`);

      const response = await fetch(apiUrl, {
        method: 'POST',
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || 'Retry request failed');
      }

      await fetchMonitoringData(selectedSession);
      await fetchSessionDetails(selectedSession);
    } catch (error) {
      console.error('Error retrying failure:', error);
    } finally {
      setRetryingErrorId(null);
    }
  };

  const getStageDisplayName = (stage: 'stage1' | 'stage2' | 'stage3') => {
    switch (stage) {
      case 'stage1':
        return 'Stage 1: Segmentation';
      case 'stage2':
        return 'Stage 2: Company IDs';
      case 'stage3':
        return 'Stage 3: Financials';
      default:
        return stage;
    }
  };

  const formatPercentage = (value?: number) => {
    if (value === undefined || Number.isNaN(value)) {
      return '—';
    }
    return `${Math.round(value)}%`;
  };

  const getSessionStage = (stage: 'stage1' | 'stage2' | 'stage3') => {
    if (!sessionDetails) return undefined;
    return sessionDetails.stages[stage];
  };

  const stageMetrics = useMemo(() => {
    return [
      {
        key: 'stage1' as const,
        label: 'Stage 1: Segmentation',
        progress: monitoringData?.stages?.stage1?.percentage ?? sessionDetails?.progress?.stage1Progress,
        completed: monitoringData?.stages?.stage1?.completed ?? sessionDetails?.totalCompanies,
        total: monitoringData?.stages?.stage1?.total ?? sessionDetails?.totalCompanies,
        rate: monitoringData?.progress?.rates?.companiesPerMinute,
        eta: monitoringData?.stages?.stage1?.etaMinutes,
      },
      {
        key: 'stage2' as const,
        label: 'Stage 2: Company IDs',
        progress: monitoringData?.stages?.stage2?.percentage ?? sessionDetails?.progress?.stage2Progress,
        completed: monitoringData?.stages?.stage2?.completed ?? sessionDetails?.totalCompanyIds,
        total: monitoringData?.stages?.stage2?.total ?? sessionDetails?.totalCompanies,
        rate: monitoringData?.progress?.rates?.idsPerMinute,
        eta: monitoringData?.stages?.stage2?.etaMinutes,
      },
      {
        key: 'stage3' as const,
        label: 'Stage 3: Financials',
        progress: monitoringData?.stages?.stage3?.percentage ?? sessionDetails?.progress?.stage3Progress,
        completed: monitoringData?.stages?.stage3?.completed ?? sessionDetails?.totalFinancials,
        total: monitoringData?.stages?.stage3?.total ?? sessionDetails?.totalCompanyIds,
        rate: monitoringData?.progress?.rates?.financialsPerMinute,
        eta: monitoringData?.stages?.stage3?.etaMinutes,
      },
    ];
  }, [monitoringData, sessionDetails]);

  const glassPanelClass =
    'rounded-2xl border border-border/20 bg-muted/10 backdrop-blur-md shadow-[0_28px_60px_-35px_hsl(var(--border) / 0.35)]';
  const subtleLabelClass = 'text-xs uppercase tracking-[0.3em] text-muted-foreground';

  const isRunning = monitoringData?.status?.isRunning ?? sessionDetails?.status === 'active';
  const isCompleted = monitoringData?.status?.isCompleted ?? sessionDetails?.status === 'completed';
  const estimatedMinutesRemaining = monitoringData?.progress?.etaMinutes;
  const estimatedCompletionTime = monitoringData?.progress?.estimatedCompletionTime;
  const formattedEta = useMemo(() => {
    if (estimatedMinutesRemaining === undefined || estimatedMinutesRemaining === null) {
      return '—';
    }

    if (estimatedMinutesRemaining < 60) {
      return `~${Math.max(1, Math.round(estimatedMinutesRemaining))} min`;
    }

    const hours = Math.floor(estimatedMinutesRemaining / 60);
    const minutes = Math.round(estimatedMinutesRemaining % 60);
    return `~${hours}h ${minutes}m`;
  }, [estimatedMinutesRemaining]);

  const handleStageControl = async (stage: number, action: string) => {
    if (!selectedSession) return;
    
    try {
      const apiUrl = buildScraperApiUrl('/api/stages/control');

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: selectedSession,
          stage: stage.toString(),
          action: action
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Refresh session details after starting stage
        fetchSessionDetails(selectedSession);
        console.log(`Stage ${stage} ${action} initiated:`, data.message);
      } else {
        console.error(`Failed to ${action} stage ${stage}:`, data.error);
      }
    } catch (error) {
      console.error(`Error ${action}ing stage ${stage}:`, error);
    }
  };

  if (loading) {
    return (
      <div className="relative isolate overflow-hidden rounded-3xl border border-border/20 bg-card p-10 text-primary-foreground shadow-2xl">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -right-16 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="absolute -bottom-20 left-1/2 h-52 w-52 -translate-x-1/2 rounded-full bg-sky-500/15 blur-3xl" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-transparent" />
        </div>
        <div className="relative flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin text-emerald-300" />
            <span>Preparing live session data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate overflow-hidden rounded-3xl border border-border/20 bg-card p-8 text-primary-foreground shadow-2xl md:p-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -right-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-10 h-64 w-64 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-transparent" />
      </div>

      <div className="relative space-y-10">
        {/* Header */}
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <span className={subtleLabelClass}>Scraper Control</span>
            <h2 className="text-3xl font-semibold tracking-tight text-primary-foreground md:text-4xl">
              Live session overview
            </h2>
            <p className="max-w-xl text-sm text-muted-foreground">
              Monitor the pipeline in real time, follow stage progress, and respond quickly to any
              errors.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={fetchSessions}
              disabled={refreshing}
              variant="secondary"
              size="sm"
              className="flex items-center gap-2 rounded-full px-5 py-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-emerald-300' : 'text-emerald-200'}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Session Selector */}
        <Card className={`${glassPanelClass} p-6`}> 
          <CardHeader className="border-none p-0 pb-6">
            <CardTitle className="flex items-center gap-3 text-lg font-semibold text-primary-foreground">
              <Settings className="h-5 w-5 text-emerald-300" />
              Session selection & controls
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Choose a session and configure real-time refresh behaviour.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col items-start gap-6 md:flex-row md:items-end">
              <div className="w-full flex-1">
                <label className="mb-2 block text-sm font-medium text-muted-foreground">Select session</label>
                <Select value={selectedSession || ''} onValueChange={handleSessionSelect}>
                  <SelectTrigger className="w-full rounded-xl border border-border/20 bg-muted/15 px-4 py-3 text-left text-primary-foreground shadow-inner shadow-black/20 focus:ring-2 focus:ring-emerald-400/60 focus:ring-offset-0">
                    <SelectValue placeholder="Choose a session to monitor" />
                  </SelectTrigger>
                  <SelectContent className="border border-border/20 bg-card text-primary-foreground">
                    {sessions.map((session) => (
                      <SelectItem
                        key={session.sessionId}
                        value={session.sessionId}
                        className="flex items-center justify-between gap-3 rounded-lg text-sm hover:bg-muted/15"
                      >
                        <div className="flex items-center justify-between w-full gap-3">
                          <span className="font-medium text-primary-foreground">
                            Session {session.sessionId.slice(0, 8)}...
                          </span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {getStatusBadge(session.status)}
                            <span>{session.totalCompanies} companies</span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-3 text-muted-foreground">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={enableAutoRefresh}
                    onCheckedChange={setEnableAutoRefresh}
                  />
                  <span className="text-sm">Auto-refresh</span>
                </div>
                {lastUpdated && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Timer className="h-3 w-3 text-emerald-300" />
                    Last updated: {lastUpdated.toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

      {/* Sessions Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className={`${glassPanelClass} relative overflow-hidden p-6`}>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 p-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total sessions</CardTitle>
            <Database className="h-4 w-4 text-emerald-300" />
          </CardHeader>
          <CardContent className="relative p-0 pt-4">
            <div className="text-3xl font-semibold text-primary-foreground">{sessions.length}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card className={`${glassPanelClass} relative overflow-hidden p-6`}>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-500/10 via-transparent to-transparent" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 p-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active sessions</CardTitle>
            <Clock className="h-4 w-4 text-sky-300" />
          </CardHeader>
          <CardContent className="relative p-0 pt-4">
            <div className="text-3xl font-semibold text-primary-foreground">
              {sessions.filter(s => s.status === 'active').length}
            </div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card className={`${glassPanelClass} relative overflow-hidden p-6`}>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-transparent" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 p-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed sessions</CardTitle>
            <CheckCircle className="h-4 w-4 text-violet-300" />
          </CardHeader>
          <CardContent className="relative p-0 pt-4">
            <div className="text-3xl font-semibold text-primary-foreground">
              {sessions.filter(s => s.status === 'completed').length}
            </div>
            <p className="text-xs text-muted-foreground">Successfully finished</p>
          </CardContent>
        </Card>
      </div>

      {/* Sessions List */}
      <Card className={`${glassPanelClass} p-6`}>
        <CardHeader className="border-none p-0 pb-6">
          <CardTitle className="text-lg font-semibold text-primary-foreground">Recent sessions</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Latest scraping runs with three-stage progress tracking.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-4">
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/20 bg-card/[0.03] py-10 text-muted-foreground">
                <Database className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No scraping sessions found</p>
                <p className="text-xs text-muted-foreground">Start a new scraping session to see it here.</p>
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.sessionId}
                  className="rounded-2xl border border-border/20 bg-card/[0.02] p-5 transition hover:border-border/20 hover:bg-card/[0.05]"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(session.status)}
                      <div>
                        <div className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Session</div>
                        <div className="text-lg font-semibold text-primary-foreground">
                          {session.sessionId.slice(0, 8)}…
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Created {formatDate(session.createdAt)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(session.status)}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          setSelectedSession(
                            selectedSession === session.sessionId ? null : session.sessionId
                          )
                        }
                        className="flex items-center gap-2 rounded-full px-4 py-2"
                      >
                        <Eye className="h-4 w-4" />
                        {selectedSession === session.sessionId ? 'Hide' : 'View'}
                      </Button>
                    </div>
                  </div>

                  {/* 3-Stage Progress */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-muted-foreground">Progress</span>
                      <span className="text-sm text-muted-foreground">{getOverallProgress(session)}%</span>
                    </div>
                    <Progress value={getOverallProgress(session)} className="mb-3 h-2 bg-muted/20" />
                    
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-1">
                        {getStageBadge('Stage 1', session.stages.stage1.status)}
                        <span className="text-muted-foreground">({session.totalCompanies} companies)</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        {getStageBadge('Stage 2', session.stages.stage2.status)}
                        <span className="text-muted-foreground">({session.totalCompanyIds} IDs)</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        {getStageBadge('Stage 3', session.stages.stage3.status)}
                        <span className="text-muted-foreground">({session.totalFinancials} financials)</span>
                      </div>
                    </div>
                  </div>

                  {/* Session Details */}
                  {selectedSession === session.sessionId && sessionDetails && (
                    <div className="mt-6 space-y-6 border-t border-border/20 pt-6">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                            <ActivitySquare className="h-3 w-3" />
                            <span>
                              Last update:{' '}
                              {monitoringData?.timestamp
                                ? new Date(monitoringData.timestamp).toLocaleString('sv-SE')
                                : formatDate(sessionDetails.updatedAt)}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2 text-lg font-semibold text-primary-foreground">
                              {getStatusIcon(monitoringData?.status?.current || sessionDetails.status)}
                              <span className="capitalize">
                                {(monitoringData?.status?.current || sessionDetails.status || '').replace(/_/g, ' ')}
                              </span>
                            </div>
                            {getStatusBadge(sessionDetails.status)}
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CalendarClock className="h-4 w-4 text-muted-foreground" />
                              ETA: {formattedEta}
                            </span>
                            {estimatedCompletionTime && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                Est. completion{' '}
                                {new Date(estimatedCompletionTime).toLocaleString('sv-SE')}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Activity className="h-4 w-4 text-muted-foreground" />
                              Overall progress {formatPercentage(sessionDetails.progress?.overallProgress)}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {isRunning && !isCompleted && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleProcessControl('pause')}
                              disabled={processActionLoading !== null}
                              className="flex items-center gap-2 rounded-full px-4 py-2"
                            >
                              {processActionLoading === 'pause' ? (
                                <RefreshCw className="h-4 w-4 animate-spin text-emerald-300" />
                              ) : (
                                <PauseCircle className="h-4 w-4 text-muted-foreground" />
                              )}
                              Pause
                            </Button>
                          )}

                          {!isRunning && !isCompleted && (
                            <Button
                              size="sm"
                              onClick={() => handleProcessControl('resume')}
                              disabled={processActionLoading !== null}
                              className="flex items-center gap-2 rounded-full px-4 py-2"
                            >
                              {processActionLoading === 'resume' ? (
                                <RefreshCw className="h-4 w-4 animate-spin text-emerald-300" />
                              ) : (
                                <PlayCircle className="h-4 w-4 text-emerald-300" />
                              )}
                              Resume
                            </Button>
                          )}

                          {!isCompleted && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleProcessControl('stop')}
                              disabled={processActionLoading !== null}
                              className="flex items-center gap-2 rounded-full px-4 py-2"
                            >
                              {processActionLoading === 'stop' ? (
                                <RefreshCw className="h-4 w-4 animate-spin text-emerald-300" />
                              ) : (
                                <StopCircle className="h-4 w-4 text-rose-300" />
                              )}
                              Stop
                            </Button>
                          )}

                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleProcessControl('restart')}
                            disabled={processActionLoading !== null}
                            className="flex items-center gap-2 rounded-full px-4 py-2"
                          >
                            {processActionLoading === 'restart' ? (
                              <RefreshCw className="h-4 w-4 animate-spin text-emerald-300" />
                            ) : (
                              <RotateCcw className="h-4 w-4 text-muted-foreground" />
                            )}
                            Restart
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-3">
                            <BarChart2 className="h-4 w-4" />
                            Stage performance
                          </div>
                          {monitoringLoading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              Updating metrics...
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                              {stageMetrics.map((stage) => {
                                const stageInfo = getSessionStage(stage.key);
                                const canTriggerStage = stage.key === 'stage2'
                                  ? getSessionStage('stage1')?.status === 'completed'
                                  : stage.key === 'stage3'
                                    ? getSessionStage('stage2')?.status === 'completed'
                                    : false;
                                return (
                                  <Card key={stage.key} className={`${glassPanelClass} p-5`}>
                                    <CardHeader className="border-none p-0 pb-4">
                                      <CardTitle className="text-sm font-semibold text-primary-foreground">
                                        {stage.label}
                                      </CardTitle>
                                      <CardDescription className="flex items-center gap-2 text-muted-foreground">
                                        {getStageBadge(stage.label, stageInfo?.status || 'pending')}
                                        <span className="text-xs text-muted-foreground">
                                          {stageInfo?.status?.toUpperCase() || 'PENDING'}
                                        </span>
                                      </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-3 p-0">
                                      <div>
                                        <Progress value={stage.progress ?? 0} className="mb-2 h-2 bg-muted/20" />
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                          <span>{formatPercentage(stage.progress)}</span>
                                          <span>
                                            {formatNumber(stage.completed ?? 0)} /{' '}
                                            {stage.total ? formatNumber(stage.total) : '—'}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground">
                                        <div className="flex items-center justify-between">
                                          <span>Rate</span>
                                          <span className="font-medium text-primary-foreground">
                                            {stage.rate ? `${stage.rate.toFixed(1)}/min` : '—'}
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span>ETA</span>
                                          <span className="font-medium text-primary-foreground">
                                            {stage.eta ? `${Math.round(stage.eta)} min` : '—'}
                                          </span>
                                        </div>
                                        {stageInfo?.completedAt && (
                                          <div className="flex items-center justify-between">
                                            <span>Completed</span>
                                            <span>{formatDate(stageInfo.completedAt)}</span>
                                          </div>
                                        )}
                                      </div>
                                      {stageInfo?.status === 'pending' && stage.key !== 'stage1' && canTriggerStage && (
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          onClick={() => handleStageControl(stage.key === 'stage2' ? 2 : 3, 'start')}
                                          className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-2"
                                        >
                                          <Play className="h-3 w-3" />
                                          Start {stage.label.split(':')[0]}
                                        </Button>
                                      )}
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <Card className={`${glassPanelClass} p-6`}>
                            <CardHeader className="border-none p-0 pb-4">
                              <CardTitle className="text-sm font-semibold text-primary-foreground">Throughput & timing</CardTitle>
                              <CardDescription className="text-sm text-muted-foreground">Real-time processing rates</CardDescription>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 gap-4 text-sm text-muted-foreground sm:grid-cols-3">
                              <div>
                                <div className="text-xs uppercase text-muted-foreground">Stage 1</div>
                                <div className="text-lg font-semibold text-primary-foreground">
                                  {monitoringData?.progress?.rates?.companiesPerMinute
                                    ? `${monitoringData.progress.rates.companiesPerMinute.toFixed(1)}`
                                    : '—'}
                                </div>
                                <div className="text-xs text-muted-foreground">companies / min</div>
                              </div>
                              <div>
                                <div className="text-xs uppercase text-muted-foreground">Stage 2</div>
                                <div className="text-lg font-semibold text-primary-foreground">
                                  {monitoringData?.progress?.rates?.idsPerMinute
                                    ? `${monitoringData.progress.rates.idsPerMinute.toFixed(1)}`
                                    : '—'}
                                </div>
                                <div className="text-xs text-muted-foreground">IDs / min</div>
                              </div>
                              <div>
                                <div className="text-xs uppercase text-muted-foreground">Stage 3</div>
                                <div className="text-lg font-semibold text-primary-foreground">
                                  {monitoringData?.progress?.rates?.financialsPerMinute
                                    ? `${monitoringData.progress.rates.financialsPerMinute.toFixed(1)}`
                                    : '—'}
                                </div>
                                <div className="text-xs text-muted-foreground">records / min</div>
                              </div>
                            </CardContent>
                          </Card>

                          <Card className={`${glassPanelClass} p-6`}>
                            <CardHeader className="border-none p-0 pb-4">
                              <CardTitle className="text-sm font-semibold text-primary-foreground">Session totals</CardTitle>
                              <CardDescription className="text-sm text-muted-foreground">Processed entities across stages</CardDescription>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 gap-4 text-sm text-muted-foreground sm:grid-cols-3">
                              <div>
                                <div className="text-xs uppercase text-muted-foreground">Companies</div>
                                <div className="text-lg font-semibold text-primary-foreground">
                                  {formatNumber(sessionDetails.totalCompanies)}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs uppercase text-muted-foreground">Company IDs</div>
                                <div className="text-lg font-semibold text-primary-foreground">
                                  {formatNumber(sessionDetails.totalCompanyIds)}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs uppercase text-muted-foreground">Financials</div>
                                <div className="text-lg font-semibold text-primary-foreground">
                                  {formatNumber(sessionDetails.totalFinancials)}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>

                      {monitoringData?.errors && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                            <AlertTriangle className="h-4 w-4 text-rose-400" />
                            Error monitoring
                          </div>

                          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                            <Card className={`${glassPanelClass} p-6`}>
                              <CardHeader className="border-none p-0 pb-4">
                                <CardTitle className="text-sm font-semibold text-primary-foreground">Active errors</CardTitle>
                                <CardDescription className="text-sm text-muted-foreground">Issues requiring attention</CardDescription>
                              </CardHeader>
                              <CardContent className="p-0">
                                <div className="text-3xl font-bold text-rose-400">
                                  {monitoringData.errors.total ?? 0}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Across all stages</p>
                              </CardContent>
                            </Card>

                            <Card className={`${glassPanelClass} p-6`}>
                              <CardHeader className="border-none p-0 pb-4">
                                <CardTitle className="text-sm font-semibold text-primary-foreground">By stage</CardTitle>
                                <CardDescription className="text-sm text-muted-foreground">Distribution of failures</CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-2 p-0 text-sm text-muted-foreground">
                                {(['stage1', 'stage2', 'stage3'] as const).map((stage) => (
                                  <div key={stage} className="flex items-center justify-between text-muted-foreground">
                                    <span className="flex items-center gap-2">
                                      <Badge
                                        variant="outline"
                                        className="rounded-full border-border/20 bg-muted/20 text-xs text-muted-foreground"
                                      >
                                        {getStageDisplayName(stage)}
                                      </Badge>
                                    </span>
                                    <span className="font-medium text-primary-foreground">
                                      {monitoringData.errors?.byStage?.[stage] ?? 0}
                                    </span>
                                  </div>
                                ))}
                              </CardContent>
                            </Card>

                            <Card className={`${glassPanelClass} p-6`}>
                              <CardHeader className="border-none p-0 pb-4">
                                <CardTitle className="text-sm font-semibold text-primary-foreground">By type</CardTitle>
                                <CardDescription className="text-sm text-muted-foreground">Top error categories</CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-2 p-0 text-sm text-muted-foreground">
                                {monitoringData.errors.byType &&
                                  Object.entries(monitoringData.errors.byType)
                                    .sort((a, b) => b[1] - a[1])
                                    .slice(0, 4)
                                    .map(([type, count]) => (
                                      <div key={type} className="flex items-center justify-between">
                                        <span className="capitalize">{type.replace(/_/g, ' ')}</span>
                                        <span className="font-medium text-primary-foreground">{count}</span>
                                      </div>
                                    ))}
                                {(!monitoringData.errors.byType || Object.keys(monitoringData.errors.byType).length === 0) && (
                                  <div className="text-xs text-muted-foreground">No error data available</div>
                                )}
                              </CardContent>
                            </Card>
                          </div>

                          {monitoringData.errors.recent && monitoringData.errors.recent.length > 0 && (
                            <Card className={`${glassPanelClass} p-6`}>
                              <CardHeader className="border-none p-0 pb-4">
                                <CardTitle className="text-sm font-semibold text-primary-foreground">Recent errors</CardTitle>
                                <CardDescription className="text-sm text-muted-foreground">Latest retryable failures</CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-4 p-0">
                                {monitoringData.errors.recent.map((error) => (
                                  <div
                                    key={error.id}
                                    className="flex flex-col gap-2 rounded-2xl border border-border/20 bg-card/[0.03] p-4 transition hover:border-border/20 hover:bg-card/[0.05] md:flex-row md:items-center md:justify-between"
                                  >
                                    <div className="space-y-1">
                                      <div className="font-medium text-primary-foreground">
                                        {error.companyName || 'Unknown company'}
                                        {error.orgnr && (
                                          <span className="ml-2 font-mono text-xs text-muted-foreground">{error.orgnr}</span>
                                        )}
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        {error.message}
                                      </div>
                                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                          <Badge
                                            variant="outline"
                                            className="rounded-full border-border/20 bg-muted/20 text-xs text-muted-foreground"
                                          >
                                            {getStageDisplayName(error.stage)}
                                          </Badge>
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <AlertCircle className="h-3 w-3 text-rose-300" />
                                          {error.errorType.replace(/_/g, ' ')}
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <Clock className="h-3 w-3 text-muted-foreground" />
                                          {new Date(error.occurredAt).toLocaleString('sv-SE')}
                                        </span>
                                      </div>
                                    </div>
                                    {error.retryable !== false && (
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => handleRetryError(error.id)}
                                        disabled={retryingErrorId === error.id}
                                        className="mt-2 flex items-center gap-2 rounded-full px-4 py-2 md:mt-0"
                                      >
                                        {retryingErrorId === error.id ? (
                                          <RefreshCw className="h-4 w-4 animate-spin text-emerald-300" />
                                        ) : (
                                          <ArrowRight className="h-4 w-4" />
                                        )}
                                        Retry
                                      </Button>
                                    )}
                                  </div>
                                ))}
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      )}

                      {sessionDetails.filters && (
                        <Card className={`${glassPanelClass} p-6`}>
                          <CardHeader className="border-none p-0 pb-4">
                            <CardTitle className="text-sm font-semibold text-primary-foreground">Filters applied</CardTitle>
                            <CardDescription className="text-sm text-muted-foreground">Source criteria for this session</CardDescription>
                          </CardHeader>
                          <CardContent className="p-0">
                            <pre className="overflow-x-auto rounded-2xl bg-card/[0.03] p-4 text-xs text-muted-foreground">
                              {JSON.stringify(sessionDetails.filters, null, 2)}
                            </pre>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
  );
};

export default SessionTrackingDashboard;
