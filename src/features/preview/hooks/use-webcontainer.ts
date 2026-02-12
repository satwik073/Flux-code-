import { useCallback, useEffect, useRef, useState } from "react";
import { WebContainer, type WebContainerProcess } from "@webcontainer/api";

import {
  buildFileTree,
  getFilePath,
  getProjectRoot,
} from "@/features/preview/utils/file-tree";
import { useFiles } from "@/features/projects/hooks/use-files";

import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

// Singleton WebContainer instance
let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

const getWebContainer = async (): Promise<WebContainer> => {
  if (webcontainerInstance) {
    return webcontainerInstance;
  }

  if (!bootPromise) {
    bootPromise = WebContainer.boot({ coep: "credentialless" });
  }

  webcontainerInstance = await bootPromise;
  return webcontainerInstance;
};

// Teardown only when truly needed (e.g. full reset). Restart reuses the same instance.
function teardownWebContainer() {
  if (webcontainerInstance) {
    webcontainerInstance.teardown();
    webcontainerInstance = null;
  }
  bootPromise = null;
}

export interface ShellStreams {
  input: WritableStream<string>;
  output: ReadableStream<string>;
}

interface UseWebContainerProps {
  projectId: Id<"projects">;
  enabled: boolean;
  settings?: {
    installCommand?: string;
    devCommand?: string;
  };
};

