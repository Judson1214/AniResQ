import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { loginSchema } from "@aniresq/validation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle } from "lucide-react";
import { sanitizeReturnTo } from "@/lib/utils";

const LoginForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    setLoginError("");
    try {
      await signIn(data.email, data.password);
      toast({
        title: "Success",
        description: "You have successfully logged in."
      });
      const rawReturnTo = searchParams.get("returnTo") || location.state?.from?.pathname;
      const targetPath = sanitizeReturnTo(rawReturnTo);
      navigate(targetPath, { replace: true });
    } catch (error) {
      const msg = error.message || "Invalid email or password.";
      setLoginError(msg);
      toast({
        title: "Login Failed",
        description: msg,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {loginError && (
          <div role="alert" className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{loginError}</span>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-slate-300">Operator Email</Label>
          <Input 
            id="email" 
            type="email" 
            placeholder="operator@aniresq.org" 
            className="bg-slate-950/50 border-slate-700 text-white placeholder:text-slate-600 focus:border-emerald-500 h-12 rounded-xl"
            {...register("email")} 
          />
          {errors.email && <p className="text-sm text-rose-500">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-slate-300">Security Clearance (Password)</Label>
          </div>
          <Input 
            id="password" 
            type="password" 
            className="bg-slate-950/50 border-slate-700 text-white placeholder:text-slate-600 focus:border-emerald-500 h-12 rounded-xl"
            {...register("password")} 
          />
          {errors.password && <p className="text-sm text-rose-500">{errors.password.message}</p>}
        </div>
        <Button 
          type="submit" 
          className="w-full h-12 rounded-xl text-lg font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-all duration-200 mt-4" 
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
          Authenticate
        </Button>
      </form>

      <div className="mt-8 text-sm text-center text-slate-500">
        New Operator?{" "}
        <Link to="/register" className="text-emerald-400 font-medium hover:text-emerald-300 transition-colors">
          Request Access
        </Link>
      </div>
    </div>
  );
};

export { LoginForm };
