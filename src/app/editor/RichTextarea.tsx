'use client';

import * as React from 'react';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Underline } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  isTextAlign,
  normalizeRichTextDocument,
  richTextDocumentToPlainText,
  type RichTextDocument,
  type RichTextLine,
  type RichTextRun,
  type TextAlign,
} from './text-format';

export interface RichTextareaSelectionState {
  active: boolean;
  bold: boolean;
  underline: boolean;
  align: TextAlign;
}

export interface RichTextareaHandle {
  focus: () => void;
  applyBold: () => void;
  applyUnderline: () => void;
  applyAlignment: (align: TextAlign) => void;
  getSelectionState: () => RichTextareaSelectionState;
}

interface RichTextareaProps {
  value: string;
  richDocument?: RichTextDocument;
  onChange: (value: string, document: RichTextDocument) => void;
  onFocus?: React.FocusEventHandler<HTMLDivElement>;
  onSelectionStateChange?: (state: RichTextareaSelectionState) => void;
  align?: TextAlign;
  onAlignChange?: (align: TextAlign) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
  textareaClassName?: string;
  toolbarClassName?: string;
  showToolbar?: boolean;
  id?: string;
}

const ALIGNMENTS: {
  value: TextAlign;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: 'left', label: 'Align left', icon: AlignLeft },
  { value: 'center', label: 'Align center', icon: AlignCenter },
  { value: 'right', label: 'Align right', icon: AlignRight },
  { value: 'justify', label: 'Justify', icon: AlignJustify },
];

const savedRanges = new WeakMap<HTMLElement, Range>();

const pushRun = (runs: RichTextRun[], text: string, bold: boolean, underline: boolean) => {
  const normalized = text.replace(/\u00a0/g, ' ').replace(/\u200b/g, '');
  if (!normalized) return;

  const previous = runs[runs.length - 1];
  if (previous && previous.bold === bold && previous.underline === underline) {
    previous.text += normalized;
    return;
  }

  runs.push({
    text: normalized,
    ...(bold ? { bold: true } : {}),
    ...(underline ? { underline: true } : {}),
  });
};

const readFontWeight = (element: HTMLElement): number => {
  try {
    const weightText = window.getComputedStyle(element).fontWeight ?? '';
    const numericWeight = Number.parseInt(weightText, 10);
    if (!Number.isNaN(numericWeight)) return numericWeight;
    return weightText === 'bold' || weightText === 'bolder' ? 700 : 400;
  } catch {
    return 400;
  }
};

const collectRuns = (
  node: Node,
  runs: RichTextRun[],
  inheritedBold = false,
  inheritedUnderline = false,
  baseWeight = 400
) => {
  if (node.nodeType === Node.TEXT_NODE) {
    pushRun(runs, node.textContent ?? '', inheritedBold, inheritedUnderline);
    return;
  }

  if (!(node instanceof HTMLElement)) return;

  if (node.tagName === 'BR') {
    pushRun(runs, '\n', inheritedBold, inheritedUnderline);
    return;
  }

  const computed = window.getComputedStyle(node);
  const weightText = computed.fontWeight ?? '';
  const numericWeight = Number.parseInt(weightText, 10);
  const computedWeight = Number.isNaN(numericWeight)
    ? weightText === 'bold' || weightText === 'bolder'
      ? 700
      : 400
    : numericWeight;
  // Bold is relative to the editor's own base weight: a semibold (600) stem is
  // the normal appearance of that field, so only a heavier run counts as bold.
  // A lighter run cancels an inherited bold.
  const explicitlyNotBold = computedWeight < baseWeight;
  const bold = explicitlyNotBold
    ? false
    : inheritedBold ||
      node.tagName === 'B' ||
      node.tagName === 'STRONG' ||
      computedWeight > baseWeight;

  const decorationLine = computed.textDecorationLine ?? '';
  const decorationText = computed.textDecoration ?? '';
  const decoration = `${decorationLine} ${decorationText}`;
  // "text-decoration: none" cancels an inherited underline (how the browser
  // records an underline that was just switched off).
  const explicitlyNotUnderlined = decorationLine === 'none' && !decorationText.includes('underline');
  const underline = explicitlyNotUnderlined
    ? false
    : inheritedUnderline ||
      node.tagName === 'U' ||
      node.tagName === 'INS' ||
      decoration.includes('underline');

  Array.from(node.childNodes).forEach((child) => collectRuns(child, runs, bold, underline, baseWeight));
};

