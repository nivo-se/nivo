import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen p-8">
      <div className="text-center space-y-6 max-w-md">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-gray-900">404</h1>
          <h2 className="text-2xl font-semibold text-gray-700">Page Not Found</h2>
          <p className="text-gray-500">
            The page you're looking for doesn't exist or may have been moved.
          </p>
        </div>
        
        <Link to="/">
          <Button className="gap-2">
            <Home className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
