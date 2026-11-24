import React from 'react';
import katex from 'katex';
import type { Paper, Question, NumberingFormat, MainNumberingFormat, MarksFormat } from './page';
import EditableTable, { MIN_TABLE_COL, TABLE_GUTTER_WIDTH } from './EditableTable';
import EditableImage from './EditableImage';
import { imageFilterCss, imageGroupStyle, imageItemStyle, getQuestionImages } from './image-style';
import { headerFieldText, subjectLabel, gradeLabel, type HeaderRow } from './header-template';
import {
  getAlternativeAlign,
  getAlternativeContent,
  getAlternativeDocument,
  normalizeRichTextDocument,
  plainTextToRichTextDocument,
  renderPlainTextToHtml,
  type RichTextDocument,
} from './text-format';
import { getAngleDiagramMarkup, type AngleDiagramKind } from './angle-diagram';
export interface TableEditCallbacks {
  onCellChange: (questionId: string, row: number, col: number, value: string, richDocument?: RichTextDocument) => void;
  onAddRow: (questionId: string) => void;
  onRemoveRow: (questionId: string, row: number) => void;
  onAddCol: (questionId: string) => void;
  onRemoveCol: (questionId: string, col: number) => void;
  onResizeRow: (questionId: string, row: number, height: number) => void;
  onColWidths: (questionId: string, widths: number[]) => void;
  onMarginLeftChange: (questionId: string, value: number) => void;
  onBorderModeChange?: (questionId: string, mode: 'grid' | 'box') => void;
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
    mcqStatementRows?: readonly [number, number] | null;
    textBoxLines?: readonly [number, number] | null; // single text box lines to render on this page
    formLines?: readonly [number, number] | null;   // boxed form lines to render on this page
    stemLines?: readonly [number, number] | null;   // question stem lines to render on this page
    alternativeRange?: readonly [number, number] | null; // alternatives to render on this page
}

const EMPTY_LINE_RANGE: readonly [number, number] = [0, -1];

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

  if (format === null) return '';

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

const renderMathToHtml = (content: string): string => {
  if (!content) return '';

  const inlineRegex = /\$([^$]+)\$/g;
  const blockRegex = /\$\$([^$]+)\$\$/g;
  const inlineParenRegex = /\\\(([^]+?)\\\)/g;
  const blockBracketRegex = /\\\[([^]+?)\\\]/g;
  const diagramRegex = /\\angleDiagram\{(acute|right|obtuse|straight)\}/g;

  const ranges: Array<{ start: number; end: number; content: string; type: 'block' | 'inline' | 'diagram' }> = [];

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
  while ((match = diagramRegex.exec(content)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length, content: match[1], type: 'diagram' });
  }

  ranges.sort((a, b) => a.start - b.start);

  if (ranges.length === 0) return renderPlainTextToHtml(content);

  let html = '';
  let lastIndex = 0;
  ranges.forEach((r) => {
    if (r.start < lastIndex) return;
    if (r.start > lastIndex) html += renderPlainTextToHtml(content.substring(lastIndex, r.start));
    if (r.type === 'diagram') {
      html += getAngleDiagramMarkup(r.content as AngleDiagramKind);
      lastIndex = r.end;
      return;
    }
    try {
      html += katex.renderToString(r.content.trim(), {
        displayMode: r.type === 'block',
        throwOnError: false,
      });
    } catch {
      html += renderPlainTextToHtml(r.content.trim());
    }
    lastIndex = r.end;
  });
  if (lastIndex < content.length) html += renderPlainTextToHtml(content.substring(lastIndex));

  return html;
};

