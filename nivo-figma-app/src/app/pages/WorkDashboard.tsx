import { useData } from '../data/DataContext';
import { Link } from 'react-router';
import { ArrowRight, Brain, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

export default function WorkDashboard() {
  const { companies, lists, prospects } = useData();

  const researchLists = lists.filter(l => l.stage === 'research');
  const aiAnalysisLists = lists.filter(l => l.stage === 'ai_analysis');
  
  const prospectsByStatus = {
    new: prospects.filter(p => p.status === 'new').length,
    contacted: prospects.filter(p => p.status === 'contacted').length,
    in_discussion: prospects.filter(p => p.status === 'in_discussion').length,
    interested: prospects.filter(p => p.status === 'interested').length,
    not_interested: prospects.filter(p => p.status === 'not_interested').length
  };

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="max-w-5xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-sm text-gray-600">Here's what's happening with your investment pipeline</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-2">Total Companies</p>
                <p className="text-2xl font-semibold text-gray-900">{companies.length.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-2">Active Lists</p>
                <p className="text-2xl font-semibold text-gray-900">{lists.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-2">Prospects</p>
                <p className="text-2xl font-semibold text-gray-900">{prospects.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* My Lists Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-medium text-gray-900">My Lists</h2>
            <Link to="/lists" className="text-sm text-gray-600 hover:text-gray-900">
              View All
            </Link>
          </div>

          {/* Research Lists */}
          {researchLists.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Research</h3>
              <div className="space-y-3">
                {researchLists.map(list => (
                  <div key={list.id} className="bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">{list.name}</h4>
                        <p className="text-sm text-gray-600">
                          {list.companyIds.length} companies • Last edited {getTimeAgo(list.created_at)}
                        </p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Link to={`/lists/${list.id}`}>
                          <Button size="sm" variant="outline" className="text-sm h-8">View</Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Analysis Lists */}
          {aiAnalysisLists.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-3">AI Analysis</h3>
              <div className="space-y-3">
                {aiAnalysisLists.map(list => (
                  <div key={list.id} className="bg-white rounded-lg border border-gray-200 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">{list.name}</h4>
                        <p className="text-sm text-gray-600">Running analysis...</p>
                      </div>
                      <Button size="sm" variant="outline" className="text-sm h-8">View Progress</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Prospects Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-medium text-gray-900">Team Prospects</h2>
            <Link to="/prospects" className="text-sm text-gray-600 hover:text-gray-900">
              View All
            </Link>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-4 mb-6">
              <h3 className="text-sm font-medium text-gray-900">{prospects.length} Companies in Pipeline</h3>
            </div>
            <div className="grid grid-cols-5 gap-6">
              <div>
                <p className="text-2xl font-semibold text-gray-900">{prospectsByStatus.new}</p>
                <p className="text-sm text-gray-600 mt-2">New</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">{prospectsByStatus.contacted}</p>
                <p className="text-sm text-gray-600 mt-2">Contacted</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">{prospectsByStatus.in_discussion}</p>
                <p className="text-sm text-gray-600 mt-2">In Discussion</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">{prospectsByStatus.interested}</p>
                <p className="text-sm text-gray-600 mt-2">Interested</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-500">{prospectsByStatus.not_interested}</p>
                <p className="text-sm text-gray-600 mt-2">Not Interested</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return 'yesterday';
  return `${diffDays} days ago`;
}