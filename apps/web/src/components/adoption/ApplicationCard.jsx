import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import { Clock, CheckCircle, XCircle, Search } from "lucide-react";
const ApplicationCard = ({ application, animal }) => {
  const getStatusDisplay = (status) => {
    switch (status) {
      case "SUBMITTED":
        return { color: "bg-blue-100 text-blue-800", icon: <Clock size={16} /> };
      case "UNDER_REVIEW":
        return { color: "bg-yellow-100 text-yellow-800", icon: <Search size={16} /> };
      case "APPROVED":
        return { color: "bg-green-100 text-green-800", icon: <CheckCircle size={16} /> };
      case "REJECTED":
        return { color: "bg-red-100 text-red-800", icon: <XCircle size={16} /> };
      default:
        return { color: "bg-gray-100 text-gray-800", icon: null };
    }
  };
  const statusInfo = getStatusDisplay(application.status);
  return <Card className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row">
        <div className="w-full sm:w-32 h-32 bg-gray-100 shrink-0">
          {animal?.photos?.[0] ? <img src={animal.photos[0]} alt={animal.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Photo</div>}
        </div>
        
        <div className="p-4 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-lg">{animal?.name || "Unknown Animal"}</h3>
              <Badge className={`${statusInfo.color} flex gap-1 items-center`}>
                {statusInfo.icon}
                {application.status.replace("_", " ")}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 mb-2">
              Applied {formatRelativeTime(application.createdAt)}
            </p>
          </div>
          
          {application.screeningNotes && <div className="bg-gray-50 p-2 rounded text-sm text-gray-700 italic border-l-2 border-gray-300">
              "{application.screeningNotes}"
            </div>}
        </div>
      </div>
    </Card>;
};
export {
  ApplicationCard
};
