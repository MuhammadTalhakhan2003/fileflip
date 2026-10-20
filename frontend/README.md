# FileFlip Web

The website for FileFlip: 61 free PDF and image tools, no sign-up. Built with Next.js 15 (App Router), React 19, Tailwind CSS 4 and TypeScript.

## Run it

```powershell
# 1. backend (in another terminal)
cd ..\backend
.venv\Scripts\python -m uvicorn app.main:app --port 8000

# 2. frontend
cd frontend
npm install
copy .env.example .env.local     # adjust NEXT_PUBLIC_API_URL / NEXT_PUBLIC_SITE_URL
npm run dev                      # http://localhost:3000
```

Production: `npm run build` then `npm run start`.

When you add or change a tool in the backend, run `npm run sync-tools`. It regenerates `src/data/tools.json`, and every page, menu, search result and sitemap entry updates from it.

## What's inside

| Area | Where |
|---|---|
| Design tokens (colors, light/dark themes, shadows, motion) | `src/app/globals.css` |
| Category colors, icons, format chips, SEO copy | `src/lib/toolMeta.ts` |
| Home: hero with interactive particle sphere, tool explorer, features, privacy, FAQ | `src/components/home/` |
| Navigation: mega menu, 9-dot apps menu, Ctrl+K search, mobile drawer | `src/components/layout/` |
| Tool workspace: upload → options → progress → result | `src/components/workspace/ToolWorkspace.tsx` |
| Visual editors (organize, rotate, split, sign, edit, redact, crop, forms, compare) | `src/components/workspace/editors/` |
| WebGL particle sphere | `src/components/effects/VoiceBlob.tsx` |
| One static, SEO-ready page per tool | `src/app/[slug]/page.tsx` |

### UX details
- Drag and drop anywhere on the page, browse, or paste from the clipboard.
- Real upload progress, then a processing animation tinted with the tool's color.
- Page previews render in the browser (pdf.js), so the backend isn't hit until you press the button.
- "Continue with…" passes the result straight into the next tool without re-uploading.
- Password-protected PDFs: a clear message, and the password field opens on its own.
- Download, preview, copy link, or delete the file right away.
- Light and dark mode (follows the system, remembers your choice), keyboard shortcuts, reduced-motion support.

### Publicity / SEO
- 137 pages pre-rendered as static HTML: home, 61 tool pages, about, privacy, terms.
- Per-page title, description, keywords and canonical URL.
- Auto-generated social preview images for every tool (`/merge-pdf/opengraph-image`).
- `sitemap.xml`, `robots.txt`, JSON-LD (WebApplication, FAQPage, HowTo, BreadcrumbList).
- Installable as an app (web manifest + icons), with shortcuts to popular tools.

Set `NEXT_PUBLIC_SITE_URL` to your real domain before deploying, so links in the sitemap and social cards are correct.
