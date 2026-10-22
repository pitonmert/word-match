import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestionResultBrowser } from "@/features/question-session/components/QuestionResultBrowser";
import type { QuestionResultCategory } from "@/features/question-session/types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function Results({ includeCorrect = false }: { includeCorrect?: boolean }) {
  const [category, setCategory] = useState<QuestionResultCategory>("review");
  return (
    <QuestionResultBrowser
      correctRecords={
        includeCorrect
          ? [
              {
                key: "correct-1",
                prompt: "cat",
                correctAnswer: "kedi",
                selectedAnswer: "kedi",
                formatLabel: "Seçmeli",
              },
            ]
          : undefined
      }
      reviewRecords={[]}
      selectedCategory={category}
      wrongRecords={[]}
      onCategoryChange={setCategory}
    />
  );
}

function prepareScroll() {
  const carousel = screen.getByLabelText("Sonuç listeleri");
  Object.defineProperty(carousel, "clientWidth", {
    configurable: true,
    value: 320,
  });
  Object.defineProperty(carousel, "scrollLeft", {
    configurable: true,
    writable: true,
    value: 0,
  });
  const scrollTo = vi.fn();
  Object.assign(carousel, { scrollTo });
  return {
    carousel,
    scrollTo,
    scroll(left: number, settled = false) {
      carousel.scrollLeft = left;
      fireEvent.scroll(carousel);
      if (settled)
        fireEvent(carousel, new Event("scrollend", { bubbles: true }));
    },
  };
}

