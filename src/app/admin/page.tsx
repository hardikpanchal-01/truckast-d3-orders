import { redirect } from "next/navigation";

export default function AdminPage() {
  // Redirect to the static user search HTML page
  redirect("/d3-static/user-search.html");
}
