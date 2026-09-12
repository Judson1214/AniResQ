import { AnimalCard } from "./AnimalCard";
const AnimalGrid = ({ animals, isLoading }) => {
  if (isLoading) {
    return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <div key={i} className="rounded-lg border bg-card text-card-foreground shadow-sm animate-pulse">
            <div className="h-64 bg-gray-200 rounded-t-lg" />
            <div className="p-5 space-y-4">
              <div className="h-6 bg-gray-200 rounded w-1/2" />
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="flex gap-2">
                <div className="h-6 w-16 bg-gray-200 rounded" />
                <div className="h-6 w-16 bg-gray-200 rounded" />
              </div>
              <div className="h-10 bg-gray-200 rounded w-full mt-4" />
            </div>
          </div>)}
      </div>;
  }
  if (animals.length === 0) {
    return <div className="py-20 text-center bg-gray-50 rounded-xl border border-dashed">
        <h3 className="text-xl font-semibold text-gray-700 mb-2">No animals found</h3>
        <p className="text-gray-500">Try adjusting your filters to see more results.</p>
      </div>;
  }
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {animals.map((animal) => <AnimalCard key={animal.id} animal={animal} />)}
    </div>;
};
export {
  AnimalGrid
};
