import { useEffect, useState } from "react";

export function useQuestionHover() {
  const [isHoverEnabled, setIsHoverEnabled] = useState(true);

  useEffect(() => {
    let lastMousePosition: { x: number; y: number } | null = null;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (["Alt", "Control", "Meta", "Shift"].includes(event.key)) return;
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
      if (event.pointerType !== "mouse") return;
      lastMousePosition = { x: event.clientX, y: event.clientY };
      setIsHoverEnabled(true);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    window.addEventListener("pointerdown", handlePointerDown, {
      passive: true,
    });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return isHoverEnabled;
}
