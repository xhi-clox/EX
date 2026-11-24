'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Kbd, ShortcutKeys } from './ShortcutsDialog';

export interface PaletteCommand {
  id: string;
  label: string;
  group: string;
  icon?: React.ComponentType<{ className?: string }>;
  shortcutId?: string;
  keywords?: string;
  run: () => void;
}

export default function CommandPalette({
  open,
  onOpenChange,
  commands,
  contextHint,
  title,
  tabSelect = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: PaletteCommand[];
  /** e.g. "“প্রশ্ন ৩” এর পরে যুক্ত হবে" */
  contextHint?: string | null;
  title?: string;
  tabSelect?: boolean;
}) {
  const [query, setQuery] = React.useState('');
  const [index, setIndex] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
    }
  }, [open]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.keywords ?? ''} ${c.group}`.toLowerCase().includes(q));
  }, [commands, query]);

  React.useEffect(() => setIndex(0), [query]);

  React.useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [index, filtered]);

  const groups = React.useMemo(() => {
    const order: string[] = [];
    filtered.forEach((c) => !order.includes(c.group) && order.push(c.group));
    return order.map((g) => ({ name: g, items: filtered.filter((c) => c.group === g) }));
  }, [filtered]);

  const runCommand = (cmd: PaletteCommand | undefined) => {
    if (!cmd) return;
    onOpenChange(false);
    // let the dialog unmount first so focus changes made by the command stick
    window.setTimeout(cmd.run, 0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && tabSelect) {
      e.preventDefault();
      setIndex((i) => {
        if (!filtered.length) return 0;
        return e.shiftKey ? (i - 1 + filtered.length) % filtered.length : (i + 1) % filtered.length;
      });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => (filtered.length ? (i + 1) % filtered.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runCommand(filtered[index]);
    }
  };

  let flat = -1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="top-[16%] max-w-xl translate-y-0 gap-0 overflow-hidden rounded-2xl border-white/10 bg-slate-900/95 p-0 text-slate-100 shadow-2xl shadow-black/60 backdrop-blur-xl [&>button]:hidden"
      >
        <DialogTitle className={title ? 'px-4 pt-4 text-sm font-semibold text-slate-100' : 'sr-only'}>
          {title ?? 'কমান্ড প্যালেট'}
        </DialogTitle>
        <DialogDescription className="sr-only">প্রশ্ন যোগ করুন, অ্যাকশন চালান বা প্রশ্নে যান</DialogDescription>

        <div className="flex items-center gap-3 border-b border-white/[0.07] px-4">
          <Search className="size-4 shrink-0 text-slate-500" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="প্রশ্ন যোগ করুন, অ্যাকশন খুঁজুন, বা “৩” লিখে প্রশ্নে যান…"
            className="h-14 flex-1 bg-transparent text-[15px] text-slate-100 outline-none placeholder:text-slate-500"
            aria-label="কমান্ড খুঁজুন"
          />
          <Kbd>Esc</Kbd>
        </div>

        {contextHint && (
          <div className="border-b border-white/[0.05] bg-teal-400/[0.06] px-4 py-2 text-xs text-teal-300">{contextHint}</div>
        )}

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2 app-scrollbar">
          {filtered.length === 0 && <p className="px-3 py-10 text-center text-sm text-slate-500">কিছু পাওয়া যায়নি</p>}
          {groups.map((group) => (
            <div key={group.name} className="mb-1">
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{group.name}</p>
              {group.items.map((cmd) => {
                flat += 1;
                const active = flat === index;
                const myIndex = flat;
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    data-active={active}
                    onMouseMove={() => setIndex(myIndex)}
                    onClick={() => runCommand(cmd)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                      active ? 'bg-white/[0.08] text-white' : 'text-slate-300'
                    )}
                  >
                    {Icon && (
                      <span className={cn('flex size-7 items-center justify-center rounded-md', active ? 'bg-teal-400/15 text-teal-300' : 'bg-white/[0.04] text-slate-400')}>
                        <Icon className="size-4" />
                      </span>
                    )}
                    <span className="flex-1 truncate">{cmd.label}</span>
                    {cmd.shortcutId && <ShortcutKeys id={cmd.shortcutId} />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 border-t border-white/[0.07] px-4 py-2 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> নির্বাচন</span>
          <span className="flex items-center gap-1.5"><Kbd>Tab</Kbd> নির্বাচন</span>
          <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> চালান</span>
          <span className="ml-auto flex items-center gap-1.5"><Kbd>?</Kbd> সব শর্টকাট</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
