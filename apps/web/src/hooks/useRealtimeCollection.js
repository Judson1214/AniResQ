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
      // Pause polling if query encountered an error or tab is not active
      if (query.state.error) return false;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return false;
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
