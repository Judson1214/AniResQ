import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { submitApplication } from "@/services/adoption.service";
import { useAuth } from "@/hooks/useAuth";
const adoptionSchema = z.object({
  environmentType: z.string().min(2),
  hasYard: z.boolean(),
  otherPets: z.string(),
  familyMembers: z.number().min(1),
  hasChildren: z.boolean(),
  workSchedule: z.string().min(5),
  priorExperience: z.string().min(5),
  motivation: z.string().min(20, "Please provide more details on why you want to adopt.")
});
const AdoptionForm = ({ animal }) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors }, trigger, getValues } = useForm({
    resolver: zodResolver(adoptionSchema),
    mode: "onChange"
  });
  const nextStep = async () => {
    let fieldsToValidate = [];
    if (step === 1) fieldsToValidate = ["environmentType", "hasYard", "otherPets"];
    if (step === 2) fieldsToValidate = ["familyMembers", "hasChildren", "workSchedule", "priorExperience"];
    if (step === 3) fieldsToValidate = ["motivation"];
    if (fieldsToValidate.length > 0) {
      const isStepValid = await trigger(fieldsToValidate);
      if (!isStepValid) return;
    }
    setStep((s) => Math.min(s + 1, 4));
  };
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));
  const onSubmit = async (data) => {
    if (!user) {
      toast({ title: "Authentication Required", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await submitApplication({
        animalId: animal.id,
        applicantId: user.uid,
        livingEnvironment: data.environmentType,
        hasYard: data.hasYard,
        hasOtherPets: data.otherPets !== "None" && data.otherPets !== "",
        otherPetDetails: data.otherPets,
        priorPetExperience: data.priorExperience,
        familyMembers: data.familyMembers,
        hasChildren: data.hasChildren,
        workSchedule: data.workSchedule,
        whyAdopt: data.motivation
      });
      toast({ title: "Application Submitted", description: "We will review your application soon." });
      navigate("/my-applications");
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to submit application.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  return <div className="max-w-2xl mx-auto">
      <div className="bg-blue-50 p-4 rounded-lg flex items-center gap-4 mb-8">
        <img src={animal.photoUrls?.[0]} alt={animal.name} className="w-16 h-16 rounded-full object-cover" />
        <div>
          <h3 className="font-semibold text-lg">Adopting {animal.name}</h3>
          <p className="text-sm text-gray-600">{animal.breed} • {animal.ageEstimate} years old</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6 md:p-8">
        <form onSubmit={handleSubmit(onSubmit)}>
          
          {step === 1 && <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Living Situation</h2>
              
              <div className="space-y-2">
                <Label>Environment Type</Label>
                <select {...register("environmentType")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Select type...</option>
                  <option value="apartment">Apartment</option>
                  <option value="house">House</option>
                  <option value="farm">Farm/Rural</option>
                </select>
                {errors.environmentType && <p className="text-red-500 text-sm">{errors.environmentType.message}</p>}
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="hasYard" {...register("hasYard")} className="rounded border-gray-300" />
                <Label htmlFor="hasYard">Do you have a fenced yard?</Label>
              </div>

              <div className="space-y-2">
                <Label>Other Pets in Household (Specify types, ages or 'None')</Label>
                <Input {...register("otherPets")} placeholder="E.g., 1 cat (3 years old)" />
                {errors.otherPets && <p className="text-red-500 text-sm">{errors.otherPets.message}</p>}
              </div>
            </div>}

          {step === 2 && <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Personal & Household</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Number of Family Members</Label>
                  <Input type="number" {...register("familyMembers", { valueAsNumber: true })} />
                  {errors.familyMembers && <p className="text-red-500 text-sm">{errors.familyMembers.message}</p>}
                </div>
                
                <div className="flex items-center gap-2 pt-8">
                  <input type="checkbox" id="hasChildren" {...register("hasChildren")} className="rounded border-gray-300" />
                  <Label htmlFor="hasChildren">Children under 12?</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Work Schedule (Who will be home with the pet?)</Label>
                <Input {...register("workSchedule")} placeholder="E.g., Work from home, Away 9-5" />
                {errors.workSchedule && <p className="text-red-500 text-sm">{errors.workSchedule.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Prior Pet Experience</Label>
                <Textarea {...register("priorExperience")} placeholder="Describe your experience with pets..." />
                {errors.priorExperience && <p className="text-red-500 text-sm">{errors.priorExperience.message}</p>}
              </div>
            </div>}

          {step === 3 && <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Motivation</h2>
              
              <div className="space-y-2">
                <Label>Why do you want to adopt {animal.name}?</Label>
                <Textarea
    {...register("motivation")}
    placeholder="Share why you think this animal is a good fit for you..."
    rows={6}
  />
                {errors.motivation && <p className="text-red-500 text-sm">{errors.motivation.message}</p>}
              </div>
            </div>}

          {step === 4 && <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">Review Application</h2>
              <div className="text-sm space-y-3 bg-gray-50 p-4 rounded text-gray-700">
                <p><strong>Environment:</strong> {getValues("environmentType")} {getValues("hasYard") ? "(with yard)" : ""}</p>
                <p><strong>Other Pets:</strong> {getValues("otherPets")}</p>
                <p><strong>Household:</strong> {getValues("familyMembers")} members {getValues("hasChildren") ? "(with young children)" : ""}</p>
                <p><strong>Work Schedule:</strong> {getValues("workSchedule")}</p>
                <p><strong>Experience:</strong> {getValues("priorExperience")}</p>
                <p><strong>Motivation:</strong> {getValues("motivation")}</p>
              </div>
              <p className="text-sm text-gray-500">By submitting this application, you agree to a background check and home visit if required.</p>
            </div>}

          <div className="flex justify-between mt-8 pt-6 border-t">
            <Button type="button" variant="outline" onClick={prevStep} disabled={step === 1 || isSubmitting}>
              Back
            </Button>
            
            {step < 4 ? <Button type="button" onClick={nextStep}>Next</Button> : <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Application"}
              </Button>}
          </div>

        </form>
      </div>
    </div>;
};
export {
  AdoptionForm
};
