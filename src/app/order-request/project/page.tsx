import { SubHeader } from "@/components/d3-ui";
import { getAllProjects } from "@/actions/orderActions";
import { ProjectList } from "@/components/project-list";

export const dynamic = "force-dynamic";

export default async function OrderByProjectPage() {
  const projects = await getAllProjects();

  return (
    <div className="space-y-5">
      <SubHeader title="ORDER BY PROJECT" backHref="/" />

      <ProjectList projects={projects} />
    </div>
  );
}
