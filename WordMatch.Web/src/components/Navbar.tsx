import { type MouseEvent } from "react";
import { LogOut, UserRound } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { ThemeControls } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/features/auth/AuthProvider";
import { FeedbackSoundControl } from "@/features/question-session/components/FeedbackSoundControl";
import { abandonStudySession } from "@/features/study/api/study";
import { reloadAt } from "@/lib/pageNavigation";

export function Navbar() {
  const { logout, user } = useAuth();
  const location = useLocation();
  const sessionId = getStudySessionId(location.pathname);

  const returnHome = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    if (!sessionId) {
      reloadAt("/");
      return;
    }

    void abandonThenReload(sessionId);
  };

  return (
    <nav className="shrink-0 border-b bg-background px-4 sm:px-6">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between">
        <Link
          className="type-card-title -ml-2 inline-flex min-h-11 items-center px-2 text-foreground"
          to="/"
          onClick={returnHome}
        >
          Word Match
        </Link>

        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label="Hesap menüsünü aç"
                  size="icon"
                  variant="ghost"
                />
              }
            >
              <UserRound aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="grid gap-0.5">
                  <span className="type-body truncate text-foreground">
                    {user?.username}
                  </span>
                  <span className="truncate font-normal">{user?.email}</span>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Görünüm</DropdownMenuLabel>
                <ThemeControls />
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Geri bildirim</DropdownMenuLabel>
                <FeedbackSoundControl />
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Oturum</DropdownMenuLabel>
                <DropdownMenuItem
                  className="mt-0.5 justify-center border border-error/30 bg-error-subtle py-1.5"
                  variant="destructive"
                  onClick={() => void logout()}
                >
                  <LogOut aria-hidden="true" />
                  Çıkış yap
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}

async function abandonThenReload(sessionId: string) {
  try {
    await abandonStudySession(sessionId);
  } catch {
    // Returning home must remain available when the cleanup request fails.
  }

  reloadAt("/");
}

function getStudySessionId(pathname: string) {
  const match = /^\/session\/([^/]+)$/.exec(pathname);
  return match?.[1] ?? null;
}
