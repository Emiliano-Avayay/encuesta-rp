"use client";

import { notEvaluableLabel } from "@/lib/constants";
import type { RatingValue } from "@/lib/types";

type StarRatingProps = {
  questionId: string;
  label: string;
  value: RatingValue | undefined;
  onChange: (value: Exclude<RatingValue, null>) => void;
  onNoAnswer: () => void;
  disabled?: boolean;
  required?: boolean;
};

const stars = [5, 4, 3, 2, 1] as const;
const starPath = "M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z";

/** Uiverse.io / SelfMadeSystem star treatment, adapted for unique React controls. */
export function StarRating({ questionId, label, value, onChange, onNoAnswer, disabled, required }: StarRatingProps) {
  const selected = typeof value === "number" ? value : undefined;
  const noAnswer = value === null;
  const name = `rating-${questionId}`;

  return <div className={`star-rating-control ${noAnswer ? "no-answer" : ""}`}>
    <div className="rating" role="radiogroup" aria-label={`${label}${required ? ", obligatorio" : ""}`}>
      {stars.map((star) => {
        const id = `${questionId}-star-${star}`;
        return <span className="rating-star" key={star}>
          <input id={id} name={name} type="radio" value={star} checked={selected === star} disabled={disabled} onChange={() => onChange(star)} />
          <label htmlFor={id} aria-label={`${star} ${star === 1 ? "estrella" : "estrellas"} de 5`}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path pathLength="360" d={starPath} /></svg>
          </label>
        </span>;
      })}
    </div>
    <p className="star-rating-status" aria-live="polite">{selected ? `${selected} de 5 estrellas` : noAnswer ? notEvaluableLabel : "Seleccioná una puntuación"}</p>
    <button type="button" className={`no-answer-button ${noAnswer ? "selected" : ""}`} aria-pressed={noAnswer} disabled={disabled} onClick={onNoAnswer}>{notEvaluableLabel}</button>
  </div>;
}
