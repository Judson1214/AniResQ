import { MainLayout } from "@/components/layout/MainLayout";
import { RescueReportForm } from "@/components/rescue/RescueReportForm";
import { EmergencyNoticeBanner } from "@/components/common/EmergencyNoticeBanner";

function ReportRescuePage() {
  return (
    <MainLayout>
      <EmergencyNoticeBanner />
      <div className="container mx-auto px-4 py-4">
        <RescueReportForm />
      </div>
    </MainLayout>
  );
}
export {
  ReportRescuePage as default
};
