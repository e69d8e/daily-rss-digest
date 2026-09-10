import { redirect } from "next/navigation";

export default function ChannelsRedirectPage() {
  redirect("/settings?tab=channels");
}
