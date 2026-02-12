"use client";

import { useEffect, useMemo, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { oneDark } from "@codemirror/theme-one-dark";

import { customTheme } from "../extensions/theme";
import { getLanguageExtension } from "../extensions/language-extension";
import {
  changeTracking,
  changeTrackingTheme,
  removedLineTracking,
} from "../extensions/change-tracking";

interface DiffViewProps {
  fileName: string;
  /** Left pane: baseline (e.g. last committed). */
  baseline: string;
  /** Right pane: current content (e.g. staged). */
  current: string;
}

/** Read-only two-pane diff: left = baseline, right = current. */
export function DiffView({ fileName, baseline, current }: DiffViewProps) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const leftViewRef = useRef<EditorView | null>(null);
  const rightViewRef = useRef<EditorView | null>(null);

  const languageExtension = useMemo(
    () => getLanguageExtension(fileName),
    [fileName]
  );

  useEffect(() => {
    if (!leftRef.current || !rightRef.current) return;

    const leftExtensions = [
      oneDark,
      customTheme,
      changeTrackingTheme,
      lineNumbers(),
      languageExtension,
      removedLineTracking(current),
      EditorView.editable.of(false),
    ];

    const rightExtensions = [
      oneDark,
      customTheme,
      changeTrackingTheme,
      lineNumbers(),
      languageExtension,
      changeTracking(baseline),
      EditorView.editable.of(false),
    ];

    const leftState = EditorState.create({
      doc: baseline,
      extensions: leftExtensions,
    });
    const rightState = EditorState.create({
      doc: current,
      extensions: rightExtensions,
    });

    const leftView = new EditorView({
      state: leftState,
      parent: leftRef.current,
    });
    const rightView = new EditorView({
      state: rightState,
      parent: rightRef.current,
    });

    leftViewRef.current = leftView;
    rightViewRef.current = rightView;

    return () => {
      leftView.destroy();
      rightView.destroy();
      leftViewRef.current = null;
      rightViewRef.current = null;
    };
  }, [baseline, current, languageExtension]);

  return (
    <div className="flex size-full border-t border-border">
      <div className="flex-1 min-w-0 flex flex-col border-r border-border">
        <div className="shrink-0 px-2 py-1 text-xs text-muted-foreground border-b border-border bg-sidebar/50">
          Original (baseline)
        </div>
        <div ref={leftRef} className="flex-1 min-h-0 pl-4 bg-background" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="shrink-0 px-2 py-1 text-xs text-muted-foreground border-b border-border bg-sidebar/50">
          Staged
        </div>
        <div ref={rightRef} className="flex-1 min-h-0 pl-4 bg-background" />
      </div>
    </div>
  );
}