const RichText = ({
  content,
  richDocument,
  align = 'left',
  prefix,
  lineRange = null,
  lineAttributes,
}: {
  content: string;
  richDocument?: RichTextDocument;
  align?: React.CSSProperties['textAlign'];
  prefix?: React.ReactNode;
  lineRange?: readonly [number, number] | null;
  lineAttributes?: (lineIndex: number) => { 'data-text-box-line'?: number; 'data-stem-line'?: number; style?: React.CSSProperties } | undefined;
}) => {
  const document = normalizeRichTextDocument(richDocument, content);
  const startLine = lineRange ? lineRange[0] : 0;
  const endLine = lineRange ? lineRange[1] : document.lines.length - 1;
  const visibleLines = document.lines
    .map((line, lineIndex) => ({ line, lineIndex }))
    .filter(({ lineIndex }) => lineIndex >= startLine && lineIndex <= endLine);

  if (!richDocument) {
    return (
      <span style={{ whiteSpace: 'pre-wrap' }}>
        {prefix}
        <span style={{ whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: renderMathToHtml(content) }} />
      </span>
    );
  }

  return (
    <span style={{ display: 'block', whiteSpace: 'pre-wrap' }}>
      {visibleLines.map(({ line, lineIndex }) => {
        const extra = lineAttributes?.(lineIndex);
        return (
        <span
          key={lineIndex}
          {...(extra ?? {})}
          style={{
            display: 'block',
            textAlign: line.align ?? align,
            whiteSpace: 'pre-wrap',
            ...(extra?.style ?? {}),
          }}
        >
          {lineIndex === 0 ? prefix : null}
          {line.runs.map((run, runIndex) => (
            <span
              key={runIndex}
              style={{
                fontWeight: run.bold ? 700 : undefined,
                fontSize: run.fontSize ? `${run.fontSize}pt` : undefined,
                textDecoration: run.underline ? 'underline' : undefined,
                textDecorationSkipInk: run.underline ? 'none' : undefined,
                textUnderlineOffset: run.underline ? '2px' : undefined,
                whiteSpace: 'pre-wrap',
              }}
              dangerouslySetInnerHTML={{ __html: renderMathToHtml(run.text) }}
            />
          ))}
          {line.runs.length === 0 ? <br /> : null}
        </span>
        );
      })}
    </span>
  );
};

const FORM_KEYWORD = /(ফরম|নিবন্ধন|আবেদনপত্র|রেজিস্ট্রেশন)/i;
const FORM_FIELD_LINE = /^\s*(?:[০-৯]{1,2}|[0-9]{1,2})[.)]\s*\S/;
const INSTRUCTION_LINE = /[।.!?]\s*$/;

type FormBlock = {
  intro: string;
  heading: string[];
  fields: string[];
  trailing: string[];
};

// Detects a boxed fill-in form inside a question (a heading block, numbered
// fields to write on, and optional signature lines) so it can be rendered
// like the source image instead of a flat paragraph.
const parseFormBlock = (content: string): FormBlock | null => {
  if (!content || !FORM_KEYWORD.test(content)) return null;

  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const fieldIndexes: number[] = [];
  lines.forEach((line, index) => {
    if (FORM_FIELD_LINE.test(line) && line.trim().length <= 60) fieldIndexes.push(index);
  });
  if (fieldIndexes.length < 3) return null;

  const firstField = fieldIndexes[0];
  const lastField = fieldIndexes[fieldIndexes.length - 1];
  if (firstField === lastField) return null;

  for (let i = firstField; i <= lastField; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    if (!fieldIndexes.includes(i)) return null;
  }

  let keywordIndex = -1;
  for (let i = firstField - 1; i >= 0; i -= 1) {
    if (FORM_KEYWORD.test(lines[i])) {
      keywordIndex = i;
      break;
    }
  }
  if (keywordIndex === -1) return null;

  let boxStart = keywordIndex;
  while (boxStart - 1 >= 0) {
    const previous = lines[boxStart - 1].trim();
    if (!previous || INSTRUCTION_LINE.test(previous) || FORM_FIELD_LINE.test(previous)) break;
    boxStart -= 1;
  }

  return {
    intro: lines.slice(0, boxStart).join('\n'),
    heading: lines.slice(boxStart, firstField).filter((line) => line.trim().length > 0),
    fields: lines.slice(firstField, lastField + 1).filter((line) => line.trim().length > 0),
    trailing: lines.slice(lastField + 1).filter((line) => line.trim().length > 0),
  };
};

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
    const isBox = question.tableBorderMode === 'box';
    const tableStyle: React.CSSProperties = {
        width: '100%',
        maxWidth: '100%',
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
        ...(isBox ? { border: '1px solid #000' } : {}),
    };
    const cellStyle: React.CSSProperties = {
        ...(isBox ? { border: 'none' } : { border: '1px solid #000' }),
        padding: '4px 8px',
        verticalAlign: 'top',
        overflowWrap: 'anywhere',
    };
    return (
        <table style={tableStyle}>
            <colgroup>
                {widths.map((w, ci) => (
                    <col
                        key={ci}
                        style={w > 0 && hasExplicit ? { width: `${(w / sumPx) * 100}%` } : undefined}
                    />
                ))}
            </colgroup>
            <tbody>
                {tableData.slice(firstRow, lastRow + 1).map((row, rowIndex) => {
                    const globalRowIndex = firstRow + rowIndex;
                    return (
                    <tr key={globalRowIndex} data-table-row={globalRowIndex} style={question.tableRowHeights && question.tableRowHeights[globalRowIndex] > 0 ? { height: question.tableRowHeights[globalRowIndex] } : undefined}>
                        {row.map((cell, colIndex) => (
                            <td key={colIndex} style={cellStyle}>
                                <RichText
                                    content={cell ?? ''}
                                    richDocument={question.tableDataRich?.[globalRowIndex]?.[colIndex] ?? undefined}
                                    align="left"
                                />
                            </td>
                        ))}
                    </tr>
                    );
                })}
            </tbody>
        </table>
    );
};

