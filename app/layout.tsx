/**
 * app/layout.tsx
 *
 * Root layout — wraps every page in the application.
 *
 * Responsibilities:
 * - Sets the HTML `lang` attribute and base `<head>` metadata
 * - Imports global Tailwind CSS
 * - Will wrap children with a SessionProvider once auth is implemented
 *
 * This is a Server Component (no "use client" directive).
 */

import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body className="bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
