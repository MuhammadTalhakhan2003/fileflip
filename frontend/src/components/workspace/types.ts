import type { ComponentType } from "react";

import { hexFromRgb } from "@/lib/format";
import type { Tool } from "@/lib/tools";

export type Values = Record<string, unknown>;

/** Everything an editor or panel needs to read and change the job being prepared. */
export interface WorkspaceApi {
  tool: Tool;
  color: string;
  files: File[];
  setFiles: (files: File[]) => void;
  addFiles: (files: File[]) => void;
  removeFile: (index: number) => void;
  values: Values;
  setValue: (name: string, value: unknown) => void;
  extras: Record<string, File[]>;
  setExtra: (name: string, files: File[]) => void;
  /** Opens the system file picker for more input files. */
  browse: () => void;
}

export interface EditorSpec {
  component: ComponentType<WorkspaceApi>;
  /** Options this editor controls - hidden from the sidebar. */
  owns?: (api: WorkspaceApi) => string[];
  /** Extra uploads this editor manages itself. */
  ownsExtras?: string[];
  /** Returns a message when the job can't be started yet. */
  validate?: (api: WorkspaceApi) => string | null;
}

export function initialValues(tool: Tool): Values {
  const values: Values = {};
  for (const o of tool.options) {
    if (o.type === "color") values[o.name] = hexFromRgb(o.default);
    else values[o.name] = o.default ?? (o.type === "str" ? "" : null);
  }
  return values;
}

export function buildForm(tool: Tool, files: File[], values: Values, extras: Record<string, File[]>): FormData {
  const form = new FormData();
  for (const f of files) form.append("files", f, f.name);
  for (const [name, list] of Object.entries(extras)) for (const f of list) form.append(name, f, f.name);
  for (const o of tool.options) {
    const v = values[o.name];
    if (v === undefined || v === null || v === "") continue;
    if (o.type === "json") form.append(o.name, JSON.stringify(v));
    else if (o.type === "bool") form.append(o.name, v ? "true" : "false");
    else form.append(o.name, String(v));
  }
  return form;
}

export function missingRequired(tool: Tool, values: Values, owned: string[]): string | null {
  for (const o of tool.options) {
    if (!o.required || owned.includes(o.name)) continue;
    const v = values[o.name];
    if (v === undefined || v === null || (typeof v === "string" && !v.trim())) return `Please fill in "${o.label}".`;
  }
  return null;
}
