import { useEffect, useState } from "react";

const compactLayoutBreakpoint = 1024;

export function useIsCompactLayout() {
  const [isCompactLayout, setIsCompactLayout] = useState(getIsCompactLayout);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      const handleResize = () => setIsCompactLayout(getIsCompactLayout());
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }

    const mediaQuery = window.matchMedia(
      `(max-width: ${compactLayoutBreakpoint - 1}px)`,
    );
    const handleChange = () => setIsCompactLayout(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isCompactLayout;
}

function getIsCompactLayout() {
  return (
    typeof window !== "undefined" && window.innerWidth < compactLayoutBreakpoint
  );
}
