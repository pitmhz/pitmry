import type { Metadata } from "next";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NotificationToastProvider } from "@/lib/notification-toast-context";

export const metadata: Metadata = {
  title: "pitmry",
  description: "A personal memory dashboard by pitmhs — decisions, commits, and discussions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-background text-foreground min-h-screen">
        <NotificationToastProvider>
          <TooltipProvider delay={400}>
            {children}
          </TooltipProvider>
        </NotificationToastProvider>
      </body>
    </html>
  );
}
