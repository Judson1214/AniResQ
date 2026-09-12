import { Card } from "@/components/ui/card";
import { RescueStatusBadge } from "./RescueStatusBadge";
import { formatRelativeTime } from "@/lib/utils";
import { MapPin, PawPrint, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
const RescueCard = ({ rescue }) => {
  const navigate = useNavigate();
  const getSeverityColor = (severity) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-red-500";
      case "HIGH":
        return "bg-orange-500";
      case "MEDIUM":
        return "bg-yellow-500";
      case "LOW":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };
  return <Card
    className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer flex flex-col sm:flex-row h-full"
    onClick={() => navigate(`/rescue/${rescue.id}`)}
  >
      <div className="w-full sm:w-1/3 h-48 sm:h-auto relative bg-gray-100">
        {rescue.photoUrls && rescue.photoUrls.length > 0 ? <img
    src={rescue.photoUrls[0]}
    alt="Rescue"
    className="object-cover w-full h-full"
  /> : <div className="flex items-center justify-center w-full h-full text-gray-400">
            <PawPrint size={48} />
          </div>}
        <div className="absolute top-2 left-2">
          <Badge className={getSeverityColor(rescue.severity)}>{rescue.severity}</Badge>
        </div>
      </div>
      
      <div className="flex flex-col flex-1 p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-lg line-clamp-1">{rescue.title}</h3>
          <RescueStatusBadge status={rescue.status} />
        </div>
        
        <p className="text-sm text-gray-600 line-clamp-2 mb-4 flex-1">
          {rescue.description}
        </p>
        
        <div className="space-y-2 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <PawPrint size={14} />
            <span>{rescue.species}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={14} />
            <span className="line-clamp-1">{rescue.address}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={14} />
            <span>Reported {formatRelativeTime(rescue.createdAt)}</span>
          </div>
        </div>
      </div>
    </Card>;
};
export {
  RescueCard
};
