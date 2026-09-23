import { notFound } from "next/navigation";
import { BrandHeader } from "@/components/BrandHeader";
import { SurveyForm } from "@/components/SurveyForm";
import { getSurvey } from "@/lib/constants";
import type { SurveyId } from "@/lib/types";

export default function PublicSurveyPage({ params }: { params: { survey: string } }) {
  const survey = getSurvey(params.survey);
  if (!survey || !survey.active) notFound();
  return <><BrandHeader /><SurveyForm surveyId={survey.id as SurveyId} /></>;
}
