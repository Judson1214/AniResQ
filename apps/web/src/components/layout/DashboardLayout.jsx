import { MainLayout } from "./MainLayout";
import { Sidebar } from "./Sidebar";
import { Bell, Search, Menu, UserCircle, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/notifications/NotificationBell";

const DashboardLayout = ({ children }) => {
  const { user, signOut } = useAuth();

  return (
    <div className="flex h-screen bg-[#06090F] overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-20 bg-[#0A0F1C] border-b border-slate-800 flex items-center justify-between px-6 lg:px-10 shrink-0 z-10">
          <div className="flex items-center gap-4 flex-1">
            <button className="lg:hidden text-slate-400 hover:text-white">
              <Menu size={24} />
            </button>
            <div className="hidden md:flex items-center gap-2 bg-[#131B2C] px-4 py-2.5 rounded-xl w-96 max-w-md border border-slate-800 focus-within:border-emerald-500 focus-within:bg-[#1A2438] transition-colors">
              <Search size={18} className="text-slate-500" />
              <input 
                type="text" 
                placeholder="Search ID, locations, status..." 
                className="bg-transparent border-none outline-none w-full text-sm text-slate-200 placeholder:text-slate-500"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-5">
            <NotificationBell buttonClassName="relative text-slate-400 hover:text-white transition-colors p-1" iconClassName="w-5 h-5" />
            <div className="h-8 w-px bg-slate-800 mx-1"></div>
            <div className="flex items-center gap-3 cursor-pointer group">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-white">{user?.displayName || 'Demo Operator'}</p>
                <p className="text-xs text-emerald-500 font-bold tracking-wide uppercase">{user?.role || 'ADMIN'}</p>
              </div>
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-10 h-10 rounded-full border-2 border-slate-700 shadow-sm" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-slate-700 transition-colors border border-slate-700">
                  <UserCircle size={24} />
                </div>
              )}
            </div>
            <button 
              onClick={signOut}
              className="ml-2 p-2 text-slate-400 hover:text-red-400 bg-slate-800/50 hover:bg-red-500/10 rounded-xl transition-colors border border-transparent hover:border-red-500/20"
              title="Sign Out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-10 scroll-smooth">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export { DashboardLayout };
