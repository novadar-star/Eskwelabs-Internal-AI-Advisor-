import type { Metadata } from "next";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Eskwelabs AI Advisor",
  description: "Internal AI advisor platform for Eskwelabs EIFs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/*
       * Body base: dark surface. antialiased for crisp text rendering.
       * text-[14px] sets the 14px base described in the design spec.
       */}
      <body
        className="bg-surface-base text-ink antialiased"
        style={{ fontSize: "14px", lineHeight: "1.6" }}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
