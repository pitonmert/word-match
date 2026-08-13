import { useQuery } from "@tanstack/react-query";
import { fetchWords } from "@/features/words/api/words";

export function useWords() {
  const query = useQuery({
    queryKey: ["words"],
    queryFn: ({ signal }) => fetchWords(signal),
  });

  return {
    words: query.data ?? [],
    isLoading: query.isLoading,
    error: query.isError ? "Kelimeler yüklenemedi." : null,
    retry: () => {
      void query.refetch();
    },
  };
}
