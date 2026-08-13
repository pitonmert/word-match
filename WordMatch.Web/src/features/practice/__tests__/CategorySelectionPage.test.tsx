/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchCategories,
  type CategoryResponse,
} from "@/features/practice/api/categories";
import CategorySelectionPage from "@/features/practice/CategorySelectionPage";
import { createTestQueryClient } from "@/test/createTestQueryClient";

vi.mock("@/features/practice/api/categories", () => ({
  fetchCategories: vi.fn(),
  practiceCategoriesQueryKey: ["practice", "categories"],
}));

const categories = {
  levels: [
    {
      value: "A1",
      label: "A1",
      wordCount: 10,
      topics: [
        {
          value: "SportsAndLeisure",
          label: "Spor ve Boş Zaman",
          wordCount: 6,
          completedQuestionCount: 2,
          totalQuestionCount: 24,
          status: "InProgress",
          modes: [
            {
              mode: "EnglishToTurkish",
              completedQuestionCount: 2,
              totalQuestionCount: 12,
            },
            {
              mode: "TurkishToEnglish",
              completedQuestionCount: 0,
              totalQuestionCount: 12,
            },
            {
              mode: "Mixed",
              completedQuestionCount: 2,
              totalQuestionCount: 24,
            },
          ],
        },
        {
          value: "Animals",
          label: "Animals",
          wordCount: 2,
          completedQuestionCount: 0,
          totalQuestionCount: 8,
          status: "Available",
          modes: [
            {
              mode: "EnglishToTurkish",
              completedQuestionCount: 0,
              totalQuestionCount: 4,
            },
            {
              mode: "TurkishToEnglish",
              completedQuestionCount: 0,
              totalQuestionCount: 4,
            },
            {
              mode: "Mixed",
              completedQuestionCount: 0,
              totalQuestionCount: 8,
            },
          ],
        },
        {
          value: "FoodAndDrink",
          label: "Food and Drink",
          wordCount: 2,
          completedQuestionCount: 0,
          totalQuestionCount: 8,
          status: "Available",
          modes: [
            {
              mode: "EnglishToTurkish",
              completedQuestionCount: 0,
              totalQuestionCount: 4,
            },
            {
              mode: "TurkishToEnglish",
              completedQuestionCount: 0,
              totalQuestionCount: 4,
            },
            {
              mode: "Mixed",
              completedQuestionCount: 0,
              totalQuestionCount: 8,
            },
          ],
        },
      ],
    },
    {
      value: "A2",
      label: "A2",
      wordCount: 4,
      topics: [
        {
          value: "Animals",
          label: "Animals",
          wordCount: 4,
          completedQuestionCount: 16,
          totalQuestionCount: 16,
          status: "Completed",
          modes: [
            {
              mode: "EnglishToTurkish",
              completedQuestionCount: 8,
              totalQuestionCount: 8,
            },
            {
              mode: "TurkishToEnglish",
              completedQuestionCount: 8,
              totalQuestionCount: 8,
            },
            {
              mode: "Mixed",
              completedQuestionCount: 16,
              totalQuestionCount: 16,
            },
          ],
        },
      ],
    },
  ],
} satisfies CategoryResponse;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.sessionStorage.clear();
});

