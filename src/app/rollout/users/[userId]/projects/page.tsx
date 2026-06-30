import { notFound } from "next/navigation";
import { getRolloutUserProjects } from "@/actions/orderActions";
import { SubHeader } from "@/components/d3-ui";
import { UserProjectsTable } from "@/components/user-projects-table";

export const dynamic = "force-dynamic";

export default async function UserProjectsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const data = await getRolloutUserProjects(userId);
  if (!data) notFound();

  return (
    <div className="space-y-6">
      <SubHeader
        title="ASSIGNED PROJECTS"
        subtitle={data.user_name || undefined}
        backHref={`/rollout/users/${userId}`}
      />
      <UserProjectsTable projects={data.projects} customerName={data.customer_name} />
    </div>
  );
}
