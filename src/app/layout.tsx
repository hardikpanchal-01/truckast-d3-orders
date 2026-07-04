import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AppChrome } from "@/components/app-chrome";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dolese Orders — TRUCKAST D3",
  description: "D3 order tracking — Market Summary, Orders, Order Detail",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} antialiased`}>
      <body className="bg-white">
        {/* AppChrome adds the nav + content wrapper on app pages, and renders the
            login screen standalone (no nav). */}
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
