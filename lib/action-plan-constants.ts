import { surveys } from "@/lib/constants";
export const ACTION_PLAN_LIMIT = 5;
export const actionPlanCategories = surveys.map(({ id, name }) => ({ id, name }));
export type ActionPlan = { id: string; category: string; title: string; description: string | null; originalFilename: string; storedFilename: string; mimeType: string; fileSize: number; uploadedBy: string; createdAt: string };
export function isPreviewable(mime: string) { return mime === "application/pdf" || mime.startsWith("image/"); }
