'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, RotateCcw, Bold, Underline, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import {
  HEADER_KINDS,
  HEADER_SIZES,
  defaultHeaderTemplate,
  type HeaderCell,
  type HeaderCellKind,
  type HeaderRow,
} from './header-template';

interface HeaderBuilderProps {
  value?: HeaderRow[];
  onChange: (rows: HeaderRow[]) => void;
}

let counter = 0;
const freshId = (prefix: string) => `${prefix}${Date.now()}${++counter}`;

export default function HeaderBuilder({ value, onChange }: HeaderBuilderProps) {
  const rows = value && value.length > 0 ? value : defaultHeaderTemplate();

  const addRow = () => {
    onChange([
      ...rows,
      { id: freshId('hr'), cells: [{ id: freshId('hc'), kind: 'text', text: '', align: 'center', size: 12 }] },
    ]);
  };

  const removeRow = (ri: number) => onChange(rows.filter((_, i) => i !== ri));

  const addCell = (ri: number) =>
    onChange(
      rows.map((row, i) =>
        i === ri
          ? { ...row, cells: [...row.cells, { id: freshId('hc'), kind: 'text', text: '', align: 'center', size: 12 }] }
          : row
      )
    );

  const removeCell = (ri: number, ci: number) =>
    onChange(
      rows.map((row, i) => (i === ri ? { ...row, cells: row.cells.filter((_, j) => j !== ci) } : row))
    );

  const moveRow = (ri: number, dir: 'up' | 'down') => {
    const target = dir === 'up' ? ri - 1 : ri + 1;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    const tmp = next[ri];
    next[ri] = next[target];
    next[target] = tmp;
    onChange(next);
  };

  const moveCell = (ri: number, ci: number, dir: 'left' | 'right') => {
    const target = dir === 'left' ? ci - 1 : ci + 1;
    if (target < 0 || target >= rows[ri].cells.length) return;
    const cells = [...rows[ri].cells];
    const tmp = cells[ci];
    cells[ci] = cells[target];
    cells[target] = tmp;
    onChange(rows.map((row, i) => (i === ri ? { ...row, cells } : row)));
  };

  const setCell = (ri: number, ci: number, patch: Partial<HeaderCell>) =>
    onChange(
      rows.map((row, i) =>
        i === ri ? { ...row, cells: row.cells.map((cell, j) => (j === ci ? { ...cell, ...patch } : cell)) } : row
      )
    );

  const reset = () => onChange(defaultHeaderTemplate());

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="font-bold">হেডার লেআউট</Label>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="mr-1.5 size-3.5" /> ডিফল্ট
          </Button>
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="mr-1.5 size-3.5" /> সারি
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((row, ri) => (
          <div key={row.id} className="space-y-2 rounded-md border border-slate-300 dark:border-slate-700 p-2">
            <div className="flex flex-wrap gap-2">
              {row.cells.map((cell, ci) => (
                <div key={cell.id} className="min-w-[170px] flex-1 space-y-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5">
                  <div className="flex items-center gap-0.5">
                    <Select value={cell.kind} onValueChange={(v) => setCell(ri, ci, { kind: v as HeaderCellKind })}>
                      <SelectTrigger className="h-7 min-w-0 flex-1 text-xs">
                        <SelectValue placeholder="Content" />
                      </SelectTrigger>
                      <SelectContent>
                        {HEADER_KINDS.map((k) => (
                          <SelectItem key={k.value} value={k.value}>
                            {k.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      title="বামে সরান"
                      disabled={ci === 0}
                      onClick={() => moveCell(ri, ci, 'left')}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                    >
                      <ArrowLeft className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      title="ডানে সরান"
                      disabled={ci === row.cells.length - 1}
                      onClick={() => moveCell(ri, ci, 'right')}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                    >
                      <ArrowRight className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      title="কলাম মুছুন"
                      onClick={() => removeCell(ri, ci)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-red-100 hover:text-red-600"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>

                  {cell.kind === 'text' && (
                    <Input
                      value={cell.text ?? ''}
                      placeholder="লেখা"
                      onChange={(e) => setCell(ri, ci, { text: e.target.value })}
                      className="h-7 text-xs"
                    />
                  )}

                  <div className="flex items-center gap-1.5">
                    <Select value={String(cell.size ?? 12)} onValueChange={(v) => setCell(ri, ci, { size: Number(v) })}>
                      <SelectTrigger className="h-6 w-16 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HEADER_SIZES.map((s) => (
                          <SelectItem key={s.value} value={String(s.value)}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={cell.align ?? 'left'}
                      onValueChange={(v) => setCell(ri, ci, { align: v as HeaderCell['align'] })}
                    >
                      <SelectTrigger className="h-6 w-[4.5rem] text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">বাম</SelectItem>
                        <SelectItem value="center">মাঝ</SelectItem>
                        <SelectItem value="right">ডান</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      title="বোল্ড"
                      onClick={() => setCell(ri, ci, { bold: !cell.bold })}
                      className={`flex h-6 w-6 items-center justify-center rounded border text-xs ${cell.bold ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-300 text-slate-500 hover:bg-slate-100'}`}
                    >
                      <Bold className="size-3" />
                    </button>
                    <button
                      type="button"
                      title="আন্ডারলাইন"
                      onClick={() => setCell(ri, ci, { underline: !cell.underline })}
                      className={`flex h-6 w-6 items-center justify-center rounded border text-xs ${cell.underline ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-300 text-slate-500 hover:bg-slate-100'}`}
                    >
                      <Underline className="size-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="icon" className="h-6 w-6" disabled={ri === 0} onClick={() => moveRow(ri, 'up')}>
                <ArrowUp className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={ri === rows.length - 1}
                onClick={() => moveRow(ri, 'down')}
              >
                <ArrowDown className="size-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => addCell(ri)}>
                <Plus className="mr-1 size-3" /> কলাম
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-6 text-xs text-destructive hover:text-destructive"
                onClick={() => removeRow(ri)}
              >
                <Trash2 className="mr-1 size-3" /> সারি মুছুন
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}