'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { SHORTCUTS, SHORTCUT_GROUPS, comboKeys, getShortcut } from './shortcuts';

export function useIsMac() {
  const [mac, setMac] = React.useState(false);
  React.useEffect(() => {
    setMac(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent));
  }, []);
  return mac;
}

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-[6px] border border-white/10 bg-white/[0.06] px-1.5 font-sans text-[11px] font-medium leading-none text-slate-300 shadow-[0_1px_0_rgba(255,255,255,0.04)]',
        className
      )}
    >
      {children}
    </kbd>
  );
}

/** Renders the key caps for a registered shortcut id, e.g. <ShortcutKeys id="save" /> */
export function ShortcutKeys({ id, className }: { id: string; className?: string }) {
  const mac = useIsMac();
  const def = getShortcut(id);
  if (!def) return null;
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {comboKeys(def.combo, mac).map((k, i) => (
        <Kbd key={i}>{k}</Kbd>
      ))}
    </span>
  );
}

export default function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto border-white/10 bg-slate-900 text-slate-100 app-scrollbar">
        <DialogTitle className="text-base font-semibold">কীবোর্ড শর্টকাট</DialogTitle>
        <DialogDescription className="text-xs text-slate-400">
          যেকোনো সময় <Kbd>?</Kbd> চাপলে এই তালিকা খুলবে। সবকিছু খুঁজতে <ShortcutKeys id="palette" className="align-middle" /> চাপুন।
        </DialogDescription>
        <div className="mt-2 grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-400/90">{group}</h3>
              <ul className="space-y-1.5">
                {SHORTCUTS.filter((s) => s.group === group && !s.hidden).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-300">{s.label}</span>
                    <ShortcutKeys id={s.id} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="mt-2 border-t border-white/10 pt-3 text-xs text-slate-500">
          টেক্সট লেখার সময় বোল্ড <Kbd>Ctrl</Kbd> <Kbd>B</Kbd> এবং আন্ডারলাইন <Kbd>Ctrl</Kbd> <Kbd>U</Kbd> আগের মতোই কাজ করবে।
          প্রিভিউতে জুম করতে <Kbd>Ctrl</Kbd> চেপে মাউস স্ক্রল করুন, সরাতে <Kbd>Space</Kbd> চেপে টানুন।
        </p>
      </DialogContent>
    </Dialog>
  );
}
