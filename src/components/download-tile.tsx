"use client";

import styles from "./order-tiles.module.css";

/**
 * D3's download tile — a green .tile (rgb(69,139,0)) with the XLS badge and
 * SuperTitle = date, Title = "ORDERS", SubTitle = "Download".
 * Plain D3 CSS (no Tailwind), same tile structure as the order tiles.
 */
export function DownloadTile({ date }: { date: string }) {
  const handleDownload = () => {
    window.location.href = `/api/orders/export?date=${date}`;
  };

  // Zero-padded MM/DD/YYYY like D3 (avoid new Date() TZ shift; date is YYYY-MM-DD).
  const [yy, mm, dd] = date.split("-");
  const shown = mm && dd && yy ? `${mm}/${dd}/${yy}` : date;

  return (
    <div className={styles.tiles}>
      <button
        type="button"
        onClick={handleDownload}
        className={`${styles.tile} ${styles.downloadReset}`}
        style={{ backgroundColor: "rgb(69, 139, 0)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/dogear.png" alt="" aria-hidden className={styles.dogear} />
        <div className={styles.tileContainer}>
          <div className={styles.tileIcon}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/excel-xls.png" alt="Export to Excel" width={64} height={64} />
          </div>
          <div className={styles.tileInfoSection}>
            <div className={styles.tileCell}>
              <div className={styles.tileSuperTitle}>{shown}</div>
              <div className={styles.tileTitle}>ORDERS</div>
              <div className={styles.tileSubTitle}>Download</div>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}
