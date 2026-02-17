import { useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-gray-900 mb-2">404</h1>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Page not found</h2>
        <p className="text-sm text-gray-600 mb-6">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link to="/">
          <Button size="lg">Go to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
