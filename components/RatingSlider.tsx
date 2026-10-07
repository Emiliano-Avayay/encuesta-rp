"use client";

import { notEvaluableLabel, satisfactionRatingOptions } from "@/lib/constants";
import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

type RatingSliderProps = {
  value: number | null | undefined;
  onChange: (value: number) => void;
  onNoAnswer: () => void;
  disabled?: boolean;
  required?: boolean;
  label: string;
  options?: ReadonlyArray<{ value: number; label: string }>;
};

const step = 1;

// Valor del range para una coordenada horizontal, con el mismo mapeo que el control nativo:
// el centro del pulgar recorre el ancho del input menos el ancho del propio pulgar.
function valueFromClientX(input: HTMLInputElement, clientX: number, min: number, max: number) {
  const rect = input.getBoundingClientRect();
  const thumb = parseFloat(getComputedStyle(input).getPropertyValue("--slider-thumb")) || 0;
  const travel = rect.width - thumb;
  if (!(travel > 0)) return undefined;
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left - thumb / 2) / travel));
  return Math.min(max, Math.max(min, min + Math.round((ratio * (max - min)) / step) * step));
}

export function RatingSlider({ value, onChange, onNoAnswer, disabled, required, label, options = satisfactionRatingOptions }: RatingSliderProps) {
  const [dragging, setDragging] = useState(false);
  // Contacto en curso: `changed` pasa a true cuando el range nativo emite un cambio durante el gesto.
  const gesture = useRef<{ pointerId: number; changed: boolean } | null>(null);
  const selected = typeof value === "number" ? value : undefined;
  const noAnswer = value === null;
  const selectedLabel = selected !== undefined ? options.find((option) => option.value === selected)?.label : undefined;
  const min = options[0]?.value ?? 1;
  const max = options[options.length - 1]?.value ?? 5;
  const spread = Math.max(1, max - min);
  const thumbPosition = selected !== undefined ? ((selected - min) / spread) * 100 : undefined;
  const scaleStyle = { "--slider-count": options.length } as CSSProperties;

  const endGesture = () => { setDragging(false); gesture.current = null; };
  const handlePointerDown = (event: ReactPointerEvent<HTMLInputElement>) => {
    setDragging(true);
    gesture.current = event.isPrimary && event.button === 0 ? { pointerId: event.pointerId, changed: false } : null;
  };
  // Sin respuesta numérica el input vale `min`, así que tocar el mínimo no genera ningún cambio nativo, y Safari iOS
  // puede no aplicar el toque (o aplicarlo después de `pointerup`). Si el range no emitió nada durante el contacto,
  // el valor sale de la posición donde se soltó, nunca de `min` ni del valor del DOM.
  const handlePointerUp = (event: ReactPointerEvent<HTMLInputElement>) => {
    const current = gesture.current;
    endGesture();
    if (!current || current.pointerId !== event.pointerId || current.changed || selected !== undefined || disabled) return;
    const next = valueFromClientX(event.currentTarget, event.clientX, min, max);
    if (next !== undefined) onChange(next);
  };

  return (
    <div className={`rating-slider ${selected !== undefined ? "has-value" : ""} ${noAnswer ? "no-answer" : ""} ${dragging ? "is-dragging" : ""}`}>
      {(selected !== undefined || noAnswer) && <div className="slider-current" aria-live="polite">
        <span className={`slider-status ${selected !== undefined ? "selected" : ""}`}>{selected !== undefined ? <><b>{selected}</b>{selectedLabel}</> : notEvaluableLabel}</span>
      </div>}
      <div className="slider-scale" style={scaleStyle}>
        <div className="slider-points" aria-hidden="true">
          {options.map((option) => <div key={option.value} className="slider-point"><span className="slider-marker" /><span className="slider-number">{option.value}</span></div>)}
        </div>
        <div className="slider-rail">
          <span className="slider-bar" aria-hidden="true" />
          {thumbPosition !== undefined && <span className="slider-thumb" aria-hidden="true" style={{ "--slider-position": `${thumbPosition}%` } as CSSProperties} />}
        </div>
        <input
          aria-label={`${label}${required ? ", obligatorio" : ""}`}
          aria-valuetext={selected !== undefined ? `${selected} — ${selectedLabel}` : noAnswer ? notEvaluableLabel : "Sin responder"}
          className="slider-input"
          type="range"
          min={min}
          max={max}
          step={step}
          value={selected ?? min}
          disabled={disabled}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={endGesture}
          onBlur={endGesture}
          onChange={(event) => { if (gesture.current) gesture.current.changed = true; onChange(Number(event.target.value)); }}
        />
      </div>
      <div className="slider-extremes" aria-hidden="true"><span>{options[0]?.label}</span><span>{options[options.length - 1]?.label}</span></div>
      <button type="button" className={`no-answer-button ${noAnswer ? "selected" : ""}`} aria-pressed={noAnswer} disabled={disabled} onClick={onNoAnswer}>{notEvaluableLabel}</button>
    </div>
  );
}
