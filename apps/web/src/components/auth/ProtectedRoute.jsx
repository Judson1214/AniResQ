import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { sanitizeReturnTo } from "@/lib/utils";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div 
        className="flex h-screen w-full items-center justify-center bg-[#06090F]" 
        role="status" 
        aria-live="polite"
        aria-label="Loading authentication state"
      >
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-slate-400 text-sm">Verifying clearance credentials...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    const safePath = sanitizeReturnTo(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${encodeURIComponent(safePath)}`} state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

export { ProtectedRoute };
