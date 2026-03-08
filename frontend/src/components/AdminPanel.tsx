import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Loader2, Users, Shield, Eye, UserPlus, XCircle, CheckCircle, Clock } from 'lucide-react';
import {
  getAdminUsers,
  setUserRole,
  setUserAllow,
  type UserRole,
  type AdminUsersResponse,
  type PendingUserRow,
} from '../lib/services/adminService';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

/** Merged row: sub + role (from user_roles) + allowed (from allowed_users) + profile email/name. */
interface UserRow {
  sub: string;
  role: string;
  email: string | null;
  name: string | null;
  created_at: string;
  updated_at: string;
  enabled: boolean;
  note: string | null;
}

interface AdminPanelProps {
  currentUser: { id: string; email?: string | null } | null;
}

function mergeAdminUsers(data: AdminUsersResponse): UserRow[] {
  const bySub = new Map<string, UserRow>();
  for (const r of data.user_roles) {
    bySub.set(r.sub, {
      sub: r.sub,
      role: r.role,
      email: r.email ?? null,
      name: r.name ?? null,
      created_at: r.created_at,
      updated_at: r.updated_at,
      enabled: true,
      note: null,
    });
  }
  for (const a of data.allowed_users) {
    const row = bySub.get(a.sub);
    if (row) {
      row.enabled = a.enabled;
      row.note = a.note;
    } else {
      bySub.set(a.sub, {
        sub: a.sub,
        role: '',
        email: null,
        name: null,
        created_at: a.created_at,
        updated_at: a.updated_at,
        enabled: a.enabled,
        note: a.note,
      });
    }
  }
  return Array.from(bySub.values()).sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
}

