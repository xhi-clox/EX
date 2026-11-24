'use client';

import * as React from 'react';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Underline } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  fontSize?: number;
}

export interface RichTextareaHandle {
  focus: () => void;
  applyBold: () => void;
  applyUnderline: () => void;
  applyAlignment: (align: TextAlign) => void;
  applyFontSize: (fontSize: number) => void;
  getSelectionState: () => RichTextareaSelectionState;
}

interface RichTextToolbarProps {
  selectionState: RichTextareaSelectionState;
  onBold: () => void;
  onUnderline: () => void;
  onAlignment: (align: TextAlign) => void;
  onFontSize: (fontSize: number) => void;
}

interface RichTextareaProps {
  value: string;
  richDocument?: RichTextDocument;
  onChange: (value: string, document: RichTextDocument) => void;
  onFocus?: React.FocusEventHandler<HTMLDivElement>;
  onActivate?: (handle: RichTextareaHandle) => void;
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
  compositionField?: boolean;
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

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24];
const savedRanges = new WeakMap<HTMLElement, Range>();

const pushRun = (
  runs: RichTextRun[],
  text: string,
  bold: boolean,
  underline: boolean,
  fontSize?: number
) => {
  const normalized = text.replace(/\u00a0/g, ' ').replace(/\u200b/g, '');
  if (!normalized) return;

  const previous = runs[runs.length - 1];
  if (
    previous &&
    previous.bold === bold &&
    previous.underline === underline &&
    previous.fontSize === fontSize
  ) {
    previous.text += normalized;
    return;
  }

  runs.push({
    text: normalized,
    ...(bold ? { bold: true } : {}),
    ...(underline ? { underline: true } : {}),
    ...(fontSize ? { fontSize } : {}),
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
  baseWeight = 400,
  inheritedFontSize?: number,
  baseFontSize = 14
) => {
  if (node.nodeType === Node.TEXT_NODE) {
    pushRun(runs, node.textContent ?? '', inheritedBold, inheritedUnderline, inheritedFontSize);
    return;
  }

  if (!(node instanceof HTMLElement)) return;

  if (node.tagName === 'BR') {
    pushRun(runs, '\n', inheritedBold, inheritedUnderline, inheritedFontSize);
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

  const computedFontSize = Number.parseFloat(computed.fontSize);
  const fontSize = Number.isFinite(computedFontSize) && Math.abs(computedFontSize - baseFontSize) > 0.5
    ? Math.round(computedFontSize * 0.75 * 10) / 10
    : inheritedFontSize;

  Array.from(node.childNodes).forEach((child) =>
    collectRuns(child, runs, bold, underline, baseWeight, fontSize, baseFontSize)
  );
};

const parseLine = (
  element: HTMLElement,
  fallbackAlign: TextAlign,
  baseWeight: number,
  baseFontSize: number
): RichTextLine => {
  const runs: RichTextRun[] = [];
  Array.from(element.childNodes).forEach((child) =>
    collectRuns(child, runs, false, false, baseWeight, undefined, baseFontSize)
  );

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
  const baseFontSize = Number.parseFloat(window.getComputedStyle(editor).fontSize) || 14;

  const flushPending = () => {
    if (pendingRuns.length === 0) return;
    lines.push({ runs: pendingRuns });
    pendingRuns = [];
  };

  Array.from(editor.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      collectRuns(node, pendingRuns, false, false, baseWeight, undefined, baseFontSize);
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
      lines.push(parseLine(node, fallbackAlign, baseWeight, baseFontSize));
      return;
    }

    collectRuns(node, pendingRuns, false, false, baseWeight, undefined, baseFontSize);
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
      if (run.fontSize) runElement.style.fontSize = `${run.fontSize}pt`;
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

const applyFontSizeToRange = (editor: HTMLElement, range: Range, fontSize: number): Range | null => {
  const walker = window.document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  const selected: { node: Text; start: number; end: number }[] = [];
  let node = walker.nextNode();

  while (node) {
    if (node instanceof Text && range.intersectsNode(node)) {
      const start = node === range.startContainer ? range.startOffset : 0;
      const end = node === range.endContainer ? range.endOffset : node.length;
      if (end > start) selected.push({ node, start, end });
    }
    node = walker.nextNode();
  }

  let firstText: Text | null = null;
  let lastText: Text | null = null;
  for (const { node: textNode, start, end } of selected) {
    const selectedText = start > 0 ? textNode.splitText(start) : textNode;
    if (end - start < selectedText.length) selectedText.splitText(end - start);

    const span = window.document.createElement('span');
    span.style.fontSize = `${fontSize}pt`;
    selectedText.parentNode?.replaceChild(span, selectedText);
    span.appendChild(selectedText);
    if (!firstText) firstText = selectedText;
    lastText = selectedText;
  }

  if (!firstText || !lastText) return null;
  const updatedRange = window.document.createRange();
  updatedRange.setStart(firstText, 0);
  updatedRange.setEnd(lastText, lastText.length);
  return updatedRange;
};

export const RichTextToolbar = ({
  selectionState,
  onBold,
  onUnderline,
  onAlignment,
  onFontSize,
}: RichTextToolbarProps) => (
  <div data-rich-text-toolbar className="flex items-center gap-0.5">
    <Button
      type="button"
      variant={selectionState.bold ? 'secondary' : 'ghost'}
      size="icon"
      className="h-7 w-7"
      title="Bold (Ctrl+B)"
      aria-label="Bold"
      aria-pressed={selectionState.bold}
      disabled={!selectionState.active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onBold}
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
      disabled={!selectionState.active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onUnderline}
    >
      <Underline className="size-3.5" />
    </Button>
    <span className="mx-1 h-4 w-px bg-border" aria-hidden />
    {ALIGNMENTS.map(({ value: alignment, label, icon: Icon }) => (
      <Button
        key={alignment}
        type="button"
        variant={selectionState.align === alignment ? 'secondary' : 'ghost'}
        size="icon"
        className="h-7 w-7"
        title={label}
        aria-label={label}
        aria-pressed={selectionState.align === alignment}
        disabled={!selectionState.active}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onAlignment(alignment)}
      >
        <Icon className="size-3.5" />
      </Button>
    ))}
    <span className="mx-1 h-4 w-px bg-border" aria-hidden />
    <Select
      value={String(selectionState.fontSize ?? 12)}
      onValueChange={(value) => onFontSize(Number(value))}
      disabled={!selectionState.active}
    >
      <SelectTrigger className="h-7 w-[82px] gap-1 px-2 text-xs" aria-label="Selected text font size">
        <SelectValue />
      </SelectTrigger>
      <SelectContent data-rich-text-toolbar>
        {FONT_SIZES.map((fontSize) => (
          <SelectItem key={fontSize} value={String(fontSize)}>{fontSize} pt</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

const RichTextarea = React.forwardRef<RichTextareaHandle, RichTextareaProps>(
  (
    {
      value,
      richDocument,
      onChange,
      onFocus,
      onActivate,
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
      compositionField = false,
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
        previous.align === state.align &&
        previous.fontSize === state.fontSize
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
        const toolbarHasFocus =
          document.activeElement instanceof HTMLElement &&
          document.activeElement.closest('[data-rich-text-toolbar]') !== null;
        const savedRange = editor ? savedRanges.get(editor) : undefined;
        if (toolbarHasFocus && savedRange && editor?.contains(savedRange.commonAncestorContainer)) {
          return;
        }
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
      let fontSize: number | undefined;
      const anchor = selection.anchorNode;
      const anchorElement = anchor instanceof HTMLElement ? anchor : anchor?.parentElement;
      if (anchorElement) {
        try {
          const computed = window.getComputedStyle(anchorElement);
          const currentFontSize = Number.parseFloat(computed.fontSize);
          const baseFontSize = Number.parseFloat(window.getComputedStyle(editor).fontSize) || 14;
          if (Number.isFinite(currentFontSize) && Math.abs(currentFontSize - baseFontSize) > 0.5) {
            fontSize = Math.round(currentFontSize * 0.75 * 10) / 10;
          }
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
        fontSize,
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

    const applyFontSize = React.useCallback(
      (fontSize: number) => {
        const editor = editorRef.current;
        if (!editor || !Number.isFinite(fontSize) || fontSize <= 0) return;

        restoreSelection();
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

        const range = selection.getRangeAt(0);
        if (!editor.contains(range.commonAncestorContainer)) return;

        const updatedRange = applyFontSizeToRange(editor, range, fontSize);
        if (!updatedRange) return;

        selection.removeAllRanges();
        selection.addRange(updatedRange);
        savedRanges.set(editor, updatedRange.cloneRange());
        emitChange();
        refreshSelectionState();
      },
      [emitChange, refreshSelectionState, restoreSelection]
    );

    React.useImperativeHandle(
      ref,
      () => ({
        focus: () => editorRef.current?.focus({ preventScroll: true }),
        applyBold: () => applyCommand('bold'),
        applyUnderline: () => applyCommand('underline'),
        applyAlignment: (alignment: TextAlign) => applyAlignment(alignment),
        applyFontSize,
        getSelectionState: () => selectionStateRef.current,
      }),
      [applyAlignment, applyCommand, applyFontSize]
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

    return (
      <div className={cn('space-y-1', className)}>
        {showToolbar && (
          <div className={cn('flex items-center gap-0.5', toolbarClassName)}>
            <RichTextToolbar
              selectionState={selectionState}
              onBold={() => applyCommand('bold')}
              onUnderline={() => applyCommand('underline')}
              onAlignment={applyAlignment}
              onFontSize={applyFontSize}
            />
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
            data-composition-field={compositionField ? '' : undefined}
            role="textbox"
            aria-multiline="true"
            aria-placeholder={placeholder}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onFocus={(event) => {
              rememberSelection();
              onActivate?.({
                focus: () => editorRef.current?.focus({ preventScroll: true }),
                applyBold: () => applyCommand('bold'),
                applyUnderline: () => applyCommand('underline'),
                applyAlignment: (alignment) => applyAlignment(alignment),
                applyFontSize,
                getSelectionState: () => selectionStateRef.current,
              });
              refreshSelectionState();
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
