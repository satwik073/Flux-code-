import { useEffect } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

import { useFile } from "@/features/projects/hooks/use-files";

import { useEditor } from "../hooks/use-editor";
import { Id } from "../../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { FileIcon } from "@react-symbols/icons/utils";
import { XIcon } from "lucide-react";

const Tab = ({
  fileId,
  isFirst,
  projectId,
}: {
  fileId: Id<"files">;
  isFirst: boolean;
  projectId: Id<"projects">;
}) => {
  const file = useFile(fileId);
  const {
    activeTabId,
    previewTabId,
    diffModeFileIds,
    setActiveTab,
    openFile,
    closeTab,
  } = useEditor(projectId);
  const isDiffTab = diffModeFileIds.has(fileId);

  // Close tab when file was deleted (getFile returns null)
  useEffect(() => {
    if (file === null) {
      closeTab(fileId);
    }
  }, [file, fileId, closeTab]);

  const isActive = activeTabId === fileId;
  const isPreview = previewTabId === fileId;
  const fileName = file?.name ?? "Loading...";

  return (
    <div
      onClick={() => setActiveTab(fileId)}
      onDoubleClick={() => openFile(fileId, { pinned: true })}
      className={cn(
        "flex items-center gap-2 h-8.75 pl-2 pr-1.5 cursor-pointer text-muted-foreground group border-y border-x border-transparent hover:bg-accent/30",
        isActive &&
          "bg-background text-foreground border-x-border border-b-background -mb-px drop-shadow",
        isFirst && "border-l-transparent!"
      )}
    >
      {file === undefined ? (
        <Spinner className="text-ring" />
      ) : (
        <FileIcon fileName={fileName} autoAssign className="size-4" />
      )}
      <span className={cn(
        "text-sm whitespace-nowrap",
        isPreview && "italic"
      )}>
        {fileName}
        {isDiffTab && (
          <span className="text-muted-foreground ml-1">(Staged)</span>
        )}
      </span>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          closeTab(fileId);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            closeTab(fileId);
          }
        }}
        className={cn(
          "p-0.5 rounded-sm hover:bg-white/10 opacity-0 group-hover:opacity-100",
          isActive && "opacity-100"
        )}
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  );
};

export const TopNavigation = ({
  projectId,
}: {
  projectId: Id<"projects">;
}) => {
  const { openTabs, closeTab, closeAllTabs, activeTabId } = useEditor(projectId);

  return (
    <ScrollArea className="flex-1">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <nav className="bg-sidebar flex items-center h-8.75 border-b min-w-0">
            {openTabs.length === 0 ? (
              <span className="text-xs text-muted-foreground px-3">
                Open a file from the explorer
              </span>
            ) : (
              openTabs.map((fileId, index) => (
                <Tab
                  key={fileId}
                  fileId={fileId}
                  isFirst={index === 0}
                  projectId={projectId}
                />
              ))
            )}
          </nav>
        </ContextMenuTrigger>
        <ContextMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
          {openTabs.length > 1 && (
            <>
              <ContextMenuItem
                className="text-sm"
                onClick={() => {
                  if (activeTabId == null) return;
                  openTabs.forEach((id) => {
                    if (id !== activeTabId) closeTab(id);
                  });
                }}
              >
                Close others
              </ContextMenuItem>
              <ContextMenuItem
                className="text-sm"
                onClick={() => closeAllTabs()}
              >
                Close all
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};
