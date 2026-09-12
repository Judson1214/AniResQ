import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRescueRequests } from "@/services/rescue.service";
import { MainLayout } from "@/components/layout/MainLayout";
import { RescueMap } from "@/components/rescue/RescueMap";
import { RescueCard } from "@/components/rescue/RescueCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@aniresq/shared-types";
import { RescueStatus, RescueSeverity } from "@aniresq/shared-types";

function RescueListPage() {
  const { user } = useAuth();
  const isCitizen = user?.role === UserRole.CITIZEN || !user;
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const { data: rescues, isLoading } = useQuery({
    queryKey: ["rescues", statusFilter, severityFilter],
    queryFn: () => getRescueRequests({
      status: statusFilter || void 0,
      severity: severityFilter || void 0
    })
  });

  if (isCitizen) {
    return <Navigate to="/dashboard" replace />;
  }

  return <MainLayout>
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold">Active SOS Alerts</h1>
            <p className="text-gray-600 mt-1">Command Hub for tracking ongoing rescue operations.</p>
          </div>
          <Button asChild size="lg" className="bg-rose-500 hover:bg-rose-600 text-white">
            <Link to="/report-rescue">Report a Rescue</Link>
          </Button>
        </div>

        <Tabs defaultValue="list" className="w-full">
          <div className="flex justify-between items-center mb-6">
            <TabsList>
              <TabsTrigger value="list">List View</TabsTrigger>
              <TabsTrigger value="map">Map View</TabsTrigger>
            </TabsList>
            
            <div className="flex gap-2">
              <select
    className="border rounded-md px-3 py-1 text-sm"
    value={statusFilter}
    onChange={(e) => setStatusFilter(e.target.value)}
  >
                <option value="">All Statuses</option>
                {Object.values(RescueStatus).map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
              
              <select
    className="border rounded-md px-3 py-1 text-sm"
    value={severityFilter}
    onChange={(e) => setSeverityFilter(e.target.value)}
  >
                <option value="">All Severities</option>
                {Object.values(RescueSeverity).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <TabsContent value="list" className="mt-0">
            {isLoading ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-48 bg-gray-100 animate-pulse rounded-lg" />)}
              </div> : rescues?.length === 0 ? <div className="text-center py-20 bg-gray-50 rounded-lg border border-dashed">
                <h3 className="text-lg font-medium text-gray-900">No rescues found</h3>
                <p className="text-gray-500 mt-1">Try adjusting your filters or report a new rescue.</p>
              </div> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rescues?.map((rescue) => <RescueCard key={rescue.id} rescue={rescue} />)}
              </div>}
          </TabsContent>

          <TabsContent value="map" className="mt-0 h-[600px] border rounded-lg">
            <RescueMap rescues={rescues || []} />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>;
}
export {
  RescueListPage as default
};
