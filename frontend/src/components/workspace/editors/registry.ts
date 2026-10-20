import { CropEditor, RedactEditor, validateRedact } from "@/components/workspace/editors/AreaEditors";
import { CompareSlots, FormsEditor, validateForms } from "@/components/workspace/editors/FormEditors";
import { PagePicker } from "@/components/workspace/editors/PagePicker";
import { PageOrganizer, RotateView } from "@/components/workspace/editors/PageOrganizer";
import { PdfEditor, validateEdit } from "@/components/workspace/editors/PdfEditor";
import { SignEditor, validateSign } from "@/components/workspace/editors/SignEditor";
import { FileGrid } from "@/components/workspace/FileGrid";
import type { EditorSpec, WorkspaceApi } from "@/components/workspace/types";

const EDITORS: Record<string, EditorSpec> = {
  "organize-pdf": { component: PageOrganizer, owns: () => ["order"] },
  "rotate-pdf": {
    component: RotateView,
    owns: (api) => (api.files.length === 1 ? ["rotations", "angle", "pages"] : ["rotations"]),
    validate: (api) => (api.files.length === 1 && !api.values.rotations ? "Rotate at least one page first." : null),
  },
  "sign-pdf": {
    component: SignEditor,
    owns: () => ["placements", "typed_name", "date_format"],
    ownsExtras: ["signature"],
    validate: validateSign,
  },
  "edit-pdf": { component: PdfEditor, owns: () => ["operations"], ownsExtras: ["images"], validate: validateEdit },
  "redact-pdf": { component: RedactEditor, owns: () => ["areas"], validate: validateRedact },
  "crop-pdf": { component: CropEditor, owns: () => ["box", "top", "right", "bottom", "left", "pages"] },
  "pdf-forms": { component: FormsEditor, owns: () => ["fields"], validate: validateForms },
  "compare-pdf": { component: CompareSlots },
  "split-pdf": {
    component: PagePicker,
    owns: () => ["ranges"],
    validate: (api) =>
      api.values.mode === "ranges" && !String(api.values.ranges ?? "").trim() ? "Click the scissors between pages to choose where to split." : null,
  },
  "remove-pages": { component: PagePicker, validate: (api) => (String(api.values.pages ?? "").trim() ? null : "Select the pages to remove.") },
  "extract-pages": { component: PagePicker, validate: (api) => (/\d/.test(String(api.values.pages ?? "")) ? null : "Select the pages to extract.") },
};

const PAGE_PICKER: EditorSpec = { component: PagePicker };
const FILE_GRID: EditorSpec = { component: FileGrid };

export function editorFor(api: WorkspaceApi): EditorSpec {
  const special = EDITORS[api.tool.slug];
  // rotate with several files has no per-page view - fall back to the file grid + options
  if (special && !(api.tool.slug === "rotate-pdf" && api.files.length > 1)) return special;
  const singlePdf = api.files.length === 1 && api.tool.max_files === 1 && api.tool.accepts.includes("pdf");
  if (singlePdf && api.tool.options.some((o) => o.name === "pages")) return PAGE_PICKER;
  return FILE_GRID;
}
