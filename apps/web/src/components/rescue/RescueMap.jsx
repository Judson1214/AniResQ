import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { RescueStatusBadge } from "./RescueStatusBadge";
import { Link } from "react-router-dom";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;
const createCustomIcon = (severity) => {
  let color = "#71717a";
  if (severity === "CRITICAL") color = "#ef4444";
  if (severity === "HIGH") color = "#f97316";
  if (severity === "MEDIUM") color = "#eab308";
  if (severity === "LOW") color = "#22c55e";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="30" height="30" stroke="white" stroke-width="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
    <circle cx="12" cy="10" r="3" fill="white"></circle>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "custom-leaflet-icon",
    iconSize: [30, 30],
    iconAnchor: [15, 30]
  });
};

const createHospitalIcon = () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3b82f6" width="40" height="40" stroke="white" stroke-width="2" class="drop-shadow-lg filter drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]">
    <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"></path>
    <path d="M12 7v10"></path>
    <path d="M7 12h10"></path>
  </svg>`;
  return L.divIcon({
    html: `<div class="relative group">
            <div class="absolute inset-0 bg-blue-500 rounded-lg animate-ping opacity-50 shadow-[0_0_20px_rgba(59,130,246,0.8)]"></div>
            ${svg}
           </div>`,
    className: "hospital-leaflet-icon bg-transparent border-none",
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
};
const MapUpdater = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};
const RescueMap = ({
  rescues = [],
  singleRescue,
  center = [11.1271, 78.6569],
  // Default Tamil Nadu, India
  zoom = 7
}) => {
  const [mapCenter, setMapCenter] = useState(center);
  const [mapZoom, setMapZoom] = useState(zoom);
  useEffect(() => {
    if (singleRescue && singleRescue.location) {
      setMapCenter([singleRescue.location.latitude, singleRescue.location.longitude]);
      setMapZoom(13);
    } else if (rescues.length > 0) {
      const firstLoc = rescues[0].location;
      if (firstLoc) {
        setMapCenter([firstLoc.latitude, firstLoc.longitude]);
        setMapZoom(10);
      }
    }
  }, [singleRescue, rescues]);
  const itemsToRender = singleRescue ? [singleRescue] : rescues;

  // Mock hospital data for demonstration of highlighted markers
  const mockHospitals = [
    { id: "h1", name: "City Animal Hospital", lat: mapCenter[0] + 0.02, lng: mapCenter[1] - 0.02, phone: "+1 234 567 8900" },
    { id: "h2", name: "Emergency Vet Care", lat: mapCenter[0] - 0.03, lng: mapCenter[1] + 0.01, phone: "+1 987 654 3210" },
    { id: "h3", name: "Paws & Claws Clinic", lat: mapCenter[0] + 0.01, lng: mapCenter[1] + 0.04, phone: "+1 555 123 4567" }
  ];

  return <div className="w-full h-full rounded-md overflow-hidden z-0 relative" style={{ minHeight: "300px" }}>
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        minZoom={5}
        maxBounds={[
          [6.4626999, 68.1097],   // Southwest coordinates of India
          [35.513327, 97.3953586] // Northeast coordinates of India
        ]}
        maxBoundsViscosity={1.0}
        style={{ height: "100%", width: "100%", zIndex: 1 }}
      >
        <TileLayer
    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  />
        <MapUpdater center={mapCenter} zoom={mapZoom} />
        
        {/* Render Rescue Requests */}
        {itemsToRender.map((rescue) => {
    if (!rescue.location) return null;
    return <Marker
      key={rescue.id}
      position={[rescue.location.latitude, rescue.location.longitude]}
      icon={createCustomIcon(rescue.severity)}
    >
              <Popup>
                <div className="p-1 max-w-[200px]">
                  <h4 className="font-semibold text-sm mb-1">{rescue.title}</h4>
                  <div className="flex gap-2 mb-2">
                    <RescueStatusBadge status={rescue.status} className="scale-75 origin-left" />
                  </div>
                  <p className="text-xs text-gray-600 mb-2">{rescue.species}</p>
                  <Link
      to={`/rescue/${rescue.id}`}
      className="text-xs text-blue-600 hover:underline"
    >
                    View Details
                  </Link>
                </div>
              </Popup>
            </Marker>;
  })}

        {/* Render Highlighted Animal Hospitals */}
        {mockHospitals.map(hospital => (
          <Marker 
            key={hospital.id} 
            position={[hospital.lat, hospital.lng]}
            icon={createHospitalIcon()}
          >
            <Popup>
              <div className="p-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1">Registered Clinic</div>
                <h4 className="font-bold text-gray-900">{hospital.name}</h4>
                <p className="text-xs text-gray-500 mt-1">24/7 Emergency Response</p>
                <p className="text-xs text-gray-800 font-medium mt-2">📞 {hospital.phone}</p>
              </div>
            </Popup>
          </Marker>
        ))}

      </MapContainer>
    </div>;
};
export {
  RescueMap
};
