"use client";

/**
 * components/ThemeProvider.tsx
 *
 * Thin wrapper around next-themes' ThemeProvider.
 * Must be a Client Component ("use client") because it uses React context.
 *
 * attribute="class" → next-themes adds class="dark" to <html>
 * defaultTheme="system" → respects OS dark/light preference on first visit
 * enableSystem → allows OS preference to be followed
 * disableTransitionOnChange → prevents a flash of unstyled transition on load
 */

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

export default function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
