import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router';
import { useData } from '../data/DataContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { ArrowLeft, Play, DollarSign, ListChecks } from 'lucide-react';

export default function CreateRun() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { getTemplate, getList, createAIRun } = useData();
  
  const templateId = searchParams.get('template');
  const listId = searchParams.get('list');
  
  const template = templateId ? getTemplate(templateId) : null;
  const list = listId ? getList(listId) : null;
  
  const [runName, setRunName] = useState('');
  const [autoApprove, setAutoApprove] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (list && template) {
      setRunName(`${list.name} - ${template.name}`);
    }
  }, [list, template]);

  if (!template || !list) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Configuration</h2>
          <p className="text-gray-600 mb-4">Template or list not found</p>
          <Link to="/ai">
            <Button>Back to AI Lab</Button>
          </Link>
        </div>
      </div>
    );
  }

  const estimatedCost = list.companyIds.length * 0.20;
  const estimatedTime = Math.ceil(list.companyIds.length / 10); // ~10 companies per minute

  const handleCreateRun = async () => {
    setIsCreating(true);
    try {
      const newRun = createAIRun(runName, list.id, template.id, {
        auto_approve: autoApprove,
        overwrite_existing: overwriteExisting
      });
      
      // Navigate to run detail page
      navigate(`/ai/runs/${newRun.id}`);
    } catch (error) {
      console.error('Failed to create run:', error);
      alert('Failed to create run. Please try again.');
      setIsCreating(false);
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="mb-6">
          <Link to="/ai">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to AI Lab
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create AI Analysis Run</h1>
          <p className="text-gray-600">Configure and launch your analysis</p>
        </div>

        <div className="space-y-6">
          {/* Run Name */}
          <Card>
            <CardHeader>
              <CardTitle>Run Name</CardTitle>
              <CardDescription>Give this analysis run a descriptive name</CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                value={runName}
                onChange={(e) => setRunName(e.target.value)}
                placeholder="e.g., Q1 2026 - Manufacturing Batch"
                className="max-w-xl"
              />
            </CardContent>
          </Card>

          {/* Selected List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="w-5 h-5" />
                Target List
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{list.name}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {list.companyIds.length} companies • Created {new Date(list.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge>{list.companyIds.length} companies</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Selected Template */}
          <Card>
            <CardHeader>
              <CardTitle>Analysis Template</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{template.name}</p>
                    <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Scoring Dimensions:</p>
                  <div className="flex flex-wrap gap-2">
                    {template.scoringDimensions.map(dim => (
                      <Badge key={dim.id} variant="secondary">
                        {dim.name} ({(dim.weight * 100).toFixed(0)}%)
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Adjust run settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="auto-approve"
                    checked={autoApprove}
                    onCheckedChange={(checked) => setAutoApprove(checked as boolean)}
                  />
                  <div>
                    <label htmlFor="auto-approve" className="text-sm font-medium text-gray-900 cursor-pointer">
                      Auto-approve results
                    </label>
                    <p className="text-xs text-gray-600 mt-1">
                      Automatically approve all AI results without manual review. Not recommended for first-time runs.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="overwrite"
                    checked={overwriteExisting}
                    onCheckedChange={(checked) => setOverwriteExisting(checked as boolean)}
                  />
                  <div>
                    <label htmlFor="overwrite" className="text-sm font-medium text-gray-900 cursor-pointer">
                      Overwrite existing AI profiles
                    </label>
                    <p className="text-xs text-gray-600 mt-1">
                      Replace existing AI analysis results for companies in this list
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cost & Time Estimate */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Cost & Time Estimate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Estimated Cost</p>
                  <p className="text-2xl font-bold text-gray-900">${estimatedCost.toFixed(2)}</p>
                  <p className="text-xs text-gray-500 mt-1">~$0.20 per company</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Estimated Time</p>
                  <p className="text-2xl font-bold text-gray-900">{estimatedTime} min</p>
                  <p className="text-xs text-gray-500 mt-1">~10 companies per minute</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Link to="/ai">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button 
              size="lg" 
              onClick={handleCreateRun}
              disabled={!runName.trim() || isCreating}
            >
              <Play className="w-4 h-4 mr-2" />
              {isCreating ? 'Creating Run...' : 'Start Analysis'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