describe("CategorySelectionPage", () => {
  it("keeps loading and error states inside the fixed practice card", async () => {
    vi.mocked(fetchCategories).mockImplementation(
      () => new Promise(() => undefined),
    );

    const { unmount } = render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <CategorySelectionPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const loadingState = screen.getByLabelText("Kategoriler yükleniyor");
    const loadingCard = loadingState.closest('[data-slot="card"]');
    expect(loadingCard).toHaveClass(
      "h-112",
      "grid",
      "grid-rows-[4rem_minmax(0,1fr)_4rem]",
    );

    unmount();
    vi.mocked(fetchCategories).mockRejectedValueOnce(new Error("Network"));
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <CategorySelectionPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const errorMessage = await screen.findByText(
      "Çalışma kategorileri yüklenemedi.",
    );
    expect(errorMessage.closest('[data-slot="card"]')).toHaveClass(
      "h-112",
      "grid",
      "grid-rows-[4rem_minmax(0,1fr)_4rem]",
    );
  });

  it("restores the category list from the URL", async () => {
    vi.mocked(fetchCategories).mockResolvedValue(categories);
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={["/?level=A2"]}>
          <CategorySelectionPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText("A2", { selector: '[aria-current="page"]' }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "A1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "A2" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen
        .getByRole("tablist", { name: "Çalışma seviyesi" })
        .closest('[data-slot="card-content"]'),
    ).toBeInTheDocument();
    expect(
      screen
        .getByRole("tablist", { name: "Çalışma seviyesi" })
        .closest('[data-slot="card-footer"]'),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("1 kategori, 4 kelime")).toBeInTheDocument();

    expect(getCategoryTab("Devam Eden")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(getCategoryTab("Kullanılabilir")).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(getCategoryTab("Tamamlanan")).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(getCategoryTab("Devam Eden")).toHaveTextContent("0");
    expect(getCategoryTab("Kullanılabilir")).toHaveTextContent("0");
    expect(getCategoryTab("Tamamlanan")).toHaveTextContent("1");

    await user.click(getCategoryTab("Tamamlanan"));
    expect(
      screen.getByRole("button", {
        name: "Hayvanlar, tamamlandı",
      }),
    ).toBeInTheDocument();
  });

  it("opens mode selection for an in-progress category", async () => {
    vi.mocked(fetchCategories).mockResolvedValue(categories);
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <CategorySelectionPage />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText("A1", { selector: '[aria-current="page"]' }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "A2" })).toBeInTheDocument();
    expect(
      screen.getByRole("tabpanel", { name: "A1 Devam Eden kategorileri" }),
    ).toBeInTheDocument();
    expect(getCategoryTab("Devam Eden")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(getCategoryTab("Kullanılabilir")).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(getCategoryTab("Tamamlanan")).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(getCategoryTab("Tamamlanan")).toHaveTextContent("0");

    const topicButton = screen.getByRole("button", {
      name: "Spor ve Boş Zaman, 2/24 soru",
    });
    expect(topicButton).toHaveClass("h-13", "min-h-13");
    expect(screen.getByText("Spor ve Boş Zaman")).toHaveClass("line-clamp-1");
    expect(topicButton).not.toHaveTextContent("kelime");
    expect(topicButton).toHaveTextContent("2/24 soru");
    expect(
      screen.getByRole("progressbar", {
        name: "Spor ve Boş Zaman çalışma ilerlemesi",
      }),
    ).toHaveAttribute("aria-valuenow", "2");
    await user.click(topicButton);
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/practice?level=A1&topic=SportsAndLeisure",
    );
  });

  it("shows a category with one completed direction under Devam Eden", async () => {
    const partiallyCompletedCategories: CategoryResponse = {
      ...categories,
      levels: categories.levels.map((level) =>
        level.value !== "A1"
          ? level
          : {
              ...level,
              topics: level.topics.map((category) =>
                category.value !== "FoodAndDrink"
                  ? category
                  : {
                      ...category,
                      status: "InProgress",
                      completedQuestionCount: 4,
                      modes: category.modes.map((status) =>
                        status.mode === "EnglishToTurkish"
                          ? {
                              ...status,
                              completedQuestionCount: status.totalQuestionCount,
                            }
                          : status.mode === "Mixed"
                            ? { ...status, completedQuestionCount: 4 }
                            : status,
                      ),
                    },
              ),
            },
      ),
    };
    vi.mocked(fetchCategories).mockResolvedValue(partiallyCompletedCategories);
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <CategorySelectionPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("button", {
        name: "Yiyecek ve İçecek, 4/8 soru",
      }),
    ).toBeInTheDocument();
    expect(getCategoryTab("Devam Eden")).toHaveTextContent("2");
    expect(getCategoryTab("Kullanılabilir")).toHaveTextContent("1");

    await user.click(getCategoryTab("Kullanılabilir"));
    expect(
      screen.queryByRole("button", {
        name: "Yiyecek ve İçecek, 4/8 soru",
      }),
    ).not.toBeInTheDocument();
  });

  it("shows an active replay under Devam Eden with replay progress", async () => {
    const categoriesWithReplay: CategoryResponse = {
      ...categories,
      levels: categories.levels.map((level) =>
        level.value !== "A2"
          ? level
          : {
              ...level,
              topics: level.topics.map((category) => ({
                ...category,
                modes: category.modes.map((mode) =>
                  mode.mode === "EnglishToTurkish"
                    ? {
                        ...mode,
                        activeSessionId: "replay-session",
                        activeAnsweredCount: 1,
                        activeTotalCount: 8,
                        isReplay: true,
                      }
                    : mode,
                ),
              })),
            },
      ),
    };
    vi.mocked(fetchCategories).mockResolvedValue(categoriesWithReplay);

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={["/?level=A2"]}>
          <CategorySelectionPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("tabpanel", {
        name: "A2 Devam Eden kategorileri",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Hayvanlar, Tekrar 1/8 soru",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", {
        name: "Hayvanlar çalışma ilerlemesi",
      }),
    ).toHaveAttribute("aria-valuenow", "1");
    expect(getCategoryTab("Tamamlanan")).toHaveTextContent("0");
  });

  it("opens mode selection for a category without an active session", async () => {
    vi.mocked(fetchCategories).mockResolvedValue(categories);
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <CategorySelectionPage />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText("A1", { selector: '[aria-current="page"]' });
    await user.click(getCategoryTab("Kullanılabilir"));
    await user.click(screen.getByRole("button", { name: /Hayvanlar/ }));

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/practice?level=A1&topic=Animals",
    );
  });

  it("changes the topic list without leaving the page", async () => {
    vi.mocked(fetchCategories).mockResolvedValue(categories);
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <CategorySelectionPage />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText("A1", { selector: '[aria-current="page"]' });
    await user.click(screen.getByRole("tab", { name: "A2" }));

    expect(
      screen.getByText("A2", { selector: '[aria-current="page"]' }),
    ).toBeInTheDocument();
    expect(getCategoryTab("Devam Eden")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(getCategoryTab("Kullanılabilir")).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(getCategoryTab("Tamamlanan")).toHaveAttribute(
      "aria-selected",
      "false",
    );

    await user.click(getCategoryTab("Tamamlanan"));
    expect(
      screen.getByRole("button", {
        name: "Hayvanlar, tamamlandı",
      }),
    ).not.toHaveTextContent("soru");
    expect(screen.getByRole("tab", { name: "A1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "A2" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("location")).toHaveTextContent("/?level=A2");
    expect(
      screen.getByRole("tabpanel", { name: "A2 Tamamlanan kategorileri" }),
    ).toBeInTheDocument();
  });

  it("remembers the selected category status for the current browser tab", async () => {
    vi.mocked(fetchCategories).mockResolvedValue(categories);
    const user = userEvent.setup();

    const firstRender = render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <CategorySelectionPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByRole("tabpanel", {
      name: "A1 Devam Eden kategorileri",
    });
    await user.click(getCategoryTab("Tamamlanan"));
    expect(getCategoryTab("Tamamlanan")).toHaveAttribute(
      "aria-selected",
      "true",
    );

    firstRender.unmount();
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <CategorySelectionPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("tabpanel", {
        name: "A1 Tamamlanan kategorileri",
      }),
    ).toBeInTheDocument();
    expect(getCategoryTab("Tamamlanan")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("keeps page scrolling disabled and scrolls only the category content", async () => {
    vi.mocked(fetchCategories).mockResolvedValue(categories);

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <CategorySelectionPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByRole("tabpanel", {
      name: "A1 Devam Eden kategorileri",
    });
    const card = screen
      .getByRole("heading", { name: "Kategori seçin" })
      .closest('[data-slot="card"]');
    const main = card?.closest("main");
    const scrollArea = screen
      .getByRole("tabpanel", { name: "A1 Devam Eden kategorileri" })
      .closest('[data-slot="scroll-area"]');
    const categoryList = screen.getByRole("tabpanel", {
      name: "A1 Devam Eden kategorileri",
    });

    expect(main).toHaveClass(
      "overflow-x-hidden",
      "overflow-y-auto",
      "overscroll-y-contain",
    );
    expect(
      screen.getByRole("tablist", { name: "Kategori durumu" }),
    ).toHaveClass("pr-3");
    expect(scrollArea).toHaveClass("min-h-0", "flex-1");
    expect(scrollArea?.closest('[data-slot="card-content"]')).toHaveClass(
      "px-3",
      "py-2",
    );
    expect(
      scrollArea?.querySelector('[data-slot="scroll-area-content"]'),
    ).toHaveClass("py-2");
    expect(categoryList).toHaveClass("pr-3");
  });

  it("opens mode selection for a completed category", async () => {
    vi.mocked(fetchCategories).mockResolvedValue(categories);
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={["/?level=A2"]}>
          <CategorySelectionPage />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText("A2", { selector: '[aria-current="page"]' });
    await user.click(getCategoryTab("Tamamlanan"));
    await user.click(
      screen.getByRole("button", {
        name: "Hayvanlar, tamamlandı",
      }),
    );

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/practice?level=A2&topic=Animals",
    );
  });
});

function LocationProbe() {
  const location = useLocation();
  return (
    <span data-testid="location">
      {location.pathname}
      {location.search}
    </span>
  );
}

function getCategoryTab(name: string) {
  return screen.getByRole("tab", { name: new RegExp(`^${name}`) });
}
