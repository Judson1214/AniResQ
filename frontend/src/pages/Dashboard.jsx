import { MapPin, AlertCircle, Clock } from 'lucide-react';
import MapComponent from '../components/MapComponent';

const MOCK_RESCUES = [
  {
    id: 1,
    title: 'Injured stray dog near Metro Station',
    urgency: 'high',
    status: 'pending',
    location: 'Sector 42, Central City',
    locationCoords: [28.6139, 77.2090], // Added mock coords
    time: '2 hours ago',
    image: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 2,
    title: 'Abandoned kittens in cardboard box',
    urgency: 'medium',
    status: 'assigned',
    location: 'Westside Park',
    locationCoords: [28.6200, 77.2150],
    time: '4 hours ago',
    image: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 3,
    title: 'Parrot with broken wing',
    urgency: 'low',
    status: 'resolved',
    location: 'Downtown Market',
    locationCoords: [28.6100, 77.2000],
    time: '1 day ago',
    image: 'https://images.unsplash.com/photo-1552728089-571ebd6a45cb?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
  }
];

const getUrgencyColor = (urgency) => {
  switch (urgency) {
    case 'critical': return 'bg-red-100 text-red-800';
    case 'high': return 'bg-orange-100 text-orange-800';
    case 'medium': return 'bg-yellow-100 text-yellow-800';
    case 'low': return 'bg-blue-100 text-blue-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'pending': return 'border-orange-200 bg-orange-50 text-orange-700';
    case 'assigned': return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'in-progress': return 'border-purple-200 bg-purple-50 text-purple-700';
    case 'resolved': return 'border-green-200 bg-green-50 text-green-700';
    default: return 'border-gray-200 bg-gray-50 text-gray-700';
  }
};

const Dashboard = () => {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rescue Dashboard</h1>
          <p className="text-gray-600 mt-1">Active reports in your area</p>
        </div>
        <button className="bg-rose-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-rose-700 flex items-center gap-2 transition-colors">
          <AlertCircle size={18} />
          Report Rescue
        </button>
      </div>

      <div className="mb-8">
        <MapComponent rescues={MOCK_RESCUES} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MOCK_RESCUES.map((rescue) => (
          <div key={rescue.id} className="bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow">
            <div className="h-48 overflow-hidden relative">
              <img src={rescue.image} alt={rescue.title} className="w-full h-full object-cover" />
              <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-semibold capitalize shadow-sm ${getUrgencyColor(rescue.urgency)}`}>
                {rescue.urgency} Urgency
              </div>
            </div>
            
            <div className="p-5">
              <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize mb-3 ${getStatusColor(rescue.status)}`}>
                {rescue.status}
              </div>
              
              <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight line-clamp-2">
                {rescue.title}
              </h3>
              
              <div className="space-y-2 mt-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-gray-400" />
                  {rescue.location}
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-gray-400" />
                  {rescue.time}
                </div>
              </div>

              <button className="w-full mt-6 bg-gray-50 hover:bg-gray-100 text-gray-900 font-medium py-2 rounded-lg border transition-colors">
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
