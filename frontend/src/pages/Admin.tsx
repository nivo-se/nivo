import React from 'react';
import AdminPanel from '../components/AdminPanel';
import { useAuth } from '../contexts/AuthContext';
import { isAdminLinkVisible } from '../lib/isAdmin';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Shield, AlertTriangle } from 'lucide-react';

const Admin: React.FC = () => {
  const { user, userRole } = useAuth();

  const isAdmin = isAdminLinkVisible(userRole, user?.email, !!user);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-muted/40 flex items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Access denied. You need administrator privileges to view this page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <AdminPanel currentUser={user} />
    </div>
  );
};

export default Admin;
