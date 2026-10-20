"use client";

import { ArrowLeftRight, FileQuestion, Loader2, Plus, TextCursorInput } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { Field, Input, Switch } from "@/components/ui";
import { FileThumb } from "@/components/workspace/Preview";
import type { WorkspaceApi } from "@/components/workspace/types";
import { inspectFile, type FormField } from "@/lib/api";
import { formatBytes } from "@/lib/format";

/* ------------------------------------------------------------------ forms */

export function FormsEditor(api: WorkspaceApi) {
  const { files, values, setValue, color } = api;
  const password = String(values.password ?? "");
  const [fields, setFields] = useState<FormField[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filled = useMemo(() => (values.fields && typeof values.fields === "object" ? (values.fields as Record<string, unknown>) : {}), [values.fields]);

  useEffect(() => {
    let alive = true;
    setFields(null);
    setError(null);
    inspectFile(files[0], password)
      .then((info) => {
        if (!alive) return;
        if (info.needs_password) {
          setError("This PDF is password protected. Enter its password in the panel to load the form.");
          return;
        }
        const list = info.form_fields ?? [];
        setFields(list);
        const initial: Record<string, unknown> = {};
        for (const f of list) {
          if (f.type === "checkbox") initial[f.name] = Boolean(f.value) && f.value !== "Off";
          else if (f.type !== "button" && f.type !== "signature") initial[f.name] = f.value ?? "";
        }
        setValue("fields", list.length ? initial : null);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, password]);

  if (error) return <div className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-muted">{error}</div>;
  if (!fields) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted">
        <Loader2 className="size-5 animate-spin" /> Reading form fields...
      </div>
    );
  }
  if (!fields.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
        <FileQuestion className="size-10 text-subtle" />
        <p className="font-semibold text-ink">This PDF has no fillable fields</p>
        <p className="max-w-sm text-sm text-muted">Use <a href="/edit-pdf" className="font-semibold text-brand">Edit PDF</a> to type anywhere on the document instead.</p>
      </div>
    );
  }

  const set = (name: string, v: unknown) => setValue("fields", { ...filled, [name]: v });
  const byPage = fields.reduce<Record<number, FormField[]>>((acc, f) => {
    if (f.type === "button" || f.type === "signature") return acc;
    (acc[f.page] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-6" style={{ "--c": color } as CSSProperties}>
      <p className="flex items-center gap-2 text-sm text-ink-2">
        <TextCursorInput className="size-4 text-subtle" /> {fields.length} fields found. Fill them in and download the completed PDF.
      </p>
      {Object.entries(byPage).map(([page, list]) => (
        <section key={page} className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h3 className="mb-4 text-xs font-bold tracking-wider text-subtle uppercase">Page {page}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {list.map((f) => {
              const label = f.name.replace(/[_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
              if (f.type === "checkbox" || f.type === "radiobutton") {
                return (
                  <div key={f.name} className="rounded-xl bg-surface-2 px-4 py-2.5">
                    <Switch checked={Boolean(filled[f.name])} onChange={(v) => set(f.name, f.type === "radiobutton" ? (v ? f.on_value : "Off") : v)} label={label} color={color} />
                  </div>
                );
              }
              if (f.choices?.length) {
                return (
                  <Field key={f.name} label={label}>
                    <select
                      value={String(filled[f.name] ?? "")}
                      onChange={(e) => set(f.name, e.target.value)}
                      className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand"
                    >
                      <option value="">Choose...</option>
                      {f.choices.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                );
              }
              return (
                <Field key={f.name} label={label}>
                  <Input value={String(filled[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} />
                </Field>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function validateForms(api: WorkspaceApi): string | null {
  return api.values.fields ? null : "This PDF has no form fields to fill.";
}

/* ------------------------------------------------------------------ compare */

export function CompareSlots(api: WorkspaceApi) {
  const { files, setFiles, browse, color } = api;
  const slots = [
    { label: "Original", hint: "The older version", file: files[0] },
    { label: "Changed", hint: "The newer version", file: files[1] },
  ];
  return (
    <div style={{ "--c": color } as CSSProperties}>
      <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
        {slots.map((s, i) => (
          <div key={s.label} className={i === 1 ? "sm:order-3" : ""}>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
              <span className="size-2.5 rounded-full" style={{ background: i === 0 ? "#f04463" : "#22a45d" }} /> {s.label}
              <span className="font-normal text-muted">· {s.hint}</span>
            </p>
            {s.file ? (
              <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
                <FileThumb file={s.file} className="aspect-[4/3.6]" />
                <div className="border-t border-line px-4 py-3">
                  <p className="truncate text-sm font-semibold text-ink">{s.file.name}</p>
                  <p className="text-xs text-subtle">{formatBytes(s.file.size)}</p>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={browse}
                className="flex aspect-[4/4.2] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line-strong text-muted transition hover:border-[var(--c)] hover:tint-soft"
              >
                <span className="grid size-12 place-items-center rounded-full tint-bg text-white shadow-lg"><Plus className="size-6" /></span>
                <span className="text-sm font-semibold">Add the {s.label.toLowerCase()} PDF</span>
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          disabled={files.length < 2}
          onClick={() => setFiles([files[1], files[0]])}
          title="Swap"
          className="mx-auto grid size-11 place-items-center rounded-full border border-line bg-surface text-muted shadow-soft transition hover:rotate-180 hover:text-ink disabled:opacity-40 sm:order-2"
        >
          <ArrowLeftRight className="size-5" />
        </button>
      </div>
    </div>
  );
}
