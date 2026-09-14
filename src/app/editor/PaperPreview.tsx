'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Paper } from './page';
import { PaperPage, PaperSettings, PageContent } from './paper-render';

export { PaperPage };
export type { PaperSettings, PageContent };

interface PaperPreviewProps {
    paper: Paper;
    pages: PageContent[][];
    settings: PaperSettings;
}

export default function PaperPreview({ paper, pages, settings }: PaperPreviewProps) {
    const [currentPage, setCurrentPage] = React.useState(0);

    React.useEffect(() => {
        if (currentPage >= pages.length) {
            setCurrentPage(Math.max(0, pages.length - 1));
        }
    }, [pages, currentPage]);

    if (!paper) {
        return <p>Loading preview...</p>;
    }

    const pageStyle = {
      width: `${settings.width}px`,
      height: `${settings.height}px`,
      overflow: 'hidden'
    };

  return (
    <>
        <div className="space-y-4">
            <div style={pageStyle} className="mx-auto">
              {pages.length > 0 ? (
                  pages[currentPage] ? (
                      <PaperPage 
                          paper={paper} 
                          pageContent={pages[currentPage]} 
                          isFirstPage={currentPage === 0} 
                          settings={settings} 
                          allQuestions={paper.questions}
                      />
                  ) : <div className="bg-white" style={{width: `${settings.width}px`, height: `${settings.height}px`}}><p className="p-4 text-center">Page {currentPage + 1} is empty or invalid.</p></div>
              ) : (
                  <PaperPage paper={paper} pageContent={[]} isFirstPage={true} settings={settings} allQuestions={paper.questions} />
              )}
            </div>
        </div>
        
        {pages.length > 1 && (
            <div className="flex justify-center items-center gap-4 mt-3">
                <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}>
                    <ChevronLeft className="size-4" />
                </Button>
                <span>Page {currentPage + 1} of {pages.length}</span>
                <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.min(pages.length - 1, p + 1))} disabled={currentPage === pages.length - 1}>
                    <ChevronRight className="size-4" />
                </Button>
            </div>
        )}
    </>
  );
}