import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { Toaster } from "@/components/ui/toaster";
const MainLayout = ({ children }) => {
  return <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 flex flex-col">
        {children}
      </main>
      <Footer />
      <Toaster />
    </div>;
};
export {
  MainLayout
};
