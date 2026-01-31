/**
 * Width breakpoints
 * Dynamically read from src/styles/main.css @theme configuration
 */

const getBreakpoint = (name: string, fallback: number): number => {
    if (typeof window === "undefined") return fallback;

    // Tailwind v4 exports @theme variables as standard CSS variables
    const value = getComputedStyle(document.documentElement)
        .getPropertyValue(`--breakpoint-${name}`)
        .trim();

    // Remove 'px' unit and convert to number
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? fallback : parsed;
};

export const BREAKPOINT_SM = getBreakpoint("sm", 512);   // Tailwind sm
export const BREAKPOINT_MD = getBreakpoint("md", 768);   // Tailwind md
export const BREAKPOINT_LG = getBreakpoint("lg", 1280);  // Tailwind lg
export const BREAKPOINT_XL = getBreakpoint("xl", 1920);  // Tailwind xl