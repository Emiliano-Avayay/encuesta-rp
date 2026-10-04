"use client";

import { notEvaluableLabel, satisfactionRatingOptions } from "@/lib/constants";
import type { RatingValue } from "@/lib/types";
import { useState } from "react";

type RatingSliderProps = {
  value: RatingValue | undefined;
  onChange: (value: Exclude<RatingValue, null>) => void;
  onNoAnswer: () => void;
  disabled?: boolean;
  required?: boolean;
  label: string;
  options?: typeof satisfactionRatingOptions;
};

export function RatingSlider({ value, onChange, onNoAnswer, disabled, required, label, options = satisfactionRatingOptions }: RatingSliderProps) {
  const [dragging, setDragging] = useState(false);
  const selected = typeof value === "number" ? value : undefined;
  const noAnswer = value === null;
  const selectedLabel = selected ? options.find((option) => option.value === selected)?.label : undefined;

  return (
    <div className={`rating-slider ${selected ? "has-value" : ""} ${noAnswer ? "no-answer" : ""} ${dragging ? "is-dragging" : ""}`}>
      <div className="slider-current" aria-live="polite">
        <span className={`slider-status ${selected ? "selected" : ""}`}>{selected ? <><b>{selected}</b>{selectedLabel}</> : noAnswer ? notEvaluableLabel : "Seleccioná una valoración"}</span>
      </div>
      <div className="slider-track-wrap">
        <div className="slider-track" aria-hidden="true"><i style={{ width: selected ? `${((selected - 1) / 4) * 100}%` : "0%" }} />{options.map((option) => <em key={option.value} className={selected === option.value ? "active" : ""} style={{ left: `${((option.value - 1) / 4) * 100}%` }} />)}</div>
        <input
          aria-label={`${label}${required ? ", obligatorio" : ""}`}
          aria-valuetext={selected ? `${selected} — ${selectedLabel}` : noAnswer ? notEvaluableLabel : "Sin responder"}
          className="slider-input"
          type="range"
          min="1"
          max="5"
          step="1"
          value={selected ?? 1}
          disabled={disabled}
          onPointerDown={() => setDragging(true)}
          onPointerUp={() => setDragging(false)}
          onBlur={() => setDragging(false)}
          onChange={(event) => onChange(Number(event.target.value) as Exclude<RatingValue, null>)}
        />
      </div>
      <div className="slider-stops" aria-hidden="true">{options.map((option) => <span key={option.value}>{option.value}</span>)}</div>
      <div className="slider-extremes" aria-hidden="true"><span>{options[0]?.label}</span><span>{options[options.length - 1]?.label}</span></div>
      <button type="button" className={`no-answer-button ${noAnswer ? "selected" : ""}`} aria-pressed={noAnswer} disabled={disabled} onClick={onNoAnswer}>{notEvaluableLabel}</button>
    </div>
  );
}
