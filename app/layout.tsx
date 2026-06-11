/**
 * app/layout.tsx
 *
 * Root layout — wraps every page in the application.
 *
 * Responsibilities:
 * - Sets the HTML `lang` attribute and base `<head>` metadata
 * - Imports global Tailwind CSS
 * - Wraps children with ThemeProvider (next-themes) for dark mode support
 *
 * This is a Server Component (no "use client" directive).
 * ThemeProvider is a Client Component but can be used here as a child.
 */

import type { Metadata } from "next";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Eskwelabs AI Advisor",
  description: "Internal AI advisor platform for Eskwelabs EIFs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
