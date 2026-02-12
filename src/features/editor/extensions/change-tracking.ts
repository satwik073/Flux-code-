import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { diffLines } from "diff";

function countLines(s: string): number {
  if (!s) return 0;
  const matches = s.match(/\n/g);
  return (matches?.length ?? 0) + (s.endsWith("\n") ? 0 : 1);
}

function diffToLineDecorations(baseline: string, current: string): { added: number[]; modified: number[] } {
  const changes = diffLines(baseline, current);
  const added: number[] = [];
  const modified: number[] = [];
  let currentLine = 0;
  let afterRemoved = false;
  for (const c of changes) {
    const val = c.value as string;
    const n = countLines(val);
    if (c.added) {
      for (let i = 0; i < n; i++) {
        (afterRemoved ? modified : added).push(currentLine + i);
      }
      currentLine += n;
      afterRemoved = false;
    } else if (c.removed) {
      afterRemoved = true;
    } else {
      currentLine += n;
      afterRemoved = false;
    }
  }
  return { added, modified };
}

/** Line indices in baseline that are removed (not in current). For left pane. */
export function diffToLeftRemoved(baseline: string, current: string): number[] {
  const changes = diffLines(baseline, current);
  const leftRemoved: number[] = [];
  let leftLine = 0;
  for (const c of changes) {
    const val = c.value as string;
    const n = countLines(val);
    if (c.removed) {
      for (let i = 0; i < n; i++) leftRemoved.push(leftLine + i);
      leftLine += n;
    } else if (!c.added) {
      leftLine += n;
    }
  }
  return leftRemoved;
}

const lineAddedDecoration = Decoration.line({
  attributes: { class: "cm-line-added" },
});
const lineModifiedDecoration = Decoration.line({
  attributes: { class: "cm-line-modified" },
});
const lineRemovedDecoration = Decoration.line({
  attributes: { class: "cm-line-removed" },
});

export function changeTracking(baseline: string) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(readonly view: EditorView) {
        this.decorations = this.buildDecorations(view.state.doc.toString(), baseline);
      }

      update(update: ViewUpdate) {
        if (!update.docChanged) return;
        const current = update.state.doc.toString();
        this.decorations = this.buildDecorations(current, baseline);
      }

      buildDecorations(current: string, base: string): DecorationSet {
        if (base === current) return Decoration.none;
        const { added, modified } = diffToLineDecorations(base, current);
        const decos: ReturnType<Decoration["range"]>[] = [];
        const doc = this.view.state.doc;
        for (const lineIndex of added) {
          const line = doc.line(lineIndex + 1);
          if (line) decos.push(lineAddedDecoration.range(line.from));
        }
        for (const lineIndex of modified) {
          const line = doc.line(lineIndex + 1);
          if (line) decos.push(lineModifiedDecoration.range(line.from));
        }
        return Decoration.set(decos.sort((a, b) => a.from - b.from));
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
}

/** Marks removed lines in the left (baseline) pane. Pass the current (right) content. */
export function removedLineTracking(current: string) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(readonly view: EditorView) {
        const base = this.view.state.doc.toString();
        this.decorations = this.buildDecorations(base, current);
      }

      update(update: ViewUpdate) {
        if (!update.docChanged) return;
        const base = update.state.doc.toString();
        this.decorations = this.buildDecorations(base, current);
      }

      buildDecorations(base: string, cur: string): DecorationSet {
        if (base === cur) return Decoration.none;
        const removed = diffToLeftRemoved(base, cur);
        const doc = this.view.state.doc;
        const decos = removed
          .map((lineIndex) => doc.line(lineIndex + 1))
          .filter(Boolean)
          .map((line) => lineRemovedDecoration.range(line.from));
        return Decoration.set(decos.sort((a, b) => a.from - b.from));
      }
    },
    { decorations: (v) => v.decorations }
  );
}

export const changeTrackingTheme = EditorView.baseTheme({
  ".cm-line-added": {
    backgroundColor: "rgba(34, 197, 94, 0.18)",
  },
  ".cm-line-modified": {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  ".cm-line-removed": {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
  },
});
