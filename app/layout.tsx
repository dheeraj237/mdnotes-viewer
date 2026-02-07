/**
 * Root Layout - Wraps entire application with theme provider and global styles
 * suppressHydrationWarning prevents theme flicker on initial load
 */
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/shared/components/theme-provider";
import { Toaster } from "@/shared/components/toaster";

export const metadata: Metadata = {
  title: "MDNotes Viewer | Markdown Documentation Platform",
  description: "A modern markdown documentation viewer with VSCode-like interface, Mermaid diagrams, and dark mode support",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: Prevents mismatch between server/client theme rendering
    <html lang="en" suppressHydrationWarning>
      {/* overflow-hidden: Prevents body scroll, panels handle their own scrolling */}
      <body className="antialiased font-sans overflow-hidden h-screen">
        {/* attribute="class": Uses CSS classes for theme switching (dark/light mode) */}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          {/* Toast notifications for file operations and errors */}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