const parseLine = (element: HTMLElement, fallbackAlign: TextAlign, baseWeight: number): RichTextLine => {
  const runs: RichTextRun[] = [];
  Array.from(element.childNodes).forEach((child) => collectRuns(child, runs, false, false, baseWeight));

  const onlyLineBreaks = runs.length > 0 && runs.every((run) => /^\n+$/.test(run.text));
  const explicitAlign = element.dataset.richAlign;
  let inheritedAlign: string = element.style.textAlign || '';
  if (!inheritedAlign) {
    try {
      inheritedAlign = window.getComputedStyle(element).textAlign;
    } catch {
      inheritedAlign = '';
    }
  }
  if (inheritedAlign === 'start') inheritedAlign = 'left';
  if (inheritedAlign === 'end') inheritedAlign = 'right';

  return {
    ...(isTextAlign(explicitAlign)
      ? { align: explicitAlign }
      : isTextAlign(inheritedAlign) && inheritedAlign !== fallbackAlign
        ? { align: inheritedAlign }
        : {}),
    runs: onlyLineBreaks ? [] : runs,
  };
};

const parseEditorDocument = (editor: HTMLElement, fallbackAlign: TextAlign): RichTextDocument => {
  const lines: RichTextLine[] = [];
  let pendingRuns: RichTextRun[] = [];
  const baseWeight = readFontWeight(editor);

  const flushPending = () => {
    if (pendingRuns.length === 0) return;
    lines.push({ runs: pendingRuns });
    pendingRuns = [];
  };

  Array.from(editor.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      collectRuns(node, pendingRuns, false, false, baseWeight);
      return;
    }

    if (!(node instanceof HTMLElement)) return;

    if (node.tagName === 'BR') {
      flushPending();
      lines.push({ runs: [] });
      return;
    }

    if (node.tagName === 'DIV' || node.tagName === 'P' || node.tagName === 'LI' || node.tagName === 'SECTION') {
      flushPending();
      lines.push(parseLine(node, fallbackAlign, baseWeight));
      return;
    }

    collectRuns(node, pendingRuns, false, false, baseWeight);
  });

  flushPending();
  if (lines.length === 0) lines.push({ runs: [] });

  return { lines };
};

const getTopLevelLine = (editor: HTMLElement, node: Node | null): HTMLElement | null => {
  if (!node) return null;
  let element = node instanceof HTMLElement ? node : node.parentElement;
  while (element && element.parentElement && element.parentElement !== editor) {
    element = element.parentElement;
  }
  if (element && element.parentElement === editor) return element;
  if (element === editor) {
    const children = Array.from(editor.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement
    );
    if (children.length > 0) return children[0];
  }
  return null;
};

const getSelectedLines = (editor: HTMLElement): HTMLElement[] => {
  const selection = window.getSelection();
  if (
    !selection ||
    selection.rangeCount === 0 ||
    !editor.contains(selection.anchorNode) ||
    !editor.contains(selection.focusNode)
  ) {
    return [];
  }

  const lines = Array.from(editor.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement
  );

  const start = getTopLevelLine(editor, selection.anchorNode);
  const end = getTopLevelLine(editor, selection.focusNode);
  if (!start || !end) return lines.length > 0 ? lines : [];

  const startIndex = lines.indexOf(start);
  const endIndex = lines.indexOf(end);
  if (startIndex === -1 || endIndex === -1) return [];

  return lines.slice(Math.min(startIndex, endIndex), Math.max(startIndex, endIndex) + 1);
};

