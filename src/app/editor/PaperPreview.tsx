
'use client';

import React from 'react';
import type { Paper, Question, NumberingFormat } from './page';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import LatexRenderer from './LatexRenderer';

export interface PaperSettings {
  margins: { top: number; bottom: number; left: number; right: number; };
  width: number;
  height: number;
  fontSize: number;
  lineHeight: number;
}

export type PageContent = {
    mainQuestion: Question;
    subQuestions: Question[];
    showMainContent: boolean;
}

const subjectMap: { [key: string]: string } = {
  bangla: 'বাংলা',
  english: 'English',
  math: 'গণিত',
  science: 'বিজ্ঞান',
};

const gradeMap: { [key: string]: string } = {
    '9': 'নবম',
    '10': 'দশম',
};

const getNumbering = (format: NumberingFormat | undefined, index: number): string => {
  const banglaNumerals = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  const banglaAlphabet = ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ', 'ট', 'ঠ', 'ড', 'ঢ', 'ণ', 'ত', 'থ', 'দ', 'ধ', 'ন'];
  const toRoman = (num: number): string => {
    const roman = {M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1};
    let str = '';
    for (let i of Object.keys(roman)) {
      let q = Math.floor(num / (roman as any)[i]);
      num -= q * (roman as any)[i];
      str += i.repeat(q);
    }
    return str.toLowerCase();
  };

  switch (format) {
    case 'bangla-numeric':
      return (index + 1).toString().split('').map(d => banglaNumerals[parseInt(d)]).join('');
    case 'roman':
      return toRoman(index + 1);
    case 'bangla-alpha':
    default:
      return banglaAlphabet[index % banglaAlphabet.length];
  }
};

export const renderQuestionContent = (question: Question, questionIndex: number, allQuestions: Question[], showMainContent: boolean, subQuestionsToRender: Question[] = []) => {
    if (question.type === 'section-header') {
        return (
            <div key={question.id} className="text-center font-bold underline decoration-dotted text-lg my-4" data-question-id={question.id}>
                <div className="question-content"><LatexRenderer content={question.content} /></div>
            </div>
        );
    }

    const mainQuestionObj = allQuestions.find(q => q.id === question.id);

    return (
      <div key={`${question.id}-${showMainContent}-${subQuestionsToRender.map(sq => sq.id).join('-')}`} className="mb-2 question-item" data-question-id={question.id}>
        {showMainContent && (
            <div className="flex justify-between font-semibold question-content">
                <p className="flex-1">{questionIndex}. <LatexRenderer content={question.content} /></p>
                {question.type !== 'creative' && question.marks && question.marks > 0 && <p>{question.marks}</p>}
            </div>
        )}
  
        {subQuestionsToRender && subQuestionsToRender.length > 0 && (
          <div className="pl-6">
            {subQuestionsToRender.map((sq) => {
              const sqIndex = mainQuestionObj?.subQuestions?.findIndex(osq => osq.id === sq.id) ?? -1;
              if (sqIndex === -1) return null;

              return (
                <div key={sq.id} className="subquestion-item pt-1" data-subquestion-id={sq.id}>
                  <div className="flex justify-between">
                    <p>{getNumbering(mainQuestionObj?.numberingFormat, sqIndex)}) <LatexRenderer content={sq.content} /></p>
                    {mainQuestionObj?.type === 'creative' && sq.marks && sq.marks > 0 && <p>{sq.marks}</p>}
                  </div>
                  {sq.options && sq.options.length > 0 && (
                    <div className="pl-6 mt-1 grid grid-cols-2 gap-x-8 gap-y-1">
                      {sq.options.map((option, optIndex) => (
                        <p key={option.id}>{getNumbering('bangla-alpha', optIndex)}) <LatexRenderer content={option.text} /></p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
  
        {showMainContent && question.type !== 'mcq' && question.options && question.options.length > 0 && (
          <div className="pl-6 mt-1 grid grid-cols-2 gap-x-8 gap-y-1">
            {question.options.map((option, optIndex) => (
              <p key={option.id}>{getNumbering('bangla-alpha', optIndex)}) <LatexRenderer content={option.text} /></p>
            ))}
          </div>
        )}
      </div>
    );
};

export const PaperPage = React.forwardRef<HTMLDivElement, { paper: Paper; pageContent: PageContent[]; isFirstPage: boolean; settings: PaperSettings; allQuestions: Question[] }>(({ paper, pageContent, isFirstPage, settings, allQuestions }, ref) => {
    const getSubjectName = (subjectKey: string) => subjectMap[subjectKey] || subjectKey;
    const getGradeName = (gradeKey: string) => gradeMap[gradeKey] || gradeKey;
    
    const pageStyle: React.CSSProperties = {
        width: `${settings.width}px`,
        minHeight: `${settings.height}px`,
        paddingTop: `${settings.margins.top}mm`,
        paddingBottom: `${settings.margins.bottom}mm`,
        paddingLeft: `${settings.margins.left}mm`,
        paddingRight: `${settings.margins.right}mm`,
        fontSize: `${settings.fontSize}pt`,
        lineHeight: settings.lineHeight,
        boxSizing: 'border-box'
    };

    const allQuestionIds = allQuestions.filter(q => q.type !== 'section-header').map(q => q.id);

    return (
        <div ref={ref} className="bg-white text-black font-serif max-w-none mx-auto shadow-lg paper-page" style={pageStyle}>
            {isFirstPage && (
                <>
                    <header className="text-center mb-6 preview-header">
                        <h1 className="text-xl font-bold">{paper.schoolName}</h1>
                        <h2 className="text-lg">{paper.examTitle}</h2>
                    </header>

                    <div className="flex justify-between text-sm mb-6">
                        <p>বিষয়: {getSubjectName(paper.subject)}</p>
                        <p>পূর্ণমান: {paper.totalMarks}</p>
                    </div>
                    <div className="flex justify-between text-sm mb-6">
                        <p>শ্রেণি: {getGradeName(paper.grade)}</p>        
                        <p>সময়: {paper.timeAllowed}</p>
                    </div>
                    {paper.notes && (
                        <div className="text-center text-sm font-semibold mb-6">
                            <p>{paper.notes}</p>
                        </div>
                    )}
                </>
            )}

            <main className={!isFirstPage ? 'pt-8' : ''}>
                {pageContent.map(content => {
                    let questionNumber = 0;
                    if (content.mainQuestion.type !== 'section-header') {
                      const idx = allQuestionIds.indexOf(content.mainQuestion.id);
                      if (idx !== -1) {
                          questionNumber = idx + 1;
                      }
                    }
                    return renderQuestionContent(content.mainQuestion, questionNumber, allQuestions, content.showMainContent, content.subQuestions);
                })}
            </main>
        </div>
    );
});
PaperPage.displayName = "PaperPage";

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
            <div className="flex justify-center items-center gap-4 mt-4">
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
