import { useEffect, useState } from "react";

export function useQuestionHover() {
  const [isHoverEnabled, setIsHoverEnabled] = useState(true);

  useEffect(() => {
    let lastMousePosition: { x: number; y: number } | null = null;
    let suppressMouseClick = false;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (["Alt", "Control", "Meta", "Shift", "Enter"].includes(event.key))
        return;
      setIsHoverEnabled(false);
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const position = { x: event.clientX, y: event.clientY };
      const hasMoved =
        Boolean(event.movementX || event.movementY) ||
        (lastMousePosition !== null &&
          (position.x !== lastMousePosition.x ||
            position.y !== lastMousePosition.y));
      lastMousePosition = position;
      if (hasMoved) setIsHoverEnabled(true);
    };
    const handlePointerDown = (event: PointerEvent) => {
      suppressMouseClick = false;
      if (event.pointerType !== "mouse") return;
      if (
        event.button === 0 &&
        event.target instanceof Element &&
        event.target.closest("[data-question-keyboard]")
      ) {
        suppressMouseClick = true;
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      lastMousePosition = { x: event.clientX, y: event.clientY };
      setIsHoverEnabled(true);
    };
    const handleClick = (event: MouseEvent) => {
      if (!suppressMouseClick || event.detail === 0) return;
      suppressMouseClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const handlePointerCancel = () => {
      suppressMouseClick = false;
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("click", handleClick, true);
    window.addEventListener("pointercancel", handlePointerCancel);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("click", handleClick, true);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, []);

  return isHoverEnabled;
}
