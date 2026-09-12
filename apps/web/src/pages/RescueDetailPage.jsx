import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getRescueRequestById, assignVolunteer, updateRescueStatus } from "@/services/rescue.service";
import { MainLayout } from "@/components/layout/MainLayout";
import { RescueMap } from "@/components/rescue/RescueMap";
import { RescueStatusBadge } from "@/components/rescue/RescueStatusBadge";
import { RescueTimeline } from "@/components/rescue/RescueTimeline";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";
import { RescueStatus, UserRole } from "@aniresq/shared-types";
import { PawPrint, MapPin } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
function RescueDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: rescue, isLoading, refetch } = useQuery({
    queryKey: ["rescue", id],
    queryFn: () => getRescueRequestById(id),
    enabled: !!id
  });
  const handleAcceptRescue = async () => {
    if (!user || !id) return;
    try {
      await assignVolunteer(id, user.uid, user.displayName || "Volunteer");
      toast({ title: "Assigned", description: "You have been assigned to this rescue." });
      refetch();
    } catch (error) {
      toast({ title: "Error", description: "Failed to assign rescue", variant: "destructive" });
    }
  };
  const handleUpdateStatus = async (newStatus) => {
    if (!user || !id) return;
    try {
      await updateRescueStatus(
        id,
        newStatus,
        `Status updated to ${newStatus}`,
        user.uid,
        user.displayName || "User"
      );
      toast({ title: "Status Updated" });
      refetch();
    } catch (error) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };
  if (isLoading) return <MainLayout><div className="p-8 text-center">Loading...</div></MainLayout>;
  if (!rescue) return <MainLayout><div className="p-8 text-center">Rescue not found</div></MainLayout>;
  const canAccept = user?.role === UserRole.VOLUNTEER && rescue.status === RescueStatus.PENDING;
  const isAssigned = rescue.assignedTo === user?.uid;
  return <MainLayout>
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h1 className="text-2xl font-bold mb-2">{rescue.title}</h1>
                  <div className="flex items-center gap-4 text-gray-500 text-sm">
                    <span className="flex items-center gap-1"><PawPrint size={16} /> {rescue.species}</span>
                    <span>Reported {formatRelativeTime(rescue.createdAt)}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <RescueStatusBadge status={rescue.status} />
                  <span className={`px-2 py-1 rounded text-xs font-semibold
                    ${rescue.severity === "CRITICAL" ? "bg-red-100 text-red-800" : rescue.severity === "HIGH" ? "bg-orange-100 text-orange-800" : "bg-gray-100"}`}>
                    {rescue.severity} SEVERITY
                  </span>
                </div>
              </div>
              
              <div className="mt-6 prose max-w-none">
                <p>{rescue.description}</p>
              </div>

              {rescue.photoUrls && rescue.photoUrls.length > 0 && <div className="mt-8">
                  <h3 className="font-semibold mb-4">Photos</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {rescue.photoUrls.map((photo, i) => <img key={i} src={photo} alt={`Rescue ${i}`} className="rounded-lg object-cover w-full h-48" />)}
                  </div>
                </div>}
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-xl font-semibold mb-6">Rescue Timeline</h3>
              <RescueTimeline requestId={rescue.id} />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="h-64 relative z-0">
                <RescueMap singleRescue={rescue} />
              </div>
              <div className="p-4 border-t">
                <h4 className="font-semibold text-sm mb-1 flex items-center gap-2">
                  <MapPin size={16} /> Location Details
                </h4>
                <p className="text-sm text-gray-600">{rescue.address}</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="font-semibold mb-4">Actions</h3>
              
              {canAccept ? <Button className="w-full" onClick={handleAcceptRescue}>
                  Accept Rescue Mission
                </Button> : isAssigned ? <div className="space-y-3">
                  <p className="text-sm font-medium text-green-600 mb-2">You are assigned to this rescue</p>
                  
                  {rescue.status === RescueStatus.DISPATCHED && <Button className="w-full" onClick={() => handleUpdateStatus(RescueStatus.IN_PROGRESS)}>
                      Mark In Progress
                    </Button>}
                  {rescue.status === RescueStatus.IN_PROGRESS && <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => handleUpdateStatus(RescueStatus.RESOLVED)}>
                      Mark Resolved
                    </Button>}
                </div> : <p className="text-sm text-gray-500">No actions available.</p>}
            </div>
          </div>

        </div>
      </div>
    </MainLayout>;
}
export {
  RescueDetailPage as default
};
