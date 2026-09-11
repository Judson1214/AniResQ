import { Heart } from 'lucide-react';

const MOCK_ANIMALS = [
  {
    id: 1,
    name: 'Max',
    species: 'Dog',
    breed: 'Golden Retriever Mix',
    ageGroup: 'adult',
    gender: 'Male',
    location: 'Happy Paws Shelter',
    image: 'https://images.unsplash.com/photo-1552053831-71594a27632d?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 2,
    name: 'Luna',
    species: 'Cat',
    breed: 'Domestic Shorthair',
    ageGroup: 'young',
    gender: 'Female',
    location: 'City Animal Care',
    image: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 3,
    name: 'Charlie',
    species: 'Dog',
    breed: 'Beagle',
    ageGroup: 'young',
    gender: 'Male',
    location: 'Happy Paws Shelter',
    image: 'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
  }
];

const Animals = () => {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Adopt a Pet</h1>
          <p className="text-gray-600 mt-1">Find your new best friend</p>
        </div>
        <div className="flex gap-2">
          <select className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500">
            <option value="">All Species</option>
            <option value="dog">Dogs</option>
            <option value="cat">Cats</option>
            <option value="bird">Birds</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MOCK_ANIMALS.map((animal) => (
          <div key={animal.id} className="bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-all group">
            <div className="h-56 overflow-hidden relative">
              <img src={animal.image} alt={animal.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              <button className="absolute top-3 right-3 p-2 bg-white/80 backdrop-blur-sm rounded-full text-gray-400 hover:text-rose-500 hover:bg-white transition-colors">
                <Heart size={20} />
              </button>
            </div>
            
            <div className="p-5">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-xl font-bold text-gray-900">{animal.name}</h3>
                <span className="text-sm font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded capitalize">
                  {animal.species}
                </span>
              </div>
              
              <div className="text-sm text-gray-600 space-y-1 mb-4">
                <p>{animal.breed} • {animal.gender}</p>
                <p className="capitalize">{animal.ageGroup}</p>
                <p className="text-gray-500 text-xs mt-2">{animal.location}</p>
              </div>

              <button className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium py-2 rounded-lg transition-colors border border-rose-200">
                Meet {animal.name}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Animals;
