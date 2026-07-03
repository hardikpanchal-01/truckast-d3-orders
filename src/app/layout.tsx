import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { TopNav } from "@/components/d3-ui";

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
        <TopNav />
        <main className="mx-auto w-full max-w-[724px] px-[15px] py-[20px] min-[980px]:max-w-[1170px] min-[980px]:px-0">{children}</main>
      </body>
    </html>
  );
}
