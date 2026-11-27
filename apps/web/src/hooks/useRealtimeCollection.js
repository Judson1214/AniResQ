import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export function calculatePollingInterval(queryState, isHidden, isAuthenticated) {
  // Never poll when logged out
  if (!isAuthenticated) {
    return false;
  }
  // Pause polling when tab/document is hidden
  if (isHidden) {
    return false;
  }
  // Back off exponentially on repeated errors up to 60 seconds (5s, 10s, 20s, 40s, 60s)
  if (queryState?.error) {
    const errorCount = queryState.errorUpdateCount || 1;
    return Math.min(60000, 5000 * Math.pow(2, errorCount - 1));
  }
  return 10000; // Poll every 10s when active and healthy
}

function useRealtimeCollection(endpoint, params = {}, enabled = true) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const queryResult = useQuery({
    queryKey: [endpoint, params],
    queryFn: async () => {
      const response = await api.get(endpoint, { params });
      return response.data;
    },
    enabled: enabled && isAuthenticated,
    refetchIntervalInBackground: false,
    refetchInterval: (query) => {
      const isHidden = typeof document !== "undefined" && (document.hidden || document.visibilityState === "hidden");
      const isAuthed = useAuthStore.getState().isAuthenticated;
      return calculatePollingInterval(query?.state, isHidden, isAuthed);
    },
  });

  return { 
    data: queryResult.data || [], 
    isLoading: queryResult.isLoading, 
    error: queryResult.error 
  };
}

export {
  useRealtimeCollection
};
