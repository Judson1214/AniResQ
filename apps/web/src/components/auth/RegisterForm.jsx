import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { registerSchema } from "@aniresq/validation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, PawPrint } from "lucide-react";
import { UserRole } from "@aniresq/shared-types";
const RegisterForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: UserRole.CITIZEN
    }
  });
  const selectedRole = watch("role");
  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      await signUp(data.email, data.password, data.displayName, data.role, data.phone);
      toast({
        title: "Account created",
        description: "Welcome to AniResQ!"
      });
      navigate("/dashboard");
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };
  const getRoleDescription = (role) => {
    switch (role) {
      case UserRole.CITIZEN:
        return "Report rescues, find lost pets, and adopt animals.";
      case UserRole.VOLUNTEER:
        return "Help with rescues, transport, and fostering.";
      case UserRole.SHELTER:
        return "Manage animal inventory and adoptions.";
      case UserRole.NGO:
        return "Coordinate large-scale rescues and campaigns.";
      case UserRole.VET:
        return "Provide medical care and consultations.";
      default:
        return "";
    }
  };
  return (
    <div className="w-full">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="displayName" className="text-slate-300">Operator Identity</Label>
          <Input 
            id="displayName" 
            placeholder="John Doe" 
            className="bg-slate-950/50 border-slate-700 text-white placeholder:text-slate-600 focus:border-emerald-500 h-11 rounded-xl"
            {...register("displayName")} 
          />
          {errors.displayName && <p className="text-sm text-rose-500">{errors.displayName.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-slate-300">Secure Email</Label>
          <Input 
            id="email" 
            type="email" 
            placeholder="operator@aniresq.org" 
            className="bg-slate-950/50 border-slate-700 text-white placeholder:text-slate-600 focus:border-emerald-500 h-11 rounded-xl"
            {...register("email")} 
          />
          {errors.email && <p className="text-sm text-rose-500">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-slate-300">Security Clearance (Password)</Label>
          <Input 
            id="password" 
            type="password" 
            className="bg-slate-950/50 border-slate-700 text-white placeholder:text-slate-600 focus:border-emerald-500 h-11 rounded-xl"
            {...register("password")} 
          />
          {errors.password && <p className="text-sm text-rose-500">{errors.password.message}</p>}
        </div>

        <div className="space-y-2">
          <Label className="text-slate-300">Requested Access Level</Label>
          <Select onValueChange={(val) => setValue("role", val)} defaultValue={selectedRole}>
            <SelectTrigger className="bg-slate-950/50 border-slate-700 text-white focus:ring-emerald-500 h-11 rounded-xl">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-white">
              <SelectItem value={UserRole.CITIZEN} className="focus:bg-slate-800 focus:text-white">Citizen</SelectItem>
              <SelectItem value={UserRole.VOLUNTEER} className="focus:bg-slate-800 focus:text-white">Volunteer</SelectItem>
              <SelectItem value={UserRole.SHELTER} className="focus:bg-slate-800 focus:text-white">Shelter / Foster</SelectItem>
              <SelectItem value={UserRole.NGO} className="focus:bg-slate-800 focus:text-white">NGO / Rescue Organization</SelectItem>
              <SelectItem value={UserRole.VET} className="focus:bg-slate-800 focus:text-white">Veterinarian</SelectItem>
            </SelectContent>
          </Select>
          {errors.role && <p className="text-sm text-rose-500">{errors.role.message}</p>}
          <p className="text-xs text-emerald-400 mt-1 font-medium">{getRoleDescription(selectedRole)}</p>
        </div>

        <Button 
          type="submit" 
          className="w-full h-12 rounded-xl text-lg font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-all duration-200 mt-6" 
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
          Request Access
        </Button>
      </form>
      
      <div className="mt-8 text-sm text-center text-slate-500">
        Already have clearance?{" "}
        <Link to="/login" className="text-emerald-400 font-medium hover:text-emerald-300 transition-colors">
          Authenticate here
        </Link>
      </div>
    </div>
  );
};
export {
  RegisterForm
};
