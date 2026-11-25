import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getRescueRequestById, assignVolunteer, updateRescueStatus, getRescueTimeline } from "@/services/rescue.service";
import { MainLayout } from "@/components/layout/MainLayout";
import { RescueMap } from "@/components/rescue/RescueMap";
import { RescueStatusBadge } from "@/components/rescue/RescueStatusBadge";
import { RescueTimeline } from "@/components/rescue/RescueTimeline";
import { RescueIncidentReport } from "@/components/rescue/RescueIncidentReport";
import { RescueVerificationModal } from "@/components/rescue/RescueVerificationModal";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";
import { RescueStatus, UserRole } from "@aniresq/shared-types";
import { PawPrint, MapPin, FileText, CheckCircle2, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

function RescueDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showReport, setShowReport] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  const { data: rescue, isLoading, refetch } = useQuery({
    queryKey: ["rescue", id],
    queryFn: () => getRescueRequestById(id),
    enabled: !!id
  });

  const { data: timelineData, refetch: refetchTimeline } = useQuery({
    queryKey: ["rescue-timeline-report", id],
    queryFn: () => getRescueTimeline(id),
    enabled: !!id
  });

  const handleAcceptRescue = async () => {
    if (!user || !id) return;
    try {
      await assignVolunteer(id, user.uid, user.displayName || "Volunteer");
      toast({ title: "Assigned", description: "You have been assigned to this rescue." });
      refetch();
      refetchTimeline();
    } catch (error) {
      toast({ title: "Error", description: error?.response?.data?.detail || "Failed to assign rescue", variant: "destructive" });
    }
  };

  const handleUpdateStatus = async (newStatus, customMessage = null, verificationPhotos = []) => {
    if (!user || !id) return;
    try {
      await updateRescueStatus(
        id,
        newStatus,
        customMessage || `Status updated to ${newStatus}`,
        user.uid,
        user.displayName || "User",
        verificationPhotos
      );
      toast({ 
        title: newStatus === RescueStatus.RESOLVED ? "Rescue Mission Verified & Resolved!" : "Status Updated",
        description: newStatus === RescueStatus.RESOLVED ? "Verification proof recorded and case successfully resolved." : undefined
      });
      refetch();
      refetchTimeline();
    } catch (error) {
      toast({ title: "Error", description: error?.response?.data?.detail || "Failed to update status", variant: "destructive" });
    }
  };

  const handleConfirmResolve = async ({ notes, verificationPhotos }) => {
    try {
      setIsResolving(true);
      await handleUpdateStatus(RescueStatus.RESOLVED, notes, verificationPhotos);
      setShowResolveModal(false);
    } finally {
      setIsResolving(false);
    }
  };

  if (isLoading) return <MainLayout><div className="p-8 text-center text-slate-400">Loading rescue details...</div></MainLayout>;
  if (!rescue) return <MainLayout><div className="p-8 text-center text-slate-400">Rescue not found</div></MainLayout>;

  const isResponder = [UserRole.VOLUNTEER, UserRole.SHELTER, UserRole.NGO, UserRole.VET, UserRole.ADMIN].includes(user?.role);
  const canAccept = isResponder && rescue.status === RescueStatus.PENDING;
  const isAssigned = rescue.assignedTo === user?.uid || user?.role === UserRole.ADMIN;

  return (
    <MainLayout>
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        
        {/* Top Header Navigation & Incident Report Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono px-3 py-1 bg-slate-800 text-slate-300 rounded-lg border border-slate-700">
              CASE #{rescue.id.slice(0, 8).toUpperCase()}
            </span>
            <RescueStatusBadge status={rescue.status} />
          </div>

          <Button
            onClick={() => setShowReport(true)}
            className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl flex items-center gap-2 self-start sm:self-auto text-sm font-semibold h-10 px-4"
          >
            <FileText size={16} /> Generate SOS Incident Report
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-[#0B132B]/80 rounded-3xl shadow-xl border border-slate-800 p-6 sm:p-8 backdrop-blur-sm">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">{rescue.title}</h1>
                  <div className="flex items-center gap-4 text-slate-400 text-sm">
                    <span className="flex items-center gap-1.5"><PawPrint size={16} className="text-emerald-400" /> {rescue.species}</span>
                    <span>Reported {formatRelativeTime(rescue.createdAt)}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                    ${rescue.severity === "CRITICAL" ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : 
                      rescue.severity === "HIGH" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : 
                      "bg-blue-500/20 text-blue-400 border border-blue-500/30"}`}>
                    {rescue.severity} SEVERITY
                  </span>
                </div>
              </div>
              
              <div className="mt-6 text-slate-300 text-sm sm:text-base leading-relaxed bg-slate-900/50 p-5 rounded-2xl border border-slate-800/80">
                <p>{rescue.description}</p>
              </div>

              {rescue.photoUrls && rescue.photoUrls.length > 0 && (
                <div className="mt-8">
                  <h3 className="font-bold text-white text-base mb-4 flex items-center gap-2">
                    Evidence & Verification Photos ({rescue.photoUrls.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {rescue.photoUrls.map((photo, i) => (
                      <div key={i} className="group relative rounded-2xl overflow-hidden border border-slate-800 bg-black aspect-video">
                        <img 
                          src={photo} 
                          alt={`Rescue evidence ${i + 1}`} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                        />
                        <div className="absolute bottom-0 inset-x-0 bg-black/70 px-2 py-1 text-[10px] text-slate-300 font-mono">
                          {i === 0 ? "Initial Alert Photo" : `Verification Proof #${i}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-[#0B132B]/80 rounded-3xl shadow-xl border border-slate-800 p-6 sm:p-8">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <ShieldCheck className="text-emerald-400" /> Response Audit Timeline
              </h3>
              <RescueTimeline requestId={rescue.id} />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-[#0B132B]/80 rounded-3xl shadow-xl border border-slate-800 overflow-hidden">
              <div className="h-64 relative z-0">
                <RescueMap singleRescue={rescue} />
              </div>
              <div className="p-5 border-t border-slate-800">
                <h4 className="font-bold text-sm text-white mb-1.5 flex items-center gap-2">
                  <MapPin size={16} className="text-emerald-400" /> Location Details
                </h4>
                <p className="text-sm text-slate-400">{rescue.address || "Coordinates recorded on map"}</p>
                <div className="mt-2 text-xs font-mono text-slate-500">
                  Lat: {rescue.location?.latitude?.toFixed(4)}, Lon: {rescue.location?.longitude?.toFixed(4)}
                </div>
              </div>
            </div>

            <div className="bg-[#0B132B]/80 rounded-3xl shadow-xl border border-slate-800 p-6 space-y-4">
              <h3 className="font-bold text-white text-base">Mission Command</h3>
              
              {canAccept ? (
                <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12 rounded-xl" onClick={handleAcceptRescue}>
                  Dispatch Unit / Accept Mission
                </Button>
              ) : isAssigned ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    <span>You are assigned to this rescue mission</span>
                  </div>
                  
                  {rescue.status === RescueStatus.DISPATCHED && (
                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold h-11 rounded-xl" 
                      onClick={() => handleUpdateStatus(RescueStatus.IN_PROGRESS, "Unit arrived on scene and initiated care.")}
                    >
                      Mark In Progress (On-Scene)
                    </Button>
                  )}

                  {rescue.status === RescueStatus.IN_PROGRESS && (
                    <Button 
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-11 rounded-xl flex items-center justify-center gap-2" 
                      onClick={() => setShowResolveModal(true)}
                    >
                      <CheckCircle2 size={16} /> Mark Resolved with Verification Photo
                    </Button>
                  )}

                  {rescue.status === RescueStatus.RESOLVED && (
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                      <CheckCircle2 size={28} className="text-emerald-400 mx-auto mb-2" />
                      <div className="text-sm font-bold text-white">Mission Accomplished</div>
                      <p className="text-xs text-slate-400 mt-1">This animal has been safely rescued and verified.</p>
                      <Button
                        size="sm"
                        onClick={() => setShowReport(true)}
                        className="mt-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl"
                      >
                        View Official Report
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  {rescue.status === RescueStatus.RESOLVED ? "This emergency rescue is resolved." : "Awaiting response assignment."}
                </p>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Incident Case Report Modal */}
      {showReport && (
        <RescueIncidentReport
          rescue={rescue}
          timeline={timelineData || []}
          onClose={() => setShowReport(false)}
        />
      )}

      {/* Verification Photo & Resolution Modal */}
      {showResolveModal && (
        <RescueVerificationModal
          isOpen={showResolveModal}
          onClose={() => setShowResolveModal(false)}
          onConfirm={handleConfirmResolve}
          isSubmitting={isResolving}
        />
      )}
    </MainLayout>
  );
}

export default RescueDetailPage;
