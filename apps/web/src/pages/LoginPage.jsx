import { LoginForm } from "@/components/auth/LoginForm";
import { Link } from "react-router-dom";
import { LifeBuoy } from "lucide-react";

const LoginPage = () => {
  return (
    <div className="min-h-screen bg-[#0A0F1C] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      
      {/* Abstract Background Effects */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[40rem] h-[40rem] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[40rem] h-[40rem] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Link 
          to="/" 
          className="flex items-center justify-center gap-3 text-white hover:opacity-90 transition-opacity mb-8"
        >
          <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
            <LifeBuoy size={28} strokeWidth={2.5} />
          </div>
          <span className="text-3xl font-bold tracking-wide">AniResQ</span>
        </Link>
        <h2 className="mt-2 text-center text-3xl font-extrabold text-white tracking-tight">
          System Authentication
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Secure access to the Command Center
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-slate-900/50 backdrop-blur-md py-8 px-4 shadow-[0_0_40px_rgba(0,0,0,0.3)] sm:rounded-[2rem] sm:px-10 border border-slate-800">
          <LoginForm />
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
