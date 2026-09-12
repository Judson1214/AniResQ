import { MainLayout } from "@/components/layout/MainLayout";
import { RescueReportForm } from "@/components/rescue/RescueReportForm";
function ReportRescuePage() {
  return <MainLayout>
      <div className="container mx-auto px-4">
        <RescueReportForm />
      </div>
    </MainLayout>;
}
export {
  ReportRescuePage as default
};
