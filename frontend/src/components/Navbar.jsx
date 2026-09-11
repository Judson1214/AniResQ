import { Link } from 'react-router-dom';
import { Heart, Search, User } from 'lucide-react';

const Navbar = () => {
  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-rose-600 font-bold text-xl">
          <Heart className="fill-current" />
          AniResQ
        </Link>
        
        <div className="flex gap-6 text-sm font-medium text-gray-600">
          <Link to="/dashboard" className="hover:text-rose-600 transition-colors">Rescues</Link>
          <Link to="/animals" className="hover:text-rose-600 transition-colors flex items-center gap-1">
            <Search size={16} /> Adopt
          </Link>
        </div>

        <div className="flex gap-4">
          <Link to="/login" className="text-gray-600 hover:text-rose-600 font-medium px-4 py-2">
            Login
          </Link>
          <Link to="/register" className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
            Sign Up
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
