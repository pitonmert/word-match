import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Navbar } from "@/components/Navbar";
import { ThemeProvider } from "@/components/theme-provider";
import { buttonVariants } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/features/auth/AuthProvider";
import { queryClient } from "@/lib/queryClient";
import "@/main.css";

const AuthPage = lazy(() => import("@/features/auth/AuthPage"));
const QuestionPracticePage = lazy(
  () => import("@/features/practice/QuestionPracticePage"),
);
const CategorySelectionPage = lazy(
  () => import("@/features/practice/CategorySelectionPage"),
);
const WordsPage = lazy(() => import("@/features/words/WordsPage"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider delay={2000} timeout={0}>
            <BrowserRouter>
              <ErrorBoundary fallback={<ErrorFallback />}>
                <Application />
              </ErrorBoundary>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);

function Application() {
  const { isLoading, user } = useAuth();

  if (isLoading) return <RouteLoadingState />;

  if (!user) {
    return (
      <Suspense fallback={<RouteLoadingState />}>
        <Routes>
          <Route element={<AuthPage />} path="*" />
        </Routes>
      </Suspense>
    );
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      <Navbar />
      <div className="min-h-0 flex-1">
        <Suspense fallback={<RouteLoadingState />}>
          <Routes>
            <Route element={<CategorySelectionPage />} path="/" />
            <Route element={<QuestionPracticePage />} path="/practice" />
            <Route
              element={<QuestionPracticePage />}
              path="/practice/results"
            />
            <Route
              element={<QuestionPracticePage />}
              path="/practice/:sessionId"
            />
            <Route element={<WordsPage />} path="/words" />
            <Route element={<NotFoundPage />} path="*" />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
}

function RouteLoadingState() {
  return (
    <main className="flex h-svh items-center justify-center bg-background">
      <p className="type-body text-muted-foreground">Yükleniyor...</p>
    </main>
  );
}

function NotFoundPage() {
  return (
    <main className="flex h-svh flex-col items-center justify-center gap-3 bg-background px-4 text-center">
      <h1 className="type-page-title">Sayfa bulunamadı</h1>
      <p className="type-body text-muted-foreground">
        Aradığınız sayfa mevcut değil veya taşınmış olabilir.
      </p>
      <Link className={buttonVariants({ variant: "outline" })} to="/">
        Ana sayfaya dön
      </Link>
    </main>
  );
}

function ErrorFallback() {
  return (
    <main className="flex h-svh flex-col items-center justify-center gap-3 bg-background px-4 text-center">
      <h1 className="type-page-title">Bir şeyler ters gitti</h1>
      <p className="type-body text-muted-foreground">
        Sayfa yüklenirken beklenmeyen bir hata oluştu.
      </p>
      <button
        className={buttonVariants({ variant: "outline" })}
        onClick={() => window.location.reload()}
        type="button"
      >
        Sayfayı yenile
      </button>
    </main>
  );
}
