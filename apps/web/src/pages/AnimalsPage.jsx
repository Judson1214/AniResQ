import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAnimals } from "@/services/animal.service";
import { MainLayout } from "@/components/layout/MainLayout";
import { AnimalGrid } from "@/components/animals/AnimalGrid";
import { AnimalFilters } from "@/components/animals/AnimalFilters";
function AnimalsPage() {
  const [filters, setFilters] = useState({
    species: "All",
    gender: "All",
    status: "AVAILABLE",
    search: ""
  });
  const { data: animals, isLoading } = useQuery({
    queryKey: ["animals", filters],
    queryFn: () => getAnimals({
      species: filters.species !== "All" ? filters.species : void 0,
      adoptionStatus: filters.status !== "All" ? filters.status : void 0
    })
  });
  const filteredAnimals = animals?.filter(
    (animal) => !filters.search || animal.name.toLowerCase().includes(filters.search.toLowerCase())
  ) || [];
  return <MainLayout>
      <div className="bg-emerald-50 py-16 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">Find Your New Best Friend</h1>
          <p className="text-lg text-gray-600">
            Browse our list of lovable animals waiting for a forever home. 
            Every adoption saves a life and makes room for another rescue.
          </p>
        </div>
      </div>

      <div className="container mx-auto py-12 px-4">
        <AnimalFilters filters={filters} setFilters={setFilters} />
        
        <div className="mb-6 flex justify-between items-center text-sm text-gray-500">
          <p>Showing {filteredAnimals.length} animal{filteredAnimals.length !== 1 ? "s" : ""}</p>
        </div>

        <AnimalGrid animals={filteredAnimals} isLoading={isLoading} />
      </div>
    </MainLayout>;
}
export {
  AnimalsPage as default
};
