"use client";

import { CalendarDays, PenLine, Signature, Type } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { Button } from "@/components/ui";
import { DraggableBox, LockedNotice, PageCanvas, PreviewError, PageNav, newId, type Box } from "@/components/workspace/editors/PageCanvas";
import { SignatureModal } from "@/components/workspace/editors/SignatureModal";
import { usePdf } from "@/components/workspace/Preview";
import type { WorkspaceApi } from "@/components/workspace/types";

interface Placement extends Box {
  id: string;
  page: number;
  kind: "signature" | "date" | "text";
  text?: string;
}

function todayLabel(): string {
  return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function SignEditor(api: WorkspaceApi) {
  const { files, values, setValue, extras, setExtra, color } = api;
  const { doc, state, pages } = usePdf(files[0], String(values.password ?? ""));
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [pendingPlace, setPendingPlace] = useState(false);
  const [pageSize, setPageSize] = useState({ width: 595, height: 842 });
  const placements = useMemo(() => (Array.isArray(values.placements) ? (values.placements as Placement[]) : []), [values.placements]);
  const signature = extras.signature?.[0];
  const [sig, setSig] = useState<{ url: string; ratio: number } | null>(null);

  useEffect(() => {
    if (!signature) return setSig(null);
    const url = URL.createObjectURL(signature);
    const img = new Image();
    img.onload = () => setSig({ url, ratio: img.naturalWidth / img.naturalHeight || 3 });
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [signature]);

  const update = (next: Placement[]) => setValue("placements", next.length ? next : null);

  function add(kind: Placement["kind"], ratio = 3) {
    const width = kind === "signature" ? 170 : kind === "date" ? 110 : 160;
    const height = kind === "signature" ? width / ratio : 22;
    const item: Placement = {
      id: newId(),
      page,
      kind,
      text: kind === "text" ? "Your text" : undefined,
      x: Math.max(0, pageSize.width - width - 60),
      y: Math.max(0, pageSize.height - height - 90 - placements.filter((p) => p.page === page).length * 34),
      width,
      height,
    };
    update([...placements, item]);
    setSelected(item.id);
  }

  // after the signature is created, drop it straight onto the page
  useEffect(() => {
    if (pendingPlace && sig) {
      setPendingPlace(false);
      add("signature", sig.ratio);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPlace, sig]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selected && !/INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName)) {
        update(placements.filter((p) => p.id !== selected));
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (state === "locked") return <LockedNotice />;
  if (state === "error") return <PreviewError />;
  if (state !== "ready" || !doc) return <div className="mx-auto aspect-[1/1.414] max-w-xl rounded-lg skeleton" />;

  const sel = placements.find((p) => p.id === selected);

  return (
    <div style={{ "--c": color } as CSSProperties}>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {sig ? (
          <button type="button" onClick={() => setModal(true)} className="flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-3 shadow-soft hover:border-line-strong" title="Change signature">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sig.url} alt="Your signature" className="h-7 max-w-28 object-contain" />
            <PenLine className="size-3.5 text-slate-400" />
          </button>
        ) : null}
        <Button
          variant="tint"
          color={color}
          size="md"
          leftIcon={<Signature className="size-4" />}
          onClick={() => {
            if (sig) add("signature", sig.ratio);
            else {
              setPendingPlace(true);
              setModal(true);
            }
          }}
        >
          {sig ? "Add signature" : "Create signature"}
        </Button>
        <Button variant="secondary" leftIcon={<CalendarDays className="size-4" />} onClick={() => add("date")}>
          Date
        </Button>
        <Button variant="secondary" leftIcon={<Type className="size-4" />} onClick={() => add("text")}>
          Text
        </Button>
        <div className="ml-auto">
          <PageNav page={page} pages={pages} onChange={(p) => { setPage(p); setSelected(null); }} />
        </div>
      </div>

      {sel?.kind === "text" && (
        <input
          autoFocus
          value={sel.text ?? ""}
          onChange={(e) => update(placements.map((p) => (p.id === sel.id ? { ...p, text: e.target.value } : p)))}
          className="mb-4 h-10 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink outline-none focus:border-brand"
          placeholder="Type the text to place"
        />
      )}

      <div className="rounded-2xl bg-surface-2 p-3 sm:p-6">
        <PageCanvas
          doc={doc}
          page={page}
          maxWidth={760}
          overlayProps={{ onPointerDown: () => setSelected(null) }}
          onInfo={(info) => setPageSize({ width: info.width, height: info.height })}
        >
          {(info) =>
            placements
              .filter((p) => p.page === page)
              .map((p) => (
                <DraggableBox
                  key={p.id}
                  box={p}
                  scale={info.scale}
                  bounds={info}
                  selected={selected === p.id}
                  keepAspect={p.kind === "signature"}
                  onSelect={() => setSelected(p.id)}
                  onChange={(b) => update(placements.map((x) => (x.id === p.id ? { ...x, ...b } : x)))}
                  onDelete={() => update(placements.filter((x) => x.id !== p.id))}
                  className="rounded-[3px] bg-[color-mix(in_oklab,var(--c)_6%,transparent)]"
                >
                  {p.kind === "signature" && sig ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sig.url} alt="" className="pointer-events-none size-full object-contain" draggable={false} />
                  ) : (
                    <span
                      className="pointer-events-none flex size-full items-center overflow-hidden px-0.5 whitespace-nowrap"
                      style={{ fontSize: Math.max(8, p.height * 0.6) * info.scale, color: String(values.color ?? "#0d1a73") }}
                    >
                      {p.kind === "date" ? todayLabel() : p.text}
                    </span>
                  )}
                </DraggableBox>
              ))
          }
        </PageCanvas>
      </div>

      <p className="mt-4 text-center text-sm text-muted">
        {placements.length
          ? `${placements.length} item${placements.length > 1 ? "s" : ""} placed · drag to move, use the corners to resize`
          : "Create your signature, then drag it where you want to sign."}
      </p>

      <SignatureModal
        open={modal}
        color={color}
        onClose={() => {
          setModal(false);
          setPendingPlace(false);
        }}
        onDone={(file) => {
          setExtra("signature", [file]);
          setModal(false);
        }}
      />
    </div>
  );
}

export function validateSign(api: WorkspaceApi): string | null {
  const list = Array.isArray(api.values.placements) ? (api.values.placements as Placement[]) : [];
  if (!list.length) return "Add your signature to the document first.";
  if (list.some((p) => p.kind === "signature") && !api.extras.signature?.length) return "Create your signature first.";
  return null;
}
