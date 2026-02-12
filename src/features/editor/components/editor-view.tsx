import Image from "next/image";
import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "convex/react";

import { useFile, useUpdateFile } from "@/features/projects/hooks/use-files";
import { api } from "../../../../convex/_generated/api";

import { CodeEditor } from "./code-editor";
import { DiffView } from "./diff-view";
import { useEditor } from "../hooks/use-editor";
import { TopNavigation } from "./top-navigation";
import { FileBreadcrumbs } from "./file-breadcrumbs";
import { Id } from "../../../../convex/_generated/dataModel";
import { AlertTriangleIcon } from "lucide-react";

const DEBOUNCE_MS = 1500;

export const EditorView = ({ projectId }: { projectId: Id<"projects"> }) => {
  const { activeTabId, closeTab, diffModeFileIds } = useEditor(projectId);
  const activeFile = useFile(activeTabId);
  const isDiffMode = Boolean(
    activeTabId && diffModeFileIds.has(activeTabId)
  );
  const updateFile = useUpdateFile();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const baselines = useQuery(api.sourceControl.getBaselines, { projectId });
  const baselineMap = useMemo(
    () =>
      baselines
        ? new Map(baselines.map((b) => [b.fileId, b.content]))
        : new Map(),
    [baselines]
  );

  const isActiveFileBinary = activeFile && activeFile.storageId;
  const isActiveFileText = activeFile && !activeFile.storageId;

  // Clear stale tab when the file was deleted or doesn't exist (getFile returns null)
  useEffect(() => {
    if (activeTabId && activeFile === null) {
      closeTab(activeTabId);
    }
  }, [activeTabId, activeFile, closeTab]);

  // Cleanup pending debounced updates on unmount or file change
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [activeTabId]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center">
        <TopNavigation projectId={projectId} />
      </div>
      {activeTabId && <FileBreadcrumbs projectId={projectId} />}
      <div className="flex-1 min-h-0 bg-background">
        {!activeFile && (
          <div className="size-full flex items-center justify-center">
            <Image
              src="/logo-alt.svg"
              alt="Flux"
              width={50}
              height={50}
              className="opacity-25"
            />
          </div>
        )}
        {isActiveFileText && isDiffMode && (
          <DiffView
            key={activeFile._id}
            fileName={activeFile.name}
            baseline={baselineMap.get(activeFile._id) ?? ""}
            current={activeFile.content ?? ""}
          />
        )}
        {isActiveFileText && !isDiffMode && (
          <CodeEditor
            key={activeFile._id}
            fileName={activeFile.name}
            initialValue={activeFile.content}
            baseline={baselineMap.get(activeFile._id)}
            onChange={(content: string) => {
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
              }

              timeoutRef.current = setTimeout(() => {
                updateFile({ id: activeFile._id, content });
              }, DEBOUNCE_MS);
            }}
          />
        )}
        {isActiveFileBinary && (
          <div className="size-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-2.5 max-w-md text-center">
              <AlertTriangleIcon className="size-10 text-yellow-500" />
              <p className="text-sm">
                The file is not displayed in the text editor because it is either binary or uses an unsupported text encoding.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
