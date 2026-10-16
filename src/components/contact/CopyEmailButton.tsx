"use client";

import { useState } from "react";

/** Copies the email to the clipboard — handy for recruiters on a desktop without a mail app. */
export function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (e.g. insecure context); the mailto button still works.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex min-h-11 cursor-pointer items-center rounded-[10px] border border-line px-5 text-[15px] transition-colors hover:border-muted"
    >
      <span aria-live="polite">{copied ? "Copied!" : "Copy email"}</span>
    </button>
  );
}
