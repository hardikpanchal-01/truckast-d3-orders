import Link from "next/link";
import { SubHeader } from "@/components/d3-ui";

const btnStyle = {
  width: 250,
  display: "inline-block",
  padding: "11px 19px",
  fontSize: "17.5px",
  lineHeight: "20px",
  textAlign: "center" as const,
  textShadow: "0 -1px 0 rgba(0, 0, 0, 0.25)",
  backgroundColor: "#006dcc",
  backgroundImage: "linear-gradient(to bottom, #0088cc, #0044cc)",
  backgroundRepeat: "repeat-x",
  border: "1px solid #0044cc",
  borderColor: "rgba(0, 0, 0, 0.1) rgba(0, 0, 0, 0.1) rgba(0, 0, 0, 0.25)",
  borderRadius: "6px",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 1px 2px rgba(0, 0, 0, 0.05)",
  color: "#ffffff",
  fontWeight: "bold",
  cursor: "pointer",
};

export default function ProjectsPage() {
  return (
    <div className="space-y-5">
      <SubHeader title="INVITE TO" backHref="/" />

      <div className="flex flex-col gap-3">
        <Link href="/projects/company" style={btnStyle} className="block">
          COMPANY
        </Link>

        <Link href="/projects/project" style={btnStyle} className="block">
          PROJECT
        </Link>
      </div>
    </div>
  );
}
