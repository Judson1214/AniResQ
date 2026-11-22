import { Link } from "react-router-dom";
import { PawPrint, Heart, Github, Twitter, Instagram } from "lucide-react";
const Footer = () => {
  return <footer className="border-t bg-white pt-12 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-1 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="bg-emerald-600 p-1.5 rounded-lg">
                <PawPrint className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight text-gray-900">AniResQ</span>
            </Link>
            <p className="text-gray-500 text-sm mb-4">
              A community-driven platform dedicated to animal rescue, fostering, and adoption. Every life matters.
            </p>
            <div className="flex gap-4 text-gray-400">
              <a href="#" className="hover:text-emerald-600 transition-colors"><Twitter className="w-5 h-5" /></a>
              <a href="#" className="hover:text-emerald-600 transition-colors"><Instagram className="w-5 h-5" /></a>
              <a href="#" className="hover:text-emerald-600 transition-colors"><Github className="w-5 h-5" /></a>
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Platform</h3>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link to="/rescue" className="hover:text-emerald-600">Rescue Map</Link></li>
              <li><Link to="/animals" className="hover:text-emerald-600">Adopt an Animal</Link></li>
              <li><Link to="/lost-found" className="hover:text-emerald-600">Lost & Found</Link></li>
              <li><Link to="/report-rescue" className="hover:text-emerald-600">Report an Emergency</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Community</h3>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link to="/register" className="hover:text-emerald-600">Join as Volunteer</Link></li>
              <li><Link to="/register" className="hover:text-emerald-600">Register Shelter</Link></li>
              <li><Link to="/register" className="hover:text-emerald-600">Veterinarian Access</Link></li>
              <li><a href="#" className="hover:text-emerald-600">Success Stories</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Support</h3>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><a href="#" className="hover:text-emerald-600">Help Center</a></li>
              <li><a href="#" className="hover:text-emerald-600">Contact Us</a></li>
              <li><a href="#" className="hover:text-emerald-600">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-emerald-600">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t pt-8 flex flex-col md:flex-row items-center justify-between text-sm text-gray-500">
          <p>© {(/* @__PURE__ */ new Date()).getFullYear()} AniResQ. All rights reserved.</p>
          <p className="flex items-center gap-1 mt-4 md:mt-0">
            Made with <Heart className="w-4 h-4 text-red-500 fill-red-500" /> for animals
          </p>
        </div>
      </div>
    </footer>;
};
export {
  Footer
};
