import { QueryClient } from "@tanstack/react-query";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1e3 * 60 * 5,
      // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});
export {
  queryClient
};
