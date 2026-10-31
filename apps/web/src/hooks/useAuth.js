import { useAuthStore } from "@/store/authStore";
import { signIn, signOutUser, signUp, updateUserProfile } from "@/services/auth.service";
import { useToast } from "@/components/ui/use-toast";

const useAuth = () => {
  const { user, isLoading, isAuthenticated, setUser, setLoading, logout } = useAuthStore();
  const { toast } = useToast();

  const handleSignIn = async (...args) => {
    try {
      return await signIn(...args);
    } catch (error) {
      toast({
        title: "Sign In Failed",
        description: error.message || "Invalid email or password.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const handleSignUp = async (...args) => {
    try {
      return await signUp(...args);
    } catch (error) {
      toast({
        title: "Sign Up Failed",
        description: error.message || "Could not create account.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (error) {
      toast({
        title: "Sign Out Failed",
        description: error.message || "Could not sign out.",
        variant: "destructive"
      });
      throw error;
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated,
    setUser,
    setLoading,
    signIn: handleSignIn,
    signUp: handleSignUp,
    signOut: handleSignOut,
    updateProfile: updateUserProfile,
    logout
  };
};

export { useAuth };
