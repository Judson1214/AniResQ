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
import { Loader2, Info } from "lucide-react";
import { UserRole } from "@aniresq/shared-types";

const RegisterForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: UserRole.CITIZEN
    }
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      await signUp(
        data.email,
        data.password,
        data.displayName,
        data.phone
      );
      toast({
        title: "Account Created",
        description: "Welcome to AniResQ!"
      });
      navigate("/dashboard");
    } catch (error) {
      console.error(error);
      toast({
        title: "Registration Failed",
        description: error.message || "An error occurred during sign up.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
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

        <div className="flex items-start gap-2.5 text-xs text-emerald-300 bg-emerald-500/10 p-3.5 rounded-xl border border-emerald-500/20">
          <Info size={16} className="shrink-0 mt-0.5 text-emerald-400" />
          <div className="space-y-1">
            <span className="font-semibold text-emerald-200">Standard Citizen Registration:</span>
            <p className="text-emerald-300/80 leading-relaxed">
              All accounts start with standard Citizen access. Responders, Shelters, NGOs, and Veterinarians can upload verified credentials and request role clearance from their Profile after signing in.
            </p>
          </div>
        </div>

        <Button 
          type="submit" 
          className="w-full h-12 rounded-xl text-lg font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-all duration-200 mt-6" 
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
          Create Account
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

export { RegisterForm };