const renderDocument = (
  editor: HTMLElement,
  document: RichTextDocument,
  fallbackAlign: TextAlign
) => {
  editor.replaceChildren();

  document.lines.forEach((line) => {
    const lineElement = window.document.createElement('div');
    lineElement.dataset.richLine = 'true';
    if (line.align) lineElement.dataset.richAlign = line.align;
    lineElement.style.textAlign = line.align ?? fallbackAlign;
    lineElement.style.whiteSpace = 'pre-wrap';

    line.runs.forEach((run) => {
      const runElement = window.document.createElement('span');
      runElement.textContent = run.text;
      if (run.bold) runElement.style.fontWeight = '700';
      if (run.underline) {
        runElement.style.textDecoration = 'underline';
        runElement.style.textDecorationSkipInk = 'none';
        runElement.style.textUnderlineOffset = '2px';
      }
      runElement.style.whiteSpace = 'pre-wrap';
      lineElement.appendChild(runElement);
    });

    if (line.runs.length === 0) {
      lineElement.appendChild(window.document.createElement('br'));
    }

    editor.appendChild(lineElement);
  });
};

export const insertTextIntoRichTextarea = (element: HTMLElement, text: string): boolean => {
  if (!element.isContentEditable) return false;

  const previousRange = savedRanges.get(element);
  element.focus({ preventScroll: true });
  let range =
    previousRange && element.contains(previousRange.commonAncestorContainer)
      ? previousRange
      : savedRanges.get(element);

  if (!range || !element.contains(range.commonAncestorContainer)) {
    range = window.document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
  }

  range.deleteContents();
  const textNode = window.document.createTextNode(text);
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.collapse(true);

  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
    selection.addRange(range);
  }

  savedRanges.set(element, range.cloneRange());
  element.dispatchEvent(
    new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text })
  );
  return true;
};

