import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./apiClient";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403 || error.status === 404)) {
          return false;
        }
        return failureCount < 2;
      },
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
  },
});
