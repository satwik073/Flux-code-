"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

import "@xterm/xterm/css/xterm.css";

import type { ShellStreams } from "../hooks/use-webcontainer";

interface PreviewTerminalProps {
  /** Read-only build output (install + dev server logs). */
  output?: string;
  /** When set, terminal is interactive: user can type (npm, git, clear, etc.). */
  shellStreams?: ShellStreams | null;
  /** When true, terminal pane is visible (focus and fit when switching to this tab). */
  active?: boolean;
}

export const PreviewTerminal = ({
  output = "",
  shellStreams,
  active = false,
}: PreviewTerminalProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastLengthRef = useRef(0);
  const isInteractive = !!shellStreams;

  useEffect(() => {
    if (!containerRef.current) return;
    if (terminalRef.current) {
      terminalRef.current.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    }

    const terminal = new Terminal({
      convertEol: true,
      disableStdin: !isInteractive,
      fontSize: 12,
      fontFamily: "monospace",
      theme: { background: "#1f2228" },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    if (!isInteractive && output) {
      terminal.write(output);
      lastLengthRef.current = output.length;
    }

    requestAnimationFrame(() => fitAddon.fit());

    const resizeObserver = new ResizeObserver(() => fitAddon.fit());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [isInteractive]);

  // Write new build output (read-only mode)
  useEffect(() => {
    if (!terminalRef.current || isInteractive) return;

    if (output.length < lastLengthRef.current) {
      terminalRef.current.clear();
      lastLengthRef.current = 0;
    }

    const newData = output.slice(lastLengthRef.current);
    if (newData) {
      terminalRef.current.write(newData);
      lastLengthRef.current = output.length;
    }
  }, [output, isInteractive]);

  // Connect interactive shell: pipe shell output → terminal, terminal input → shell.
  // Only attach once per stream (stream can only have one reader); parent keeps this mounted when switching tabs.
  useEffect(() => {
    if (!terminalRef.current || !shellStreams) return;
    // Avoid "stream already locked" if effect runs twice (e.g. Strict Mode)
    if (shellStreams.output.locked) return;

    const writer = shellStreams.input.getWriter();
    const reader = shellStreams.output.getReader();

    const onData = (data: string) => {
      writer.write(data).catch(() => {});
    };
    const dataDisposable = terminalRef.current.onData(onData);

    const read = () => {
      reader.read().then(({ done, value }) => {
        if (done) return;
        if (terminalRef.current && value) terminalRef.current.write(value);
        read();
      });
    };
    read();

    return () => {
      dataDisposable.dispose();
      reader.cancel();
      writer.releaseLock();
    };
  }, [shellStreams]);

  // When tab becomes visible: fit terminal size (container was hidden so had 0 size) and focus so user can type
  useEffect(() => {
    if (!active || !terminalRef.current || !fitAddonRef.current) return;
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    requestAnimationFrame(() => {
      fitAddon.fit();
      terminal.focus();
    });
  }, [active]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="flex-1 min-h-0 p-3 [&_.xterm]:h-full! [&_.xterm-viewport]:h-full! [&_.xterm-screen]:h-full! bg-sidebar outline-none"
      style={{ minHeight: 0 }}
    />
  );
};
