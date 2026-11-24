export type TextAlign = 'left' | 'center' | 'right' | 'justify';

export interface RichTextRun {
  text: string;
  bold?: boolean;
  underline?: boolean;
}

export interface RichTextLine {
  align?: TextAlign;
  runs: RichTextRun[];
}

export interface RichTextDocument {
  lines: RichTextLine[];
}

export interface QuestionAlternative {
  content: string;
  contentAlign?: TextAlign;
  contentDocument?: RichTextDocument;
}

export type QuestionAlternativeValue = string | QuestionAlternative;

export const isTextAlign = (value: unknown): value is TextAlign =>
  value === 'left' || value === 'center' || value === 'right' || value === 'justify';

export const getAlternativeContent = (alternative: QuestionAlternativeValue): string =>
  typeof alternative === 'string' ? alternative : alternative.content;

export const getAlternativeAlign = (alternative: QuestionAlternativeValue): TextAlign | undefined =>
  typeof alternative === 'string' ? undefined : alternative.contentAlign;

export const getAlternativeDocument = (alternative: QuestionAlternativeValue): RichTextDocument | undefined =>
  typeof alternative === 'string' ? undefined : alternative.contentDocument;

const AMP = String.fromCharCode(38);

const escapeHtml = (text: string): string =>
  text.replace(/&/g, AMP + 'amp;').replace(/</g, AMP + 'lt;').replace(/>/g, AMP + 'gt;');

export const normalizeEscapedNewlines = (text: string): string =>
  text
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n(?![A-Za-z])/g, '\n');

const compactRuns = (runs: RichTextRun[]): RichTextRun[] => {
  const compacted: RichTextRun[] = [];

  runs.forEach((run) => {
    if (!run || typeof run.text !== 'string' || run.text.length === 0) return;
    const previous = compacted[compacted.length - 1];
    const bold = run.bold === true;
    const underline = run.underline === true;

    if (
      previous &&
      (previous.bold === true) === bold &&
      (previous.underline === true) === underline
    ) {
      previous.text += run.text;
      return;
    }

    compacted.push({
      text: run.text,
      ...(bold ? { bold: true } : {}),
      ...(underline ? { underline: true } : {}),
    });
  });

  return compacted;
};

export const normalizeRichTextDocument = (
  document: RichTextDocument | undefined,
  fallbackText = ''
): RichTextDocument => {
  if (!document || !Array.isArray(document.lines) || document.lines.length === 0) {
    return plainTextToRichTextDocument(fallbackText);
  }

  return {
    lines: document.lines.map((line) => ({
      ...(isTextAlign(line?.align) ? { align: line.align } : {}),
      runs: compactRuns(
        Array.isArray(line?.runs)
          ? line.runs
              .filter((run): run is RichTextRun => Boolean(run) && typeof run.text === 'string')
              .map((run) => ({ ...run, text: normalizeEscapedNewlines(run.text) }))
          : []
      ),
    })),
  };
};

export const plainTextToRichTextDocument = (text: string): RichTextDocument => {
  const normalized = normalizeEscapedNewlines(text).replace(/\r\n?/g, '\n');
  return {
    lines: normalized.split('\n').map((line) => ({
      runs: line.length > 0 ? [{ text: line }] : [],
    })),
  };
};

export const plainTextToAlignedRichTextDocument = (
  text: string,
  aligns?: unknown[]
): RichTextDocument => {
  const normalized = normalizeEscapedNewlines(text).replace(/\r\n?/g, '\n');
  return {
    lines: normalized.split('\n').map((line, index) => {
      const align = aligns?.[index];
      return {
        ...(isTextAlign(align) ? { align } : {}),
        runs: line.length > 0 ? [{ text: line }] : [],
      };
    }),
  };
};

export const richTextDocumentToPlainText = (document: RichTextDocument): string =>
  normalizeRichTextDocument(document).lines
    .map((line) => line.runs.map((run) => run.text).join(''))
    .join('\n');

export const stripUniformBoldFlags = (document: RichTextDocument): RichTextDocument => {
  const runs = document.lines.flatMap((line) => line.runs);
  if (runs.length === 0) return document;
  if (!runs.every((run) => run.bold === true)) return document;

  return {
    lines: document.lines.map((line) => ({
      ...(isTextAlign(line.align) ? { align: line.align } : {}),
      runs: line.runs.map((run) => ({
        text: run.text,
        ...(run.underline ? { underline: true } : {}),
      })),
    })),
  };
};

export const renderPlainTextToHtml = (text: string): string =>
  escapeHtml(normalizeEscapedNewlines(text).replace(/\r\n?/g, '\n'))
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
