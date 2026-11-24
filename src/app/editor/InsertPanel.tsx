'use client';

import * as React from 'react';
import Link from 'next/link';
import { Image as ImageIcon, Sparkles, ScanText, Keyboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Question } from './page';
import { INSERT_ITEMS } from './insert-items';
import { Kbd, ShortcutKeys } from './ShortcutsDialog';

interface InsertPanelProps {
  onInsert: (type: Question['type']) => void;
  onPickImage: () => void;
  onOpenShortcuts: () => void;
  aiHref: string;
  importHref: string;
  onNavigateAway: () => void;
  /** where the next question will be inserted */
  insertHint: string;
  stats: { count: number; marks: number; total: number | string };
}

function Tile({ item, onClick }: { item: (typeof INSERT_ITEMS)[number]; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${item.hint}`}
      className="group flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-left transition-all hover:border-teal-400/40 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60 active:scale-[0.98]"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-teal-400/10 text-teal-300 transition-colors group-hover:bg-teal-400/20">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-200">{item.label}</span>
      <ShortcutKeys id={item.shortcutId} className="opacity-0 transition-opacity group-hover:opacity-100 [&>kbd:not(:last-child)]:hidden" />
    </button>
  );
}

export default function InsertPanel({
  onInsert, onPickImage, onOpenShortcuts, aiHref, importHref, onNavigateAway, insertHint, stats,
}: InsertPanelProps) {
  const questions = INSERT_ITEMS.filter((i) => i.group === 'question');
  const structure = INSERT_ITEMS.filter((i) => i.group === 'structure');
  const overTotal = typeof stats.total === 'number' || /^\d+$/.test(String(stats.total));

  return (
    <div className="space-y-5 p-4 pt-5">
      {/* summary */}
      <div className="flex items-end justify-between rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-white/[0.02] px-4 py-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">প্রশ্নপত্র</p>
          <p className="mt-0.5 text-sm text-slate-200">
            <span className="text-lg font-semibold text-white">{stats.count}</span> টি প্রশ্ন
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">নম্বর যোগফল</p>
          <p className="mt-0.5 text-sm text-slate-400">
            <span className="text-lg font-semibold text-white">{stats.marks}</span>
            {overTotal && <span> / {stats.total}</span>}
          </p>
        </div>
      </div>

      {/* insert */}
      <section>
        <div className="mb-2 flex items-center justify-between px-0.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">যোগ করুন</h3>
          <span className="truncate pl-3 text-[11px] text-teal-300/80">{insertHint}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {questions.map((item) => (
            <Tile key={item.type} item={item} onClick={() => onInsert(item.type)} />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {structure.map((item) => (
            <Tile key={item.type} item={item} onClick={() => onInsert(item.type)} />
          ))}
          <button
            type="button"
            onClick={onPickImage}
            className="group flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-left transition-all hover:border-teal-400/40 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60 active:scale-[0.98]"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-teal-400/10 text-teal-300 group-hover:bg-teal-400/20">
              <ImageIcon className="size-4" />
            </span>
            <span className="flex-1 truncate text-[13px] font-medium text-slate-200">ছবি</span>
            <ShortcutKeys id="insert-image" className="opacity-0 transition-opacity group-hover:opacity-100 [&>kbd:not(:last-child)]:hidden" />
          </button>
        </div>
      </section>

      {/* smart actions */}
      <section className="grid grid-cols-2 gap-2">
        <Link
          href={aiHref}
          onClick={onNavigateAway}
          className={cn(
            'flex items-center justify-center gap-2 rounded-xl border border-violet-400/25 bg-violet-400/10 px-3 py-2.5 text-[13px] font-medium text-violet-200 transition-colors hover:bg-violet-400/15',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60'
          )}
        >
          <Sparkles className="size-4" /> AI দিয়ে তৈরি
        </Link>
        <Link
          href={importHref}
          onClick={onNavigateAway}
          className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13px] font-medium text-slate-200 transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60"
        >
          <ScanText className="size-4" /> ছবি থেকে
        </Link>
      </section>

      <button
        type="button"
        onClick={onOpenShortcuts}
        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs text-slate-500 transition-colors hover:bg-white/[0.04] hover:text-slate-300"
      >
        <span className="flex items-center gap-2"><Keyboard className="size-3.5" /> কীবোর্ড শর্টকাট</span>
        <Kbd>?</Kbd>
      </button>
    </div>
  );
}
