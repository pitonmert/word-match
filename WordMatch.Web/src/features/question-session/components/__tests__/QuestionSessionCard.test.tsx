/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AnswerAnnouncement } from "@/features/question-session/components/AnswerAnnouncement";
import { QuestionSessionCard } from "@/features/question-session/components/QuestionSessionCard";

afterEach(cleanup);

describe("QuestionSessionCard", () => {
  it("gives a headerless review the header space while keeping the same card height", () => {
    const { rerender } = render(
      <QuestionSessionCard header={<p>Soru</p>} layout="question">
        <p>İçerik</p>
      </QuestionSessionCard>,
    );
    const card = screen.getByText("İçerik").closest('[data-slot="card"]')!;
    rerender(
      <QuestionSessionCard layout="question">
        <p>İnceleme</p>
      </QuestionSessionCard>,
    );
    expect(screen.getByText("İnceleme").closest('[data-slot="card"]')).toBe(
      card,
    );
    expect(card.querySelector('[data-slot="card-header"]')).toBeNull();
    expect(card).toHaveClass("h-104", "grid-rows-[minmax(0,1fr)_5rem]");
    expect(card.parentElement!.children).toHaveLength(1);
  });
  it("keeps the shared fixed geometry and renders each card region", () => {
    render(
      <QuestionSessionCard
        announcement={<p>Duyuru</p>}
        footer={<p>Altbilgi</p>}
        header={<p>Başlık</p>}
      >
        <p>İçerik</p>
      </QuestionSessionCard>,
    );

    const card = screen.getByText("Başlık").closest("[data-slot=card]");
    expect(card).toHaveClass("h-112", "grid-rows-[4rem_minmax(0,1fr)_4rem]");
    expect(card?.closest("section")).toHaveClass("max-w-2xl");
    expect(screen.getByText("İçerik")).toBeInTheDocument();
    expect(screen.getByText("Altbilgi")).toBeInTheDocument();
    expect(screen.getByText("Duyuru")).toBeInTheDocument();
  });

  it("uses the roomier question geometry for active question cards", () => {
    render(
      <QuestionSessionCard
        footer={<p>Altbilgi</p>}
        header={<p>Başlık</p>}
        layout="question"
      >
        <p>İçerik</p>
      </QuestionSessionCard>,
    );

    const card = screen.getByText("Başlık").closest("[data-slot=card]");
    expect(card).toHaveClass("h-104", "grid-rows-[3.5rem_minmax(0,1fr)_5rem]");
    expect(screen.getByText("Başlık").parentElement).toHaveClass(
      "px-6",
      "pt-2",
    );
  });

  it("announces the outcome and the required continuation behavior", () => {
    render(<AnswerAnnouncement isLastQuestion={false} outcome="Wrong" />);

    expect(screen.getByText(/Yanlış cevap/)).toHaveAttribute(
      "aria-live",
      "polite",
    );
    expect(screen.getByText(/İlerlemek için Devam et/)).toBeInTheDocument();
  });
});
