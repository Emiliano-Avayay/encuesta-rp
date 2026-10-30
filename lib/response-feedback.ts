import { visibleQuestions, type SurveyQuestion } from "./constants";
import { companyKey } from "./response-companies";
import type { SurveyResponse } from "./types";

export type OpenAnswer = { question: SurveyQuestion; answer: string };

/**
 * What one response says in its own words: the closing comment (`additionalComments`) and
 * the open answers of the questionnaire. Both are independent; either may be missing.
 */
export type ResponseFeedback = {
  responseId: string;
  createdAt: string;
  company: string;
  contactName: string;
  surveyId: string;
  comment: string;
  openAnswers: OpenAnswer[];
};

export type CompanyFeedback = { key: string; company: string; entries: ResponseFeedback[] };

export const noCompanyLabel = "Sin razón social";

export function isOpenQuestion(question: SurveyQuestion) {
  return question.kind === "text" || question.kind === "textarea";
}

const filled = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Returns null when the response has neither a comment nor an open answer. Historical records without these fields are valid. */
export function responseFeedback(response: SurveyResponse): ResponseFeedback | null {
  const satisfaction = response.satisfaction || ({} as SurveyResponse["satisfaction"]);
  const ratings = satisfaction.ratings && typeof satisfaction.ratings === "object" ? satisfaction.ratings : {};
  const comment = filled(satisfaction.additionalComments);
  // Hidden conditional answers (e.g. a reason left over after switching to "Sí") are not part of the response.
  const openAnswers = visibleQuestions(satisfaction.surveyId || "", ratings)
    .filter(isOpenQuestion)
    .flatMap(question => {
      const answer = filled(ratings[question.key]);
      return answer ? [{ question, answer }] : [];
    });
  if (!comment && !openAnswers.length) return null;
  return {
    responseId: response.id,
    createdAt: response.createdAt,
    company: filled(response.customer?.company),
    contactName: filled(response.customer?.contactName),
    surveyId: satisfaction.surveyId,
    comment,
    openAnswers
  };
}

/**
 * Groups the already filtered responses by company so a company with several commented
 * responses keeps all of them. Entries keep the incoming order (newest first from the API).
 */
export function feedbackByCompany(responses: SurveyResponse[]): CompanyFeedback[] {
  const groups = new Map<string, CompanyFeedback>();
  for (const response of responses) {
    const entry = responseFeedback(response);
    if (!entry) continue;
    const key = companyKey(entry.company);
    const group = groups.get(key) || { key, company: entry.company || noCompanyLabel, entries: [] };
    group.entries.push(entry);
    groups.set(key, group);
  }
  return Array.from(groups.values()).sort((left, right) => left.company.localeCompare(right.company, "es"));
}
