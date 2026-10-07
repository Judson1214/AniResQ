import { Card, CardContent } from "@/components/ui/card";
import { HeartHandshake, MapPin, Megaphone, ArrowRight, Clock, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { getRescueRequests } from "@/services/rescue.service";
import { RescueCard } from "@/components/rescue/RescueCard";

const CitizenDashboard = () => {
  const { user } = useAuth();

  const { data: myRescues, isLoading } = useQuery({
    queryKey: ["my-rescues", user?.uid],
    queryFn: () => getRescueRequests({ reporterId: user?.uid }),
    enabled: !!user?.uid,
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto py-4">
      
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight">Citizen Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">Welcome! How would you like to help animals today?</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* SOS Card */}
        <Link to="/report-rescue" className="block group">
          <Card className="border-rose-500/20 bg-rose-500/5 shadow-xl shadow-black/20 rounded-3xl hover:bg-rose-500/10 transition-colors h-full">
            <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform">
                <Megaphone size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Emergency SOS</h3>
                <p className="text-sm text-slate-400">Report an injured or stray animal immediately for rescue operations.</p>
              </div>
              <div className="pt-4 text-rose-400 font-bold flex items-center gap-2 group-hover:gap-3 transition-all">
                Report Now <ArrowRight size={16} />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Adoption Card */}
        <Link to="/animals" className="block group">
          <Card className="border-blue-500/20 bg-blue-500/5 shadow-xl shadow-black/20 rounded-3xl hover:bg-blue-500/10 transition-colors h-full">
            <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                <HeartHandshake size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Adopt a Pet</h3>
                <p className="text-sm text-slate-400">Find your new best friend from our network of verified local shelters.</p>
              </div>
              <div className="pt-4 text-blue-400 font-bold flex items-center gap-2 group-hover:gap-3 transition-all">
                View Animals <ArrowRight size={16} />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Donation Card */}
        <Link to="/donate" className="block group">
          <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-xl shadow-black/20 rounded-3xl hover:bg-emerald-500/10 transition-colors h-full">
            <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                <div className="font-serif text-3xl font-bold">$</div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Make a Donation</h3>
                <p className="text-sm text-slate-400">Support our partner NGOs and shelters to fund medical care and food.</p>
              </div>
              <div className="pt-4 text-emerald-400 font-bold flex items-center gap-2 group-hover:gap-3 transition-all">
                Donate <ArrowRight size={16} />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Surrender Card */}
        <Link to="/surrender" className="block group">
          <Card className="border-purple-500/20 bg-purple-500/5 shadow-xl shadow-black/20 rounded-3xl hover:bg-purple-500/10 transition-colors h-full">
            <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform">
                <HeartHandshake size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Donate an Animal</h3>
                <p className="text-sm text-slate-400">List an animal for adoption or surrender them to our trusted network.</p>
              </div>
              <div className="pt-4 text-purple-400 font-bold flex items-center gap-2 group-hover:gap-3 transition-all">
                Donate Animal <ArrowRight size={16} />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Lost & Found Banner */}
      <Link to="/lost-found" className="block group mt-8">
        <div className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-blue-500/50 transition-colors">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Lost & Found Pets</h2>
            <p className="text-slate-400">Help reunite missing pets with their families, or report a found animal.</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-8 h-12 shadow-lg shadow-blue-500/20 shrink-0">
            View Reports
          </Button>
        </div>
      </Link>

      {/* My Reported Rescues Section */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-white mb-6">My Reported SOS Dispatches</h2>
        
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : myRescues && myRescues.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2">
            {myRescues.map((rescue) => (
              <RescueCard key={rescue.id} rescue={rescue} />
            ))}
          </div>
        ) : (
          <div className="bg-[#131B2C] border border-slate-800 rounded-3xl p-12 text-center text-slate-400">
            <Clock className="w-12 h-12 mx-auto text-slate-600 mb-4" />
            <h3 className="text-lg font-bold text-slate-300">No SOS Alerts Reported</h3>
            <p className="mt-2 text-sm">You haven't reported any animal emergencies yet. If you see an animal in need, use the Emergency SOS button above.</p>
          </div>
        )}
      </div>

    </div>
  );
};

export { CitizenDashboard };
