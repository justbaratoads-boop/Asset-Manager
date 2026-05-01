import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export function useFetch<T>(url: string, enabled = true) {
  return useQuery<T>({
    queryKey: [url],
    queryFn: () => customFetch<T>(url),
    enabled,
  });
}