/** Generate initials from email or name for the avatar. */
function getInitials(email: string | null, name: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return '?';
}

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addSub, setAddSub] = useState('');
  const [addRole, setAddRole] = useState<UserRole>('analyst');
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('analyst');
  const [editEnabled, setEditEnabled] = useState(true);
  const [editNote, setEditNote] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminUsers();
      setUsers(mergeAdminUsers(data));
      setPendingUsers(data.pending_users ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
      setUsers([]);
      setPendingUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="destructive"><Shield className="w-3 h-3 mr-1" />Admin</Badge>;
      case 'analyst':
        return <Badge variant="secondary"><CheckCircle className="w-3 h-3 mr-1" />Analyst</Badge>;
      default:
        return <Badge variant="outline">No role</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSetRole = async (sub: string, role: UserRole) => {
    try {
      setActionLoading(sub);
      setError(null);
      await setUserRole(sub, role);
      setSuccess(`Role set to ${role}`);
      await fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to set role');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetAllow = async (sub: string, enabled: boolean, note: string | null) => {
    try {
      setActionLoading(sub);
      setError(null);
      await setUserAllow(sub, enabled, note || undefined);
      setSuccess(enabled ? 'User allowed' : 'User disabled');
      await fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update allowlist');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUserClick = (user: UserRow) => {
    setSelectedUser(user);
    setEditRole((user.role === 'admin' ? 'admin' : 'analyst') as UserRole);
    setEditEnabled(user.enabled);
    setEditNote(user.note ?? '');
    setIsUserDialogOpen(true);
  };

  /** Open the grant-access dialog pre-filled from a pending user row. */
  const handleGrantAccess = (pending: PendingUserRow) => {
    setAddSub(pending.sub);
    setAddRole('analyst');
    setAddError(null);
    setIsAddDialogOpen(true);
  };

  const handleAddBySub = async () => {
    const sub = addSub.trim();
    if (!sub) {
      setAddError('Sub is required.');
      return;
    }
    if (!sub.includes('|')) {
      setAddError('Sub should look like an Auth0 sub (e.g. auth0|xxxxxxxx).');
      return;
    }
    setAddError(null);
    setAddSubmitting(true);
    try {
      await setUserRole(sub, addRole);
      setSuccess(`Added ${sub} as ${addRole}`);
      setIsAddDialogOpen(false);
      setAddSub('');
      setAddRole('analyst');
      await fetchUsers();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Failed to add user');
    } finally {
      setAddSubmitting(false);
    }
  };

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const analystCount = users.filter((u) => u.role === 'analyst').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading users...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">User administration</h2>
          <p className="text-sm text-muted-foreground">Roles and allowlist by Auth0 sub (local Postgres)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setAddSub(''); setAddRole('analyst'); setAddError(null); setIsAddDialogOpen(true); }}>
            <UserPlus className="w-4 h-4 mr-2" />
            Add by sub
          </Button>
          <Button onClick={fetchUsers} variant="outline">
            <Users className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-foreground">Total</span>
          <span className="font-medium">{users.length}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-foreground">Admins</span>
          <span className="font-medium">{adminCount}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-foreground">Analysts</span>
          <span className="font-medium">{analystCount}</span>
        </div>
      </div>

      {/* Active users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Users ({users.length})
          </CardTitle>
          <CardDescription>
            Set role (admin/analyst) and allowlist. Identity is Auth0 sub.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <div
                key={user.sub}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center space-x-4 flex-1 cursor-pointer min-w-0" onClick={() => handleUserClick(user)}>
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold text-primary">
                    {getInitials(user.email, user.name)}
                  </div>
                  <div className="min-w-0">
                    {user.email ? (
                      <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No email on file</p>
                    )}
                    {user.name && (
                      <p className="text-xs text-muted-foreground truncate">{user.name}</p>
                    )}
                    <p className="font-mono text-xs text-muted-foreground truncate">{user.sub}</p>
                    <p className="text-xs text-muted-foreground">
                      Updated: {formatDate(user.updated_at)}
                      {user.note ? ` · ${user.note}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap flex-shrink-0 ml-4">
                  {getRoleBadge(user.role)}
                  {!user.enabled && (
                    <Badge variant="outline">Disabled</Badge>
                  )}
                  <Button size="sm" variant="outline" onClick={() => handleUserClick(user)}>
                    <Eye className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  {user.role !== 'admin' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSetRole(user.sub, 'admin')}
                      disabled={actionLoading === user.sub}
                    >
                      {actionLoading === user.sub ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4 mr-1" />}
                      Make admin
                    </Button>
                  )}
                  {user.role === 'admin' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSetRole(user.sub, 'analyst')}
                      disabled={actionLoading === user.sub}
                    >
                      {actionLoading === user.sub ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Demote to analyst
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pending users */}
      {pendingUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              Pending approval ({pendingUsers.length})
            </CardTitle>
            <CardDescription>
              These users have logged in but have not been assigned a role yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingUsers.map((pending) => (
                <div
                  key={pending.sub}
                  className="flex items-center justify-between p-4 border rounded-lg bg-muted/20"
                >
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold text-muted-foreground">
                      {getInitials(pending.email, pending.name)}
                    </div>
                    <div className="min-w-0">
                      {pending.email ? (
                        <p className="text-sm font-medium text-foreground truncate">{pending.email}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No email on file</p>
                      )}
                      {pending.name && (
                        <p className="text-xs text-muted-foreground truncate">{pending.name}</p>
                      )}
                      <p className="font-mono text-xs text-muted-foreground truncate">{pending.sub}</p>
                      <p className="text-xs text-muted-foreground">
                        First seen: {formatDate(pending.first_seen)} · Last seen: {formatDate(pending.last_seen)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    <Button
                      size="sm"
                      onClick={() => handleGrantAccess(pending)}
                      disabled={actionLoading === pending.sub}
                    >
                      {actionLoading === pending.sub ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <UserPlus className="w-4 h-4 mr-1" />
                      )}
                      Grant access
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* User detail / edit dialog */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="max-w-lg bg-card text-foreground border-border shadow-xl">
          <DialogHeader>
            <DialogTitle>User details</DialogTitle>
            <DialogDescription>Role and allowlist for this user</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              {selectedUser.email && (
                <div>
                  <Label className="text-sm font-medium">Email</Label>
                  <p className="text-sm mt-1">{selectedUser.email}</p>
                </div>
              )}
              {selectedUser.name && (
                <div>
                  <Label className="text-sm font-medium">Name</Label>
                  <p className="text-sm mt-1">{selectedUser.name}</p>
                </div>
              )}
              <div>
                <Label className="text-sm font-medium">Sub</Label>
                <p className="font-mono text-sm bg-muted p-2 rounded mt-1">{selectedUser.sub}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Role</Label>
                <div className="flex gap-2 mt-1">
                  <Select value={editRole} onValueChange={(v) => setEditRole(v as UserRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="analyst">Analyst</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => handleSetRole(selectedUser.sub, editRole)}
                    disabled={actionLoading === selectedUser.sub}
                  >
                    {actionLoading === selectedUser.sub ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save role'}
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Allowlist</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Select value={editEnabled ? 'yes' : 'no'} onValueChange={(v) => setEditEnabled(v === 'yes')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Enabled</SelectItem>
                      <SelectItem value="no">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Note (optional)"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleSetAllow(selectedUser.sub, editEnabled, editNote || null)}
                    disabled={actionLoading === selectedUser.sub}
                  >
                    {actionLoading === selectedUser.sub ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add / grant access dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
        setIsAddDialogOpen(open);
        if (!open) {
          setAddSub('');
          setAddRole('analyst');
          setAddError(null);
        }
      }}>
        <DialogContent className="max-w-md text-foreground">
          <DialogHeader>
            <DialogTitle>Grant access</DialogTitle>
            <DialogDescription>
              Assign a role to this user. Enter their Auth0 sub or use the pre-filled value from the pending list.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {addError && (
              <Alert variant="destructive">
                <AlertDescription>{addError}</AlertDescription>
              </Alert>
            )}
            <div>
              <Label htmlFor="add-sub">Auth0 sub</Label>
              <Input
                id="add-sub"
                placeholder="auth0|xxxxxxxx"
                value={addSub}
                onChange={(e) => setAddSub(e.target.value)}
                disabled={addSubmitting}
                className="font-mono mt-1"
              />
            </div>
            <div>
              <Label htmlFor="add-role">Role</Label>
              <Select value={addRole} onValueChange={(v) => setAddRole(v as UserRole)} disabled={addSubmitting}>
                <SelectTrigger id="add-role" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="analyst">Analyst</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={addSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleAddBySub} disabled={addSubmitting}>
                {addSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Grant access
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPanel;
