
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Settings, Eye, Download, LogOut, FileText, Trash2, ArrowUp, ArrowDown, Plus } from 'lucide-react';
import type { Paper, PaperSettings, PageContent } from './page';
import PaperPreview from './PaperPreview';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { createRoot } from 'react-dom/client';
import { PaperPage } from './PaperPreview';

interface EditorHeaderProps {
  paper: Paper | null;
  settings: PaperSettings;
  setSettings: React.Dispatch<React.SetStateAction<PaperSettings>>;
  pages: PageContent[][];
  handleSave: () => void;
  handleExit: () => void;
  isDownloading: boolean;
  setIsDownloading: React.Dispatch<React.SetStateAction<boolean>>;
  bookletPages: { left: string | null; right: string | null; }[];
  setBookletPages: React.Dispatch<React.SetStateAction<{ left: string | null; right: string | null; }[]>>;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({ 
  paper, 
  settings, 
  setSettings, 
  pages,
  handleSave,
  handleExit,
  isDownloading,
  setIsDownloading,
  bookletPages,
  setBookletPages
}) => {
  const [katexCss, setKatexCss] = useState('');

  useEffect(() => {
    // Fetch KaTeX CSS to inject it for PDF generation
    fetch('https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css')
      .then(response => response.text())
      .then(css => setKatexCss(css))
      .catch(err => console.error("Failed to fetch KaTeX CSS", err));
  }, []);

  const generatePdf = async () => {
    if (!paper || bookletPages.length === 0) return;
    
    const a4Width = 842; 
    const a4Height = 595;
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4',
    });