export const useWebContainer = ({
  projectId,
  enabled,
  settings,
}: UseWebContainerProps) => {
  const [status, setStatus] = useState<
    "idle" | "booting" | "installing" | "running" | "error"
  >("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restartKey, setRestartKey] = useState(0);
  const [terminalOutput, setTerminalOutput] = useState("");
  const [shellStreams, setShellStreams] = useState<ShellStreams | null>(null);

  const containerRef = useRef<WebContainer | null>(null);
  const devProcessRef = useRef<WebContainerProcess | null>(null);
  const shellProcessRef = useRef<WebContainerProcess | null>(null);
  const startingRef = useRef(false);

  // Fetch files from Convex (auto-updates on changes)
  const files = useFiles(projectId);

  // Boot/mount and run install + dev. Re-runs when restartKey changes (restart click).
  useEffect(() => {
    if (!enabled || !files || files.length === 0 || startingRef.current) {
      return;
    }

    startingRef.current = true;
    setStatus("booting");
    setError(null);
    setTerminalOutput("");

    const appendOutput = (data: string) => {
      setTerminalOutput((prev) => prev + data);
    };

    const start = async () => {
      try {
        const container = await getWebContainer();
        containerRef.current = container;

        const fileTree = buildFileTree(files);
        await container.mount(fileTree);

        container.on("server-ready", (_port, url) => {
          setPreviewUrl(url);
          setStatus("running");
        });

        setStatus("installing");

        const projectRoot = getProjectRoot(files);
        const spawnOpts = projectRoot && projectRoot !== "." ? { cwd: projectRoot } : undefined;
        const pkgPath = projectRoot && projectRoot !== "." ? `${projectRoot}/package.json` : "package.json";

        // Add npm overrides so WebContainer install resolves known ETARGET issues (e.g. @babel/plugin-transform-modules-systemjs@^7.29.0)
        try {
          const pkgJson = await container.fs.readFile(pkgPath, "utf-8");
          const pkg = JSON.parse(pkgJson) as Record<string, unknown>;
          const existing =
            typeof pkg.overrides === "object" && pkg.overrides !== null && !Array.isArray(pkg.overrides)
              ? (pkg.overrides as Record<string, string>)
              : {};
          pkg.overrides = {
            "@babel/plugin-transform-modules-systemjs": "7.28.5",
            ...existing,
          };
          await container.fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2));
        } catch {
          // No package.json or invalid JSON; proceed without overrides
        }

        // Run install/dev from directory that contains package.json (project root)
        const installCmd = settings?.installCommand || "npm install";
        const [installBin, ...installArgs] = installCmd.split(" ");
        appendOutput(`$ ${installCmd}${spawnOpts?.cwd ? ` (in ${projectRoot})` : ""}\n`);
        const installProcess = await container.spawn(installBin, installArgs, spawnOpts);
        installProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              appendOutput(data);
            },
          })
        );
        const installExitCode = await installProcess.exit;

        if (installExitCode !== 0) {
          throw new Error(
            `${installCmd} failed with code ${installExitCode}`
          );
        }

        // Next.js in WebContainer cannot load native SWC (addons disabled). Inject .babelrc so Next uses Babel instead.
        const babelRcPath = projectRoot && projectRoot !== "." ? `${projectRoot}/.babelrc` : ".babelrc";
        try {
          const pkgJson = await container.fs.readFile(pkgPath, "utf-8");
          const pkg = JSON.parse(pkgJson) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
          const hasNext = pkg.dependencies?.next ?? pkg.devDependencies?.next;
          if (hasNext) {
            try {
              await container.fs.readFile(babelRcPath, "utf-8");
            } catch {
              await container.fs.writeFile(babelRcPath, JSON.stringify({ presets: ["next/babel"] }));
              appendOutput("\n(Injected .babelrc so Next.js uses Babel in browser preview)\n");
            }
          }
        } catch {
          // Ignore: no package.json or parse error
        }

        const devCmd = settings?.devCommand || "npm run dev";
        const [devBin, ...devArgs] = devCmd.split(" ");
        appendOutput(`\n$ ${devCmd}\n`);
        const devProcess = await container.spawn(devBin, devArgs, spawnOpts);
        devProcessRef.current = devProcess;
        devProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              appendOutput(data);
            },
          })
        );

        // Spawn interactive shell so user can run npm, git, clear, etc.
        const projectRootForShell = projectRoot && projectRoot !== "." ? projectRoot : undefined;
        const shellProcess = await container.spawn("jsh", [], {
          terminal: { cols: 80, rows: 24 },
          ...(projectRootForShell && { cwd: projectRootForShell }),
        });
        shellProcessRef.current = shellProcess;
        setShellStreams({
          input: shellProcess.input,
          output: shellProcess.output,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isSwcFailure =
          /swc|Failed to download.*@next\/swc|swc-wasm-nodejs|swc-linux/i.test(msg);
        setError(
          isSwcFailure
            ? "Next.js SWC failed to download in the in-browser preview (known limitation). Try a Vite or Create React App project, or run this app locally with npm run dev."
            : msg
        );
        setStatus("error");
      } finally {
        startingRef.current = false;
      }
    };

    start();
  }, [
    enabled,
    files,
    restartKey,
    settings?.devCommand,
    settings?.installCommand,
  ]);

  // Sync file changes (hot-reload)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !files || status !== "running") return;

    const filesMap = new Map(files.map((f) => [f._id, f]));

    for (const file of files) {
      if (file.type !== "file" || file.storageId || !file.content) continue;

      const filePath = getFilePath(file, filesMap);
      container.fs.writeFile(filePath, file.content);
    }
  }, [files, status]);

  // Reset when disabled
  useEffect(() => {
    if (!enabled) {
      startingRef.current = false;
      setStatus("idle");
      setPreviewUrl(null);
      setError(null);
    }
  }, [enabled]);

  // Soft restart: kill dev and shell, then re-run mount + install + dev on same instance.
  const restart = useCallback(() => {
    devProcessRef.current?.kill();
    devProcessRef.current = null;
    shellProcessRef.current?.kill();
    shellProcessRef.current = null;
    setShellStreams(null);
    startingRef.current = false;
    setStatus("idle");
    setPreviewUrl(null);
    setError(null);
    setRestartKey((k) => k + 1);
  }, []);

  return {
    status,
    previewUrl,
    error,
    restart,
    terminalOutput,
    shellStreams,
  };
};
