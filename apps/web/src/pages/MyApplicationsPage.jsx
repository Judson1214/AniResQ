import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getApplicationsByApplicant } from "@/services/adoption.service";
import { getAnimalById } from "@/services/animal.service";
import { useAuth } from "@/hooks/useAuth";
import { ApplicationCard } from "@/components/adoption/ApplicationCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MainLayout } from "@/components/layout/MainLayout";
function MyApplicationsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("ALL");
  const { data: applications, isLoading } = useQuery({
    queryKey: ["my-applications", user?.uid],
    queryFn: () => getApplicationsByApplicant(user.uid),
    enabled: !!user?.uid
  });
  const { data: animals } = useQuery({
    queryKey: ["application-animals", applications?.map((a) => a.animalId)],
    queryFn: async () => {
      if (!applications) return {};
      const animalMap = {};
      for (const app of applications) {
        if (!animalMap[app.animalId]) {
          const animal = await getAnimalById(app.animalId);
          animalMap[app.animalId] = animal;
        }
      }
      return animalMap;
    },
    enabled: !!applications && applications.length > 0
  });
  if (!user) return <MainLayout><div className="p-8">Please login</div></MainLayout>;
  const filteredApps = applications?.filter((app) => activeTab === "ALL" || app.status === activeTab) || [];
  return <MainLayout>
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">My Adoption Applications</h1>
        
        <Tabs defaultValue="ALL" onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="ALL">All</TabsTrigger>
            <TabsTrigger value="SUBMITTED">Submitted</TabsTrigger>
            <TabsTrigger value="UNDER_REVIEW">Under Review</TabsTrigger>
            <TabsTrigger value="APPROVED">Approved</TabsTrigger>
            <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-0">
            {isLoading ? <div className="space-y-4">
                {[1, 2].map((i) => <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-lg" />)}
              </div> : filteredApps.length === 0 ? <div className="text-center py-16 bg-gray-50 rounded-lg border border-dashed">
                <p className="text-gray-500">No applications found in this category.</p>
              </div> : <div className="space-y-4">
                {filteredApps.map((app) => <ApplicationCard
    key={app.id}
    application={app}
    animal={animals?.[app.animalId]}
  />)}
              </div>}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>;
}
export {
  MyApplicationsPage as default
};
