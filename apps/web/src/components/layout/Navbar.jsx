import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { PawPrint, Bell, Menu, User as UserIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notifications/NotificationBell";
const Navbar = () => {
  const { user, isAuthenticated, signOut } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Rescue Map", href: "/rescue" },
    { name: "Animals", href: "/animals" },
    { name: "Lost & Found", href: "/lost-found" }
  ];
  const getInitials = (name) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().substring(0, 2);
  };
  const NavItems = ({ mobile = false }) => <>
      {navLinks.map((link) => <Link
    key={link.name}
    to={link.href}
    onClick={() => mobile && setIsOpen(false)}
    className={cn(
      "text-sm font-medium transition-colors hover:text-emerald-600",
      location.pathname === link.href ? "text-emerald-600" : "text-gray-600",
      mobile ? "block py-2 text-lg" : ""
    )}
  >
          {link.name}
        </Link>)}
      {isAuthenticated && mobile && <>
          <div className="my-4 border-t border-gray-200" />
          <Link
    to="/dashboard"
    onClick={() => setIsOpen(false)}
    className="block py-2 text-lg font-medium text-gray-600 hover:text-emerald-600"
  >
            Dashboard
          </Link>
          <Link
    to="/profile"
    onClick={() => setIsOpen(false)}
    className="block py-2 text-lg font-medium text-gray-600 hover:text-emerald-600"
  >
            Profile
          </Link>
          <button
    onClick={() => {
      signOut();
      setIsOpen(false);
    }}
    className="block py-2 text-lg font-medium text-red-600 hover:text-red-700 text-left w-full"
  >
            Sign Out
          </button>
        </>}
    </>;
  return <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-emerald-600 p-1.5 rounded-lg">
              <PawPrint className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-gray-900">AniResQ</span>
          </Link>
          <nav className="hidden md:flex gap-6 items-center">
            <NavItems />
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {isAuthenticated ? <>
              <div className="hidden md:flex">
                <NotificationBell buttonClassName="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors" iconClassName="w-5 h-5" />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild className="hidden md:flex">
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.avatarUrl} alt={user?.displayName} />
                      <AvatarFallback className="bg-emerald-100 text-emerald-700">
                        {user?.displayName ? getInitials(user.displayName) : <UserIcon className="w-4 h-4" />}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user?.displayName}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard" className="cursor-pointer">Dashboard</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="cursor-pointer">Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="cursor-pointer text-red-600 focus:text-red-600">
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button onClick={signOut} variant="outline" className="hidden md:flex text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
                Sign Out
              </Button>
            </> : <div className="hidden md:flex items-center gap-2">
              <Button variant="ghost" asChild>
                <Link to="/login">Sign In</Link>
              </Button>
              <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
                <Link to="/register">Sign Up</Link>
              </Button>
            </div>}

          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="w-6 h-6 text-gray-600" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[400px]">
              <div className="flex flex-col gap-6 pt-6">
                <Link to="/" className="flex items-center gap-2" onClick={() => setIsOpen(false)}>
                  <div className="bg-emerald-600 p-1.5 rounded-lg">
                    <PawPrint className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-bold text-xl tracking-tight text-gray-900">AniResQ</span>
                </Link>
                
                {isAuthenticated && <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user?.avatarUrl} alt={user?.displayName} />
                      <AvatarFallback className="bg-emerald-100 text-emerald-700">
                        {user?.displayName ? getInitials(user.displayName) : <UserIcon className="w-4 h-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{user?.displayName}</span>
                      <span className="text-xs text-gray-500 capitalize">{user?.role.toLowerCase()}</span>
                    </div>
                  </div>}
                
                <nav className="flex flex-col gap-1">
                  <NavItems mobile />
                </nav>

                {!isAuthenticated && <div className="flex flex-col gap-2 mt-4">
                    <Button variant="outline" asChild className="w-full justify-center">
                      <Link to="/login" onClick={() => setIsOpen(false)}>Sign In</Link>
                    </Button>
                    <Button asChild className="w-full justify-center bg-emerald-600 hover:bg-emerald-700">
                      <Link to="/register" onClick={() => setIsOpen(false)}>Sign Up</Link>
                    </Button>
                  </div>}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>;
};
export {
  Navbar
};
