import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { LostFoundType, Species } from "@aniresq/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { createPost } from "@/services/lostfound.service";
import { useAuth } from "@/hooks/useAuth";
import { useGeolocation } from "@/hooks/useGeolocation";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import { Loader2, MapPin } from "lucide-react";
import React from "react";
import "leaflet/dist/leaflet.css";
const lostFoundSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(10),
  species: z.nativeEnum(Species),
  breed: z.string().optional(),
  color: z.string().min(2),
  contactPhone: z.string().min(10),
  lastSeenAddress: z.string().min(5),
  date: z.string().optional()
});
const LocationPicker = ({ position, setPosition, setValue }) => {
  useMapEvents({
    async click(e) {
      const { lat, lng } = e.latlng;
      setPosition(e.latlng);
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        if (data && data.display_name) {
          const shortAddress = data.display_name.split(',').slice(0, 3).join(',');
          setValue("lastSeenAddress", shortAddress);
        }
      } catch (err) {
        console.error("Reverse geocoding failed", err);
      }
    }
  });
  return position ? <Marker position={position} /> : null;
};

const MapUpdater = ({ position }) => {
  const map = useMap();
  React.useEffect(() => {
    if (position) {
      map.flyTo(position, 16);
    }
  }, [position, map]);
  return null;
};
const LostFoundForm = ({ onSuccess }) => {
  const [type, setType] = useState(LostFoundType.LOST);
  const [photos, setPhotos] = useState([]);
  const [position, setPosition] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { getCurrentPosition, position: geoPosition, isLoading: geoLoading } = useGeolocation();
  const { register, handleSubmit, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(lostFoundSchema),
    defaultValues: { species: Species.DOG }
  });

  React.useEffect(() => {
    if (geoPosition) setPosition(geoPosition);
  }, [geoPosition]);

  const onSubmit = async (data) => {
    if (!user) {
      toast({ title: "Auth Required", variant: "destructive" });
      return;
    }
    if (!position) {
      toast({ title: "Location Required", description: "Please pin the last seen location.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await createPost({
        type,
        title: data.title,
        description: data.description,
        species: data.species,
        breed: data.breed,
        color: data.color,
        contactPhone: data.contactPhone,
        contactEmail: user.email || "",
        location: position ? { latitude: position.lat, longitude: position.lng } : { latitude: 0, longitude: 0 },
        lastSeenAddress: data.lastSeenAddress,
        lastSeenDate: data.date || new Date().toISOString(),
        // Simplified
        reporterId: user.uid
      }, photos.slice(0, 3));
      toast({ title: "Post Created Successfully" });
      if (onSuccess) onSuccess();
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  return <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Tabs value={type} onValueChange={(v) => setType(v)} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value={LostFoundType.LOST}>I Lost a Pet</TabsTrigger>
          <TabsTrigger value={LostFoundType.FOUND}>I Found a Pet</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input {...register("title")} className="bg-slate-900 border-slate-700 text-white" placeholder="e.g. Lost Golden Retriever in downtown" />
          {errors.title && <p className="text-red-500 text-sm">{errors.title.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Species</Label>
            <select {...register("species")} className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-white">
              {Object.values(Species).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Breed (Optional)</Label>
            <Input {...register("breed")} className="bg-slate-900 border-slate-700 text-white" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Color / Markings</Label>
          <Input {...register("color")} className="bg-slate-900 border-slate-700 text-white" />
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea {...register("description")} className="bg-slate-900 border-slate-700 text-white" rows={3} />
        </div>

        <div className="space-y-2">
          <Label>Contact Phone</Label>
          <Input {...register("contactPhone")} className="bg-slate-900 border-slate-700 text-white" type="tel" />
        </div>

        <div className="space-y-2">
          <Label>Photos (Max 3)</Label>
          <Input type="file" accept="image/*" multiple className="bg-slate-900 border-slate-700 text-white" onChange={(e) => setPhotos(Array.from(e.target.files || []))} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Location (Last Seen / Found)</Label>
            <Button type="button" variant="outline" size="sm" onClick={getCurrentPosition} disabled={geoLoading} className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700 h-8">
              {geoLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <MapPin className="w-3 h-3 mr-1" />}
              Use My GPS
            </Button>
          </div>
          <Input {...register("lastSeenAddress")} className="bg-slate-900 border-slate-700 text-white" placeholder="E.g., 5th Avenue & 82nd St" />
          
          <div className="h-48 border border-slate-700 rounded-xl mt-2 overflow-hidden z-0 relative shadow-inner">
            <MapContainer 
              center={position || [11.1271, 78.6569]} 
              zoom={position ? 16 : 7} 
              minZoom={5}
              maxBounds={[
                [6.4626999, 68.1097],
                [35.513327, 97.3953586]
              ]}
              maxBoundsViscosity={1.0}
              style={{ height: "100%", width: "100%", zIndex: 1, background: "#f8f9fa" }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
              <LocationPicker position={position} setPosition={setPosition} setValue={setValue} />
              <MapUpdater position={position} />
            </MapContainer>
          </div>
          <p className="text-xs text-blue-400 font-medium mt-1">Tip: Tap anywhere on the map to auto-fill the address!</p>
        </div>
      </div>

      <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            {photos.length > 0 ? "Uploading Photos..." : "Submitting..."}
          </>
        ) : `Post ${type === LostFoundType.LOST ? "Lost" : "Found"} Pet`}
      </Button>
    </form>;
};
export {
  LostFoundForm
};
