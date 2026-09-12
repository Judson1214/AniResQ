import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { loginSchema } from "@aniresq/validation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, PawPrint } from "lucide-react";
const LoginForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(loginSchema)
  });
  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      await signIn(data.email, data.password);
      toast({
        title: "Success",
        description: "You have successfully logged in."
      });
      navigate("/dashboard");
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="w-full">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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

      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <button 
          onClick={() => {
            setValue('email', 'admin@aniresq.com');
            setValue('password', 'Password123!');
            toast({ title: 'Credentials Filled', description: 'Click Authenticate to login as Admin.' });
          }}
          className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg border border-slate-700 transition-colors"
          type="button"
        >
          Auto-fill Admin
        </button>
        <button 
          onClick={() => {
            setValue('email', 'public@aniresq.com');
            setValue('password', 'Password123!');
            toast({ title: 'Credentials Filled', description: 'Click Authenticate to login as Public.' });
          }}
          className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg border border-slate-700 transition-colors"
          type="button"
        >
          Auto-fill Public
        </button>
      </div>

      <div className="mt-8 text-sm text-center text-slate-500">
        New Operator?{" "}
        <Link to="/register" className="text-emerald-400 font-medium hover:text-emerald-300 transition-colors">
          Request Access
        </Link>
      </div>
    </div>
  );
};
export {
  LoginForm
};
