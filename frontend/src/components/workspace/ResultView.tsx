"use client";

import { AlertTriangle, ArrowRight, Check, Copy, Download, ExternalLink, Link2, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";

import { ToolIcon } from "@/components/tools/ToolIcon";
import { Markdown } from "@/components/workspace/Markdown";
import { FormatTile } from "@/components/workspace/Preview";
import { Button } from "@/components/ui";
import { deleteJob, downloadUrl, fetchResultFile, type JobResult } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import { handOff } from "@/lib/handoff";
import { nextSteps } from "@/lib/toolMeta";
import { extensionOf, getTool, type Tool } from "@/lib/tools";

function headline(tool: Tool, job: JobResult): { title: string; text: string } {
  const m = job.meta as Record<string, number | string | boolean>;
  if (typeof m.saved_percent === "number" && m.saved_percent > 0) {
    return { title: `Done! ${m.saved_percent}% smaller`, text: `${formatBytes(Number(m.original_size))} → ${formatBytes(Number(m.compressed_size))}` };
  }
  if (typeof m.saved_percent === "number") return { title: "Already optimized", text: "This file was already as small as it can get without losing quality." };
  if (tool.slug === "compare-pdf") return { title: m.identical ? "No differences found" : `${m.similarity}% similar`, text: m.identical ? "Both documents contain the same text." : `${m.words_added} words added · ${m.words_removed} words removed` };
  if (tool.slug === "ai-summarizer") return { title: "Here's your summary", text: "Read it below or download it as a Markdown file." };
  return { title: "Your file is ready!", text: `${tool.name} finished successfully.` };
}

export function ResultView({ tool, job, color, onRestart }: { tool: Tool; job: JobResult; color: string; onRestart: () => void }) {
  const router = useRouter();
  const [copied, setCopied] = useState<"link" | "text" | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [minutesLeft, setMinutesLeft] = useState(() => Math.max(0, Math.round((Date.parse(job.expires_at) - Date.now()) / 60000)));
  const { title, text } = headline(tool, job);
  const meta = job.meta as Record<string, unknown>;
  const ext = extensionOf(job.file_name);
  const previewable = ["pdf", "jpg", "png", "webp", "gif", "txt", "md"].includes(ext);
  const steps = nextSteps(tool)
    .map((s) => getTool(s))
    .filter((t): t is Tool => Boolean(t) && t!.accepts.includes(ext));

  useEffect(() => {
    const t = setInterval(() => setMinutesLeft(Math.max(0, Math.round((Date.parse(job.expires_at) - Date.now()) / 60000))), 30000);
    return () => clearInterval(t);
  }, [job.expires_at]);

  async function copy(kind: "link" | "text", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard blocked */
    }
  }

  async function remove() {
    setBusy("delete");
    try {
      await deleteJob(job.job_id);
      setDeleted(true);
    } finally {
      setBusy(null);
    }
  }

  async function continueWith(next: Tool) {
    setBusy(next.slug);
    try {
      handOff([await fetchResultFile(job)]);
      router.push(`/${next.slug}`);
    } catch {
      setBusy(null);
    }
  }

  return (
    <div className="animate-fade-in px-5 py-12 sm:px-10 sm:py-16" style={{ "--c": color } as CSSProperties}>
      <div className="mx-auto max-w-2xl text-center">
        <div className="relative mx-auto grid size-20 animate-pop place-items-center rounded-full bg-success text-white shadow-[0_16px_40px_-12px_var(--success)]">
          <svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path className="check-draw" d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          <span className="absolute inset-0 animate-ping rounded-full bg-success/30 [animation-iteration-count:1.5]" />
        </div>
        <h2 className="mt-7 font-display text-3xl font-extrabold tracking-tight text-ink">{title}</h2>
        <p className="mt-2 text-[15px] text-muted">{text}</p>

        {typeof meta.warning === "string" && (
          <p className="mx-auto mt-5 flex max-w-lg items-start gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-left text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {meta.warning}
          </p>
        )}

        {/* file card */}
        <div className="mx-auto mt-8 flex max-w-lg items-center gap-4 rounded-2xl border border-line bg-surface p-4 text-left shadow-card">
          <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-surface-2"><span className="scale-75"><FormatTile ext={ext} /></span></span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink" title={job.file_name}>{job.file_name}</p>
            <p className="text-sm text-muted">
              {formatBytes(job.size)} · {deleted ? <span className="text-danger">Deleted</span> : `available for ${minutesLeft} min`}
            </p>
          </div>
        </div>

        {!deleted ? (
          <>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={downloadUrl(job)}
                className="inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl tint-bg px-8 text-base font-semibold text-white shadow-[0_14px_30px_-12px_var(--c)] transition-all hover:-translate-y-0.5 hover:brightness-105 sm:w-auto"
              >
                <Download className="size-5" /> Download {ext.toUpperCase()}
              </a>
              {previewable && (
                <a href={downloadUrl(job, true)} target="_blank" rel="noreferrer" className="inline-flex h-14 items-center gap-2 rounded-2xl border border-line bg-surface px-6 font-semibold text-ink-2 shadow-soft transition hover:border-line-strong hover:text-ink">
                  <ExternalLink className="size-4" /> Preview
                </a>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-1">
              <Button variant="ghost" size="sm" leftIcon={copied === "link" ? <Check className="size-4 text-success" /> : <Link2 className="size-4" />} onClick={() => copy("link", downloadUrl(job))}>
                {copied === "link" ? "Link copied" : "Copy download link"}
              </Button>
              <Button variant="ghost" size="sm" leftIcon={<Trash2 className="size-4" />} loading={busy === "delete"} onClick={remove} className="hover:text-danger">
                Delete now
              </Button>
              <Button variant="ghost" size="sm" leftIcon={<RotateCcw className="size-4" />} onClick={onRestart}>
                Start over
              </Button>
            </div>
          </>
        ) : (
          <div className="mt-6">
            <p className="text-sm text-muted">Your file has been permanently deleted from our servers.</p>
            <Button variant="tint" color={color} className="mt-4" onClick={onRestart} leftIcon={<RotateCcw className="size-4" />}>
              Start over
            </Button>
          </div>
        )}
      </div>

      {/* compression bar */}
      {typeof meta.compressed_size === "number" && typeof meta.original_size === "number" && Number(meta.saved_percent) > 0 && (
        <div className="mx-auto mt-10 max-w-lg space-y-2 rounded-2xl border border-line bg-surface p-5">
          {[
            { label: "Before", value: meta.original_size as number, pct: 100, cls: "bg-surface-3" },
            { label: "After", value: meta.compressed_size as number, pct: (100 * (meta.compressed_size as number)) / (meta.original_size as number), cls: "tint-bg" },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-3 text-sm">
              <span className="w-12 text-muted">{row.label}</span>
              <span className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
                <span className={`block h-full rounded-full ${row.cls} transition-all duration-1000`} style={{ width: `${Math.max(3, row.pct)}%` }} />
              </span>
              <span className="w-16 text-right font-semibold tabular-nums text-ink">{formatBytes(row.value)}</span>
            </div>
          ))}
        </div>
      )}

      {/* AI summary */}
      {typeof meta.summary === "string" && (
        <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-line bg-surface p-6 text-left shadow-card sm:p-8">
          <div className="mb-4 flex justify-end">
            <Button variant="secondary" size="sm" leftIcon={copied === "text" ? <Check className="size-4 text-success" /> : <Copy className="size-4" />} onClick={() => copy("text", meta.summary as string)}>
              {copied === "text" ? "Copied" : "Copy"}
            </Button>
          </div>
          <Markdown source={meta.summary} />
          <p className="mt-6 border-t border-line pt-4 text-xs text-subtle">AI-generated summary. Double-check important details against the original document.</p>
        </div>
      )}

      {/* continue with */}
      {steps.length > 0 && !deleted && (
        <div className="mx-auto mt-12 max-w-2xl">
          <p className="text-center text-[13px] font-semibold tracking-wide text-subtle uppercase">Continue with</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {steps.map((s) => (
              <button
                key={s.slug}
                type="button"
                disabled={busy !== null}
                onClick={() => continueWith(s)}
                className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card disabled:opacity-60"
              >
                <ToolIcon tool={s} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{s.name}</span>
                  <span className="block truncate text-xs text-muted">{s.description}</span>
                </span>
                <ArrowRight className="size-4 text-subtle transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