type OptionsLayout = {
    mode: 'measuring' | 'two-column' | 'single-line' | 'stacked';
    leftColumnWidth: number;
};

const OptionsGrid = ({
    options,
    rowRange,
    optionsInline,
}: {
    options: { id: string; text: string }[];
    rowRange: readonly [number, number] | null;
    optionsInline: boolean;
}) => {
    const layoutRef = React.useRef<HTMLDivElement>(null);
    const measureRef = React.useRef<HTMLDivElement>(null);
    const [layout, setLayout] = React.useState<OptionsLayout>({
        mode: 'measuring',
        leftColumnWidth: 0,
    });

    React.useLayoutEffect(() => {
        const layoutElement = layoutRef.current;
        const measureElement = measureRef.current;
        if (!layoutElement || !measureElement) return;

        const updateLayout = () => {
            const availableWidth = layoutElement.getBoundingClientRect().width;
            const optionWidths = Array.from(measureElement.children)
                .map((element) => element.getBoundingClientRect().width);
            if (optionWidths.length === 0) return;

            const gap = parseFloat(window.getComputedStyle(measureElement).columnGap) || 0;
            let nextLayout: OptionsLayout;

            if (optionsInline) {
                const requiredWidth = optionWidths.reduce((sum, width) => sum + width, 0) + gap * (optionWidths.length - 1);
                nextLayout = {
                    mode: requiredWidth <= availableWidth ? 'single-line' : 'stacked',
                    leftColumnWidth: 0,
                };
            } else {
                const leftWidth = Math.max(...optionWidths.filter((_, index) => index % 2 === 0));
                const rightWidth = Math.max(...optionWidths.filter((_, index) => index % 2 === 1), 0);
                const availableTrackWidth = availableWidth - gap;
                const fitsTwoColumns = leftWidth + rightWidth <= availableTrackWidth;
                const preferredLeftWidth = availableTrackWidth * 0.4;
                nextLayout = fitsTwoColumns
                    ? {
                        mode: 'two-column',
                        leftColumnWidth: Math.min(
                            Math.max(preferredLeftWidth, leftWidth),
                            availableTrackWidth - rightWidth
                        ),
                    }
                    : { mode: 'stacked', leftColumnWidth: 0 };
            }

            setLayout((current) =>
                current.mode === nextLayout.mode &&
                Math.abs(current.leftColumnWidth - nextLayout.leftColumnWidth) < 0.5
                    ? current
                    : nextLayout
            );
        };

        updateLayout();
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(updateLayout);
        observer.observe(layoutElement);
        observer.observe(measureElement);
        return () => observer.disconnect();
    }, [options, optionsInline]);

    if (rowRange && rowRange[1] < rowRange[0]) return null;

    const renderOption = (index: number) => {
        const option = options[index];
        if (!option) return null;
        return (
            <p key={option.id} className="min-w-0">
                {getNumbering('bangla-alpha', index)}) <RichText content={option.text} />
            </p>
        );
    };

    let rows: React.ReactNode = null;
    if (layout.mode === 'single-line') {
        if (!rowRange || (rowRange[0] <= 0 && rowRange[1] >= 0)) {
            rows = (
                <div className="option-row flex flex-nowrap gap-x-8 mb-1" data-option-row={0}>
                    {options.map((_, index) => renderOption(index))}
                </div>
            );
        }
    } else if (layout.mode === 'two-column') {
        const rowStart = rowRange ? rowRange[0] * 2 : 0;
        const rowEnd = rowRange ? Math.min((rowRange[1] + 1) * 2, options.length) : options.length;
        const rowGroups: Array<{ opt: { id: string; text: string }; index: number }>[] = [];
        for (let i = rowStart; i < rowEnd; i += 2) {
            const chunk = options.slice(i, i + 2).map((opt, j) => ({ opt, index: i + j }));
            if (chunk.length > 0) rowGroups.push(chunk);
        }
        rows = rowGroups.map((chunk, groupIndex) => (
            <div
                key={groupIndex}
                className="option-row grid gap-x-8 mb-1"
                style={{ gridTemplateColumns: `${layout.leftColumnWidth}px minmax(0, 1fr)` }}
                data-option-row={rowRange ? rowRange[0] + groupIndex : groupIndex}
            >
                {chunk.map(({ opt, index }) => (
                    <p key={opt.id} className="min-w-0">
                        {getNumbering('bangla-alpha', index)}) <RichText content={opt.text} />
                    </p>
                ))}
            </div>
        ));
    } else if (layout.mode === 'stacked') {
        const firstOption = rowRange ? rowRange[0] : 0;
        const lastOption = rowRange ? Math.min(rowRange[1], options.length - 1) : options.length - 1;
        rows = Array.from({ length: Math.max(0, lastOption - firstOption + 1) }, (_, rowIndex) => {
            const optionIndex = firstOption + rowIndex;
            return (
                <div key={optionIndex} className="option-row mb-1" data-option-row={optionIndex}>
                    {renderOption(optionIndex)}
                </div>
            );
        });
    }

    return (
        <div className="relative pl-6 mt-1">
            <div ref={layoutRef} className="w-full">{rows}</div>
            <div
                ref={measureRef}
                aria-hidden="true"
                className="pointer-events-none absolute left-0 top-0 h-0 invisible overflow-hidden"
                style={{ display: 'flex', width: 'max-content', columnGap: '2rem' }}
            >
                {options.map((option, index) => (
                    <p
                        key={option.id}
                        style={{ display: 'inline-block', flex: 'none', width: 'max-content', maxWidth: 'none', margin: 0, whiteSpace: 'nowrap' }}
                    >
                        {getNumbering('bangla-alpha', index)}) <RichText content={option.text} />
                    </p>
                ))}
            </div>
        </div>
    );
};

