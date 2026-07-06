"use client";

import { useCallback, useEffect, useRef } from "react";

export interface UseCtrlSOptions {
  /**
   * The save action. Pass the SAME function the Save button calls so the
   * shortcut and the button share one code path (loading/success/error state
   * lives in that function, not here).
   */
  onSave: () => void | Promise<void>;
  /** Master switch — only bind the listener while the page supports saving. Default true. */
  enabled?: boolean;
  /** Only fire when there are unsaved changes. Default true. */
  isDirty?: boolean;
  /** Skip while a save is already running (prevents duplicate requests). Default false. */
  isSaving?: boolean;
  /** Permission gate — user is allowed to save. Default true. */
  canSave?: boolean;
  /** Also fire while focused in input/textarea/contenteditable. Default false. */
  allowInInputs?: boolean;
  /** Minimum gap between triggers in ms — throttles key-repeat / rapid spam. Default 400. */
  throttleMs?: number;
}

/** True when focus is in a text-entry control we should not hijack by default. */
function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

/**
 * Global Ctrl+S (Win/Linux) / Cmd+S (macOS) save shortcut.
 *
 * - Suppresses the browser "Save page" dialog for the combo (always).
 * - Only runs `onSave` when enabled + dirty + permitted + not already saving.
 * - Ignores auto-repeat and throttles rapid presses to avoid duplicate saves.
 * - Skips text-entry fields unless `allowInInputs` opts in.
 * - Binds once and reads the latest props via a ref, so it never re-subscribes
 *   on every render and adds no extra re-renders of its own.
 */
export function useCtrlS({
  onSave,
  enabled = true,
  isDirty = true,
  isSaving = false,
  canSave = true,
  allowInInputs = false,
  throttleMs = 400,
}: UseCtrlSOptions): void {
  // Mirror the latest values so the (stable) handler always sees fresh state
  // without forcing a listener re-subscribe on each render.
  const latest = useRef({ onSave, isDirty, isSaving, canSave, allowInInputs, throttleMs });
  latest.current = { onSave, isDirty, isSaving, canSave, allowInInputs, throttleMs };

  const lastRunRef = useRef(0);

  const handler = useCallback((e: KeyboardEvent) => {
    // Ctrl (Win/Linux) or Cmd (macOS) + S, but not with Alt (leave other combos alone).
    const isSaveCombo = e.key.toLowerCase() === "s" && (e.ctrlKey || e.metaKey) && !e.altKey;
    if (!isSaveCombo) return;

    // Kill the native Save-page dialog for the combo unconditionally — it must
    // never appear on a page that owns this shortcut, even if we skip saving.
    e.preventDefault();

    const { onSave, isDirty, isSaving, canSave, allowInInputs, throttleMs } = latest.current;

    if (e.repeat) return; // held key: ignore OS auto-repeat
    if (!allowInInputs && isTextEntryTarget(e.target)) return;
    if (!canSave || !isDirty || isSaving) return;

    const now = Date.now();
    if (now - lastRunRef.current < throttleMs) return; // throttle bursts
    lastRunRef.current = now;

    void onSave();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // Capture phase so we intercept before field handlers and before the browser
    // default, matching how a native save shortcut is expected to behave.
    const opts: AddEventListenerOptions = { capture: true };
    window.addEventListener("keydown", handler, opts);
    return () => window.removeEventListener("keydown", handler, opts);
  }, [enabled, handler]);
}

export default useCtrlS;
