import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  Activity, 
  CheckCircle, 
  Clock, 
  Users, 
  ArrowRight, 
  AlertCircle, 
  Loader2,
  HeartHandshake
} from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { getRescueRequests, assignVolunteer } from "@/services/rescue.service";
import { getAnimals, claimAnimal } from "@/services/animal.service";
import { getUsers } from "@/services/user.service";
import { formatRelativeTime } from "@/lib/utils";

const NGODashboard = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 1. Rescues
  const { data: rescues, isLoading: loadingRescues } = useQuery({
    queryKey: ["ngo-rescues"],
    queryFn: () => getRescueRequests(),
  });

  // 2. Volunteers
  const { data: usersList } = useQuery({
    queryKey: ["ngo-users"],
    queryFn: () => getUsers(),
  });

  // 3. Unclaimed Surrenders
  const { data: surrenders, isLoading: loadingSurrenders } = useQuery({
    queryKey: ["unclaimed-surrenders"],
    queryFn: () => getAnimals({ adoptionStatus: "NOT_READY" }),
  });

  const volunteers = useMemo(() => {
    if (!usersList) return [];
    return usersList.filter(u => u.role === "VOLUNTEER" || u.role === "STAFF");
  }, [usersList]);

  const activeRescues = useMemo(() => {
    if (!rescues) return [];
    return rescues.filter(r => r.status === "DISPATCHED" || r.status === "IN_PROGRESS");
  }, [rescues]);

  const unassignedRescues = useMemo(() => {
    if (!rescues) return [];
    return rescues.filter(r => r.status === "PENDING");
  }, [rescues]);

  const resolvedRescues = useMemo(() => {
    if (!rescues) return [];
    return rescues.filter(r => r.status === "RESOLVED");
  }, [rescues]);

  const unclaimedSurrenders = useMemo(() => {
    if (!surrenders) return [];
    return surrenders.filter(a => !a.shelterId && a.adoptionStatus === "NOT_READY");
  }, [surrenders]);

  // Mutations
  const assignMutation = useMutation({
    mutationFn: ({ rescueId, volunteerId, volunteerName }) =>
      assignVolunteer(rescueId, volunteerId, volunteerName),
    onSuccess: () => {
      queryClient.invalidateQueries(["ngo-rescues"]);
      toast({
        title: "Volunteer Dispatched",
        description: "Responder assigned to rescue mission successfully.",
      });
    },
    onError: (err) => {
      toast({
        title: "Dispatch Failed",
        description: err.response?.data?.detail || err.message || "Failed to dispatch responder",
        variant: "destructive",
      });
    },
  });

  const claimMutation = useMutation({
    mutationFn: (animalId) => claimAnimal(animalId),
    onSuccess: () => {
      queryClient.invalidateQueries(["unclaimed-surrenders"]);
      toast({
        title: "Intake Claimed",
        description: "Animal accepted into care by your organization.",
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto py-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Building2 className="text-emerald-400" size={32} />
            NGO Dispatch & Response Hub
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Coordinate emergency dispatches, volunteer fleets, and community rescue operations.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/rescue"
            className="px-4 py-2 bg-emerald-500 text-emerald-950 hover:bg-emerald-400 text-xs font-black rounded-xl transition-colors flex items-center gap-2"
          >
            Live Rescue Map <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-800 bg-[#0A0F1C] shadow-lg rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">Active Dispatches</CardTitle>
            <Activity className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{activeRescues.length}</div>
            <p className="text-xs text-slate-500 mt-1">Units on mission</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-[#0A0F1C] shadow-lg rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">Pending SOS Alerts</CardTitle>
            <Clock className="w-4 h-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{unassignedRescues.length}</div>
            <p className="text-xs text-slate-500 mt-1">Unassigned emergencies</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-[#0A0F1C] shadow-lg rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">Resolved Missions</CardTitle>
            <CheckCircle className="w-4 h-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{resolvedRescues.length}</div>
            <p className="text-xs text-slate-500 mt-1">Animals successfully rescued</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-[#0A0F1C] shadow-lg rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">Available Responders</CardTitle>
            <Users className="w-4 h-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{volunteers.length}</div>
            <p className="text-xs text-slate-500 mt-1">Registered volunteers</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Unassigned Rescues */}
        <Card className="border-slate-800 bg-[#0A0F1C] shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-800 bg-slate-900/40 py-4 px-6 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <AlertCircle size={18} className="text-rose-400" />
                Unassigned Emergency Requests
              </CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">
                Assign volunteers immediately to dispatch aid.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-rose-500/10 text-rose-400 rounded-full border border-rose-500/20">
              {unassignedRescues.length}
            </span>
          </CardHeader>
          <CardContent className="p-6">
            {loadingRescues ? (
              <div className="py-8 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> Loading emergency dispatches...
              </div>
            ) : unassignedRescues.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                <CheckCircle className="w-8 h-8 mx-auto text-emerald-500/50 mb-2" />
                All reported emergencies have active responder assignments.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {unassignedRescues.slice(0, 5).map((rescue) => (
                  <div key={rescue.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">Case #{rescue.id.slice(0, 8).toUpperCase()}</span>
                        <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[10px]">
                          {rescue.severity || "HIGH"}
                        </Badge>
                        <Badge className="bg-slate-800 text-slate-300 text-[10px]">
                          {rescue.species}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                        {rescue.address || "Location coordinates provided"}
                      </p>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Reported {formatRelativeTime(rescue.createdAt)}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {volunteers.length > 0 ? (
                        <select
                          className="bg-slate-800 text-white text-xs rounded-lg px-2.5 py-1.5 border border-slate-700"
                          defaultValue=""
                          onChange={(e) => {
                            const volId = e.target.value;
                            if (!volId) return;
                            const vol = volunteers.find(v => v.id === volId);
                            assignMutation.mutate({
                              rescueId: rescue.id,
                              volunteerId: volId,
                              volunteerName: vol?.displayName || "Volunteer",
                            });
                          }}
                        >
                          <option value="" disabled>Dispatch responder...</option>
                          {volunteers.map(v => (
                            <option key={v.id} value={v.id}>{v.displayName || v.email}</option>
                          ))}
                        </select>
                      ) : (
                        <Link
                          to={`/rescue/${rescue.id}`}
                          className="text-xs text-emerald-400 hover:underline font-semibold"
                        >
                          Details →
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Community Surrenders Pending Intake */}
        <Card className="border-slate-800 bg-[#0A0F1C] shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-800 bg-slate-900/40 py-4 px-6 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <HeartHandshake size={18} className="text-amber-400" />
                Community Surrender Requests
              </CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">
                Surrendered animals awaiting shelter or foster intake.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20">
              {unclaimedSurrenders.length}
            </span>
          </CardHeader>
          <CardContent className="p-6">
            {loadingSurrenders ? (
              <div className="py-8 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> Loading surrenders...
              </div>
            ) : unclaimedSurrenders.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                <CheckCircle className="w-8 h-8 mx-auto text-emerald-500/50 mb-2" />
                No unclaimed animal surrenders waiting.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {unclaimedSurrenders.slice(0, 5).map((animal) => (
                  <div key={animal.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{animal.name}</span>
                        <Badge className="bg-slate-800 text-slate-300 text-[10px]">
                          {animal.species}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                        {animal.description || "Awaiting shelter intake"}
                      </p>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Surrendered {formatRelativeTime(animal.createdAt)}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => claimMutation.mutate(animal.id)}
                        disabled={claimMutation.isPending}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                      >
                        Claim for Care
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export { NGODashboard };
