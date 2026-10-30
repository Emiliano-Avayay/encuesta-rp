import type { SurveyQuestion } from "./constants";
import type { SurveyResponse } from "./types";

export type QuestionMetric = {
  question: SurveyQuestion;
  applicable: number;
  count: number;
  average: number;
  noAnswer: number;
  yes: number;
  no: number;
  textAnswers: string[];
  /** Same answers as `textAnswers`, still tied to the response and company that gave them. */
  textEntries: { responseId: string; company: string; answer: string }[];
};

/** Only controls that present a rating scale belong in satisfaction averages. */
export function isSatisfactionQuestion(question: SurveyQuestion) {
  return question.kind === "slider" || question.kind === "stars";
}

function isVisibleForResponse(question: SurveyQuestion, response: SurveyResponse) {
  return !question.conditionalOn || response.satisfaction.ratings[question.conditionalOn.key] === question.conditionalOn.value;
}

function numericAnswers(responses: SurveyResponse[], question: SurveyQuestion) {
  return responses
    .filter(response => isVisibleForResponse(question, response))
    .map(response => response.satisfaction.ratings[question.key])
    .filter((value): value is number => typeof value === "number");
}

export function average(values: number[]) {
  return values.length ? values.reduce((left, right) => left + right, 0) / values.length : 0;
}

export function calculateMetrics(responses: SurveyResponse[], questions: SurveyQuestion[]) {
  const items: QuestionMetric[] = questions.map(question => {
    const applicableResponses = responses.filter(response => isVisibleForResponse(question, response));
    const answers = applicableResponses.map(response => response.satisfaction.ratings[question.key]);
    const values = numericAnswers(responses, question);
    const textEntries = applicableResponses.flatMap(response => {
      const answer = response.satisfaction.ratings[question.key];
      return typeof answer === "string" && answer.trim() !== "" ? [{ responseId: response.id, company: response.customer?.company || "", answer }] : [];
    });
    const textAnswers = textEntries.map(entry => entry.answer);
    return {
      question,
      applicable: applicableResponses.length,
      count: values.length,
      average: average(values),
      noAnswer: answers.filter(value => value === null).length,
      yes: answers.filter(value => value === "yes").length,
      no: answers.filter(value => value === "no").length,
      textAnswers,
      textEntries
    };
  });

  const satisfactionValues = items
    .filter(item => isSatisfactionQuestion(item.question))
    .flatMap(item => numericAnswers(responses, item.question));

  return {
    items,
    average: average(satisfactionValues),
    count: satisfactionValues.length,
    noAnswer: items
      .filter(item => isSatisfactionQuestion(item.question))
      .reduce((total, item) => total + item.noAnswer, 0)
  };
}

export function percentage(value: number, total: number) {
  return total ? (value / total) * 100 : 0;
}

