"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "sans-serif", padding: 40, textAlign: "center" }}>
        <h2>Something went wrong.</h2>
        <button
          onClick={() => reset()}
          style={{ marginTop: 16, padding: "8px 20px", background: "#458b00", color: "#fff", border: 0, borderRadius: 4 }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
