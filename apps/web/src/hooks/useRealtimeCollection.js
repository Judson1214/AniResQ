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
    // Add optional polling if needed, or leave it as standard react-query
    refetchInterval: 5000, // Poll every 5s to simulate realtime, or omit
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
