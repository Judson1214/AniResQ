import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { getUserProfile, onAuthChange, signIn, signOutUser, signUp } from "@/services/auth.service";
import { useToast } from "@/components/ui/use-toast";
// Global flag to ensure we only register the Firebase listener once across the entire app
let isListenerRegistered = false;

const useAuth = () => {
  const { user, isLoading, isAuthenticated, setUser, setLoading, logout } = useAuthStore();
  const { toast } = useToast();
  const [isInitializing, setIsInitializing] = useState(!isListenerRegistered);

  useEffect(() => {
    if (isListenerRegistered) {
      setIsInitializing(false);
      return;
    }
    
    isListenerRegistered = true;
    
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setLoading(true);
      try {
        if (firebaseUser) {
          const profile = await getUserProfile(firebaseUser.uid);
          if (profile) {
            setUser(profile);
          } else {
            logout();
          }
        } else {
          logout();
        }
      } catch (error) {
        console.error("Auth state change error:", error);
        logout();
      } finally {
        setLoading(false);
        setIsInitializing(false);
      }
    });

    // Note: We deliberately do not unsubscribe on unmount because we only want ONE global listener
    // that persists for the lifetime of the application.
  }, [setUser, setLoading, logout]);
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
    isLoading: isLoading || isInitializing,
    isAuthenticated,
    signIn: handleSignIn,
    signUp: handleSignUp,
    signOut: handleSignOut
  };
};
export {
  useAuth
};
