'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Hash, MousePointerClick, Send } from 'lucide-react';
import { useState } from 'react';
import { buildTallyMarks, MAX_TALLY_COUNT, parseTallyCount } from './tally';

interface TallyMarksProps {
  onInsert: (text: string) => void;
  targetLabel: string | null;
}

export default function TallyMarks({ onInsert, targetLabel }: TallyMarksProps) {
  const [count, setCount] = useState('5');

  const parsed = parseTallyCount(count);
  const tooLarge = parsed !== null && parsed > MAX_TALLY_COUNT;
  const tally = parsed !== null && !tooLarge ? buildTallyMarks(parsed) : '';
  const canInsert = tally.length > 0 && !!targetLabel;

  const insert = () => {
    if (!canInsert) return;
    onInsert(tally);
  };

  return (
    <Card className="bg-slate-900 border-slate-700 text-white overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/15 text-amber-300">
            <Hash className="h-4 w-4" />
          </span>
          ট্যালি চিহ্ন
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          সংখ্যা লিখুন, প্রিভিউ দেখে কার্সরের জায়গায় যোগ করুন।
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {targetLabel ? (
          <div className="flex items-center gap-2 rounded-md border border-emerald-700/60 bg-emerald-900/30 px-2.5 py-1.5 text-xs text-emerald-200">
            <MousePointerClick className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              যোগ হবে: <span className="font-semibold">{targetLabel}</span>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-amber-700/60 bg-amber-900/30 px-2.5 py-1.5 text-xs text-amber-200">
            <MousePointerClick className="h-3.5 w-3.5 shrink-0" />
            <span>আগে যেকোনো প্রশ্নের ঘরে ক্লিক করুন</span>
          </div>
        )}

        <div className="space-y-2.5 rounded-lg border border-slate-700 bg-slate-800/60 p-3">
          <div className="flex items-center gap-2">
            <Input
              value={count}
              onChange={(event) => setCount(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  insert();
                }
              }}
              inputMode="numeric"
              placeholder="যেমন: ৭"
              aria-label="ট্যালি সংখ্যা"
              className="h-9 flex-1 border-slate-600 bg-slate-700 text-sm"
            />
            <Button
              variant="outline"
              onClick={() => setCount('')}
              disabled={!count}
              className="h-9 shrink-0 border-slate-600 bg-slate-700 hover:bg-slate-600 hover:text-white"
            >
              Clear
            </Button>
          </div>

          <div className="rounded-md border border-slate-700 bg-white px-2 py-1.5">
            <div className="flex min-h-[2.25rem] items-center overflow-x-auto text-black app-scrollbar-light">
              {tally ? (
                <span className="tally-marks-font whitespace-pre text-xl">{tally}</span>
              ) : (
                <span className="text-sm text-gray-400">
                  {tooLarge ? `সর্বোচ্চ ${MAX_TALLY_COUNT}` : 'প্রিভিউ'}
                </span>
              )}
            </div>
          </div>

          <Button
            onClick={insert}
            disabled={!canInsert}
            title={!targetLabel ? 'আগে যেকোনো প্রশ্নের ঘরে ক্লিক করুন' : 'কার্সরের জায়গায় যোগ করুন'}
            className="h-9 w-full bg-amber-600 text-white hover:bg-amber-500"
          >
            <Send className="h-4 w-4" />
            যোগ করুন
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
