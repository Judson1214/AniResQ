import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@aniresq/shared-types";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Megaphone,
  FileText,
  Search,
  HeartHandshake,
  Users,
  Home,
  ClipboardList,
  PlusCircle,
  Syringe,
  Settings,
  Activity,
  MapPin,
  LifeBuoy,
  UserCircle
} from "lucide-react";

const Sidebar = () => {
  const { user } = useAuth();
  const location = useLocation();

  // Fallback to Admin role for the demo if not logged in
  const role = user?.role || UserRole.ADMIN;
  const displayName = user?.displayName || 'Demo Operator';
  const email = user?.email || 'admin@security.io';

  const getLinksForRole = (role) => {
    switch (role) {
      case UserRole.CITIZEN:
        return [
          { name: "My Dashboard", href: "/dashboard", icon: LayoutDashboard },
          { name: "Emergency SOS", href: "/report-rescue", icon: Megaphone },
          { name: "Adopt a Pet", href: "/animals", icon: HeartHandshake },
          { name: "Lost & Found", href: "/lost-found", icon: Search },
          { name: "Donate", href: "/donate", icon: HeartHandshake },
        ];
      case UserRole.VOLUNTEER:
      case UserRole.SHELTER:
      case UserRole.NGO:
      case UserRole.VET:
        // Responders get SOS alerts and maps
        return [
          { name: "Command Hub", href: "/dashboard", icon: LayoutDashboard },
          { name: "SOS Alerts", href: "/rescue", icon: Activity },
          { name: "Live SOS Map", href: "/rescue?map=true", icon: MapPin },
          { name: "Adoption Center", href: "/animals", icon: HeartHandshake },
          { name: "Donations", href: "/donate", icon: FileText }
        ];
      case UserRole.ADMIN:
        return [
          { name: "Platform Activity", href: "/dashboard", icon: Activity },
          { name: "Operator Registry", href: "/dashboard/users", icon: Users },
          { name: "System Settings", href: "/dashboard/settings", icon: Settings }
        ];
      default:
        return [
          { name: "Overview", href: "/dashboard", icon: LayoutDashboard }
        ];
    }
  };

  const links = getLinksForRole(user?.role || UserRole.CITIZEN);

  return (
    <aside className="w-72 bg-[#0A0F1C] text-slate-400 hidden lg:flex flex-col h-screen border-r border-slate-800">
      {/* Brand */}
      <div className="h-20 flex items-center px-8 border-b border-slate-800 shrink-0">
        <Link to="/" className="flex items-center gap-3 text-white hover:opacity-90 transition-opacity">
          <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
            <LifeBuoy size={20} strokeWidth={2.5} />
          </div>
          <span className="text-xl font-bold tracking-wide">AniResQ</span>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-8 px-4 flex flex-col gap-8">
        <div>
          <h3 className="px-4 text-[11px] font-bold tracking-widest text-slate-500 uppercase mb-4">
            Main Menu
          </h3>
          <nav className="flex flex-col gap-1.5">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.href || (location.pathname.startsWith(link.href) && link.href !== '/dashboard');
              
              return (
                <Link
                  key={link.name}
                  to={link.href}
                  className={cn(
                    "flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                    isActive 
                      ? "bg-emerald-500/10 text-emerald-400 relative" 
                      : "hover:bg-slate-800/50 hover:text-slate-200"
                  )}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />
                  )}
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className={cn(
                    isActive ? "text-emerald-400" : "text-slate-500 group-hover:text-slate-300"
                  )} />
                  {link.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      
      {/* Bottom Profile / Logout hook area */}
      <div className="p-6 border-t border-slate-800 shrink-0">
        <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800 flex items-center gap-4 hover:bg-slate-800/50 cursor-pointer transition-colors">
           <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
             <UserCircle size={20} />
           </div>
           <div className="flex-1 overflow-hidden">
             <p className="text-sm font-bold text-slate-200 truncate">{displayName}</p>
             <p className="text-xs text-slate-500 truncate">{email}</p>
           </div>
        </div>
      </div>
    </aside>
  );
};

export { Sidebar };
