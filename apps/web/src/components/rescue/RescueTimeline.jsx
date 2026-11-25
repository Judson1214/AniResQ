import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { RescueStatusBadge } from "./RescueStatusBadge";
import { formatDateTime } from "@/lib/utils";
import { CheckCircle2, Clock, AlertTriangle, ShieldAlert } from "lucide-react";

const getStatusIcon = (status) => {
  switch (status) {
    case "RESOLVED":
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    case "IN_PROGRESS":
      return <Clock className="w-3.5 h-3.5 text-blue-400" />;
    case "DISPATCHED":
      return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
    default:
      return <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />;
  }
};

const RescueTimeline = ({ requestId }) => {
  const { data: timeline, isLoading } = useRealtimeCollection(
    `/rescues/${requestId}/timeline`,
    { sortBy: "createdAt:desc" }
  );

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-slate-800/50 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!timeline || timeline.length === 0) {
    return (
      <div className="p-6 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 text-sm">
        No timeline events recorded yet.
      </div>
    );
  }

  return (
    <div className="relative border-l-2 border-slate-700/60 ml-3 space-y-6">
      {timeline.map((entry, index) => (
        <div key={entry.id || index} className="relative pl-6">
          <div className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full bg-slate-900 border-2 border-emerald-500 flex items-center justify-center">
            {getStatusIcon(entry.status)}
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
            <RescueStatusBadge status={entry.status} />
            <span className="text-xs text-slate-400">
              {formatDateTime(entry.createdAt)}
            </span>
          </div>
          
          <p className="text-sm font-medium text-slate-200 mt-1">{entry.message}</p>
          <p className="text-xs text-slate-500 mt-1">
            Updated by <span className="text-slate-400 font-semibold">{entry.updatedByName || "System"}</span>
          </p>
        </div>
      ))}
    </div>
  );
};

export {
  RescueTimeline
};
