import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Heart, Shield } from "lucide-react";
import { Link } from "react-router-dom";
const AnimalProfile = ({ animal }) => {
  const [activePhoto, setActivePhoto] = useState(0);
  return <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
      {
    /* Images Section */
  }
      <div className="space-y-4">
        <div className="aspect-square rounded-2xl overflow-hidden bg-gray-100 border">
          {animal.photoUrls && animal.photoUrls.length > 0 ? <img
    src={animal.photoUrls[activePhoto]}
    alt={animal.name}
    className="w-full h-full object-cover"
  /> : <div className="w-full h-full flex items-center justify-center text-gray-400">
              No photo available
            </div>}
        </div>
        
        {animal.photoUrls && animal.photoUrls.length > 1 && <div className="flex gap-4 overflow-x-auto pb-2">
            {animal.photoUrls.map((photo, index) => <button
    key={index}
    onClick={() => setActivePhoto(index)}
    className={`w-20 h-20 rounded-lg overflow-hidden shrink-0 border-2 transition-all
                  ${activePhoto === index ? "border-primary" : "border-transparent hover:border-gray-300"}`}
  >
                <img src={photo} alt={`${animal.name} ${index + 1}`} className="w-full h-full object-cover" />
              </button>)}
          </div>}
      </div>

      {
    /* Details Section */
  }
      <div className="space-y-8">
        <div>
          <div className="flex justify-between items-start mb-2">
            <h1 className="text-4xl font-bold text-gray-900">{animal.name}</h1>
            <Badge className={animal.adoptionStatus === "AVAILABLE" ? "bg-green-500" : "bg-gray-500"}>
              {animal.adoptionStatus}
            </Badge>
          </div>
          <p className="text-xl text-gray-600">{animal.breed} • {animal.species}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-6 bg-blue-50 rounded-2xl">
          <div className="text-center">
            <p className="text-sm text-blue-600 font-medium mb-1">Age</p>
            <p className="font-semibold">{animal.ageEstimate} yrs</p>
          </div>
          <div className="text-center border-l border-blue-200">
            <p className="text-sm text-blue-600 font-medium mb-1">Gender</p>
            <p className="font-semibold">{animal.gender}</p>
          </div>
          <div className="text-center border-l border-blue-200">
            <p className="text-sm text-blue-600 font-medium mb-1">Weight</p>
            <p className="font-semibold">{animal.weight || "--"} kg</p>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold mb-3">About {animal.name}</h3>
          <p className="text-gray-600 leading-relaxed">{animal.description}</p>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Health & Medical</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <Heart className="w-5 h-5 text-red-500 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Health Status</p>
                <p className="text-gray-600">{animal.healthStatus}</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Vaccinations</p>
                <p className="text-gray-600">{animal.vaccinations?.join(", ") || "Not specified"}</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Spayed/Neutered</p>
                <p className="text-gray-600">{animal.isNeutered ? "Yes" : "No / Unknown"}</p>
              </div>
            </li>
          </ul>
        </div>

        {animal.adoptionStatus === "AVAILABLE" && <div className="pt-6 border-t">
            <Button size="lg" className="w-full text-lg h-14" asChild>
              <Link to={`/adoption/${animal.id}`}>Apply to Adopt {animal.name}</Link>
            </Button>
            <p className="text-center text-sm text-gray-500 mt-3">
              The adoption process takes 2-4 days. <Link to="/how-it-works" className="underline">Learn more</Link>.
            </p>
          </div>}
      </div>
    </div>;
};
export {
  AnimalProfile
};
