"use client";

import clsx from "clsx";
import { FileText, Lock } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";

import { FORMAT_COLORS } from "@/lib/toolMeta";
import { extensionOf } from "@/lib/tools";
import { PdfPasswordError, openPdf, renderPage } from "@/lib/pdf";

/** Loads a PDF with pdf.js; tracks password-protected files. */
export function usePdf(file: File | undefined, password = "") {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "locked" | "error">("loading");
  useEffect(() => {
    if (!file || extensionOf(file.name) !== "pdf") {
      setDoc(null);
      setState("error");
      return;
    }
    let alive = true;
    setState("loading");
    openPdf(file, password)
      .then((d) => {
        if (!alive) return;
        setDoc(d);
        setState("ready");
      })
      .catch((err) => {
        if (!alive) return;
        setDoc(null);
        setState(err instanceof PdfPasswordError ? "locked" : "error");
      });
    return () => {
      alive = false;
    };
  }, [file, password]);
  return { doc, state, pages: doc?.numPages ?? 0 };
}

function useInView<T extends Element>(rootMargin = "300px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setInView(true), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [inView, rootMargin]);
  return { ref, inView };
}

/** One rendered PDF page. Renders lazily when scrolled into view. */
export function PdfPage({
  doc,
  page,
  width,
  rotation = 0,
  className,
  onRendered,
}: {
  doc: PDFDocumentProxy;
  page: number;
  width: number;
  rotation?: number;
  className?: string;
  onRendered?: (size: { width: number; height: number }) => void;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [aspect, setAspect] = useState(1.414);

  useEffect(() => {
    if (!inView || !canvasRef.current) return;
    let cancel = () => {};
    let alive = true;
    doc.getPage(page).then((p) => {
      if (!alive || !canvasRef.current) return;
      const vp = p.getViewport({ scale: 1 });
      setAspect(vp.height / vp.width);
      const job = renderPage(p, canvasRef.current, width);
      cancel = job.cancel;
      job.done
        .then(() => {
          if (!alive) return;
          setReady(true);
          onRendered?.({ width: vp.width, height: vp.height });
        })
        .catch(() => {});
    });
    return () => {
      alive = false;
      cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, doc, page, width]);

  const sideways = rotation % 180 !== 0;
  return (
    <div
      ref={ref}
      className={clsx("relative grid place-items-center", className)}
      style={{ aspectRatio: sideways ? `${aspect} / 1` : `1 / ${aspect}` }}
    >
      <div
        className="absolute transition-transform duration-300"
        style={{
          width: sideways ? `${100 / aspect}%` : "100%",
          transform: `rotate(${rotation}deg)`,
        }}
      >
        <canvas ref={canvasRef} className={clsx("block w-full bg-white transition-opacity duration-300", ready ? "opacity-100" : "opacity-0")} />
      </div>
      {!ready && <div className="absolute inset-0 skeleton" />}
    </div>
  );
}

/** Small preview for any uploaded file: first PDF page, the image itself, or a format icon. */
export function FileThumb({ file, className }: { file: File; className?: string }) {
  const ext = extensionOf(file.name);
  const isPdf = ext === "pdf";
  const isImage = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "ico", "svg"].includes(ext);
  const { doc, state } = usePdf(isPdf ? file : undefined);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isImage) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file, isImage]);

  return (
    <div className={clsx("relative grid place-items-center overflow-hidden bg-surface-2", className)}>
      {isPdf && state === "ready" && doc ? (
        <div className="w-[82%] shadow-card ring-1 ring-black/5">
          <PdfPage doc={doc} page={1} width={180} />
        </div>
      ) : isPdf && state === "locked" ? (
        <div className="flex flex-col items-center gap-2 text-muted">
          <span className="grid size-12 place-items-center rounded-2xl bg-amber-500/12 text-amber-600"><Lock className="size-6" /></span>
          <span className="text-xs font-semibold">Protected</span>
        </div>
      ) : isPdf && state === "loading" ? (
        <div className="aspect-[1/1.414] w-[82%] skeleton" />
      ) : isImage && url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
      ) : (
        <FormatTile ext={ext} />
      )}
    </div>
  );
}

export function FormatTile({ ext }: { ext: string }) {
  const map: Record<string, string> = { doc: "docx", xls: "xlsx", ppt: "pptx", jpeg: "jpg", tif: "tiff", htm: "html", heif: "heic" };
  const key = map[ext] ?? ext;
  const color = FORMAT_COLORS[key] ?? "#64748b";
  return (
    <div className="relative">
      <FileText className="size-14 text-subtle" strokeWidth={1.2} />
      <span className="absolute -right-3 bottom-1 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold text-white uppercase shadow" style={{ background: color }}>
        {ext || "file"}
      </span>
    </div>
  );
}
