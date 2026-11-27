import { MainLayout } from "@/components/layout/MainLayout";
import { LegalBanner } from "@/components/common/LegalBanner";
import { FileText, AlertTriangle, Scale, CheckCircle, ShieldAlert } from "lucide-react";

export default function TermsPage() {
  const orgName = import.meta.env.VITE_ORG_NAME || "AniResQ";
  const contactEmail = import.meta.env.VITE_CONTACT_EMAIL || "support@aniresq.org";

  return (
    <MainLayout>
      <LegalBanner />
      <div className="container mx-auto py-12 px-4 max-w-4xl text-slate-200">
        <div className="space-y-4 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
            <FileText size={14} /> Platform Agreement
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white">Terms of Service</h1>
          <p className="text-slate-400 text-sm">Last updated: November 27, 2026 • Version 2026-11-27</p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed">
          <section className="bg-amber-500/10 p-6 rounded-2xl border border-amber-500/20 space-y-3">
            <h2 className="text-lg font-bold text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" /> Important Emergency Disclaimer
            </h2>
            <p className="text-amber-200/90 font-medium">
              {orgName} is an asynchronous community facilitation tool connecting citizens, volunteers, and shelters.
              <strong> IT IS NOT AN EMERGENCY DISPATCH SERVICE OR A SUBSTITUTE FOR IMMEDIATE VETERINARY OR MUNICIPAL AID.</strong>
            </p>
            <p className="text-xs text-amber-300/80">
              In severe emergencies involving immediate danger, aggressive wild animals, or suspected rabies, users must contact local municipal
              authorities, police, or licensed veterinary emergency hospitals immediately.
            </p>
          </section>

          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" /> 1. Community Conduct & Reporting
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>Users must submit truthful, genuine reports regarding stray, lost, or injured animals.</li>
              <li>Fake reports, deliberate spam, harassment, and fraudulent adoption fees are strictly prohibited.</li>
              <li>Any user found abusing the platform or posting malicious content is subject to immediate account disabling and reporting to authorities.</li>
            </ul>
          </section>

          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-emerald-400" /> 2. Content Moderation & Abuse Reporting
            </h2>
            <p>
              Community members can report any inappropriate rescue request, lost & found sighting, or user account via the built-in
              &quot;Report&quot; feature. Platform administrators review incoming reports and take appropriate actions, including content removal
              and account suspension.
            </p>
          </section>

          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Scale className="w-4 h-4 text-emerald-400" /> 3. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by applicable law, {orgName} and its volunteer contributors disclaim liability for
              any injuries, damages, property loss, or veterinary costs incurred while engaging in rescue operations or interactions
              coordinated through the platform. Users operate voluntarily and at their own risk.
            </p>
          </section>

          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-lg font-bold text-white">4. Questions & Support</h2>
            <p>
              For legal inquiries regarding these terms, reach us at{" "}
              <a href={`mailto:${contactEmail}`} className="text-emerald-400 underline hover:text-emerald-300">
                {contactEmail}
              </a>.
            </p>
          </section>
        </div>
      </div>
    </MainLayout>
  );
}
