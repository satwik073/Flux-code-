"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Allotment } from "allotment";
import {
  Loader2Icon,
  AlertTriangleIcon,
  FolderIcon,
  GitBranchIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EditorView } from "@/features/editor/components/editor-view";
import { GlobalSearchDialog } from "@/features/editor/components/global-search-dialog";
import { SourceControlPanel } from "@/features/editor/components/source-control-panel";

import { FileExplorer } from "./file-explorer";
import { Id } from "../../../../convex/_generated/dataModel";
import { PreviewView } from "./preview-view";
import { ExportPopover } from "./export-popover";
import { useProject } from "../hooks/use-projects";

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 800;
const DEFAULT_SIDEBAR_WIDTH = 350;
const DEFAULT_MAIN_SIZE = 1000;

const Tab = ({
  label,
  isActive,
  onClick
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 h-full px-3 cursor-pointer text-muted-foreground border-r hover:bg-accent/30",
        isActive && "bg-background text-foreground"
      )}
    >
      <span className="text-sm">{label}</span>
    </div>
  );
};

export const ProjectIdView = ({
  projectId,
}: {
  projectId: Id<"projects">;
}) => {
  const [activeView, setActiveView] = useState<"editor" | "preview">("editor");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"explorer" | "source-control">("explorer");
  const project = useProject(projectId);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (project?.importStatus === "importing") {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground bg-sidebar/30">
        <Loader2Icon className="size-10 animate-spin" />
        <p className="text-sm font-medium">Importing repository...</p>
        <p className="text-xs max-w-xs text-center">
          Files are being copied from GitHub. This may take a minute for large repos.
        </p>
      </div>
    );
  }

  if (project?.importStatus === "failed") {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground bg-sidebar/30 p-6">
        <AlertTriangleIcon className="size-10 text-destructive" />
        <p className="text-sm font-medium">Import failed</p>
        <p className="text-xs max-w-sm text-center">
          The repository could not be imported. Check that the URL is correct and the repo is public, or try again later.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <GlobalSearchDialog
        projectId={projectId}
        open={searchOpen}
        onOpenChange={setSearchOpen}
      />
      <nav className="h-8.75 flex items-center bg-sidebar border-b">
        <Tab
          label="Code"
          isActive={activeView === "editor"}
          onClick={() => setActiveView("editor")}
        />
        <Tab
          label="Preview"
          isActive={activeView === "preview"}
          onClick={() => setActiveView("preview")}
        />
        <div className="flex-1 flex justify-end h-full">
          <ExportPopover projectId={projectId} />
        </div>
      </nav>
      <div className="flex-1 relative">
        <div
          className={cn(
            "absolute inset-0",
            activeView === "editor" ? "visible" : "invisible"
          )}
        >
          <Allotment defaultSizes={[DEFAULT_SIDEBAR_WIDTH, DEFAULT_MAIN_SIZE]}>
            <Allotment.Pane
              snap
              minSize={MIN_SIDEBAR_WIDTH}
              maxSize={MAX_SIDEBAR_WIDTH}
              preferredSize={DEFAULT_SIDEBAR_WIDTH}
            >
              <div className="h-full flex flex-col bg-sidebar">
                <div className="shrink-0 flex border-b">
                  <button
                    type="button"
                    onClick={() => setSidebarTab("explorer")}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1.5 text-xs border-r",
                      sidebarTab === "explorer"
                        ? "bg-background text-foreground"
                        : "text-muted-foreground hover:bg-accent/30"
                    )}
                  >
                    <FolderIcon className="size-3.5" />
                    Explorer
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarTab("source-control")}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1.5 text-xs",
                      sidebarTab === "source-control"
                        ? "bg-background text-foreground"
                        : "text-muted-foreground hover:bg-accent/30"
                    )}
                  >
                    <GitBranchIcon className="size-3.5" />
                    Source Control
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  {sidebarTab === "explorer" ? (
                    <FileExplorer projectId={projectId} />
                  ) : (
                    <SourceControlPanel projectId={projectId} />
                  )}
                </div>
              </div>
            </Allotment.Pane>
            <Allotment.Pane>
              <EditorView projectId={projectId} />
            </Allotment.Pane>
          </Allotment>
        </div>
        <div
          className={cn(
            "absolute inset-0",
            activeView === "preview" ? "visible" : "invisible"
          )}
        >
          <PreviewView projectId={projectId} />
        </div>
      </div>
    </div>
  );
};
