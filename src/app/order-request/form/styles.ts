/**
 * Shared field styling for the Order Request form, transcribed from D3's
 * `d3_complete.css` (Bootstrap 2) plus the inline <style> on DoleseORV2.
 *
 * D3's body is `font-size: 14px`, so its em-based rules resolve against 14px.
 * Tailwind's spacing scale is rem-based off the 16px root, so any value D3
 * expresses in em is pinned to px here rather than mapped to a scale step.
 *
 * Values here were verified by measuring the saved DoleseORV2.htm in Chrome
 * (getComputedStyle), not read off the source — several of D3's declarations
 * lose to Bootstrap's cascade and never take effect.
 */

// D3's Bootstrap 2 `.container`, which the form card and header banner both sit in:
//   ≥1200px → 1170 · 980–1199px → 940 · 768–979px → 724 · ≤767px → auto.
// These are Bootstrap **2** widths — NOT Bootstrap 3's 1170/970/750, which is what
// this file used to carry. d3_complete.css is Bootstrap 2.2.2. AppChrome's <main>
// supplies the 20px gutter below 980px, so centring inside it lands on D3's x offset.
export const CARD =
  "mx-auto w-full min-[768px]:w-[724px] min-[980px]:w-[940px] min-[1200px]:w-[1170px]";

// D3 .form-control: grey fill, 4px left accent bar, square corners, 42px tall.
// leading-[100%] mirrors `line-height: 100%` — Tailwind's text-sm would otherwise
// force 20px and shift the text within the 42px box.
// `select option {color:#575757}` from D3's inline <style> is the arbitrary variant:
// the control itself is #555, but its dropdown options are two shades lighter.
export const INP =
  "block h-[42px] w-full rounded-none border border-[#f6f6f6] border-l-4 border-l-[#cfcfcf] bg-[#f6f6f6] px-3 py-1 text-sm leading-[100%] text-[#555] outline-none focus:border-[#ffcb05] focus:border-l-[#ffcb05] [&_option]:text-[#575757]";

// D3 .wizard-form-text-label overrides only font-size/weight/colour — the surrounding
// Bootstrap `label{display:block;margin-bottom:5px}` still supplies the 5px gap above
// the input. Tailwind's preflight leaves labels inline, so both are spelled out.
export const LBL = "mb-[5px] block text-[15px] font-medium text-[#575757]";

// D3 `span.require` is pure #ff0000 — not Tailwind's text-red-500 (#ef4444).
export const REQ = "text-[#ff0000]";
