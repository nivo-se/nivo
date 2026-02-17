import { useState } from 'react';
import { useParams, Link } from 'react-router';
import { useData } from '../data/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  ArrowLeft,
  CheckCircle,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  ExternalLink
} from 'lucide-react';

export default function RunResults() {
  const { runId } = useParams();
  const { getAIRun, getRunResults, getCompany, getTemplate, approveResult, rejectResult } = useData();
  
  const run = getAIRun(runId!);
  const results = getRunResults(runId!);
  const template = run ? getTemplate(run.template_id) : null;
  
  const [selectedResultId, setSelectedResultId] = useState<string | null>(
    results.length > 0 ? results[0].id : null
  );

  if (!run || !template) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Run not found</h2>
          <Link to="/ai">
            <Button>Back to AI Lab</Button>
          </Link>
        </div>
      </div>
    );
  }

  const selectedResult = results.find(r => r.id === selectedResultId);
  const selectedCompany = selectedResult ? getCompany(selectedResult.company_orgnr) : null;

  const pendingResults = results.filter(r => r.status === 'pending');
  const approvedResults = results.filter(r => r.status === 'approved');
  const rejectedResults = results.filter(r => r.status === 'rejected');

  const getRecommendationBadge = (rec: string) => {
    switch (rec) {
      case 'strong_fit':
        return <Badge className="bg-green-100 text-green-800">Strong Fit</Badge>;
      case 'potential_fit':
        return <Badge className="bg-yellow-100 text-yellow-800">Potential Fit</Badge>;
      case 'weak_fit':
        return <Badge className="bg-orange-100 text-orange-800">Weak Fit</Badge>;
      case 'pass':
        return <Badge className="bg-red-100 text-red-800">Pass</Badge>;
      default:
        return null;
    }
  };

  const handleApprove = (resultId: string) => {
    approveResult(resultId);
    // Move to next pending result if available
    const currentIndex = results.findIndex(r => r.id === resultId);
    const nextPending = results.slice(currentIndex + 1).find(r => r.status === 'pending');
    if (nextPending) {
      setSelectedResultId(nextPending.id);
    }
  };

  const handleReject = (resultId: string) => {
    rejectResult(resultId);
    // Move to next pending result if available
    const currentIndex = results.findIndex(r => r.id === resultId);
    const nextPending = results.slice(currentIndex + 1).find(r => r.status === 'pending');
    if (nextPending) {
      setSelectedResultId(nextPending.id);
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-6">
          <Link to={`/ai/runs/${run.id}`}>
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Run
            </Button>
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Analysis Results</h1>
              <p className="text-gray-600">{run.name} • {template.name}</p>
            </div>
            <div className="flex gap-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{approvedResults.length}</p>
                <p className="text-xs text-gray-600">Approved</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{pendingResults.length}</p>
                <p className="text-xs text-gray-600">Pending</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-400">{rejectedResults.length}</p>
                <p className="text-xs text-gray-600">Rejected</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Left: Results List */}
          <div className="col-span-1">
            <Tabs defaultValue="pending">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="pending">
                  Pending ({pendingResults.length})
                </TabsTrigger>
                <TabsTrigger value="approved">
                  Approved ({approvedResults.length})
                </TabsTrigger>
                <TabsTrigger value="rejected">
                  Rejected ({rejectedResults.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="space-y-2 mt-4">
                {pendingResults.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No pending results
                  </p>
                ) : (
                  pendingResults.map(result => {
                    const company = getCompany(result.company_orgnr);
                    return (
                      <Card 
                        key={result.id}
                        className={`cursor-pointer ${selectedResultId === result.id ? 'ring-2 ring-blue-600' : ''}`}
                        onClick={() => setSelectedResultId(result.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <p className="font-medium text-sm text-gray-900">{company?.display_name}</p>
                            <span className="text-lg font-bold text-gray-900">{result.overall_score}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            {getRecommendationBadge(result.recommendation)}
                            <span className="text-xs text-gray-500">{company?.industry_label}</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </TabsContent>

              <TabsContent value="approved" className="space-y-2 mt-4">
                {approvedResults.map(result => {
                  const company = getCompany(result.company_orgnr);
                  return (
                    <Card 
                      key={result.id}
                      className={`cursor-pointer ${selectedResultId === result.id ? 'ring-2 ring-blue-600' : ''}`}
                      onClick={() => setSelectedResultId(result.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-medium text-sm text-gray-900">{company?.display_name}</p>
                          <span className="text-lg font-bold text-green-600">{result.overall_score}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          {getRecommendationBadge(result.recommendation)}
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </TabsContent>

              <TabsContent value="rejected" className="space-y-2 mt-4">
                {rejectedResults.map(result => {
                  const company = getCompany(result.company_orgnr);
                  return (
                    <Card 
                      key={result.id}
                      className={`cursor-pointer opacity-60 ${selectedResultId === result.id ? 'ring-2 ring-blue-600' : ''}`}
                      onClick={() => setSelectedResultId(result.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-medium text-sm text-gray-900">{company?.display_name}</p>
                          <span className="text-lg font-bold text-gray-400">{result.overall_score}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          {getRecommendationBadge(result.recommendation)}
                          <XCircle className="w-4 h-4 text-gray-400" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: Selected Result Detail */}
          <div className="col-span-2">
            {!selectedResult || !selectedCompany ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-gray-500">Select a result to view details</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Company Header */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h2 className="text-2xl font-bold text-gray-900">{selectedCompany.display_name}</h2>
                          <Link to={`/company/${selectedCompany.orgnr}`} className="text-blue-600 hover:text-blue-800">
                            <ExternalLink className="w-5 h-5" />
                          </Link>
                        </div>
                        <p className="text-gray-600">{selectedCompany.industry_label} • {selectedCompany.region}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-4xl font-bold text-gray-900 mb-1">{selectedResult.overall_score}</p>
                        <p className="text-sm text-gray-600">AI Fit Score</p>
                        {getRecommendationBadge(selectedResult.recommendation)}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Dimension Scores */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      Scoring Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {template.scoringDimensions.map(dim => {
                        const score = selectedResult.dimension_scores[dim.id] || 0;
                        return (
                          <div key={dim.id}>
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="font-medium text-gray-900">{dim.name}</p>
                                <p className="text-xs text-gray-600">{dim.description}</p>
                              </div>
                              <span className={`text-2xl font-bold ${
                                score >= 75 ? 'text-green-600' :
                                score >= 50 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {Math.round(score)}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  score >= 75 ? 'bg-green-600' :
                                  score >= 50 ? 'bg-yellow-600' :
                                  'bg-red-600'
                                }`}
                                style={{ width: `${score}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle>AI Analysis Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 whitespace-pre-line leading-relaxed">
                      {selectedResult.summary}
                    </p>
                  </CardContent>
                </Card>

                {/* Strengths & Concerns */}
                <div className="grid grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-700">
                        <TrendingUp className="w-5 h-5" />
                        Key Strengths
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {selectedResult.strengths.map((strength, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-700">{strength}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-red-700">
                        <AlertTriangle className="w-5 h-5" />
                        Concerns & Red Flags
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {selectedResult.concerns.map((concern, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-700">{concern}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>

                {/* Metadata */}
                <Card>
                  <CardHeader>
                    <CardTitle>Analysis Metadata</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <dt className="font-medium text-gray-600">Analyzed At</dt>
                        <dd className="text-gray-900 mt-1">{new Date(selectedResult.analyzed_at).toLocaleString()}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-gray-600">Tokens Used</dt>
                        <dd className="text-gray-900 mt-1">{selectedResult.tokens_used.toLocaleString()}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-gray-600">Cost</dt>
                        <dd className="text-gray-900 mt-1">${selectedResult.cost.toFixed(3)}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-gray-600">Status</dt>
                        <dd className="text-gray-900 mt-1 capitalize">{selectedResult.status}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>

                {/* Actions */}
                {selectedResult.status === 'pending' && (
                  <div className="flex items-center justify-end gap-3 pt-4 border-t">
                    <Button 
                      variant="outline" 
                      onClick={() => handleReject(selectedResult.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <ThumbsDown className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                    <Button 
                      onClick={() => handleApprove(selectedResult.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <ThumbsUp className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
