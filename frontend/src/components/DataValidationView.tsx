import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { 
  ChevronDown, 
  ChevronRight, 
  Search, 
  Filter,
  Building2,
  Database,
  CheckCircle,
  AlertCircle,
  Clock,
  TrendingUp,
  DollarSign,
  Calendar,
  ExternalLink,
  RefreshCw
} from 'lucide-react';

interface CompanyData {
  orgnr: string;
  companyName: string;
  companyId: string | null;
  status: string;
  stage1Data: {
    revenue: number | null;
    profit: number | null;
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
  };
  errors: string[];
}

interface ValidationSummary {
  totalCompanies: number;
  companiesWithIds: number;
  companiesWithFinancials: number;
  totalFinancialRecords: number;
  avgRecordsPerCompany: number;
  stage1Progress: number;
  stage2Progress: number;
  stage3Progress: number;
}

interface DataValidationViewProps {
  sessionId: string;
  onRefresh?: () => void;
}

const DataValidationView: React.FC<DataValidationViewProps> = ({ sessionId, onRefresh }) => {
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [errors, setErrors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    status: '',
    searchTerm: '',
    hasFinancials: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  });

  const fetchData = async () => {
    try {
      setRefreshing(true);
      
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.status && { status: filters.status }),
        ...(filters.searchTerm && { search: filters.searchTerm }),
        ...(filters.hasFinancials && { hasFinancials: filters.hasFinancials })
      });
      
      const response = await fetch(`http://localhost:3000/api/sessions/${sessionId}/companies?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setCompanies(data.companies);
        setSummary(data.summary);
        setErrors(data.errors);
        setPagination(data.pagination);
      } else {
        console.error('Failed to fetch validation data:', data.error);
      }
    } catch (error) {
      console.error('Error fetching validation data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchData();
    }
  }, [sessionId, pagination.page, filters]);

  const toggleRowExpansion = (orgnr: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(orgnr)) {
      newExpanded.delete(orgnr);
    } else {
      newExpanded.add(orgnr);
    }
    setExpandedRows(newExpanded);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-700">Pending</Badge>;
      case 'id_resolved':
        return <Badge variant="default" className="bg-blue-100 text-blue-700">ID Resolved</Badge>;
      case 'financials_fetched':
        return <Badge variant="default" className="bg-green-100 text-green-700">Complete</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStageProgress = (company: CompanyData) => {
    const stages = [
      { name: 'Stage 1', completed: true, icon: <CheckCircle className="h-3 w-3" /> },
      { name: 'Stage 2', completed: !!company.stage2Data.companyId, icon: company.stage2Data.companyId ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" /> },
      { name: 'Stage 3', completed: company.stage3Data.recordCount > 0, icon: company.stage3Data.recordCount > 0 ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" /> }
    ];
    
    return (
      <div className="flex items-center space-x-2">
        {stages.map((stage, index) => (
          <div key={index} className={`flex items-center space-x-1 ${stage.completed ? 'text-green-600' : 'text-gray-400'}`}>
            {stage.icon}
            <span className="text-xs">{stage.name}</span>
          </div>
        ))}
      </div>
    );
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('sv-SE');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading validation data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalCompanies}</div>
              <p className="text-xs text-muted-foreground">In session</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stage 2 Complete</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{summary.companiesWithIds}</div>
              <p className="text-xs text-muted-foreground">
                {summary.stage2Progress}% complete
              </p>
              <Progress value={summary.stage2Progress} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stage 3 Complete</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{summary.companiesWithFinancials}</div>
              <p className="text-xs text-muted-foreground">
                {summary.stage3Progress}% complete
              </p>
              <Progress value={summary.stage3Progress} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Financial Records</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalFinancialRecords}</div>
              <p className="text-xs text-muted-foreground">
                {summary.avgRecordsPerCompany} avg per company
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Company Data Validation</CardTitle>
          <CardDescription>Review and validate scraped company data across all stages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search companies..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="id_resolved">ID Resolved</SelectItem>
                <SelectItem value="financials_fetched">Complete</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              onClick={fetchData}
              disabled={refreshing}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Companies Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Org Nr</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Stage Progress</TableHead>
                  <TableHead>Financial Years</TableHead>
                  <TableHead>Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <React.Fragment key={company.orgnr}>
                    <TableRow className="cursor-pointer hover:bg-gray-50" onClick={() => toggleRowExpansion(company.orgnr)}>
                      <TableCell>
                        {expandedRows.has(company.orgnr) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{company.companyName}</TableCell>
                      <TableCell className="font-mono text-sm">{company.orgnr}</TableCell>
                      <TableCell>{getStatusBadge(company.status)}</TableCell>
                      <TableCell>{getStageProgress(company)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {company.stage3Data.years.slice(0, 3).map((year) => (
                            <Badge key={year} variant="outline" className="text-xs">
                              {year}
                            </Badge>
                          ))}
                          {company.stage3Data.years.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{company.stage3Data.years.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(company.stage1Data.revenue)}</TableCell>
                    </TableRow>
                    
                    {/* Expanded Row Details */}
                    {expandedRows.has(company.orgnr) && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-gray-50 p-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Stage 1 Data */}
                            <div>
                              <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                Stage 1: Segmentation
                              </h4>
                              <div className="space-y-2 text-sm">
                                <div><strong>Revenue:</strong> {formatCurrency(company.stage1Data.revenue)}</div>
                                <div><strong>Profit:</strong> {formatCurrency(company.stage1Data.profit)}</div>
                                <div><strong>Founded:</strong> {company.stage1Data.foundedYear || 'N/A'}</div>
                                <div><strong>Homepage:</strong> 
                                  {company.stage1Data.homepage ? (
                                    <a href={company.stage1Data.homepage} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600 hover:underline">
                                      <ExternalLink className="h-3 w-3 inline" />
                                    </a>
                                  ) : ' N/A'}
                                </div>
                                <div><strong>NACE:</strong> {company.stage1Data.nace.join(', ')}</div>
                                <div><strong>Segment:</strong> {company.stage1Data.segment.join(', ')}</div>
                              </div>
                            </div>

                            {/* Stage 2 Data */}
                            <div>
                              <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                                {company.stage2Data.companyId ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <Clock className="h-4 w-4 text-gray-400" />
                                )}
                                Stage 2: Company ID
                              </h4>
                              <div className="space-y-2 text-sm">
                                <div><strong>Company ID:</strong> {company.stage2Data.companyId || 'Not resolved'}</div>
                                <div><strong>Confidence:</strong> {company.stage2Data.confidence || 'N/A'}</div>
                              </div>
                            </div>

                            {/* Stage 3 Data */}
                            <div>
                              <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                                {company.stage3Data.recordCount > 0 ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <Clock className="h-4 w-4 text-gray-400" />
                                )}
                                Stage 3: Financial Data
                              </h4>
                              <div className="space-y-2 text-sm">
                                <div><strong>Records:</strong> {company.stage3Data.recordCount}</div>
                                <div><strong>Years:</strong> {company.stage3Data.years.join(', ')}</div>
                                <div><strong>Status:</strong> {company.stage3Data.validationStatus}</div>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-600">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} companies
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page === 1}
                  onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page === pagination.pages}
                  onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DataValidationView;
