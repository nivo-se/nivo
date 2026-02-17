import { useState } from 'react';
import { Link } from 'react-router';
import { useData } from '../data/DataContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { ExternalLink, Trash2, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';

const statusConfig = {
  new: { label: 'New', color: 'bg-blue-100 text-blue-800' },
  researching: { label: 'Researching', color: 'bg-purple-100 text-purple-800' },
  contacted: { label: 'Contacted', color: 'bg-yellow-100 text-yellow-800' },
  in_discussion: { label: 'In Discussion', color: 'bg-orange-100 text-orange-800' },
  meeting_scheduled: { label: 'Meeting Scheduled', color: 'bg-indigo-100 text-indigo-800' },
  interested: { label: 'Interested', color: 'bg-green-100 text-green-800' },
  not_interested: { label: 'Not Interested', color: 'bg-gray-100 text-gray-800' },
  passed: { label: 'Passed', color: 'bg-red-100 text-red-800' },
  deal_in_progress: { label: 'Deal in Progress', color: 'bg-emerald-100 text-emerald-800' },
};

export default function Prospects() {
  const { prospects, getCompany, updateProspectStatus, addProspectNote, removeProspectNote, editProspectNote } = useData();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedProspect, setExpandedProspect] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');
  const [editingNote, setEditingNote] = useState<{ companyId: string; noteIndex: number } | null>(null);
  const [editNoteText, setEditNoteText] = useState('');

  const filteredProspects = filterStatus === 'all'
    ? prospects
    : prospects.filter(p => p.status === filterStatus);

  const handleAddNote = (companyId: string) => {
    if (newNote.trim()) {
      addProspectNote(companyId, newNote, 'Sarah');
      setNewNote('');
      toast.success('Note added');
    }
  };

  const handleRemoveNote = (companyId: string, noteIndex: number) => {
    removeProspectNote(companyId, noteIndex);
    toast.success('Note deleted');
  };

  const handleStartEdit = (companyId: string, noteIndex: number, currentText: string) => {
    setEditingNote({ companyId, noteIndex });
    setEditNoteText(currentText);
  };

  const handleSaveEdit = () => {
    if (editingNote && editNoteText.trim()) {
      editProspectNote(editingNote.companyId, editingNote.noteIndex, editNoteText.trim());
      setEditingNote(null);
      setEditNoteText('');
      toast.success('Note updated');
    }
  };

  const handleCancelEdit = () => {
    setEditingNote(null);
    setEditNoteText('');
  };

  const handleStatusChange = (companyId: string, newStatus: string) => {
    updateProspectStatus(companyId, { status: newStatus as any });
    toast.success('Status updated');
  };

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="max-w-5xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Prospects</h1>
          <p className="text-sm text-gray-600">Team pipeline • {prospects.length} companies</p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Filter by status:</span>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(statusConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-gray-600">
            Showing {filteredProspects.length} of {prospects.length}
          </span>
        </div>

        {/* Prospects List */}
        <div className="space-y-3">
          {filteredProspects.map(prospect => {
            const company = getCompany(prospect.companyId);
            if (!company) return null;

            const isExpanded = expandedProspect === prospect.companyId;
            const config = statusConfig[prospect.status];

            return (
              <div key={prospect.companyId} className="bg-white rounded-lg border border-gray-200">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <Link to={`/company/${company.orgnr}`} className="text-base font-medium text-gray-900 hover:text-blue-600 flex items-center gap-2">
                          {company.display_name}
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                        <span className={`text-xs px-2 py-0.5 rounded ${config.color}`}>{config.label}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{company.industry}</span>
                        <span>•</span>
                        <span>{company.geography}</span>
                        {prospect.owner && (
                          <>
                            <span>•</span>
                            <span>Owner: {prospect.owner}</span>
                          </>
                        )}
                        {prospect.lastContact && (
                          <>
                            <span>•</span>
                            <span>Last contact: {new Date(prospect.lastContact).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Select 
                        value={prospect.status} 
                        onValueChange={(value) => handleStatusChange(prospect.companyId, value)}
                      >
                        <SelectTrigger className="w-40 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(statusConfig).map(([key, config]) => (
                            <SelectItem key={key} value={key}>{config.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setExpandedProspect(isExpanded ? null : prospect.companyId)}
                      >
                        {isExpanded ? 'Hide' : 'Show'} Details
                      </Button>
                    </div>
                  </div>

                  {/* Latest Note */}
                  {prospect.notes.length > 0 && (
                    <div className="bg-gray-50 rounded-md p-3 mb-2">
                      <p className="text-sm text-gray-900 mb-1">{prospect.notes[prospect.notes.length - 1].text}</p>
                      <p className="text-xs text-gray-500">
                        {prospect.notes[prospect.notes.length - 1].author} • {new Date(prospect.notes[prospect.notes.length - 1].date).toLocaleString()}
                      </p>
                    </div>
                  )}

                  {prospect.nextAction && (
                    <div className="mb-2">
                      <p className="text-sm"><span className="font-medium">Next Action:</span> {prospect.nextAction}</p>
                    </div>
                  )}

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 pt-4 mt-3 space-y-4">
                      {/* All Notes */}
                      {prospect.notes.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Activity History</h4>
                          <div className="space-y-2">
                            {prospect.notes.map((note, i) => {
                              const isEditing = editingNote?.companyId === prospect.companyId && editingNote?.noteIndex === i;
                              
                              return (
                                <div key={i} className="bg-gray-50 rounded-md p-3 relative group">
                                  {isEditing ? (
                                    <>
                                      <Textarea
                                        value={editNoteText}
                                        onChange={(e) => setEditNoteText(e.target.value)}
                                        className="mb-2 text-sm"
                                        rows={3}
                                      />
                                      <div className="flex gap-2">
                                        <button
                                          onClick={handleSaveEdit}
                                          disabled={!editNoteText.trim()}
                                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          <Check className="w-3 h-3" />
                                          Save
                                        </button>
                                        <button
                                          onClick={handleCancelEdit}
                                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                                        >
                                          <X className="w-3 h-3" />
                                          Cancel
                                        </button>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <p className="text-sm text-gray-900 mb-1 pr-16">{note.text}</p>
                                      <p className="text-xs text-gray-500">
                                        {note.author} • {new Date(note.date).toLocaleString()}
                                      </p>
                                      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => handleStartEdit(prospect.companyId, i, note.text)}
                                          className="text-gray-400 hover:text-blue-600"
                                          title="Edit note"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleRemoveNote(prospect.companyId, i)}
                                          className="text-gray-400 hover:text-red-600"
                                          title="Delete note"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Add Note */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Add Note</h4>
                        <Textarea
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          placeholder="Add call outcome, meeting notes, next steps..."
                          className="mb-2"
                        />
                        <Button 
                          size="sm" 
                          onClick={() => handleAddNote(prospect.companyId)}
                          disabled={!newNote.trim()}
                          className="h-8 text-xs"
                        >
                          Add Note
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredProspects.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-gray-500">No prospects found with this status</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}