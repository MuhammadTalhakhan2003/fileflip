export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
const BASE = `${API_URL}/api/v1`;

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string = "error",
    public status = 0,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

export interface JobResult {
  job_id: string;
  tool: string;
  file_name: string;
  size: number;
  media_type: string;
  created_at: string;
  expires_at: string;
  meta: Record<string, unknown>;
  download_url: string;
}

export interface InspectPage {
  number: number;
  width: number;
  height: number;
  rotation: number;
  has_text: boolean;
}

export interface FormField {
  name: string;
  type: string;
  value: unknown;
  page: number;
  rect: number[];
  choices?: string[];
  on_value?: string;
}

export interface InspectResult {
  type: "pdf" | "image";
  needs_password?: boolean;
  page_count?: number;
  pages?: InspectPage[];
  has_text?: boolean;
  is_form?: boolean;
  form_fields?: FormField[];
}

function parseError(status: number, body: string, retryAfter?: string | null): ApiError {
  try {
    const data = JSON.parse(body);
    if (data?.error?.message) {
      return new ApiError(data.error.message, data.error.code, status, retryAfter ? Number(retryAfter) : undefined);
    }
  } catch {
    /* not JSON */
  }
  if (status === 413) return new ApiError("This upload is too large.", "file_too_large", status);
  if (status >= 500) return new ApiError("Our server had a problem. Please try again in a moment.", "server_error", status);
  return new ApiError("Something went wrong. Please try again.", "error", status);
}

/**
 * Upload files to a tool. XHR (not fetch) so we can show real upload progress.
 * `onUploadProgress` reports 0..1; `onProcessing` fires when the upload is done
 * and the server is working on the file.
 */
export function runTool(
  slug: string,
  form: FormData,
  handlers: { onUploadProgress?: (p: number) => void; onProcessing?: () => void; signal?: AbortSignal } = {},
): Promise<JobResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/convert/${encodeURIComponent(slug)}`);
    xhr.responseType = "text";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) handlers.onUploadProgress?.(e.loaded / e.total);
    };
    xhr.upload.onload = () => handlers.onProcessing?.();
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as JobResult);
        } catch {
          reject(new ApiError("The server sent an unexpected response.", "bad_response", xhr.status));
        }
      } else {
        reject(parseError(xhr.status, xhr.responseText, xhr.getResponseHeader("Retry-After")));
      }
    };
    xhr.onerror = () =>
      reject(new ApiError("Can't reach the server. Check your internet connection and try again.", "network", 0));
    xhr.onabort = () => reject(new ApiError("Cancelled.", "aborted", 0));
    handlers.signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(form);
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new ApiError("Can't reach the server. Check your internet connection and try again.", "network", 0);
  }
  const text = await res.text();
  if (!res.ok) throw parseError(res.status, text, res.headers.get("Retry-After"));
  return JSON.parse(text) as T;
}

export function inspectFile(file: File, password = ""): Promise<InspectResult> {
  const form = new FormData();
  form.append("file", file);
  if (password) form.append("password", password);
  return request<InspectResult>("/inspect", { method: "POST", body: form });
}

export function toolStatus(slug: string): Promise<{ available: boolean }> {
  return request<{ available: boolean }>(`/tools/${encodeURIComponent(slug)}`);
}

export function deleteJob(jobId: string): Promise<unknown> {
  return request(`/jobs/${encodeURIComponent(jobId)}`, { method: "DELETE" });
}

export function downloadUrl(job: JobResult, inline = false): string {
  return `${API_URL}${job.download_url}${inline ? "?inline=true" : ""}`;
}

export async function fetchResultFile(job: JobResult): Promise<File> {
  const res = await fetch(downloadUrl(job));
  if (!res.ok) throw new ApiError("This file has expired. Please run the tool again.", "expired", res.status);
  const blob = await res.blob();
  return new File([blob], job.file_name, { type: job.media_type.split(";")[0] });
}
