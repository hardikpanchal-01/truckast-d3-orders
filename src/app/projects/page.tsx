"use client";

import Link from "next/link";
import { SubHeader } from "@/components/d3-ui";

import styles from "./projects.module.css";

export default function ProjectsPage() {
  return (
    <div className="space-y-5">
      <SubHeader title="INVITE TO" backHref="/" />

      <div className="flex flex-col gap-3">
        <Link href="/projects/company" className={styles.btn}>
          COMPANY
        </Link>

        <Link href="/projects/project" className={styles.btn}>
          PROJECT
        </Link>
      </div>
    </div>
  );
}
