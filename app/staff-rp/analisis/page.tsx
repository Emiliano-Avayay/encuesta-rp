import { redirect } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { BrandHeader } from "@/components/BrandHeader";
import { getSessionFromCookies } from "@/lib/auth";

export default function AnalysisPage() {
  if (!getSessionFromCookies()) redirect("/staff-rp/login");
  return (
    <>
      <BrandHeader admin />
      <AdminNav />
      <AnalyticsPanel />
    </>
  );
}
