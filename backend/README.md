# FileFlip API

Free file conversion and PDF tools: no sign-up, no login. Files are deleted automatically after 60 minutes.

**61 tools** in 8 categories, like iLovePDF:

| Category | Tools |
|---|---|
| Organize PDF | Merge, Split, Remove pages, Extract pages, Organize (reorder / rotate / blank pages), Scan to PDF |
| Optimize PDF | Compress, Repair, OCR |
| Convert to PDF | JPG→PDF, Word→PDF, PowerPoint→PDF, Excel→PDF, HTML→PDF |
| Convert from PDF | PDF→Word, PDF→JPG, PDF→PNG, PDF→PowerPoint, PDF→Excel, PDF→Text, PDF→PDF/A |
| Edit PDF | Rotate, Page numbers, Watermark, Crop, Edit (text/shapes/drawing/images/links), PDF Forms |
| PDF Security | Unlock, Protect, Sign, Redact, Compare |
| PDF Intelligence | AI Summarizer, Translate PDF, PDF→Markdown |
| Image Tools | Image converter (JPG/PNG/WEBP/GIF/BMP/TIFF/ICO/HEIC), 21 direct pairs (jpg-to-png, heic-to-jpg, ...), Resize, Compress |

## Run locally

```powershell
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements-dev.txt
copy .env.example .env
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/docs for interactive API docs. Run the tests with `.venv\Scripts\python -m pytest`.

### Optional engines

Most tools are pure Python. A few need an external program. Without it, the tool shows `"available": false` and the rest keep working.

| Engine | Unlocks | Install (Windows) |
|---|---|---|
| LibreOffice | Word/Excel/PowerPoint → PDF (HTML→PDF uses it when present) | https://www.libreoffice.org/download |
| Ghostscript | PDF/A, deep repair of badly damaged files | https://ghostscript.com/releases/gsdnld.html |
| Tesseract | OCR PDF | https://github.com/UB-Mannheim/tesseract/wiki (add language packs like `urd`, `ara`) |
| `ANTHROPIC_API_KEY` | AI Summarizer, Translate PDF | https://console.anthropic.com |

`GET /api/v1/health` shows which engines were detected. The Docker image includes all of them:

```bash
docker build -t convertor-api backend
docker run -p 8000:8000 -e ANTHROPIC_API_KEY=... convertor-api
```

## API for the frontend

All endpoints are under `/api/v1`. Errors always look like `{"error": {"code": "...", "message": "..."}}`. The message is written for end users, so the frontend can show it directly.

### `GET /tools`
Every tool grouped by category: slug, name, description, accepted extensions, file count limits, options (type, default, choices, min/max), extra uploads and availability. **Build the UI from this.** Adding a tool to the backend makes it show up automatically.

### `POST /convert/{slug}`
`multipart/form-data`:
- `files`: one or more files, in the order the user arranged them (merge order, page order, ...)
- one form field per option, e.g. `dpi=150`, `pages=1-3,5`, `level=extreme`
- JSON options (`order`, `operations`, `placements`, `fields`, `areas`, `terms`) are sent as JSON strings
- extra uploads use their own field name: `signature` (sign-pdf), `image` (add-watermark), `images` (edit-pdf)

Response:
```json
{
  "job_id": "R4WB2nq7RoigS6DFGnNhEQF7",
  "tool": "pdf-to-jpg",
  "file_name": "report_page_1.jpg",
  "size": 12948,
  "media_type": "image/jpeg",
  "expires_at": "2026-10-20T09:17:06+00:00",
  "meta": {"pages": 1, "dpi": 150},
  "download_url": "/api/v1/download/R4WB2nq7RoigS6DFGnNhEQF7"
}
```
`meta` carries tool-specific results the UI can show: compression savings, `summary` text, compare similarity, `warning` for scanned PDFs, and so on. Several output files come back as one `.zip`.

### `GET /download/{job_id}` (`?inline=true` to preview in the browser)
### `GET /jobs/{job_id}` · `DELETE /jobs/{job_id}` (lets the user delete their file right away)

### `POST /inspect`
Upload one PDF or image (plus optional `password`). Returns page count, each page's size and rotation, whether it has text (scanned or not), form fields, and metadata. Nothing is stored. Use it for page thumbnails/selection, the Sign/Edit/Redact canvases, and the Forms tool.

**Coordinates** for edit, sign, redact and crop are PDF points, measured from the top-left of the page as the user sees it (rotation already applied). That matches the `width`/`height` returned by `/inspect`, so a pdf.js canvas maps 1:1 at scale 1.

### Common error codes
`unsupported_file_type`, `invalid_file`, `password_required`, `wrong_password`, `no_files`, `too_many_files`, `invalid_input`, `file_too_large` (413), `rate_limited` (429 + `Retry-After`), `tool_unavailable` (503), `timeout` (504), `conversion_failed` (500).

## How it's built

```
app/
  main.py            FastAPI app, error handlers, CORS, cleanup loop
  api/routes.py      HTTP endpoints, streaming uploads, validation
  core/              settings, storage (auto-expiring jobs), rate limiter, engine detection
  tools/
    registry.py      @tool decorator: metadata + option parsing/validation
    common.py        page ranges, safe PDF opening, zipping, rotated-page coordinates
    organize.py optimize.py office.py from_pdf.py images.py edit.py security.py ai.py
```

To add a tool: write a function `def my_tool(ctx: Context) -> Result` in one of the `tools/*.py` files and decorate it with `@tool(slug=..., accepts=..., options=...)`. Validation, upload handling, the API endpoint and the `/tools` listing all come from that.

### Privacy and abuse protection
- No accounts. Each result sits behind a random 24-character id that can't be guessed or listed.
- Inputs are deleted as soon as the conversion finishes; results after `CONVERTOR_FILE_TTL_MINUTES`.
- Per-IP rate limit, upload size, page and file-count caps, a cap on concurrent jobs, and per-tool timeouts.
- Uploads are checked by extension and file signature. Filenames are sanitized.
- When running several instances, move the rate limiter to Redis and put storage on a shared volume.

## Licensing note
PyMuPDF / pdf2docx / pymupdf4llm are **AGPL-3.0**. Running them in a public web service means you must publish this backend's source code, which fits a free project. For closed source, buy a commercial PyMuPDF license from Artifex.
