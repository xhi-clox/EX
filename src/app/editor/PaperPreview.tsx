'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Paper } from './page';
import { PaperPage, PaperSettings, PageContent, TableEditCallbacks, ImageEditCallbacks } from './paper-render';

export { PaperPage };
export type { PaperSettings, PageContent };

interface PaperPreviewProps {
    paper: Paper;
    pages: PageContent[][];
    settings: PaperSettings;
    stacked?: boolean;
    tableEditCallbacks?: TableEditCallbacks | null;
    imageEditCallbacks?: ImageEditCallbacks | null;
}

export default function PaperPreview({ paper, pages, settings, stacked = false, tableEditCallbacks = null, imageEditCallbacks = null }: PaperPreviewProps) {
    const [currentPage, setCurrentPage] = React.useState(0);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [scale, setScale] = React.useState(1);

    React.useEffect(() => {
        if (currentPage >= pages.length) {
            setCurrentPage(Math.max(0, pages.length - 1));
        }
    }, [pages, currentPage]);

    React.useLayoutEffect(() => {
        const updateScale = () => {
            const el = containerRef.current;
            const safeW = settings.width > 0 ? settings.width : 560;
            if (!el || !safeW) return;
            // available width inside container (account for p-3 padding of parent + small gutter)
            const available = el.clientWidth;
            if (available <= 0) return;
            // keep a little breathing room so shadow not clipped
            const next = Math.min(1, (available - 8) / safeW);
            setScale(next > 0 ? next : 1);
        };
        updateScale();
        const ro = new ResizeObserver(updateScale);
        if (containerRef.current) ro.observe(containerRef.current);
        window.addEventListener('resize', updateScale);
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', updateScale);
        };
    }, [settings.width, settings.height]);

    if (!paper) {
        return <p>Loading preview...</p>;
    }

    const scaledWidth = settings.width * scale;
    const scaledHeight = settings.height * scale;

    if (stacked) {
        const allPages = pages.length > 0 ? pages : [[] as PageContent[]];
        // For side-by-side we fit to height as well and allow horizontal scroll
        // If only one page, keep centered single page (scale already fits width)
        return (
            <div ref={containerRef} className="w-full">
                <div className="flex gap-4 overflow-x-auto overflow-y-hidden pb-10 app-scrollbar-light snap-x snap-mandatory justify-start">
                    {allPages.map((pageContent, idx) => (
                        <div
                            key={idx}
                            className="flex-shrink-0 snap-center"
                            style={{ width: scaledWidth, height: scaledHeight }}
                        >
                            <div
                                style={{
                                    width: `${settings.width}px`,
                                    height: `${settings.height}px`,
                                    transform: `scale(${scale})`,
                                    transformOrigin: 'top left',
                                }}
                            >
                                {pageContent.length > 0 || pages.length > 0 ? (
                                    <PaperPage
                                        paper={paper}
                                        pageContent={pageContent}
                                        isFirstPage={idx === 0}
                                        settings={settings}
                                        allQuestions={paper.questions}
                                        tableEditCallbacks={tableEditCallbacks} imageEditCallbacks={imageEditCallbacks}
                                    />
                                ) : (
                                    <PaperPage paper={paper} pageContent={[]} isFirstPage={true} settings={settings} allQuestions={paper.questions} tableEditCallbacks={tableEditCallbacks} imageEditCallbacks={imageEditCallbacks} />
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                {pages.length > 1 && (
                    <p className="text-center text-xs text-slate-500 pt-1">{pages.length} pages • scroll horizontally to see all • page numbers keep order</p>
                )}
            </div>
        );
    }

  return (
    <>
        <div ref={containerRef} className="w-full space-y-4">
            {/* scaled viewport - reserves correct scaled height so bottom is never cut */}
            <div className="mx-auto flex justify-center" style={{ width: scaledWidth, height: scaledHeight }}>
                <div
                    style={{
                        width: `${settings.width}px`,
                        height: `${settings.height}px`,
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        flexShrink: 0,
                    }}
                >
                    {pages.length > 0 ? (
                        pages[currentPage] ? (
                            <PaperPage 
                                paper={paper} 
                                pageContent={pages[currentPage]} 
                                isFirstPage={currentPage === 0} 
                                settings={settings} 
                                allQuestions={paper.questions}
                                tableEditCallbacks={tableEditCallbacks} imageEditCallbacks={imageEditCallbacks}
                            />
                        ) : <div className="bg-white shadow-lg" style={{width: `${settings.width}px`, height: `${settings.height}px`}}><p className="p-4 text-center">Page {currentPage + 1} is empty or invalid.</p></div>
                    ) : (
                        <PaperPage paper={paper} pageContent={[]} isFirstPage={true} settings={settings} allQuestions={paper.questions} tableEditCallbacks={tableEditCallbacks} imageEditCallbacks={imageEditCallbacks} />
                    )}
                </div>
            </div>
        </div>
        
        {pages.length > 1 && (
            <div className="flex justify-center items-center gap-4 mt-4">
                <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}>
                    <ChevronLeft className="size-4" />
                </Button>
                <span className="text-sm text-slate-700 dark:text-slate-200">Page {currentPage + 1} of {pages.length}</span>
                <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.min(pages.length - 1, p + 1))} disabled={currentPage === pages.length - 1}>
                    <ChevronRight className="size-4" />
                </Button>
            </div>
        )}
    </>
  );
}