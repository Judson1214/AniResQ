import { MainLayout } from "@/components/layout/MainLayout";
import { LegalBanner } from "@/components/common/LegalBanner";
import { ShieldCheck, PhoneCall, HeartHandshake, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";

export default function SafetyPage() {
  return (
    <MainLayout>
      <LegalBanner />
      <div className="container mx-auto py-12 px-4 max-w-4xl text-slate-200">
        <div className="space-y-4 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 text-xs font-semibold">
            <ShieldCheck size={14} /> Community & Animal Safety
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white">Safety Protocols & Guidelines</h1>
          <p className="text-slate-400 text-sm">Guidelines for safely assisting distressed animals and protecting yourself.</p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed">
          {/* Emergency Notice */}
          <section className="bg-rose-500/10 p-6 rounded-2xl border border-rose-500/20 space-y-3">
            <h2 className="text-lg font-bold text-rose-300 flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-rose-400 shrink-0" /> Immediate Life-Threatening Emergencies
            </h2>
            <p className="text-rose-200/90 font-medium">
              AniResQ relies on voluntary community responders and is NOT an immediate emergency ambulance service.
            </p>
            <p className="text-xs text-rose-300/80">
              If an animal is suffering from acute trauma, hit-and-run collision, severe bleeding, or poses an imminent threat to human safety,
              contact your city’s municipal animal helpline, nearest 24/7 veterinary clinic, or police emergency number directly.
            </p>
          </section>

          {/* Safe Handling Guide */}
          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <HeartHandshake className="w-4 h-4 text-emerald-400" /> Safe Handling Guidelines
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h3 className="font-bold text-white text-xs uppercase tracking-wider text-emerald-400">1. Assess From a Distance</h3>
                <p className="text-xs text-slate-400">
                  Frightened or injured animals can bite or scratch reflexively. Do not corner or make sudden movements towards an aggressive animal.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h3 className="font-bold text-white text-xs uppercase tracking-wider text-emerald-400">2. Protect Yourself First</h3>
                <p className="text-xs text-slate-400">
                  Always use gloves, towels, or blankets when attempting to safely restrain small dogs, cats, or birds.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h3 className="font-bold text-white text-xs uppercase tracking-wider text-emerald-400">3. Rabies Warning</h3>
                <p className="text-xs text-slate-400">
                  Never handle animals exhibiting neurological symptoms, excessive salivation, unprovoked aggression, or paralysis. Alert municipal health authorities immediately.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h3 className="font-bold text-white text-xs uppercase tracking-wider text-emerald-400">4. Provide Exact Geo-Coordinates</h3>
                <p className="text-xs text-slate-400">
                  When submitting a report, enable location services or drop an exact pin to help voluntary responders reach the animal quickly.
                </p>
              </div>
            </div>
          </section>

          {/* Scam Prevention */}
          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-emerald-400" /> Adoption Scam & Fraud Prevention
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>Never transfer money or courier fees for animal adoptions before visiting the shelter or meeting the animal in person.</li>
              <li>AniResQ does not charge adoption fees directly. Certified shelters and NGOs must be verified by administrators.</li>
              <li>If anyone demands suspicious payments or posts fraudulent requests, use the <strong>Report</strong> button immediately.</li>
            </ul>
          </section>

          {/* Action Links */}
          <div className="flex flex-wrap gap-4 pt-4">
            <Link to="/report-rescue" className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition">
              Submit Rescue Report
            </Link>
            <Link to="/contact" className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition">
              Contact Safety Team
            </Link>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
