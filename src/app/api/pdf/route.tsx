import { NextRequest, NextResponse } from 'next/server';
import * as React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import type { Browser } from 'playwright';
import { PaperPage } from '../../editor/paper-render';
import type { Paper, PaperSettings, PageContent } from '../../editor/page';

export interface HalfPayload {
  content: PageContent[];
  isFirstPage: boolean;
}

export interface BookletSpread {
  left: HalfPayload | null;
  right: HalfPayload | null;
}

interface GenerateRequest {
  paper: Paper;
  settings: PaperSettings;
  spreads: BookletSpread[];
}

const SHEET_W = 1122.52;
const SHEET_H = 793.7;
const HALF_W = SHEET_W / 2;

const KATEX_FONTS_CDN = 'https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/';

const katexCss = (() => {
  try {
    const p = path.join(process.cwd(), 'node_modules', 'katex', 'dist', 'katex.min.css');
    const css = fs.readFileSync(p, 'utf8');
    return css.replace(/url\(fonts\//g, `url(${KATEX_FONTS_CDN}fonts/`);
  } catch {
    return '';
  }
})();

const baseCss = `
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; line-height: 1.5; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1, h2, h3, h4, h5, h6 { margin: 0; font-size: inherit; font-weight: inherit; }
p { margin: 0; }
ul, ol { list-style: none; margin: 0; padding: 0; }
blockquote, dl, dd { margin: 0; }
textarea, input { font-family: inherit; font-size: inherit; }
.sheet {
  width: ${SHEET_W}px;
  height: ${SHEET_H}px;
  overflow: hidden;
  position: relative;
  break-inside: avoid;
}
.half {
  position: absolute;
  top: 0;
  width: ${HALF_W}px;
  height: ${SHEET_H}px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.half.right { left: ${HALF_W}px; }

.bg-white { background-color: #fff; }
.text-black { color: #000; }
.font-serif { font-family: 'SolaimanLipi', 'Noto Serif Bengali', Georgia, 'Times New Roman', serif; }
.text-center { text-align: center; }
.font-bold { font-weight: 700; }
.font-semibold { font-weight: 600; }
.underline { text-decoration: underline; }
.decoration-dotted { text-decoration-style: dotted; }
.mb-6 { margin-bottom: 1.5rem; }
.mb-2 { margin-bottom: 0.5rem; }
.mt-1 { margin-top: 0.25rem; }
.my-4 { margin-top: 1rem; margin-bottom: 1rem; }
.pt-1 { padding-top: 0.25rem; }
.pt-8 { padding-top: 2rem; }
.pl-6 { padding-left: 1.5rem; }
.pl-8 { padding-left: 2rem; }
.text-sm { font-size: 0.875rem; }
.text-lg { font-size: 1.125rem; }
.text-xl { font-size: 1.25rem; }
.flex { display: flex; }
.justify-between { justify-content: space-between; }
.flex-1 { flex: 1 1 0%; }
.grid { display: grid; }
.grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.gap-x-8 { column-gap: 2rem; }
.gap-y-1 { row-gap: 0.25rem; }
` as const;

async function getBrowser(): Promise<Browser> {
  const g = globalThis as any;
  if (!g.__pdfBrowserPromise) {
    g.__pdfBrowserPromise = chromium.launch({ headless: true }).catch((err) => {
      g.__pdfBrowserPromise = null;
      throw err;
    });
  }
  return g.__pdfBrowserPromise;
}

async function renderHalf(half: HalfPayload | null, paper: Paper, settings: PaperSettings): Promise<string | null> {
  if (!half || half.content.length === 0) return null;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const html = renderToStaticMarkup(
    React.createElement(PaperPage, {
      paper,
      pageContent: half.content,
      isFirstPage: half.isFirstPage,
      settings,
      allQuestions: paper.questions,
    })
  );
  const preScale = Math.min(HALF_W / settings.width, SHEET_H / settings.height);
  const s = preScale.toFixed(6);
  // height is intentionally omitted: it is measured in the browser (real content
  // height) and the per-page scale is recomputed so content is never clipped.
  return `
    <div class="page-anchor" style="width:${settings.width}px;transform:scale(${s});transform-origin:center;">
      ${html}
    </div>`;
}

async function buildHtml(req: GenerateRequest): Promise<string> {
  const { paper, settings, spreads } = req;
  const sheets = [];
  for (let idx = 0; idx < spreads.length; idx++) {
    const sp = spreads[idx];
    const left = await renderHalf(sp.left, paper, settings);
    const right = await renderHalf(sp.right, paper, settings);
    const pageBreak =
      idx < spreads.length - 1
        ? 'page-break-after: always; break-after: page; '
        : '';
    sheets.push(`
    <div class="sheet" style="${pageBreak}">
      <div class="half">${left ?? ''}</div>
      <div class="half right">${right ?? ''}</div>
    </div>`);
  }

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${katexCss}</style>
    <style>${baseCss}</style>
  </head>
  <body>${sheets.join('\n')}</body>
</html>`;
}

export async function POST(req: NextRequest) {
  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.paper || !body.settings || !Array.isArray(body.spreads)) {
    return NextResponse.json({ error: 'Missing paper, settings, or spreads' }, { status: 400 });
  }

  const html = await buildHtml(body);

  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluate(() => (document as any).fonts?.ready);
      // Let layout settle after webfonts load, then measure each page's real
      // content height and rescale it to fit its half without clipping.
      await new Promise((r) => setTimeout(r, 300));
      await page.evaluate(() => {
        const HALF_W = 561.26;
        const SHEET_H = 793.7;
        document.querySelectorAll('.page-anchor').forEach((a) => {
          const w = parseFloat((a as HTMLElement).style.width) || 0;
          const h = (a as HTMLElement).offsetHeight;
          if (w <= 0 || h <= 0) return;
          const s = Math.min(HALF_W / w, SHEET_H / h);
          (a as HTMLElement).style.height = h + 'px';
          (a as HTMLElement).style.transform = 'scale(' + s.toFixed(6) + ')';
        });
      });
      await page.emulateMedia({ media: 'print' });
      const pdf = await page.pdf({
        preferCSSPageSize: true,
        printBackground: true,
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
      });

      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="question-paper-booklet.pdf"',
        },
      });
    } finally {
      await page.close().catch(() => {});
    }
  } catch (e: any) {
    console.error('[api/pdf] failed:', e);
    return NextResponse.json(
      { error: 'PDF generation failed: ' + (e?.message ?? String(e)) },
      { status: 500 }
    );
  }
}