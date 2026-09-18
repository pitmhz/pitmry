import type { Metadata } from "next";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "Memory Dashboard",
  description: "Decisions, commits, and project notes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-background text-foreground min-h-screen">
        <TooltipProvider delay={400}>
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
