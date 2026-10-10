"use client";
// Light / dark / system theme — every app ships with this toggle in its header.
// Put `themeInitScript` (from ./theme-init — no "use client", so Server Components can import it)
// in <head>: <script dangerouslySetInnerHTML={{ __html: themeInitScript }} /> — the saved theme then
// applies before the first paint: no flash of the wrong theme.
import { useCallback, useEffect, useState } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "./icons";
import { THEME_KEY as KEY } from "./theme-init";

export type ThemeChoice = "light" | "dark" | "system";

function read(): ThemeChoice {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

/** "system" removes data-theme, so tokens.css follows the OS setting (and its changes). */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  useEffect(() => setChoice(read()), []);
  const set = useCallback((next: ThemeChoice) => {
    setChoice(next);
    const root = document.documentElement;
    if (next === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      /* private mode: the choice lasts for this visit */
    }
  }, []);
  return { choice, set };
}

const ORDER: ThemeChoice[] = ["light", "dark", "system"];
const META = {
  light: { Icon: SunIcon, label: "Light" },
  dark: { Icon: MoonIcon, label: "Dark" },
  system: { Icon: MonitorIcon, label: "System" },
} as const;

/** One quiet icon button: click cycles Light → Dark → System; the title says what's next. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { choice, set } = useTheme();
  const next = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length];
  const { Icon, label } = META[choice];
  return (
    <button
      type="button"
      onClick={() => set(next)}
      title={`Theme: ${label} — switch to ${META[next].label}`}
      aria-label={`Theme: ${label}. Switch to ${META[next].label}`}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-2 transition-colors duration-fast hover:bg-surface-2 hover:text-text ${className}`}
    >
      <Icon />
    </button>
  );
}
