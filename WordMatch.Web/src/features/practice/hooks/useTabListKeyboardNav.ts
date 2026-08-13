import { useRef, type KeyboardEvent } from "react";

export function useTabListKeyboardNav<T extends HTMLElement>() {
  const containerRef = useRef<T>(null);

  const onKeyDown = (event: KeyboardEvent<T>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }

    const tabs = Array.from(
      containerRef.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [],
    );
    const currentIndex = tabs.indexOf(document.activeElement as HTMLElement);
    if (currentIndex === -1) return;

    event.preventDefault();

    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : event.key === "ArrowLeft"
            ? (currentIndex - 1 + tabs.length) % tabs.length
            : (currentIndex + 1) % tabs.length;

    tabs[nextIndex].focus();
    tabs[nextIndex].click();
  };

  return { containerRef, onKeyDown };
}
