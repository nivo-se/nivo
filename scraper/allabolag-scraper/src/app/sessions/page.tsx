'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface SessionInfo {
  sessionId: string;
  status: string;
  totalCompanies: number;
  totalCompanyIds: number;
  totalFinancials: number;
  createdAt: string;
  updatedAt: string;
  filters?: any;
  stages: {
    stage1: { status: string; completedAt?: string };
    stage2: { status: string; completedAt?: string };
    stage3: { status: string; completedAt?: string };
  };
}

interface CompanyData {
  orgnr: string;
  companyName: string;
  companyId: string | null;
  status: string;
  stage1Data: {
    revenue: number | null;
    profit: number | null;
    nace: string[];
    segment: string;
    homepage: string | null;
    foundedYear: number | null;
  };
  stage2Data: {
    companyId: string | null;
    confidence: number | null;
  };
  stage3Data: {
    years: number[];
    recordCount: number;
    validationStatus: string;
  };
  errors: string[];
}

export default function SessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState<SessionInfo | null>(null);
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const itemsPerPage = 10;

  // Fetch sessions
  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/sessions');
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch session details
  const fetchSessionDetails = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setSessionDetails(data);
      }
    } catch (error) {
      console.error('Error fetching session details:', error);
    }
  };

  // Fetch companies for selected session
  const fetchCompanies = async (sessionId: string) => {
    setCompaniesLoading(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/companies`);
      if (response.ok) {
        const data = await response.json();
        setCompanies(data.companies || []);
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setCompaniesLoading(false);
    }
  };

  // Handle session selection
  const handleSessionSelect = (sessionId: string) => {
    setSelectedSession(sessionId);
    fetchSessionDetails(sessionId);
    fetchCompanies(sessionId);
  };

  // Handle stage control
  const handleStageControl = async (stage: number, action: string) => {
    if (!selectedSession) return;

    try {
      let targetUrl = '';
      if (stage === 2) {
        targetUrl = `/api/enrich/company-ids?jobId=${selectedSession}`;
      } else if (stage === 3) {
        targetUrl = `/api/financial/fetch?jobId=${selectedSession}`;
      }

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`Stage ${stage} ${action} initiated:`, result);
        // Refresh session details after a short delay
        setTimeout(() => {
          fetchSessionDetails(selectedSession);
        }, 1000);
      } else {
        const error = await response.json();
        console.error(`Failed to ${action} stage ${stage}:`, error);
      }
    } catch (error) {
      console.error('Error controlling stage:', error);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh && selectedSession) {
      const interval = setInterval(() => {
        fetchSessionDetails(selectedSession);
        fetchCompanies(selectedSession);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, selectedSession]);

  // Initial load
  useEffect(() => {
    fetchSessions();
  }, []);

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
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('sv-SE');
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      completed: 'bg-green-100 text-green-800',
      running: 'bg-blue-100 text-blue-800',
      pending: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const getEstimatedTime = (session: SessionInfo) => {
    const totalCompanies = session.totalCompanies;
    if (totalCompanies < 100) return '5-10 minutes';
    if (totalCompanies < 1000) return '15-30 minutes';
    if (totalCompanies < 5000) return '1-2 hours';
    return '2+ hours';
  };

  const filteredCompanies = companies.filter(company =>
    company.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.orgnr.includes(searchTerm)
  );

  const paginatedCompanies = filteredCompanies.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Scraping Sessions</h1>
            <p className="text-gray-600 mt-1">
              Monitor and manage your scraping sessions across all stages
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/')}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Scraper
            </button>
            <button
              onClick={fetchSessions}
              className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Sessions List */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Available Sessions</h2>
          
          {sessions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No sessions found. Start a new scraping session to see it here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.sessionId}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedSession === session.sessionId
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => handleSessionSelect(session.sessionId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          Session {session.sessionId.slice(0, 8)}...
                        </h3>
                        <p className="text-sm text-gray-600">
                          Created: {formatDate(session.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(session.status)}
                        <span className="text-sm text-gray-600">
                          {session.totalCompanies} companies
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">
                        Stage 1: {session.stages.stage1.status} | 
                        Stage 2: {session.stages.stage2.status} | 
                        Stage 3: {session.stages.stage3.status}
                      </div>
                      <div className="text-xs text-gray-500">
                        Est. time: {getEstimatedTime(session)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Session Details */}
        {selectedSession && sessionDetails && (
          <div className="space-y-6">
            {/* Session Overview */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">
                    Session {selectedSession.slice(0, 8)}... Details
                  </h2>
                  <p className="text-gray-600">
                    Created: {formatDate(sessionDetails.createdAt)} | 
                    Updated: {formatDate(sessionDetails.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-600">Auto-refresh</span>
                  </label>
                  <button
                    onClick={() => {
                      fetchSessionDetails(selectedSession);
                      fetchCompanies(selectedSession);
                    }}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {/* Stage Progress */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">Stage 1: Company Search</h3>
                  <div className="text-sm text-gray-600">
                    <div>Status: {sessionDetails.stages?.stage1?.status || 'unknown'}</div>
                    <div>Companies: {sessionDetails.totalCompanies}</div>
                    {sessionDetails.stages?.stage1?.completedAt && (
                      <div>Completed: {formatDate(sessionDetails.stages.stage1.completedAt)}</div>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">Stage 2: Enrichment</h3>
                  <div className="text-sm text-gray-600">
                    <div>Status: {sessionDetails.stages?.stage2?.status || 'unknown'}</div>
                    <div>Company IDs: {sessionDetails.totalCompanyIds}</div>
                    {sessionDetails.stages?.stage2?.completedAt && (
                      <div>Completed: {formatDate(sessionDetails.stages.stage2.completedAt)}</div>
                    )}
                  </div>
                  {sessionDetails.stages?.stage1?.status === 'completed' && sessionDetails.stages?.stage2?.status === 'pending' && (
                    <button
                      onClick={() => handleStageControl(2, 'start')}
                      className="mt-2 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                    >
                      Start Stage 2
                    </button>
                  )}
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">Stage 3: Financials</h3>
                  <div className="text-sm text-gray-600">
                    <div>Status: {sessionDetails.stages?.stage3?.status || 'unknown'}</div>
                    <div>Financial Records: {sessionDetails.totalFinancials}</div>
                    {sessionDetails.stages?.stage3?.completedAt && (
                      <div>Completed: {formatDate(sessionDetails.stages.stage3.completedAt)}</div>
                    )}
                  </div>
                  {sessionDetails.stages?.stage2?.status === 'completed' && sessionDetails.stages?.stage3?.status === 'pending' && (
                    <button
                      onClick={() => handleStageControl(3, 'start')}
                      className="mt-2 px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
                    >
                      Start Stage 3
                    </button>
                  )}
                </div>
              </div>

              {/* Performance Info */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium text-blue-800">Performance Estimate</span>
                </div>
                <div className="text-sm text-blue-700">
                  <div>Estimated total time: {getEstimatedTime(sessionDetails)}</div>
                  <div>Companies: {sessionDetails.totalCompanies} | 
                       Stage 2: {sessionDetails.totalCompanyIds} | 
                       Stage 3: {sessionDetails.totalFinancials}</div>
                </div>
              </div>
            </div>

            {/* Companies Data */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-800">Company Data</h2>
                <div className="flex items-center gap-4">
                  <input
                    type="text"
                    placeholder="Search companies..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600">
                    {filteredCompanies.length} companies
                  </span>
                </div>
              </div>

              {companiesLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading companies...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Company
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          OrgNr
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Stage 1 Data
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Stage 2 Data
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Stage 3 Data
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedCompanies.map((company) => {
                        const isExpanded = expandedRows.has(company.orgnr);
                        return (
                          <>
                            <tr key={company.orgnr} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{company.companyName}</div>
                                  {company.stage1Data.homepage && (
                                    <div className="text-sm text-gray-500">
                                      <a href={company.stage1Data.homepage} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                        {company.stage1Data.homepage}
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {company.orgnr}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <div>
                                  <div>Revenue: {formatCurrency(company.stage1Data.revenue)}</div>
                                  <div>Profit: {formatCurrency(company.stage1Data.profit)}</div>
                                  <div>Founded: {company.stage1Data.foundedYear || 'N/A'}</div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <div>
                                  <div>Company ID: {company.stage2Data.companyId || 'N/A'}</div>
                                  <div>Confidence: {company.stage2Data.confidence ? `${company.stage2Data.confidence}%` : 'N/A'}</div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <div>
                                  <div>Years: {company.stage3Data.years.length}</div>
                                  <div>Records: {company.stage3Data.recordCount}</div>
                                  <div>Status: {company.stage3Data.validationStatus}</div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {getStatusBadge(company.status)}
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
                                    {/* Stage 1 Details */}
                                    <div>
                                      <h4 className="text-sm font-medium text-gray-900 mb-2">Stage 1: Company Search</h4>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div>
                                          <span className="font-medium">Revenue:</span>
                                          <div className="text-gray-600">{formatCurrency(company.stage1Data.revenue)}</div>
                                        </div>
                                        <div>
                                          <span className="font-medium">Profit:</span>
                                          <div className="text-gray-600">{formatCurrency(company.stage1Data.profit)}</div>
                                        </div>
                                        <div>
                                          <span className="font-medium">Founded:</span>
                                          <div className="text-gray-600">{company.stage1Data.foundedYear || 'N/A'}</div>
                                        </div>
                                        <div>
                                          <span className="font-medium">Segment:</span>
                                          <div className="text-gray-600">{company.stage1Data.segment || 'N/A'}</div>
                                        </div>
                                      </div>
                                      {company.stage1Data.nace.length > 0 && (
                                        <div className="mt-2">
                                          <span className="font-medium">NACE Categories:</span>
                                          <div className="text-gray-600">{company.stage1Data.nace.join(', ')}</div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Stage 2 Details */}
                                    <div>
                                      <h4 className="text-sm font-medium text-gray-900 mb-2">Stage 2: Company ID Resolution</h4>
                                      <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                          <span className="font-medium">Company ID:</span>
                                          <div className="text-gray-600">{company.stage2Data.companyId || 'Not resolved'}</div>
                                        </div>
                                        <div>
                                          <span className="font-medium">Confidence:</span>
                                          <div className="text-gray-600">{company.stage2Data.confidence ? `${company.stage2Data.confidence}%` : 'N/A'}</div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Stage 3 Details */}
                                    <div>
                                      <h4 className="text-sm font-medium text-gray-900 mb-2">Stage 3: Financial Data</h4>
                                      <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                          <span className="font-medium">Years Available:</span>
                                          <div className="text-gray-600">
                                            {company.stage3Data.years.length > 0 
                                              ? company.stage3Data.years.sort((a, b) => b - a).join(', ')
                                              : 'No data'
                                            }
                                          </div>
                                        </div>
                                        <div>
                                          <span className="font-medium">Total Records:</span>
                                          <div className="text-gray-600">{company.stage3Data.recordCount}</div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Errors */}
                                    {company.errors.length > 0 && (
                                      <div>
                                        <h4 className="text-sm font-medium text-red-900 mb-2">Errors</h4>
                                        <ul className="list-disc list-inside text-sm text-red-700">
                                          {company.errors.map((error, index) => (
                                            <li key={index}>{error}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {filteredCompanies.length > itemsPerPage && (
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredCompanies.length)} of {filteredCompanies.length} results
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage * itemsPerPage >= filteredCompanies.length}
                      className="px-3 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
