import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { useData } from '../data/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { 
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  Loader,
  DollarSign,
  Eye,
  Ban
} from 'lucide-react';

export default function RunDetail() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const { getAIRun, getList, getTemplate, getRunResults, cancelAIRun } = useData();
  
  const [run, setRun] = useState(getAIRun(runId!));
  const list = run ? getList(run.list_id) : null;
  const template = run ? getTemplate(run.template_id) : null;
  const results = run ? getRunResults(run.id) : [];

  // Poll for updates while run is in progress
  useEffect(() => {
    if (!run || (run.status !== 'running' && run.status !== 'queued')) return;

    const interval = setInterval(() => {
      const updatedRun = getAIRun(runId!);
      if (updatedRun) {
        setRun(updatedRun);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [run, runId, getAIRun]);

  if (!run || !list || !template) {
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

  const progressPercent = run.total_companies > 0 
    ? (run.processed_companies / run.total_companies) * 100 
    : 0;

  const getStatusBadge = () => {
    switch (run.status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" /> Completed</Badge>;
      case 'running':
        return <Badge className="bg-blue-100 text-blue-800"><Loader className="w-3 h-3 mr-1 animate-spin" /> Running</Badge>;
      case 'queued':
        return <Badge className="bg-gray-100 text-gray-800"><Clock className="w-3 h-3 mr-1" /> Queued</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-100 text-gray-800"><Ban className="w-3 h-3 mr-1" /> Cancelled</Badge>;
      default:
        return null;
    }
  };

  const handleCancel = () => {
    if (confirm('Are you sure you want to cancel this run?')) {
      cancelAIRun(run.id);
      setRun({ ...run, status: 'cancelled' });
    }
  };

  const canViewResults = run.status === 'completed' && results.length > 0;

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-5xl mx-auto p-8">
        {/* Header */}
        <div className="mb-6">
          <Link to="/ai">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to AI Lab
            </Button>
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{run.name}</h1>
              <p className="text-gray-600">
                Created by {run.created_by} • {new Date(run.created_at).toLocaleDateString()} at {new Date(run.created_at).toLocaleTimeString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge()}
              {canViewResults && (
                <Button onClick={() => navigate(`/ai/runs/${run.id}/results`)}>
                  <Eye className="w-4 h-4 mr-2" />
                  View Results
                </Button>
              )}
              {(run.status === 'running' || run.status === 'queued') && (
                <Button variant="outline" onClick={handleCancel}>
                  <Ban className="w-4 h-4 mr-2" />
                  Cancel Run
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Progress Card */}
        {(run.status === 'running' || run.status === 'queued') && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      Analyzing companies...
                    </span>
                    <span className="text-sm text-gray-600">
                      {run.processed_companies} / {run.total_companies}
                    </span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                </div>
                
                {run.status === 'running' && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Processing... This may take a few minutes.</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 mb-1">Total Companies</p>
              <p className="text-2xl font-bold text-gray-900">{run.total_companies}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 mb-1">Processed</p>
              <p className="text-2xl font-bold text-green-600">{run.processed_companies}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 mb-1">Failed</p>
              <p className="text-2xl font-bold text-red-600">{run.failed_companies}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 mb-1">Cost</p>
              <p className="text-2xl font-bold text-gray-900">
                ${run.status === 'completed' ? run.actual_cost.toFixed(2) : run.estimated_cost.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500">
                {run.status === 'completed' ? 'Actual' : 'Estimated'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Configuration Details */}
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Analysis Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-600">Template</dt>
                  <dd className="text-sm text-gray-900 mt-1">{template.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-600">Target List</dt>
                  <dd className="text-sm text-gray-900 mt-1">
                    <Link to={`/lists/${list.id}`} className="text-blue-600 hover:underline">
                      {list.name}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-600">Auto-approve Results</dt>
                  <dd className="text-sm text-gray-900 mt-1">
                    {run.config.auto_approve ? 'Yes' : 'No (manual review required)'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-600">Overwrite Existing</dt>
                  <dd className="text-sm text-gray-900 mt-1">
                    {run.config.overwrite_existing ? 'Yes' : 'No'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-600">Created</dt>
                  <dd className="text-sm text-gray-900 mt-1">
                    {new Date(run.created_at).toLocaleString()}
                  </dd>
                </div>
                {run.started_at && (
                  <div>
                    <dt className="text-sm font-medium text-gray-600">Started</dt>
                    <dd className="text-sm text-gray-900 mt-1">
                      {new Date(run.started_at).toLocaleString()}
                    </dd>
                  </div>
                )}
                {run.completed_at && (
                  <div>
                    <dt className="text-sm font-medium text-gray-600">Completed</dt>
                    <dd className="text-sm text-gray-900 mt-1">
                      {new Date(run.completed_at).toLocaleString()}
                    </dd>
                  </div>
                )}
                {run.started_at && run.completed_at && (
                  <div>
                    <dt className="text-sm font-medium text-gray-600">Duration</dt>
                    <dd className="text-sm text-gray-900 mt-1">
                      {Math.ceil((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000 / 60)} minutes
                    </dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
