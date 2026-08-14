"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useUIStore } from "@/stores/ui-store";
import { FONT_SCALE_MULTIPLIERS, DENSITY_MULTIPLIERS } from "@/lib/preferences";

export function PrefsApplier() {
  const { theme: ntTheme, setTheme: setNTTheme, resolvedTheme } = useTheme();
  const { prefs, prefsHydrated, hydratePrefs, hydrateNotifications } = useUIStore();

  useEffect(() => {
    hydratePrefs();
    hydrateNotifications();
  }, [hydratePrefs, hydrateNotifications]);

  useEffect(() => {
    if (!prefsHydrated) return;
    const root = document.documentElement;
    const fontScale = FONT_SCALE_MULTIPLIERS[prefs.appearance.fontSize] ?? 1;
    const density = DENSITY_MULTIPLIERS[prefs.appearance.density] ?? 1;
    root.style.setProperty("--font-scale", String(fontScale));
    root.style.setProperty("--density", String(density));
    root.style.setProperty(
      "--strong-focus",
      prefs.appearance.strongFocus ? "1" : "0"
    );
    if (prefs.appearance.strongFocus) {
      root.setAttribute("data-strong-focus", "true");
    } else {
      root.removeAttribute("data-strong-focus");
    }
    if (prefs.appearance.reducedMotion) {
      root.setAttribute("data-reduced-motion", "true");
    } else {
      root.removeAttribute("data-reduced-motion");
    }
  }, [
    prefsHydrated,
    prefs.appearance.fontSize,
    prefs.appearance.density,
    prefs.appearance.strongFocus,
    prefs.appearance.reducedMotion,
  ]);

  useEffect(() => {
    if (!prefsHydrated) return;
    const desired = prefs.appearance.theme;
    if (desired === "system") {
      if (ntTheme !== "system") setNTTheme("system");
    } else if (desired === "dark") {
      if (ntTheme !== "dark") setNTTheme("dark");
    } else if (desired === "light") {
      if (ntTheme !== "light") setNTTheme("light");
    }
    void resolvedTheme;
  }, [prefsHydrated, prefs.appearance.theme, ntTheme, setNTTheme, resolvedTheme]);

  return null;
}
