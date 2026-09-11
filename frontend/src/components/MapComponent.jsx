import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const MapComponent = ({ rescues }) => {
  // Default center (e.g., center of a generic city, or use the first rescue's location)
  const defaultCenter = [28.6139, 77.2090]; // New Delhi coordinates as default

  return (
    <div className="h-96 w-full rounded-xl overflow-hidden shadow-sm border border-gray-200">
      <MapContainer center={defaultCenter} zoom={11} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {rescues.map((rescue) => (
          rescue.locationCoords && (
            <Marker key={rescue.id} position={rescue.locationCoords}>
              <Popup>
                <div className="font-sans">
                  <h3 className="font-bold text-gray-900">{rescue.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{rescue.status}</p>
                </div>
              </Popup>
            </Marker>
          )
        ))}
      </MapContainer>
    </div>
  );
};

export default MapComponent;
