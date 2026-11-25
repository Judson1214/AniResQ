import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { 
  Activity, 
  MapPin, 
  CheckCircle, 
  Trophy, 
  Star, 
  ArrowRight, 
  ShieldCheck, 
  Loader2, 
  Clock 
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { getRescueRequests } from "@/services/rescue.service";

const VolunteerDashboard = () => {
  const { user } = useAuth();

  const { data: rescues, isLoading } = useQuery({
    queryKey: ["volunteer-rescues"],
    queryFn: () => getRescueRequests(),
  });

  const { completedRescues, activeMissions, pendingNearby } = useMemo(() => {
    if (!rescues) return { completedRescues: [], activeMissions: [], pendingNearby: [] };
    const completed = rescues.filter((r) => r.assignedTo === user?.uid && r.status === "RESOLVED");
    const active = rescues.filter(
      (r) => r.assignedTo === user?.uid && (r.status === "DISPATCHED" || r.status === "IN_PROGRESS")
    );
    const pending = rescues.filter((r) => r.status === "PENDING");
    return { completedRescues: completed, activeMissions: active, pendingNearby: pending };
  }, [rescues, user?.uid]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto py-4">
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight">Volunteer Dispatch Center</h1>
        <p className="text-sm text-slate-400 mt-1">
          Welcome back, {user?.displayName || "Responder"}! Monitor dispatches and manage active rescue missions.
        </p>
      </div>

      {/* KPI Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-xl shadow-black/20 rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-slate-300">Rescues Completed</CardTitle>
            <CheckCircle className="h-5 w-5 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-white">{completedRescues.length}</div>
            <p className="text-xs text-emerald-400 mt-1">Verified lives saved by you</p>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-blue-500/5 shadow-xl shadow-black/20 rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-slate-300">Active Missions</CardTitle>
            <Activity className="h-5 w-5 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-white">{activeMissions.length}</div>
            <p className="text-xs text-blue-400 mt-1">Currently in-progress or dispatched</p>
          </CardContent>
        </Card>

        <Card className="border-rose-500/20 bg-rose-500/5 shadow-xl shadow-black/20 rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-slate-300">Pending Nearby</CardTitle>
            <MapPin className="h-5 w-5 text-rose-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-white">{pendingNearby.length}</div>
            <p className="text-xs text-rose-400 mt-1">Unassigned emergencies waiting</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Missions & Nearby Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Active Missions */}
        <Card className="border-slate-800 bg-[#0A0F1C] shadow-xl rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-slate-800 bg-slate-900/40 p-6">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="text-blue-400" size={20} /> My Active Missions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>
            ) : activeMissions.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                <Clock className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                No active rescue missions assigned right now.
              </div>
            ) : (
              <div className="divide-y divide-slate-800 space-y-3">
                {activeMissions.map((m) => (
                  <div key={m.id} className="pt-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-sm">{m.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{m.species} • {m.address}</div>
                    </div>
                    <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs">
                      <Link to={`/rescue/${m.id}`}>Respond →</Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Nearby Emergencies */}
        <Card className="border-slate-800 bg-[#0A0F1C] shadow-xl rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-slate-800 bg-slate-900/40 p-6 flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <MapPin className="text-rose-400" size={20} /> Open Emergency Dispatches
            </CardTitle>
            <Button asChild size="sm" variant="outline" className="border-slate-700 text-xs rounded-xl">
              <Link to="/rescue">View Map</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>
            ) : pendingNearby.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                <ShieldCheck className="w-8 h-8 mx-auto text-emerald-500/50 mb-2" />
                No unassigned emergencies in the queue.
              </div>
            ) : (
              <div className="divide-y divide-slate-800 space-y-3">
                {pendingNearby.slice(0, 3).map((p) => (
                  <div key={p.id} className="pt-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        {p.title}
                        <span className="text-[10px] px-2 py-0.5 bg-rose-500/20 text-rose-400 font-bold rounded">
                          {p.severity}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{p.species} • {p.address}</div>
                    </div>
                    <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs">
                      <Link to={`/rescue/${p.id}`}>Accept</Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Volunteer Achievements & Rescues Completed Section */}
      <div className="mt-12 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Trophy className="text-yellow-500" /> Mission Achievements & Lives Saved
          </h2>
          {completedRescues.length > 0 && (
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {completedRescues.length} Rescues Accomplished
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
          </div>
        ) : completedRescues.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {completedRescues.map((rescue) => (
              <Card key={`vol-rescue-${rescue.id}`} className="border-emerald-500/30 bg-emerald-500/10 shadow-lg rounded-2xl overflow-hidden relative group">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500"></div>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Star className="w-5 h-5 text-emerald-400 fill-emerald-400" />
                        <span className="font-bold text-emerald-400 text-xs tracking-wider uppercase">
                          Guardian Responder Hero
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1 line-clamp-1">{rescue.title}</h3>
                      <p className="text-xs text-slate-300">
                        You responded, secured verification proof, and successfully saved this {rescue.species}!
                      </p>
                    </div>
                  </div>
                  {rescue.photoUrls?.[0] && (
                    <div className="mt-4 h-32 rounded-xl overflow-hidden opacity-90 group-hover:opacity-100 transition-opacity bg-black">
                      <img src={rescue.photoUrls[0]} alt={rescue.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="mt-4 pt-3 border-t border-emerald-500/20 flex items-center justify-between">
                    <span className="text-[11px] text-emerald-400/80 font-mono">
                      Verified Case #{rescue.id.slice(0, 6).toUpperCase()}
                    </span>
                    <Link
                      to={`/rescue/${rescue.id}`}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 group-hover:gap-1.5 transition-all"
                    >
                      Incident Report <ArrowRight size={14} />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="bg-[#131B2C] border border-slate-800 rounded-3xl p-8 text-center text-slate-400">
            <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-4 border border-slate-700">
              <Trophy className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-300">No Rescue Achievements Yet</h3>
            <p className="mt-2 text-sm max-w-md mx-auto">
              Accept and resolve emergency SOS missions to earn your responder badges and record your life-saving achievements!
            </p>
          </div>
        )}
      </div>

    </div>
  );
};

export { VolunteerDashboard };
