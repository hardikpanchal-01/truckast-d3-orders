"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { login, type LoginState } from "@/actions/authActions";

const INPUT =
  "block w-full rounded-[4px] border border-[#ced4da] bg-white px-3 py-[6px] text-[14px] leading-[24px] text-[#212529] outline-none transition placeholder:text-[#6c757d] focus:border-[#86b7fe] focus:shadow-[0_0_0_0.25rem_rgba(13,110,253,0.25)]";

const LABEL = "mb-1 block text-[14px] text-[#212529]";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState | null, FormData>(login, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full max-w-[340px] rounded-[6px] border border-[#dee2e6] bg-white shadow-sm">
      {/* Logo header */}
      <div className="flex items-center justify-center rounded-t-[6px] border-b border-[#e9ecef] bg-[#f5f5f5] px-6 py-9">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/tkbanner.svg" alt="TRUCKAST" className="h-[72px] w-auto max-w-full" />
      </div>

      <form action={formAction} className="px-6 py-6">
        {state?.error ? (
          <div className="mb-4 rounded-[4px] border border-[#f5c2c7] bg-[#f8d7da] px-3 py-2 text-[14px] text-[#842029]">
            {state.error}
          </div>
        ) : null}

        <div className="mb-4">
          <label htmlFor="username" className={LABEL}>
            Username
          </label>
          <input id="username" name="username" type="text" placeholder="Username" autoComplete="username" className={INPUT} />
        </div>

        <div className="mb-3">
          <label htmlFor="password" className={LABEL}>
            Password
          </label>
          <div className="flex">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              autoComplete="current-password"
              className={`${INPUT} rounded-r-none`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="flex w-[46px] shrink-0 items-center justify-center rounded-r-[4px] border border-l-0 border-[#ced4da] bg-white text-[#212529] hover:bg-[#f8f9fa]"
            >
              {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </div>

        <label className="mb-4 flex items-center gap-2 text-[14px] text-[#212529]">
          <input type="checkbox" name="remember" className="h-[15px] w-[15px]" />
          Remember My Login
        </label>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-[4px] bg-[#0d6efd] px-3 py-[7px] text-[14px] font-normal text-white transition-colors hover:bg-[#0b5ed7] disabled:opacity-65"
        >
          {pending ? "Signing in…" : "Login"}
        </button>

        <a href="#" className="mt-3 block text-center text-[14px] text-[#0d6efd] no-underline hover:underline">
          Forgot Password?
        </a>

        <hr className="my-5 border-0 border-t border-[#dee2e6]" />

        <button
          type="button"
          className="w-full rounded-[4px] bg-[#6c757d] px-3 py-[7px] text-[14px] font-normal text-white transition-colors hover:bg-[#5c636a]"
        >
          Sign in with SSO
        </button>
      </form>
    </div>
  );
}
