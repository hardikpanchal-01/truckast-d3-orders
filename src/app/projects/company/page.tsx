"use client";

import { useState, useTransition } from "react";
import { SubHeader, SearchBox, FoldCard, CompletedCheckmark } from "@/components/d3-ui";
import { searchCompanies, type CompanySearchResult } from "@/actions/orderActions";

function CompanyTile({ company }: { company: CompanySearchResult }) {
  return (
    <div
      className="relative mb-[5px] block w-full cursor-pointer text-white sm:mr-[5px] sm:w-[274px]"
      style={{
        height: 90,
      }}
    >
      <FoldCard tone="green" className="h-full w-full">
        <div className="flex h-full w-full items-center">
          <div className="flex h-full w-[72px] shrink-0 items-center justify-center">
            <CompletedCheckmark size={48} />
          </div>
          <div className="flex min-w-0 flex-1 items-center pr-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] leading-[1.2] text-white/90">
                {company.name || company.code || "—"}
              </div>
              <div className="truncate text-[16px] font-bold leading-[1.2] text-white">
                {company.code || "—"}
              </div>
              <div className="truncate text-[12px] leading-[1.2] text-white/90">
                {company.user_count} USERS
              </div>
            </div>
          </div>
        </div>
      </FoldCard>
    </div>
  );
}

export default function CompanySearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [results, setResults] = useState<CompanySearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSearch = () => {
    if (!searchQuery.trim()) return;

    startTransition(async () => {
      const companies = await searchCompanies(searchQuery);
      setResults(companies);
      setSearched(true);
    });
  };

  const filteredResults = results.filter((c) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.code?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      <SubHeader title="COMPANY" backHref="/projects" />

      <div className="flex flex-col gap-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Enter a Customer Name or Number"
          className="block w-full rounded-[4px] border border-[#ccc] bg-white px-[10px] py-2 text-[14px] leading-[20px] text-[#555] shadow-[inset_0_1px_1px_rgba(0,0,0,0.075)] outline-none transition focus:border-[#66afe9] focus:shadow-[inset_0_1px_1px_rgba(0,0,0,0.075),0_0_8px_rgba(102,175,233,0.6)]"
        />

        <div>
          <button
            type="button"
            onClick={handleSearch}
            disabled={isPending}
            className="rounded-[4px] border border-[rgba(0,0,0,0.1)] border-b-[rgba(0,0,0,0.25)] bg-[#da4f49] bg-[linear-gradient(to_bottom,#ee5f5b,#bd362f)] px-8 py-2 text-[14px] font-normal text-white [text-shadow:0_-1px_0_rgba(0,0,0,0.25)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.05)] transition-[background] hover:bg-none hover:bg-[#bd362f] disabled:opacity-50"
          >
            {isPending ? "SEARCHING..." : "SEARCH"}
          </button>
        </div>

        <SearchBox
          value={filterQuery}
          onChange={setFilterQuery}
          placeholder="Search"
        />

        <div className="flex flex-wrap">
          {filteredResults.map((company) => (
            <CompanyTile key={company.id} company={company} />
          ))}
        </div>

        {searched && filteredResults.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">
            No companies found.
          </p>
        )}
      </div>
    </div>
  );
}
