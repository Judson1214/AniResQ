import { QueryClient } from "@tanstack/react-query";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1e3 * 60 * 5,
      // 5 minutes
      retry: (failureCount, error) => {
        const status = error?.response?.status;
        if (status === 401 || status === 403 || status === 404 || status === 429) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false
    }
  }
});
export {
  queryClient
};
