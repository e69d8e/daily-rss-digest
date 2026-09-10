import { redirect } from "next/navigation";

export default function FeedsRedirectPage() {
  redirect("/settings?tab=feeds");
}
