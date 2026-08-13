/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PracticeCardShell } from "@/features/practice/components/PracticeCardShell";

afterEach(() => {
  cleanup();
});

describe("PracticeCardShell", () => {
  it("renders header, content, footer, and announcement in their slots", () => {
    render(
      <PracticeCardShell
        announcement={<p>Duyuru metni</p>}
        content={<p>İçerik metni</p>}
        footer={<p>Altbilgi metni</p>}
        header={<p>Başlık metni</p>}
      />,
    );

    expect(screen.getByText("Başlık metni")).toBeInTheDocument();
    expect(screen.getByText("İçerik metni")).toBeInTheDocument();
    expect(screen.getByText("Altbilgi metni")).toBeInTheDocument();
    expect(screen.getByText("Duyuru metni")).toBeInTheDocument();
  });

  it("omits the announcement slot when none is provided", () => {
    render(
      <PracticeCardShell
        content={<p>İçerik metni</p>}
        footer={<p>Altbilgi metni</p>}
        header={<p>Başlık metni</p>}
      />,
    );

    expect(screen.queryByText("Duyuru metni")).not.toBeInTheDocument();
  });

  it("applies the header, content, and footer class names", () => {
    render(
      <PracticeCardShell
        content={<p>İçerik metni</p>}
        contentClassName="custom-content"
        footer={<p>Altbilgi metni</p>}
        footerClassName="custom-footer"
        header={<p>Başlık metni</p>}
        headerClassName="custom-header"
      />,
    );

    expect(screen.getByText("Başlık metni").parentElement).toHaveClass(
      "custom-header",
    );
    expect(screen.getByText("İçerik metni").parentElement).toHaveClass(
      "custom-content",
    );
    expect(screen.getByText("Altbilgi metni").parentElement).toHaveClass(
      "custom-footer",
    );
  });

  it("applies forward and back transition classes based on transitionDirection", () => {
    const { rerender } = render(
      <PracticeCardShell
        content={<p>İçerik metni</p>}
        footer={<p>Altbilgi metni</p>}
        header={<p>Başlık metni</p>}
        transitionDirection="forward"
      />,
    );

    expect(screen.getByText("Başlık metni").parentElement).toHaveClass(
      "motion-safe:slide-in-from-right-2",
    );

    rerender(
      <PracticeCardShell
        content={<p>İçerik metni</p>}
        footer={<p>Altbilgi metni</p>}
        header={<p>Başlık metni</p>}
        transitionDirection="back"
      />,
    );

    expect(screen.getByText("Başlık metni").parentElement).toHaveClass(
      "motion-safe:slide-in-from-left-2",
    );

    rerender(
      <PracticeCardShell
        content={<p>İçerik metni</p>}
        footer={<p>Altbilgi metni</p>}
        header={<p>Başlık metni</p>}
        transitionDirection="none"
      />,
    );

    expect(screen.getByText("Başlık metni").parentElement).not.toHaveClass(
      "motion-safe:animate-in",
    );
  });
});
