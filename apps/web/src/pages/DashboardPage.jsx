import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@aniresq/shared-types";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CitizenDashboard } from "@/components/dashboard/CitizenDashboard";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { VolunteerDashboard } from "@/components/dashboard/VolunteerDashboard";
import { ShelterDashboard } from "@/components/dashboard/ShelterDashboard";
import { NGODashboard } from "@/components/dashboard/NGODashboard";
import { VetDashboard } from "@/components/dashboard/VetDashboard";

function DashboardPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <DashboardLayout><div className="p-8">Loading Command Center...</div></DashboardLayout>;

  const renderDashboard = () => {
    switch (user?.role) {
      case UserRole.ADMIN:
        return <AdminDashboard />;
      case UserRole.VOLUNTEER:
        return <VolunteerDashboard />;
      case UserRole.SHELTER:
        return <ShelterDashboard />;
      case UserRole.NGO:
        return <NGODashboard />;
      case UserRole.VET:
        return <VetDashboard />;
      case UserRole.CITIZEN:
      default:
        return <CitizenDashboard />;
    }
  };

  return (
    <DashboardLayout>
      <div className="w-full">
        {renderDashboard()}
      </div>
    </DashboardLayout>
  );
}

export default DashboardPage;
