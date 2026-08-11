import type { Metadata, Viewport } from "next";
import Pwa from "@/components/pwa";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Lab Attendance",
    template: "%s · Lab Attendance",
  },
  description: "General Science Laboratory attendance system",
  applicationName: "Lab Attendance",
  appleWebApp: {
    capable: true,
    title: "Lab Attendance",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/favicon-64.png",
    apple: "/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#16202B",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      {/*
        `viewport-fit: cover` was removed. It let content sit under the notch
        and the status bar, which is right for a full-bleed camera view and
        wrong for every page with a header — the account name was rendering
        behind the clock.
      */}
      <body className="antialiased">
        {children}
        <Pwa />
      </body>
    </html>
  );
}
