"use client";

import * as React from "react";

export interface ActivityMessage {
  text: string;
  /** e.g. "Jun 29 @ 9:18AM CST" */
  time?: string;
}

const CARD = "#d6e3ec";

/** Light-blue speech-bubble card with the green Truckast icon + Comment link. */
function ActivityCard({ children, time }: { children: React.ReactNode; time?: string }) {
  return (
    <div className="relative rounded px-4 py-3" style={{ backgroundColor: CARD }}>
      <div className="text-[14px] leading-[20px] text-[#333]">{children}</div>
      <div className="mt-1 flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/truckast-40.png" alt="" className="h-10 w-10 rounded" />
        {time ? <span className="text-[11px] text-[#333]">- {time}</span> : null}
      </div>
      <a href="#" className="text-[11px] text-[#2f7ed8] hover:underline">
        Comment
      </a>
      {/* right-pointing tail */}
      <span
        className="absolute right-[-7px] top-4 h-0 w-0 border-y-[7px] border-l-[8px] border-y-transparent"
        style={{ borderLeftColor: CARD }}
      />
    </div>
  );
}

export function OrderActivity({
  messages = [],
  summary,
}: {
  messages?: ActivityMessage[];
  summary: React.ReactNode;
}) {
  const [msg, setMsg] = React.useState("");

  return (
    <div className="space-y-3 border-t border-slate-200 pt-4">
      {/* message input bar */}
      <div className="flex items-center gap-3">
        <button type="button" aria-label="Add photo" className="shrink-0 cursor-pointer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/camera.png" alt="Add photo" className="h-9 w-9" />
        </button>
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Enter your message"
          className="h-[34px] flex-1 rounded-[4px] border border-[#cccccc] bg-white px-3 text-sm text-[#555] outline-none transition focus:border-[#66afe9] focus:shadow-[0_0_8px_rgba(102,175,233,0.6)]"
        />
        <button
          type="button"
          className="h-[34px] cursor-pointer rounded-[4px] bg-[#2f7ed8] px-5 text-sm font-semibold text-white hover:brightness-110"
        >
          Send
        </button>
      </div>

      {/* activity feed */}
      <div className="space-y-2">
        {messages.map((m, i) => (
          <ActivityCard key={i} time={m.time}>
            {m.text}
          </ActivityCard>
        ))}
        <ActivityCard>{summary}</ActivityCard>
      </div>
    </div>
  );
}
