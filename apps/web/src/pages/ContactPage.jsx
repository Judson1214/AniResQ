import { MainLayout } from "@/components/layout/MainLayout";
import { LegalBanner } from "@/components/common/LegalBanner";
import { Mail, Shield, PhoneCall } from "lucide-react";
import { Link } from "react-router-dom";

export default function ContactPage() {
  const orgName = import.meta.env.VITE_ORG_NAME || "AniResQ";
  const contactEmail = import.meta.env.VITE_CONTACT_EMAIL || "support@aniresq.org";

  return (
    <MainLayout>
      <LegalBanner />
      <div className="container mx-auto py-12 px-4 max-w-4xl text-slate-200">
        <div className="space-y-4 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold">
            <Mail size={14} /> Get in Touch
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white">Contact & Support</h1>
          <p className="text-slate-400 text-sm">Reach the {orgName} core community team, report safety issues, or request assistance.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 text-sm">
          <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">General Inquiries & Pilot Feedback</h2>
              <p className="text-xs text-slate-400 mt-1">For general questions, partner onboarding, and community pilot feedback.</p>
            </div>
            <a
              href={`mailto:${contactEmail}`}
              className="inline-block text-emerald-400 font-mono text-sm underline hover:text-emerald-300"
            >
              {contactEmail}
            </a>
          </div>

          <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Abuse, Fraud & Safety Reports</h2>
              <p className="text-xs text-slate-400 mt-1">Report harmful behavior, fake rescue requests, or platform misuse.</p>
            </div>
            <p className="text-xs text-slate-300">
              You can click the <strong>Flag / Report</strong> button on any rescue card or sighting post. For urgent security or privacy matters:
            </p>
            <a
              href={`mailto:${contactEmail}?subject=[SAFETY-REPORT]`}
              className="inline-block text-rose-400 font-mono text-sm underline hover:text-rose-300"
            >
              safety@{contactEmail.split("@")[1] || "aniresq.org"}
            </a>
          </div>

          <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4 md:col-span-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                <PhoneCall className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Animal Emergency Helplines</h2>
                <p className="text-xs text-slate-400">If you are witnessing acute animal distress or medical emergencies, contact local helplines.</p>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span>Read our safety guidelines for step-by-step guidance on safely handling distressed animals.</span>
              <Link to="/safety" className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shrink-0 transition text-center">
                View Safety Protocols
              </Link>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
