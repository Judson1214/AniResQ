import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
const VetDashboard = () => {
  return <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Examinations</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">34</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cleared</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">28</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">6</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Pending Medical Reviews</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">List of animals needing medical attention (Phase 2 feature).</p></CardContent>
      </Card>
    </div>;
};
export {
  VetDashboard
};
