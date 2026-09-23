import { redirect } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";
import { BrandHeader } from "@/components/BrandHeader";
import { ResponsesPanel } from "@/components/ResponsesPanel";
import { getSessionFromCookies } from "@/lib/auth";

export default function ResponsesPage() {
  if (!getSessionFromCookies()) redirect("/staff-rp/login");
  return (
    <>
      <BrandHeader admin />
      <AdminNav />
      <ResponsesPanel />
    </>
  );
}
