import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

function useRealtimeCollection(endpoint, params = {}, enabled = true) {
  const queryResult = useQuery({
    queryKey: [endpoint, params],
    queryFn: async () => {
      const response = await api.get(endpoint, { params });
      return response.data;
    },
    enabled: enabled,
    refetchIntervalInBackground: false,
    refetchInterval: (query) => {
      // Pause polling when tab/document is hidden
      if (typeof document !== "undefined" && (document.hidden || document.visibilityState === "hidden")) {
        return false;
      }
      // Back off exponentially on repeated errors up to 60 seconds
      if (query.state.error) {
        const errorCount = query.state.errorUpdateCount || 1;
        return Math.min(60000, 5000 * Math.pow(2, errorCount - 1));
      }
      return 10000; // Poll every 10s when active and healthy
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
