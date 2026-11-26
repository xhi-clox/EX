
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Download, ArrowLeft, PanelRightClose, PanelRightOpen, Undo2, Redo2, Search, Check, Loader2, AlertCircle, Pencil, Eye, Keyboard, Sun, Moon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ShortcutKeys } from './ShortcutsDialog';
import type { Paper, PaperSettings, PageContent, BookletSpread, HalfPayload, MainNumberingFormat, MarksFormat, EditorTheme } from './page';
import { PaperPage } from './paper-render';
import { buildBookletOrder } from './booklet';
import { RichTextToolbar } from './RichTextarea';
import type { RichTextareaSelectionState } from './RichTextarea';
import type { TextAlign } from './text-format';
import { formatClassName } from '@/lib/school-classes';

interface EditorHeaderProps {
  paper: Paper | null;
  settings: PaperSettings;
  setSettings: React.Dispatch<React.SetStateAction<PaperSettings>>;
  setPaper: React.Dispatch<React.SetStateAction<Paper | null>>;
  pages: PageContent[][];
  handleSave: () => void;
  handleExit: () => void;
  isDownloading: boolean;
  setIsDownloading: React.Dispatch<React.SetStateAction<boolean>>;
  bookletPages: BookletSpread[];
  setBookletPages: React.Dispatch<React.SetStateAction<BookletSpread[]>>;
  isPreview: boolean;
  setIsPreview: React.Dispatch<React.SetStateAction<boolean>>;
  richTextSelection: RichTextareaSelectionState;
  onRichTextBold: () => void;
  onRichTextUnderline: () => void;
  onRichTextAlignment: (align: TextAlign) => void;
  onRichTextFontSize: (fontSize: number) => void;
  isRightRailHidden: boolean;
  setIsRightRailHidden: React.Dispatch<React.SetStateAction<boolean>>;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  saveStatus: SaveStatus;
  onOpenPalette: () => void;
  onOpenShortcuts: () => void;
  theme: EditorTheme;
  onToggleTheme: () => void;
}

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export const EditorHeader: React.FC<EditorHeaderProps> = ({ 
  paper, 
  settings, 
  setSettings,
  setPaper, 
  pages,
  handleSave,
  handleExit,
  isDownloading,
  setIsDownloading,
  bookletPages,
  setBookletPages,
  isPreview,
  setIsPreview,
  richTextSelection,
  onRichTextBold,
  onRichTextUnderline,
  onRichTextAlignment,
  onRichTextFontSize,
  isRightRailHidden,
  setIsRightRailHidden,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  saveStatus,
  onOpenPalette,
  onOpenShortcuts,
  theme,
  onToggleTheme,
}) => {
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  const downloadPdf = async () => {
    if (!paper || bookletPages.length === 0) return;
    setIsPdfGenerating(true);
    try {
      const res = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paper, settings, spreads: bookletPages }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Request failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'question-paper-booklet.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e: any) {
      console.error('PDF generation failed', e);
      alert('PDF generation failed: ' + (e?.message ?? e));
    } finally {
      setIsPdfGenerating(false);
      setBookletPages([]);
      setIsDownloading(false);
    }
  };

  const preparePdfDownload = () => {
    if (!paper || pages.length === 0) return;
    setIsDownloading(true);
    setBookletPages([]);

    const order: (PageContent[] | null)[] = buildBookletOrder(pages.length).map((index) =>
      index === null ? null : pages[index]
    );

    const spreads: BookletSpread[] = [];
    for (let i = 0; i < order.length; i += 2) {
      const leftArr = order[i];
      const rightArr = order[i + 1] ?? null;
      spreads.push({
        left: leftArr && leftArr.length > 0 ? { content: leftArr, isFirstPage: leftArr === pages[0] } : null,
        right: rightArr && rightArr.length > 0 ? { content: rightArr, isFirstPage: rightArr === pages[0] } : null,
      });
    }
    setBookletPages(spreads);
  };

  const SpreadSheet = ({ spread, index }: { spread: BookletSpread; index: number }) => {
    if (!paper) return null;
    const safeW = settings.width > 0 ? settings.width : 560;
    const safeH = settings.height > 0 ? settings.height : 794;
    const scale = Math.min(460 / safeW, 300 / safeH, 1);
    const sheetW = safeW * 2 * scale;
    const sheetH = safeH * scale;

    const renderHalf = (half: HalfPayload | null) => {
      if (!half) return <div className="w-1/2 h-full" />;
      return (
        <div className="w-1/2 h-full" style={{ position: 'relative' }}>
          <div style={{ width: safeW, height: safeH, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <PaperPage
              paper={paper}
              pageContent={half.content}
              isFirstPage={half.isFirstPage}
              settings={settings}
              allQuestions={paper.questions}
            />
          </div>
        </div>
      );
    };

    return (
      <div key={index} className="flex-shrink-0 bg-white shadow-lg" style={{ width: sheetW, height: sheetH }}>
        {renderHalf(spread.left)}
        {renderHalf(spread.right)}
      </div>
    );
  };


  // Ctrl/⌘+Shift+E (from the editor shortcut layer) opens the download preview
  const downloadRef = useRef(preparePdfDownload);
  downloadRef.current = preparePdfDownload;
  useEffect(() => {
    const handler = () => downloadRef.current();
    window.addEventListener('editor:download', handler);
    return () => window.removeEventListener('editor:download', handler);
  }, []);

  if (!paper) {
    return null; // Or a loading state
  }

  const status = {
    idle: { icon: Check, text: 'সংরক্ষিত', cls: 'text-slate-500' },
    saved: { icon: Check, text: 'সংরক্ষিত', cls: 'text-emerald-400/90' },
    dirty: { icon: Loader2, text: 'পরিবর্তন হয়েছে…', cls: 'text-slate-400' },
    saving: { icon: Loader2, text: 'সংরক্ষণ হচ্ছে…', cls: 'text-slate-400' },
    error: { icon: AlertCircle, text: 'সংরক্ষণ ব্যর্থ — আবার চেষ্টা করুন', cls: 'text-red-400' },
  }[saveStatus];
  const StatusIcon = status.icon;

  const iconBtn =
    'size-9 rounded-lg text-slate-400 hover:bg-white/[0.07] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent';

  const Tip = ({ label, shortcutId, children }: { label: string; shortcutId?: string; children: React.ReactNode }) => (
    <Tooltip delayDuration={350}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="flex items-center gap-2 border-white/10 bg-slate-900 text-xs text-slate-200">
        {label}
        {shortcutId && <ShortcutKeys id={shortcutId} />}
      </TooltipContent>
    </Tooltip>
  );

  return (
    <TooltipProvider>
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center border-b border-white/[0.06] bg-slate-950/80 px-3 backdrop-blur-xl sm:px-4">
        <div className="flex h-14 w-full items-center gap-3">
        {/* left: back + title + save status */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Tip label="ড্যাশবোর্ডে ফিরুন">
            <Button onClick={handleExit} variant="ghost" size="icon" aria-label="ড্যাশবোর্ডে ফিরুন" className={iconBtn}>
              <ArrowLeft className="size-4" />
            </Button>
          </Tip>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-white">{paper.examTitle || 'শিরোনামহীন প্রশ্নপত্র'}</p>
            <button
              type="button"
              onClick={saveStatus === 'error' ? handleSave : undefined}
              className={cn('flex items-center gap-1 text-[11px] transition-colors', status.cls, saveStatus === 'error' ? 'cursor-pointer hover:underline' : 'cursor-default')}
              aria-live="polite"
            >
              <StatusIcon className={cn('size-3', (saveStatus === 'saving' || saveStatus === 'dirty') && 'animate-spin')} />
              <span className="truncate">
                {paper.subject}{paper.grade ? ` · ${formatClassName(paper.grade)}` : ''} · {status.text}
              </span>
            </button>
          </div>
        </div>

        {/* centre: Edit | Preview and text formatting */}
        <div className="flex shrink-0 items-center gap-2">
          <div role="tablist" aria-label="দৃশ্য" className="hidden items-center rounded-xl bg-white/[0.05] p-1 sm:flex">
            {[
              { v: false, label: 'সম্পাদনা', icon: Pencil },
              { v: true, label: 'প্রিভিউ', icon: Eye },
            ].map(({ v, label, icon: Icon }) => (
              <button
                key={label}
                role="tab"
                aria-selected={isPreview === v}
                onClick={() => setIsPreview(v)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-all',
                  isPreview === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'
                )}
              >
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </div>
          {!isPreview && (
            <div className="flex items-center gap-1 border-l border-white/10 pl-2">
              <span className="hidden text-[11px] font-medium text-slate-500 lg:inline">লেখার বিন্যাস</span>
              <RichTextToolbar
                selectionState={richTextSelection}
                onBold={onRichTextBold}
                onUnderline={onRichTextUnderline}
                onAlignment={onRichTextAlignment}
                onFontSize={onRichTextFontSize}
              />
            </div>
          )}
        </div>

        {/* right: search, history, settings, tools, download */}
        <div className="flex flex-1 items-center justify-end gap-1">
          <button
            type="button"
            onClick={onOpenPalette}
            className="mr-1 hidden h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] pl-3 pr-2 text-[13px] text-slate-400 transition-colors hover:border-white/15 hover:bg-white/[0.06] hover:text-slate-200 lg:flex"
          >
            <Search className="size-3.5" />
            <span className="pr-4">খুঁজুন বা যোগ করুন…</span>
            <ShortcutKeys id="palette" />
          </button>
          <Tip label="পূর্বাবস্থায় ফিরুন" shortcutId="undo">
            <Button variant="ghost" size="icon" className={iconBtn} onClick={onUndo} disabled={!canUndo} aria-label="Undo">
              <Undo2 className="size-4" />
            </Button>
          </Tip>
          <Tip label="আবার করুন" shortcutId="redo">
            <Button variant="ghost" size="icon" className={iconBtn} onClick={onRedo} disabled={!canRedo} aria-label="Redo">
              <Redo2 className="size-4" />
            </Button>
          </Tip>
          <Tip label={theme === 'light' ? 'ডার্ক মোডে দেখুন' : 'লাইট মোডে দেখুন'} shortcutId="theme">
            <Button
              variant="ghost"
              size="icon"
              className={iconBtn}
              onClick={onToggleTheme}
              aria-label={theme === 'light' ? 'ডার্ক মোডে দেখুন' : 'লাইট মোডে দেখুন'}
              aria-pressed={theme === 'dark'}
            >
              {theme === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </Button>
          </Tip>
          <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
          <Dialog>
            <Tip label="পেপার সেটিংস">
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className={iconBtn} aria-label="পেপার সেটিংস">
                  <Settings className="size-4" />
                </Button>
              </DialogTrigger>
            </Tip>
            <DialogContent className="border-white/10 bg-slate-900 text-slate-100">
            <DialogHeader>
              <DialogTitle>পেপার সেটিংস</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Font Size: {settings.fontSize}pt</Label>
                  <Slider
                    value={[settings.fontSize]}
                    onValueChange={(value) => setSettings(s => ({...s, fontSize: value[0]}))}
                    min={8} max={18} step={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Line Spacing: {settings.lineHeight.toFixed(1)}</Label>
                  <Slider
                    value={[settings.lineHeight]}
                    onValueChange={(value) => setSettings(s => ({...s, lineHeight: value[0]}))}
                    min={1.0} max={2.5} step={0.1}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Label className="text-sm shrink-0">Question Numbering:</Label>
                <Select 
                  value={paper.mainNumberingFormat === undefined ? 'bangla-numeric' : (paper.mainNumberingFormat ?? 'none')}
                  onValueChange={(value: string) => {
                    setPaper(prev => prev ? { ...prev, mainNumberingFormat: value === 'none' ? null : (value as MainNumberingFormat) } : prev);
                  }}
                >
                  <SelectTrigger className="w-40 h-9 text-xs">
                    <SelectValue placeholder="Format" />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-slate-900 text-slate-100">
                    <SelectItem value="bangla-numeric">১, ২, ৩ (Bangla)</SelectItem>
                    <SelectItem value="english-numeric">1, 2, 3 (English)</SelectItem>
                    <SelectItem value="roman">i, ii, iii (Roman)</SelectItem>
                    <SelectItem value="none">কিছু না দেখাও</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Label className="text-sm shrink-0">Marks:</Label>
                <Select
                  value={paper.marksFormat ?? 'bangla-numeric'}
                  onValueChange={(value: MarksFormat) => {
                    setPaper(prev => prev ? { ...prev, marksFormat: value } : prev);
                  }}
                >
                  <SelectTrigger className="w-40 h-9 text-xs">
                    <SelectValue placeholder="Format" />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-slate-900 text-slate-100">
                    <SelectItem value="bangla-numeric">১, ২, ৩ (Bangla)</SelectItem>
                    <SelectItem value="english-numeric">1, 2, 3 (English)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-1">
                  <Label htmlFor="page-width" className="text-xs">Width (px)</Label>
                  <Input id="page-width" type="number" value={settings.width} onChange={e => setSettings(s => ({...s, width: parseInt(e.target.value) || 0}))} className="h-9 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-gray-400 border-slate-300 dark:border-slate-600 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:ring-2" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="page-height" className="text-xs">Height (px)</Label>
                  <Input id="page-height" type="number" value={settings.height} onChange={e => setSettings(s => ({...s, height: parseInt(e.target.value) || 0}))} className="h-9 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-gray-400 border-slate-300 dark:border-slate-600 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:ring-2" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="margin-top" className="text-xs">Top (mm)</Label>
                  <Input id="margin-top" type="number" value={settings.margins.top} onChange={e => setSettings(s => ({...s, margins: {...s.margins, top: parseInt(e.target.value) || 0}}))} className="h-9 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-gray-400 border-slate-300 dark:border-slate-600 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:ring-2"/>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="margin-bottom" className="text-xs">Bottom (mm)</Label>
                  <Input id="margin-bottom" type="number" value={settings.margins.bottom} onChange={e => setSettings(s => ({...s, margins: {...s.margins, bottom: parseInt(e.target.value) || 0}}))} className="h-9 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-gray-400 border-slate-300 dark:border-slate-600 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:ring-2"/>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="margin-left" className="text-xs">Left (mm)</Label>
                  <Input id="margin-left" type="number" value={settings.margins.left} onChange={e => setSettings(s => ({...s, margins: {...s.margins, left: parseInt(e.target.value) || 0}}))} className="h-9 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-gray-400 border-slate-300 dark:border-slate-600 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:ring-2"/>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="margin-right" className="text-xs">Right (mm)</Label>
                  <Input id="margin-right" type="number" value={settings.margins.right} onChange={e => setSettings(s => ({...s, margins: {...s.margins, right: parseInt(e.target.value) || 0}}))} className="h-9 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-gray-400 border-slate-300 dark:border-slate-600 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:ring-2"/>
                </div>
              </div>
            </div>
          </DialogContent>
          </Dialog>
          <Tip label="শর্টকাট তালিকা" shortcutId="help">
            <Button variant="ghost" size="icon" className={cn(iconBtn, 'hidden md:inline-flex')} onClick={onOpenShortcuts} aria-label="কীবোর্ড শর্টকাট">
              <Keyboard className="size-4" />
            </Button>
          </Tip>
          <Tip label={isRightRailHidden ? 'টুল প্যানেল দেখান' : 'টুল প্যানেল লুকান'} shortcutId="tools">
            <Button variant="ghost" size="icon" className={iconBtn} onClick={() => setIsRightRailHidden((v) => !v)} aria-label="টুল প্যানেল">
              {isRightRailHidden ? <PanelRightOpen className="size-4" /> : <PanelRightClose className="size-4" />}
            </Button>
          </Tip>
          <Dialog open={isDownloading} onOpenChange={(open) => { if (!open) { setBookletPages([]); setIsDownloading(false); } }}>
            <DialogTrigger asChild>
              <Button onClick={preparePdfDownload} className="ml-1 h-9 rounded-lg bg-teal-500 px-4 text-[13px] font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(45,212,191,0.4),0_6px_20px_-6px_rgba(45,212,191,0.5)] transition-all hover:bg-teal-400">
                <Download className="mr-2 size-4" /> ডাউনলোড
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl border-white/10 bg-slate-900 text-slate-100">
            <DialogHeader>
              <DialogTitle>বুকলেট ডাউনলোড প্রিভিউ</DialogTitle>
            </DialogHeader>
            <div className="mb-3 mt-2 overflow-x-auto app-scrollbar-light">
              {bookletPages.length > 0 ? (
                <div className="flex gap-3 rounded-md bg-gray-200 p-3">
                  {bookletPages.map((spread, index) => (
                    <SpreadSheet key={index} spread={spread} index={index} />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <p>প্রিভিউ তৈরি হচ্ছে…</p>
                </div>
              )}
            </div>
            <DialogFooter className="pt-3">
              <Button onClick={downloadPdf} disabled={bookletPages.length === 0 || isPdfGenerating} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {isPdfGenerating ? 'PDF তৈরি হচ্ছে…' : 'নিশ্চিত করে PDF ডাউনলোড'}
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        </div>
        </div>
      </header>
    </TooltipProvider>
  );
};
