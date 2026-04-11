/**
 * Preset color themes for the platform.
 * All values are HSL (without the "hsl()" wrapper) matching CSS variable format.
 */

export interface ColorTheme {
  id: string;
  name: string;
  description: string;
  colors: {
    background: string;
    foreground: string;
    card: string;
    "card-foreground": string;
    popover: string;
    "popover-foreground": string;
    primary: string;
    "primary-foreground": string;
    secondary: string;
    "secondary-foreground": string;
    muted: string;
    "muted-foreground": string;
    accent: string;
    "accent-foreground": string;
    destructive: string;
    "destructive-foreground": string;
    border: string;
    input: string;
    ring: string;
    "sidebar-background": string;
    "sidebar-foreground": string;
    "sidebar-primary": string;
    "sidebar-primary-foreground": string;
    "sidebar-accent": string;
    "sidebar-accent-foreground": string;
    "sidebar-border": string;
    "sidebar-ring": string;
    success: string;
    warning: string;
    gold: string;
    cyan: string;
    purple: string;
  };
  preview: {
    bg: string;
    primary: string;
    secondary: string;
    accent: string;
  };
}

export const COLOR_THEMES: ColorTheme[] = [
  {
    id: "default",
    name: "MayaX Blue",
    description: "Default blue & purple theme",
    colors: {
      background: "220 47% 5%",
      foreground: "210 40% 93%",
      card: "222 45% 10%",
      "card-foreground": "210 40% 93%",
      popover: "222 45% 10%",
      "popover-foreground": "210 40% 93%",
      primary: "217 91% 60%",
      "primary-foreground": "210 40% 98%",
      secondary: "263 70% 66%",
      "secondary-foreground": "210 40% 98%",
      muted: "220 30% 14%",
      "muted-foreground": "215 20% 55%",
      accent: "192 91% 42%",
      "accent-foreground": "210 40% 98%",
      destructive: "0 84% 60%",
      "destructive-foreground": "210 40% 98%",
      border: "215 25% 18%",
      input: "215 25% 18%",
      ring: "217 91% 60%",
      "sidebar-background": "222 45% 10%",
      "sidebar-foreground": "215 20% 55%",
      "sidebar-primary": "217 91% 60%",
      "sidebar-primary-foreground": "210 40% 98%",
      "sidebar-accent": "222 40% 15%",
      "sidebar-accent-foreground": "210 40% 98%",
      "sidebar-border": "215 25% 18%",
      "sidebar-ring": "217 91% 60%",
      success: "142 71% 45%",
      warning: "38 92% 50%",
      gold: "42 61% 54%",
      cyan: "192 91% 42%",
      purple: "263 70% 66%",
    },
    preview: { bg: "#0b1120", primary: "#3b82f6", secondary: "#8b5cf6", accent: "#06b6d4" },
  },
  {
    id: "emerald",
    name: "Emerald Night",
    description: "Deep green & teal tones",
    colors: {
      background: "160 30% 5%",
      foreground: "160 20% 93%",
      card: "160 35% 9%",
      "card-foreground": "160 20% 93%",
      popover: "160 35% 9%",
      "popover-foreground": "160 20% 93%",
      primary: "160 84% 39%",
      "primary-foreground": "160 20% 98%",
      secondary: "175 70% 40%",
      "secondary-foreground": "160 20% 98%",
      muted: "160 25% 13%",
      "muted-foreground": "160 15% 52%",
      accent: "142 70% 45%",
      "accent-foreground": "160 20% 98%",
      destructive: "0 84% 60%",
      "destructive-foreground": "160 20% 98%",
      border: "160 20% 16%",
      input: "160 20% 16%",
      ring: "160 84% 39%",
      "sidebar-background": "160 35% 9%",
      "sidebar-foreground": "160 15% 52%",
      "sidebar-primary": "160 84% 39%",
      "sidebar-primary-foreground": "160 20% 98%",
      "sidebar-accent": "160 30% 14%",
      "sidebar-accent-foreground": "160 20% 98%",
      "sidebar-border": "160 20% 16%",
      "sidebar-ring": "160 84% 39%",
      success: "142 71% 45%",
      warning: "38 92% 50%",
      gold: "42 61% 54%",
      cyan: "175 70% 40%",
      purple: "160 84% 39%",
    },
    preview: { bg: "#0a1a14", primary: "#10b981", secondary: "#14b8a6", accent: "#22c55e" },
  },
  {
    id: "crimson",
    name: "Crimson Edge",
    description: "Bold red & warm tones",
    colors: {
      background: "0 20% 5%",
      foreground: "0 10% 93%",
      card: "0 25% 9%",
      "card-foreground": "0 10% 93%",
      popover: "0 25% 9%",
      "popover-foreground": "0 10% 93%",
      primary: "0 72% 51%",
      "primary-foreground": "0 10% 98%",
      secondary: "25 95% 53%",
      "secondary-foreground": "0 10% 98%",
      muted: "0 18% 13%",
      "muted-foreground": "0 10% 52%",
      accent: "340 82% 52%",
      "accent-foreground": "0 10% 98%",
      destructive: "0 84% 60%",
      "destructive-foreground": "0 10% 98%",
      border: "0 15% 16%",
      input: "0 15% 16%",
      ring: "0 72% 51%",
      "sidebar-background": "0 25% 9%",
      "sidebar-foreground": "0 10% 52%",
      "sidebar-primary": "0 72% 51%",
      "sidebar-primary-foreground": "0 10% 98%",
      "sidebar-accent": "0 20% 14%",
      "sidebar-accent-foreground": "0 10% 98%",
      "sidebar-border": "0 15% 16%",
      "sidebar-ring": "0 72% 51%",
      success: "142 71% 45%",
      warning: "38 92% 50%",
      gold: "42 61% 54%",
      cyan: "340 82% 52%",
      purple: "25 95% 53%",
    },
    preview: { bg: "#1a0a0a", primary: "#dc2626", secondary: "#f97316", accent: "#ec4899" },
  },
  {
    id: "royal-purple",
    name: "Royal Purple",
    description: "Rich purple & violet vibes",
    colors: {
      background: "270 30% 5%",
      foreground: "270 15% 93%",
      card: "270 35% 10%",
      "card-foreground": "270 15% 93%",
      popover: "270 35% 10%",
      "popover-foreground": "270 15% 93%",
      primary: "263 70% 50%",
      "primary-foreground": "270 15% 98%",
      secondary: "290 60% 55%",
      "secondary-foreground": "270 15% 98%",
      muted: "270 25% 13%",
      "muted-foreground": "270 15% 52%",
      accent: "240 60% 60%",
      "accent-foreground": "270 15% 98%",
      destructive: "0 84% 60%",
      "destructive-foreground": "270 15% 98%",
      border: "270 20% 17%",
      input: "270 20% 17%",
      ring: "263 70% 50%",
      "sidebar-background": "270 35% 10%",
      "sidebar-foreground": "270 15% 52%",
      "sidebar-primary": "263 70% 50%",
      "sidebar-primary-foreground": "270 15% 98%",
      "sidebar-accent": "270 30% 15%",
      "sidebar-accent-foreground": "270 15% 98%",
      "sidebar-border": "270 20% 17%",
      "sidebar-ring": "263 70% 50%",
      success: "142 71% 45%",
      warning: "38 92% 50%",
      gold: "42 61% 54%",
      cyan: "240 60% 60%",
      purple: "290 60% 55%",
    },
    preview: { bg: "#110a1a", primary: "#7c3aed", secondary: "#c026d3", accent: "#6366f1" },
  },
  {
    id: "ocean",
    name: "Ocean Depth",
    description: "Deep ocean blues & aqua",
    colors: {
      background: "200 40% 5%",
      foreground: "200 20% 93%",
      card: "200 40% 9%",
      "card-foreground": "200 20% 93%",
      popover: "200 40% 9%",
      "popover-foreground": "200 20% 93%",
      primary: "199 89% 48%",
      "primary-foreground": "200 20% 98%",
      secondary: "186 75% 42%",
      "secondary-foreground": "200 20% 98%",
      muted: "200 30% 13%",
      "muted-foreground": "200 15% 52%",
      accent: "210 70% 50%",
      "accent-foreground": "200 20% 98%",
      destructive: "0 84% 60%",
      "destructive-foreground": "200 20% 98%",
      border: "200 25% 16%",
      input: "200 25% 16%",
      ring: "199 89% 48%",
      "sidebar-background": "200 40% 9%",
      "sidebar-foreground": "200 15% 52%",
      "sidebar-primary": "199 89% 48%",
      "sidebar-primary-foreground": "200 20% 98%",
      "sidebar-accent": "200 35% 14%",
      "sidebar-accent-foreground": "200 20% 98%",
      "sidebar-border": "200 25% 16%",
      "sidebar-ring": "199 89% 48%",
      success: "142 71% 45%",
      warning: "38 92% 50%",
      gold: "42 61% 54%",
      cyan: "186 75% 42%",
      purple: "210 70% 50%",
    },
    preview: { bg: "#081318", primary: "#0ea5e9", secondary: "#14b8a6", accent: "#3b82f6" },
  },
  {
    id: "amber-gold",
    name: "Amber Gold",
    description: "Warm gold & amber luxury",
    colors: {
      background: "30 20% 5%",
      foreground: "30 15% 93%",
      card: "30 25% 9%",
      "card-foreground": "30 15% 93%",
      popover: "30 25% 9%",
      "popover-foreground": "30 15% 93%",
      primary: "38 92% 50%",
      "primary-foreground": "30 15% 8%",
      secondary: "25 80% 45%",
      "secondary-foreground": "30 15% 98%",
      muted: "30 18% 13%",
      "muted-foreground": "30 12% 52%",
      accent: "42 61% 54%",
      "accent-foreground": "30 15% 8%",
      destructive: "0 84% 60%",
      "destructive-foreground": "30 15% 98%",
      border: "30 15% 16%",
      input: "30 15% 16%",
      ring: "38 92% 50%",
      "sidebar-background": "30 25% 9%",
      "sidebar-foreground": "30 12% 52%",
      "sidebar-primary": "38 92% 50%",
      "sidebar-primary-foreground": "30 15% 8%",
      "sidebar-accent": "30 20% 14%",
      "sidebar-accent-foreground": "30 15% 98%",
      "sidebar-border": "30 15% 16%",
      "sidebar-ring": "38 92% 50%",
      success: "142 71% 45%",
      warning: "38 92% 50%",
      gold: "42 61% 54%",
      cyan: "42 61% 54%",
      purple: "25 80% 45%",
    },
    preview: { bg: "#17120a", primary: "#f59e0b", secondary: "#d97706", accent: "#c8a84e" },
  },
  {
    id: "slate-minimal",
    name: "Slate Minimal",
    description: "Clean neutral grays",
    colors: {
      background: "220 14% 6%",
      foreground: "210 15% 92%",
      card: "220 14% 10%",
      "card-foreground": "210 15% 92%",
      popover: "220 14% 10%",
      "popover-foreground": "210 15% 92%",
      primary: "210 20% 60%",
      "primary-foreground": "210 15% 98%",
      secondary: "215 15% 50%",
      "secondary-foreground": "210 15% 98%",
      muted: "220 12% 14%",
      "muted-foreground": "215 10% 48%",
      accent: "210 15% 45%",
      "accent-foreground": "210 15% 98%",
      destructive: "0 84% 60%",
      "destructive-foreground": "210 15% 98%",
      border: "220 12% 17%",
      input: "220 12% 17%",
      ring: "210 20% 60%",
      "sidebar-background": "220 14% 10%",
      "sidebar-foreground": "215 10% 48%",
      "sidebar-primary": "210 20% 60%",
      "sidebar-primary-foreground": "210 15% 98%",
      "sidebar-accent": "220 12% 15%",
      "sidebar-accent-foreground": "210 15% 98%",
      "sidebar-border": "220 12% 17%",
      "sidebar-ring": "210 20% 60%",
      success: "142 71% 45%",
      warning: "38 92% 50%",
      gold: "42 61% 54%",
      cyan: "210 15% 45%",
      purple: "215 15% 50%",
    },
    preview: { bg: "#0f1114", primary: "#8093a8", secondary: "#6b7f95", accent: "#627388" },
  },
  {
    id: "neon-cyber",
    name: "Neon Cyber",
    description: "Cyberpunk neon greens & pinks",
    colors: {
      background: "240 15% 4%",
      foreground: "80 40% 92%",
      card: "240 18% 8%",
      "card-foreground": "80 40% 92%",
      popover: "240 18% 8%",
      "popover-foreground": "80 40% 92%",
      primary: "150 100% 50%",
      "primary-foreground": "240 15% 4%",
      secondary: "330 100% 60%",
      "secondary-foreground": "240 15% 98%",
      muted: "240 14% 12%",
      "muted-foreground": "240 10% 50%",
      accent: "60 100% 50%",
      "accent-foreground": "240 15% 4%",
      destructive: "0 84% 60%",
      "destructive-foreground": "240 15% 98%",
      border: "240 12% 15%",
      input: "240 12% 15%",
      ring: "150 100% 50%",
      "sidebar-background": "240 18% 8%",
      "sidebar-foreground": "240 10% 50%",
      "sidebar-primary": "150 100% 50%",
      "sidebar-primary-foreground": "240 15% 4%",
      "sidebar-accent": "240 15% 13%",
      "sidebar-accent-foreground": "80 40% 92%",
      "sidebar-border": "240 12% 15%",
      "sidebar-ring": "150 100% 50%",
      success: "142 71% 45%",
      warning: "38 92% 50%",
      gold: "60 100% 50%",
      cyan: "150 100% 50%",
      purple: "330 100% 60%",
    },
    preview: { bg: "#09090f", primary: "#00ff80", secondary: "#ff3399", accent: "#ffff00" },
  },
];

export function getThemeById(id: string): ColorTheme {
  return COLOR_THEMES.find((t) => t.id === id) || COLOR_THEMES[0];
}

export function applyTheme(theme: ColorTheme) {
  const root = document.documentElement;
  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value);
  });
}
