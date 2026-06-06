import React, { useCallback, useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CopyButtonProps {
  value: string;
  label: string;
  disabled?: boolean;
}

export default function CopyButton({ value, label, disabled = false }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!value) {
      return;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(value);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={disabled || !value}
      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-300 transition hover:border-cyan-700 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
      title={`${label} kopieren`}
    >
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
      {copied ? 'Kopiert' : label}
    </button>
  );
}
