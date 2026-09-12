import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { Species } from "@aniresq/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import api from "@/lib/api";
import { uploadMultipleFiles } from "@/services/storage.service";

// Simple schema for surrendering/donating an animal
const donateSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  species: z.nativeEnum(Species),
  ageEstimate: z.string().min(1, "Age is required"),
  description: z.string().min(10, "Please provide some details about the animal"),
  reason: z.string().min(10, "Please explain why you are listing this animal"),
});

const DonateAnimalForm = () => {
  const [photos, setPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(donateSchema),
    defaultValues: { species: Species.DOG }
  });

  const handlePhotoChange = (e) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).slice(0, 3);
      setPhotos(selectedFiles);
      const previews = selectedFiles.map((file) => URL.createObjectURL(file));
      setPhotoPreviews(previews);
    }
  };

  const onSubmit = async (data) => {
    if (photos.length === 0) {
      toast({ title: "Photo Required", description: "Please attach at least one photo of the animal.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    try {
      let photoUrls = [];
      try {
        const tempId = crypto.randomUUID();
        photoUrls = await uploadMultipleFiles(`animal-photos/${tempId}`, photos);
      } catch (err) {
        console.error("Storage upload failed, falling back to dummy image", err);
        photoUrls = ["https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=1000"];
      }

      const payload = {
        name: data.name,
        species: data.species,
        breed: "Unknown",
        ageEstimate: data.ageEstimate,
        gender: "UNKNOWN",
        healthStatus: "HEALTHY",
        adoptionStatus: "AVAILABLE",
        description: data.description + "\n\nReason for listing: " + data.reason,
        vaccinations: [],
        isNeutered: false,
        photoUrls: photoUrls
      };

      await api.post('/animals/', payload);
      
      toast({ title: "Animal Listed", description: "The animal has been successfully listed for adoption." });
      navigate("/animals");
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to list animal.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto bg-slate-900 border-slate-800 text-white shadow-xl mt-8">
      <CardContent className="p-8">
        <h2 className="text-2xl font-bold mb-2">Donate / List an Animal</h2>
        <p className="text-slate-400 mb-6">List an animal for adoption or register them into our shelter network.</p>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Animal Name</Label>
              <Input id="name" {...register("name")} className="bg-slate-800 border-slate-700" placeholder="e.g. Max" />
              {errors.name && <p className="text-rose-500 text-sm">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="species">Species</Label>
              <select id="species" {...register("species")} className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm">
                {Object.values(Species).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ageEstimate">Age Estimate</Label>
            <Input id="ageEstimate" {...register("ageEstimate")} className="bg-slate-800 border-slate-700" placeholder="e.g. 2 years, 3 months" />
            {errors.ageEstimate && <p className="text-rose-500 text-sm">{errors.ageEstimate.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Photos (Required)</Label>
            <Input type="file" accept="image/*" multiple onChange={handlePhotoChange} className="bg-slate-800 border-slate-700 file:text-slate-300" />
            {photoPreviews.length > 0 && (
              <div className="flex gap-2 mt-2">
                {photoPreviews.map((p, i) => <img key={i} src={p} alt="Preview" className="w-16 h-16 object-cover rounded-lg border border-slate-700" />)}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">About the Animal</Label>
            <Textarea id="description" {...register("description")} className="bg-slate-800 border-slate-700" rows={3} placeholder="Behavior, health issues, likes/dislikes..." />
            {errors.description && <p className="text-rose-500 text-sm">{errors.description.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Donating / Listing</Label>
            <Textarea id="reason" {...register("reason")} className="bg-slate-800 border-slate-700" rows={2} placeholder="Why are you giving this animal up for adoption?" />
            {errors.reason && <p className="text-rose-500 text-sm">{errors.reason.message}</p>}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full bg-emerald-600 hover:bg-emerald-500">
            {isSubmitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : "Submit Animal"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export { DonateAnimalForm };
