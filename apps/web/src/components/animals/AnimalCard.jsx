import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Info } from "lucide-react";
import { Link } from "react-router-dom";
const AnimalCard = ({ animal }) => {
  return <Card className="overflow-hidden hover:shadow-lg transition-all group">
      <div className="relative h-64 overflow-hidden bg-gray-100">
        {animal.photoUrls && animal.photoUrls.length > 0 ? <img
    src={animal.photoUrls[0]}
    alt={animal.name}
    className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
  /> : <div className="flex items-center justify-center w-full h-full text-gray-400">
            No Photo
          </div>}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <Badge className={animal.adoptionStatus === "AVAILABLE" ? "bg-green-500 hover:bg-green-600" : "bg-gray-500"}>
            {animal.adoptionStatus}
          </Badge>
        </div>
      </div>
      
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-xl">{animal.name}</h3>
          <Badge variant="outline" className="capitalize">{animal.species}</Badge>
        </div>
        
        <p className="text-gray-600 text-sm mb-4 line-clamp-1">{animal.breed}</p>
        
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md">{animal.ageEstimate} years</span>
          <span className="px-2 py-1 bg-pink-50 text-pink-700 text-xs rounded-md">{animal.gender}</span>
          <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-md truncate max-w-[120px]">
            {animal.healthStatus}
          </span>
        </div>
        
        <div className="pt-4 border-t flex items-center justify-between">
          <div className="flex items-center text-sm text-gray-500 gap-1 truncate max-w-[150px]">
            <MapPin size={14} className="shrink-0" />
            <span className="truncate">Shelter location</span>
          </div>
          
          <Link
    to={`/animals/${animal.id}`}
    className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
  >
            Learn More <Info size={14} />
          </Link>
        </div>
      </CardContent>
    </Card>;
};
export {
  AnimalCard
};
