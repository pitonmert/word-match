import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFeedbackSoundPreference } from "@/features/question-session/hooks/useFeedbackSoundPreference";
import { cn } from "@/lib/utils";

export function FeedbackSoundControl() {
  const { isFeedbackSoundEnabled, toggleFeedbackSound } =
    useFeedbackSoundPreference();
  const label = isFeedbackSoundEnabled ? "Sesi kapat" : "Sesi aç";

  return (
    <div
      aria-label="Ses ayarları"
      className="flex items-center justify-between gap-3 px-1.5 py-1"
      role="group"
    >
      <span className="type-body">Ses</span>
      <Button
        aria-label={label}
        aria-pressed={isFeedbackSoundEnabled}
        className={cn(
          "min-w-7 border",
          isFeedbackSoundEnabled
            ? "border-primary bg-primary text-primary-foreground shadow-surface hover:bg-primary hover:text-primary-foreground active:bg-primary active:text-primary-foreground"
            : "border-transparent text-muted-foreground",
        )}
        size="icon-sm"
        title={label}
        type="button"
        variant="ghost"
        onClick={toggleFeedbackSound}
      >
        {isFeedbackSoundEnabled ? (
          <Volume2 aria-hidden="true" />
        ) : (
          <VolumeX aria-hidden="true" />
        )}
      </Button>
    </div>
  );
}
