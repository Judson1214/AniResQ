import { MainLayout } from "@/components/layout/MainLayout";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

const DonationPage = () => {
  const { user } = useAuth();
  
  const content = (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-black text-white tracking-tight mb-4">Support the Mission</h1>
        <p className="text-slate-400 max-w-2xl mx-auto">Your donations directly fund emergency medical care, food, and shelter for rescued animals across our network.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {[25, 50, 100].map(amount => (
          <Card key={amount} className="border-slate-800 bg-[#131B2C] hover:border-emerald-500/50 cursor-pointer transition-colors group">
            <CardContent className="p-8 text-center">
              <div className="text-4xl font-black text-emerald-400 mb-2">${amount}</div>
              <p className="text-sm text-slate-400 group-hover:text-slate-300">One-time donation</p>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Card className="border-slate-800 bg-[#131B2C]">
        <CardContent className="p-8 text-center text-slate-400">
          <p>Payment gateway integration (Stripe/Razorpay) goes here.</p>
        </CardContent>
      </Card>
    </div>
  );

  if (user) {
    return <DashboardLayout>{content}</DashboardLayout>;
  }

  return <MainLayout><div className="bg-[#0A0F1C] min-h-screen">{content}</div></MainLayout>;
};

export default DonationPage;
