"use client";

import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Matches D3's .form-control (see page.tsx INP): grey fill, 4px left accent, 42px tall.
const INP =
  "block h-[42px] w-full rounded-none border border-[#f6f6f6] border-l-4 border-l-[#cfcfcf] bg-[#f6f6f6] px-3 py-1 text-sm text-[#555] outline-none focus:border-[#ffcb05] focus:border-l-[#ffcb05]";

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
        <div className="flex items-stretch gap-2">
          <span className="flex w-10 shrink-0 items-center justify-center rounded-[4px] bg-[#f5c518] text-[#1f3a2d]">
            <MapPin className="h-5 w-5" strokeWidth={2} />
          </span>
          <input
            className={INP}
            name="jobAddress"
            placeholder="Enter Job Address Or Set Pin From Map Icon"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            autoComplete="off"
          />
        </div>
        {open && suggestions.length > 0 && (
          <div className="absolute left-12 right-0 z-20 mt-1 overflow-hidden rounded-[4px] border border-[#ddd] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.18)]">
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
      <label className="mb-1 mt-3 block text-sm text-[#333]">Region</label>
      <input
        className={INP}
        name="region"
        placeholder="Region Will Be Populated Based On the Job Adress"
        value={region}
        onChange={(e) => setRegion(e.target.value)}
      />
    </>
  );
}
