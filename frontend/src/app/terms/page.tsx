import type { Metadata } from "next";

import { PageHeader, Prose } from "@/components/layout/Prose";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The simple rules for using FileFlip's free PDF and image tools.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <>
      <PageHeader eyebrow="Terms" title="Simple, fair terms" text="FileFlip is free to use. Here are the few rules that keep it that way." />
      <Prose>
        <h2>Using FileFlip</h2>
        <ul>
          <li>You may use every tool for personal and commercial work, free of charge.</li>
          <li>Only upload files you have the right to process.</li>
          <li>Don&apos;t use the service to break the law, to attack it, or to overload it with automated traffic.</li>
        </ul>

        <h2>Your content</h2>
        <p>You keep all rights to your files. We only process them to give you the result you asked for, and delete them automatically.</p>

        <h2>No warranty</h2>
        <p>
          We work hard to produce accurate conversions, but results depend on the source file. Always check important documents
          before relying on them. The service is provided &ldquo;as is&rdquo;, without warranties of any kind.
        </p>

        <h2>Signatures</h2>
        <p>
          Sign PDF places a visual signature on a document. It is not a certificate-based digital signature. Check whether a visual
          signature is sufficient for your agreement.
        </p>

        <h2>Changes</h2>
        <p>We may update these terms as the service grows. The current version is always on this page.</p>
      </Prose>
    </>
  );
}
