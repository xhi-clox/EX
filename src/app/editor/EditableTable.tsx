'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Check, Pencil } from 'lucide-react';
import type { TableEditCallbacks } from './paper-render';

export const MIN_TABLE_COL = 40;
export const MIN_TABLE_ROW = 24;

interface EditableTableProps {
  questionId: string;
  data: string[][];
  colWidths?: number[];
  rowHeights?: number[];
  tableMarginLeft?: number;
  callbacks: TableEditCallbacks;
  children?: React.ReactNode;
}

const GUTTER_W = 26;

const CellEditor = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      className="block w-full resize-none border-none bg-transparent p-0 text-inherit focus:outline-none focus:ring-1 focus:ring-blue-400"
    />
  );
};

export default function EditableTable({ questionId, data, colWidths, rowHeights, tableMarginLeft, callbacks, children }: EditableTableProps) {
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [widths, setWidths] = useState<number[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  const cols = Math.max(1, data[0]?.length ?? 1);
  const rows = data.length;

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
    <div data-table-element style={{ marginTop: '0.5rem', marginLeft: tableMarginLeft ? `${tableMarginLeft}px` : undefined }} className="relative" onContextMenu={openEditMenu}>
      {editing ? (
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
              onClick={() => setEditing(false)}
              className="ml-auto inline-flex h-6 items-center gap-1 rounded border border-blue-500 px-2 text-[11px] text-blue-600 hover:bg-blue-50"
            >
              <Check className="size-3" /> Done
            </button>
          </div>
          <div className="relative overflow-x-auto pb-1">
            <span
              onPointerDown={(e) => startDrag(e, 'left', -1)}
              title="Drag to adjust left margin"
              className="absolute left-0 top-0 z-20 h-full w-1.5 cursor-ew-resize border-l-2 border-blue-400/40 bg-blue-400/0 hover:border-blue-500 hover:bg-blue-400/40"
            />
            <table style={{ width: hasExplicitColWidth ? `${colSum}px` : '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: GUTTER_W }} />
                {explicitColWidths.map((w, ci) => (
                  <col key={ci} style={w && w > 0 ? { width: w } : undefined} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #000', padding: 0, verticalAlign: 'top' }} className="bg-slate-100">
                    <span className="block text-center text-[10px] font-normal leading-6 text-slate-400">size</span>
                  </th>
                  {explicitColWidths.map((_, ci) => (
                    <th
                      key={ci}
                      ref={(el) => { thRefs.current[ci] = el; }}
                      style={{ border: '1px solid #000', padding: 0, verticalAlign: 'top' }}
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
                    <td style={{ border: '1px solid #000', padding: 0, verticalAlign: 'top', width: GUTTER_W }} className="relative bg-slate-100">
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
                      <td key={ci} style={{ border: '1px solid #000', padding: '2px 6px', verticalAlign: 'top' }}>
                        <CellEditor value={cell ?? ''} onChange={(v) => callbacks.onCellChange(questionId, ri, ci, v)} />
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

      {menu && typeof document !== 'undefined' && createPortal(
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