describe("QuestionResultBrowser", () => {
  it("reserves four complete rows in the summary across long, short, and empty lists", () => {
    const record = {
      key: "answer",
      prompt: "cat",
      correctAnswer: "kedi",
      selectedAnswer: "kedi",
      formatLabel: "Seçmeli",
    };
    const props = {
      layout: "content" as const,
      correctRecords: [],
      reviewRecords: Array.from({ length: 9 }, (_, index) => ({
        ...record,
        key: String(index),
      })),
      wrongRecords: [record],
      onCategoryChange: vi.fn(),
    };
    const { rerender } = render(
      <QuestionResultBrowser {...props} selectedCategory="review" />,
    );
    for (const category of ["review", "wrong", "correct"] as const) {
      rerender(
        <QuestionResultBrowser {...props} selectedCategory={category} />,
      );
      const region = screen.getByRole("region", { name: "Çalışma sonuçları" });
      // Reserve the same track while the scroll viewport animates inside it.
      expect(region.style.gridTemplateRows).toBe(
        "auto var(--result-viewport-height)",
      );
      expect(region).toHaveClass(
        "[--result-viewport-height:calc(4*var(--result-row-height)+5*var(--result-spacing))]",
      );
    }
  });

  it("supports native scrolling across all three completed result categories", () => {
    render(<Results includeCorrect />);
    const { scroll } = prepareScroll();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    scroll(640, true);
    expect(
      screen.getByRole("tabpanel", { name: "Yanlış sonuçları" }),
    ).toBeInTheDocument();
    scroll(320, true);
    expect(
      screen.getByRole("tabpanel", { name: "Bilmiyorum sonuçları" }),
    ).toBeInTheDocument();
    scroll(0, true);
    expect(
      screen.getByRole("tabpanel", { name: "Doğru sonuçları" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Doğru 1" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
  it("changes categories by clicking and using the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Results />);
    await user.click(screen.getByRole("tab", { name: "Yanlış 0" }));
    expect(
      screen.getByRole("tabpanel", { name: "Yanlış sonuçları" }),
    ).toBeInTheDocument();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Bilmiyorum 0" })).toHaveFocus();
    expect(
      screen.getByRole("tabpanel", { name: "Bilmiyorum sonuçları" }),
    ).toBeInTheDocument();
  });

  it("animates tab clicks by scrolling the existing list container", async () => {
    const user = userEvent.setup();
    render(<Results />);
    const { carousel, scrollTo } = prepareScroll();
    await user.click(screen.getByRole("tab", { name: "Yanlış 0" }));
    expect(scrollTo).toHaveBeenCalledWith({ left: 320, behavior: "smooth" });
    expect(screen.getByLabelText("Sonuç listeleri")).toBe(carousel);
  });

  it("selects the list only after native horizontal scrolling settles", () => {
    render(<Results />);
    const { scroll } = prepareScroll();
    scroll(200);
    expect(screen.getByRole("tab", { name: "Bilmiyorum 0" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    scroll(320, true);
    expect(
      screen.getByRole("tabpanel", { name: "Yanlış sonuçları" }),
    ).toBeInTheDocument();
    scroll(0, true);
    expect(
      screen.getByRole("tabpanel", { name: "Bilmiyorum sonuçları" }),
    ).toBeInTheDocument();
  });

  it("keeps one shared vertical scroll area outside both sliding lists", async () => {
    const user = userEvent.setup();
    const { container } = render(<Results />);
    const { carousel, scroll } = prepareScroll();
    const area = carousel.closest('[data-slot="scroll-area"]');
    const viewport = carousel.closest<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    )!;
    const scrollTo = vi.fn();
    Object.assign(viewport, { scrollTo });

    expect(
      container.querySelectorAll('[data-slot="scroll-area"]'),
    ).toHaveLength(1);
    expect(
      screen
        .getByRole("tabpanel", { name: "Bilmiyorum sonuçları" })
        .closest('[data-slot="scroll-area"]'),
    ).toBe(area);
    await user.click(screen.getByRole("tab", { name: "Yanlış 0" }));
    scroll(320, true);
    expect(
      screen
        .getByRole("tabpanel", { name: "Yanlış sonuçları" })
        .closest('[data-slot="scroll-area"]'),
    ).toBe(area);
    expect(carousel.closest('[data-slot="scroll-area-viewport"]')).toBe(
      viewport,
    );
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
    expect(
      container.querySelectorAll('[data-slot="scroll-area"]'),
    ).toHaveLength(1);
  });

  it("does not switch tabs when the heading bar is dragged with a mouse", () => {
    render(<Results />);
    const bar = screen.getByRole("tablist");
    fireEvent.pointerDown(bar, {
      pointerType: "mouse",
      clientX: 30,
      button: 0,
    });
    fireEvent.pointerMove(bar, { pointerType: "mouse", clientX: 170 });
    fireEvent.pointerUp(bar, { pointerType: "mouse", clientX: 170 });
    expect(screen.getByRole("tab", { name: "Bilmiyorum 0" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("fades the shared scrollbar as overflow disappears without removing it", () => {
    const observers: { callback: () => void; targets: Set<Element> }[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        targets = new Set<Element>();
        constructor(callback: () => void) {
          observers.push({ callback, targets: this.targets });
        }
        observe(target: Element) {
          this.targets.add(target);
        }
        unobserve(target: Element) {
          this.targets.delete(target);
        }
        disconnect() {}
      },
    );
    render(<Results />);
    const { carousel } = prepareScroll();
    const area = carousel.closest<HTMLElement>('[data-slot="scroll-area"]')!;
    const viewport = carousel.closest<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    )!;
    const scrollbar = area.querySelector('[data-slot="scroll-area-scrollbar"]');
    expect(scrollbar).toBeInTheDocument();
    let overflow = 96;
    Object.defineProperties(viewport, {
      scrollHeight: { configurable: true, get: () => 100 + overflow },
      clientHeight: { configurable: true, value: 100 },
    });
    const update = () =>
      act(() =>
        observers
          .find((observer) => observer.targets.has(carousel))!
          .callback(),
      );
    update();
    expect(area.style.getPropertyValue("--result-scrollbar-opacity")).toBe("1");
    overflow = 24;
    update();
    const opacity = Number(
      area.style.getPropertyValue("--result-scrollbar-opacity"),
    );
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThan(1);
    overflow = 0;
    update();
    expect(area.style.getPropertyValue("--result-scrollbar-opacity")).toBe("0");
    expect(area.querySelector('[data-slot="scroll-area-scrollbar"]')).toBe(
      scrollbar,
    );
  });
});
