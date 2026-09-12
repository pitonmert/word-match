import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const themeOptions = [
  { ariaLabel: "Açık tema", icon: Sun, label: "Açık", theme: "light" },
  { ariaLabel: "Koyu tema", icon: Moon, label: "Koyu", theme: "dark" },
  {
    ariaLabel: "Sistem teması",
    icon: Laptop,
    label: "Sistem",
    theme: "system",
  },
] as const satisfies ReadonlyArray<{
  ariaLabel: string;
  icon: typeof Sun;
  label: string;
  theme: Theme;
}>;

export function ThemeControls() {
  const { theme, setTheme } = useTheme();
  const selectedTheme =
    themeOptions.find((option) => option.theme === theme) ?? themeOptions[0];

  return (
    <div
      aria-label="Tema ayarları"
      className="flex items-center justify-between gap-3 px-1.5 py-1"
      role="group"
    >
      <span className="type-body flex items-center gap-1.5">
        Tema
        <span aria-hidden="true" className="text-muted-foreground">
          ·
        </span>
        <span
          key={selectedTheme.theme}
          aria-live="polite"
          className="motion-safe:animate-in motion-safe:duration-150 motion-safe:fade-in-0"
        >
          {selectedTheme.label}
        </span>
      </span>
      <div className="flex items-center gap-1">
        {themeOptions.map(({ ariaLabel, icon: Icon, theme: optionTheme }) => {
          const isSelected = theme === optionTheme;

          return (
            <Button
              key={optionTheme}
              aria-label={ariaLabel}
              aria-pressed={isSelected}
              className={cn(
                "min-w-7 border",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground shadow-surface hover:bg-primary hover:text-primary-foreground active:bg-primary active:text-primary-foreground"
                  : "border-transparent text-muted-foreground",
              )}
              size="icon-sm"
              title={ariaLabel}
              type="button"
              variant="ghost"
              onClick={() => setTheme(optionTheme)}
            >
              <Icon aria-hidden="true" data-icon="inline-start" />
            </Button>
          );
        })}
      </div>
    </div>
  );
}
