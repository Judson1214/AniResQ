import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, CheckSquare } from "lucide-react";
const ShelterDashboard = () => {
  return <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Animals</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">45</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">30</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Apps</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">8</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Adopted</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">120</div></CardContent>
        </Card>
      </div>

      <div className="flex gap-4 mb-4">
        <Button><Plus className="mr-2 h-4 w-4" /> Add Animal</Button>
        <Button variant="outline"><CheckSquare className="mr-2 h-4 w-4" /> Review Applications</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Applications</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Applications for review will be listed here.</p></CardContent>
      </Card>
    </div>;
};
export {
  ShelterDashboard
};
