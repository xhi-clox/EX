import React from 'react';
import katex from 'katex';
import type { Paper, Question, NumberingFormat, MainNumberingFormat, MarksFormat } from './page';
import EditableTable from './EditableTable';
import EditableImage from './EditableImage';
import { imageFilterCss, imageGroupStyle, imageItemStyle, getQuestionImages } from './image-style';
import { headerFieldText, subjectLabel, gradeLabel } from './header-template';

export interface TableEditCallbacks {
  onCellChange: (questionId: string, row: number, col: number, value: string) => void;
  onAddRow: (questionId: string) => void;
  onRemoveRow: (questionId: string, row: number) => void;
  onAddCol: (questionId: string) => void;
  onRemoveCol: (questionId: string, col: number) => void;
  onResizeRow: (questionId: string, row: number, height: number) => void;
  onColWidths: (questionId: string, widths: number[]) => void;
  onMarginLeftChange: (questionId: string, value: number) => void;
}

export interface ImageEditCallbacks {
  onImageChange: (
    questionId: string,
    patch: {
      imageWidth?: number;
      imageAlign?: 'left' | 'center' | 'right';
      imageGrayscale?: number;
      imageBrightness?: number;
      imageContrast?: number;
      imageLight?: number;
    }
  ) => void;
}

export interface PaperSettings {
  margins: { top: number; bottom: number; left: number; right: number; };
  width: number;
  height: number;
  fontSize: number;
  lineHeight: number;
}

// Guaranteed breathing room at the bottom of the artboard so the last line of a
// page is never clipped or hidden at the paper edge.
export const MIN_BOTTOM_PADDING_MM = 10;

// One sub-question as rendered on a single page. When the sub-question's option
// grid spills across pages, `content` shows the numbered line only on the page
// where it starts and `optionRows` slices the grid (inclusive, 0-based rows).
export type SubPart = {
    sub: Question;
    content: boolean;
    optionRows: readonly [number, number] | null;
};

export type PageContent = {
    mainQuestion: Question;
    subParts: SubPart[];
    showMainContent: boolean;
    tableRows: readonly [number, number] | null;  // built-in (hints/substitution) table rows to render on this page
    optionRows: readonly [number, number] | null; // main-level options grid rows to render on this page
}

const toBanglaDigits = (value: string | number): string =>
  String(value)
    .split('')
    .map((d) => (d >= '0' && d <= '9' ? ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'][parseInt(d)] : d))
    .join('');

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
    case 'english-numeric':
      return String(index + 1);
    case 'bangla-numeric':
      return (index + 1).toString().split('').map(d => banglaNumerals[parseInt(d)]).join('');
    case 'roman':
      return toRoman(index + 1);
    case 'bangla-alpha':
    default:
      return banglaAlphabet[index % banglaAlphabet.length];
  }
};

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const renderMathToHtml = (content: string): string => {
  if (!content) return '';

  const inlineRegex = /\$([^$]+)\$/g;
  const blockRegex = /\$\$([^$]+)\$\$/g;
  const inlineParenRegex = /\\\(([^]+?)\\\)/g;
  const blockBracketRegex = /\\\[([^]+?)\\\]/g;

  const ranges: Array<{ start: number; end: number; content: string; type: 'block' | 'inline' }> = [];

  let match;
  while ((match = blockRegex.exec(content)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length, content: match[1], type: 'block' });
  }
  while ((match = blockBracketRegex.exec(content)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length, content: match[1], type: 'block' });
  }
  while ((match = inlineRegex.exec(content)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length, content: match[1], type: 'inline' });
  }
  while ((match = inlineParenRegex.exec(content)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length, content: match[1], type: 'inline' });
  }

  ranges.sort((a, b) => a.start - b.start);

  if (ranges.length === 0) return escapeHtml(content);

  let html = '';
  let lastIndex = 0;
  ranges.forEach((r) => {
    if (r.start > lastIndex) html += escapeHtml(content.substring(lastIndex, r.start));
    try {
      html += katex.renderToString(r.content.trim(), {
        displayMode: r.type === 'block',
        throwOnError: false,
      });
    } catch {
      html += escapeHtml(r.content.trim());
    }
    lastIndex = r.end;
  });
  if (lastIndex < content.length) html += escapeHtml(content.substring(lastIndex));

  return html;
};

