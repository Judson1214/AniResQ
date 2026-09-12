import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { RescueStatusBadge } from "./RescueStatusBadge";
import { formatDateTime } from "@/lib/utils";

const RescueTimeline = ({ requestId }) => {
  const { data: timeline, isLoading } = useRealtimeCollection(
    `/rescueRequests/${requestId}/timeline`,
    { sortBy: "createdAt:desc" }
  );
  if (isLoading) {
    return <div className="animate-pulse space-y-4">
      {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-md" />)}
    </div>;
  }
  if (!timeline || timeline.length === 0) {
    return <p className="text-gray-500 text-sm">No timeline events yet.</p>;
  }
  return <div className="relative border-l-2 border-gray-200 ml-3 space-y-6">
      {timeline.map((entry, index) => <div key={entry.id || index} className="relative pl-6">
          <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-blue-500 border-2 border-white" />
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
            <RescueStatusBadge status={entry.status} />
            <span className="text-xs text-gray-500">
              {formatDateTime(entry.createdAt)}
            </span>
          </div>
          
          <p className="text-sm font-medium">{entry.message}</p>
          <p className="text-xs text-gray-500 mt-1">Updated by {entry.updatedByName}</p>
        </div>)}
    </div>;
};
export {
  RescueTimeline
};
