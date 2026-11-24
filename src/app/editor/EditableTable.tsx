'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Plus, Trash2, Check, Pencil, Underline } from 'lucide-react';
import type { TableEditCallbacks } from './paper-render';
import RichTextarea, { type RichTextareaHandle, type RichTextareaSelectionState } from './RichTextarea';
import type { RichTextDocument, TextAlign } from './text-format';

export const MIN_TABLE_COL = 40;
export const MIN_TABLE_ROW = 24;

interface EditableTableProps {
  questionId: string;
  data: string[][];
  richData?: (RichTextDocument | null)[][];
  borderMode?: 'grid' | 'box';
  colWidths?: number[];
  rowHeights?: number[];
  tableMarginLeft?: number;
  callbacks: TableEditCallbacks;
  forceEditing?: boolean;
  children?: React.ReactNode;
}

const GUTTER_W = 26;

const TABLE_ALIGNMENTS: { value: TextAlign; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'left', label: 'Align left', icon: AlignLeft },
  { value: 'center', label: 'Align center', icon: AlignCenter },
  { value: 'right', label: 'Align right', icon: AlignRight },
  { value: 'justify', label: 'Justify', icon: AlignJustify },
];

export default function EditableTable({ questionId, data, richData, borderMode = 'grid', colWidths, rowHeights, tableMarginLeft, callbacks, forceEditing = false, children }: EditableTableProps) {
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [widths, setWidths] = useState<number[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Map<string, RichTextareaHandle>>(new Map());
  const activeCellRef = useRef<{ row: number; col: number } | null>(null);
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [formatState, setFormatState] = useState<RichTextareaSelectionState>({
    active: false,
    bold: false,
    underline: false,
    align: 'left',
  });

  const cols = Math.max(1, data[0]?.length ?? 1);
  const rows = data.length;
  const isBox = borderMode === 'box';
  const isEditing = forceEditing || editing;

  const cellKey = (row: number, col: number) => `${row}:${col}`;

  const handleCellFocus = useCallback((row: number, col: number) => {
    activeCellRef.current = { row, col };
    setActiveCell({ row, col });
  }, []);

  const handleSelectionStateChange = useCallback(
    (row: number, col: number, state: RichTextareaSelectionState) => {
      const active = activeCellRef.current;
      if (!active || active.row !== row || active.col !== col) return;
      setFormatState((previous) =>
        previous.active === state.active &&
        previous.bold === state.bold &&
        previous.underline === state.underline &&
        previous.align === state.align
          ? previous
          : state
      );
    },
    []
  );

  const getActiveCellHandle = useCallback((): RichTextareaHandle | null => {
    const active = activeCellRef.current;
    if (!active) return null;
    return cellRefs.current.get(cellKey(active.row, active.col)) ?? null;
  }, []);

  const applyToActiveCell = useCallback(
    (action: 'bold' | 'underline' | 'align', value?: TextAlign) => {
      const handle = getActiveCellHandle();
      if (!handle) return;
      if (action === 'bold') handle.applyBold();
      else if (action === 'underline') handle.applyUnderline();
      else if (value) handle.applyAlignment(value);
    },
    [getActiveCellHandle]
  );

  // 0 / undefined means "auto" (column splits remaining space evenly). Only
  // explicit pixel values (set by dragging) are applied, so the default layout
  // matches the read-only/PDF table until the user resizes something.
  const explicitColWidths = useMemo(() => {
    return colWidths && colWidths.length === cols ? colWidths : Array(cols).fill(0);
  }, [colWidths, cols]);

  const dragState = useRef<{ axis: 'col' | 'row' | 'left'; index: number; start: number; size: number } | null>(null);
  const thRefs = useRef<Array<HTMLTableCellElement | null>>([]);
  const rowEls = useRef<Array<HTMLTableRowElement | null>>([]);

  // Once the user touches any column, every column gets a concrete pixel value.
  // Explicit widths win; untouched (auto) columns keep their currently measured
  // width. The table then sizes to the SUM of the columns (horizontal scroll at
  // the page edge) instead of being locked to 100% so other columns don't squish.
  const resolveAllWidths = useCallback(
    (changedValue: number, changedIndex: number) =>
      explicitColWidths.map((w, ci) => {
        const base = ci === changedIndex ? changedValue : w;
        return base > 0 ? base : widths[ci] > 0 ? widths[ci] : MIN_TABLE_COL;
      }),
    [explicitColWidths, widths]
  );

  const colSum = useMemo(() => explicitColWidths.reduce((a, b) => a + (b > 0 ? b : 0), 0), [explicitColWidths]);
  const hasExplicitColWidth = colSum > 0;

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
        size = tableMarginLeft ?? 0;
      } else if (axis === 'col') {
        size = thRefs.current[index]?.offsetWidth || MIN_TABLE_COL;
      } else {
        const explicit = rowHeights && index < rowHeights.length && rowHeights[index] > 0 ? rowHeights[index] : 0;
        size = explicit || rowEls.current[index]?.offsetHeight || MIN_TABLE_ROW;
      }
      dragState.current = { axis, index, start: axis === 'row' ? e.clientY : e.clientX, size };
    },
    [rowHeights, tableMarginLeft]
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
        callbacks.onColWidths(questionId, resolveAllWidths(next, d.index));
        setWidths((prev) => {
          const n = [...prev];
          n[d.index] = next;
          return n;
        });
      } else {
        callbacks.onResizeRow(questionId, d.index, next);
      }
    },
    [callbacks, questionId]
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
    <div data-table-element style={{ marginTop: '0.5rem', marginLeft: tableMarginLeft ? `${tableMarginLeft}px` : undefined }} className="relative" onContextMenu={forceEditing ? undefined : openEditMenu}>
      {isEditing ? (
        <>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => callbacks.onAddRow(questionId)}
              className="inline-flex h-6 items-center gap-1 rounded border border-slate-300 px-2 text-[11px] text-slate-600 hover:bg-slate-100"
            >
              <Plus className="size-3" /> Row
            </button>
            <button
              type="button"
              onClick={() => callbacks.onAddCol(questionId)}
              className="inline-flex h-6 items-center gap-1 rounded border border-slate-300 px-2 text-[11px] text-slate-600 hover:bg-slate-100"
            >
              <Plus className="size-3" /> Column
            </button>
            <label className="inline-flex h-6 items-center gap-1.5 rounded border border-slate-300 px-2 text-[11px] text-slate-600">
              Left margin
              <input
                type="number"
                min={0}
                max={300}
                value={tableMarginLeft ?? 0}
                onChange={(e) => callbacks.onMarginLeftChange(questionId, Number(e.target.value) || 0)}
                className="w-12 rounded border border-slate-200 px-1 py-0 text-right text-[11px] tabular-nums"
              />
              px
            </label>
            <button
              type="button"
              title="Toggle between a full grid and a single box with no internal lines"
              onClick={() => callbacks.onBorderModeChange?.(questionId, isBox ? 'grid' : 'box')}
              className="inline-flex h-6 items-center gap-1 rounded border border-slate-300 px-2 text-[11px] text-slate-600 hover:bg-slate-100"
            >
              {isBox ? 'Single box' : 'Grid'}
            </button>
            {!forceEditing && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="ml-auto inline-flex h-6 items-center gap-1 rounded border border-blue-500 px-2 text-[11px] text-blue-600 hover:bg-blue-50"
              >
                <Check className="size-3" /> Done
              </button>
            )}
          </div>
          <div className="mb-1 flex flex-wrap items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-1">
            <span className="mr-1 text-[11px] text-slate-500">
              {activeCell ? `Cell R${activeCell.row + 1}C${activeCell.col + 1}` : 'Select a cell to format'}
            </span>
            <button
              type="button"
              title="Bold selected text"
              aria-label="Bold selected text"
              disabled={!activeCell}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyToActiveCell('bold')}
              className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-600 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
              style={formatState.bold ? { backgroundColor: '#e2e8f0', fontWeight: 700 } : undefined}
            >
              <Bold className="size-3.5" />
            </button>
            <button
              type="button"
              title="Underline selected text"
              aria-label="Underline selected text"
              disabled={!activeCell}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyToActiveCell('underline')}
              className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-600 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
              style={formatState.underline ? { backgroundColor: '#e2e8f0', textDecoration: 'underline' } : undefined}
            >
              <Underline className="size-3.5" />
            </button>
            <span className="mx-1 h-4 w-px bg-slate-300" aria-hidden />
            {TABLE_ALIGNMENTS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                title={label}
                aria-label={label}
                disabled={!activeCell}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyToActiveCell('align', value)}
                className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-600 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                style={activeCell && formatState.align === value ? { backgroundColor: '#e2e8f0' } : undefined}
              >
                <Icon className="size-3.5" />
              </button>
            ))}
          </div>
          <div className="relative overflow-x-auto pb-1">
            <span
              onPointerDown={(e) => startDrag(e, 'left', -1)}
              title="Drag to adjust left margin"
              className="absolute left-0 top-0 z-20 h-full w-1.5 cursor-ew-resize border-l-2 border-blue-400/40 bg-blue-400/0 hover:border-blue-500 hover:bg-blue-400/40"
            />
            <table style={{
              width: hasExplicitColWidth ? `${colSum}px` : '100%',
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
              ...(isBox ? { border: '1px solid #000' } : {}),
            }}>
              <colgroup>
                <col style={{ width: GUTTER_W }} />
                {explicitColWidths.map((w, ci) => (
                  <col key={ci} style={w && w > 0 ? { width: w } : undefined} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th style={{ border: isBox ? 'none' : '1px solid #000', padding: 0, verticalAlign: 'top' }} className="bg-slate-100">
                    <span className="block text-center text-[10px] font-normal leading-6 text-slate-400">size</span>
                  </th>
                  {explicitColWidths.map((_, ci) => (
                    <th
                      key={ci}
                      ref={(el) => { thRefs.current[ci] = el; }}
                      style={{ border: isBox ? 'none' : '1px solid #000', padding: 0, verticalAlign: 'top' }}
                      className="relative bg-slate-100"
                    >
                      <div className="flex h-6 items-center justify-between gap-0.5 pr-2">
                        <label className="flex items-center gap-0.5" title="Column width in pixels">
                          <span className="text-[9px] font-normal text-slate-400">W</span>
                          <input
                            type="number"
                            min={MIN_TABLE_COL}
                            max={1500}
                            value={widths[ci] && widths[ci] > 0 ? widths[ci] : ''}
                            placeholder="auto"
                            onChange={(e) => {
                              const v = Math.round(Number(e.target.value));
                              if (v && v >= MIN_TABLE_COL) {
                                callbacks.onColWidths(
                                  questionId,
                                  explicitColWidths.map((w, col) =>
                                    col === ci ? v : w > 0 ? w : widths[col] > 0 ? widths[col] : MIN_TABLE_COL
                                  )
                                );
                              }
                            }}
                            className="w-11 rounded border border-slate-300 px-0.5 py-0 text-center text-[10px] text-slate-600 [appearance:textfield]"
                          />
                        </label>
                        <button
                          type="button"
                          title="Delete column"
                          onClick={() => callbacks.onRemoveCol(questionId, ci)}
                          className="inline-flex h-4 w-4 items-center justify-center rounded text-slate-400 hover:bg-red-100 hover:text-red-600"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                      <span
                        onPointerDown={(e) => startDrag(e, 'col', ci)}
                        title={`Drag to resize column ${ci + 1}`}
                        className="absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize border-r border-slate-300 bg-slate-200/60 hover:bg-blue-400/70"
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
                  <td style={{ border: isBox ? 'none' : '1px solid #000', padding: 0, verticalAlign: 'top', width: GUTTER_W }} className="relative bg-slate-100">
                    <div className="flex items-start justify-center pt-0.5">
                      <button
                        type="button"
                        title="Delete row"
                        onClick={() => callbacks.onRemoveRow(questionId, ri)}
                        className="inline-flex h-4 w-4 items-center justify-center rounded text-slate-400 hover:bg-red-100 hover:text-red-600"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                    {ri < rows - 1 && (
                      <span
                        onPointerDown={(e) => startDrag(e, 'row', ri)}
                        title={`Drag to resize row ${ri + 1}`}
                        className="absolute bottom-0 left-0 z-10 h-2 w-full cursor-row-resize border-b border-slate-300 bg-slate-200/60 hover:bg-blue-400/70"
                      />
                    )}
                  </td>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{ border: isBox ? 'none' : '1px solid #000', padding: '2px 4px', verticalAlign: 'top' }}>
                      <RichTextarea
                        ref={(handle) => {
                          const key = cellKey(ri, ci);
                          if (handle) cellRefs.current.set(key, handle);
                          else cellRefs.current.delete(key);
                        }}
                        value={cell ?? ''}
                        richDocument={richData?.[ri]?.[ci] ?? undefined}
                        onChange={(value, richDocument) =>
                          callbacks.onCellChange(questionId, ri, ci, value, richDocument)
                        }
                        onFocus={() => handleCellFocus(ri, ci)}
                        onSelectionStateChange={(state) => handleSelectionStateChange(ri, ci, state)}
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
          className="fixed z-[1000] w-40 rounded-md border border-slate-200 bg-white p-1 shadow-lg"
          style={{ left: menu.x, top: menu.y }}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
          >
            <Pencil className="size-3.5" /> Edit table
          </button>
        </div>
      , document.body)}
    </div>
  );
}