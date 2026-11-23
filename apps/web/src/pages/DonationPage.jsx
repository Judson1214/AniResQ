import { MainLayout } from "@/components/layout/MainLayout";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { 
  HeartHandshake, 
  Package, 
  Mail, 
  Stethoscope,
  Utensils,
  ArrowRight,
  ShieldAlert,
  Info
} from "lucide-react";
import { Link } from "react-router-dom";

const DonationPage = () => {
  const { user } = useAuth();

  const content = (
    <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6 space-y-8">
      {/* DEMO / INACTIVE FINANCIALS BANNER */}
      <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-2 animate-in fade-in">
        <div className="flex items-center gap-2.5 text-amber-400 font-bold text-base">
          <ShieldAlert size={20} className="shrink-0" />
          <span>Demonstration Environment — Financial Contributions Not Active</span>
        </div>
        <p className="text-xs sm:text-sm text-amber-200/90 leading-relaxed">
          AniResQ is currently operating in a technical demonstration environment. Online payment processing, 
          direct bank transfers, and 80G tax-exempt monetary contributions are <strong>not active</strong>. 
          Please do not attempt to wire funds or make financial payments.
        </p>
      </div>

      {/* Header */}
      <div className="text-center space-y-3">
        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-3 py-1 text-xs uppercase tracking-wider font-bold">
          Community Pet Welfare Support
        </Badge>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Support Animal Rescue & Care
        </h1>
        <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
          While direct monetary donations are paused during platform rollout, community shelters 
          and volunteer responders urgently need physical pet supplies, foster homes, and field volunteers.
        </p>
      </div>

      {/* Action / Help Pillars */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-slate-800 bg-[#0A0F1C] shadow-lg rounded-2xl flex flex-col justify-between">
          <CardContent className="p-6 text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <HeartHandshake size={24} />
            </div>
            <h3 className="font-bold text-white text-base">Adopt or Foster</h3>
            <p className="text-xs text-slate-400">
              Opening your home to a rescued dog or cat frees up critical shelter space and medical resources.
            </p>
          </CardContent>
          <div className="p-4 pt-0">
            <Link
              to="/animals"
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
            >
              Browse Animals <ArrowRight size={14} />
            </Link>
          </div>
        </Card>

        <Card className="border-slate-800 bg-[#0A0F1C] shadow-lg rounded-2xl flex flex-col justify-between">
          <CardContent className="p-6 text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Package size={24} />
            </div>
            <h3 className="font-bold text-white text-base">Physical Supplies</h3>
            <p className="text-xs text-slate-400">
              Partner facilities accept direct drop-offs of kibble, antiseptics, clean blankets, and transport crates.
            </p>
          </CardContent>
          <div className="p-4 pt-0">
            <a
              href="mailto:supplies@aniresq.org?subject=Physical Supply Donation Inquiry"
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
            >
              Coordinate Drop-off <ArrowRight size={14} />
            </a>
          </div>
        </Card>

        <Card className="border-slate-800 bg-[#0A0F1C] shadow-lg rounded-2xl flex flex-col justify-between">
          <CardContent className="p-6 text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400">
              <Stethoscope size={24} />
            </div>
            <h3 className="font-bold text-white text-base">Volunteer in Field</h3>
            <p className="text-xs text-slate-400">
              Sign up as a verified volunteer to assist in rescue dispatches and emergency transports.
            </p>
          </CardContent>
          <div className="p-4 pt-0">
            <Link
              to="/profile"
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
            >
              Request Clearance <ArrowRight size={14} />
            </Link>
          </div>
        </Card>
      </div>

      {/* In-Kind Supplies Wishlist */}
      <Card className="border-slate-800 bg-[#0A0F1C] shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-800 bg-slate-900/40 py-4 px-6 flex flex-row items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Package size={18} />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-white">Shelter & Clinic Supply Wishlist</CardTitle>
            <p className="text-xs text-slate-400">
              Items immediately usable by local shelter veterinarians and caregivers.
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid gap-6 sm:grid-cols-2 text-xs text-slate-300">
            <div className="space-y-2.5">
              <h4 className="font-bold text-white flex items-center gap-1.5 text-sm">
                <Stethoscope size={16} className="text-rose-400" /> Medical & First-Aid Supplies
              </h4>
              <ul className="list-disc list-inside space-y-1.5 text-slate-400">
                <li>Betadine / Povidone-iodine topical antiseptic solutions</li>
                <li>Sterile surgical gauze, elastic crepe bandages, and medical tape</li>
                <li>Deworming and anti-parasitic treatments (veterinary approved)</li>
                <li>Disposable examination gloves and digital thermometers</li>
              </ul>
            </div>
            <div className="space-y-2.5">
              <h4 className="font-bold text-white flex items-center gap-1.5 text-sm">
                <Utensils size={16} className="text-amber-400" /> Food, Bedding & Hardware
              </h4>
              <ul className="list-disc list-inside space-y-1.5 text-slate-400">
                <li>Quality puppy/kitten and adult dog/cat commercial kibble</li>
                <li>Stainless steel feeding and water bowls (hygienic & chew-proof)</li>
                <li>Clean, washed blankets, towels, and fleece bedding</li>
                <li>Adjustable nylon leashes, slip leads, and travel animal crates</li>
              </ul>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <Mail size={14} className="text-emerald-400 shrink-0" />
              <span>For supply delivery drop-off locations, contact <span className="text-white font-semibold">supplies@aniresq.org</span></span>
            </div>
            <a
              href="mailto:supplies@aniresq.org?subject=Supply Drop-off Inquiry"
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold border border-slate-700 transition-colors"
            >
              Contact Shelter Team
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Trust Notice */}
      <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs flex items-start gap-3">
        <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
        <p>
          AniResQ strictly operates with transparency. When online payment and donation infrastructure is officially 
          launched with certified payment gateways and partner NGO compliance, official verified portals will be published here.
        </p>
      </div>
    </div>
  );

  if (user) {
    return <DashboardLayout>{content}</DashboardLayout>;
  }

  return (
    <MainLayout>
      <div className="bg-[#060A14] min-h-screen">{content}</div>
    </MainLayout>
  );
};

export default DonationPage;
