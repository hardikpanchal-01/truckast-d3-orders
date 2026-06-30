import Link from "next/link";
import { notFound } from "next/navigation";
import { getRolloutUser } from "@/actions/orderActions";
import { SubHeader, FoldCard, type ToneName } from "@/components/d3-ui";

export const dynamic = "force-dynamic";

interface IconSpec {
  src: string;
  w: number;
  h: number;
}

// Each glyph keeps its own display size (the 72×80 slot stays constant).
const ICON = {
  phone: { src: "https://d3.truckast.com/Images/Icons/tab-bar/white/phone-white@2x.png", w: 60, h: 60 },
  email: { src: "https://d3.truckast.com/Images/Icons/tab-bar/white/email-white@2x.png", w: 60, h: 60 },
  idCard: { src: "https://d3.truckast.com/Images/Icons/tab-bar/white/id-card-white@2x.png", w: 60, h: 60 },
  sms: { src: "https://d3.truckast.com/Images/Icons/tab-bar/white/message-notification-white@2x.png", w: 60, h: 60 },
  cancelled: { src: "https://d3.truckast.com/Images/Tiles/Cancelled.png", w: 72, h: 80 },
  completed: { src: "https://d3.truckast.com/Images/Tiles/Completed.png", w: 72, h: 80 },
  companies: { src: "https://d3.truckast.com/images/companyuser.png", w: 72, h: 72 },
  projects: { src: "https://d3.truckast.com/images/projects.png", w: 72, h: 72 },
  user: { src: "https://d3.truckast.com/Images/user.png", w: 70, h: 70 },
} as const;

interface Tile {
  icon: IconSpec;
  tone: ToneName;
  l1?: string;
  l2: string;
  l3?: string;
  href?: string;
}

function ActionTile({ t }: { t: Tile }) {
  const card = (
    <FoldCard tone={t.tone} className={`h-[90px] w-[274px] text-white${t.href ? " cursor-pointer" : ""}`}>
      <div className="flex h-full items-center gap-2 p-1">
        <div className="flex h-[80px] w-[72px] shrink-0 items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={t.icon.src}
            alt=""
            style={{ width: t.icon.w, height: t.icon.h }}
            className="object-contain"
          />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          {t.l1 ? <p className="truncate text-[12px] opacity-95">{t.l1}</p> : null}
          <p className="truncate text-[14px] font-bold leading-tight">{t.l2}</p>
          {t.l3 ? <p className="truncate text-[11px] opacity-90">{t.l3}</p> : null}
        </div>
      </div>
    </FoldCard>
  );
  return t.href ? (
    <Link href={t.href} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}

export default async function RolloutUserPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const u = await getRolloutUser(userId);
  if (!u) notFound();

  const name = u.full_name || "—";
  const NAME = name.toUpperCase();
  const company = (u.customer_name || "—").toUpperCase();

  const tiles: Tile[] = [
    { icon: ICON.phone, tone: "blue", l1: NAME, l2: u.phone || "—" },
    { icon: ICON.email, tone: "blue", l1: NAME, l2: u.email || "—" },
    { icon: ICON.idCard, tone: "blue", l1: "INVITE MORE FROM", l2: company },
    { icon: ICON.sms, tone: "green", l1: "SMS", l2: "DOWNLOAD LINK TO", l3: NAME },
    { icon: ICON.idCard, tone: "blue", l1: name, l2: "Forget Password" },
    { icon: ICON.cancelled, tone: "red", l1: "DISABLE", l2: NAME, l3: "REMOVE ACCESS" },
    {
      icon: ICON.completed,
      tone: "green",
      l1: name,
      l2: "REINVITED",
      l3: u.reinvited_date ? `Reinvited Date: ${u.reinvited_date}` : "Not Reinvited",
    },
    { icon: ICON.companies, tone: "blue", l1: "ASSIGNED", l2: "COMPANIES" },
    { icon: ICON.projects, tone: "blue", l1: "ASSIGNED", l2: "PROJECTS", href: `/rollout/users/${userId}/projects` },
    { icon: ICON.projects, tone: "blue", l1: "ADD", l2: "PROJECTS", href: `/rollout/users/${userId}/add-projects` },
    { icon: ICON.cancelled, tone: "red", l1: "ACCESS TO", l2: "ORDER TILE", l3: "NOT GRANTED" },
    {
      icon: ICON.user,
      tone: "blue",
      l1: name,
      l2: u.forced_logout ? "Forced To Log Out." : "Currently Not Forced To Log Out.",
    },
  ];

  return (
    <div className="space-y-6">
      <SubHeader title={NAME} backHref="/rollout/search" />

      <div className="flex flex-wrap gap-[10px] pt-10">
        {tiles.map((t, i) => (
          <ActionTile key={i} t={t} />
        ))}
      </div>
    </div>
  );
}
