import { useData } from '../data/DataContext';
import { Link } from 'react-router';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Trash2, ExternalLink } from 'lucide-react';

export default function MyLists() {
  const { lists, deleteList } = useData();

  const privateLists = lists.filter(l => l.scope === 'private');
  const sharedLists = lists.filter(l => l.scope === 'team');

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="max-w-5xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">My Lists</h1>
          <p className="text-sm text-gray-600">Manage your saved company lists</p>
        </div>

        {/* Private Lists */}
        <div className="mb-8">
          <h2 className="text-base font-medium text-gray-900 mb-4">Private Lists</h2>
          {privateLists.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-sm text-gray-500">No private lists yet</p>
                <Link to="/universe">
                  <Button className="mt-4 text-sm h-9">Create Your First List</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {privateLists.map(list => (
                <ListCard key={list.id} list={list} onDelete={deleteList} />
              ))}
            </div>
          )}
        </div>

        {/* Shared Lists */}
        <div>
          <h2 className="text-base font-medium text-gray-900 mb-4">Shareable Lists</h2>
          {sharedLists.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-sm text-gray-500">No shared lists yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {sharedLists.map(list => (
                <ListCard key={list.id} list={list} onDelete={deleteList} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ListCard({ list, onDelete }: { list: any; onDelete: (id: string) => void }) {
  const getStageLabel = (stage: string) => {
    switch (stage) {
      case 'research': return '🔍 Research';
      case 'ai_analysis': return '🤖 AI Analysis';
      case 'prospects': return '🎯 Prospects';
      default: return stage;
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-900">{list.name}</h3>
              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                {getStageLabel(list.stage)}
              </span>
              {list.scope === 'team' && (
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                  Shareable
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-3">
              {list.companyIds.length} companies • Created by {list.created_by} • {new Date(list.created_at).toLocaleDateString()}
            </p>
            {list.filters && (
              <p className="text-xs text-gray-500 mb-3">
                ✓ Created from filters (can be reloaded and modified)
              </p>
            )}
          </div>
          <div className="flex gap-2 ml-4">
            <Link to={`/lists/${list.id}`}>
              <Button size="sm">
                Open <ExternalLink className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (confirm(`Delete "${list.name}"?`)) {
                  onDelete(list.id);
                }
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}