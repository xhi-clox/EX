'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Check, Pencil } from 'lucide-react';
import type { TableEditCallbacks } from './paper-render';
import RichTextarea, { RichTextToolbar, type RichTextareaHandle, type RichTextareaSelectionState } from './RichTextarea';
import type { RichTextDocument } from './text-format';

export const MIN_TABLE_COL = 40;
export const MIN_TABLE_ROW = 24;
export const TABLE_GUTTER_WIDTH = 26;

interface EditableTableProps {
  questionId: string;
  data: string[][];
  richData?: (RichTextDocument | null)[][];
  borderMode?: 'grid' | 'box';
  colWidths?: number[];
  rowHeights?: number[];
  tableMarginLeft?: number;
  maxWidth?: number;
  callbacks: TableEditCallbacks;
  onActivateRichTextarea?: (handle: RichTextareaHandle) => void;
  onRichTextareaSelectionStateChange?: (state: RichTextareaSelectionState) => void;
  forceEditing?: boolean;
  children?: React.ReactNode;
}

const GUTTER_W = TABLE_GUTTER_WIDTH;

export default function EditableTable({ questionId, data, richData, borderMode = 'grid', colWidths, rowHeights, tableMarginLeft, maxWidth, callbacks, onActivateRichTextarea, onRichTextareaSelectionStateChange, forceEditing = false, children }: EditableTableProps) {
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [widths, setWidths] = useState<number[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeCellRef = useRef<{ row: number; col: number } | null>(null);
  const cellRefs = useRef<Map<string, RichTextareaHandle>>(new Map());
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [formatState, setFormatState] = useState<RichTextareaSelectionState>({
    active: false,
    bold: false,
    underline: false,
    align: 'left',
  });
  const tableContentRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);

  const cols = Math.max(1, data[0]?.length ?? 1);
  const rows = data.length;
  const isBox = borderMode === 'box';
  const isEditing = forceEditing || editing;
  const maxLeftMargin = maxWidth === undefined
    ? Number.POSITIVE_INFINITY
    : Math.max(0, maxWidth - GUTTER_W - MIN_TABLE_COL);
  const effectiveTableMarginLeft = Math.min(tableMarginLeft ?? 0, maxLeftMargin);
  const maxTableWidth = maxWidth === undefined
    ? Number.POSITIVE_INFINITY
    : Math.max(0, maxWidth - effectiveTableMarginLeft);

  const handleCellFocus = useCallback((row: number, col: number) => {
    activeCellRef.current = { row, col };
    setActiveCell({ row, col });
    setFormatState(cellRefs.current.get(`${row}:${col}`)?.getSelectionState() ?? {
      active: false,
      bold: false,
      underline: false,
      align: 'left',
    });
  }, []);

  const handleSelectionStateChange = useCallback(
    (row: number, col: number, state: RichTextareaSelectionState) => {
      const active = activeCellRef.current;
      if (!active || active.row !== row || active.col !== col) return;
      setFormatState((previous) =>
        previous.active === state.active &&
        previous.bold === state.bold &&
        previous.underline === state.underline &&
        previous.align === state.align &&
        previous.fontSize === state.fontSize
          ? previous
          : state
      );
    },
    []
  );

  const applyToActiveCell = useCallback((action: (handle: RichTextareaHandle) => void) => {
    const active = activeCellRef.current;
    const handle = active ? cellRefs.current.get(`${active.row}:${active.col}`) : null;
    if (handle) action(handle);
  }, []);

  // 0 / undefined means "auto" (column splits remaining space evenly). Only
  // explicit pixel values (set by dragging) are applied, so the default layout
  // matches the read-only/PDF table until the user resizes something.
  const explicitColWidths = useMemo(() => {
    return colWidths && colWidths.length === cols ? colWidths : Array(cols).fill(0);
  }, [colWidths, cols]);

  const dragState = useRef<{ axis: 'col' | 'row' | 'left'; index: number; start: number; size: number } | null>(null);
  const thRefs = useRef<Array<HTMLTableCellElement | null>>([]);
  const rowEls = useRef<Array<HTMLTableRowElement | null>>([]);

  useLayoutEffect(() => {
    const element = tableContentRef.current;
    if (!element) return;
    const measure = () => setAvailableWidth(Math.min(element.clientWidth, maxTableWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [isEditing, maxTableWidth]);

  const maxColumnWidth = availableWidth > 0
    ? Math.max(0, availableWidth - GUTTER_W)
    : Number.POSITIVE_INFINITY;
  const colSum = useMemo(() => explicitColWidths.reduce((a, b) => a + (b > 0 ? b : 0), 0), [explicitColWidths]);
  const hasExplicitColWidth = colSum > 0;
  const columnScale = colSum > maxColumnWidth ? maxColumnWidth / colSum : 1;
  const visibleColWidths = explicitColWidths.map((width) => width > 0 ? width * columnScale : 0);
  const visibleColSum = visibleColWidths.reduce((sum, width) => sum + width, 0);
  const allColumnsExplicit = explicitColWidths.every((width) => width > 0);

  // Once a column is resized, preserve the proportions while keeping the full
  // set of columns within the printable width.
  const resolveAllWidths = useCallback(
    (changedValue: number, changedIndex: number) => {
      const nextWidths = explicitColWidths.map((w, ci) => {
        const base = ci === changedIndex ? changedValue : w;
        return base > 0 ? base : widths[ci] > 0 ? widths[ci] : MIN_TABLE_COL;
      });
      const total = nextWidths.reduce((sum, width) => sum + width, 0);
      if (total <= maxColumnWidth) return nextWidths;
      const scale = maxColumnWidth / total;
      return nextWidths.map((width) => Math.floor(width * scale));
    },
    [explicitColWidths, maxColumnWidth, widths]
  );

  const tableWidth = allColumnsExplicit && hasExplicitColWidth
    ? `${GUTTER_W + visibleColSum}px`
    : '100%';

  useEffect(() => {
    if (!editing) return;
    const measure = () => {
      setWidths(Array.from({ length: cols }, (_, i) => thRefs.current[i]?.offsetWidth || 0));
    };
    measure();
    const t = window.setTimeout(measure, 60);
    return () => window.clearTimeout(t);
  }, [editing, cols, explicitColWidths]);

  const openEditMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const startDrag = useCallback(
    (e: React.PointerEvent, axis: 'col' | 'row' | 'left', index: number) => {
      e.preventDefault();
      e.stopPropagation();
      let size: number;
      if (axis === 'left') {
        size = effectiveTableMarginLeft;
      } else if (axis === 'col') {
        size = thRefs.current[index]?.offsetWidth || MIN_TABLE_COL;
      } else {
        const explicit = rowHeights && index < rowHeights.length && rowHeights[index] > 0 ? rowHeights[index] : 0;
        size = explicit || rowEls.current[index]?.offsetHeight || MIN_TABLE_ROW;
      }
      dragState.current = { axis, index, start: axis === 'row' ? e.clientY : e.clientX, size };
    },
    [effectiveTableMarginLeft, rowHeights]
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const d = dragState.current;
      if (!d) return;
      if (d.axis === 'left') {
        callbacks.onMarginLeftChange(questionId, Math.max(0, Math.round(d.size + (e.clientX - d.start))));
        return;
      }
      const delta = d.axis === 'col' ? e.clientX - d.start : e.clientY - d.start;
      const next = Math.max(d.axis === 'col' ? MIN_TABLE_COL : MIN_TABLE_ROW, Math.round(d.size + delta));
      if (d.axis === 'col') {
        const nextWidths = resolveAllWidths(next, d.index);
        callbacks.onColWidths(questionId, nextWidths);
        setWidths(nextWidths);
      } else {
        callbacks.onResizeRow(questionId, d.index, next);
      }
    },
    [callbacks, questionId, resolveAllWidths]
  );

  const onPointerUp = useCallback(() => {
    dragState.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  useEffect(() => {
    if (!menu) return;
    const onOutside = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    const onScrollOrResize = () => setMenu(null);
    document.addEventListener('pointerdown', onOutside, true);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      document.removeEventListener('pointerdown', onOutside, true);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [menu]);

  return (
    <div data-table-element style={{ marginTop: '0.5rem', marginLeft: effectiveTableMarginLeft ? `${effectiveTableMarginLeft}px` : undefined }} className="editor-table-grid relative" onContextMenu={forceEditing ? undefined : openEditMenu}>
      {isEditing ? (
        <>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => callbacks.onAddRow(questionId)}
              className="inline-flex h-6 items-center gap-1 rounded border border-border px-2 text-[11px] text-muted-foreground hover:bg-muted"
            >
              <Plus className="size-3" /> Row
            </button>
            <button
              type="button"
              onClick={() => callbacks.onAddCol(questionId)}
              className="inline-flex h-6 items-center gap-1 rounded border border-border px-2 text-[11px] text-muted-foreground hover:bg-muted"
            >
              <Plus className="size-3" /> Column
            </button>
            <label className="inline-flex h-6 items-center gap-1.5 rounded border border-border px-2 text-[11px] text-muted-foreground">
              Left margin
              <input
                type="number"
                min={0}
                max={300}
                value={effectiveTableMarginLeft}
                onChange={(e) => callbacks.onMarginLeftChange(questionId, Number(e.target.value) || 0)}
                className="w-12 rounded border border-input bg-background px-1 py-0 text-right text-[11px] tabular-nums text-foreground"
              />
              px
            </label>
            <button
              type="button"
              title="Toggle between a full grid and a single box with no internal lines"
              onClick={() => callbacks.onBorderModeChange?.(questionId, isBox ? 'grid' : 'box')}
              className="inline-flex h-6 items-center gap-1 rounded border border-border px-2 text-[11px] text-muted-foreground hover:bg-muted"
            >
              {isBox ? 'Single box' : 'Grid'}
            </button>
            {!forceEditing && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="ml-auto inline-flex h-6 items-center gap-1 rounded border border-primary px-2 text-[11px] text-primary hover:bg-primary/10"
              >
                <Check className="size-3" /> Done
              </button>
            )}
          </div>
          <div className="mb-1 flex flex-wrap items-center gap-1 rounded border border-border bg-muted/50 px-1.5 py-1">
            <span className="mr-1 text-[11px] text-muted-foreground">
              {activeCell ? `Cell R${activeCell.row + 1}C${activeCell.col + 1}` : 'Select a cell to edit'}
            </span>
            {!forceEditing && (
              <RichTextToolbar
                selectionState={formatState}
                onBold={() => applyToActiveCell((handle) => handle.applyBold())}
                onUnderline={() => applyToActiveCell((handle) => handle.applyUnderline())}
                onAlignment={(align) => applyToActiveCell((handle) => handle.applyAlignment(align))}
                onFontSize={(fontSize) => applyToActiveCell((handle) => handle.applyFontSize(fontSize))}
              />
            )}
          </div>
          <div ref={tableContentRef} className="relative overflow-x-auto pb-1">
            <span
              onPointerDown={(e) => startDrag(e, 'left', -1)}
              title="Drag to adjust left margin"
              className="absolute left-0 top-0 z-20 h-full w-1.5 cursor-ew-resize border-l-2 border-blue-400/40 bg-blue-400/0 hover:border-blue-500 hover:bg-blue-400/40"
            />
            <table style={{
              width: tableWidth,
              maxWidth: '100%',
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
              ...(isBox ? { border: '1px solid var(--table-grid-color)' } : {}),
            }}>
              <colgroup>
                <col style={{ width: GUTTER_W }} />
                {visibleColWidths.map((w, ci) => (
                  <col key={ci} style={w && w > 0 ? { width: w } : undefined} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th style={{ border: isBox ? 'none' : '1px solid var(--table-grid-color)', padding: 0, verticalAlign: 'top' }} className="bg-muted">
                    <span className="block text-center text-[10px] font-normal leading-6 text-muted-foreground">size</span>
                  </th>
                  {explicitColWidths.map((_, ci) => (
                    <th
                      key={ci}
                      ref={(el) => { thRefs.current[ci] = el; }}
                      style={{ border: isBox ? 'none' : '1px solid var(--table-grid-color)', padding: 0, verticalAlign: 'top' }}
                      className="relative bg-muted"
                    >
                      <div className="flex h-6 items-center justify-between gap-0.5 pr-2">
                        <label className="flex items-center gap-0.5" title="Column width in pixels">
                          <span className="text-[9px] font-normal text-muted-foreground">W</span>
                          <input
                            type="number"
                            min={MIN_TABLE_COL}
                            max={1500}
                            value={widths[ci] && widths[ci] > 0 ? widths[ci] : ''}
                            placeholder="auto"
                            onChange={(e) => {
                              const v = Math.round(Number(e.target.value));
                              if (v && v >= MIN_TABLE_COL) {
                              callbacks.onColWidths(questionId, resolveAllWidths(v, ci));
                              }
                            }}
                            className="w-11 rounded border border-input bg-background px-0.5 py-0 text-center text-[10px] text-foreground placeholder:text-muted-foreground [appearance:textfield]"
                          />
                        </label>
                        <button
                          type="button"
                          title="Delete column"
                          onClick={() => callbacks.onRemoveCol(questionId, ci)}
                          className="inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                      <span
                        onPointerDown={(e) => startDrag(e, 'col', ci)}
                        title={`Drag to resize column ${ci + 1}`}
                        className="absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize border-r border-border bg-muted hover:bg-blue-400/70"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
              {data.map((row, ri) => (
                <tr
                  key={ri}
                  ref={(el) => { rowEls.current[ri] = el; }}
                  style={rowHeights && rowHeights[ri] > 0 ? { height: rowHeights[ri] } : undefined}
                >
                  <td style={{ border: isBox ? 'none' : '1px solid var(--table-grid-color)', padding: 0, verticalAlign: 'top', width: GUTTER_W }} className="relative bg-muted">
                    <div className="flex items-start justify-center pt-0.5">
                      <button
                        type="button"
                        title="Delete row"
                        onClick={() => callbacks.onRemoveRow(questionId, ri)}
                        className="inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                    {ri < rows - 1 && (
                      <span
                        onPointerDown={(e) => startDrag(e, 'row', ri)}
                        title={`Drag to resize row ${ri + 1}`}
                        className="absolute bottom-0 left-0 z-10 h-2 w-full cursor-row-resize border-b border-border bg-muted hover:bg-blue-400/70"
                      />
                    )}
                  </td>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{ border: isBox ? 'none' : '1px solid var(--table-grid-color)', padding: '2px 4px', verticalAlign: 'top', overflowWrap: 'anywhere' }}>
                      <RichTextarea
                        ref={(handle) => {
                          const key = `${ri}:${ci}`;
                          if (handle) cellRefs.current.set(key, handle);
                          else cellRefs.current.delete(key);
                        }}
                        value={cell ?? ''}
                        richDocument={richData?.[ri]?.[ci] ?? undefined}
                        compositionField
                        onChange={(value, richDocument) =>
                          callbacks.onCellChange(questionId, ri, ci, value, richDocument)
                        }
                        onActivate={onActivateRichTextarea}
                        onFocus={() => handleCellFocus(ri, ci)}
                        onSelectionStateChange={(state) => {
                          handleSelectionStateChange(ri, ci, state);
                          onRichTextareaSelectionStateChange?.(state);
                        }}
                        align="left"
                        rows={2}
                        showToolbar={false}
                        className="space-y-0"
                        textareaClassName="min-h-14 w-full rounded-none border-0 bg-transparent px-1 py-1 text-inherit focus-visible:ring-0"
                      />
                    </td>
                  ))}
                </tr>
              ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        children
      )}

      {menu && !forceEditing && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[1000] w-40 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg"
          style={{ left: menu.x, top: menu.y }}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-popover-foreground hover:bg-muted"
          >
            <Pencil className="size-3.5" /> Edit table
          </button>
        </div>
      , document.body)}
    </div>
  );
}