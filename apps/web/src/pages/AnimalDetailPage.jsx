import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getAnimalById } from "@/services/animal.service";
import { MainLayout } from "@/components/layout/MainLayout";
import { AnimalProfile } from "@/components/animals/AnimalProfile";
function AnimalDetailPage() {
  const { id } = useParams();
  const { data: animal, isLoading } = useQuery({
    queryKey: ["animal", id],
    queryFn: () => getAnimalById(id),
    enabled: !!id
  });
  return <MainLayout>
      <div className="container mx-auto py-12 px-4 max-w-6xl">
        {isLoading ? <div className="animate-pulse flex flex-col lg:flex-row gap-12">
            <div className="w-full lg:w-1/2 aspect-square bg-gray-200 rounded-2xl" />
            <div className="w-full lg:w-1/2 space-y-6">
              <div className="h-10 bg-gray-200 w-3/4 rounded" />
              <div className="h-6 bg-gray-200 w-1/2 rounded" />
              <div className="h-32 bg-gray-200 w-full rounded" />
            </div>
          </div> : !animal ? <div className="text-center py-20">
            <h2 className="text-2xl font-bold mb-2">Animal Not Found</h2>
            <p className="text-gray-500">The animal you are looking for does not exist or has been removed.</p>
          </div> : <AnimalProfile animal={animal} />}
      </div>
    </MainLayout>;
}
export {
  AnimalDetailPage as default
};
