"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useFiles } from "@/features/projects/hooks/use-files";
import { getFilePath } from "@/features/preview/utils/file-tree";
import { useEditorStore } from "../store/use-editor-store";
import { Id } from "../../../../convex/_generated/dataModel";

interface SearchResult {
  fileId: Id<"files">;
  path: string;
  lineNumber: number;
  lineContent: string;
}

interface GlobalSearchDialogProps {
  projectId: Id<"projects">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearchDialog({
  projectId,
  open,
  onOpenChange,
}: GlobalSearchDialogProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const files = useFiles(projectId);
  const openFile = useEditorStore((s) => s.openFile);

  const filesMap = useMemo(
    () => (files ? new Map(files.map((f) => [f._id, f])) : new Map()),
    [files]
  );

  const results = useMemo((): SearchResult[] => {
    if (!files || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    const out: SearchResult[] = [];
    for (const file of files) {
      if (file.type !== "file" || file.storageId || file.content == null)
        continue;
      const path = getFilePath(file, filesMap);
      const lines = file.content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(q)) {
          out.push({
            fileId: file._id,
            path,
            lineNumber: i + 1,
            lineContent: lines[i].trim(),
          });
        }
      }
    }
    return out;
  }, [files, query, filesMap]);

  const selectResult = useCallback(
    (result: SearchResult) => {
      openFile(projectId, result.fileId, { pinned: true });
      onOpenChange(false);
      setQuery("");
      setSelectedIndex(0);
    },
    [projectId, openFile, onOpenChange]
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (selectedIndex >= results.length) setSelectedIndex(Math.max(0, results.length - 1));
  }, [results.length, selectedIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        selectResult(results[selectedIndex]);
      } else if (e.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, results, selectedIndex, selectResult, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-sm font-medium">
            Search in project (Cmd+Shift+F)
          </DialogTitle>
        </DialogHeader>
        <div className="px-4 pb-2">
          <Input
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="font-mono"
            autoFocus
          />
        </div>
        <div className="flex-1 min-h-0 overflow-auto border-t px-2 py-2">
          {results.length === 0 && query.trim() ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No results
            </p>
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Type to search across all files
            </p>
          ) : (
            <ul className="space-y-0.5">
              {results.map((r, i) => (
                <li key={`${r.fileId}-${r.lineNumber}-${i}`}>
                  <button
                    type="button"
                    onClick={() => selectResult(r)}
                    className={`w-full text-left px-2 py-1.5 rounded text-sm font-mono flex items-start gap-2 ${
                      i === selectedIndex ? "bg-accent" : "hover:bg-muted/50"
                    }`}
                  >
                    <span className="text-muted-foreground shrink-0 w-6">
                      {r.lineNumber}
                    </span>
                    <span className="truncate text-muted-foreground shrink-0 max-w-[200px]">
                      {r.path}
                    </span>
                    <span className="truncate flex-1">{r.lineContent}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
