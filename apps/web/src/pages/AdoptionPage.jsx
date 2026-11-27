import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getAnimalById } from "@/services/animal.service";
import { MainLayout } from "@/components/layout/MainLayout";
import { AdoptionForm } from "@/components/adoption/AdoptionForm";

function AdoptionPage() {
  const { animalId } = useParams();
  const { data: animal, isLoading } = useQuery({
    queryKey: ["animal", animalId],
    queryFn: () => getAnimalById(animalId),
    enabled: !!animalId
  });

  if (isLoading) return <MainLayout><div className="p-12 text-center text-slate-400">Loading animal details...</div></MainLayout>;
  if (!animal) return <MainLayout><div className="p-12 text-center text-slate-400">Animal not found</div></MainLayout>;
  return (
    <MainLayout>
      <div className="container mx-auto py-12 px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Adoption Application</h1>
          <p className="text-gray-600">Please answer all questions truthfully to help us find the perfect match.</p>
        </div>
        <AdoptionForm animal={animal} />
      </div>
    </MainLayout>
  );
}

export { AdoptionPage as default };
