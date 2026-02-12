"use client";

import { useState } from "react";
import { Allotment } from "allotment";
import {
  Loader2Icon,
  TerminalSquareIcon,
  AlertTriangleIcon,
  RefreshCwIcon,
  PackageIcon,
  GitBranchIcon,
} from "lucide-react";

import { useWebContainer } from "@/features/preview/hooks/use-webcontainer";
import { PreviewSettingsPopover } from "@/features/preview/components/preview-settings-popover";
import { PreviewTerminal } from "@/features/preview/components/preview-terminal";
import { GitPanel } from "@/features/preview/components/git-panel";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useProject } from "../hooks/use-projects";

import { Id } from "../../../../convex/_generated/dataModel";

type TerminalTab = "build" | "terminal" | "git";

export const PreviewView = ({ projectId }: { projectId: Id<"projects"> }) => {
  const project = useProject(projectId);
  const [showTerminal, setShowTerminal] = useState(true);
  const [terminalTab, setTerminalTab] = useState<TerminalTab>("build");

  const {
    status, previewUrl, error, restart, terminalOutput, shellStreams
  } = useWebContainer({
    projectId,
    enabled: true,
    settings: project?.settings,
  });

  const isLoading = status === "booting" || status === "installing";

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="h-8.75 flex items-center border-b bg-sidebar shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="h-full rounded-none"
          disabled={isLoading}
          onClick={restart}
          title="Restart container"
        >
          <RefreshCwIcon className="size-3" />
        </Button>

        <div className="flex-1 h-full flex items-center px-3 bg-background border-x text-xs text-muted-foreground truncate font-mono">
          {isLoading && (
            <div className="flex items-center gap-1.5">
              <Loader2Icon className="size-3 animate-spin" />
              {status === "booting" ? "Starting..." : "Installing..."}
            </div>
          )}
          {previewUrl && <span className="truncate">{previewUrl}</span>}
          {!isLoading && !previewUrl && !error && <span>Ready to preview</span>}
        </div>

        <Button
          size="sm"
          variant="ghost"
          className="h-full rounded-none"
          title="Toggle terminal"
          onClick={() => setShowTerminal((value) => !value)}
        >
          <TerminalSquareIcon className="size-3" />
        </Button>
        <PreviewSettingsPopover
          projectId={projectId}
          initialValues={project?.settings}
          onSave={restart}
        />
      </div>

      <div className="flex-1 min-h-0">
        <Allotment vertical>
          <Allotment.Pane>
            {error && (
              <div className="size-full flex items-center justify-center text-muted-foreground">
                <div className="flex flex-col items-center gap-2 max-w-md mx-auto text-center">
                  <AlertTriangleIcon className="size-6" />
                  <p className="text-sm font-medium">{error}</p>
                  <Button size="sm" variant="outline" onClick={restart}>
                    <RefreshCwIcon className="size-4" />
                    Restart
                  </Button>
                </div>
              </div>
            )}

            {isLoading && !error && (
              <div className="size-full flex items-center justify-center text-muted-foreground">
                <div className="flex flex-col items-center gap-2 max-w-md mx-auto text-center">
                  <Loader2Icon className="size-6 animate-spin" />
                  <p className="text-sm font-medium">Installing...</p>
                </div>
              </div>
            )}

            {previewUrl && (
              <iframe
                src={previewUrl}
                className="size-full border-0"
                title="Preview"
              />
            )}
          </Allotment.Pane>

          {showTerminal && (
            <Allotment.Pane minSize={100} maxSize={500} preferredSize={200}>
              <div className="h-full flex flex-col bg-background border-t">
                <div className="h-7 flex items-center border-b border-border/50 shrink-0">
                  <button
                    type="button"
                    onClick={() => setTerminalTab("build")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 h-full text-xs border-r border-border/50",
                      terminalTab === "build"
                        ? "bg-background text-foreground"
                        : "text-muted-foreground hover:bg-accent/30"
                    )}
                  >
                    <PackageIcon className="size-3" />
                    Build
                  </button>
                  <button
                    type="button"
                    onClick={() => setTerminalTab("terminal")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 h-full text-xs border-r border-border/50",
                      terminalTab === "terminal"
                        ? "bg-background text-foreground"
                        : "text-muted-foreground hover:bg-accent/30"
                    )}
                  >
                    <TerminalSquareIcon className="size-3" />
                    Terminal
                  </button>
                  <button
                    type="button"
                    onClick={() => setTerminalTab("git")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 h-full text-xs",
                      terminalTab === "git"
                        ? "bg-background text-foreground"
                        : "text-muted-foreground hover:bg-accent/30"
                    )}
                  >
                    <GitBranchIcon className="size-3" />
                    Git
                  </button>
                </div>
                {/* Build tab: read-only output. Terminal tab: interactive shell (keep mounted when shellStreams set so we never lock the stream twice). */}
                <div
                  className={cn(
                    "flex-1 min-h-0 flex flex-col",
                    terminalTab !== "build" && "hidden"
                  )}
                >
                  <PreviewTerminal output={terminalOutput} />
                </div>
                <div
                  className={cn(
                    "flex-1 min-h-0 flex flex-col",
                    terminalTab !== "terminal" && "hidden"
                  )}
                >
                  {!shellStreams ? (
                    <div className="p-3 text-xs text-muted-foreground">
                      Starting shell…
                    </div>
                  ) : (
                    <PreviewTerminal
                      shellStreams={shellStreams}
                      active={terminalTab === "terminal"}
                    />
                  )}
                </div>
                <div
                  className={cn(
                    "flex-1 min-h-0 flex flex-col overflow-hidden",
                    terminalTab !== "git" && "hidden"
                  )}
                >
                  <GitPanel />
                </div>
              </div>
            </Allotment.Pane>
          )}
        </Allotment>
      </div>
    </div>
  );
};
