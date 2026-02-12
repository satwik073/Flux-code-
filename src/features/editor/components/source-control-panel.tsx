"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { GitBranchIcon, PlusIcon, MinusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getFilePath } from "@/features/preview/utils/file-tree";
import { useFiles } from "@/features/projects/hooks/use-files";
import { useEditorStore } from "../store/use-editor-store";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

interface SourceControlPanelProps {
  projectId: Id<"projects">;
}

export function SourceControlPanel({ projectId }: SourceControlPanelProps) {
  const [commitMessage, setCommitMessage] = useState("");
  const [staged, setStaged] = useState<Set<Id<"files">>>(new Set());
  const files = useFiles(projectId);
  const baselines = useQuery(api.sourceControl.getBaselines, { projectId });
  const setBaselines = useMutation(api.sourceControl.setBaselines);
  const openFile = useEditorStore((s) => s.openFile);

  const filesMap = useMemo(
    () => (files ? new Map(files.map((f) => [f._id, f])) : new Map()),
    [files]
  );
  const baselineMap = useMemo(
    () =>
      baselines
        ? new Map(baselines.map((b) => [b.fileId, b.content]))
        : new Map(),
    [baselines]
  );

  const changes = useMemo(() => {
    if (!files) return [];
    return files.filter((file) => {
      if (file.type !== "file" || file.storageId) return false;
      const current = file.content ?? "";
      const base = baselineMap.get(file._id);
      if (base === undefined) return current !== ""; // new file
      return base !== current;
    });
  }, [files, baselineMap]);

  const stagedList = useMemo(
    () => changes.filter((f) => staged.has(f._id)),
    [changes, staged]
  );

  /** Changed files not yet staged — exclude staged from the "Changes" list. */
  const unstagedChanges = useMemo(
    () => changes.filter((f) => !staged.has(f._id)),
    [changes, staged]
  );

  const toggleStaged = (fileId: Id<"files">) => {
    setStaged((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const stageAll = () => {
    setStaged(new Set(changes.map((f) => f._id)));
  };

  const unstageAll = () => {
    setStaged(new Set());
  };

  const handleCommit = async () => {
    if (stagedList.length === 0) return;
    await setBaselines({
      projectId,
      updates: stagedList.map((f) => ({
        fileId: f._id,
        content: f.content ?? "",
      })),
    });
    setStaged(new Set());
    setCommitMessage("");
  };

  const status = (file: (typeof changes)[0]) => {
    const base = baselineMap.get(file._id);
    if (base === undefined) return "A";
    return "M";
  };

  return (
    <div className="h-full flex flex-col bg-sidebar text-sm">
      <div className="shrink-0 px-2 py-2 border-b flex items-center gap-2">
        <GitBranchIcon className="size-4" />
        <span className="font-medium">CHANGES</span>
      </div>
      <div className="shrink-0 px-2 py-1.5 border-b">
        <Input
          placeholder="Message (to commit...)"
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          className="h-7 text-xs"
        />
        <Button
          size="sm"
          className="w-full mt-1.5"
          disabled={stagedList.length === 0 || !commitMessage.trim()}
          onClick={handleCommit}
        >
          Commit
        </Button>
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        {stagedList.length > 0 && (
          <div className="shrink-0 px-2 py-1 border-b">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Staged Changes ({stagedList.length})
              </span>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={unstageAll}>
                Unstage all
              </Button>
            </div>
            <ScrollArea className="h-24 mt-1">
              {stagedList.map((file) => (
                <div
                  key={file._id}
                  className="flex items-center gap-1.5 py-0.5 px-1 rounded text-xs cursor-pointer hover:bg-accent/50"
                  onClick={() => openFile(file._id, { pinned: false, diff: true })}
                >
                  <span className="text-green-600 dark:text-green-400 w-4 shrink-0">
                    {status(file)}
                  </span>
                  <span className="truncate">
                    {getFilePath(file, filesMap)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-5 shrink-0 ml-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStaged(file._id);
                    }}
                    title="Unstage"
                  >
                    <MinusIcon className="size-3" />
                  </Button>
                </div>
              ))}
            </ScrollArea>
          </div>
        )}
        <div className="flex-1 min-h-0 flex flex-col px-2 py-1">
          <div className="flex items-center justify-between shrink-0">
            <span className="text-xs font-medium text-muted-foreground">
              Changes ({unstagedChanges.length})
            </span>
            {unstagedChanges.length > 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={stageAll}>
                Stage all
              </Button>
            )}
          </div>
          <ScrollArea className="flex-1 mt-1">
            {unstagedChanges.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No unstaged changes</p>
            ) : (
              unstagedChanges.map((file) => (
                <div
                  key={file._id}
                  className="flex items-center gap-1.5 py-0.5 px-1 rounded text-xs cursor-pointer hover:bg-accent/50"
                  onClick={() => openFile(file._id, { pinned: false })}
                >
                  <span className="text-muted-foreground w-4 shrink-0">
                    {status(file)}
                  </span>
                  <span className="truncate flex-1">
                    {getFilePath(file, filesMap)}
                  </span>
                  {!staged.has(file._id) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-5 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStaged(file._id);
                      }}
                      title="Stage"
                    >
                      <PlusIcon className="size-3" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
