import type { ReactNode } from "react";

/** Tiny, safe Markdown renderer for AI summaries (headings, lists, bold, italics, code). No HTML injection. */
function inline(text: string, key: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={`${key}-${i}`} className="font-semibold text-ink">{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={`${key}-${i}`} className="rounded bg-surface-2 px-1 py-0.5 text-[0.9em]">{p.slice(1, -1)}</code>;
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2) return <em key={`${key}-${i}`}>{p.slice(1, -1)}</em>;
    return p;
  });
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r/g, "").split("\n");
  const out: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) out.push(<p key={`p${out.length}`} className="leading-relaxed text-ink-2">{inline(para.join(" "), `p${out.length}`)}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    out.push(
      <Tag key={`l${out.length}`} className={`space-y-1.5 pl-5 text-ink-2 ${list.ordered ? "list-decimal" : "list-disc"} marker:text-subtle`}>
        {list.items.map((it, i) => <li key={i} className="leading-relaxed">{inline(it, `li${out.length}-${i}`)}</li>)}
      </Tag>,
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (heading) {
      flushPara();
      flushList();
      const size = heading[1].length <= 2 ? "text-xl" : "text-base";
      out.push(<h3 key={`h${out.length}`} className={`font-display font-bold text-ink ${size} pt-2`}>{inline(heading[2], `h${out.length}`)}</h3>);
    } else if (bullet || numbered) {
      flushPara();
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? numbered)![1]);
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return <div className="space-y-3 text-[15px]">{out}</div>;
}
