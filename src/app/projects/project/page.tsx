"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SubHeader } from "@/components/d3-ui";
import { searchProjectsByName, type ProjectSearchResult } from "@/actions/orderActions";
import styles from "./project.module.css";

function ProjectTile({ project }: { project: ProjectSearchResult }) {
  const router = useRouter();
  const bgColor = project.user_count > 0 ? "rgb(69, 139, 0)" : "rgb(247, 187, 0)";

  return (
    <div
      className={styles.tile}
      style={{ backgroundColor: bgColor }}
      onClick={() => router.push(`/rollout/customers/${project.id}`)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/dogear.png" alt="" className={styles.tileDogear} />
      <div className={styles.tileContainer}>
        <div className={styles.tileIcon}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/completed.png" alt="" />
        </div>
        <div className={styles.tileInfoSection}>
          <div className={styles.tileCell}>
            <div className={styles.tileSuperTitle}>{project.customer_name || "—"}</div>
            <div className={styles.tileTitle}>{project.name || project.code || "—"}</div>
            <div className={styles.tileSubTitle}>{project.user_count} USERS</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NoResultTile() {
  return (
    <div className={styles.tileNoResult}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/dogear.png" alt="" className={styles.tileDogearHidden} />
      <div className={styles.tileContainer}>
        <div className={styles.tileIcon}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/cancelled.png" alt="" />
        </div>
        <div className={styles.tileInfoSection}>
          <div className={styles.tileCell}>
            <div className={styles.tileSuperTitle}></div>
            <div className={styles.tileTitle}>NO RESULTS</div>
            <div className={styles.tileSubTitle}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectSearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [results, setResults] = useState<ProjectSearchResult[]>([]);
  const [isPending, startTransition] = useTransition();

  const handleSearch = () => {
    if (!searchQuery.trim()) return;

    startTransition(async () => {
      const projects = await searchProjectsByName(searchQuery);
      setResults(projects);
    });
  };

  const filteredResults = results.filter((p) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toUpperCase();
    const text = `${p.customer_name || ""} ${p.name || ""} ${p.code || ""} ${p.user_count} USERS`.toUpperCase();
    return text.includes(q);
  });

  return (
    <div>
      <div className={styles.subHeaderWrap}>
        <SubHeader title="PROJECT" backHref="/projects" />
      </div>
      <br />

      <div style={{ display: "block", width: "100%" }}>
        <table className={styles.table}>
          <tbody>
            <tr>
              <td>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Enter a Project or Customer Name"
                  className={styles.searchInput}
                />
              </td>
            </tr>
            <tr>
              <td></td>
            </tr>
            <tr>
              <td>
                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={isPending}
                  className={styles.searchBtn}
                >
                  {isPending ? "SEARCHING..." : "SEARCH"}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <br />
      <br />

      <div style={{ width: "100%", display: "block" }}>
        <input
          type="text"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder="Search"
          className={styles.filterSearch}
        />
        <div className={styles.clearBoth}></div>

        <div style={{ display: "inline-block" }}>
          {filteredResults.length > 0 ? (
            filteredResults.map((project) => (
              <ProjectTile key={project.id} project={project} />
            ))
          ) : (
            <NoResultTile />
          )}
        </div>
      </div>
    </div>
  );
}
