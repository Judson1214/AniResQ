import { MainLayout } from "@/components/layout/MainLayout";
import { LegalBanner } from "@/components/common/LegalBanner";
import { Shield, Lock, Eye, Download, Trash2, Mail } from "lucide-react";

export default function PrivacyPage() {
  const orgName = import.meta.env.VITE_ORG_NAME || "AniResQ";
  const contactEmail = import.meta.env.VITE_CONTACT_EMAIL || "privacy@aniresq.org";

  return (
    <MainLayout>
      <LegalBanner />
      <div className="container mx-auto py-12 px-4 max-w-4xl text-slate-200">
        <div className="space-y-4 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
            <Shield size={14} /> Privacy & Data Protection
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white">Privacy Policy</h1>
          <p className="text-slate-400 text-sm">Last updated: November 27, 2026 • Community Pilot Version</p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed">
          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" /> 1. Commitment to Data Minimization
            </h2>
            <p>
              At {orgName}, we collect and process only the minimum personal data required to connect citizens,
              volunteers, shelters, and veterinary clinics for animal rescue, lost pet reunifications, and adoptions.
            </p>
            <p>
              <strong>ID Verification Minimization:</strong> When volunteers or partner organizations apply for elevated roles,
              any uploaded identity document is stored in a private, restricted storage bucket accessible only to administrators.
              Once your verification request is reviewed (approved or declined), the uploaded document is permanently deleted from
              our servers, and only the last 4 characters of the ID number are retained in audit records.
            </p>
          </section>

          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-400" /> 2. Information We Collect
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>
                <strong>Account Information:</strong> Display name, email address, password hash, and optional phone number.
              </li>
              <li>
                <strong>Rescue & Lost Pet Reports:</strong> Location coordinates, descriptions, and user-submitted photographs of animals.
              </li>
              <li>
                <strong>Adoption Applications:</strong> Details provided voluntarily in adoption inquiries (e.g., household experience).
              </li>
              <li>
                <strong>Technical Logs & Auditing:</strong> Security audit logs recording state mutations (e.g. role changes, dispatch updates).
              </li>
            </ul>
          </section>

          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-400" /> 3. Your Rights: Export & Self-Service Deletion
            </h2>
            <p>
              We believe in full transparency and ownership over your personal data:
            </p>
            <div className="grid sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h3 className="font-bold text-white flex items-center gap-1.5">
                  <Download size={14} className="text-blue-400" /> Data Export (Portability)
                </h3>
                <p className="text-xs text-slate-400">
                  You can download a complete machine-readable (.json) copy of your personal profile, rescue reports,
                  and notifications directly from your Profile settings at any time.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h3 className="font-bold text-white flex items-center gap-1.5">
                  <Trash2 size={14} className="text-rose-400" /> Self-Service Account Deletion
                </h3>
                <p className="text-xs text-slate-400">
                  You can permanently delete your account at any time from your Profile settings. This purges your authentication credentials,
                  uploaded documents, and removes your personal identifiers.
                </p>
              </div>
            </div>
          </section>

          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-400" /> 4. Contact & Privacy Inquiries
            </h2>
            <p>
              If you have any questions or data privacy requests, contact our designated privacy team at{" "}
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
