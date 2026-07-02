"use client";

import { useState, useTransition } from "react";
import { SubHeader, SearchBox, FoldCard, CompletedCheckmark } from "@/components/d3-ui";
import { searchProjectsByName, type ProjectSearchResult } from "@/actions/orderActions";

function ProjectTile({ project }: { project: ProjectSearchResult }) {
  return (
    <div
      className="relative block cursor-pointer text-white"
      style={{
        width: 274,
        height: 90,
        marginRight: 5,
        marginBottom: 5,
        float: "left",
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
                {project.customer_name || "—"}
              </div>
              <div className="truncate text-[16px] font-bold leading-[1.2] text-white">
                {project.name || project.code || "—"}
              </div>
              <div className="truncate text-[12px] leading-[1.2] text-white/90">
                {project.user_count} USERS
              </div>
            </div>
          </div>
        </div>
      </FoldCard>
    </div>
  );
}

export default function ProjectSearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [results, setResults] = useState<ProjectSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSearch = () => {
    if (!searchQuery.trim()) return;

    startTransition(async () => {
      const projects = await searchProjectsByName(searchQuery);
      setResults(projects);
      setSearched(true);
    });
  };

  const filteredResults = results.filter((p) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.customer_name?.toLowerCase().includes(q) ||
      p.code?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      <SubHeader title="PROJECT" backHref="/projects" />

      <div className="flex flex-col gap-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Enter a Project or Customer Name"
          className="w-full rounded-[4px] border border-[#cccccc] bg-white px-3 py-2 text-sm text-[#555] outline-none focus:border-[#66afe9] focus:shadow-[0_0_8px_rgba(102,175,233,0.6)]"
        />

        <div>
          <button
            type="button"
            onClick={handleSearch}
            disabled={isPending}
            className="rounded-[4px] bg-[#d2322d] px-8 py-2 text-sm font-semibold text-white hover:bg-[#c12e2a] disabled:opacity-50"
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
          {filteredResults.map((project) => (
            <ProjectTile key={project.id} project={project} />
          ))}
        </div>

        {searched && filteredResults.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">
            No projects found.
          </p>
        )}
      </div>
    </div>
  );
}
