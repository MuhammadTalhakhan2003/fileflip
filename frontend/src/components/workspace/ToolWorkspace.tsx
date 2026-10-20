"use client";

import clsx from "clsx";
import { AlertCircle, ArrowRight, ChevronDown, CloudUpload, ImagePlus, KeyRound, Lock, ShieldCheck, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { Button } from "@/components/ui";
import { fileNoun, Dropzone } from "@/components/workspace/Dropzone";
import { editorFor } from "@/components/workspace/editors/registry";
import { OptionField } from "@/components/workspace/OptionField";
import { ProgressView } from "@/components/workspace/ProgressView";
import { ResultView } from "@/components/workspace/ResultView";
import { buildForm, initialValues, missingRequired, type Values, type WorkspaceApi } from "@/components/workspace/types";
import { ApiError, runTool, toolStatus, type JobResult } from "@/lib/api";
import { formatBytes, plural } from "@/lib/format";
import { takeHandOff } from "@/lib/handoff";
import { actionLabel, toolColor } from "@/lib/toolMeta";
import { acceptAttr, extensionOf, getTool, type ExtraInput, type ToolOption } from "@/lib/tools";

type Phase = "select" | "ready" | "uploading" | "processing" | "done";

/** Options that only make sense in some situations. */
function optionVisible(slug: string, o: ToolOption, values: Values, extras: Record<string, File[]>): boolean {
  if (slug === "split-pdf" && o.name === "every") return values.mode === "every";
  if (slug === "add-watermark" && o.name === "image_scale") return Boolean(extras.image?.length);
  if (slug === "add-watermark" && ["font_size", "bold", "color", "rotation"].includes(o.name)) return !extras.image?.length || Boolean(values.text);
  if (slug === "resize-image" && ["width", "height", "keep_aspect"].includes(o.name)) return !values.percent;
  if (slug === "protect-pdf" && o.name === "owner_password") return !(values.allow_print && values.allow_copy && values.allow_edit);
  return true;
}

/** Checks that span several options. */
function toolBlocker(slug: string, values: Values, extras: Record<string, File[]>): string | null {
  if (slug === "add-watermark" && !String(values.text ?? "").trim() && !extras.image?.length) return "Enter watermark text or choose an image.";
  if (slug === "resize-image" && !values.width && !values.height && !values.percent) return "Enter a width, height or scale percentage.";
  if (slug === "protect-pdf" && String(values.new_password ?? "").length > 0 && String(values.new_password).length < 4) return "Use a password with at least 4 characters.";
  return null;
}

const PROCESSING_LABEL: Record<string, string> = {
  "compress-pdf": "Compressing your PDF...",
  "merge-pdf": "Merging your files...",
  "ocr-pdf": "Recognizing text...",
  "ai-summarizer": "Reading and summarizing...",
  "translate-pdf": "Translating your document...",
  "compare-pdf": "Comparing documents...",
};

export function ToolWorkspace({ slug }: { slug: string }) {
  const tool = getTool(slug)!;
  const color = toolColor(tool);
  const [files, setFilesState] = useState<File[]>([]);
  const [values, setValues] = useState<Values>(() => initialValues(tool));
  const [extras, setExtras] = useState<Record<string, File[]>>({});
  const [phase, setPhase] = useState<Phase>("select");
  const [progress, setProgress] = useState(0);
  const [job, setJob] = useState<JobResult | null>(null);
  const [error, setError] = useState<{ message: string; code: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const accepts = tool.accepts;

  const addFiles = useCallback(
    (incoming: File[]) => {
      if (!incoming.length) return;
      const ok = incoming.filter((f) => accepts.includes(extensionOf(f.name)));
      const rejected = incoming.length - ok.length;
      setNotice(rejected ? `${plural(rejected, "file")} skipped - ${tool.name} accepts ${accepts.slice(0, 6).map((a) => a.toUpperCase()).join(", ")}.` : null);
      if (!ok.length) return;
      setError(null);
      setFilesState((prev) => {
        const merged = tool.max_files === 1 ? ok.slice(0, 1) : [...prev, ...ok];
        const limit = Math.min(tool.max_files, 20);
        if (merged.length > limit) setNotice(`${tool.name} handles up to ${limit} files at once - extra files were left out.`);
        return merged.slice(0, limit);
      });
      setPhase("ready");
    },
    [accepts, tool.max_files, tool.name],
  );

  const setFiles = useCallback((next: File[]) => {
    setFilesState(next);
    if (!next.length) setPhase("select");
  }, []);

  // result handed over from another tool ("Continue with...")
  useEffect(() => {
    const handed = takeHandOff();
    if (handed) addFiles(handed);
    toolStatus(tool.slug)
      .then((s) => setAvailable(s.available))
      .catch(() => setAvailable(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // once files are in, bring the workspace into view (the page header can push it below the fold)
  const wasReady = useRef(false);
  useEffect(() => {
    if (phase === "ready" && !wasReady.current) {
      const top = topRef.current?.getBoundingClientRect().top ?? 0;
      if (top > 160) window.scrollTo({ top: window.scrollY + top - 84, behavior: "smooth" });
    }
    wasReady.current = phase === "ready";
  }, [phase]);

  // paste files / screenshots from the clipboard
  useEffect(() => {
    if (phase !== "select" && phase !== "ready") return;
    const onPaste = (e: ClipboardEvent) => {
      if (/INPUT|TEXTAREA/.test((e.target as HTMLElement)?.tagName ?? "")) return;
      const pasted = Array.from(e.clipboardData?.files ?? []).map((f) =>
        f.name === "image.png" ? new File([f], `pasted-${Date.now()}.png`, { type: f.type }) : f,
      );
      if (pasted.length) {
        e.preventDefault();
        addFiles(pasted);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [phase, addFiles]);

  // drop files anywhere on the page
  useEffect(() => {
    if (phase !== "ready") return;
    let depth = 0;
    const enter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      depth++;
      setDragging(true);
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const over = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => {
      e.preventDefault();
      depth = 0;
      setDragging(false);
      addFiles(Array.from(e.dataTransfer?.files ?? []));
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [phase, addFiles]);

  const api: WorkspaceApi = useMemo(
    () => ({
      tool,
      color,
      files,
      setFiles,
      addFiles,
      removeFile: (i) => setFiles(files.filter((_, k) => k !== i)),
      values,
      setValue: (name, value) => setValues((v) => (v[name] === value ? v : { ...v, [name]: value })),
      extras,
      setExtra: (name, list) => setExtras((x) => ({ ...x, [name]: list })),
      browse: () => inputRef.current?.click(),
    }),
    [tool, color, files, setFiles, addFiles, values, extras],
  );

  const editor = editorFor(api);
  const Editor = editor.component;
  const owned = editor.owns?.(api) ?? [];
  const passwordOption = tool.options.find((o) => o.name === "password");
  const sidebarOptions = tool.options.filter(
    (o) =>
      !owned.includes(o.name) &&
      o.name !== "password" &&
      (o.type !== "json" || o.name === "terms") &&
      optionVisible(tool.slug, o, values, extras),
  );
  const sidebarExtras = tool.extra_inputs.filter((e) => !editor.ownsExtras?.includes(e.name));

  const blocker =
    available === false
      ? "This tool is temporarily unavailable. Please try again later."
      : files.length < tool.min_files
        ? `Add ${tool.min_files - files.length} more ${tool.min_files - files.length === 1 ? "file" : "files"} to continue.`
        : missingRequired(tool, values, owned) ?? editor.validate?.(api) ?? toolBlocker(tool.slug, values, extras);

  async function submit() {
    if (blocker) return;
    setError(null);
    setNotice(null);
    setProgress(0);
    setPhase("uploading");
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await runTool(tool.slug, buildForm(tool, files, values, extras), {
        onUploadProgress: setProgress,
        onProcessing: () => setPhase("processing"),
        signal: controller.signal,
      });
      setJob(result);
      setPhase("done");
    } catch (err) {
      const e = err instanceof ApiError ? err : new ApiError("Something went wrong. Please try again.");
      setPhase("ready");
      if (e.code === "aborted") return;
      if (e.code === "password_required" || e.code === "wrong_password") setPasswordOpen(true);
      setError({ message: e.retryAfter ? `${e.message}` : e.message, code: e.code });
    } finally {
      abortRef.current = null;
    }
  }

  function restart() {
    setFilesState([]);
    setValues(initialValues(tool));
    setExtras({});
    setJob(null);
    setError(null);
    setNotice(null);
    setPhase("select");
  }

  const totalSize = files.reduce((s, f) => s + f.size, 0);

  return (
    <div ref={topRef} className="scroll-mt-24" style={{ "--c": color } as CSSProperties}>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={acceptAttr(accepts)}
        multiple={tool.max_files > 1}
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      {available === false && phase === "select" && (
        <div className="mx-auto mb-5 flex max-w-4xl items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-900 dark:text-amber-200">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          This tool is temporarily unavailable on our server. Everything else works - try another tool or come back soon.
        </div>
      )}

      {notice && (phase === "select" || phase === "ready") && (
        <div className="mx-auto mb-5 flex max-w-4xl animate-fade-in items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-2 shadow-soft">
          <AlertCircle className="size-4 shrink-0 text-warning" />
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" className="text-subtle hover:text-ink"><X className="size-4" /></button>
        </div>
      )}

      {phase === "select" && (
        <div className="mx-auto max-w-4xl animate-fade-up">
          <Dropzone tool={tool} color={color} onFiles={addFiles} onBrowse={() => inputRef.current?.click()} />
        </div>
      )}

      {phase === "ready" && (
        <div className="grid animate-fade-in grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
          {/* preview / editor */}
          <div className="min-w-0 rounded-[28px] border border-line bg-surface p-4 shadow-soft sm:p-6">
            {tool.max_files === 1 && (
              <div className="mb-5 flex items-center gap-3 border-b border-line pb-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl tint-soft text-[11px] font-extrabold uppercase tint-text">{extensionOf(files[0]?.name ?? "")}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{files[0]?.name}</p>
                  <p className="text-xs text-subtle">{formatBytes(files[0]?.size ?? 0)}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>Replace</Button>
                <button type="button" onClick={() => setFiles([])} aria-label="Remove file" className="grid size-8 place-items-center rounded-lg text-subtle hover:bg-danger/10 hover:text-danger">
                  <Trash2 className="size-4" />
                </button>
              </div>
            )}
            <Editor {...api} />
          </div>

          {/* options sidebar */}
          <aside className="lg:sticky lg:top-20">
            <div className="overflow-hidden rounded-[28px] border border-line bg-surface shadow-card">
              <div className="border-b border-line px-6 py-5" style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--c) 10%, transparent), transparent 70%)" }}>
                <h2 className="font-display text-lg font-bold text-ink">{tool.name}</h2>
                <p className="mt-0.5 text-[13px] text-muted">
                  {plural(files.length, fileNoun(tool))} · {formatBytes(totalSize)}
                </p>
              </div>

              <div className="scrollbar-thin max-h-[calc(100dvh-20rem)] space-y-5 overflow-y-auto px-6 py-5 max-lg:max-h-none">
                {sidebarOptions.length === 0 && sidebarExtras.length === 0 && (
                  <p className="text-sm leading-relaxed text-muted">Everything is set up with the best defaults. Just press the button below.</p>
                )}
                {sidebarOptions.map((o) => (
                  <OptionField key={o.name} option={o} value={values[o.name]} color={color} onChange={(v) => api.setValue(o.name, v)} />
                ))}
                {sidebarExtras.map((x) => (
                  <ExtraField key={x.name} input={x} files={extras[x.name] ?? []} onChange={(l) => api.setExtra(x.name, l)} />
                ))}

                {passwordOption && (
                  <div className="rounded-2xl border border-line">
                    <button
                      type="button"
                      onClick={() => setPasswordOpen((o) => !o)}
                      className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-ink-2"
                    >
                      <KeyRound className="size-4 text-subtle" />
                      <span className="flex-1">Protected PDF?</span>
                      <ChevronDown className={clsx("size-4 text-subtle transition-transform", passwordOpen && "rotate-180")} />
                    </button>
                    {passwordOpen && (
                      <div className="animate-fade-in px-4 pb-4">
                        <OptionField option={passwordOption} value={values.password} color={color} onChange={(v) => api.setValue("password", v)} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-line bg-surface-2/50 px-6 py-5">
                {error && (
                  <div role="alert" className="mb-4 flex animate-fade-in items-start gap-2.5 rounded-xl bg-danger/10 px-3.5 py-3 text-sm text-danger">
                    {error.code.includes("password") ? <Lock className="mt-0.5 size-4 shrink-0" /> : <AlertCircle className="mt-0.5 size-4 shrink-0" />}
                    <span>{error.message}</span>
                  </div>
                )}
                <Button
                  variant="tint"
                  color={color}
                  size="lg"
                  className="w-full"
                  disabled={Boolean(blocker)}
                  onClick={submit}
                  rightIcon={<ArrowRight className="size-5" />}
                >
                  {actionLabel(tool)}
                </Button>
                {blocker ? (
                  <p className="mt-3 text-center text-xs text-muted">{blocker}</p>
                ) : (
                  <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-subtle">
                    <ShieldCheck className="size-3.5" /> Encrypted · deleted automatically
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      {(phase === "uploading" || phase === "processing") && (
        <div className="mx-auto max-w-3xl rounded-[28px] border border-line bg-surface shadow-card">
          <ProgressView
            phase={phase}
            progress={progress}
            color={color}
            label={PROCESSING_LABEL[tool.slug] ?? "Working on your file..."}
            onCancel={() => abortRef.current?.abort()}
          />
        </div>
      )}

      {phase === "done" && job && (
        <div className="mx-auto max-w-4xl rounded-[28px] border border-line bg-surface shadow-card">
          <ResultView tool={tool} job={job} color={color} onRestart={restart} />
        </div>
      )}

      {/* full-page drop overlay */}
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-[90] grid animate-fade-in place-items-center bg-[color-mix(in_oklab,var(--c)_14%,rgba(8,11,23,0.55))] backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-white/70 px-16 py-12 text-white">
            <CloudUpload className="size-14 animate-bounce" />
            <p className="font-display text-2xl font-bold">Drop to add {tool.max_files > 1 ? "files" : "your file"}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ExtraField({ input, files, onChange }: { input: ExtraInput; files: File[]; onChange: (f: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const file = files[0];
  const url = useMemo(() => (file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-ink">{input.label}</p>
      <input ref={ref} type="file" className="sr-only" accept={acceptAttr(input.accepts)} onChange={(e) => {
        onChange(Array.from(e.target.files ?? []).slice(0, input.multiple ? 50 : 1));
        e.target.value = "";
      }} />
      {file ? (
        <div className="flex items-center gap-3 rounded-xl border border-line p-2">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="size-10 rounded-lg bg-surface-2 object-contain" />
          ) : (
            <span className="grid size-10 place-items-center rounded-lg bg-surface-2"><ImagePlus className="size-4 text-subtle" /></span>
          )}
          <span className="min-w-0 flex-1 truncate text-sm text-ink">{file.name}</span>
          <button type="button" onClick={() => onChange([])} aria-label="Remove" className="grid size-8 place-items-center rounded-lg text-subtle hover:bg-danger/10 hover:text-danger">
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-strong py-3 text-sm font-medium text-muted transition hover:border-[var(--c)] hover:text-ink"
        >
          <ImagePlus className="size-4" /> Choose image
        </button>
      )}
    </div>
  );
}
