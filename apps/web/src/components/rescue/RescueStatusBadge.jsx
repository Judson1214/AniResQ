import { Badge } from "@/components/ui/badge";
import { RescueStatus } from "@aniresq/shared-types";
const RescueStatusBadge = ({ status, className }) => {
  let colorClass = "bg-gray-100 text-gray-800 hover:bg-gray-200";
  switch (status) {
    case RescueStatus.PENDING:
      colorClass = "bg-gray-100 text-gray-800 hover:bg-gray-200";
      break;
    case RescueStatus.DISPATCHED:
      colorClass = "bg-blue-100 text-blue-800 hover:bg-blue-200";
      break;
    case RescueStatus.IN_PROGRESS:
      colorClass = "bg-yellow-100 text-yellow-800 hover:bg-yellow-200";
      break;
    case RescueStatus.RESOLVED:
      colorClass = "bg-green-100 text-green-800 hover:bg-green-200";
      break;
    case RescueStatus.CANCELLED:
      colorClass = "bg-red-100 text-red-800 hover:bg-red-200";
      break;
  }
  return <Badge className={`${colorClass} ${className}`}>
      {status.replace("_", " ")}
    </Badge>;
};
export {
  RescueStatusBadge
};
