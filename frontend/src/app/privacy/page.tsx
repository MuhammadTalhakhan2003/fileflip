import type { Metadata } from "next";

import { PageHeader, Prose } from "@/components/layout/Prose";

export const metadata: Metadata = {
  title: "Privacy & Security",
  description: "How FileFlip handles your files: encrypted transfer, automatic deletion, no accounts and no tracking of your documents.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <>
      <PageHeader eyebrow="Privacy & Security" title="Your files stay yours" text="We built FileFlip so that we know as little about you and your documents as possible." />
      <Prose>
        <h2>The short version</h2>
        <ul>
          <li><strong>No account, no email.</strong> We never ask who you are.</li>
          <li><strong>Encrypted transfer.</strong> Files travel between your browser and our server over HTTPS.</li>
          <li><strong>Inputs deleted immediately.</strong> The files you upload are removed as soon as the conversion finishes.</li>
          <li><strong>Results deleted within one hour.</strong> Or instantly, when you press &ldquo;Delete now&rdquo;.</li>
          <li><strong>Private links.</strong> Every result has a long random address that can&apos;t be guessed or listed.</li>
          <li><strong>We don&apos;t read your documents.</strong> Files are processed automatically and never looked at, shared or sold.</li>
        </ul>

        <h2>What happens when you use a tool</h2>
        <p>
          Your file is uploaded to our conversion server, processed by the tool you chose, and the result is stored temporarily so you
          can download it. Page previews (thumbnails, the signing and editing canvas) are rendered right in your browser.
        </p>

        <h2>AI tools</h2>
        <p>
          The AI Summarizer and Translate PDF send the text of your document to our AI provider (Anthropic) to generate the summary or
          translation. Only use them for documents you are comfortable processing this way.
        </p>

        <h2>Logs</h2>
        <p>
          Like every web server, ours keeps short technical logs (time, which tool was used, how long it took, the IP address for abuse
          protection). File contents are never written to logs.
        </p>

        <h2>Abuse protection</h2>
        <p>To keep the service free for everyone, we limit how many conversions one IP address can run per minute and the size of each upload.</p>
      </Prose>
    </>
  );
}
