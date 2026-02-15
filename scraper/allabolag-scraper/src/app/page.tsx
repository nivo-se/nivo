'use client';

import React, { useState, useEffect } from 'react';
import SessionModal from './components/SessionModal';

interface Job {
  id: string;
  jobType: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'error' | 'done' | 'stopped';
  stage: 'stage1_segmentation' | 'stage2_enrichment' | 'stage3_financials' | 'validation' | 'migration';
  lastPage: number;
  processedCount: number;
  totalCompanies?: number;
  errorCount?: number;
  error?: string;
  rateLimitStats?: any;
  createdAt: string;
  updatedAt: string;
  progressRate?: number; // companies per minute
  estimatedTimeRemaining?: number; // minutes
}

interface MonitoringDashboard {
  jobId: string;
  timestamp: string;
  status: {
    current: string;
    stage: string;
    isRunning: boolean;
    isCompleted: boolean;
    hasErrors: boolean;
  };
  progress: {
    total: {
      companies: number;
      companyIds: number;
      financials: number;
    };
    rates: {
      companiesPerMinute: number;
      idsPerMinute: number;
      financialsPerMinute: number;
    };
    estimates: {
      elapsedMinutes: number;
      estimatedRemainingMinutes: number;
      estimatedCompletionTime: string;
    };
  };
  stages: {
    stage1: { completed: number; total: number; percentage: number };
    stage2: { completed: number; total: number; percentage: number };
    stage3: { completed: number; total: number; percentage: number };
  };
  systemHealth: {
    memoryUsage: { heapUsed: number };
    uptime: number;
    lastHeartbeat: string;
  };
  recommendations: string[];
}

interface SegmentationParams {
  revenueFrom: number | undefined;
  revenueTo: number | undefined;
  profitFrom: number | undefined;
  profitTo: number | undefined;
  companyType: 'AB';
}

interface ValidationSummary {
  total: number;
  valid: number;
  warnings: number;
  invalid: number;
}

interface MigrationResult {
  migrated: number;
  skipped: number;
  errors: number;
  report: any;
}

interface ValidationData {
  companies: Array<{
    orgnr: string;
    companyName: string;
    companyId: string;
    status: string;
    stage1Data: {
      revenue: number;
      profit: number;
      nace: string[];
      segment: string[];
      homepage: string | null;
      foundedYear: number | null;
    };
    stage2Data: {
      companyId: string | null;
      confidence: string | null;
    };
    stage3Data: {
      years: number[];
      recordCount: number;
      validationStatus: string;
      financials?: Array<{
      year: number;
        period: string;
        periodStart: string | null;
        periodEnd: string | null;
        currency: string;
        revenue: number | null;
        profit: number | null;
        employees: number | null;
        be: number | null;
        tr: number | null;
        ors?: number | null; // EBITDA
        rg?: number | null;   // Operating Income (EBIT)
        ek?: number | null;  // Equity
        fk?: number | null;  // Debt
      }>;
    };
    errors: any[];
  }>;
  summary: {
    totalCompanies: number;
    companiesWithIds: number;
    companiesWithFinancials: number;
    totalFinancialRecords: number;
    avgRecordsPerCompany: number;
    stage1Progress: number;
    stage2Progress: number;
    stage3Progress: number;
    yearRange: { min: number | null; max: number | null };
  };
}

