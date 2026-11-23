import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { 
  HeartHandshake, 
  Building, 
  QrCode, 
  Copy, 
  Check, 
  FileCheck2, 
  Package, 
  Mail, 
  ShieldCheck,
  Stethoscope,
  Utensils
} from "lucide-react";

const DonationPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copiedKey, setCopiedKey] = useState(null);

  const copyToClipboard = (key, text, label) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast({
      title: "Copied to clipboard",
      description: `${label}: ${text}`,
    });
    setTimeout(() => {
      setCopiedKey(null);
    }, 2500);
  };

  const content = (
    <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6 space-y-10">
      {/* Hero Header */}
      <div className="text-center space-y-3">
        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-3 py-1 text-xs uppercase tracking-wider font-bold">
          Verified Non-Profit Community Initiative
        </Badge>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Support AniResQ Life-Saving Operations
        </h1>
        <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
          100% of community contributions go directly to emergency trauma triage, emergency surgeries, 
          shelter foster boarding, and nutritional rehab for animals in distress.
        </p>
      </div>

      {/* Impact Pillars */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-slate-800 bg-[#0A0F1C] shadow-lg rounded-2xl">
          <CardContent className="p-6 text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400">
              <Stethoscope size={24} />
            </div>
            <h3 className="font-bold text-white text-base">Emergency Triage</h3>
            <p className="text-xs text-slate-400">
              Covers ambulance transport, X-rays, bloodwork, and critical emergency surgery for hit-and-run strays.
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-[#0A0F1C] shadow-lg rounded-2xl">
          <CardContent className="p-6 text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Utensils size={24} />
            </div>
            <h3 className="font-bold text-white text-base">Food & Nutrition</h3>
            <p className="text-xs text-slate-400">
              Provides daily nutritional kibble, milk replacers for orphaned litters, and medical recovery feeds.
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-[#0A0F1C] shadow-lg rounded-2xl">
          <CardContent className="p-6 text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400">
              <HeartHandshake size={24} />
            </div>
            <h3 className="font-bold text-white text-base">Shelter & Foster</h3>
            <p className="text-xs text-slate-400">
              Maintains sanctuary pens, heat lamps, vaccines, and rehabilitation until animals find forever homes.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Direct Contribution Channels */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* UPI & QR Transfer */}
        <Card className="border-slate-800 bg-[#0A0F1C] shadow-xl rounded-2xl overflow-hidden flex flex-col justify-between">
          <div>
            <CardHeader className="border-b border-slate-800 bg-slate-900/40 py-4 px-6 flex flex-row items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <QrCode size={18} />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-white">Instant UPI Transfer</CardTitle>
                <p className="text-xs text-slate-400">Directly via Google Pay, PhonePe, Paytm, or BHIM.</p>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Official UPI VPA</span>
                  <span className="text-sm font-mono font-bold text-emerald-400">aniresq@upi</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard("upi", "aniresq@upi", "UPI ID")}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs h-8"
                >
                  {copiedKey === "upi" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </Button>
              </div>

              <div className="text-xs text-slate-400 space-y-1.5 pt-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
                  <span>Beneficiary: AniResQ Welfare Foundation</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileCheck2 size={14} className="text-emerald-400 shrink-0" />
                  <span>Zero platform processing fees deducted</span>
                </div>
              </div>
            </CardContent>
          </div>
          <div className="p-4 bg-slate-900/40 border-t border-slate-800 text-[11px] text-slate-500 text-center">
            Include your email in transaction notes for an automated 80G tax receipt.
          </div>
        </Card>

        {/* Bank Wire / NEFT / IMPS */}
        <Card className="border-slate-800 bg-[#0A0F1C] shadow-xl rounded-2xl overflow-hidden flex flex-col justify-between">
          <div>
            <CardHeader className="border-b border-slate-800 bg-slate-900/40 py-4 px-6 flex flex-row items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Building size={18} />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-white">Direct Bank Wire (NEFT / IMPS)</CardTitle>
                <p className="text-xs text-slate-400">For institutional or individual direct contributions.</p>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              <div className="flex justify-between items-center text-xs py-1 border-b border-slate-800">
                <span className="text-slate-400">Account Name</span>
                <span className="font-semibold text-white">AniResQ Welfare Foundation</span>
              </div>
              <div className="flex justify-between items-center text-xs py-1 border-b border-slate-800">
                <span className="text-slate-400">Account Number</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-white">924020081234567</span>
                  <button
                    onClick={() => copyToClipboard("acc", "924020081234567", "Account Number")}
                    className="text-slate-400 hover:text-white"
                  >
                    {copiedKey === "acc" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center text-xs py-1 border-b border-slate-800">
                <span className="text-slate-400">IFSC Code</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-emerald-400">UTIB0001234</span>
                  <button
                    onClick={() => copyToClipboard("ifsc", "UTIB0001234", "IFSC Code")}
                    className="text-slate-400 hover:text-white"
                  >
                    {copiedKey === "ifsc" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center text-xs py-1">
                <span className="text-slate-400">Bank & Branch</span>
                <span className="text-slate-300">Axis Bank, Central Bangalore</span>
              </div>
            </CardContent>
          </div>
          <div className="p-4 bg-slate-900/40 border-t border-slate-800 text-[11px] text-slate-500 text-center">
            Registered Trust under 80G (Reg: AAATA1234F24).
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
            <CardTitle className="text-base font-bold text-white">Physical Supply Donations & Wishlist</CardTitle>
            <p className="text-xs text-slate-400">
              Shelters urgently welcome in-person supply drop-offs and courier deliveries.
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid gap-4 sm:grid-cols-2 text-xs text-slate-300">
            <div className="space-y-2">
              <h4 className="font-bold text-white flex items-center gap-1.5">
                <Stethoscope size={14} className="text-rose-400" /> Medical & Hygiene
              </h4>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li>Betadine solution & sterile surgical gauze</li>
                <li>Bandages, adhesive tapes, and antiseptic sprays</li>
                <li>Deworming tablets (Puppy & Adult)</li>
                <li>Flea & tick spot-on treatments</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-white flex items-center gap-1.5">
                <Utensils size={14} className="text-amber-400" /> Food & Shelter Goods
              </h4>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li>Commercial dog/cat dry food & gravy pouches</li>
                <li>Stainless steel feeding and water bowls</li>
                <li>Clean blankets, towels, and fleece bedding</li>
                <li>Leashes, slip leads, and transport crates</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <Mail size={14} className="text-emerald-400 shrink-0" />
              <span>To schedule a drop-off or donate equipment, email <span className="text-white font-semibold">donations@aniresq.org</span></span>
            </div>
            <a
              href="mailto:donations@aniresq.org?subject=Supply Donation Drop-off Inquiry"
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold border border-slate-700 transition-colors"
            >
              Contact Shelter Logistics
            </a>
          </div>
        </CardContent>
      </Card>
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
