import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { RescueSeverity, Species } from "@aniresq/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { createRescueRequest } from "@/services/rescue.service";
import { useAuth } from "@/hooks/useAuth";
import { useGeolocation } from "@/hooks/useGeolocation";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Megaphone, MapPin, Camera } from "lucide-react";

const rescueReportSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  species: z.nativeEnum(Species),
  severity: z.nativeEnum(RescueSeverity),
  address: z.string().min(5, "Address is required")
});

const LocationPicker = ({ position, setPosition, setValue }) => {
  useMapEvents({
    async click(e) {
      const { lat, lng } = e.latlng;
      setPosition(e.latlng);
      
      // Reverse Geocoding: Automatically fill the address when they click the map!
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        if (data && data.display_name) {
          // Keep it short, take first 2-3 parts of the address
          const shortAddress = data.display_name.split(',').slice(0, 3).join(',');
          setValue("address", shortAddress);
        }
      } catch (err) {
        console.error("Reverse geocoding failed", err);
      }
    }
  });
  return position ? <Marker position={position} /> : null;
};

// Map Updater Component to change view when position changes externally (via Search or GPS)
const MapUpdater = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, 16);
    }
  }, [position, map]);
  return null;
};

const RescueReportForm = () => {
  const [photos, setPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [position, setPosition] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { getCurrentPosition, position: geoPosition, isLoading: geoLoading } = useGeolocation();
  
  const { register, handleSubmit, setValue, getValues, formState: { errors } } = useForm({
    resolver: zodResolver(rescueReportSchema),
    defaultValues: {
      species: Species.DOG,
      severity: RescueSeverity.HIGH
    }
  });

  useEffect(() => {
    if (geoPosition) {
      setPosition(geoPosition);
      // Auto-fill address from GPS coordinates
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${geoPosition.lat}&lon=${geoPosition.lng}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.display_name) {
            const shortAddress = data.display_name.split(',').slice(0, 3).join(',');
            setValue("address", shortAddress);
          }
        })
        .catch(err => console.error("Reverse geocoding failed", err));
    }
  }, [geoPosition, setValue]);

  // Attempt to auto-locate on mount for emergencies
  useEffect(() => {
    getCurrentPosition();
  }, [getCurrentPosition]);

  const handleSearchAddress = async () => {
    const query = getValues("address");
    if (!query || query.length < 3) return;
    
    setIsSearching(true);
    try {
      // &countrycodes=in restricts all address searches strictly to India
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in`);
      const data = await response.json();
      if (data && data.length > 0) {
        const result = data[0];
        setPosition({ lat: parseFloat(result.lat), lng: parseFloat(result.lon) });
        toast({ title: "Location Found", description: "Map updated to the searched address." });
      } else {
        toast({ title: "Not Found", description: "Could not find that exact address. Try a city or larger landmark.", variant: "destructive" });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Search Error", description: "Failed to search address.", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const handlePhotoChange = (e) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).slice(0, 3);
      setPhotos(selectedFiles);
      const previews = selectedFiles.map((file) => URL.createObjectURL(file));
      setPhotoPreviews(previews);
    }
  };

  const onSubmit = async (data) => {
    if (!user) {
      toast({ title: "Authentication Required", description: "Please login to report a rescue.", variant: "destructive" });
      return;
    }
    if (!position) {
      toast({ title: "Location Required", description: "Please pin the emergency location on the map.", variant: "destructive" });
      return;
    }
    if (photos.length === 0) {
      toast({ title: "Photo Recommended", description: "Please attach at least one photo if possible.", variant: "default" });
    }

    setIsSubmitting(true);
    try {
      const rescueData = {
        title: data.title,
        description: data.description,
        species: data.species,
        severity: data.severity,
        address: data.address,
        location: { latitude: position.lat, longitude: position.lng },
        reporterId: user.uid
      };
      
      const rescueId = await createRescueRequest(rescueData, photos);
      toast({ title: "SOS Dispatched!", description: "Emergency rescue units have been notified." });
      navigate(`/rescue`);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to dispatch SOS.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-6 flex items-center gap-4">
        <div className="w-14 h-14 bg-rose-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-rose-500/30">
          <Megaphone size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white">Emergency SOS</h1>
          <p className="text-slate-400">Dispatch a rescue unit immediately. Please be as precise as possible.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Column: Details & Photos */}
          <div className="space-y-6">
            <Card className="bg-[#131B2C] border-slate-800 shadow-xl">
              <CardContent className="p-6 space-y-4">
                <h2 className="text-xl font-bold text-white mb-4">Situation Details</h2>
                
                <div className="space-y-2">
                  <Label className="text-slate-300">Brief Title</Label>
                  <Input {...register("title")} className="bg-slate-900 border-slate-700 text-white" placeholder="e.g., Injured stray dog on highway" />
                  {errors.title && <p className="text-rose-500 text-sm">{errors.title.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Species</Label>
                    <select {...register("species")} className="w-full h-10 rounded-md border border-slate-700 bg-slate-900 text-white px-3 text-sm">
                      {Object.values(Species).map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300 text-rose-400 font-bold">Severity Level</Label>
                    <select {...register("severity")} className="w-full h-10 rounded-md border border-slate-700 bg-slate-900 text-rose-400 font-bold px-3 text-sm">
                      {Object.values(RescueSeverity).map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Description</Label>
                  <Textarea {...register("description")} className="bg-slate-900 border-slate-700 text-white" rows={4} placeholder="Describe the animal's condition, exact whereabouts, etc." />
                  {errors.description && <p className="text-rose-500 text-sm">{errors.description.message}</p>}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#131B2C] border-slate-800 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Camera className="text-blue-400" size={20} />
                  <h2 className="text-xl font-bold text-white">Attach Photos (Crucial)</h2>
                </div>
                <div className="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center hover:bg-slate-800 transition-colors cursor-pointer relative">
                  <Input type="file" accept="image/*" multiple onChange={handlePhotoChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <p className="text-blue-400 font-medium">Tap to take a photo or select from gallery</p>
                  <p className="text-xs text-slate-500 mt-1">Photos help our dispatchers identify the animal instantly.</p>
                </div>
                {photoPreviews.length > 0 && (
                  <div className="flex gap-3 mt-4 overflow-x-auto pb-2">
                    {photoPreviews.map((preview, i) => (
                      <img key={i} src={preview} alt="Preview" className="w-20 h-20 object-cover rounded-lg border border-slate-700 shadow-sm shrink-0" />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Location */}
          <div className="space-y-6 flex flex-col">
            <Card className="bg-[#131B2C] border-slate-800 shadow-xl flex-1 flex flex-col">
              <CardContent className="p-6 flex-1 flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="text-emerald-400" size={20} />
                    <h2 className="text-xl font-bold text-white">Pinpoint Location</h2>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={getCurrentPosition} disabled={geoLoading} className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
                    {geoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Use My GPS"}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Type Address & Hit Search, or Tap Map</Label>
                  <div className="flex gap-2">
                    <Input {...register("address")} className="bg-slate-900 border-slate-700 text-white flex-1" placeholder="E.g. Anna Nagar, Chennai" />
                    <Button type="button" onClick={handleSearchAddress} disabled={isSearching} className="bg-blue-600 hover:bg-blue-500 text-white shrink-0">
                      {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search Map"}
                    </Button>
                  </div>
                  {errors.address && <p className="text-rose-500 text-sm">{errors.address.message}</p>}
                </div>

                <div className="flex-1 min-h-[300px] rounded-xl overflow-hidden border border-slate-700 z-0 relative shadow-inner">
                  <MapContainer 
                    center={position || [11.1271, 78.6569]} // Centered exactly on Tamil Nadu
                    zoom={position ? 16 : 7} 
                    minZoom={5}
                    maxBounds={[
                      [6.4626999, 68.1097],   // Southwest coordinates of India
                      [35.513327, 97.3953586] // Northeast coordinates of India
                    ]}
                    maxBoundsViscosity={1.0} // Gives a solid bounce-back effect if user tries to drag outside India
                    style={{ height: "100%", width: "100%", zIndex: 1, background: "#f8f9fa" }}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                    <LocationPicker position={position} setPosition={setPosition} setValue={setValue} />
                    <MapUpdater position={position} />
                  </MapContainer>
                </div>
                <p className="text-xs text-blue-400 font-medium text-center bg-blue-900/20 py-2 rounded-lg border border-blue-900/50">
                  Tip: You can tap anywhere on the map to auto-fill the address!
                </p>
              </CardContent>
            </Card>

            <Button type="submit" disabled={isSubmitting} className="w-full h-14 text-lg font-black bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 rounded-xl transition-all">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin mr-2" /> 
                  {photos.length > 0 ? "UPLOADING PHOTOS..." : "DISPATCHING SOS..."}
                </>
              ) : "DISPATCH SOS IMMEDIATELY"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export { RescueReportForm };