const renderOptionsGrid = (
    options: { id: string; text: string }[],
    rowRange: readonly [number, number] | null = null,
    optionsInline = false
) => options.length > 0
    ? <OptionsGrid options={options} rowRange={rowRange} optionsInline={optionsInline} />
    : null;

const renderMcqStatements = (
  question: Question,
  rowRange?: readonly [number, number] | null,
  mainQuestion = false
) => {
  if (rowRange === null || question.mcqOptionType !== 'statement-combination') return null;
  const statements = question.mcqStatements ?? [];
  const start = rowRange?.[0] ?? 0;
  const end = rowRange?.[1] ?? statements.length - 1;
  const labels = ['i', 'ii', 'iii'];

  return (
    <div className="pl-6 mt-1">
      {statements
        .map((text, index) => ({ text, index }))
        .filter(({ index }) => index >= start && index <= end)
        .map(({ text, index }) => (
          <p
            key={`${question.id}-statement-${index}`}
            className="mcq-statement-row"
            data-main-mcq-statement-row={mainQuestion ? index : undefined}
            style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.125rem', whiteSpace: 'pre-wrap' }}
          >
            <span style={{ flex: '0 0 2rem' }}>{labels[index] ?? `${index + 1}`}.</span>
            <span style={{ flex: 1 }}><RichText content={text} /></span>
          </p>
        ))}
    </div>
  );
};

