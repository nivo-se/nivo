import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useProspects, useCompany } from "@/lib/hooks/figmaQueries";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExternalLink, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/services/figmaApi";
import {
  getLatestFinancials,
  formatRevenueSEK,
  formatPercent,
  calculateRevenueCagr,
} from "@/lib/utils/figmaCompanyUtils";

const statusConfig: Record<
  string,
  { label: string; color: string }
> = {
  new: { label: "New", color: "bg-primary/15 text-primary" },
  researching: { label: "Researching", color: "bg-accent text-accent-foreground" },
  contacted: { label: "Contacted", color: "bg-accent text-foreground" },
  in_discussion: { label: "In Discussion", color: "bg-accent text-foreground" },
  meeting_scheduled: { label: "Meeting Scheduled", color: "bg-accent text-accent-foreground" },
  interested: { label: "Interested", color: "bg-primary/15 text-primary" },
  not_interested: { label: "Not Interested", color: "bg-muted text-foreground" },
  passed: { label: "Passed", color: "bg-destructive/15 text-destructive" },
  deal_in_progress: { label: "Deal in Progress", color: "bg-primary/15 text-primary" },
};

function ProspectCard({
  prospect,
  expandedId,
  onToggleExpand,
  newNote,
  setNewNote,
  editingNote,
  setEditingNote,
  editNoteText,
  setEditNoteText,
}: {
  prospect: { companyId: string; status: string; owner?: string; lastContact?: string; notes: { text: string; author: string; date: string }[]; nextAction?: string };
  expandedId: string | null;
  onToggleExpand: (id: string | null) => void;
  newNote: string;
  setNewNote: (v: string) => void;
  editingNote: { companyId: string; noteIndex: number } | null;
  setEditingNote: (v: { companyId: string; noteIndex: number } | null) => void;
  editNoteText: string;
  setEditNoteText: (v: string) => void;
}) {
  const queryClient = useQueryClient();
  const { data: company, isLoading } = useCompany(prospect.companyId);
  const isExpanded = expandedId === prospect.companyId;
  const config = statusConfig[prospect.status] ?? { label: prospect.status, color: "bg-muted text-foreground" };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try {
      await api.addProspectNote(prospect.companyId, { text: newNote.trim(), author: "User" });
      queryClient.invalidateQueries({ queryKey: ["figma", "prospects"] });
      setNewNote("");
      toast.success("Note added");
    } catch {
      toast.error("Prospects not yet implemented in backend");
    }
  };

  const handleRemoveNote = async (_companyId: string, noteIndex: number) => {
    try {
      await api.deleteProspectNote(prospect.companyId, noteIndex);
      queryClient.invalidateQueries({ queryKey: ["figma", "prospects"] });
      toast.success("Note deleted");
    } catch {
      toast.error("Prospects not yet implemented in backend");
    }
  };

  const handleStartEdit = (_companyId: string, noteIndex: number, currentText: string) => {
    setEditingNote({ companyId: prospect.companyId, noteIndex });
    setEditNoteText(currentText);
  };

  const handleSaveEdit = async () => {
    if (!editingNote || !editNoteText.trim()) return;
    try {
      await api.updateProspectNote(editingNote.companyId, editingNote.noteIndex, editNoteText.trim());
      queryClient.invalidateQueries({ queryKey: ["figma", "prospects"] });
      setEditingNote(null);
      setEditNoteText("");
      toast.success("Note updated");
    } catch {
      toast.error("Prospects not yet implemented in backend");
    }
  };

  const handleCancelEdit = () => {
    setEditingNote(null);
    setEditNoteText("");
  };

  const handleStatusChange = async (_companyId: string, newStatus: string) => {
    try {
      await api.updateProspectStatus(prospect.companyId, { status: newStatus as never });
      queryClient.invalidateQueries({ queryKey: ["figma", "prospects"] });
      toast.success("Status updated");
    } catch {
      toast.error("Prospects not yet implemented in backend");
    }
  };

  if (isLoading || !company) {
    return (
      <div className="bg-card rounded-lg border border-border p-5 animate-pulse">
        <div className="h-5 bg-muted rounded w-1/3 mb-2" />
        <div className="h-4 bg-muted rounded w-1/2" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <Link
                to={`/company/${company.orgnr}`}
                className="text-base font-medium text-foreground hover:text-primary flex items-center gap-2"
              >
                {company.display_name}
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <span className={`text-xs px-2 py-0.5 rounded ${config.color}`}>{config.label}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{company.industry_label}</span>
              <span>•</span>
              <span>{company.region ?? "—"}</span>
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
          <div className="flex gap-2 items-center">
            <Select value={prospect.status} onValueChange={(v) => handleStatusChange(prospect.companyId, v)}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusConfig).map(([key, c]) => (
                  <SelectItem key={key} value={key}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              className="text-sm text-foreground hover:text-foreground cursor-pointer font-medium"
              onClick={() => onToggleExpand(isExpanded ? null : prospect.companyId)}
            >
              {prospect.notes.length} {prospect.notes.length === 1 ? "note" : "notes"}
            </button>
          </div>
        </div>

        <div className="flex gap-6 text-xs text-foreground mb-3">
          <span>Revenue: {formatRevenueSEK(getLatestFinancials(company).revenue ?? company.revenue_latest)}</span>
          <span>EBITDA: {formatRevenueSEK(getLatestFinancials(company).ebitda)}</span>
          <span>Employees: {company.employees_latest ?? "—"}</span>
          {(() => {
            const cagr = calculateRevenueCagr(company);
            return cagr != null ? (
              <span className={cagr >= 0 ? "text-primary font-medium" : "text-destructive"}>
                Growth: {formatPercent(cagr)}
              </span>
            ) : null;
          })()}
        </div>

        {!isExpanded && prospect.notes.length > 0 && (
          <div className="bg-muted/40 rounded-md p-3 mb-2">
            <p className="text-sm text-foreground mb-1 line-clamp-2">{prospect.notes[prospect.notes.length - 1].text}</p>
            <p className="text-xs text-muted-foreground">
              {prospect.notes[prospect.notes.length - 1].author} • {new Date(prospect.notes[prospect.notes.length - 1].date).toLocaleString()}
            </p>
          </div>
        )}

        {prospect.nextAction && (
          <div className="mb-2">
            <p className="text-sm"><span className="font-medium">Next Action:</span> {prospect.nextAction}</p>
          </div>
        )}

        {isExpanded && (
          <div className="border-t border-border pt-4 mt-3 space-y-4">
            {prospect.notes.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Activity History</h4>
                <div className="space-y-2">
                  {prospect.notes.map((note, i) => {
                    const isEditing = editingNote?.companyId === prospect.companyId && editingNote?.noteIndex === i;
                    return (
                      <div key={i} className="bg-muted/40 rounded-md p-3 relative group">
                        {isEditing ? (
                          <>
                            <Textarea
                              value={editNoteText}
                              onChange={(e) => setEditNoteText(e.target.value)}
                              className="mb-2 text-sm"
                              rows={3}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="xs"
                                onClick={handleSaveEdit}
                                disabled={!editNoteText.trim()}
                              >
                                <Check className="w-3 h-3" />
                                Save
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={handleCancelEdit}
                              >
                                <X className="w-3 h-3" />
                                Cancel
                              </Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-foreground mb-1 pr-16">{note.text}</p>
                            <p className="text-xs text-muted-foreground">
                              {note.author} • {new Date(note.date).toLocaleString()}
                            </p>
                            <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleStartEdit(prospect.companyId, i, note.text)}
                                className="text-muted-foreground hover:text-primary"
                                title="Edit note"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleRemoveNote(prospect.companyId, i)}
                                className="text-muted-foreground hover:text-destructive"
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

            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Add Note</h4>
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add call outcome, meeting notes, next steps..."
                className="mb-2"
              />
              <Button size="sm" onClick={handleAddNote} disabled={!newNote.trim()} className="h-8 text-xs">
                Add Note
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NewProspects() {
  const { data: prospects = [], isLoading } = useProspects();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedProspect, setExpandedProspect] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [editingNote, setEditingNote] = useState<{ companyId: string; noteIndex: number } | null>(null);
  const [editNoteText, setEditNoteText] = useState("");

  const filteredProspects =
    filterStatus === "all" ? prospects : prospects.filter((p) => p.status === filterStatus);

  return (
    <div className="h-full overflow-auto app-bg">
      <div className="max-w-5xl mx-auto px-8 py-8">
        <div className="mb-8">
          <h1 className="text-base font-semibold text-foreground mb-2">Prospects</h1>
          <p className="text-sm text-muted-foreground">Team pipeline • {prospects.length} companies</p>
        </div>

        <div className="mb-6 flex items-center gap-4">
          <span className="text-sm font-medium text-foreground">Filter by status:</span>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(statusConfig).map(([key, c]) => (
                <SelectItem key={key} value={key}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            Showing {filteredProspects.length} of {prospects.length}
          </span>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading prospects...</div>
        ) : filteredProspects.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground mb-4">
                {prospects.length === 0
                  ? "No prospects yet. Add companies from Universe or Lists to your pipeline."
                  : "No prospects found with this status"}
              </p>
              <Link to="/universe">
                <Button variant="outline">Go to Universe</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredProspects.map((prospect) => (
              <ProspectCard
                key={prospect.companyId}
                prospect={prospect}
                expandedId={expandedProspect}
                onToggleExpand={setExpandedProspect}
                newNote={newNote}
                setNewNote={setNewNote}
                editingNote={editingNote}
                setEditingNote={setEditingNote}
                editNoteText={editNoteText}
                setEditNoteText={setEditNoteText}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