    const addImageToPdf = async (canvasDataUrl: string | null, x: number) => {
      if (!canvasDataUrl) return;
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          try {
            const a4HalfWidth = a4Width / 2;
            const a4HalfHeight = a4Height;
    
            const scale = Math.min(a4HalfWidth / img.naturalWidth, a4HalfHeight / img.naturalHeight);
            const drawWidth = img.naturalWidth * scale;
            const drawHeight = img.naturalHeight * scale;
    
            const drawX = x + (a4HalfWidth - drawWidth) / 2;
            const drawY = (a4HalfHeight - drawHeight) / 2;
    
            pdf.addImage(img, 'PNG', drawX, drawY, drawWidth, drawHeight);
            resolve();
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = (e) => reject(e);
        img.src = canvasDataUrl;
      });
    };

    for (let i = 0; i < bookletPages.length; i++) {
        if (i > 0) {
            pdf.addPage();
        }
        const bookletPage = bookletPages[i];
        await addImageToPdf(bookletPage.left, 0);
        await addImageToPdf(bookletPage.right, a4Width / 2);
    }
    
    pdf.save('question-paper-booklet.pdf');
    setIsDownloading(false);
    setBookletPages([]);
  };

  const preparePdfDownload = async () => {
    if (!paper || pages.length === 0 || !katexCss) {
        if (!katexCss) console.error("KaTeX CSS not loaded yet.");
        return;
    }
    
    setIsDownloading(true);
    setBookletPages([]);

    const captureNode = async (pageIndex: number | null): Promise<string | null> => {
        if (pageIndex === null || !paper) return null;
        const pageContent = pages[pageIndex];
        if (!pageContent) return null;
    
        const mmToPx = (mm: number) => mm * 3.7795275591;
        const printCSS = `
            ${katexCss} /* Inject KaTeX CSS */
            * { box-sizing: border-box; }
            html, body { margin: 0; padding: 0; }
            .pdf-render-root {
            width: ${settings.width}px;
            min-height: ${settings.height}px;
            font-family: "PT Sans", "Noto Sans Bengali", Arial, sans-serif;
            font-size: ${settings.fontSize}pt;
            line-height: ${settings.lineHeight};
            margin: 0;
            padding: ${mmToPx(settings.margins.top)}px ${mmToPx(settings.margins.right)}px ${mmToPx(settings.margins.bottom)}px ${mmToPx(settings.margins.left)}px;
            background: #fff;
            color: #000;
            }
            .pdf-render-root p { margin: 0 0 4px 0; }
            .pdf-render-root h1,h2,h3 { margin: 0 0 6px 0; }
            .pdf-render-root ul, .pdf-render-root ol { margin: 0 0 6px 1.2em; padding: 0; }
            .pdf-render-root textarea, .pdf-render-root input { font-family: inherit; font-size: inherit; }
        `;
    
        const pageContainer = document.createElement('div');
        pageContainer.style.position = 'absolute';
        pageContainer.style.left = '-9999px';
        pageContainer.style.top = '0';
        document.body.appendChild(pageContainer);
    
        let root = null as any;
        try {
            const styleEl = document.createElement('style');
            styleEl.textContent = printCSS;
            pageContainer.appendChild(styleEl);
    
            const wrapper = document.createElement('div');
            wrapper.className = 'pdf-render-root';
            pageContainer.appendChild(wrapper);
    
            const nodeToRender = (
            <PaperPage
                paper={paper}
                pageContent={pageContent}
                isFirstPage={pageIndex === 0}
                settings={settings}
                allQuestions={paper.questions}
            />
            );
    
            root = createRoot(wrapper);
            root.render(nodeToRender);
    
            if ((document as any).fonts && (document as any).fonts.ready) {
                try { await (document as any).fonts.ready; } catch(e) { /* ignore */ }
            }
    
            const imgs = wrapper.querySelectorAll('img');
            if (imgs.length > 0) {
            await Promise.all(Array.from(imgs).map((img) => {
                const i = img as HTMLImageElement;
                if (i.complete) return Promise.resolve();
                return new Promise<void>(res => { i.onload = i.onerror = () => res(); });
            }));
            }
            
            await new Promise(r => setTimeout(r, 100)); // Increased delay for KaTeX
    
            const canvas = await html2canvas(wrapper as HTMLElement, {
                scale: 2,
                useCORS: true,
                allowTaint: false,
                backgroundColor: '#fff',
            });
    
            return canvas.toDataURL('image/png');
        } catch (err) {
            console.error('captureNode error:', err);
            setIsDownloading(false);
            return null;
        } finally {
            try {
                if (root) root.unmount();
            } catch (_) {}
            if (pageContainer.parentNode) pageContainer.parentNode.removeChild(pageContainer);
        }
    };
  
    let n = pages.length;
    const paddedPageIndices: (number | null)[] = [...Array(n).keys()];
    while (paddedPageIndices.length % 4 !== 0 && paddedPageIndices.length > 0) {
      paddedPageIndices.push(null);
    }
    n = paddedPageIndices.length;
  
    const bookletOrderIndices: (number | null)[] = [];
    if (n > 0) {
      for (let i = 0; i < n / 2; i++) {
        if (i % 2 === 0) {
          bookletOrderIndices.push(paddedPageIndices[n - 1 - i]);
          bookletOrderIndices.push(paddedPageIndices[i]);
        } else {
          bookletOrderIndices.push(paddedPageIndices[i]);
          bookletOrderIndices.push(paddedPageIndices[n - 1 - i]);
        }
      }
    }
  
    try {
        const finalBookletPages = [];
        for (let i = 0; i < bookletOrderIndices.length; i += 2) {
          const leftPageIndex = bookletOrderIndices[i];
          const rightPageIndex = bookletOrderIndices[i + 1];
      
          const [leftCanvasUrl, rightCanvasUrl] = await Promise.all([
              captureNode(leftPageIndex),
              captureNode(rightPageIndex),
          ]);
          
          finalBookletPages.push({ left: leftCanvasUrl, right: rightCanvasUrl });
        }
        setBookletPages(finalBookletPages);
    } catch(e) {
        console.error("Failed to prepare PDF download", e);
        setIsDownloading(false);
    }
  };


  if (!paper) {
    return null; // Or a loading state
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b bg-slate-900 px-4 sm:px-6">
       <div>{/* Placeholder for left content */}</div>
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
            <div className="flex-1 overflow-auto bg-gray-100 p-4">
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
            <div className="my-4 overflow-x-auto">
              {bookletPages.length > 0 ? (
                <div className="flex gap-4 p-4 bg-gray-200">
                  {bookletPages.map((page, index) => (
                    <div key={index} className="flex-shrink-0 bg-white shadow-lg flex" style={{width: '842px', height: '595px'}}>
                      <div className="w-1/2 h-full border-r border-gray-300">
                        {page.left && <img src={page.left} alt={`Page ${index} Left`} className="w-full h-full object-contain" />}
                      </div>
                      <div className="w-1/2 h-full">
                        {page.right && <img src={page.right} alt={`Page ${index} Right`} className="w-full h-full object-contain" />}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <p>Generating PDF preview...</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={generatePdf} disabled={bookletPages.length === 0}>Confirm and Download PDF</Button>
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
