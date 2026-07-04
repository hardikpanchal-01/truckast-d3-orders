import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "TRUCKAST Identity",
};

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Dark identity header */}
      <header className="flex h-[52px] items-center gap-3 bg-[#33383d] px-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/truckast_logo_256.png" alt="TRUCKAST" className="h-8 w-8 shrink-0" />
        <span className="text-[18px] font-semibold text-white">TRUCKAST Identity</span>
      </header>

      {/* Login card + help links */}
      <main className="flex flex-col items-center px-4 pt-12 pb-16">
        <LoginForm />

        <div className="mt-6 text-center text-[14px] leading-6">
          <a href="tel:+18667671676" className="block text-[#0d6efd] no-underline hover:underline">
            Need help? (866) 767-1676
          </a>
          <a href="#" className="block text-[#0d6efd] no-underline hover:underline">
            Privacy Policy
          </a>
        </div>
      </main>
    </div>
  );
}
