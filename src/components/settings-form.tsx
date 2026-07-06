"use client";

import * as React from "react";
import { useCtrlS } from "@/hooks/useCtrlS";

/* Bootstrap 2.2.2 buttons — same metrics/styles as the rest of the settings page. */
const BTN =
  "box-content inline-block shrink-0 m-0 rounded-[4px] border border-[rgba(0,0,0,0.1)] border-b-[rgba(0,0,0,0.25)] " +
  "px-[12px] py-[4px] text-center align-middle text-[14px] font-normal leading-[20px] text-white cursor-pointer transition-[background] " +
  "[text-shadow:0_-1px_0_rgba(0,0,0,0.25)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.05)] " +
  "focus:outline-none active:outline-none active:bg-none active:text-white/75 " +
  "active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.15),0_1px_2px_rgba(0,0,0,0.05)] " +
  "disabled:cursor-not-allowed disabled:opacity-60";
const BTN_SUCCESS =
  "bg-[#5bb75b] bg-[linear-gradient(to_bottom,#62c462,#51a351)] hover:bg-none hover:bg-[#51a351] active:bg-[#51a351]";
const BTN_DANGER =
  "bg-[linear-gradient(to_bottom,#ee5f5b,#bd362f)] hover:bg-none hover:bg-[#bd362f] active:bg-[#bd362f]";

type SaveStatus = { kind: "ok" | "err"; msg: string } | null;

/**
 * Wraps the (server-rendered) settings fields, tracks unsaved changes, and owns
 * the single `save()` used by BOTH the Save button and the Ctrl/Cmd+S shortcut.
 *
 * `canSave` is the permission gate — default true; pass a real flag when the
 * app knows the user's rights.
 */
export function SettingsForm({
  children,
  canSave = true,
}: {
  children: React.ReactNode;
  canSave?: boolean;
}) {
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<SaveStatus>(null);

  // Single source of truth for saving — button click and shortcut both call this.
  const save = React.useCallback(async () => {
    // Guard here too (not just in the hook) so the button click is equally safe.
    if (saving || !dirty || !canSave) return;
    setSaving(true);
    setStatus(null);
    try {
      // TODO: replace with the real settings server action.
      await new Promise((resolve) => setTimeout(resolve, 800));
      setDirty(false);
      setStatus({ kind: "ok", msg: "Settings saved." });
    } catch {
      setStatus({ kind: "err", msg: "Couldn't save settings. Please try again." });
    } finally {
      setSaving(false);
    }
  }, [saving, dirty, canSave]);

  // This page is a form, so opt into saving while a field is focused (allowInInputs).
  useCtrlS({ onSave: save, isDirty: dirty, isSaving: saving, canSave, allowInInputs: true });

  // Fields are uncontrolled — any edit inside the form marks it dirty and clears
  // the previous status message.
  const markDirty = React.useCallback(() => {
    setDirty(true);
    setStatus(null);
  }, []);

  return (
    <form
      className="space-y-2"
      onChange={markDirty}
      onSubmit={(e) => e.preventDefault()}
    >
      {children}

      {/* Actions — BS2 .btn-success / .btn-danger; mb-5 reproduces form margin 0 0 20px. */}
      <div className="mb-5 flex items-center gap-3">
        <button type="button" className={`${BTN} ${BTN_SUCCESS} w-[120px]`}>
          ADMIN Settings
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty || !canSave}
          aria-keyshortcuts="Control+S Meta+S"
          className={`${BTN} ${BTN_DANGER} w-[150px]`}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {status ? (
          <span
            role="status"
            aria-live="polite"
            className={`text-[13px] leading-[20px] ${status.kind === "ok" ? "text-[#468847]" : "text-[#b94a48]"}`}
          >
            {status.msg}
          </span>
        ) : null}
      </div>
    </form>
  );
}
