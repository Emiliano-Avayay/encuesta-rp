import { redirect } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";
import { BrandHeader } from "@/components/BrandHeader";
import { FollowUpPanel } from "@/components/FollowUpPanel";
import { getSessionFromCookies } from "@/lib/auth";

export default function FollowUpPage() {
  if (!getSessionFromCookies()) redirect("/staff-rp/login");
  return <><BrandHeader admin /><AdminNav /><FollowUpPanel /></>;
}
