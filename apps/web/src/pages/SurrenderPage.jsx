import { MainLayout } from "@/components/layout/MainLayout";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DonateAnimalForm } from "@/components/surrender/DonateAnimalForm";
import { useAuth } from "@/hooks/useAuth";

const SurrenderPage = () => {
  const { user } = useAuth();
  
  const content = (
    <div className="container mx-auto py-8 px-4">
      <DonateAnimalForm />
    </div>
  );

  if (user) {
    return <DashboardLayout>{content}</DashboardLayout>;
  }

  return <MainLayout>{content}</MainLayout>;
};

export default SurrenderPage;
