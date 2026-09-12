import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Activity, MapPin, Truck, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { useMemo } from "react";

const AdminDashboard = () => {
  const { data: rescues, isLoading } = useQuery({
    queryKey: ["rescues-admin"],
    queryFn: async () => {
      const res = await api.get("/rescues");
      return res.data;
    }
  });

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

  if (isLoading) {
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
          <p className="text-sm text-slate-400 mt-1">Real-time overview of fleet and rescue operations.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-5 py-2.5 bg-[#131B2C] border border-slate-700 text-slate-300 rounded-xl text-sm font-bold hover:bg-[#1A2438] transition-colors shadow-lg">
            Export Report
          </button>
          <button className="px-5 py-2.5 bg-emerald-500 text-emerald-950 rounded-xl text-sm font-black hover:bg-emerald-400 transition-colors shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            Dispatch Unit
          </button>
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
          title="Avg. Response Time" 
          value="14m" 
          trend="-2m" 
          isPositive={true} 
          icon={<Clock size={20} className="text-[#eab308]" />} 
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Live Operations Map Placeholder */}
        <Card className="lg:col-span-2 border-slate-800 bg-[#0A0F1C] shadow-2xl shadow-black/50 rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-slate-800 bg-[#0A0F1C]/80 pb-4">
            <CardTitle className="text-base font-bold text-white flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
              Live Fleet Tracking
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[450px] bg-[#06090F] relative">
            {/* Map styling mock */}
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
            
            {/* Mock Map Pins */}
            <MapPinIndicator top="20%" left="30%" status="dispatched" label="Unit A-42" />
            <MapPinIndicator top="50%" left="60%" status="pending" label="SOS-992" />
            <MapPinIndicator top="70%" left="40%" status="resolved" label="Unit B-11" />
            <MapPinIndicator top="30%" left="80%" status="dispatched" label="Unit C-09" />
            
            {/* Radar Sweep Effect */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-emerald-500/20 rounded-full opacity-50" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] border border-emerald-500/30 rounded-full opacity-50" />
            
            <div className="absolute bottom-6 left-6 right-6 bg-[#131B2C]/90 backdrop-blur-md p-4 rounded-2xl border border-slate-700 shadow-2xl flex justify-between items-center">
               <div className="flex gap-6">
                 <div className="flex items-center gap-2 text-xs font-bold text-slate-300"><span className="w-3 h-3 rounded-full bg-[#3b82f6] shadow-[0_0_10px_rgba(59,130,246,0.6)]"></span> Dispatched</div>
                 <div className="flex items-center gap-2 text-xs font-bold text-slate-300"><span className="w-3 h-3 rounded-full bg-[#ef4444] shadow-[0_0_10px_rgba(239,68,68,0.6)]"></span> Pending SOS</div>
                 <div className="flex items-center gap-2 text-xs font-bold text-slate-300"><span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]"></span> Resolved</div>
               </div>
               <button className="text-xs font-black text-emerald-400 hover:text-emerald-300 uppercase tracking-wider">Expand Map &rarr;</button>
            </div>
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
             <div className="p-6 border-t border-slate-800">
               <button className="w-full py-3 bg-[#131B2C] text-slate-300 text-sm font-bold rounded-xl border border-slate-700 hover:bg-[#1A2438] transition-colors">
                 View All Activity
               </button>
             </div>
          </CardContent>
        </Card>
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
            isPositive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
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

function MapPinIndicator({ top, left, status, label }) {
  const colors = {
    pending: "bg-[#ef4444] shadow-[0_0_15px_rgba(239,68,68,0.8)]",
    dispatched: "bg-[#3b82f6] shadow-[0_0_15px_rgba(59,130,246,0.8)]",
    resolved: "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]"
  };

  return (
    <div className="absolute flex flex-col items-center gap-2" style={{ top, left }}>
      <div className="bg-[#131B2C] text-white text-[10px] font-bold px-3 py-1 rounded-lg border border-slate-700 shadow-xl">
        {label}
      </div>
      <div className={cn("w-4 h-4 rounded-full border-2 border-white", colors[status])}>
        {status === 'pending' && <div className="absolute inset-0 rounded-full animate-ping bg-inherit opacity-75" />}
      </div>
    </div>
  );
}

function LogItem({ id, time, status, location }) {
  const statusColors = {
    Pending: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    Dispatched: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    Resolved: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
  };

  return (
    <div className="p-5 hover:bg-[#131B2C] transition-colors flex justify-between items-center group cursor-pointer">
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
    </div>
  );
}

export { AdminDashboard };
