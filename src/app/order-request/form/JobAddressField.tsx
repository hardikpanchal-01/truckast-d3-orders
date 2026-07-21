"use client";

import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { INP, LBL } from "./styles";

/**
 * D3's map-pin button glyph: `<i class="fi fi-sr-land-location" style="font-size:19px">`
 * — Flaticon UICONS "land-location" (U+F859) from the `uicons-solid-rounded` webfont that
 * D3 bundles via the @flaticon/flaticon-uicons npm package.
 *
 * Inlined as the raw glyph outline rather than pulling in the webfont: the font is ~320KB
 * for this one icon, and Flaticon's public CDN is NOT a substitute — its build maps U+F859
 * to a completely different glyph (a "2"), so only the npm build has land-location here.
 *
 * The path is the font's own outline (300 unitsPerEm, ascent 300). Fonts are y-up from the
 * baseline and SVG is y-down, hence the flip; 19px matches D3's inline font-size.
 */
function LandLocationIcon() {
  return (
    <svg viewBox="0 0 300 300" width="19" height="19" fill="currentColor" aria-hidden="true">
      <g transform="translate(0, 300) scale(1, -1)">
        <path d="M212 274Q199 287 183.5 293.5Q168 300 150 300Q132 300 116.5 293.5Q101 287 88 274Q71 258 65.5 235Q60 212 65.5 189.5Q71 167 88 151L119 120Q132 108 150 108Q168 108 181 120L212 151Q224 163 231 179Q238 195 237.5 212.5Q237 230 230.5 246Q224 262 212 274ZM150 175Q134 175 123.5 186Q113 197 113 212.5Q113 228 123.5 239Q134 250 150 250Q166 250 176.5 239Q187 228 187.5 212.5Q188 197 177 186Q166 175 150 175ZM93 111L91 100L8 100L14 133Q16 147 24.5 157Q33 167 45 172Q54 150 71 133ZM4 75L88 75L77 0L50 0Q39 0 29 4.5Q19 9 12 17.5Q5 26 2 36.5Q-1 47 1 58ZM189 75L200 0L103 0L113 75ZM292 100L211 100L209 113L230 133Q246 150 255 172Q267 167 275.5 157Q284 147 286 133ZM288 18Q281 9 271 4.5Q261 0 250 0L225 0L215 75L296 75L299 58Q301 47 298 36.5Q295 26 288 18Z" />
      </g>
    </svg>
  );
}

// Public token (NEXT_PUBLIC_*) — safe to use client-side. The app already ships Mapbox
// for the truck map; there is no Google Maps key, so address autocomplete uses Mapbox.
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

interface Suggestion {
  id: string;
  place_name: string;
  /** Best-effort Region from the Mapbox geocode context (county → city → state). The exact
   *  Dolese region needs the plant/county→region mapping (pending the dashboard region work). */
  region: string;
}

interface MapboxContext {
  id: string;
  text: string;
}
interface MapboxFeature {
  id: string;
  place_name: string;
  context?: MapboxContext[];
}

export default function JobAddressField() {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const skipRef = useRef(false); // don't re-search the value we just injected on pick
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced Mapbox forward-geocode as the user types.
  useEffect(() => {
    if (skipRef.current) {
      skipRef.current = false;
      return;
    }
    const q = query.trim();
    if (q.length < 3 || !TOKEN) {
      setSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const url =
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json` +
          `?access_token=${TOKEN}&autocomplete=true&country=us&limit=5&types=address`;
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { features?: MapboxFeature[] };
        const feats: Suggestion[] = (data.features || []).map((f) => {
          const ctx = f.context || [];
          const byPrefix = (p: string) => ctx.find((c) => String(c.id).startsWith(p))?.text;
          const county = byPrefix("district");
          const city = byPrefix("place");
          const state = byPrefix("region");
          return { id: f.id, place_name: f.place_name, region: county || city || state || "" };
        });
        setSuggestions(feats);
        setOpen(true);
      } catch {
        /* aborted or network error — ignore */
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  // Close the dropdown on an outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(s: Suggestion) {
    skipRef.current = true;
    setQuery(s.place_name);
    setRegion(s.region);
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <>
      <div className="relative" ref={boxRef}>
        {/* D3 .copybtn-wrapper is `gap: 5px` and its .copy-btn measures 50x40, top-aligned
            (its `height:100%` resolves to auto, so it never stretches to the row).
            The input's mb-[10px] is Bootstrap's `input{margin-bottom:10px}`: on ordinary
            rows it collapses into the row's own 20px margin, but this flex wrapper stops
            it collapsing — so D3's address row really is 10px taller, and every field
            below it inherits that offset. */}
        <div className="flex items-start gap-[5px]">
          {/* D3's .copy-btn is a bare <button> on #ffcb05 with no colour of its own, so its
              glyph paints in the UA's buttontext — BLACK, not the brand green. */}
          <span className="flex h-10 w-[50px] shrink-0 cursor-pointer items-center justify-center bg-[#ffcb05] text-black">
            <LandLocationIcon />
          </span>
          <input
            className={`${INP} mb-[10px]`}
            name="jobAddress"
            placeholder="Enter Job Address Or Set Pin From Map Icon"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            autoComplete="off"
          />
        </div>
        {open && suggestions.length > 0 && (
          <div className="absolute left-[55px] right-0 z-20 mt-1 overflow-hidden rounded-[4px] border border-[#ddd] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.18)]">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pick(s)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-[#333] hover:bg-[#f0f0f0]"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#999]" strokeWidth={2} />
                <span>{s.place_name}</span>
              </button>
            ))}
            <div className="px-3 py-1 text-right text-[10px] text-[#999]">powered by Mapbox</div>
          </div>
        )}
      </div>
      {/* In D3 Region is its own unnumbered <li class="form-group">, so it sits a full
          20px below Job Address and wears the same label style as every other field. */}
      <label className={`${LBL} mt-5`}>Region</label>
      {/* Read-only, like D3's #region: it is derived from the address geocode, never typed. */}
      <input
        className={INP}
        name="region"
        placeholder="Region Will Be Populated Based On the Job Adress"
        value={region}
        readOnly
      />
    </>
  );
}
