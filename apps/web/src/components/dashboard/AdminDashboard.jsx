import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Activity, MapPin, Truck, Loader2, ShieldCheck, UserCheck, X, Trophy, Star, ArrowRight } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@aniresq/shared-types";

const ALLOWED_REQUESTED_ROLES = ["VOLUNTEER", "NGO", "SHELTER", "VET"];
import { cn, formatDateTime } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { RescueMap } from "@/components/rescue/RescueMap";
import { getUsers, updateUserRole, declineRoleRequest } from "@/services/user.service";
import { getRescueRequests } from "@/services/rescue.service";
import { useToast } from "@/components/ui/use-toast";

const AdminDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: rescues, isLoading: isRescuesLoading } = useQuery({
    queryKey: ["rescues-admin"],
    queryFn: () => getRescueRequests(),
  });

  const { data: users, isLoading: isUsersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => getUsers(),
  });

  const roleMutation = useMutation({
    mutationFn: ({ uid, role }) => updateUserRole(uid, role),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(["admin-users"]);
      toast({
        title: "Role Updated",
        description: `Successfully assigned role ${variables.role}.`
      });
    },
    onError: (err) => {
      toast({
        title: "Update Failed",
        description: err.response?.data?.detail || err.message || "Failed to update role",
        variant: "destructive"
      });
    }
  });

  const declineMutation = useMutation({
    mutationFn: (uid) => declineRoleRequest(uid),
    onSuccess: () => {
      queryClient.invalidateQueries(["admin-users"]);
      toast({
        title: "Request Declined",
        description: "The clearance request was declined. The user's existing role remains unchanged."
      });
    },
    onError: (err) => {
      toast({
        title: "Action Failed",
        description: err.response?.data?.detail || err.message || "Failed to decline role request",
        variant: "destructive"
      });
    }
  });

  const pendingRoleRequests = useMemo(() => {
    if (!users) return [];
    return users.filter(
      u => u.requestedRole && 
           u.requestedRole !== u.role && 
           ALLOWED_REQUESTED_ROLES.includes(u.requestedRole.toUpperCase())
    );
  }, [users]);

  const stats = useMemo(() => {
    if (!rescues) return { active: 0, pending: 0, deployed: 0, recent: [] };
    
    const active = rescues.filter(r => r.status === "DISPATCHED" || r.status === "IN_PROGRESS").length;
    const pending = rescues.filter(r => r.status === "PENDING").length;
    const deployedIds = new Set(
      rescues
        .filter(r => (r.status === "DISPATCHED" || r.status === "IN_PROGRESS") && r.assignedTo)
        .map(r => r.assignedTo)
    );
    
    const recent = [...rescues]
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 5);

    return { active, pending, deployed: deployedIds.size, recent };
  }, [rescues]);

  const resolvedRescues = useMemo(() => {
    if (!rescues) return [];
    return rescues.filter(r => r.status === "RESOLVED");
  }, [rescues]);

  if (user && user.role !== UserRole.ADMIN) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (isRescuesLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Command Center</h1>
          <p className="text-sm text-slate-400 mt-1">Real-time overview of fleet, rescue operations, and personnel clearance.</p>
        </div>
        <div className="flex gap-3">
          <Link to="/admin/audit-logs" className="px-4 py-2.5 bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-sm font-bold hover:bg-slate-700 transition-colors flex items-center gap-2">
            <ShieldCheck size={16} className="text-purple-400" />
            Audit Logs
          </Link>
          <Link to="/rescue" className="px-5 py-2.5 bg-emerald-500 text-emerald-950 rounded-xl text-sm font-black hover:bg-emerald-400 transition-colors shadow-[0_0_20px_rgba(16,185,129,0.3)] block flex items-center">
            Dispatch Unit
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard 
          title="Active Dispatches" 
          value={stats.active.toString()} 
          trend="+12%" 
          isPositive={true} 
          icon={<Truck size={20} className="text-[#3b82f6]" />} 
        />
        <KpiCard 
          title="Pending SOS" 
          value={stats.pending.toString()} 
          trend="-5%" 
          isPositive={true} 
          icon={<Activity size={20} className="text-[#ef4444]" />} 
        />
        <KpiCard 
          title="Units Deployed" 
          value={stats.deployed.toString()} 
          trend="+22%" 
          isPositive={true} 
          icon={<MapPin size={20} className="text-emerald-400" />} 
        />
        <KpiCard 
          title="Pending Role Requests" 
          value={pendingRoleRequests.length.toString()} 
          trend={pendingRoleRequests.length > 0 ? "Action Req" : "Clear"} 
          isPositive={pendingRoleRequests.length === 0} 
          icon={<ShieldCheck size={20} className="text-[#a855f7]" />} 
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Live Operations Map */}
        <Card className="lg:col-span-2 border-slate-800 bg-[#0A0F1C] shadow-2xl shadow-black/50 rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-slate-800 bg-[#0A0F1C]/80 pb-4">
            <CardTitle className="text-base font-bold text-white flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
              Live Fleet Tracking
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[450px] relative">
            <RescueMap rescues={rescues || []} />
          </CardContent>
        </Card>

        {/* Recent Activity List */}
        <Card className="border-slate-800 bg-[#0A0F1C] shadow-2xl shadow-black/50 rounded-3xl">
          <CardHeader className="border-b border-slate-800 bg-[#0A0F1C]/80 pb-4">
            <CardTitle className="text-base font-bold text-white">Recent Logs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
              <div className="divide-y divide-slate-800">
                {stats.recent.length > 0 ? (
                  stats.recent.map(log => (
                    <LogItem 
                      key={log.id}
                      fullId={log.id}
                      id={log.id.slice(0, 8).toUpperCase()} 
                      time={formatDateTime(log.updatedAt)} 
                      status={log.status === "IN_PROGRESS" ? "Dispatched" : log.status.charAt(0).toUpperCase() + log.status.slice(1).toLowerCase()} 
                      location={log.address || "Unknown Location"} 
                    />
                  ))
                ) : (
                  <div className="p-8 text-center text-slate-500 text-sm">No recent activity</div>
                )}
              </div>
              <div className="p-6 border-t border-slate-800 flex gap-3">
                <Link to="/admin/audit-logs" className="flex-1 flex items-center justify-center py-2.5 bg-[#131B2C] text-purple-400 text-xs font-bold rounded-xl border border-slate-700 hover:bg-[#1A2438] transition-colors gap-1.5">
                  <ShieldCheck size={14} /> Security Audit
                </Link>
                <Link to="/rescue" className="flex-1 flex items-center justify-center py-2.5 bg-[#131B2C] text-slate-300 text-xs font-bold rounded-xl border border-slate-700 hover:bg-[#1A2438] transition-colors">
                  Rescue Fleet
                </Link>
              </div>
          </CardContent>
        </Card>
      </div>

      {/* Role Requests & Personnel Management Section */}
      <Card className="border-slate-800 bg-[#0A0F1C] shadow-2xl shadow-black/50 rounded-3xl overflow-hidden">
        <CardHeader className="border-b border-slate-800 bg-[#0A0F1C]/80 py-5 px-6 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <ShieldCheck size={18} />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-white">Personnel Clearance & Role Requests</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">Review and verify requested staff and volunteer access levels.</p>
            </div>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-slate-800 text-slate-300 rounded-full border border-slate-700">
            {pendingRoleRequests.length} Pending
          </span>
        </CardHeader>
        <CardContent className="p-6">
          {isUsersLoading ? (
            <div className="py-8 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading user directory...
            </div>
          ) : pendingRoleRequests.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">
              <UserCheck className="w-8 h-8 mx-auto text-emerald-500/50 mb-2" />
              All personnel access levels are verified. No pending clearance requests.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {pendingRoleRequests.map(u => (
                <div key={u.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-white text-sm">{u.displayName || "Unknown User"}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        Current: {u.role}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                      <span>{u.email}</span>
                      <span>•</span>
                      <span className="text-purple-400 font-semibold">Requested: {u.requestedRole}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (ALLOWED_REQUESTED_ROLES.includes(u.requestedRole?.toUpperCase())) {
                          roleMutation.mutate({ uid: u.id, role: u.requestedRole });
                        }
                      }}
                      disabled={roleMutation.isPending || !ALLOWED_REQUESTED_ROLES.includes(u.requestedRole?.toUpperCase())}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                      <UserCheck size={14} /> Approve as {u.requestedRole}
                    </button>
                    <button
                      onClick={() => declineMutation.mutate(u.id)}
                      disabled={roleMutation.isPending || declineMutation.isPending}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1"
                    >
                      <X size={14} /> Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rescue Achievements Section */}
      <div className="mt-8 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy className="text-yellow-500" size={22} /> Rescue Achievements & Lives Saved
          </h2>
          {resolvedRescues.length > 0 && (
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {resolvedRescues.length} Rescues Accomplished
            </span>
          )}
        </div>

        {resolvedRescues.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {resolvedRescues.map((rescue) => (
              <Card key={`admin-rescue-${rescue.id}`} className="border-emerald-500/30 bg-emerald-500/10 shadow-lg rounded-2xl overflow-hidden relative group">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500"></div>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Star className="w-5 h-5 text-emerald-400 fill-emerald-400" />
                        <span className="font-bold text-emerald-400 text-xs tracking-wider uppercase">
                          Lifesaver Mission Accomplished
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1 line-clamp-1">{rescue.title}</h3>
                      <p className="text-xs text-slate-300">
                        Emergency SOS resolved with verified care and photo evidence for this {rescue.species}.
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
                      Case #{rescue.id.slice(0, 8).toUpperCase()}
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
          <div className="bg-[#0A0F1C] border border-slate-800 rounded-3xl p-6 text-center text-slate-400">
            <Trophy className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No Resolved Rescues Yet</p>
            <p className="text-xs text-slate-500 mt-1">Resolved rescue missions will appear here as verified accomplishments.</p>
          </div>
        )}
      </div>

    </div>
  );
};

// Helper Components for Dashboard
function KpiCard({ title, value, trend, isPositive, icon }) {
  return (
    <Card className="border-slate-800 bg-[#0A0F1C] shadow-xl shadow-black/20 rounded-3xl hover:border-slate-700 transition-colors group cursor-default">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#131B2C] flex items-center justify-center border border-slate-800 group-hover:bg-[#1A2438] transition-all">
            {icon}
          </div>
          <div className={cn(
            "flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-xl border",
            isPositive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-purple-500/10 text-purple-400 border-purple-500/20"
          )}>
            {isPositive ? <ArrowUpRight size={14} strokeWidth={3} /> : <ArrowDownRight size={14} strokeWidth={3} />}
            {trend}
          </div>
        </div>
        <div>
          <h3 className="text-slate-400 text-sm font-bold mb-1 uppercase tracking-wider">{title}</h3>
          <div className="text-4xl font-black text-white tracking-tight">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function LogItem({ id, fullId, time, status, location }) {
  const statusColors = {
    Pending: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    Dispatched: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    Resolved: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
  };

  return (
    <Link to={`/rescue/${fullId}`} className="p-5 hover:bg-[#131B2C] transition-colors flex justify-between items-center group cursor-pointer block w-full">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-black text-white">{id}</span>
        <span className="text-xs font-medium text-slate-500 flex items-center gap-1 group-hover:text-slate-400 transition-colors">
          <MapPin size={12} /> {location}
        </span>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <span className={cn("text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border", statusColors[status])}>
          {status}
        </span>
        <span className="text-xs font-bold text-slate-600">{time}</span>
      </div>
    </Link>
  );
}

export { AdminDashboard };
