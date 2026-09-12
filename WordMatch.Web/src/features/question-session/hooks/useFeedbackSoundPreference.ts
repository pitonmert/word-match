import { useCallback, useState } from "react";

export const feedbackSoundPreferenceStorageKey =
  "word-match-feedback-sound-enabled";

export function useFeedbackSoundPreference() {
  const [isFeedbackSoundEnabled, setIsFeedbackSoundEnabled] = useState(
    readFeedbackSoundPreference,
  );

  const toggleFeedbackSound = useCallback(() => {
    setIsFeedbackSoundEnabled((current) => {
      const next = !current;
      storeFeedbackSoundPreference(next);
      return next;
    });
  }, []);

  return { isFeedbackSoundEnabled, toggleFeedbackSound };
}

export function areFeedbackSoundsEnabled() {
  return readFeedbackSoundPreference();
}

function readFeedbackSoundPreference() {
  try {
    return (
      window.localStorage?.getItem(feedbackSoundPreferenceStorageKey) !==
      "false"
    );
  } catch {
    return true;
  }
}

function storeFeedbackSoundPreference(isEnabled: boolean) {
  try {
    window.localStorage?.setItem(
      feedbackSoundPreferenceStorageKey,
      String(isEnabled),
    );
  } catch {
    // Feedback sounds remain usable when browser storage is unavailable.
  }
}
