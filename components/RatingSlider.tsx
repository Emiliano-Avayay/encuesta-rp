"use client";

import { notEvaluableLabel, satisfactionRatingOptions } from "@/lib/constants";
import { useState, type CSSProperties } from "react";

type RatingSliderProps = {
  value: number | null | undefined;
  onChange: (value: number) => void;
  onNoAnswer: () => void;
  disabled?: boolean;
  required?: boolean;
  label: string;
  options?: ReadonlyArray<{ value: number; label: string }>;
};

export function RatingSlider({ value, onChange, onNoAnswer, disabled, required, label, options = satisfactionRatingOptions }: RatingSliderProps) {
  const [dragging, setDragging] = useState(false);
  const selected = typeof value === "number" ? value : undefined;
  const noAnswer = value === null;
  const selectedLabel = selected !== undefined ? options.find((option) => option.value === selected)?.label : undefined;
  const min = options[0]?.value ?? 1;
  const max = options[options.length - 1]?.value ?? 5;
  const spread = Math.max(1, max - min);
  const thumbPosition = selected !== undefined ? ((selected - min) / spread) * 100 : undefined;
  const intervals = Math.max(1, options.length - 1);
  const scaleStyle = { "--slider-intervals": intervals } as CSSProperties;
  const pointStyle = (index: number): CSSProperties => ({ gridColumnStart: Math.min(index + 1, intervals), justifySelf: index === options.length - 1 ? "end" : "start" });

  return (
    <div className={`rating-slider ${selected !== undefined ? "has-value" : ""} ${noAnswer ? "no-answer" : ""} ${dragging ? "is-dragging" : ""}`}>
      {(selected !== undefined || noAnswer) && <div className="slider-current" aria-live="polite">
        <span className={`slider-status ${selected !== undefined ? "selected" : ""}`}>{selected !== undefined ? <><b>{selected}</b>{selectedLabel}</> : notEvaluableLabel}</span>
      </div>}
      <div className="slider-track-wrap">
        <div className="slider-track" aria-hidden="true" style={scaleStyle}>
          {options.map((option, index) => <em key={option.value} style={pointStyle(index)} />)}
          {thumbPosition !== undefined && <span className="slider-thumb" style={{ "--slider-position": `${thumbPosition}%` } as CSSProperties} />}
        </div>
        <input
          aria-label={`${label}${required ? ", obligatorio" : ""}`}
          aria-valuetext={selected !== undefined ? `${selected} — ${selectedLabel}` : noAnswer ? notEvaluableLabel : "Sin responder"}
          className="slider-input"
          type="range"
          min={min}
          max={max}
          step="1"
          value={selected ?? min}
          disabled={disabled}
          onPointerDown={() => setDragging(true)}
          onPointerUp={() => setDragging(false)}
          onBlur={() => setDragging(false)}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
      <div className="slider-stops" aria-hidden="true" style={scaleStyle}>{options.map((option, index) => <span key={option.value} style={pointStyle(index)}>{option.value}</span>)}</div>
      <div className="slider-extremes" aria-hidden="true"><span>{options[0]?.label}</span><span>{options[options.length - 1]?.label}</span></div>
      <button type="button" className={`no-answer-button ${noAnswer ? "selected" : ""}`} aria-pressed={noAnswer} disabled={disabled} onClick={onNoAnswer}>{notEvaluableLabel}</button>
    </div>
  );
}
