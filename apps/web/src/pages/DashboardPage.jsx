import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@aniresq/shared-types";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CitizenDashboard } from "@/components/dashboard/CitizenDashboard";
import { VolunteerDashboard } from "@/components/dashboard/VolunteerDashboard";
import { ShelterDashboard } from "@/components/dashboard/ShelterDashboard";
import { NGODashboard } from "@/components/dashboard/NGODashboard";
import { VetDashboard } from "@/components/dashboard/VetDashboard";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";

function DashboardPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <DashboardLayout><div className="p-8">Loading Command Center...</div></DashboardLayout>;
  
  // If it's a citizen, show the Citizen dashboard.
  // Otherwise (admin, volunteer, vet, shelter, ngo) show the Admin/Command Center dashboard for now.
  const isCitizen = user?.role === UserRole.CITIZEN;

  return (
    <DashboardLayout>
      <div className="w-full">
        {isCitizen ? <CitizenDashboard /> : <AdminDashboard />}
      </div>
    </DashboardLayout>
  );
}

export default DashboardPage;
