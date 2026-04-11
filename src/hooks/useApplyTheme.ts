import { useEffect } from "react";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { getThemeById, applyTheme } from "@/lib/colorThemes";

/**
 * Reads the saved theme_color_preset from platform_settings
 * and applies it to the document root CSS variables.
 */
export const useApplyTheme = () => {
  const { data: settings } = usePlatformSettings();

  useEffect(() => {
    const themeId = settings?.theme_color_preset || "default";
    const theme = getThemeById(themeId);
    applyTheme(theme);
  }, [settings?.theme_color_preset]);
};
