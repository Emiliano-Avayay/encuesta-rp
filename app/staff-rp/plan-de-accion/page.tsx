import { redirect } from "next/navigation";
import { ActionPlansPanel } from "@/components/ActionPlansPanel";
import { AdminNav } from "@/components/AdminNav";
import { BrandHeader } from "@/components/BrandHeader";
import { getSessionFromCookies } from "@/lib/auth";
export default function ActionPlansPage() { if (!getSessionFromCookies()) redirect("/staff-rp/login"); return <><BrandHeader admin /><AdminNav /><ActionPlansPanel /></>; }
