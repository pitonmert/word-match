import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestionOptions } from "@/features/question-session/components/QuestionOptions";
import { useQuestionHover } from "@/features/question-session/hooks/useQuestionHover";

afterEach(cleanup);

const props = {
  correctIndex: null,
  hasAnswered: false,
  isLoading: false,
  isAnswerRevealed: false,
  options: ["cat", "dog", "bird", "fish"],
  selectedIndex: null,
  onAnswer: vi.fn(),
};

function Options() {
  const isHoverEnabled = useQuestionHover();
  return <QuestionOptions {...props} isHoverEnabled={isHoverEnabled} />;
}

function pointer(
  type: "pointermove" | "pointerdown",
  values: Partial<PointerEvent> = {},
) {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, {
    pointerType: "mouse",
    clientX: 100,
    clientY: 100,
    movementX: 0,
    movementY: 0,
    ...values,
  });
  fireEvent(window, event);
}

describe("QuestionOptions input modes", () => {
  it("keeps mouse hover enabled by default", () => {
    render(<QuestionOptions {...props} />);
    expect(screen.getByRole("button", { name: "cat" })).toHaveClass(
      "hover:bg-info-subtle",
    );
  });

  it("suppresses option and outline hover while preserving keyboard focus styles", async () => {
    render(<Options />);
    await userEvent.setup().tab();
    const option = screen.getByRole("button", { name: "cat" });
    expect(option).toHaveFocus();
    expect(option).toHaveClass(
      "hover:bg-card",
      "hover:border-border",
      "hover:text-foreground",
      "hover:shadow-none",
      "focus-visible:ring-info/30",
    );
    expect(option).not.toHaveClass("hover:bg-info-subtle");
    expect(option).not.toHaveClass("hover:bg-primary-50");
  });

  it("ignores modifier-only keys and stationary mouse events", () => {
    render(<Options />);
    const option = screen.getByRole("button", { name: "cat" });
    fireEvent.keyDown(window, { key: "Shift" });
    expect(option).toHaveClass("hover:bg-info-subtle");
    pointer("pointermove");
    fireEvent.keyDown(window, { key: "1" });
    pointer("pointermove");
    expect(option).toHaveClass("hover:bg-card");
  });

  it("restores hover on actual mouse movement or mouse press", () => {
    render(<Options />);
    const option = screen.getByRole("button", { name: "cat" });
    pointer("pointermove");
    fireEvent.keyDown(window, { key: "1" });
    pointer("pointermove", { clientX: 101 });
    expect(option).toHaveClass("hover:bg-info-subtle");
    fireEvent.keyDown(window, { key: "Enter" });
    pointer("pointermove", { movementY: 1 });
    expect(option).toHaveClass("hover:bg-info-subtle");
    fireEvent.keyDown(window, { key: "Tab" });
    pointer("pointerdown");
    expect(option).toHaveClass("hover:bg-info-subtle");
  });

  it("does not enable mouse hover for touch input or block touch answers", async () => {
    const onAnswer = vi.fn();
    render(
      <QuestionOptions {...props} isHoverEnabled={false} onAnswer={onAnswer} />,
    );
    await userEvent.setup().pointer({
      keys: "[TouchA]",
      target: screen.getByRole("button", { name: "cat" }),
    });
    expect(onAnswer).toHaveBeenCalledWith(0);
    cleanup();
    render(<Options />);
    fireEvent.keyDown(window, { key: "1" });
    pointer("pointermove", { pointerType: "touch", movementX: 10 });
    pointer("pointerdown", { pointerType: "touch" });
    expect(screen.getByRole("button", { name: "cat" })).toHaveClass(
      "hover:bg-card",
    );
  });

  it("preserves answer colors with hover suppressed", () => {
    render(
      <QuestionOptions
        {...props}
        isHoverEnabled={false}
        hasAnswered
        correctIndex={1}
        selectedIndex={0}
      />,
    );
    expect(screen.getByRole("button", { name: "cat" })).toHaveClass(
      "bg-error-subtle",
    );
    expect(screen.getByRole("button", { name: "dog" })).toHaveClass(
      "bg-success-subtle",
    );
    expect(screen.getByRole("button", { name: "dog" })).toBeDisabled();
  });
});
