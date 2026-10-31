import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { getUserProfile, onAuthChange } from "@/services/auth.service";

export const AuthInitializer = () => {
  const { setUser, setLoading, logout } = useAuthStore();

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onAuthChange(async (sessionUser) => {
      setLoading(true);
      try {
        if (sessionUser) {
          const profile = await getUserProfile(sessionUser.id);
          if (profile) {
            setUser({ ...profile, uid: sessionUser.id });
          } else {
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
      }
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [setUser, setLoading, logout]);

  return null;
};
