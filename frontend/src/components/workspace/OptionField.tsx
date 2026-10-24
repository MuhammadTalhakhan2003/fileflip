"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { useId, useState } from "react";

import { Field, Input, PasswordInput, Segmented, Slider, Switch } from "@/components/ui";
import type { ToolOption } from "@/lib/tools";

const CHOICE_LABELS: Record<string, string> = {
  "90": "90° right",
  "180": "180°",
  "270": "90° left",
  "sheet-per-table": "Per table",
  "sheet-per-page": "Per page",
  "single-sheet": "One sheet",
  "n": "1",
  "page-n": "Page 1",
  "n-of-total": "1 / 9",
  "page-n-of-total": "Page 1 of 9",
  bw: "B&W",
  recommended: "Balanced",
  "1b": "PDF/A-1b",
  "2b": "PDF/A-2b",
  "3b": "PDF/A-3b",
  a4: "A4",
  fit: "Fit",
  over: "Over content",
  under: "Under content",
  sans: "Sans",
  serif: "Serif",
  mono: "Mono",
};

const HIDDEN_CHOICES: Record<string, string[]> = { angle: ["-90"] };

const LANGUAGES = ["English", "Urdu", "Arabic", "Hindi", "Spanish", "French", "German", "Chinese", "Japanese", "Turkish", "Portuguese", "Russian", "Italian", "Korean", "Indonesian", "Bengali", "Persian"];
const OCR_LANGS = [
  ["eng", "English"],
  ["urd", "Urdu"],
  ["ara", "Arabic"],
  ["hin", "Hindi"],
  ["eng+urd", "English + Urdu"],
  ["eng+ara", "English + Arabic"],
];
const REDACT_PATTERNS = [
  ["email", "Emails"],
  ["phone", "Phone numbers"],
  ["url", "Links"],
  ["card", "Card numbers"],
];

export function choiceLabel(v: string): string {
  if (CHOICE_LABELS[v]) return CHOICE_LABELS[v];
  return v.charAt(0).toUpperCase() + v.slice(1).replace(/-/g, " ");
}

export function OptionField({
  option,
  value,
  onChange,
  color,
}: {
  option: ToolOption;
  value: unknown;
  onChange: (v: unknown) => void;
  color: string;
}) {
  const id = useId();
  const o = option;

  if (o.type === "bool") {
    return <Switch checked={Boolean(value)} onChange={onChange} label={o.label} description={o.help} color={color} />;
  }

  if (o.type === "choice" && o.choices) {
    const choices = o.choices.filter((c) => !HIDDEN_CHOICES[o.name]?.includes(c));
    return (
      <Field label={o.label} hint={o.help}>
        {choices.length <= 4 ? (
          <Segmented value={String(value)} onChange={onChange} color={color} options={choices.map((c) => ({ value: c, label: choiceLabel(c) }))} />
        ) : (
          <select
            id={id}
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
          >
            {choices.map((c) => (
              <option key={c} value={c}>{choiceLabel(c)}</option>
            ))}
          </select>
        )}
      </Field>
    );
  }

  if ((o.type === "int" || o.type === "float") && o.min !== undefined && o.max !== undefined && o.max - o.min <= 1000) {
    const step = o.type === "float" ? (o.max <= 1 ? 0.05 : 0.5) : o.max - o.min > 300 ? 10 : 1;
    const isPercent = o.type === "float" && o.max <= 1;
    return (
      <Field label={o.label} hint={o.help}>
        <Slider
          value={Number(value ?? o.min)}
          min={o.min}
          max={o.max}
          step={step}
          color={color}
          onChange={(v) => onChange(isPercent ? Math.round(v * 100) / 100 : v)}
        />
      </Field>
    );
  }

  if (o.type === "int" || o.type === "float") {
    return (
      <Field label={o.label} hint={o.help} htmlFor={id}>
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={o.min}
          max={o.max}
          value={value === null || value === undefined || value === 0 ? "" : String(value)}
          placeholder={o.default ? String(o.default) : "Auto"}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        />
      </Field>
    );
  }

  if (o.type === "color") {
    return (
      <Field label={o.label}>
        <div className="flex items-center gap-2">
          <label className="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-xl ring-1 ring-line" style={{ background: String(value) }}>
            <input type="color" value={String(value)} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={o.label} />
          </label>
          <Input value={String(value)} onChange={(e) => onChange(e.target.value)} className="font-mono uppercase" maxLength={7} />
        </div>
      </Field>
    );
  }

  if (o.type === "json" && o.name === "terms") {
    return <ChipsField label={o.label} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} color={color} />;
  }

  if (o.name === "patterns") {
    const selected = String(value ?? "").split(",").filter(Boolean);
    return (
      <Field label={o.label}>
        <div className="flex flex-wrap gap-2">
          {REDACT_PATTERNS.map(([key, label]) => {
            const on = selected.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange((on ? selected.filter((s) => s !== key) : [...selected, key]).join(","))}
                className={clsx(
                  "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                  on ? "border-transparent tint-bg text-white" : "border-line text-ink-2 hover:border-line-strong",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </Field>
    );
  }

  if (o.type === "str" && o.secret) {
    return (
      <Field label={o.label} hint={o.help} htmlFor={id}>
        <PasswordInput id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
      </Field>
    );
  }

  if (o.type === "str") {
    const list = o.name === "target_language" ? `${id}-list` : o.name === "language" ? `${id}-ocr` : undefined;
    const display = o.name === "pages" && value === "all" ? "" : String(value ?? "");
    return (
      <Field label={o.label} hint={o.name === "pages" ? "Leave empty for all pages. Example: 1-3, 5, 8-" : o.help} htmlFor={id}>
        <Input
          id={id}
          value={display}
          list={list}
          placeholder={o.name === "pages" ? "All pages" : o.name === "target_language" ? "e.g. English" : o.name === "text" ? "e.g. CONFIDENTIAL" : ""}
          onChange={(e) => onChange(o.name === "pages" && !e.target.value.trim() ? "all" : e.target.value)}
        />
        {o.name === "target_language" && (
          <datalist id={`${id}-list`}>
            {LANGUAGES.map((l) => <option key={l} value={l} />)}
          </datalist>
        )}
        {o.name === "language" && (
          <datalist id={`${id}-ocr`}>
            {OCR_LANGS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </datalist>
        )}
      </Field>
    );
  }

  return null;
}

function ChipsField({ label, value, onChange, color }: { label: string; value: string[]; onChange: (v: unknown) => void; color: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft("");
  };
  return (
    <Field label={label} hint="Press Enter after each word or phrase.">
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface p-1.5 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10" style={{ "--c": color } as React.CSSProperties}>
        {value.map((v) => (
          <span key={v} className="flex items-center gap-1 rounded-lg tint-soft py-1 pr-1 pl-2.5 text-[13px] font-medium text-ink">
            {v}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Remove ${v}`} className="rounded p-0.5 text-muted hover:text-ink">
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={add}
          placeholder={value.length ? "" : "e.g. John Smith"}
          className="h-7 min-w-24 flex-1 bg-transparent px-1.5 text-sm text-ink outline-none placeholder:text-subtle"
        />
      </div>
    </Field>
  );
}
