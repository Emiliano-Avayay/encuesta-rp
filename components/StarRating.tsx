"use client";

import { useState } from "react";
import { notEvaluableLabel } from "@/lib/constants";

type StarRatingProps = {
  questionId: string;
  label: string;
  value: number | null | undefined;
  onChange: (value: number) => void;
  onNoAnswer: () => void;
  disabled?: boolean;
  required?: boolean;
};

const stars = [5, 4, 3, 2, 1] as const;
const starPath = "M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z";

/** Uiverse.io / SelfMadeSystem star treatment, adapted for unique React controls. */
export function StarRating({ questionId, label, value, onChange, onNoAnswer, disabled, required }: StarRatingProps) {
  const [hoveredStar, setHoveredStar] = useState<number>();
  const selected = typeof value === "number" ? value : undefined;
  const noAnswer = value === null;
  const name = `rating-${questionId}`;
  const displayedValue = noAnswer ? undefined : hoveredStar ?? selected;

  return <div className={`star-rating-control ${noAnswer ? "no-answer" : ""}`}>
    <div className="rating" role="radiogroup" aria-label={`${label}${required ? ", obligatorio" : ""}`} onMouseLeave={() => setHoveredStar(undefined)}>
      {stars.map((star) => {
        const id = `${questionId}-star-${star}`;
        const active = displayedValue !== undefined && star <= displayedValue;
        const selectedActive = hoveredStar === undefined && selected !== undefined && star <= selected;
        return <span className="rating-star" key={star}>
          <input id={id} name={name} type="radio" value={star} checked={selected === star} disabled={disabled} onChange={() => { setHoveredStar(undefined); onChange(star); }} />
          <label htmlFor={id} aria-label={`${star} ${star === 1 ? "estrella" : "estrellas"} de 5`} onMouseEnter={() => setHoveredStar(star)}>
            <svg className={`${active ? "is-active" : ""} ${selectedActive ? "is-selected" : ""}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path pathLength="360" d={starPath} /></svg>
          </label>
        </span>;
      })}
    </div>
    <button type="button" className={`no-answer-button ${noAnswer ? "selected" : ""}`} aria-pressed={noAnswer} disabled={disabled} onClick={() => { setHoveredStar(undefined); onNoAnswer(); }}>{notEvaluableLabel}</button>
  </div>;
}
