import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Eye, Heart, Home, Radio, ArrowRight, ShieldCheck, MapPin, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getFeaturedAnimals } from "@/services/animal.service";
import { AnimalCard } from "@/components/animals/AnimalCard";
import { motion } from "framer-motion";

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: "easeOut" }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

function HomePage() {
  const { data: featuredAnimals, isLoading } = useQuery({
    queryKey: ["featured-animals"],
    queryFn: () => getFeaturedAnimals(4)
  });

  return (
    <MainLayout>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-emerald-50 via-teal-50 to-white overflow-hidden py-24 lg:py-40">
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: "radial-gradient(#14b8a6 2px, transparent 2px)", backgroundSize: "40px 40px" }} />
        
        {/* Floating background shapes */}
        <motion.div 
          animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-20 right-10 w-64 h-64 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50"
        />
        <motion.div 
          animate={{ y: [0, 20, 0], rotate: [0, -5, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-10 left-10 w-72 h-72 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50"
        />

        <div className="container mx-auto px-4 relative z-10 flex flex-col lg:flex-row items-center gap-16">
          <motion.div 
            initial="initial"
            animate="animate"
            variants={staggerContainer}
            className="flex-1 text-center lg:text-left space-y-8"
          >
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 text-emerald-800 text-sm font-semibold tracking-wide">
              <ShieldCheck size={18} /> Community-Driven Rescue Network
            </motion.div>
            
            <motion.h1 variants={fadeInUp} className="text-5xl lg:text-7xl font-extrabold text-gray-900 leading-tight tracking-tight">
              Every Animal Deserves a <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">Second Chance</span>
            </motion.h1>
            
            <motion.p variants={fadeInUp} className="text-xl text-gray-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              AniResQ is a seamless platform connecting compassionate citizens, dedicated volunteers, and shelters to save and rehome animals in distress.
            </motion.p>
            
            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4 pt-4">
              <Button size="lg" className="h-14 px-8 text-lg bg-emerald-600 hover:bg-emerald-700 shadow-xl hover:shadow-emerald-500/30 transition-all duration-300 hover:-translate-y-1" asChild>
                <Link to="/report-rescue">Report an Emergency</Link>
              </Button>
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 transition-all duration-300 hover:-translate-y-1" asChild>
                <Link to="/animals">Adopt a Pet</Link>
              </Button>
            </motion.div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex-1 w-full max-w-lg lg:max-w-none relative"
          >
            <div className="relative aspect-square rounded-[3rem] overflow-hidden shadow-2xl ring-8 ring-white/50 transform rotate-3 hover:rotate-0 transition-transform duration-500">
              <img
                src="https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=1200"
                alt="Happy rescued dog"
                className="object-cover w-full h-full"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </div>
            {/* Floating Badge */}
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -bottom-8 -left-8 bg-white p-6 rounded-2xl shadow-xl flex items-center gap-4"
            >
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                <Heart size={24} fill="currentColor" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Animals Saved</p>
                <p className="text-2xl font-bold text-gray-900">1,200+</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-emerald-600 border-b relative z-20 shadow-lg">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-emerald-500">
            <motion.div whileHover={{ scale: 1.05 }} className="space-y-2">
              <div className="text-4xl font-black text-white drop-shadow-md">1,200+</div>
              <div className="text-sm font-bold text-emerald-100 uppercase tracking-widest">Animals Rescued</div>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} className="space-y-2">
              <div className="text-4xl font-black text-white drop-shadow-md">450+</div>
              <div className="text-sm font-bold text-emerald-100 uppercase tracking-widest">Adoptions</div>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} className="space-y-2">
              <div className="text-4xl font-black text-white drop-shadow-md">300+</div>
              <div className="text-sm font-bold text-emerald-100 uppercase tracking-widest">Volunteers</div>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} className="space-y-2">
              <div className="text-4xl font-black text-white drop-shadow-md">50+</div>
              <div className="text-sm font-bold text-emerald-100 uppercase tracking-widest">Partner NGOs</div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-32 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-4xl font-extrabold text-gray-900 mb-6">How AniResQ Works</h2>
            <p className="text-xl text-gray-600">A seamless, tech-driven process designed to get help to animals faster and find them loving forever homes.</p>
          </div>

          <motion.div 
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid md:grid-cols-4 gap-8 relative"
          >
            {/* Connecting line for desktop */}
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-1 bg-gradient-to-r from-blue-100 via-emerald-100 to-green-100 transform -translate-y-1/2 -z-10" />

            <motion.div variants={fadeInUp} className="bg-white p-8 rounded-3xl shadow-xl shadow-gray-200/50 text-center relative group hover:-translate-y-2 transition-all duration-300 border border-gray-100">
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 ring-8 ring-white">
                <MapPin size={36} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">1. Spot & Report</h3>
              <p className="text-gray-600 leading-relaxed">Pin the exact location, upload photos, and submit an SOS report in seconds.</p>
            </motion.div>
            
            <motion.div variants={fadeInUp} className="bg-white p-8 rounded-3xl shadow-xl shadow-gray-200/50 text-center relative group hover:-translate-y-2 transition-all duration-300 border border-gray-100">
              <div className="w-20 h-20 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 ring-8 ring-white">
                <Radio size={36} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">2. Dispatch</h3>
              <p className="text-gray-600 leading-relaxed">Our system instantly alerts nearby volunteers and NGOs who dispatch to the scene.</p>
            </motion.div>

            <motion.div variants={fadeInUp} className="bg-white p-8 rounded-3xl shadow-xl shadow-gray-200/50 text-center relative group hover:-translate-y-2 transition-all duration-300 border border-gray-100">
              <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 ring-8 ring-white">
                <Heart size={36} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">3. Recovery</h3>
              <p className="text-gray-600 leading-relaxed">The animal receives critical medical attention and recovers safely at a local shelter.</p>
            </motion.div>

            <motion.div variants={fadeInUp} className="bg-white p-8 rounded-3xl shadow-xl shadow-gray-200/50 text-center relative group hover:-translate-y-2 transition-all duration-300 border border-gray-100">
              <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 ring-8 ring-white">
                <Home size={36} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">4. Adoption</h3>
              <p className="text-gray-600 leading-relaxed">Once fully healthy, the animal is listed on our adoption board for a second chance.</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Featured Animals */}
      <section className="py-32 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-16 gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 text-emerald-600 font-semibold mb-3">
                <Search size={20} /> Looking for a forever home
              </div>
              <h2 className="text-4xl font-extrabold text-gray-900 mb-4">Meet Our Rescues</h2>
              <p className="text-xl text-gray-600">These brave survivors are fully recovered and ready to bring joy into your life.</p>
            </div>
            <Button variant="ghost" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 text-lg group hidden md:flex" asChild>
              <Link to="/animals">
                View All Animals 
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-[450px] bg-gray-100 animate-pulse rounded-[2rem]" />)}
            </div>
          ) : (
            <motion.div 
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, margin: "-50px" }}
              variants={staggerContainer}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8"
            >
              {featuredAnimals?.map((animal) => (
                <motion.div key={animal.id} variants={fadeInUp}>
                  <AnimalCard animal={animal} />
                </motion.div>
              ))}
            </motion.div>
          )}

          <Button variant="outline" className="w-full mt-10 md:hidden border-emerald-600 text-emerald-700 h-14 text-lg rounded-xl" asChild>
            <Link to="/animals">View All Animals</Link>
          </Button>
        </div>
      </section>

      {/* Modern CTA Section */}
      <section className="py-32 bg-gray-900 text-white relative overflow-hidden">
        {/* Abstract background elements */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 rounded-full bg-blue-500/20 blur-3xl" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl lg:text-5xl font-extrabold mb-6">Be Part of the Solution</h2>
            <p className="text-xl text-gray-400">Whether you're an individual wanting to help out or an organization looking for better tools, there's a place for you here.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <motion.div whileHover={{ y: -8 }} className="bg-white/5 border border-white/10 p-10 rounded-[2.5rem] text-center backdrop-blur-sm">
              <h3 className="text-2xl font-bold mb-4 text-white">Volunteer</h3>
              <p className="text-gray-400 mb-8 leading-relaxed">Be the boots on the ground. Receive alerts and help rescue animals in distress in your local area.</p>
              <Button className="w-full h-14 rounded-xl text-lg bg-emerald-500 hover:bg-emerald-600 text-white" asChild>
                <Link to="/register?role=VOLUNTEER">Sign Up to Volunteer</Link>
              </Button>
            </motion.div>

            <motion.div whileHover={{ y: -8 }} className="bg-gradient-to-b from-emerald-900/50 to-emerald-800/30 border border-emerald-500/30 p-10 rounded-[2.5rem] text-center backdrop-blur-sm relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-4 py-1 rounded-full tracking-wider uppercase">Most Needed</div>
              <h3 className="text-2xl font-bold mb-4 text-white">Shelters & NGOs</h3>
              <p className="text-emerald-100/70 mb-8 leading-relaxed">Use our platform to manage rescues, volunteer fleets, and adoption applications seamlessly.</p>
              <Button className="w-full h-14 rounded-xl text-lg bg-emerald-400 hover:bg-emerald-500 text-gray-900 font-bold" asChild>
                <Link to="/register?role=SHELTER">Register Shelter</Link>
              </Button>
            </motion.div>

            <motion.div whileHover={{ y: -8 }} className="bg-white/5 border border-white/10 p-10 rounded-[2.5rem] text-center backdrop-blur-sm">
              <h3 className="text-2xl font-bold mb-4 text-white">Veterinarians</h3>
              <p className="text-gray-400 mb-8 leading-relaxed">Join our network to provide critical care records and help shelters manage recovery processes.</p>
              <Button className="w-full h-14 rounded-xl text-lg bg-white/10 hover:bg-white/20 text-white" asChild>
                <Link to="/register?role=VET">Join as Vet</Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}

export default HomePage;
