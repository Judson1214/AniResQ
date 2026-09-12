import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
const NGODashboard = () => {
  return <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rescues</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">15</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved (Month)</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">42</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Volunteers</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">28</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Shelters</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">3</div></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Unassigned Rescues</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Assign volunteers to these emergencies.</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Volunteer Roster</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Manage your active volunteers.</p></CardContent>
        </Card>
      </div>
    </div>;
};
export {
  NGODashboard
};
