import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { SearchX } from "lucide-react";
const NotFoundPage = () => {
  return <MainLayout>
      <div className="flex-1 flex flex-col items-center justify-center p-4 py-24 text-center">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <SearchX className="w-12 h-12 text-gray-400" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">Page Not Found</h2>
        <p className="text-gray-500 max-w-md mb-8">
          The page you are looking for doesn't exist or has been moved. 
          Let's get you back on track to helping animals.
        </p>
        <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
          <Link to="/">Return to Home</Link>
        </Button>
      </div>
    </MainLayout>;
};
var stdin_default = NotFoundPage;
export {
  stdin_default as default
};
