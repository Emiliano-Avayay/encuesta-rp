import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";

export default function AdminIndexPage() {
  if (!getSessionFromCookies()) redirect("/staff-rp/login");
  redirect("/staff-rp/respuestas");
}
