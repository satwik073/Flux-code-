"use client";

import { useState } from "react";
import { CopyIcon, CheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

const COMMANDS = [
  { label: "Initialize repo", cmd: "git init" },
  { label: "Create branch", cmd: "git checkout -b <branch-name>" },
  { label: "Switch branch", cmd: "git checkout <branch-name>" },
  { label: "Merge branch", cmd: "git merge <branch-name>" },
  { label: "Status", cmd: "git status" },
  { label: "Stage all", cmd: "git add ." },
  { label: "Commit", cmd: 'git commit -m "your message"' },
  { label: "Branch list", cmd: "git branch -a" },
  { label: "Log (graph)", cmd: "git log --oneline --graph -20" },
];

export function GitPanel() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (cmd: string) => {
    void navigator.clipboard.writeText(cmd);
    setCopied(cmd);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="flex-1 min-h-0 overflow-auto p-3 text-xs">
      <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 mb-3">
        <p className="text-amber-700 dark:text-amber-400 font-medium">
          Git is not available in the browser preview
        </p>
        <p className="text-muted-foreground mt-1">
          The preview runs in a Node.js environment (WebContainer) with <strong>npm</strong> and <strong>Node</strong> only. Use the <strong>Terminal</strong> tab for <code className="bg-muted px-1 rounded">npm install</code>, <code className="bg-muted px-1 rounded">npm run dev</code>, <code className="bg-muted px-1 rounded">clear</code>, etc. For Git, use <strong>Create repository</strong> (Export to GitHub) or <strong>Import from GitHub</strong> in Flux, or run git in your local terminal after cloning.
        </p>
      </div>
      <p className="text-muted-foreground mb-3">
        <strong>Reference</strong> — Git commands (for use locally or in a full IDE):
      </p>
      <div className="space-y-1.5">
        {COMMANDS.map(({ label, cmd }) => (
          <div
            key={cmd}
            className="flex items-center justify-between gap-2 py-1.5 px-2 rounded bg-muted/50 font-mono"
          >
            <span className="text-muted-foreground shrink-0 w-24">{label}</span>
            <code className="flex-1 truncate text-foreground">{cmd}</code>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0"
              onClick={() => copy(cmd)}
              title="Copy"
            >
              {copied === cmd ? (
                <CheckIcon className="size-3 text-green-500" />
              ) : (
                <CopyIcon className="size-3" />
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
