
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Settings, Eye, Download, LogOut, FileText, Trash2, ArrowUp, ArrowDown, Plus, ArrowLeft } from 'lucide-react';
import type { Paper, PaperSettings, PageContent, BookletSpread, HalfPayload, MainNumberingFormat } from './page';
import PaperPreview from './PaperPreview';
import { PaperPage } from './paper-render';

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
}

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
  setBookletPages
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

    const padded: (PageContent[] | null)[] = [...pages];
    if (padded.length % 2 !== 0) {
      padded.push(null);
    }
    const n = padded.length;
    const order: (PageContent[] | null)[] = [];
    for (let i = 0; i < n / 2; i++) {
      if (i % 2 === 0) {
        order.push(padded[n - 1 - i]);
        order.push(padded[i]);
      } else {
        order.push(padded[i]);
        order.push(padded[n - 1 - i]);
      }
    }

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
    const sheetW = 842;
    const sheetH = 595;
    const halfW = sheetW / 2;
    const scale = Math.min(halfW / settings.width, sheetH / settings.height);

    const renderHalf = (half: HalfPayload | null) => {
      if (!half) return null;
      return (
        <div className="w-1/2 h-full overflow-visible flex items-center justify-center">
          <div style={{ width: settings.width, height: settings.height, transform: `scale(${scale})`, transformOrigin: 'center' }}>
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
      <div key={index} className="flex-shrink-0 bg-white shadow-lg flex" style={{ width: sheetW, height: sheetH }}>
        {renderHalf(spread.left)}
        {renderHalf(spread.right)}
      </div>
    );
  };


  if (!paper) {
    return null; // Or a loading state
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-700/60 bg-slate-900 px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button onClick={handleExit} variant="ghost" size="icon" title="Back to dashboard" className="shrink-0 text-slate-400 hover:bg-slate-800 hover:text-white">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold text-white">{paper.examTitle || 'Untitled Paper'}</p>
          <p className="truncate text-xs text-slate-400">{paper.subject}{paper.grade ? ` • Class ${paper.grade}` : ''}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="text-white border-slate-600 hover:bg-slate-700 hover:text-white"><Settings className="mr-2 size-4" /> Paper Settings</Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-800 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle>Paper Settings</DialogTitle>
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
                  value={paper.mainNumberingFormat ?? 'english-numeric'}
                  onValueChange={(value: MainNumberingFormat) => {
                    setPaper(prev => prev ? { ...prev, mainNumberingFormat: value } : prev);
                  }}
                >
                  <SelectTrigger className="w-40 h-9 text-xs">
                    <SelectValue placeholder="Format" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    <SelectItem value="english-numeric">1, 2, 3 (English)</SelectItem>
                    <SelectItem value="bangla-numeric">১, ২, ৩ (Bangla)</SelectItem>
                    <SelectItem value="roman">i, ii, iii (Roman)</SelectItem>
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
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="text-white border-slate-600 hover:bg-slate-700 hover:text-white"><Eye className="mr-2 size-4" /> Preview</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl h-[90vh] flex flex-col bg-slate-800 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle>Question Paper Preview</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto app-scrollbar-light bg-gray-100 p-3">
              <PaperPreview 
                paper={paper} 
                pages={pages}
                settings={settings}
              />
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={isDownloading} onOpenChange={(open) => { if(!open) { setBookletPages([]); setIsDownloading(false); }}}>
          <DialogTrigger asChild>
            <Button onClick={preparePdfDownload} className="bg-primary hover:bg-primary/90 text-primary-foreground"><Download className="mr-2 size-4" /> Download</Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl bg-slate-800 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle>Booklet Download Preview</DialogTitle>
            </DialogHeader>
            <div className="mb-3 mt-2 overflow-x-auto app-scrollbar-light">
              {bookletPages.length > 0 ? (
                <div className="flex gap-3 rounded-md bg-gray-200 p-3">
                  {bookletPages.map((spread, index) => (
                    <SpreadSheet spread={spread} index={index} />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <p>Generating PDF preview...</p>
                </div>
              )}
            </div>
            <DialogFooter className="pt-3">
              <Button onClick={downloadPdf} disabled={bookletPages.length === 0 || isPdfGenerating} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {isPdfGenerating ? 'Generating PDF...' : 'Confirm and Download PDF'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={handleSave} variant="outline" className="text-white border-slate-600 hover:bg-slate-700 hover:text-white">
          <Save className="mr-2 size-4" /> Save
        </Button>
        <Button onClick={handleExit} variant="outline" className="text-white border-red-500/50 hover:bg-red-500/10 hover:text-white hover:border-red-500">
          <LogOut className="mr-2 size-4" /> Exit
        </Button>
      </div>
    </header>
  );
};
