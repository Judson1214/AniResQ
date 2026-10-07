import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { getUserProfile, onAuthChange, signIn, signOutUser, signUp } from "@/services/auth.service";
import { useToast } from "@/components/ui/use-toast";

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
    
    const unsubscribe = onAuthChange(async (sessionUser) => {
      setLoading(true);
      try {
        if (sessionUser) {
          const profile = await getUserProfile(sessionUser.id);
          if (profile) {
            setUser({ ...profile, uid: sessionUser.id });
          } else {
            // Because we have a Postgres trigger for auto-creating public.users,
            // this branch should rarely be hit unless there's a race condition.
            // If it happens, we can construct a basic profile or wait for the trigger.
            const newProfile = {
              uid: sessionUser.id,
              email: sessionUser.email,
              displayName: sessionUser.user_metadata?.display_name || "Unknown User",
              role: sessionUser.user_metadata?.role || "CITIZEN"
            };
            setUser({ ...newProfile, id: sessionUser.id, avatarUrl: "", isVerified: false });
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

    // onAuthChange returns an unsubscribe function. We can save it if needed,
    // but typically we keep it alive for the app lifetime.
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

export { useAuth };
