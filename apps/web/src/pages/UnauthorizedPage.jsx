import { ShieldAlert, ArrowLeft, Home } from "lucide-react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";

export default function UnauthorizedPage() {
  return (
    <MainLayout>
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
        <div className="rounded-full bg-red-100 p-4 text-red-600 mb-6">
          <ShieldAlert className="h-12 w-12" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Access Restricted
        </h1>
        <p className="mt-4 max-w-md text-base text-gray-600">
          You do not have the necessary role permissions to access this page. If you believe this is an error, please contact an administrator or organization manager.
        </p>
        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <ArrowLeft className="h-4 w-4" />
            Go to Dashboard
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <Home className="h-4 w-4" />
            Return Home
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}
