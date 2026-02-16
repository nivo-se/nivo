import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Loader2, Users, CheckCircle, XCircle, Clock, Shield, Mail, Calendar, Database, BarChart3, Globe, TrendingUp, Eye, Info, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { supabaseDataService } from '../lib/supabaseDataService';
import { createUser, type UserRole } from '../lib/services/adminService';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface User {
  id: string;
  user_id: string;
  email: string;
  role: 'admin' | 'approved' | 'pending';
  created_at: string;
  updated_at: string;
  approved_by: string | null;
  approved_at: string | null;
}

interface SystemMetrics {
  totalUsers: number;
  pendingUsers: number;
  approvedUsers: number;
  adminUsers: number;
  databaseConnected: boolean;
}

interface AdminPanelProps {
  currentUser: any;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addRole, setAddRole] = useState<UserRole>('approved');
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Fetch all users
  const fetchUsers = async () => {
    try {
      setLoading(true);

      if (!supabase) {
        setError('Supabase is not configured (auth disabled or paused). User management unavailable.');
        if (currentUser?.email === 'jesper@rgcapital.se') {
          setUsers([{
            id: 'fallback-admin',
            user_id: currentUser.id,
            role: 'admin' as const,
            email: currentUser.email,
            approved_by: 'system',
            approved_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]);
        } else {
          setUsers([]);
        }
        return;
      }

      // Get user roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false });

      if (rolesError) {
        throw rolesError;
      }
      
      // Try to get user emails, but fallback to user ID if not possible
      console.log('Processing', userRoles?.length || 0, 'users...');
      const usersWithEmails = userRoles?.map(userRole => {
        // For now, we'll use a more user-friendly display
        // In a real implementation, you'd need proper admin permissions to fetch emails
        const userIdShort = userRole.user_id.slice(0, 8);
        return {
          ...userRole,
          email: `user-${userIdShort}@nivo.local` // More readable format
        };
      }) || [];
      
      console.log('Processed users:', usersWithEmails.map(u => u.email));
      
      setUsers(usersWithEmails);
    } catch (err: any) {
      setError(err.message);
      
      // Fallback: If we can't fetch from database, show current user as admin
      if (currentUser?.email === 'jesper@rgcapital.se') {
        setUsers([{
          id: 'fallback-admin',
          user_id: currentUser.id,
          role: 'admin' as const,
          email: currentUser.email,
          approved_by: 'system',
          approved_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch system metrics
  const fetchSystemMetrics = async () => {
    try {
      // Count users by role
      const pendingUsers = users.filter(user => user.role === 'pending').length;
      const approvedUsers = users.filter(user => user.role === 'approved').length;
      const adminUsers = users.filter(user => user.role === 'admin').length;
      
      setSystemMetrics({
        totalUsers: users.length,
        pendingUsers,
        approvedUsers,
        adminUsers,
        databaseConnected: true
      });
    } catch (error) {
      console.error('Error fetching system metrics:', error);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Update system metrics when users change
  useEffect(() => {
    if (users.length > 0) {
      fetchSystemMetrics();
    }
  }, [users]);

  // Approve user
  const approveUser = async (userId: string) => {
    if (!supabase) {
      setError('Supabase not configured');
      return;
    }
    try {
      setActionLoading(userId);
      const { error } = await supabase
        .from('user_roles')
        .update({
          role: 'approved',
          approved_by: currentUser.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;
      
      setSuccess('User approved successfully!');
      await fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Reject user
  const rejectUser = async (userId: string) => {
    if (!supabase) {
      setError('Supabase not configured');
      return;
    }
    try {
      setActionLoading(userId);
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', userId);

      if (error) throw error;
      
      setSuccess('User rejected and removed!');
      await fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Make user admin
  const makeAdmin = async (userId: string) => {
    if (!supabase) {
      setError('Supabase not configured');
      return;
    }
    try {
      setActionLoading(userId);
      const { error } = await supabase
        .from('user_roles')
        .update({
          role: 'admin',
          approved_by: currentUser.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;
      
      setSuccess('User promoted to admin!');
      await fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="default" className="bg-red-500"><Shield className="w-3 h-3 mr-1" />Admin</Badge>;
      case 'approved':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleUserClick = (user: User) => {
    setSelectedUser(user);
    setIsUserDialogOpen(true);
  };

  const handleAddUser = async () => {
    if (!addEmail.trim() || !addPassword) {
      setAddError('Email and password are required');
      return;
    }
    if (addPassword.length < 8) {
      setAddError('Password must be at least 8 characters');
      return;
    }
    setAddError(null);
    setAddSubmitting(true);
    try {
      await createUser(addEmail.trim(), addPassword, addRole);
      setSuccess('User created!');
      setIsAddUserDialogOpen(false);
      setAddEmail('');
      setAddPassword('');
      setAddRole('approved');
      await fetchUsers();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Could not create user');
    } finally {
      setAddSubmitting(false);
    }
  };

  const pendingUsers = users.filter(user => user.role === 'pending');
  const approvedUsers = users.filter(user => user.role === 'approved');
  const adminUsers = users.filter(user => user.role === 'admin');

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading users and fetching emails...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User administration</h2>
          <p className="text-gray-600">Manage user access and permissions</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsAddUserDialogOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Add user
          </Button>
          <Button onClick={fetchUsers} variant="outline">
            <Users className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Alerts */}
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

      {/* System metrics - stacked rows */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total users</span>
          <span className="font-medium">{systemMetrics?.totalUsers || 0}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Pending</span>
          <span className="font-medium">{systemMetrics?.pendingUsers || 0}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Approved</span>
          <span className="font-medium">{systemMetrics?.approvedUsers || 0}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Administrators</span>
          <span className="font-medium">{systemMetrics?.adminUsers || 0}</span>
        </div>
        <div className="flex justify-between text-sm pt-2 border-t">
          <span className="text-muted-foreground">Database</span>
          <Badge variant="default" className={systemMetrics?.databaseConnected ? "bg-green-500" : "bg-red-500"}>
            {systemMetrics?.databaseConnected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
      </div>

      {/* Pending Users */}
      {pendingUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="w-5 h-5 mr-2 text-orange-500" />
              Pending approval ({pendingUsers.length})
            </CardTitle>
            <CardDescription>
              New users waiting for your approval to access the platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-4 flex-1 cursor-pointer" onClick={() => handleUserClick(user)}>
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <Mail className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium">{user.email}</p>
                      <p className="text-sm text-gray-500">
                        Registered: {formatDate(user.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getRoleBadge(user.role)}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUserClick(user)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View details
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => approveUser(user.id)}
                      disabled={actionLoading === user.id}
                    >
                      {actionLoading === user.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => rejectUser(user.id)}
                      disabled={actionLoading === user.id}
                    >
                      {actionLoading === user.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            All users ({users.length})
          </CardTitle>
          <CardDescription>
            Complete list of all users in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-center space-x-4 flex-1 cursor-pointer" onClick={() => handleUserClick(user)}>
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <Mail className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium">{user.email}</p>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <span>Joined: {formatDate(user.created_at)}</span>
                      {user.approved_at && (
                        <>
                          <span>•</span>
                          <span>Approved: {formatDate(user.approved_at)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getRoleBadge(user.role)}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUserClick(user)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View details
                    </Button>
                    {user.role === 'approved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => makeAdmin(user.id)}
                        disabled={actionLoading === user.id}
                      >
                        {actionLoading === user.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Shield className="w-4 h-4 mr-1" />
                            Make admin
                          </>
                        )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* User Details Dialog */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Info className="h-5 w-5 mr-2" />
              User details
            </DialogTitle>
            <DialogDescription>
              Detailed information about the selected user
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-6">
              {/* User Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-lg font-semibold">{selectedUser.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Roll</label>
                  <div className="mt-1">
                    {getRoleBadge(selectedUser.role)}
                  </div>
                </div>
              </div>

              {/* User ID */}
              <div>
                  <label className="text-sm font-medium text-gray-500">User ID</label>
                <p className="text-sm font-mono bg-gray-100 p-2 rounded">{selectedUser.user_id}</p>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Joined date</label>
                  <p className="text-sm">{formatDate(selectedUser.created_at)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Last updated</label>
                  <p className="text-sm">{formatDate(selectedUser.updated_at)}</p>
                </div>
              </div>

              {/* Approval Info */}
              {selectedUser.approved_at && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Approved date</label>
                    <p className="text-sm">{formatDate(selectedUser.approved_at)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Approved by</label>
                    <p className="text-sm">{selectedUser.approved_by || 'System'}</p>
                  </div>
                </div>
              )}

              {/* Status Summary */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Status summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span>Account status:</span>
                    <span className="font-medium">
                      {selectedUser.role === 'pending' ? 'Pending approval' : 
                       selectedUser.role === 'approved' ? 'Active' : 'Administrator'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Access level:</span>
                    <span className="font-medium capitalize">{selectedUser.role}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog open={isAddUserDialogOpen} onOpenChange={(open) => {
        setIsAddUserDialogOpen(open);
        if (!open) {
          setAddEmail('');
          setAddPassword('');
          setAddRole('approved');
          setAddError(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <UserPlus className="h-5 w-5 mr-2" />
              Add user
            </DialogTitle>
            <DialogDescription>
              Create a new user with email, password and role
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {addError && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{addError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="add-email">Email</Label>
              <Input
                id="add-email"
                type="email"
                placeholder="name@example.com"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                disabled={addSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-password">Password</Label>
              <Input
                id="add-password"
                type="password"
                placeholder="At least 8 characters"
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
                disabled={addSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-role">Role</Label>
              <Select value={addRole} onValueChange={(v) => setAddRole(v as UserRole)} disabled={addSubmitting}>
                <SelectTrigger id="add-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsAddUserDialogOpen(false)} disabled={addSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleAddUser} disabled={addSubmitting}>
                {addSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create user'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPanel;
