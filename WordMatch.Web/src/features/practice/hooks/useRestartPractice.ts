import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  startPractice,
  type PracticeCriteria,
} from "@/features/practice/api/practice";

export function useRestartPractice(criteria: PracticeCriteria | null) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (restartCriteria: PracticeCriteria) =>
      startPractice(restartCriteria, true),
  });

  const restart = async () => {
    if (!criteria || mutation.isPending) return;

    try {
      const session = await mutation.mutateAsync(criteria);
      queryClient.removeQueries({
        queryKey: [
          "practice",
          "results",
          criteria.level,
          criteria.topic,
          criteria.mode,
        ],
      });
      navigate(`/practice/${session.sessionId}`, {
        state: { initialSession: session },
      });
    } catch {
      // Surfaced to callers via restartError below.
    }
  };

  return {
    isRestarting: mutation.isPending,
    restartError: mutation.isError ? "Çalışma yeniden başlatılamadı." : null,
    restart,
  };
}
