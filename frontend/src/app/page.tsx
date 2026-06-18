import { redirect } from "next/navigation";

export default function Home() {
  // Entry point routes into the admin contour; the (admin) guard then enforces
  // authentication and bounces unauthenticated visitors to /login.
  redirect("/admin/data/import");
}
