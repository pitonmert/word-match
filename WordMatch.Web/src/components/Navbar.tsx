import { BookOpen, LogOut, UserRound } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { ModeToggle } from "@/components/mode-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

export function Navbar() {
  const { logout, user } = useAuth();

  return (
    <nav className="shrink-0 border-b bg-background px-4 sm:px-6">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between">
        <div className="flex items-center gap-1">
          <Link className="type-card-title py-3 text-foreground" to="/">
            Word Match
          </Link>
          <NavLink
            className={({ isActive }) =>
              cn(
                buttonVariants({
                  size: "sm",
                  variant: isActive ? "secondary" : "ghost",
                }),
              )
            }
            to="/words"
          >
            <BookOpen aria-hidden="true" />
            Kelimeler
          </NavLink>
        </div>

        <div className="flex items-center gap-1">
          <ModeToggle />
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
              <DropdownMenuItem onClick={() => void logout()}>
                <LogOut aria-hidden="true" />
                Çıkış yap
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
