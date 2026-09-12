/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FeedbackSoundControl } from "@/features/question-session/components/FeedbackSoundControl";
import { feedbackSoundPreferenceStorageKey } from "@/features/question-session/hooks/useFeedbackSoundPreference";

const localStorageMock = createLocalStorage();

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: localStorageMock,
  });
  localStorageMock.clear();
});

afterEach(() => {
  cleanup();
});

describe("FeedbackSoundControl", () => {
  it("persists the shared feedback sound preference", async () => {
    const user = userEvent.setup();
    render(<FeedbackSoundControl />);

    await user.click(screen.getByRole("button", { name: "Sesi kapat" }));

    expect(screen.getByRole("button", { name: "Sesi aç" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(localStorageMock.getItem(feedbackSoundPreferenceStorageKey)).toBe(
      "false",
    );
  });
});

function createLocalStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}
