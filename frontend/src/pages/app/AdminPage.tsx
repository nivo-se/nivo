import AdminPanel from "@/components/AdminPanel";
import { useAuth } from "@/contexts/AuthContext";

export function AdminPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-4">Admin</h1>
      <AdminPanel currentUser={user} />
    </div>
  );
}
