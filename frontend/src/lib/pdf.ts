"use client";

import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

type PdfJs = typeof import("pdfjs-dist");

let pdfjs: Promise<PdfJs> | null = null;

export function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjs) {
    pdfjs = import("pdfjs-dist")
      .then((lib) => {
        lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        return lib;
      })
      .catch((err) => {
        pdfjs = null;
        reloadAfterDeploy();
        throw err;
      });
  }
  return pdfjs;
}

/**
 * A tab opened before a new deploy asks for script chunks that no longer exist.
 * Reload once to pick up the new build instead of leaving the preview stuck.
 */
function reloadAfterDeploy() {
  const key = "pdfjs-reloaded";
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    return;
  }
  window.location.reload();
}

export class PdfPasswordError extends Error {}

const cache = new WeakMap<File, Map<string, Promise<PDFDocumentProxy>>>();

/** Open a PDF once per (file, password) and reuse it across thumbnails and editors. */
export function openPdf(file: File, password = ""): Promise<PDFDocumentProxy> {
  let byPassword = cache.get(file);
  if (!byPassword) {
    byPassword = new Map();
    cache.set(file, byPassword);
  }
  const cached = byPassword.get(password);
  if (cached) return cached;

  const promise = (async () => {
    const lib = await loadPdfJs();
    const data = new Uint8Array(await file.arrayBuffer());
    try {
      return await lib.getDocument({ data, password: password || undefined, isEvalSupported: false }).promise;
    } catch (err) {
      if ((err as { name?: string })?.name === "PasswordException") throw new PdfPasswordError("password");
      throw err;
    }
  })();
  byPassword.set(password, promise);
  promise.catch(() => byPassword!.delete(password));
  return promise;
}

export interface PageSize {
  width: number;
  height: number;
}

/** Visual size (rotation applied) in PDF points - matches the backend's coordinate system. */
export async function pageSize(doc: PDFDocumentProxy, pageNumber: number): Promise<PageSize> {
  const page = await doc.getPage(pageNumber);
  const vp = page.getViewport({ scale: 1 });
  return { width: vp.width, height: vp.height };
}

/**
 * Render a page into a canvas so that it is `cssWidth` pixels wide. Returns a
 * cancel function - pdf.js refuses two renders into one canvas at the same time.
 */
export function renderPage(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  cssWidth: number,
): { done: Promise<void>; cancel: () => void } {
  const base = page.getViewport({ scale: 1 });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });
  // render offscreen first so a cancelled render never leaves a blank canvas behind
  const off = document.createElement("canvas");
  off.width = Math.max(1, Math.floor(viewport.width));
  off.height = Math.max(1, Math.floor(viewport.height));
  const ctx = off.getContext("2d");
  if (!ctx) return { done: Promise.reject(new Error("Canvas not supported")), cancel: () => {} };
  const task = page.render({ canvasContext: ctx, viewport });
  const done = task.promise.then(() => {
    canvas.width = off.width;
    canvas.height = off.height;
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    canvas.getContext("2d")?.drawImage(off, 0, 0);
  });
  return { done, cancel: () => task.cancel() };
}
