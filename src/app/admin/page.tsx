"use client";

import { useState } from "react";
import { SubHeader, SearchBox } from "@/components/d3-ui";

export default function AdminPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = () => {
    // In a real app, this would call an API to search users
    setSearched(true);
    // For now, just show empty results
    setResults([]);
  };

  return (
    <div className="space-y-5">
      <SubHeader title="SEARCH USERS" backHref="/settings" />

      <div className="space-y-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for a User, Email, or Phone"
          className="w-full rounded-[4px] border border-[#cccccc] bg-white px-3 py-2 text-sm text-[#555] outline-none focus:border-[#66afe9] focus:shadow-[0_0_8px_rgba(102,175,233,0.6)]"
        />

        <button
          type="button"
          onClick={handleSearch}
          className="rounded-[4px] bg-[#d2322d] px-8 py-2 text-sm font-semibold text-white hover:bg-[#c12e2a]"
        >
          Search
        </button>

        <SearchBox
          value={filterQuery}
          onChange={setFilterQuery}
          placeholder="Search"
          className="w-full"
        />

        {searched && results.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">
            No users found.
          </p>
        )}
      </div>
    </div>
  );
}