const RichTextarea = React.forwardRef<RichTextareaHandle, RichTextareaProps>(
  (
    {
      value,
      richDocument,
      onChange,
      onFocus,
      onSelectionStateChange,
      align = 'left',
      onAlignChange,
      rows = 2,
      placeholder,
      className,
      textareaClassName,
      toolbarClassName,
      showToolbar = true,
      id,
    },
    ref
  ) => {
    const editorRef = React.useRef<HTMLDivElement>(null);
    const lastDocumentRef = React.useRef<string | null>(null);
    const selectionStateRef = React.useRef<RichTextareaSelectionState>({
      active: false,
      align,
      bold: false,
      underline: false,
    });
    const selectionStateChangeRef = React.useRef(onSelectionStateChange);
    selectionStateChangeRef.current = onSelectionStateChange;
    const [selectionState, setSelectionState] = React.useState<RichTextareaSelectionState>(
      selectionStateRef.current
    );

    const publishSelectionState = React.useCallback((state: RichTextareaSelectionState) => {
      const previous = selectionStateRef.current;
      if (
        previous.active === state.active &&
        previous.bold === state.bold &&
        previous.underline === state.underline &&
        previous.align === state.align
      ) {
        return;
      }
      selectionStateRef.current = state;
      setSelectionState(state);
      selectionStateChangeRef.current?.(state);
    }, []);

    const sourceDocument = React.useMemo(
      () => normalizeRichTextDocument(richDocument, value),
      [richDocument, value]
    );
    const documentKey = JSON.stringify(sourceDocument);

    const rememberSelection = React.useCallback(() => {
      const editor = editorRef.current;
      const selection = window.getSelection();
      if (
        !editor ||
        !selection ||
        selection.rangeCount === 0 ||
        !editor.contains(selection.anchorNode) ||
        !editor.contains(selection.focusNode)
      ) {
        return;
      }
      savedRanges.set(editor, selection.getRangeAt(0).cloneRange());
    }, []);

    const restoreSelection = React.useCallback(() => {
      const editor = editorRef.current;
      if (!editor) return false;

      const saved = savedRanges.get(editor);
      if (!saved || !editor.contains(saved.commonAncestorContainer)) return false;

      const selection = window.getSelection();
      const alreadyInside =
        selection &&
        selection.rangeCount > 0 &&
        editor.contains(selection.anchorNode) &&
        editor.contains(selection.focusNode);
      if (alreadyInside) return true;

      editor.focus({ preventScroll: true });
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(saved);
      }
      savedRanges.set(editor, saved.cloneRange());
      return true;
    }, []);

    const refreshSelectionState = React.useCallback(() => {
      const editor = editorRef.current;
      const selection = window.getSelection();

      if (
        !editor ||
        !selection ||
        selection.rangeCount === 0 ||
        !editor.contains(selection.anchorNode) ||
        !editor.contains(selection.focusNode)
      ) {
        publishSelectionState({ ...selectionStateRef.current, active: false });
        return;
      }

      rememberSelection();
      const line = getTopLevelLine(editor, selection.anchorNode);
      const explicitAlign = line?.dataset.richAlign;
      const computedAlign = line ? window.getComputedStyle(line).textAlign : '';
      const selectedAlign = isTextAlign(explicitAlign)
        ? explicitAlign
        : isTextAlign(computedAlign)
          ? computedAlign
          : align;

      let bold = false;
      let underline = false;
      const anchor = selection.anchorNode;
      const anchorElement = anchor instanceof HTMLElement ? anchor : anchor?.parentElement;
      if (anchorElement) {
        try {
          const computed = window.getComputedStyle(anchorElement);
          const weightText = computed.fontWeight ?? '';
          const numericWeight = Number.parseInt(weightText, 10);
          const computedWeight = Number.isNaN(numericWeight)
            ? weightText === 'bold' || weightText === 'bolder'
              ? 700
              : 400
            : numericWeight;
          bold = computedWeight > readFontWeight(editor);
          const decorationLine = computed.textDecorationLine ?? '';
          const decorationText = computed.textDecoration ?? '';
          underline =
            decorationLine.includes('underline') || decorationText.includes('underline');
        } catch {
          bold = false;
          underline = false;
        }
      }

      publishSelectionState({
        active: true,
        align: selectedAlign,
        bold,
        underline,
      });
    }, [align, publishSelectionState, rememberSelection]);

    React.useEffect(() => {
      refreshSelectionState();
    }, [refreshSelectionState]);

    React.useEffect(() => {
      const editor = editorRef.current;
      if (!editor) return;

      if (lastDocumentRef.current === documentKey && editor.childElementCount > 0) {
        Array.from(editor.children).forEach((child) => {
          if (child instanceof HTMLElement && !child.dataset.richAlign) {
            child.style.textAlign = align;
          }
        });
        return;
      }

      lastDocumentRef.current = documentKey;
      renderDocument(editor, sourceDocument, align);
    }, [align, documentKey, sourceDocument]);

    React.useEffect(() => {
      const handleSelectionChange = () => refreshSelectionState();
      window.document.addEventListener('selectionchange', handleSelectionChange);
      return () => window.document.removeEventListener('selectionchange', handleSelectionChange);
    }, [refreshSelectionState]);

    const emitChange = React.useCallback(() => {
      const editor = editorRef.current;
      if (!editor) return;

      const parsed = parseEditorDocument(editor, align);
      const normalized = normalizeRichTextDocument(parsed);
      lastDocumentRef.current = JSON.stringify(normalized);
      onChange(richTextDocumentToPlainText(normalized), normalized);
    }, [align, onChange]);

    const handleInput = () => {
      rememberSelection();
      emitChange();
    };

    const applyCommand = React.useCallback(
      (command: 'bold' | 'underline') => {
        const editor = editorRef.current;
        if (!editor) return;

        restoreSelection();
        editor.focus({ preventScroll: true });

        // Chromium treats a semibold (600) base as "already bold", so the bold
        // command would only ever remove formatting. Neutralise the base weight
        // while the command runs and restore it afterwards.
        const baseWeight = editor.style.fontWeight;
        editor.style.fontWeight = '400';

        try {
          window.document.execCommand('styleWithCSS', false, 'false');
          window.document.execCommand(command);
        } catch {
          editor.style.fontWeight = baseWeight;
          return;
        }

        editor.style.fontWeight = baseWeight;

        if (command === 'bold') {
          // The browser keeps an inline "font-weight: normal" when bold is
          // removed; dropping it lets the text fall back to the base weight.
          editor.querySelectorAll<HTMLElement>('[style*="font-weight"]').forEach((element) => {
            const weight = element.style.fontWeight;
            if (weight === 'normal' || weight === '400') element.style.removeProperty('font-weight');
          });
        }

        emitChange();
        refreshSelectionState();
      },
      [emitChange, refreshSelectionState, restoreSelection]
    );

    const applyAlignment = React.useCallback(
      (alignment: TextAlign) => {
        const editor = editorRef.current;
        if (!editor) return;

        restoreSelection();
        const selection = window.getSelection();
        const selectedLines = getSelectedLines(editor);

        if (selectedLines.length === 0) {
          onAlignChange?.(alignment);
          return;
        }

        selectedLines.forEach((line) => {
          line.dataset.richAlign = alignment;
          line.style.textAlign = alignment;
        });
        emitChange();
        publishSelectionState({ ...selectionStateRef.current, align: alignment });
      },
      [emitChange, onAlignChange, publishSelectionState, restoreSelection]
    );

    React.useImperativeHandle(
      ref,
      () => ({
        focus: () => editorRef.current?.focus({ preventScroll: true }),
        applyBold: () => applyCommand('bold'),
        applyUnderline: () => applyCommand('underline'),
        applyAlignment: (alignment: TextAlign) => applyAlignment(alignment),
        getSelectionState: () => selectionStateRef.current,
      }),
      [applyAlignment, applyCommand]
    );

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!(event.ctrlKey || event.metaKey)) return;

      const key = event.key.toLowerCase();
      if (key === 'b') {
        event.preventDefault();
        applyCommand('bold');
      } else if (key === 'u') {
        event.preventDefault();
        applyCommand('underline');
      }
    };

    const activeAlign = selectionState.align;

    return (
      <div className={cn('space-y-1', className)}>
        {showToolbar && (
          <div className={cn('flex items-center gap-0.5', toolbarClassName)}>
            <Button
              type="button"
              variant={selectionState.bold ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              title="Bold (Ctrl+B)"
              aria-label="Bold"
              aria-pressed={selectionState.bold}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyCommand('bold')}
            >
              <Bold className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant={selectionState.underline ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              title="Underline (Ctrl+U)"
              aria-label="Underline"
              aria-pressed={selectionState.underline}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyCommand('underline')}
            >
              <Underline className="size-3.5" />
            </Button>
            <span className="mx-1 h-4 w-px bg-border" aria-hidden />
            {ALIGNMENTS.map(({ value: alignment, label, icon: Icon }) => (
              <Button
                key={alignment}
                type="button"
                variant={activeAlign === alignment ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                title={label}
                aria-label={label}
                aria-pressed={activeAlign === alignment}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyAlignment(alignment)}
              >
                <Icon className="size-3.5" />
              </Button>
            ))}
          </div>
        )}
        <div className="relative">
          {value.length === 0 && placeholder && (
            <span className="pointer-events-none absolute left-3 top-2 text-base text-muted-foreground md:text-sm">
              {placeholder}
            </span>
          )}
          <div
            ref={editorRef}
            id={id}
            role="textbox"
            aria-multiline="true"
            aria-placeholder={placeholder}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onFocus={(event) => {
              rememberSelection();
              onFocus?.(event);
            }}
            onBlur={rememberSelection}
            onKeyDown={handleKeyDown}
            onKeyUp={rememberSelection}
            onMouseDown={rememberSelection}
            onMouseUp={rememberSelection}
            onTouchEnd={rememberSelection}
            className={cn(
              'rich-editor w-full whitespace-pre-wrap break-words rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm',
              textareaClassName
            )}
            style={{
              minHeight: `${Math.max(80, Math.max(rows, 1) * 24)}px`,
              textAlign: align,
              whiteSpace: 'pre-wrap',
            }}
          />
        </div>
      </div>
    );
  }
);

RichTextarea.displayName = 'RichTextarea';

export default RichTextarea;
