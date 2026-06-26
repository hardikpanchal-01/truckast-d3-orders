import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-3 py-16 text-center">
      <p className="text-lg font-bold text-slate-700">Order not found</p>
      <p className="text-sm text-slate-500">That order doesn&apos;t exist or has no data.</p>
      <Link href="/" className="inline-block rounded bg-[#458b00] px-5 py-2 text-sm font-semibold text-white">
        Back to Dolese Orders
      </Link>
    </div>
  );
}
