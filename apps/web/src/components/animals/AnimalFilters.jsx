import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Species, AdoptionStatus } from "@aniresq/shared-types";
const AnimalFilters = ({ filters, setFilters }) => {
  const handleChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };
  const handleClear = () => {
    setFilters({ species: "All", gender: "All", status: "All", search: "" });
  };
  return <div className="bg-white p-4 rounded-lg shadow-sm border mb-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Search</label>
          <Input
    placeholder="Search by name..."
    value={filters.search}
    onChange={(e) => handleChange("search", e.target.value)}
  />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Species</label>
          <select
    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
    value={filters.species}
    onChange={(e) => handleChange("species", e.target.value)}
  >
            <option value="All">All Species</option>
            {Object.values(Species).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Status</label>
          <select
    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
    value={filters.status}
    onChange={(e) => handleChange("status", e.target.value)}
  >
            <option value="All">All Statuses</option>
            {Object.values(AdoptionStatus).map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
        </div>

        <Button variant="outline" onClick={handleClear} className="w-full">
          Clear Filters
        </Button>
      </div>
    </div>;
};
export {
  AnimalFilters
};