export const renderQuestionContent = (question: Question, questionIndex: number, allQuestions: Question[], showMainContent: boolean, subParts: SubPart[] = [], mainNumberingFormat: MainNumberingFormat = 'bangla-numeric', marksFormat: MarksFormat = 'bangla-numeric', tableEditCallbacks?: TableEditCallbacks | null, imageEditCallbacks?: ImageEditCallbacks | null, tableRows: readonly [number, number] | null = null, optionRows: readonly [number, number] | null = null, textBoxLines?: readonly [number, number] | null, formLines?: readonly [number, number] | null, stemLines?: readonly [number, number] | null, alternativeRange?: readonly [number, number] | null, mcqStatementRows?: readonly [number, number] | null, tableMaxWidth?: number) => {
    if (question.type === 'or') {
        return (
            <div key={question.id} className="text-center font-bold my-2 question-item" data-question-id={question.id}>
                <div className="question-content">{question.content || 'অথবা'}</div>
            </div>
        );
    }

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
    const hasTable = Array.isArray(question.tableData) && question.tableData.length > 0;
    // A table may belong to any question type (a short/creative/MCQ question can
    // refer to a printed table). Only the শূন্যস্থান hints table can be hidden.
    const tableVisible = question.type === 'fill-in-the-blanks' ? question.showHints !== false : true;
    const tableShown = tableVisible && hasTable && (tableRows ? tableRows[0] <= tableRows[1] : showMainContent);
    const tableMaxMarginLeft = tableMaxWidth === undefined
        ? Number.POSITIVE_INFINITY
        : Math.max(0, tableMaxWidth - TABLE_GUTTER_WIDTH - MIN_TABLE_COL);
    const tableLeftMargin = Math.min(question.tableMarginLeft ?? 0, tableMaxMarginLeft);
    const subPartKey = subParts.map(p => `${p.sub.id}:${p.content ? 'c' : ''}${p.optionRows ? p.optionRows.join('-') : 'x'}`).join(',');
    const hasRichFormatting = question.contentDocument?.lines.some(
      (line) => Boolean(line.align) || line.runs.some((run) => run.bold || run.underline || run.fontSize)
    );
    const formBlock = hasRichFormatting ? null : parseFormBlock(question.content);
    const formBlockLines = formBlock
        ? [
            ...formBlock.heading.map((text) => ({ text, className: 'text-center font-semibold' })),
            ...formBlock.fields.map((text) => ({ text, className: 'mt-1 mb-3' })),
            ...formBlock.trailing.map((text) => ({ text, className: 'mt-1' })),
        ]
        : [];
    const numberPrefix = (() => {
        const num = question.numberingLabel ?? getNumbering(mainNumberingFormat, questionIndex - 1);
        return num ? `${num}. ` : '';
    })();
    const marksNode = question.marks !== undefined && question.marks > 0
        ? <p>{marksFormat === 'bangla-numeric' ? toBanglaDigits(question.marks) : question.marks}</p>
        : null;
    const stemDocument = question.contentDocument ?? plainTextToRichTextDocument(question.content);
    const stemRange = stemLines === null ? EMPTY_LINE_RANGE : stemLines;
    const stemLineAttributes = (lineIndex: number) => ({ 'data-stem-line': lineIndex });

    return (
      <div key={`${question.id}-${showMainContent}-${tableRows ? tableRows.join('-') : 'x'}-${optionRows ? optionRows.join('-') : 'x'}-${mcqStatementRows ? mcqStatementRows.join('-') : 'x'}-${subPartKey}`} className="mb-2 question-item" data-question-id={question.id}>
        {(stemLines !== null || alternativeRange !== null || mcqStatementRows !== null) && (
            <div className="question-content">
                {stemLines !== null && (question.type === 'text-box' ? (
                    <div className="flex justify-between font-semibold" data-question-stem>
                        <p className="flex-1" style={{ textAlign: question.contentAlign ?? 'left' }}>
                            <RichText
                                content={question.content}
                                richDocument={stemDocument}
                                align={question.contentAlign ?? 'left'}
                                prefix={numberPrefix}
                                lineRange={stemRange}
                                lineAttributes={stemLineAttributes}
                            />
                        </p>
                        {showMainContent ? marksNode : null}
                    </div>
                ) : formBlock ? (
                    <div className="flex justify-between font-semibold" data-question-stem>
                        <p className="flex-1" style={{ textAlign: question.contentAlign ?? 'left', whiteSpace: 'pre-wrap' }}>
                            <RichText
                                content={formBlock.intro}
                                richDocument={plainTextToRichTextDocument(formBlock.intro)}
                                align={question.contentAlign ?? 'left'}
                                prefix={numberPrefix}
                                lineRange={stemRange}
                                lineAttributes={stemLineAttributes}
                            />
                        </p>
                        {showMainContent ? marksNode : null}
                    </div>
                ) : (
                    <div className="flex justify-between font-semibold" data-question-stem>
                        <p className="flex-1" style={{ textAlign: question.contentAlign ?? 'left' }}>
                            <RichText
                                content={question.content}
                                richDocument={stemDocument}
                                align={question.contentAlign ?? 'left'}
                                prefix={numberPrefix}
                                lineRange={stemRange}
                                lineAttributes={stemLineAttributes}
                            />
                        </p>
                        {showMainContent ? marksNode : null}
                    </div>
                ))}
                {renderMcqStatements(question, mcqStatementRows, true)}
                {question.alternatives?.map((alternative, altIndex) => {
                    if (alternativeRange !== undefined && alternativeRange !== null && !(altIndex >= alternativeRange[0] && altIndex <= alternativeRange[1])) {
                        return null;
                    }
                    const alternativeContent = getAlternativeContent(alternative);
                    if (!alternativeContent.trim()) return null;
                    const alternativeAlign = getAlternativeAlign(alternative) ?? question.contentAlign ?? 'left';
                    return (
                        <p key={`${question.id}-alt-${altIndex}`} data-alternative-row={altIndex} className="mt-1" style={{ textAlign: alternativeAlign, whiteSpace: 'pre-wrap' }}>
                            <RichText
                                content={alternativeContent}
                                richDocument={getAlternativeDocument(alternative)}
                                align={alternativeAlign}
                                prefix={<><em>অথবা</em>, </>}
                            />
                        </p>
                    );
                })}
            </div>
        )}

        {question.type === 'text-box' && textBoxLines !== null && (question.textBoxContent || question.textBoxDocument) && (
            <div className="border border-black px-3 py-2 mt-1" data-text-box-element>
                <RichText
                    content={question.textBoxContent ?? ''}
                    richDocument={question.textBoxDocument ?? plainTextToRichTextDocument(question.textBoxContent ?? '')}
                    align="left"
                    lineRange={textBoxLines ?? undefined}
                    lineAttributes={(lineIndex) => ({ 'data-text-box-line': lineIndex })}
                />
            </div>
        )}

        {formBlock && formLines !== null && (
            <div className="border border-black px-3 py-2 mt-1" data-form-element>
                {formBlockLines
                    .map((entry, lineIndex) => ({ entry, lineIndex }))
                    .filter(({ lineIndex }) =>
                        formLines === undefined
                            ? true
                            : lineIndex >= formLines[0] && lineIndex <= formLines[1]
                    )
                    .map(({ entry, lineIndex }) => (
                        <p key={`form-line-${lineIndex}`} data-form-line={lineIndex} className={entry.className}>
                            <RichText content={entry.text} />
                        </p>
                    ))}
            </div>
        )}

        {tableShown && (
          tableEditCallbacks ? (
            <EditableTable
              questionId={question.id}
              data={question.tableData as string[][]}
              richData={question.tableDataRich}
              borderMode={question.tableBorderMode ?? 'grid'}
              colWidths={question.tableColWidths}
              rowHeights={question.tableRowHeights}
              tableMarginLeft={tableLeftMargin}
              maxWidth={tableMaxWidth}
              callbacks={tableEditCallbacks}
            >
              {renderTableContent(question, tableRows)}
            </EditableTable>
          ) : (
            <div data-table-element style={{ marginTop: '0.5rem', marginLeft: tableLeftMargin ? `${tableLeftMargin}px` : undefined }}>
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
                    {p.content && (() => {
                       const num = sq.numberingLabel ?? getNumbering(mainQuestionObj?.numberingFormat, sqIndex);
                       const prefix = num ? `${num}) ` : '';
                       return (
                         <div className="subquestion-content">
                           <div className="flex">
                             {sq.type === 'text-box' ? (
                               <div className="flex-1">
                                 <p style={{ textAlign: sq.contentAlign ?? 'left', whiteSpace: 'pre-wrap' }}>{prefix}</p>
                                 <div className="border border-black px-3 py-2 mt-1">
                                   <RichText
                                     content={sq.content}
                                     richDocument={sq.contentDocument}
                                     align={sq.contentAlign ?? 'left'}
                                   />
                                 </div>
                               </div>
                             ) : (
                               <p className="flex-1" style={{ textAlign: sq.contentAlign ?? 'left', whiteSpace: 'pre-wrap' }}>
                                 <RichText
                                   content={sq.content}
                                   richDocument={sq.contentDocument}
                                   align={sq.contentAlign ?? 'left'}
                                   prefix={prefix}
                                 />
                               </p>
                             )}
                           </div>
                           {renderMcqStatements(sq)}
                         </div>
                       );
                    })()}
                   {sq.options && sq.options.length > 0 && renderOptionsGrid(sq.options, p.optionRows, sq.optionsInline)}
                 </div>
               );
            })}
          </div>
        )}
  
        {(question.type !== 'mcq' || !question.subQuestions?.length) && question.options && question.options.length > 0 && (showMainContent || (!!optionRows && optionRows[0] <= optionRows[1])) && renderOptionsGrid(question.options, optionRows, question.optionsInline)}
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
    const tableMaxWidth = Math.max(
        0,
        settings.width - (settings.margins.left + settings.margins.right) * (96 / 25.4)
    );

    const allQuestionIds = allQuestions.filter(q => q.type !== 'section-header' && q.type !== 'image' && q.type !== 'or').map(q => q.id);
    const headerRows = paper.headerTemplate && paper.headerTemplate.length > 0 ? paper.headerTemplate : null;
    const logoUrl = paper.logoUrl?.trim() ?? '';

    // Leading school/exam rows form the "brand" block. When a logo is set it is
    // rendered to the left of that block, with the rows stacked to its right.
    let brandRowCount = 0;
    if (headerRows) {
        while (
            brandRowCount < headerRows.length &&
            headerRows[brandRowCount].cells.length === 1 &&
            (headerRows[brandRowCount].cells[0].kind === 'school' ||
                headerRows[brandRowCount].cells[0].kind === 'examTitle')
        ) {
            brandRowCount += 1;
        }
    }

    const renderHeaderRow = (row: HeaderRow, rowIndex: number) => {
        const centered = row.layout === 'center';
        const isLastRow = !!headerRows && rowIndex === headerRows.length - 1;
        return (
            <div
                key={row.id}
                style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    justifyContent: centered ? 'center' : 'space-between',
                    gap: centered ? '1.75rem' : undefined,
                    marginTop: isLastRow && !!headerRows && headerRows.length > 1 ? '0.35rem' : undefined,
                }}
            >
                {row.cells.map(cell => {
                    const text = cell.kind === 'text' ? (cell.text ?? '') : headerFieldText(cell.kind, paper);
                    return (
                        <div
                            key={cell.id}
                            style={{
                                flex: centered ? '0 0 auto' : '1 1 0%',
                                textAlign: cell.align ?? 'left',
                                fontSize: cell.size ? `${cell.size}pt` : undefined,
                                fontWeight: cell.bold ? 700 : undefined,
                                fontFamily: cell.kind === 'school' ? "'Noto Serif Bengali', 'SolaimanLipi', serif" : undefined,
                                textDecoration: cell.underline ? 'underline' : undefined,
                                textDecorationSkipInk: cell.underline ? 'none' : undefined,
                                textUnderlineOffset: cell.underline ? '3px' : undefined,
                            }}
                        >
                            {text}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div ref={ref} className="bg-white text-black font-serif max-w-none mx-auto shadow-lg paper-page" style={pageStyle}>
{isFirstPage && (
                headerRows ? (
                    <header
                        className="text-center mb-6 preview-header"
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.35rem',
                            lineHeight: 1.3,
                        }}
                    >
                        {logoUrl && brandRowCount > 0 ? (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <img
                                        src={logoUrl}
                                        alt=""
                                        style={{
                                            flex: '0 0 auto',
                                            height: '64px',
                                            width: 'auto',
                                            maxWidth: '96px',
                                            objectFit: 'contain',
                                        }}
                                    />
                                    <div
                                        style={{
                                            flex: '1 1 0%',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.35rem',
                                            lineHeight: 1.3,
                                        }}
                                    >
                                        {headerRows
                                            .slice(0, brandRowCount)
                                            .map((row, rowIndex) => renderHeaderRow(row, rowIndex))}
                                    </div>
                                </div>
                                {headerRows
                                    .slice(brandRowCount)
                                    .map((row, rowIndex) => renderHeaderRow(row, brandRowCount + rowIndex))}
                            </>
                        ) : (
                            headerRows.map((row, rowIndex) => renderHeaderRow(row, rowIndex))
                        )}
                    </header>
                ) : (
                    <>
                        <header className="text-center mb-6 preview-header">
                            <h1 className="text-xl font-bold bengali-school-name">{paper.schoolName}</h1>
                            <h2 className="text-lg">{paper.examTitle}</h2>
                        </header>

                        <div className="flex justify-between text-sm mb-6">
                            <p>শ্রেণি : {gradeLabel(paper.grade)}</p>
                            <p>বিষয় : {subjectLabel(paper.subject)}</p>
                        </div>
                        <div className="flex justify-between text-sm mb-6">
                            <p>সময় : {paper.timeAllowed}</p>
                            <p>পূর্ণমান : {paper.totalMarks}</p>
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
                    if (content.mainQuestion.type !== 'section-header' && content.mainQuestion.type !== 'or') {
                        const idx = allQuestionIds.indexOf(content.mainQuestion.id);
                        if (idx !== -1) {
                            questionNumber = idx + 1;
                        }
                    }
                    const liveQuestion =
                        allQuestions.find((question) => question.id === content.mainQuestion.id) ??
                        content.mainQuestion;
                    const liveSubParts = (content.subParts || []).map((part) => {
                        const liveSub =
                            liveQuestion.subQuestions?.find((sub) => sub.id === part.sub.id) ?? part.sub;
                        return { ...part, sub: liveSub };
                    });
                    return renderQuestionContent(liveQuestion, questionNumber, allQuestions, content.showMainContent, liveSubParts, paper.mainNumberingFormat, paper.marksFormat, tableEditCallbacks, imageEditCallbacks, content.tableRows ?? null, content.optionRows ?? null, content.textBoxLines, content.formLines, content.stemLines, content.alternativeRange, content.mcqStatementRows, tableMaxWidth);
                })}
            </main>
        </div>
    );
});
PaperPage.displayName = "PaperPage";