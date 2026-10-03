"use client";

import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const share = typeof navigator !== "undefined" && "share" in navigator;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <code className="min-w-0 max-w-full flex-1 truncate rounded-[var(--radius-md)] bg-white/70 px-3 py-2 text-[12.5px]">{url}</code>
      <button type="button" onClick={() => (share ? navigator.share({ url }).catch(() => {}) : navigator.clipboard?.writeText(url).then(() => setCopied(true)))} className="h-10 rounded-full bg-[var(--color-primary)] px-4 text-[14px] font-bold text-white">{copied ? "Copié" : share ? "Partager" : "Copier"}</button>
    </div>
  );
}