const RichText = ({ content }: { content: string }) => (
  <span dangerouslySetInnerHTML={{ __html: renderMathToHtml(content) }} />
);

const renderTableContent = (question: Question, rowRange: readonly [number, number] | null = null) => {
    const tableData = question.tableData;
    if (!tableData || tableData.length === 0) return null;
    const colCount = tableData[0]?.length ?? 0;
    const rawWidths = question.tableColWidths && question.tableColWidths.length === colCount ? question.tableColWidths : [];
    const positives = rawWidths.filter((w) => w > 0);
    const fallback = positives.length ? Math.round(positives.reduce((a, b) => a + b, 0) / positives.length) : 0;
    const widths = rawWidths.length ? rawWidths.map((w) => (w > 0 ? w : fallback)) : Array(colCount).fill(0);
    const sumPx = widths.reduce((a, b) => a + b, 0);
    const hasExplicit = sumPx > 0;
    const firstRow = rowRange ? rowRange[0] : 0;
    const lastRow = rowRange ? rowRange[1] : tableData.length - 1;
    if (lastRow < firstRow) return null;
    return (
        <table style={{ width: hasExplicit ? `${sumPx}px` : '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
                {widths.map((w, ci) => (
                    <col key={ci} style={w > 0 ? { width: w } : undefined} />
                ))}
            </colgroup>
            <tbody>
                {tableData.slice(firstRow, lastRow + 1).map((row, rowIndex) => {
                    const globalRowIndex = firstRow + rowIndex;
                    return (
                    <tr key={globalRowIndex} data-table-row={globalRowIndex} style={question.tableRowHeights && question.tableRowHeights[globalRowIndex] > 0 ? { height: question.tableRowHeights[globalRowIndex] } : undefined}>
                        {row.map((cell, colIndex) => (
                            <td key={colIndex} style={{ border: '1px solid #000', padding: '2px 4px', verticalAlign: 'top' }}>
                                <RichText content={cell ?? ''} />
                            </td>
                        ))}
                    </tr>
                    );
                })}
            </tbody>
        </table>
    );
};

// Renders an options list as 2-per-row lines that are individually paginatable.
// Row sub-sets keep their original letters (ক) খ) ...) so a grid continued on the
// next page stays correctly numbered.
const renderOptionsGrid = (options: { id: string; text: string }[], rowRange: readonly [number, number] | null = null) => {
    const rowStart = rowRange ? rowRange[0] * 2 : 0;
    const rowEnd = rowRange ? (rowRange[1] + 1) * 2 : options.length;
    const rowGroups: Array<{ opt: { id: string; text: string }; index: number }>[] = [];
    for (let i = rowStart; i < rowEnd; i += 2) {
        const chunk = options.slice(i, i + 2).map((opt, j) => ({ opt, index: i + j }));
        if (chunk.length > 0) rowGroups.push(chunk);
    }
    if (rowGroups.length === 0) return null;
    return (
        <div className="pl-6 mt-1">
            {rowGroups.map((chunk, gi) => (
                <div key={gi} className="option-row flex gap-x-8 mb-1" data-option-row={rowRange ? rowRange[0] + gi : gi}>
                    {chunk.map(({ opt, index }) => (
                        <p key={opt.id} className="flex-1">{getNumbering('bangla-alpha', index)}) <RichText content={opt.text} /></p>
                    ))}
                    {chunk.length === 1 && <span key="spacer" className="flex-1" aria-hidden />}
                </div>
            ))}
        </div>
    );
};

export const renderQuestionContent = (question: Question, questionIndex: number, allQuestions: Question[], showMainContent: boolean, subParts: SubPart[] = [], mainNumberingFormat: MainNumberingFormat = 'bangla-numeric', marksFormat: MarksFormat = 'bangla-numeric', tableEditCallbacks?: TableEditCallbacks | null, imageEditCallbacks?: ImageEditCallbacks | null, tableRows: readonly [number, number] | null = null, optionRows: readonly [number, number] | null = null) => {
    if (question.type === 'section-header') {
        return (
            <div key={question.id} className="text-center font-bold underline decoration-dotted text-lg my-4" data-question-id={question.id}>
                <div className="question-content"><RichText content={question.content} /></div>
            </div>
        );
    }

    if (question.type === 'image') {
        const images = getQuestionImages(question);
        if (images.length === 0) return null;
        const width = Math.min(100, Math.max(5, question.imageWidth ?? 100));
        const align = question.imageAlign ?? 'center';
        const filter = imageFilterCss({
            grayscale: question.imageGrayscale,
            brightness: question.imageBrightness,
            contrast: question.imageContrast,
            light: question.imageLight,
        });
        return (
            <div key={`${question.id}-image`} className="mb-2 question-item" data-question-id={question.id}>
                <div className="question-content">
                    {imageEditCallbacks ? (
                        <EditableImage
                            questionId={question.id}
                            images={images}
                            width={width}
                            align={align}
                            grayscale={question.imageGrayscale}
                            brightness={question.imageBrightness}
                            contrast={question.imageContrast}
                            light={question.imageLight}
                            callbacks={imageEditCallbacks}
                        />
                    ) : (
                        <div style={imageGroupStyle(align)}>
                            {images.map((img) => (
                                <img key={img.id} src={img.data} alt="" style={imageItemStyle(images.length, width, filter)} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const mainQuestionObj = allQuestions.find(q => q.id === question.id);
    const isTableQuestion = question.type === 'table' || question.type === 'fill-in-the-blanks';
    const hasTable = Array.isArray(question.tableData) && question.tableData.length > 0;
    const tableShown = isTableQuestion && question.showHints !== false && hasTable && (tableRows ? tableRows[0] <= tableRows[1] : showMainContent);
    const subPartKey = subParts.map(p => `${p.sub.id}:${p.content ? 'c' : ''}${p.optionRows ? p.optionRows.join('-') : 'x'}`).join(',');

    return (
      <div key={`${question.id}-${showMainContent}-${tableRows ? tableRows.join('-') : 'x'}-${optionRows ? optionRows.join('-') : 'x'}-${subPartKey}`} className="mb-2 question-item" data-question-id={question.id}>
        {showMainContent && (
            <div className="flex justify-between font-semibold question-content">
                <p className="flex-1">{getNumbering(mainNumberingFormat, questionIndex - 1)}. <RichText content={question.content} /></p>
                {question.type !== 'creative' && question.marks && question.marks > 0 && <p>{marksFormat === 'bangla-numeric' ? toBanglaDigits(question.marks) : question.marks}</p>}
            </div>
        )}

        {tableShown && (
          tableEditCallbacks ? (
            <EditableTable
              questionId={question.id}
              data={question.tableData as string[][]}
              colWidths={question.tableColWidths}
              rowHeights={question.tableRowHeights}
              tableMarginLeft={question.tableMarginLeft}
              callbacks={tableEditCallbacks}
            >
              {renderTableContent(question, tableRows)}
            </EditableTable>
          ) : (
            <div data-table-element style={{ marginTop: '0.5rem', marginLeft: question.tableMarginLeft ? `${question.tableMarginLeft}px` : undefined }}>
              {renderTableContent(question, tableRows)}
            </div>
          )
        )}
  
        {subParts.length > 0 && (
          <div className="pl-6">
            {subParts.map((p) => {
              const sq = p.sub;
              const sqIndex = mainQuestionObj?.subQuestions?.findIndex(osq => osq.id === sq.id) ?? -1;
              if (sqIndex === -1) return null;
              if (!p.content && !(sq.options && sq.options.length > 0)) return null;

               return (
                 <div key={sq.id} className="subquestion-item pt-1" data-subquestion-id={sq.id}>
                   {p.content && (
                     <div className="subquestion-content flex justify-between">
                       <p className="flex-1">{getNumbering(mainQuestionObj?.numberingFormat, sqIndex)}) <RichText content={sq.content} /></p>
                       {mainQuestionObj?.type === 'creative' && sq.marks && sq.marks > 0 && <p>{marksFormat === 'bangla-numeric' ? toBanglaDigits(sq.marks) : sq.marks}</p>}
                     </div>
                   )}
                   {sq.options && sq.options.length > 0 && renderOptionsGrid(sq.options, p.optionRows)}
                 </div>
               );
            })}
          </div>
        )}
  
        {question.type !== 'mcq' && question.options && question.options.length > 0 && (showMainContent || (!!optionRows && optionRows[0] <= optionRows[1])) && renderOptionsGrid(question.options, optionRows)}
      </div>
    );
};

export const PaperPage = React.forwardRef<HTMLDivElement, { paper: Paper; pageContent: PageContent[]; isFirstPage: boolean; settings: PaperSettings; allQuestions: Question[]; tableEditCallbacks?: TableEditCallbacks | null; imageEditCallbacks?: ImageEditCallbacks | null }>(({ paper, pageContent, isFirstPage, settings, allQuestions, tableEditCallbacks, imageEditCallbacks }, ref) => {
    
    const pageStyle: React.CSSProperties = {
        width: `${settings.width}px`,
        minHeight: `${settings.height}px`,
        paddingTop: `${settings.margins.top}mm`,
        paddingBottom: `${Math.max(settings.margins.bottom, MIN_BOTTOM_PADDING_MM)}mm`,
        paddingLeft: `${settings.margins.left}mm`,
        paddingRight: `${settings.margins.right}mm`,
        fontSize: `${settings.fontSize}pt`,
        lineHeight: settings.lineHeight,
        boxSizing: 'border-box'
    };

    const allQuestionIds = allQuestions.filter(q => q.type !== 'section-header' && q.type !== 'image').map(q => q.id);

    return (
        <div ref={ref} className="bg-white text-black font-serif max-w-none mx-auto shadow-lg paper-page" style={pageStyle}>
{isFirstPage && (
                paper.headerTemplate && paper.headerTemplate.length > 0 ? (
                    <header className="text-center mb-6 preview-header space-y-2">
                        {paper.headerTemplate.map(row => (
                            <div key={row.id} className="flex items-stretch">
                                {row.cells.map(cell => {
                                    const text = cell.kind === 'text' ? (cell.text ?? '') : headerFieldText(cell.kind, paper);
                                    return (
                                        <div
                                            key={cell.id}
                                            className="flex-1"
                                            style={{
                                                textAlign: cell.align ?? 'left',
                                                fontSize: cell.size ? `${cell.size}pt` : undefined,
                                                fontWeight: cell.bold ? 700 : undefined,
                                                textDecoration: cell.underline ? 'underline' : undefined,
                                            }}
                                        >
                                            {text}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </header>
                ) : (
                    <>
                        <header className="text-center mb-6 preview-header">
                            <h1 className="text-xl font-bold">{paper.schoolName}</h1>
                            <h2 className="text-lg">{paper.examTitle}</h2>
                        </header>

                        <div className="flex justify-between text-sm mb-6">
                            <p>বিষয়: {subjectLabel(paper.subject)}</p>
                            <p>পূর্ণমান: {paper.totalMarks}</p>
                        </div>
                        <div className="flex justify-between text-sm mb-6">
                            <p>শ্রেণি: {gradeLabel(paper.grade)}</p>        
                            <p>সময়: {paper.timeAllowed}</p>
                        </div>
                        {paper.notes && (
                            <div className="text-center text-sm font-semibold mb-6">
                                <p>{paper.notes}</p>
                            </div>
                        )}
</>
                )
            )}

            <main>
                {pageContent.map(content => {
                    let questionNumber = 0;
                    if (content.mainQuestion.type !== 'section-header') {
                      const idx = allQuestionIds.indexOf(content.mainQuestion.id);
                      if (idx !== -1) {
                          questionNumber = idx + 1;
                      }
                    }
                    return renderQuestionContent(content.mainQuestion, questionNumber, allQuestions, content.showMainContent, content.subParts || [], paper.mainNumberingFormat, paper.marksFormat, tableEditCallbacks, imageEditCallbacks, content.tableRows ?? null, content.optionRows ?? null);
                })}
            </main>
        </div>
    );
});
PaperPage.displayName = "PaperPage";