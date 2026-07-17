import { redirect } from "next/navigation";

export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  const { userId } = await context.params;
  redirect(`/d3-static/user-notifications.html?id=${userId}`);
}
