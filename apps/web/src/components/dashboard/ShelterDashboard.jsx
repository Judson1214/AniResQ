import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  HeartHandshake, 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Sparkles, 
  CheckSquare, 
  Loader2,
  Dog,
  ExternalLink
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAnimals, claimAnimal, updateAnimal } from "@/services/animal.service";
import { getApplicationsForReview, reviewApplication } from "@/services/adoption.service";
import { ApplicationReview } from "@/components/adoption/ApplicationReview";
import { formatRelativeTime } from "@/lib/utils";

const ShelterDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("intake"); // "intake" | "applications" | "animals"
  const [appFilter, setAppFilter] = useState("ALL");
  const [selectedApp, setSelectedApp] = useState(null);

  // 1. Animals under care of this shelter
  const { data: shelterAnimals, isLoading: loadingShelterAnimals } = useQuery({
    queryKey: ["shelter-animals", user?.uid],
    queryFn: () => getAnimals({ shelterId: user?.uid }),
    enabled: !!user?.uid,
  });

  // 2. Surrendered animals pending intake review (unclaimed or in progress)
  const { data: surrenderList, isLoading: loadingSurrenders } = useQuery({
    queryKey: ["unclaimed-surrenders"],
    queryFn: () => getAnimals({ adoptionStatus: "NOT_READY" }),
  });

  // 3. Adoption applications queue
  const { data: applications, isLoading: loadingApplications } = useQuery({
    queryKey: ["adoption-applications-review"],
    queryFn: () => getApplicationsForReview(),
  });

  // Split surrenders into unclaimed vs claimed by this shelter
  const unclaimedSurrenders = useMemo(() => {
    if (!surrenderList) return [];
    return surrenderList.filter(a => !a.shelterId && a.adoptionStatus === "NOT_READY");
  }, [surrenderList]);

  const intakeQueue = useMemo(() => {
    if (!shelterAnimals) return [];
    return shelterAnimals.filter(a => a.adoptionStatus === "NOT_READY");
  }, [shelterAnimals]);

  const availableAnimals = useMemo(() => {
    if (!shelterAnimals) return [];
    return shelterAnimals.filter(a => a.adoptionStatus === "AVAILABLE");
  }, [shelterAnimals]);

  // Filtered applications
  const filteredApps = useMemo(() => {
    if (!applications) return [];
    if (appFilter === "ALL") return applications;
    return applications.filter(app => app.status === appFilter);
  }, [applications, appFilter]);

  const pendingAppsCount = useMemo(() => {
    if (!applications) return 0;
    return applications.filter(a => a.status === "SUBMITTED" || a.status === "UNDER_REVIEW").length;
  }, [applications]);

  // Mutations
  const claimMutation = useMutation({
    mutationFn: (animalId) => claimAnimal(animalId),
    onSuccess: () => {
      queryClient.invalidateQueries(["unclaimed-surrenders"]);
      queryClient.invalidateQueries(["shelter-animals"]);
      toast({
        title: "Intake Claimed",
        description: "Animal accepted into your shelter for intake and medical evaluation.",
      });
    },
    onError: (err) => {
      toast({
        title: "Claim Failed",
        description: err.response?.data?.detail || err.message || "Failed to claim surrender",
        variant: "destructive",
      });
    },
  });

  const clearForAdoptionMutation = useMutation({
    mutationFn: ({ id }) => updateAnimal(id, { adoptionStatus: "AVAILABLE" }),
    onSuccess: () => {
      queryClient.invalidateQueries(["shelter-animals"]);
      queryClient.invalidateQueries(["unclaimed-surrenders"]);
      toast({
        title: "Cleared for Adoption",
        description: "Animal status moved to Available and is now publicly visible in the adoption directory.",
      });
    },
    onError: (err) => {
      toast({
        title: "Update Failed",
        description: err.response?.data?.detail || err.message || "Failed to update status",
        variant: "destructive",
      });
    },
  });

  const reviewAppMutation = useMutation({
    mutationFn: ({ id, status, notes }) => reviewApplication(id, status, user?.uid, notes),
    onSuccess: () => {
      queryClient.invalidateQueries(["adoption-applications-review"]);
      queryClient.invalidateQueries(["shelter-animals"]);
      setSelectedApp(null);
      toast({
        title: "Decision Recorded",
        description: "Application status updated and applicant has been notified.",
      });
    },
    onError: (err) => {
      toast({
        title: "Review Failed",
        description: err.response?.data?.detail || err.message || "Failed to record decision",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto py-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Building2 className="text-emerald-400" size={32} />
            Shelter Operations & Intake Center
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage surrender intakes, health evaluations, and adoption screening.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/surrender"
            className="px-4 py-2 bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-bold rounded-xl border border-slate-700 transition-colors flex items-center gap-2"
          >
            <Dog size={16} /> Community Surrender Form
          </Link>
          <Link
            to="/animals"
            className="px-4 py-2 bg-emerald-500 text-emerald-950 hover:bg-emerald-400 text-xs font-black rounded-xl transition-colors flex items-center gap-2"
          >
            Adoption Directory <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-800 bg-[#0A0F1C] shadow-lg rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">Animals Under Care</CardTitle>
            <Building2 className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{shelterAnimals?.length ?? 0}</div>
            <p className="text-xs text-slate-500 mt-1">In your facility</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-[#0A0F1C] shadow-lg rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">Available for Adoption</CardTitle>
            <HeartHandshake className="w-4 h-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{availableAnimals.length}</div>
            <p className="text-xs text-slate-500 mt-1">Listed in directory</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-[#0A0F1C] shadow-lg rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">Intake / Quarantine</CardTitle>
            <Clock className="w-4 h-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{intakeQueue.length}</div>
            <p className="text-xs text-slate-500 mt-1">Awaiting medical clearance</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-[#0A0F1C] shadow-lg rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">Pending Applications</CardTitle>
            <FileText className="w-4 h-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{pendingAppsCount}</div>
            <p className="text-xs text-slate-500 mt-1">Ready for screening</p>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab("intake")}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "intake"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Clock size={16} />
          Surrender Intake ({unclaimedSurrenders.length} unclaimed)
        </button>
        <button
          onClick={() => setActiveTab("applications")}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "applications"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <CheckSquare size={16} />
          Adoption Review Queue ({pendingAppsCount} pending)
        </button>
        <button
          onClick={() => setActiveTab("animals")}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "animals"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Building2 size={16} />
          Shelter Residents ({shelterAnimals?.length ?? 0})
        </button>
      </div>

      {/* TAB 1: SURRENDER INTAKE */}
      {activeTab === "intake" && (
        <div className="space-y-6">
          {/* Unclaimed Surrenders Section */}
          <Card className="border-slate-800 bg-[#0A0F1C] shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-slate-800 bg-slate-900/40 py-4 px-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  <AlertCircle size={18} className="text-amber-400" />
                  Unclaimed Community Surrenders
                </CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">
                  Citizens have surrendered these animals. Claim one to admit it into your shelter's intake and veterinary review.
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20">
                {unclaimedSurrenders.length} Waiting
              </span>
            </CardHeader>
            <CardContent className="p-6">
              {loadingSurrenders ? (
                <div className="py-8 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> Loading surrenders...
                </div>
              ) : unclaimedSurrenders.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-sm">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/50 mb-2" />
                  No unclaimed surrenders currently waiting. All animals have been admitted.
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {unclaimedSurrenders.map((animal) => (
                    <div key={animal.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                          {animal.photos?.[0] ? (
                            <img src={animal.photos[0]} alt={animal.name} className="w-full h-full object-cover" />
                          ) : (
                            <Dog className="text-slate-500" size={24} />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-base">{animal.name}</span>
                            <Badge className="bg-slate-800 text-slate-300 text-[10px]">{animal.species}</Badge>
                            <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
                              Awaiting Shelter
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2 max-w-xl">
                            {animal.description || "No description provided."}
                          </p>
                          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3">
                            <span>Age: {animal.ageEstimate || "Unknown"}</span>
                            <span>•</span>
                            <span>Surrendered {formatRelativeTime(animal.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <Button
                          onClick={() => claimMutation.mutate(animal.id)}
                          disabled={claimMutation.isPending}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                        >
                          {claimMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                          Claim for Intake
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Under Intake Review (Claimed by this shelter) */}
          <Card className="border-slate-800 bg-[#0A0F1C] shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-slate-800 bg-slate-900/40 py-4 px-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  <Clock size={18} className="text-blue-400" />
                  In Shelter Intake & Veterinary Clearance
                </CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">
                  Animals admitted to your shelter undergoing health checks. Once cleared, move them to Available for adoption.
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20">
                {intakeQueue.length} In Review
              </span>
            </CardHeader>
            <CardContent className="p-6">
              {loadingShelterAnimals ? (
                <div className="py-8 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> Loading intake list...
                </div>
              ) : intakeQueue.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-sm">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-blue-500/50 mb-2" />
                  No animals currently pending veterinary clearance in your shelter.
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {intakeQueue.map((animal) => (
                    <div key={animal.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                          {animal.photos?.[0] ? (
                            <img src={animal.photos[0]} alt={animal.name} className="w-full h-full object-cover" />
                          ) : (
                            <Dog className="text-slate-500" size={24} />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-base">{animal.name}</span>
                            <Badge className="bg-slate-800 text-slate-300 text-[10px]">{animal.species}</Badge>
                            <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
                              NOT_READY
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-1 max-w-xl">
                            {animal.description || "In shelter intake quarantine."}
                          </p>
                          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3">
                            <span>Health: {animal.healthStatus || "HEALTHY"}</span>
                            <span>•</span>
                            <Link to={`/animals/${animal.id}`} className="text-emerald-400 hover:underline flex items-center gap-1">
                              View Profile <ExternalLink size={10} />
                            </Link>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <Button
                          onClick={() => clearForAdoptionMutation.mutate({ id: animal.id })}
                          disabled={clearForAdoptionMutation.isPending}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5"
                        >
                          <Sparkles size={14} />
                          Clear for Adoption
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: ADOPTION REVIEW QUEUE */}
      {activeTab === "applications" && (
        <div className="space-y-6">
          {selectedApp ? (
            <div className="space-y-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedApp(null)}
                className="text-xs border-slate-700 text-slate-300"
              >
                ← Back to Applications Queue
              </Button>
              <ApplicationReview
                application={selectedApp}
                onReview={(newStatus, notes) =>
                  reviewAppMutation.mutate({ id: selectedApp.id, status: newStatus, notes })
                }
              />
            </div>
          ) : (
            <Card className="border-slate-800 bg-[#0A0F1C] shadow-xl rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-slate-800 bg-slate-900/40 py-4 px-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <CardTitle className="text-base font-bold text-white">Adoption Applications</CardTitle>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Screen candidate homes, review housing compatibility, and approve adoptions.
                  </p>
                </div>
                <div className="flex gap-2">
                  {["ALL", "SUBMITTED", "APPROVED", "REJECTED"].map((st) => (
                    <button
                      key={st}
                      onClick={() => setAppFilter(st)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        appFilter === st
                          ? "bg-emerald-500 text-emerald-950 font-bold"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {st === "ALL" ? "All" : st.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {loadingApplications ? (
                  <div className="py-8 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> Loading applications...
                  </div>
                ) : filteredApps.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-sm">
                    No adoption applications match the selected filter.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {filteredApps.map((app) => (
                      <div key={app.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">Application #{app.id.slice(0, 8).toUpperCase()}</span>
                            <Badge
                              className={`text-[10px] ${
                                app.status === "APPROVED"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : app.status === "REJECTED"
                                  ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                  : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              }`}
                            >
                              {app.status}
                            </Badge>
                          </div>
                          <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                            <span>Environment: {app.livingEnvironment || "APARTMENT"}</span>
                            <span>•</span>
                            <span>Yard: {app.hasYard ? "Yes" : "No"}</span>
                            <span>•</span>
                            <span>Other Pets: {app.hasOtherPets ? "Yes" : "None"}</span>
                          </div>
                          {app.whyAdopt && (
                            <p className="text-xs text-slate-400 italic mt-1.5 max-w-2xl line-clamp-1">
                              "{app.whyAdopt}"
                            </p>
                          )}
                          <div className="text-[11px] text-slate-500 mt-1">
                            Submitted {formatRelativeTime(app.createdAt)}
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedApp(app)}
                            className="text-xs border-slate-700 text-slate-300 hover:bg-slate-800"
                          >
                            Review Details
                          </Button>
                          {app.status === "SUBMITTED" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => reviewAppMutation.mutate({ id: app.id, status: "APPROVED", notes: "Approved via quick review" })}
                                disabled={reviewAppMutation.isPending}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => reviewAppMutation.mutate({ id: app.id, status: "REJECTED", notes: "Application not accepted" })}
                                disabled={reviewAppMutation.isPending}
                                className="text-rose-400 hover:bg-rose-500/10 text-xs"
                              >
                                Decline
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TAB 3: RESIDENTS IN SHELTER */}
      {activeTab === "animals" && (
        <Card className="border-slate-800 bg-[#0A0F1C] shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-800 bg-slate-900/40 py-4 px-6 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-white">Shelter Residents Directory</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">
                All animals assigned to your shelter facility.
              </p>
            </div>
            <Link
              to="/animals"
              className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
            >
              Public Directory <ExternalLink size={12} />
            </Link>
          </CardHeader>
          <CardContent className="p-6">
            {loadingShelterAnimals ? (
              <div className="py-8 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> Loading shelter directory...
              </div>
            ) : !shelterAnimals || shelterAnimals.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                No animals currently under this shelter's registry. Claim incoming surrenders to build your roster.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shelterAnimals.map((animal) => (
                  <div
                    key={animal.id}
                    className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between"
                  >
                    <div>
                      <div className="h-36 rounded-lg bg-slate-800 overflow-hidden mb-3">
                        {animal.photos?.[0] ? (
                          <img src={animal.photos[0]} alt={animal.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600">
                            <Dog size={32} />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-white text-base">{animal.name}</span>
                        <Badge
                          className={`text-[10px] ${
                            animal.adoptionStatus === "AVAILABLE"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          }`}
                        >
                          {animal.adoptionStatus}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2">{animal.description || "No description."}</p>
                    </div>

                    <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">{animal.species} • {animal.ageEstimate}</span>
                      <Link
                        to={`/animals/${animal.id}`}
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                      >
                        Profile <ArrowRight size={12} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export { ShelterDashboard };
