"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SubHeader } from "@/components/d3-ui";
import { searchCompanies, type CompanySearchResult } from "@/actions/orderActions";
import styles from "./company.module.css";

/**
 * Result tile — matches production tile structure exactly.
 * Yellow (#f7bb00) for 0 users, Green (#458b00) for 1+ users.
 * Completed.png icon, dogear visible, click navigates to company detail.
 */
function CompanyTile({ company }: { company: CompanySearchResult }) {
  const router = useRouter();
  const bgColor = company.user_count > 0 ? "rgb(69, 139, 0)" : "rgb(247, 187, 0)";

  return (
    <div
      className={styles.tile}
      style={{ backgroundColor: bgColor }}
      onClick={() => router.push(`/rollout/customers/${company.id}`)}
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
            <div className={styles.tileSuperTitle}>#{company.code}</div>
            <div className={styles.tileTitle}>{company.name && company.name.trim() !== company.code ? `${company.name} ${company.code}` : company.code}</div>
            <div className={styles.tileSubTitle}>{company.user_count} USERS</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * No result tile — white bg, Cancelled.png, hidden dogear.
 */
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

  // Filter search — case-insensitive, matches across all tile text (same as production)
  const filteredResults = results.filter((c) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toUpperCase();
    const text = `${c.code || ""} ${c.name || ""} ${c.user_count} USERS`.toUpperCase();
    return text.includes(q);
  });

  return (
    <div>
      <div className={styles.subHeaderWrap}>
        <SubHeader title="COMPANY" backHref="/projects" />
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
                  placeholder="Enter a Customer Name or Number"
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
            filteredResults.map((company) => (
              <CompanyTile key={company.id} company={company} />
            ))
          ) : (
            <NoResultTile />
          )}
        </div>
      </div>
    </div>
  );
}
