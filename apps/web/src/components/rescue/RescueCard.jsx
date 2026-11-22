import { Card } from "@/components/ui/card";
import { RescueStatusBadge } from "./RescueStatusBadge";
import { formatRelativeTime } from "@/lib/utils";
import { MapPin, PawPrint, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
const RescueCard = ({ rescue, isPublic = false }) => {
  const navigate = useNavigate();
  const isAnonymousView = isPublic || (!rescue.description && !rescue.address);

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-red-500 text-white";
      case "HIGH":
        return "bg-orange-500 text-white";
      case "MEDIUM":
        return "bg-yellow-500 text-white";
      case "LOW":
        return "bg-green-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  if (isAnonymousView) {
    return (
      <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm rounded-xl p-5 flex flex-col justify-between h-full">
        <div>
          <div className="flex justify-between items-start gap-2 mb-3">
            <h3 className="font-semibold text-base text-gray-900">{rescue.title}</h3>
            <RescueStatusBadge status={rescue.status} />
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <Badge className={getSeverityColor(rescue.severity)}>{rescue.severity} Priority</Badge>
            <Badge variant="outline" className="text-gray-600 border-gray-300">
              {rescue.species}
            </Badge>
          </div>

          <p className="text-xs text-gray-500">
            Emergency rescue operation active in community. Coordinates generalized on map to ~1 km for animal safety and reporter privacy.
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-1.5">
            <Clock size={13} />
            <span>Reported {formatRelativeTime(rescue.createdAt)}</span>
          </div>
          <span className="text-emerald-600 font-medium text-[11px]">Units Alerted</span>
        </div>
      </Card>
    );
  }
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
