import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getAnimalById } from "@/services/animal.service";
import { MainLayout } from "@/components/layout/MainLayout";
import { AdoptionForm } from "@/components/adoption/AdoptionForm";
import { useAuth } from "@/hooks/useAuth";
function AdoptionPage() {
  const { animalId } = useParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { data: animal, isLoading } = useQuery({
    queryKey: ["animal", animalId],
    queryFn: () => getAnimalById(animalId),
    enabled: !!animalId
  });
  React.useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login?redirect=/adoption/" + animalId);
    }
  }, [isAuthenticated, authLoading, navigate, animalId]);
  if (isLoading || authLoading) return <MainLayout><div className="p-12 text-center">Loading...</div></MainLayout>;
  if (!animal) return <MainLayout><div className="p-12 text-center">Animal not found</div></MainLayout>;
  return <MainLayout>
      <div className="container mx-auto py-12 px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Adoption Application</h1>
          <p className="text-gray-600">Please answer all questions truthfully to help us find the perfect match.</p>
        </div>
        <AdoptionForm animal={animal} />
      </div>
    </MainLayout>;
}
export {
  AdoptionPage as default
};