export default function Home() {
  const [params, setParams] = useState<SegmentationParams>({
    revenueFrom: undefined,
    revenueTo: undefined,
    profitFrom: undefined,
    profitTo: undefined,
    companyType: 'AB',
  });
  
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scraping' | 'validation' | 'migration'>('scraping');
  const [testResults, setTestResults] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [validationData, setValidationData] = useState<ValidationData | null>(null);
  const [validationLoading, setValidationLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [monitoringDashboard, setMonitoringDashboard] = useState<MonitoringDashboard | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const itemsPerPage = 10;

  // Helper function to map backend job response to frontend format
  const mapJobResponse = (job: any) => ({
    ...job,
    totalCompanies: job.stats?.companies || job.totalCompanies || 0,
    processedCount: job.processedCount || job.stats?.companies || 0,
    lastPage: job.lastPage || 0,
    errorCount: job.errorCount || job.stats?.errors || 0,
    lastError: job.lastError || job.error || null,
    stage: job.stage || 'stage1_segmentation',
    status: job.status || 'pending'
  });

  // Fetch monitoring dashboard data
  const fetchMonitoringDashboard = async (jobId: string) => {
    try {
      const response = await fetch(`/api/monitoring/dashboard?jobId=${jobId}`);
      if (response.ok) {
        const dashboard = await response.json();
        setMonitoringDashboard(dashboard);
        return dashboard;
      }
    } catch (error) {
      console.error('Error fetching monitoring dashboard:', error);
    }
    return null;
  };

  // Control job process (stop, resume, etc.)
  const controlJobProcess = async (jobId: string, action: 'stop' | 'resume' | 'restart') => {
    try {
      const response = await fetch('/api/monitoring/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, action })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Refresh monitoring data
          await fetchMonitoringDashboard(jobId);
          return result;
        }
      }
    } catch (error) {
      console.error(`Error ${action}ing job:`, error);
    }
    return null;
  };

  // Poll job status
  useEffect(() => {
    if (!currentJob || currentJob.status !== 'running') return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/segment/status?jobId=${currentJob.id}`);
        if (response.ok) {
          const job = await response.json();
          setCurrentJob(mapJobResponse(job));
        }
      } catch (err) {
        console.error('Error polling job status:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [currentJob]);

  const handleStartScraping = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/segment/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error('Failed to start scraping job');
      }

      const { jobId } = await response.json();
      
      // Fetch initial job status
      const statusResponse = await fetch(`/api/segment/status?jobId=${jobId}`);
      if (statusResponse.ok) {
        const job = await statusResponse.json();
        setCurrentJob(mapJobResponse(job));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleEnrichCompanyIds = async () => {
    if (!currentJob) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/enrich/company-ids?jobId=${currentJob.id}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to start enrichment job');
      }

      const { jobId: enrichmentJobId } = await response.json();
      
      // Update current job to show Stage 2 is running
      setCurrentJob(prev => prev ? {
        ...prev,
        stage: 'stage2_enrichment',
        status: 'running'
      } : null);
      
      // Poll for enrichment completion
      const pollEnrichmentStatus = async () => {
        try {
          const statusResponse = await fetch(`/api/segment/status?jobId=${currentJob.id}`);
          if (statusResponse.ok) {
            const job = await statusResponse.json();
            const mappedJob = mapJobResponse(job);
            if (job.status === 'done' && job.stage === 'stage2_enrichment') {
              setCurrentJob(prev => prev ? {
                ...prev,
                stage: 'stage2_enrichment',
                status: 'done',
                totalCompanies: mappedJob.totalCompanies,
                processedCount: mappedJob.processedCount
              } : null);
            } else if (job.status === 'running') {
              // Continue polling
              setTimeout(pollEnrichmentStatus, 2000);
            }
          }
        } catch (err) {
          console.error('Error polling enrichment status:', err);
        }
      };
      
      // Start polling after a short delay
      setTimeout(pollEnrichmentStatus, 2000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchFinancials = async () => {
    if (!currentJob) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/financial/fetch?jobId=${currentJob.id}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to start financial data fetch');
      }

      const { jobId: financialJobId } = await response.json();
      
      // Update current job to show Stage 3 is running
      setCurrentJob(prev => prev ? {
        ...prev,
        stage: 'stage3_financials',
        status: 'running'
      } : null);
      
      // Poll for financial fetch completion with real-time updates
      // Track progress for stall detection
      let lastProcessedCount = currentJob?.processedCount || 0;
      let lastProcessedTime = Date.now();
      let stallWarningShown = false;
      const STALL_THRESHOLD_MS = 30 * 1000; // 30 seconds without progress (new data should download immediately)
      const TIMEOUT_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours total timeout
      const jobStartTime = Date.now();
      
      const pollFinancialStatus = async () => {
        try {
          const statusResponse = await fetch(`/api/segment/status?jobId=${currentJob.id}`);
          if (statusResponse.ok) {
            const job = await statusResponse.json();
            const mappedJob = mapJobResponse(job);
            const currentProcessedCount = mappedJob.processedCount || 0;
            const currentTime = Date.now();
            const elapsedTime = currentTime - jobStartTime;
            
            // Check for progress (stall detection)
            if (currentProcessedCount === lastProcessedCount && job.status === 'running') {
              const timeSinceLastProgress = currentTime - lastProcessedTime;
              
              // Show stall warning if no progress for threshold
              if (timeSinceLastProgress > STALL_THRESHOLD_MS && !stallWarningShown) {
                stallWarningShown = true;
                const secondsSinceProgress = Math.round(timeSinceLastProgress / 1000);
                setError(`Warning: No progress detected for ${secondsSinceProgress} seconds. Process may be stalled. Check logs or try stopping/restarting.`);
                console.warn(`Stall detected: No progress for ${secondsSinceProgress} seconds`);
              }
            } else {
              // Progress detected, reset stall tracking
              lastProcessedCount = currentProcessedCount;
              lastProcessedTime = currentTime;
              if (stallWarningShown) {
                setError(null); // Clear stall warning if progress resumes
                stallWarningShown = false;
              }
            }
            
            // Check for timeout
            if (elapsedTime > TIMEOUT_THRESHOLD_MS && job.status === 'running') {
              setError(`Timeout: Job has been running for ${Math.round(elapsedTime / 3600000)} hours. This exceeds the 2-hour threshold. Consider stopping and investigating.`);
              console.error(`Timeout detected: Job running for ${Math.round(elapsedTime / 3600000)} hours`);
            }
            
            // Calculate progress rate
            const progressRate = elapsedTime > 0 ? (currentProcessedCount / (elapsedTime / 60000)).toFixed(1) : '0';
            const remaining = mappedJob.totalCompanies - currentProcessedCount;
            const estimatedTimeRemaining = progressRate !== '0' && parseFloat(progressRate) > 0 
              ? Math.round(remaining / parseFloat(progressRate)) 
              : null;
            
            // Update job state with latest progress
              setCurrentJob(prev => prev ? {
                ...prev,
              stage: mappedJob.stage || 'stage3_financials',
              status: mappedJob.status,
              processedCount: currentProcessedCount,
                totalCompanies: mappedJob.totalCompanies,
              errorCount: mappedJob.errorCount,
              error: mappedJob.lastError,
              // Add progress rate info for display
              progressRate: parseFloat(progressRate),
              estimatedTimeRemaining: estimatedTimeRemaining || undefined
              } : null);
            
            // Check final status
            if (job.status === 'done' || job.status === 'completed') {
              console.log('Stage 3 completed');
              setError(null); // Clear any warnings on completion
              // Stop polling
              return;
            } else if (job.status === 'error' || job.status === 'stopped') {
              console.log('Stage 3 stopped or errored');
              setError(job.lastError || 'Stage 3 stopped');
              // Stop polling
              return;
            } else if (job.status === 'running' || job.status === 'active') {
              // Continue polling - update progress every 2 seconds for active jobs
              setTimeout(pollFinancialStatus, 2000);
            } else {
              // Unknown status, continue polling but with longer interval
              setTimeout(pollFinancialStatus, 5000);
            }
          } else {
            // API error, continue polling with longer interval
            console.error('Status API error:', statusResponse.status);
            setTimeout(pollFinancialStatus, 5000);
          }
        } catch (err) {
          console.error('Error polling financial status:', err);
          // Retry polling on error
          setTimeout(pollFinancialStatus, 5000);
        }
      };
      
      // Start polling after a short delay
      setTimeout(pollFinancialStatus, 2000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleValidateData = async () => {
    if (!currentJob) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/validation/data?jobId=${currentJob.id}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to validate data');
      }

      const result = await response.json();
      setValidationSummary(result.summary);
      setActiveTab('validation');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleMigrateData = async () => {
    if (!currentJob) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/staging/migrate-from-local', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          jobId: currentJob.id,
          includeWarnings: false,
          skipDuplicates: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to migrate data');
      }

      const result = await response.json();
      setMigrationResult(result);
      setActiveTab('migration');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleTestWorkflow = async () => {
    setTesting(true);
    setError(null);
    setTestResults(null);

    try {
      const response = await fetch('/api/test-complete-workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to run workflow test');
      }

      const result = await response.json();
      setTestResults(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setTesting(false);
    }
  };

  const handleLoadValidationData = async () => {
    if (!currentJob) {
      setError('No current job available');
      return;
    }

    setValidationLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/validation/data?jobId=${currentJob.id}`);
      if (!response.ok) {
        throw new Error('Failed to load validation data');
      }

      const data = await response.json();
      setValidationData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setValidationLoading(false);
    }
  };

  const toggleRowExpansion = (orgnr: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(orgnr)) {
      newExpanded.delete(orgnr);
    } else {
      newExpanded.add(orgnr);
    }
    setExpandedRows(newExpanded);
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    // Values in DB are stored in thousands SEK (kSEK)
    // Format as number with space separator and add "kkr" unit
    return new Intl.NumberFormat('sv-SE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value) + ' kkr';
  };

  const formatYearBadges = (years: number[]) => {
    if (years.length === 0) return <span className="text-red-500 text-xs">No data</span>;
    
    const sortedYears = [...years].sort((a, b) => b - a);
    const currentYear = new Date().getFullYear();
    
    return (
      <div className="flex flex-wrap gap-1">
        {sortedYears.map(year => (
          <span
            key={year}
            className={`px-2 py-1 rounded text-xs font-medium ${
              year === currentYear 
                ? 'bg-green-100 text-green-800' 
                : year >= currentYear - 1 
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800'
            }`}
          >
            {year}
          </span>
        ))}
      </div>
    );
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('sv-SE').format(num);
  };

  const handleSessionSelect = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    // Load session data and switch to validation tab
    setActiveTab('validation');
    // Load validation data for the selected session
    if (sessionId) {
      handleLoadValidationDataForSession(sessionId);
    }
  };

  // Real-time session status polling with enhanced monitoring
  useEffect(() => {
    if (!selectedSessionId) return;

    const pollSessionStatus = async () => {
      try {
        // Fetch both session data and monitoring dashboard
        const [sessionResponse, dashboardResponse] = await Promise.all([
          fetch(`/api/sessions`),
          fetch(`/api/monitoring/dashboard?jobId=${selectedSessionId}`)
        ]);

        if (sessionResponse.ok) {
          const data = await sessionResponse.json();
          const currentSession = data.sessions.find((s: any) => s.sessionId === selectedSessionId);
          if (currentSession) {
            // Update current job with latest session data
            setCurrentJob(prev => prev ? {
              ...prev,
              status: currentSession.stages.stage2.status === 'completed' ? 'done' : 
                     currentSession.stages.stage2.status === 'running' ? 'running' : 'pending',
              stage: currentSession.stages.stage2.status === 'completed' ? 'stage2_enrichment' : 
                     currentSession.stages.stage2.status === 'running' ? 'stage2_enrichment' : 'stage1_segmentation',
              totalCompanies: currentSession.totalCompanies,
              processedCount: currentSession.totalCompanyIds
            } : null);
          }
        }

        if (dashboardResponse.ok) {
          const dashboard = await dashboardResponse.json();
          setMonitoringDashboard(dashboard);
        }
      } catch (error) {
        console.error('Error polling session status:', error);
      }
    };

    // Poll every 3 seconds
    const interval = setInterval(pollSessionStatus, 3000);
    
    // Initial poll
    pollSessionStatus();

    return () => clearInterval(interval);
  }, [selectedSessionId]);

  const handleLoadValidationDataForSession = async (sessionId: string) => {
    setValidationLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/validation/data?jobId=${sessionId}`);
      if (!response.ok) {
        throw new Error('Failed to load validation data');
      }

      const data = await response.json();
      setValidationData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setValidationLoading(false);
    }
  };

  const handleStageControl = async (stage: number, action: string) => {
    if (!selectedSessionId) {
      console.log('No session selected');
      return;
    }

    console.log(`Starting Stage ${stage} for session: ${selectedSessionId}`);
    setLoading(true);
    setError(null);

    try {
      let targetUrl = '';
      if (stage === 2) {
        targetUrl = `/api/enrich/company-ids?jobId=${selectedSessionId}`;
      } else if (stage === 3) {
        targetUrl = `/api/financial/fetch?jobId=${selectedSessionId}`;
      }

      console.log(`Making request to: ${targetUrl}`);
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`Stage ${stage} ${action} initiated successfully:`, result);
        
        // Show success message
        setError(null);
        setSuccessMessage(`Stage ${stage} started successfully!`);
        setTimeout(() => setSuccessMessage(null), 3000);
        
        // Update current job to show Stage 2 is running
        if (result.jobId) {
          setCurrentJob(prev => prev ? {
            ...prev,
            id: result.jobId,
            stage: stage === 2 ? 'stage2_enrichment' : 'stage3_financials',
            status: 'running'
          } : null);
          
          // Start polling for status updates
          const pollStatus = async () => {
            try {
              const statusResponse = await fetch(`/api/segment/status?jobId=${selectedSessionId}`);
              if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                console.log('Status update:', statusData);
                
                // Update current job with latest status
                setCurrentJob(prev => prev ? {
                  ...prev,
                  status: statusData.status,
                  stage: statusData.stage,
                  totalCompanies: statusData.stats.companies,
                  processedCount: statusData.stats.companyIds
                } : null);
                
                // If still running, continue polling
                if (statusData.status === 'running') {
                  setTimeout(pollStatus, 2000);
                } else {
                  // Job completed, refresh validation data
                  handleLoadValidationDataForSession(selectedSessionId);
                }
              }
            } catch (error) {
              console.error('Error polling status:', error);
            }
          };
          
          // Start polling after a short delay
          setTimeout(pollStatus, 2000);
        }
        
        // Show success message
        setError(null);
      } else {
        const error = await response.json();
        setError(`Failed to start stage ${stage}: ${error.error || 'Unknown error'}`);
      }
    } catch (err) {
      setError(`Error starting stage ${stage}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const getStageDisplayName = (stage: string) => {
    switch (stage) {
      case 'stage1_segmentation': return 'Stage 1: Company Search';
      case 'stage2_enrichment': return 'Stage 2: Company ID Resolution';
      case 'stage3_financials': return 'Stage 3: Financial Data Fetch';
      case 'validation': return 'Data Validation';
      case 'migration': return 'Data Migration';
      default: return stage;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-yellow-600';
      case 'done': return 'text-green-600';
      case 'completed': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'paused': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Clean Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-medium text-gray-900 mb-2">
            Allabolag Scraper
          </h1>
          <p className="text-gray-600">
            Company data extraction and analysis
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Header Actions */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600 flex items-center gap-2">
                  {selectedSessionId ? (
                    <>
                      <span>Session: {selectedSessionId.slice(0, 8)}...</span>
                      {currentJob && (
                        <div className="flex items-center gap-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            currentJob.status === 'running' ? 'bg-gray-900' :
                            currentJob.status === 'done' ? 'bg-gray-600' :
                            currentJob.status === 'error' ? 'bg-red-500' :
                            'bg-gray-400'
                          }`}></div>
                          <span className="text-xs capitalize">{currentJob.status}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    'No session selected'
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsSessionModalOpen(true)}
                  className="px-4 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  Select Session
                </button>
                <button
                  onClick={handleTestWorkflow}
                  disabled={testing}
                  className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {testing ? 'Testing...' : 'Test Workflow'}
                </button>
                <button
                  onClick={() => window.open('http://localhost:8080', '_blank')}
                  className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  Dashboard
                </button>
              </div>
            </div>
          </div>

          <div className="p-8">
          
          {/* Apple-style Tab Navigation */}
          <div className="mb-8">
            <div className="bg-gray-100 rounded-2xl p-1 inline-flex">
              <button
                onClick={() => setActiveTab('scraping')}
                className={`px-6 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                  activeTab === 'scraping'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Scraping
              </button>
              <button
                onClick={() => setActiveTab('validation')}
                className={`px-6 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                  activeTab === 'validation'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Validation
              </button>
              <button
                onClick={() => setActiveTab('migration')}
                className={`px-6 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                  activeTab === 'migration'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Migration
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Success Message Display */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
              <p className="text-green-800">{successMessage}</p>
            </div>
          )}

          {/* Test Results Display */}
          {testResults && (
            <div className={`border rounded-md p-4 mb-6 ${
              testResults.success 
                ? 'bg-green-50 border-green-200' 
                : 'bg-yellow-50 border-yellow-200'
            }`}>
              <div className="flex items-center mb-3">
                <svg className={`w-5 h-5 mr-2 ${
                  testResults.success ? 'text-green-600' : 'text-yellow-600'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className={`text-lg font-semibold ${
                  testResults.success ? 'text-green-800' : 'text-yellow-800'
                }`}>
                  Workflow Test Results
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Success Rate:</span>
                    <span className={`font-medium ${
                      testResults.successRate === 100 ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                      {testResults.successRate}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Tests Passed:</span>
                    <span className="font-medium text-gray-900">
                      {testResults.passedTests}/{testResults.totalTests}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {Object.entries(testResults.summary).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-gray-700 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}:
                      </span>
                      <span className="font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {testResults.results.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-red-800 mb-2">Errors:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {testResults.results.errors.map((error: string, index: number) => (
                      <li key={index} className="text-red-700 text-sm">{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Scraping Tab */}
          {activeTab === 'scraping' && (
            <div className="space-y-6">
              {/* Apple-style Filter Form */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-8 border border-gray-200/50">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Segmentation Filters
                  </h2>
                  <p className="text-gray-600">Configure your company search criteria</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-3">
                      Revenue From (Millions SEK)
                    </label>
                    <input
                      type="number"
                      value={params.revenueFrom || ''}
                      onChange={(e) => setParams(prev => ({ 
                        ...prev, 
                        revenueFrom: parseInt(e.target.value) || undefined
                      }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 text-gray-900 bg-white transition-all duration-200"
                      placeholder="15"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-3">
                      Revenue To (Millions SEK)
                    </label>
                    <input
                      type="number"
                      value={params.revenueTo || ''}
                      onChange={(e) => setParams(prev => ({ 
                        ...prev, 
                        revenueTo: parseInt(e.target.value) || undefined
                      }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 text-gray-900 bg-white transition-all duration-200"
                      placeholder="150"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-3">
                      Profit From (Millions SEK)
                    </label>
                    <input
                      type="number"
                      value={params.profitFrom || ''}
                      onChange={(e) => setParams(prev => ({ 
                        ...prev, 
                        profitFrom: parseInt(e.target.value) || undefined
                      }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 text-gray-900 bg-white transition-all duration-200"
                      placeholder="1"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-3">
                      Profit To (Millions SEK)
                    </label>
                    <input
                      type="number"
                      value={params.profitTo || ''}
                      onChange={(e) => setParams(prev => ({ 
                        ...prev, 
                        profitTo: parseInt(e.target.value) || undefined
                      }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 text-gray-900 bg-white transition-all duration-200"
                      placeholder="50"
                    />
                  </div>
                </div>
                
                <div className="mt-6">
                  <label className="block text-sm font-semibold text-gray-800 mb-3">
                    Company Type
                  </label>
                  <select
                    value={params.companyType}
                    onChange={(e) => setParams(prev => ({ 
                      ...prev, 
                      companyType: e.target.value as 'AB' 
                    }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 text-gray-900 bg-white transition-all duration-200"
                  >
                    <option value="AB">AB (Aktiebolag)</option>
                  </select>
                </div>
                
                <div className="mt-8">
                  <button
                    onClick={handleStartScraping}
                    disabled={loading || (currentJob?.status === 'running')}
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-4 px-6 rounded-xl hover:from-blue-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                        Starting...
                      </div>
                    ) : (
                      'Start Scraping'
                    )}
                  </button>
                </div>
              </div>

              {/* Compact Status Indicators */}
              {currentJob && (
                <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700">Job Progress</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(currentJob.status)}`}>
                      {currentJob.status.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-blue-600">{currentJob.processedCount}</div>
                      <div className="text-gray-600">Processed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-600">{currentJob.lastPage}</div>
                      <div className="text-gray-600">Last Page</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-green-600">{getStageDisplayName(currentJob.stage)}</div>
                      <div className="text-gray-600">Current Stage</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-red-600">{currentJob.errorCount || 0}</div>
                      <div className="text-gray-600">Errors</div>
                    </div>
                  </div>
                  
                  {currentJob.status === 'running' && (
                    <div className="mt-3">
                      <div className="flex items-center text-sm text-blue-600">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
                        Processing... Please wait
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Current Job Status */}
              {currentJob && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-blue-900 mb-4">
                    Job Status: {getStageDisplayName(currentJob.stage)}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-blue-700">Status:</span>
                        <span className={`font-medium ${getStatusColor(currentJob.status)}`}>
                          {currentJob.status.toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-blue-700">Last Page:</span>
                        <span className="text-blue-900">{currentJob.lastPage}</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-blue-700">Processed:</span>
                        <span className="text-blue-900">{formatNumber(currentJob.processedCount)}</span>
                      </div>
                      
                      {currentJob.totalCompanies && (
                        <div className="flex justify-between">
                          <span className="text-blue-700">Total Companies:</span>
                          <span className="text-blue-900">{formatNumber(currentJob.totalCompanies)}</span>
                        </div>
                      )}
                      
                      {currentJob.errorCount && (
                        <div className="flex justify-between">
                          <span className="text-blue-700">Errors:</span>
                          <span className="text-red-600">{currentJob.errorCount}</span>
                        </div>
                      )}
                    </div>
                    
                    {currentJob.rateLimitStats && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-blue-800">Rate Limiting Stats</h4>
                        <div className="text-sm space-y-1">
                          <div>Concurrent: {currentJob.rateLimitStats.concurrent}</div>
                          <div>Delay: {currentJob.rateLimitStats.requestDelay}ms</div>
                          <div>Success Rate: {(currentJob.rateLimitStats.recentSuccessRate * 100).toFixed(1)}%</div>
                          <div>Avg Response: {currentJob.rateLimitStats.averageResponseTime.toFixed(0)}ms</div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {currentJob.error && (
                    <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded">
                      <p className="text-red-800 text-sm">{currentJob.error}</p>
                    </div>
                  )}
                  
                  {/* Stage-specific actions */}
                  <div className="mt-6 space-y-3">
                    {/* Stage 1 Complete - Show Stage 2 Button */}
                    {currentJob.stage === 'stage1_segmentation' && currentJob.status === 'done' && (
                      <button
                        onClick={handleEnrichCompanyIds}
                        disabled={loading}
                        className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                      >
                        {loading ? 'Starting...' : 'Start Stage 2: Company ID Resolution'}
                      </button>
                    )}
                    
                    {/* Stage 2 Complete - Show Stage 3 Button */}
                    {currentJob.stage === 'stage2_enrichment' && currentJob.status === 'done' && (
                      <button
                        onClick={handleFetchFinancials}
                        disabled={loading}
                        className="w-full bg-purple-600 text-white py-3 px-4 rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                      >
                        {loading ? 'Starting...' : 'Start Stage 3: Financial Data Fetch'}
                      </button>
                    )}
                    
                    {/* Stage 3 Complete - Show Validation Button */}
                    {currentJob.stage === 'stage3_financials' && currentJob.status === 'done' && (
                      <button
                        onClick={handleValidateData}
                        disabled={loading}
                        className="w-full bg-orange-600 text-white py-3 px-4 rounded-md hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                      >
                        {loading ? 'Validating...' : 'Validate Data'}
                      </button>
                    )}
                    
                    {/* Show current stage progress with rate and ETA */}
                    {currentJob.status === 'running' && (
                      <div className="w-full bg-blue-100 text-blue-800 py-3 px-4 rounded-md">
                        <div className="text-center font-medium mb-2">
                        {getStageDisplayName(currentJob.stage)} in progress...
                      </div>
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span>Progress:</span>
                            <span className="font-semibold">
                              {currentJob.processedCount || 0} / {currentJob.totalCompanies || 0} companies
                              {currentJob.totalCompanies && currentJob.totalCompanies > 0 && (
                                <span className="ml-2">
                                  ({Math.round(((currentJob.processedCount || 0) / currentJob.totalCompanies) * 100)}%)
                                </span>
                              )}
                            </span>
                          </div>
                          {currentJob.progressRate && currentJob.progressRate > 0 && (
                            <div className="flex justify-between">
                              <span>Rate:</span>
                              <span className="font-semibold">
                                {currentJob.progressRate.toFixed(1)} companies/min
                              </span>
                            </div>
                          )}
                          {currentJob.estimatedTimeRemaining && currentJob.estimatedTimeRemaining > 0 && (
                            <div className="flex justify-between">
                              <span>Est. Remaining:</span>
                              <span className="font-semibold">
                                {currentJob.estimatedTimeRemaining < 60 
                                  ? `${currentJob.estimatedTimeRemaining} min`
                                  : `${Math.round(currentJob.estimatedTimeRemaining / 60)} hours ${currentJob.estimatedTimeRemaining % 60} min`
                                }
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Enhanced Pipeline Overview */}
              {currentJob && (
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Complete Pipeline Status
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Stage 1 */}
                    <div className="flex items-center justify-between p-4 bg-white rounded-lg border shadow-sm">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium relative ${
                          currentJob.stage === 'stage1_segmentation' && currentJob.status === 'done' 
                            ? 'bg-green-100 text-green-800' 
                            : currentJob.stage === 'stage1_segmentation' && currentJob.status === 'running'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {currentJob.stage === 'stage1_segmentation' && currentJob.status === 'running' && (
                            <div className="absolute inset-0 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
                          )}
                          {currentJob.stage === 'stage1_segmentation' && currentJob.status === 'done' && (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                          {!(currentJob.stage === 'stage1_segmentation' && currentJob.status === 'done') && 
                           !(currentJob.stage === 'stage1_segmentation' && currentJob.status === 'running') && (
                            <span>1</span>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-gray-900">Company Search</div>
                          <div className="text-sm text-gray-600">Find companies matching criteria</div>
                          {currentJob.stage === 'stage1_segmentation' && currentJob.status === 'running' && (
                            <div className="text-xs text-blue-600 mt-1">
                              Page {currentJob.lastPage || 0} • {currentJob.processedCount || 0} companies found
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {currentJob.stage === 'stage1_segmentation' && currentJob.status === 'done' 
                            ? `${currentJob.totalCompanies || 0} companies found`
                            : currentJob.stage === 'stage1_segmentation' && currentJob.status === 'running'
                            ? 'In progress...'
                            : 'Pending'
                          }
                        </div>
                        <div className={`text-xs ${
                          currentJob.stage === 'stage1_segmentation' && currentJob.status === 'done' 
                            ? 'text-green-600' 
                            : currentJob.stage === 'stage1_segmentation' && currentJob.status === 'running'
                            ? 'text-blue-600'
                            : 'text-gray-500'
                        }`}>
                          {currentJob.stage === 'stage1_segmentation' && currentJob.status === 'done' 
                            ? 'Completed' 
                            : currentJob.stage === 'stage1_segmentation' && currentJob.status === 'running'
                            ? 'Running'
                            : 'Not started'
                          }
                        </div>
                      </div>
                    </div>

                    {/* Stage 2 */}
                    <div className="flex items-center justify-between p-4 bg-white rounded-lg border shadow-sm">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium relative ${
                          currentJob.stage === 'stage2_enrichment' && currentJob.status === 'done' 
                            ? 'bg-green-100 text-green-800' 
                            : currentJob.stage === 'stage2_enrichment' && currentJob.status === 'running'
                            ? 'bg-blue-100 text-blue-800'
                            : currentJob.stage === 'stage1_segmentation' && currentJob.status === 'done'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {currentJob.stage === 'stage2_enrichment' && currentJob.status === 'running' && (
                            <div className="absolute inset-0 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
                          )}
                          {currentJob.stage === 'stage2_enrichment' && currentJob.status === 'done' && (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                          {!(currentJob.stage === 'stage2_enrichment' && currentJob.status === 'done') && 
                           !(currentJob.stage === 'stage2_enrichment' && currentJob.status === 'running') && (
                            <span>2</span>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-gray-900">Company ID Resolution</div>
                          <div className="text-sm text-gray-600">Resolve company IDs for financial data</div>
                          {currentJob.stage === 'stage2_enrichment' && currentJob.status === 'running' && (
                            <div className="text-xs text-blue-600 mt-1">
                              Processing companies • {currentJob.processedCount || 0} resolved
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {currentJob.stage === 'stage2_enrichment' && currentJob.status === 'done' 
                            ? 'Company IDs resolved'
                            : currentJob.stage === 'stage2_enrichment' && currentJob.status === 'running'
                            ? 'In progress...'
                            : currentJob.stage === 'stage1_segmentation' && currentJob.status === 'done'
                            ? 'Ready to start'
                            : 'Pending'
                          }
                        </div>
                        <div className={`text-xs ${
                          currentJob.stage === 'stage2_enrichment' && currentJob.status === 'done' 
                            ? 'text-green-600' 
                            : currentJob.stage === 'stage2_enrichment' && currentJob.status === 'running'
                            ? 'text-blue-600'
                            : currentJob.stage === 'stage1_segmentation' && currentJob.status === 'done'
                            ? 'text-yellow-600'
                            : 'text-gray-500'
                        }`}>
                          {currentJob.stage === 'stage2_enrichment' && currentJob.status === 'done' 
                            ? 'Completed' 
                            : currentJob.stage === 'stage2_enrichment' && currentJob.status === 'running'
                            ? 'Running'
                            : currentJob.stage === 'stage1_segmentation' && currentJob.status === 'done'
                            ? 'Ready'
                            : 'Not started'
                          }
                        </div>
                      </div>
                    </div>

                    {/* Stage 3 */}
                    <div className="flex items-center justify-between p-4 bg-white rounded-lg border shadow-sm">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium relative ${
                          currentJob.stage === 'stage3_financials' && currentJob.status === 'done' 
                            ? 'bg-green-100 text-green-800' 
                            : currentJob.stage === 'stage3_financials' && currentJob.status === 'running'
                            ? 'bg-blue-100 text-blue-800'
                            : currentJob.stage === 'stage2_enrichment' && currentJob.status === 'done'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {currentJob.stage === 'stage3_financials' && currentJob.status === 'running' && (
                            <div className="absolute inset-0 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
                          )}
                          {currentJob.stage === 'stage3_financials' && currentJob.status === 'done' && (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                          {!(currentJob.stage === 'stage3_financials' && currentJob.status === 'done') && 
                           !(currentJob.stage === 'stage3_financials' && currentJob.status === 'running') && (
                            <span>3</span>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-gray-900">Financial Data Fetch</div>
                          <div className="text-sm text-gray-600">Download detailed financial data</div>
                          {currentJob.stage === 'stage3_financials' && currentJob.status === 'running' && (
                            <div className="text-xs text-blue-600 mt-1">
                              Fetching financials • {currentJob.processedCount || 0} companies processed
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {currentJob.stage === 'stage3_financials' && currentJob.status === 'done' 
                            ? 'Financial data fetched'
                            : currentJob.stage === 'stage3_financials' && currentJob.status === 'running'
                            ? 'In progress...'
                            : currentJob.stage === 'stage2_enrichment' && currentJob.status === 'done'
                            ? 'Ready to start'
                            : 'Pending'
                          }
                        </div>
                        <div className={`text-xs ${
                          currentJob.stage === 'stage3_financials' && currentJob.status === 'done' 
                            ? 'text-green-600' 
                            : currentJob.stage === 'stage3_financials' && currentJob.status === 'running'
                            ? 'text-blue-600'
                            : currentJob.stage === 'stage2_enrichment' && currentJob.status === 'done'
                            ? 'text-yellow-600'
                            : 'text-gray-500'
                        }`}>
                          {currentJob.stage === 'stage3_financials' && currentJob.status === 'done' 
                            ? 'Completed' 
                            : currentJob.stage === 'stage3_financials' && currentJob.status === 'running'
                            ? 'Running'
                            : currentJob.stage === 'stage2_enrichment' && currentJob.status === 'done'
                            ? 'Ready'
                            : 'Not started'
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Validation Tab */}
          {activeTab === 'validation' && (
            <div className="space-y-6">
              {selectedSessionId ? (
                <div className="space-y-6">
                  {/* Session Info */}
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-200/50">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">Session: {selectedSessionId.slice(0, 8)}...</h3>
                        <p className="text-gray-600">Monitor and control your scraping session</p>
                      </div>
                      <button
                        onClick={() => setSelectedSessionId(null)}
                        className="text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Real-time Status Indicator */}
                    {currentJob && (
                      <div className="mb-4 p-4 bg-white rounded-xl border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-gray-900">Current Status</h4>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              currentJob.status === 'running' ? 'bg-green-500 animate-pulse' :
                              currentJob.status === 'done' ? 'bg-green-500' :
                              currentJob.status === 'error' ? 'bg-red-500' :
                              'bg-gray-400'
                            }`}></div>
                            <span className="text-sm font-medium capitalize">{currentJob.status}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Stage:</span>
                            <div className="font-medium">
                              {currentJob.stage === 'stage2_enrichment' ? 'Stage 2: Company ID Resolution' :
                               currentJob.stage === 'stage3_financials' ? 'Stage 3: Financial Data' :
                               currentJob.stage}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-600">Companies:</span>
                            <div className="font-medium">{currentJob.totalCompanies || 0}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Resolved IDs:</span>
                            <div className="font-medium">{currentJob.processedCount || 0}</div>
                          </div>
                        </div>
                      </div>
                    )}

                {/* Clean Monitoring Dashboard */}
                {monitoringDashboard && (
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-gray-900">Session Status</h3>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          monitoringDashboard.status.isRunning ? 'bg-gray-900' :
                          monitoringDashboard.status.isCompleted ? 'bg-gray-600' :
                          monitoringDashboard.status.hasErrors ? 'bg-red-500' :
                          'bg-gray-400'
                        }`}></div>
                        <span className="text-sm text-gray-600 capitalize">
                          {monitoringDashboard.status.current}
                        </span>
                      </div>
                    </div>

                    {/* Essential Progress Only */}
                    <div className="grid grid-cols-3 gap-6 mb-4">
                      <div className="text-center">
                        <div className="text-2xl font-medium text-gray-900">{monitoringDashboard.progress.total.companies}</div>
                        <div className="text-sm text-gray-500">Companies</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-medium text-gray-900">{monitoringDashboard.progress.total.companyIds}</div>
                        <div className="text-sm text-gray-500">Company IDs</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-medium text-gray-900">{monitoringDashboard.progress.total.financials}</div>
                        <div className="text-sm text-gray-500">Financial Records</div>
                      </div>
                    </div>

                    {/* Simple Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Overall Progress</span>
                        <span>{Math.round((monitoringDashboard.progress.total.financials / (monitoringDashboard.progress.total.companies * 5)) * 100)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1">
                        <div 
                          className="bg-gray-900 h-1 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (monitoringDashboard.progress.total.financials / (monitoringDashboard.progress.total.companies * 5)) * 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Minimal Control Buttons */}
                    <div className="flex gap-2">
                      {monitoringDashboard.status.isRunning && (
                        <button
                          onClick={() => controlJobProcess(selectedSessionId, 'stop')}
                          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                        >
                          Stop
                        </button>
                      )}
                      {!monitoringDashboard.status.isRunning && !monitoringDashboard.status.isCompleted && (
                        <button
                          onClick={() => controlJobProcess(selectedSessionId, 'resume')}
                          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                        >
                          Resume
                        </button>
                      )}
                    </div>
                  </div>
                )}
                    
                    {/* Clean Stage Control Buttons */}
                    <div className="space-y-3">
                      <button
                        onClick={() => handleStageControl(2, 'start')}
                        disabled={loading}
                        className="w-full px-4 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {loading ? 'Starting...' : 'Start Stage 2: Company ID Resolution'}
                      </button>
                      
                      <button
                        onClick={() => handleStageControl(3, 'start')}
                        disabled={loading}
                        className="w-full px-4 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {loading ? 'Starting...' : 'Start Stage 3: Financial Data Fetch'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Session Selected</h3>
                  <p className="text-gray-600 mb-4">Select a session from the modal to view and control its progress</p>
                  <button
                    onClick={() => setIsSessionModalOpen(true)}
                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Select Session
                  </button>
                </div>
              )}

              {/* Compact Status for Validation Tab */}
              {currentJob && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700">Current Job Status</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(currentJob.status)}`}>
                      {currentJob.status.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-blue-600">{validationData ? validationData.summary?.totalCompanies : currentJob.processedCount}</div>
                      <div className="text-gray-600">Companies</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-green-600">{validationData ? validationData.summary?.companiesWithFinancials : 0}</div>
                      <div className="text-gray-600">With Financials</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-purple-600">{getStageDisplayName(currentJob.stage)}</div>
                      <div className="text-gray-600">Current Stage</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-red-600">{currentJob.errorCount || 0}</div>
                      <div className="text-gray-600">Errors</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Validation Data Display */}
              {validationData && (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-blue-900 mb-4">Data Summary</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{validationData.summary?.totalCompanies || 0}</div>
                        <div className="text-sm text-blue-700">Total Companies</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{validationData.summary?.companiesWithFinancials || 0}</div>
                        <div className="text-sm text-green-700">With Financial Data</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {validationData.summary?.yearRange?.min && validationData.summary?.yearRange?.max 
                            ? `${validationData.summary.yearRange.min}-${validationData.summary.yearRange.max}`
                            : 'N/A'
                          }
                        </div>
                        <div className="text-sm text-purple-700">Year Range</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          {validationData.companies?.reduce((sum, c) => sum + (c.stage3Data?.years?.length || 0), 0) || 0}
                        </div>
                        <div className="text-sm text-orange-700">Total Records</div>
                      </div>
                    </div>
                  </div>

                  {/* Search and Filter */}
                  <div className="flex items-center gap-4">
                    <input
                      type="text"
                      placeholder="Search companies..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => setValidationData(null)}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                      Refresh
                    </button>
                  </div>

                  {/* Companies Table */}
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Company
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              OrgNr
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Foundation
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Latest Revenue
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Latest Profit
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Financial Years
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {validationData.companies
                            .filter(company => 
                              company.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              company.orgnr.includes(searchTerm)
                            )
                            .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                            .map((company) => {
                              const latestFinancial = company.stage3Data?.years?.[0];
                              const isExpanded = expandedRows.has(company.orgnr);
                              
                              return (
                                <React.Fragment key={company.orgnr}>
                                  <tr className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div>
                                        <div className="text-sm font-medium text-gray-900">{company.companyName || 'N/A'}</div>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                      {company.orgnr}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                      {company.stage1Data?.foundedYear || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                      {formatCurrency(company.stage1Data?.revenue)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                      {formatCurrency(company.stage1Data?.profit)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      {formatYearBadges(company.stage3Data?.years || [])}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                      <button
                                        onClick={() => toggleRowExpansion(company.orgnr)}
                                        className="text-blue-600 hover:text-blue-900"
                                      >
                                        {isExpanded ? 'Hide Details' : 'Show Details'}
                                      </button>
                                    </td>
                                  </tr>
                                  
                                  {/* Expanded Row */}
                                  {isExpanded && (
                                    <tr>
                                      <td colSpan={7} className="px-6 py-4 bg-gray-50">
                                        <div className="space-y-4">
                                          {/* Additional Company Data */}
                                          <div>
                                            <h4 className="text-sm font-semibold text-blue-700 mb-2">Company Information</h4>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                              <div>
                                                <span className="font-medium text-gray-700">Company ID:</span>
                                                <div className="text-gray-600">{company.companyId || 'N/A'}</div>
                                              </div>
                                              <div>
                                                <span className="font-medium text-gray-700">Status:</span>
                                                <div className="text-gray-600">{company.status || 'N/A'}</div>
                                              </div>
                                              <div>
                                                <span className="font-medium text-gray-700">Financial Records:</span>
                                                <div className="text-gray-600">{company.stage3Data?.recordCount || 0}</div>
                                              </div>
                                              <div>
                                                <span className="font-medium text-gray-700">Homepage:</span>
                                                <div className="text-gray-600">
                                                  {company.stage1Data?.homepage ? (
                                                    <a href={company.stage1Data.homepage} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                                      {company.stage1Data.homepage}
                                                    </a>
                                                  ) : 'N/A'}
                                                </div>
                                              </div>
                                            </div>
                                          </div>

                                          {/* Stage 2: Company ID Resolution */}
                                          <div>
                                            <h4 className="text-sm font-semibold text-blue-700 mb-2">Stage 2: Company ID Resolution</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                              <div>
                                                <span className="font-medium text-gray-700">Company ID:</span>
                                                <div className="text-gray-600">
                                                  {company.stage2Data?.companyId ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                      {company.stage2Data.companyId}
                                                    </span>
                                                  ) : (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                      Not resolved
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                              <div>
                                                <span className="font-medium text-gray-700">Confidence Score:</span>
                                                <div className="text-gray-600">
                                                  {company.stage2Data?.confidence ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                      {company.stage2Data.confidence}
                                                    </span>
                                                  ) : (
                                                    <span className="text-gray-500">N/A</span>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          </div>

                                          {/* Financial Data by Year */}
                                          <div>
                                            <h4 className="text-sm font-semibold text-blue-700 mb-2">Financial Data by Year</h4>
                                            <div className="overflow-x-auto">
                                              <table className="min-w-full text-sm">
                                                <thead>
                                                  <tr className="border-b bg-gray-50">
                                                    <th className="text-left py-2 font-semibold text-gray-700">Year</th>
                                                    <th className="text-right py-2 font-semibold text-gray-700">Revenue (SDI)</th>
                                                    <th className="text-right py-2 font-semibold text-gray-700">Net Profit (DR)</th>
                                                    <th className="text-right py-2 font-semibold text-gray-700">EBIT/EBITDA</th>
                                                    <th className="text-right py-2 font-semibold text-gray-700">Equity (EK)</th>
                                                    <th className="text-right py-2 font-semibold text-gray-700">Debt (FK)</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {(company.stage3Data?.financials || company.stage3Data?.years?.map((year: number) => ({ year })) || []).map((financial: any) => {
                                                    const year = financial.year || financial;
                                                    const financialData = typeof financial === 'object' ? financial : null;
                                                    
                                                    // Find financial data for this year if we have it
                                                    const yearData = company.stage3Data?.financials?.find((f: any) => f.year === year) || financialData;
                                                    
                                                    return (
                                                      <tr key={`${year}_${yearData?.period || ''}`} className="border-b">
                                                        <td className="py-2 font-medium text-gray-900">{year} {yearData?.period ? `(${yearData.period})` : ''}</td>
                                                        <td className="py-2 text-right text-gray-900 font-medium">{yearData?.revenue ? formatCurrency(yearData.revenue) : <span className="text-gray-400">N/A</span>}</td>
                                                        <td className="py-2 text-right text-gray-900 font-medium">{yearData?.profit ? formatCurrency(yearData.profit) : <span className="text-gray-400">N/A</span>}</td>
                                                        <td className="py-2 text-right text-gray-900 font-medium">{yearData?.rg || yearData?.ors ? formatCurrency(yearData.rg || yearData.ors) : <span className="text-gray-400">N/A</span>}</td>
                                                        <td className="py-2 text-right text-gray-900 font-medium">{yearData?.ek ? formatCurrency(yearData.ek) : <span className="text-gray-400">N/A</span>}</td>
                                                        <td className="py-2 text-right text-gray-900 font-medium">{yearData?.fk ? formatCurrency(yearData.fk) : <span className="text-gray-400">N/A</span>}</td>
                                                    </tr>
                                                    );
                                                  })}
                                                </tbody>
                                              </table>
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {validationData.companies?.filter(company => 
                      company.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      company.orgnr.includes(searchTerm)
                    ).length > itemsPerPage && (
                      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                        <div className="flex-1 flex justify-between sm:hidden">
                          <button
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          <button
                            onClick={() => setCurrentPage(currentPage + 1)}
                            disabled={currentPage * itemsPerPage >= (validationData.companies?.length || 0)}
                            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm text-gray-700">
                              Showing{' '}
                              <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span>
                              {' '}to{' '}
                              <span className="font-medium">
                                {Math.min(currentPage * itemsPerPage, validationData.companies?.length || 0)}
                              </span>
                              {' '}of{' '}
                              <span className="font-medium">{validationData.companies?.length || 0}</span>
                              {' '}results
                            </p>
                          </div>
                          <div>
                            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                              <button
                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                              >
                                Previous
                              </button>
                              <button
                                onClick={() => setCurrentPage(currentPage + 1)}
                                disabled={currentPage * itemsPerPage >= (validationData.companies?.length || 0)}
                                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                              >
                                Next
                              </button>
                            </nav>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Migration Tab */}
          {activeTab === 'migration' && (
            <div className="space-y-6">
              {/* Compact Status for Migration Tab */}
              {currentJob && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700">Current Job Status</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(currentJob.status)}`}>
                      {currentJob.status.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-blue-600">{currentJob.processedCount}</div>
                      <div className="text-gray-600">Processed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-600">{currentJob.lastPage}</div>
                      <div className="text-gray-600">Last Page</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-green-600">{getStageDisplayName(currentJob.stage)}</div>
                      <div className="text-gray-600">Current Stage</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-red-600">{currentJob.errorCount || 0}</div>
                      <div className="text-gray-600">Errors</div>
                    </div>
                  </div>
                </div>
              )}
              {migrationResult ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-green-900 mb-4">
                    Migration Results
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{migrationResult.migrated}</div>
                      <div className="text-sm text-green-700">Migrated</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{migrationResult.skipped}</div>
                      <div className="text-sm text-yellow-700">Skipped (Duplicates)</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{migrationResult.errors}</div>
                      <div className="text-sm text-red-700">Errors</div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-md p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Migration Report</h4>
                    <pre className="text-sm text-gray-600 overflow-auto">
                      {JSON.stringify(migrationResult.report, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No migration results available. Run migration first.</p>
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Session Modal */}
      <SessionModal
        isOpen={isSessionModalOpen}
        onClose={() => setIsSessionModalOpen(false)}
        onSessionSelect={handleSessionSelect}
      />
    </div>
  );
}