import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Loader2, Users, Shield, Mail, Eye, Info, UserPlus, XCircle, CheckCircle } from 'lucide-react';
import {
  getAdminUsers,
  setUserRole,
  setUserAllow,
  type UserRole,
  type AdminUsersResponse,
} from '../lib/services/adminService';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

/** Merged row: sub + role (from user_roles) + allowed (from allowed_users). */
interface UserRow {
  sub: string;
  role: string;
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
        created_at: a.created_at,
        updated_at: a.updated_at,
        enabled: a.enabled,
        note: a.note,
      });
    }
  }
  return Array.from(bySub.values()).sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
}

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<UserRow[]>([]);
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
      setUsers([]);
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
          <Button variant="outline" onClick={() => setIsAddDialogOpen(true)}>
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
                <div className="flex items-center space-x-4 flex-1 cursor-pointer" onClick={() => handleUserClick(user)}>
                  <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                    <Mail className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-mono text-sm font-medium">{user.sub}</p>
                    <p className="text-xs text-muted-foreground">
                      Updated: {formatDate(user.updated_at)}
                      {user.note ? ` · ${user.note}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
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

      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="max-w-lg bg-card text-foreground border-border shadow-xl">
          <DialogHeader>
            <DialogTitle>User details</DialogTitle>
            <DialogDescription>Role and allowlist for this user</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
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
            <DialogTitle>Add user by sub</DialogTitle>
            <DialogDescription>
              Enter the Auth0 sub (e.g. from GET /api/me or Auth0 logs). They will get the chosen role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {addError && (
              <Alert variant="destructive">
                <AlertDescription>{addError}</AlertDescription>
              </Alert>
            )}
            <div>
              <Label htmlFor="add-sub">Sub</Label>
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
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPanel;
