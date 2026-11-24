'use client';
import { Suspense } from 'react';
import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Type, Pilcrow, Image as ImageIcon, Trash2, ArrowUp, ArrowDown, ListOrdered, TableIcon, PlusCircle, MinusCircle, BookMarked, Minus, Sparkles, LogOut, Save, ChevronDown, ChevronUp, Square } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { EditorHeader } from './EditorHeader';
import MathExpressions from './MathExpressions';
import TallyMarks from './TallyMarks';
import { produce } from 'immer';
import { createRoot } from 'react-dom/client';
import { useToast } from '@/hooks/use-toast';
import { PaperPage } from './PaperPreview';
import PaperPreview from './PaperPreview';
import { MIN_BOTTOM_PADDING_MM } from './paper-render';
import { imageFilterCss, imageGroupStyle, imageItemStyle, getQuestionImages, type QuestionImage } from './image-style';
import { defaultHeaderTemplate, normalizeHeaderTemplate, HEADER_LAYOUT_VERSION, type HeaderRow } from './header-template';
import HeaderBuilder from './HeaderBuilder';
import RichTextarea, { insertTextIntoRichTextarea } from './RichTextarea';
import EditableTable from './EditableTable';
import { getAlternativeAlign, getAlternativeContent, getAlternativeDocument, normalizeEscapedNewlines, normalizeRichTextDocument, plainTextToAlignedRichTextDocument, stripUniformBoldFlags } from './text-format';
import type { QuestionAlternative, RichTextDocument, TextAlign } from './text-format';
import 'katex/dist/katex.min.css';
import LatexRenderer from './LatexRenderer';
import { migrateLocalDataIfNeeded } from '@/lib/local-migration';


const generateId = (prefix: string) => {
    return `${prefix}${Date.now()}${Math.random().toString(36).substring(2, 9)}`;
};

const bengaliDigitMap: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
};

// AI/OCR output can deliver marks as a number, as an English digit string or as
// Bengali digits (sometimes with a trailing "নম্বর" or a bracket). Every
// readable form is converted to a plain number so the marks field is never
// dropped just because of the format.
const parseImportedMarks = (value: unknown): number | undefined => {
    if (typeof value === 'number') {
        return Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined;
    }
    if (typeof value !== 'string') return undefined;

    const normalized = value
        .replace(/[০-৯]/g, (digit) => bengaliDigitMap[digit] ?? digit)
        .replace(/[^\d.]/g, '');
    if (!normalized) return undefined;

    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) return undefined;
    return Math.round(parsed);
};

// OCR/AI imports sometimes deliver line breaks as the two-character sequence
// "\n" instead of a real newline. Restore them so the layout matches the
// source image instead of collapsing into one line.
const normalizeQuestionText = <T extends { [key: string]: any }>(question: T): T => {
    if (!question || typeof question !== 'object') return question;

    const next: any = { ...question };

    if (typeof next.content === 'string') {
        next.content = normalizeEscapedNewlines(next.content);
    }
    if (next.contentDocument) {
        next.contentDocument = stripUniformBoldFlags(
            normalizeRichTextDocument(next.contentDocument, next.content)
        );
    }
    if (typeof next.textBoxContent === 'string') {
        next.textBoxContent = normalizeEscapedNewlines(next.textBoxContent);
    }
    if (next.textBoxDocument) {
        next.textBoxDocument = normalizeRichTextDocument(next.textBoxDocument, next.textBoxContent ?? '');
    }
    if (typeof next.numberingLabel === 'string') {
        next.numberingLabel = normalizeEscapedNewlines(next.numberingLabel);
    }
    if (Array.isArray(next.options)) {
        next.options = next.options.map((option: any) => ({
            ...option,
            text: typeof option?.text === 'string' ? normalizeEscapedNewlines(option.text) : option?.text,
        }));
    }
    if (Array.isArray(next.tableData)) {
        next.tableData = next.tableData.map((row: any) =>
            Array.isArray(row)
                ? row.map((cell: any) => (typeof cell === 'string' ? normalizeEscapedNewlines(cell) : cell))
                : row
        );
    }
    if (Array.isArray(next.alternatives)) {
        next.alternatives = next.alternatives.map((alternative: any) =>
            typeof alternative === 'string'
                ? normalizeEscapedNewlines(alternative)
                : {
                    ...alternative,
                    content:
                        typeof alternative?.content === 'string'
                            ? normalizeEscapedNewlines(alternative.content)
                            : alternative?.content,
                    contentDocument: alternative?.contentDocument
                        ? normalizeRichTextDocument(
                            alternative.contentDocument,
                            typeof alternative.content === 'string' ? alternative.content : ''
                        )
                        : undefined,
                }
        );
    }
    if (Array.isArray(next.subQuestions)) {
        next.subQuestions = next.subQuestions.map((sub: any) => normalizeQuestionText(sub));
    }

    return next as T;
};

const ensureUniqueIds = (questions: Question[]): Question[] => {
    const seenIds = new Set<string>();

    const processNode = (node: any, parentIdPrefix?: string) => {
        let newId = node.id;
    let isNew = false;

    if (!newId || seenIds.has(newId)) {
      const prefix = parentIdPrefix ? `${parentIdPrefix}_` : `q_${Date.now()}_`;
      newId = `${prefix}${Math.random().toString(36).substring(2, 9)}`;
      isNew = true;
    }

    while (seenIds.has(newId)) {
      const prefix = newId.split('_')[0] || 'q';
      newId = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      isNew = true;
    }

    if (isNew) node.id = newId;
    seenIds.add(newId);

    if (node.subQuestions) {
      node.subQuestions.forEach((sub: any, index: number) => {
        const subId = `${newId}${String.fromCharCode(97 + index)}`;
        if (!sub.id || seenIds.has(sub.id) || !sub.id.startsWith(newId)) {
          sub.id = subId;
        }
        processNode(sub, newId);
      });
    }

    if (node.options) {
      node.options.forEach((option: any, index: number) => {
        let optionId = option.id;
        if (!optionId || seenIds.has(optionId) || isNew || !optionId.startsWith(newId)) {
          optionId = `${newId}_opt${index + 1}`;
        }
        while (seenIds.has(optionId)) {
          optionId = `${newId}_opt${index + 1}_${Math.random().toString(36).substring(2, 5)}`;
        }
        option.id = optionId;
        seenIds.add(optionId);
      });
        }
    };

    const draft = produce(questions, draft => {
        draft.forEach(q => processNode(q));
    });

    return draft;
};

  const normalizeImportedQuestion = (raw: any): Question => {
    const rawType = String(raw?.type ?? '').trim().toLowerCase();
    const typeAliases: Record<string, Question['type']> = {
      mcq: 'mcq',
      'multiple-choice': 'mcq',
      'multiple choice': 'mcq',
      'fill-in-the-blanks': 'fill-in-the-blanks',
      'fill in the blanks': 'fill-in-the-blanks',
      'শূন্যস্থান': 'fill-in-the-blanks',
      'শূন্যস্থান পূরণ': 'fill-in-the-blanks',
      shunnosthan: 'fill-in-the-blanks',
      'shunnosthan puron': 'fill-in-the-blanks',
      short: 'short',
      'সংক্ষিপ্ত': 'short',
      'songkhipto proshno': 'short',
      essay: 'essay',
      'রচনামূলক': 'essay',
      'rochonamulok proshno': 'essay',
      table: 'table',
      'সারণি': 'table',
      'ছক': 'table',
      sharoni: 'table',
      creative: 'creative',
      'সৃজনশীল': 'creative',
      srijonshil: 'creative',
      passage: 'passage',
      'section-header': 'section-header',
      'text-box': 'text-box',
      'text_box': 'text-box',
      'textbox': 'text-box',
      'text box': 'text-box',
      'single text box': 'text-box',
      'single-text-box': 'text-box',
      'টেক্সট বক্স': 'text-box',
      'একটি টেক্সট বক্স': 'text-box',
      or: 'or',
    };
    const type = typeAliases[rawType] ?? 'short';
    const question: Question = {
      ...raw,
      id: String(raw?.id ?? generateId('q')),
      numberingLabel: raw?.numberingLabel ? normalizeEscapedNewlines(String(raw.numberingLabel)).replace(/[.)।:]+$/, '') : undefined,
      type,
      content: extractImportedText(raw?.content, 'content'),
      marks: parseImportedMarks(raw?.marks),
    };

    if (Array.isArray(raw?.options)) {
      question.options = raw.options.map((option: any, index: number) => ({
        id: String(option?.id ?? `${question.id}_opt${index + 1}`),
        text: normalizeEscapedNewlines(String(option?.text ?? '')),
      }));
    }
    const importedTextBoxContent = extractImportedText(raw?.textBoxContent, 'textBoxContent');
    if (importedTextBoxContent.length > 0) {
      question.textBoxContent = importedTextBoxContent;
      question.textBoxDocument = plainTextToAlignedRichTextDocument(
        question.textBoxContent,
        Array.isArray(raw?.textBoxAligns) ? raw.textBoxAligns : undefined
      );
    }
    if (question.type === 'mcq' && !question.options && !question.subQuestions) {
      question.options = Array.from({ length: 4 }, (_, index) => ({
        id: `${question.id}_opt${index + 1}`,
        text: `অপশন ${index + 1}`,
      }));
    }
    if (Array.isArray(raw?.tableData)) {
      const tableData = raw.tableData.map((row: any) => Array.isArray(row) ? row.map((cell: any) => normalizeEscapedNewlines(String(cell))) : [normalizeEscapedNewlines(String(row ?? ''))]);
      question.tableData = tableData;
      question.rows = raw.rows ?? tableData.length;
      question.cols = raw.cols ?? tableData[0]?.length ?? 1;
    }
        if (Array.isArray(raw?.tableDataRich)) {
          question.tableDataRich = raw.tableDataRich.map((row: any, rowIndex: number) =>
            Array.isArray(row)
              ? row.map((cellDoc: any, colIndex: number) => {
                  if (!cellDoc) return null;
                  const fallback =
                    question.tableData?.[rowIndex]?.[colIndex] ??
                    (Array.isArray(raw?.tableData?.[rowIndex]) ? raw.tableData[rowIndex][colIndex] : '');
                  return normalizeRichTextDocument(cellDoc, String(fallback ?? ''));
                })
              : []
          );
        } else if (question.tableData) {
          question.tableDataRich = question.tableData.map((row) => row.map(() => null));
        }
    if (Array.isArray(raw?.subQuestions)) {
      question.subQuestions = raw.subQuestions.map(normalizeImportedQuestion);
    }
    return question;
  };

  const extractImportedText = (
  value: unknown,
  field: 'content' | 'textBoxContent',
  depth = 0
): string => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => extractImportedText(entry, field, depth))
      .filter((entry) => entry.length > 0)
      .join('\n');
  }
  if (typeof value !== 'string') return '';

  const trimmed = value.trim();
  if (depth > 3 || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
    return normalizeEscapedNewlines(value);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    parsed = null;
  }

  const parsedQuestions = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.questions)
      ? parsed.questions
      : null;
  const firstQuestion = parsedQuestions?.[0];
  if (firstQuestion && typeof firstQuestion === 'object') {
    const nested = firstQuestion[field] ?? (field === 'textBoxContent' ? firstQuestion.content : undefined);
    const nestedText = extractImportedText(nested, field, depth + 1);
    if (nestedText.trim().length > 0) return nestedText;
  }

  const arrayMatch = trimmed.match(new RegExp(`"${field}"\\s*:\\s*\\[([\\s\\S]*?)\\]`));
  if (arrayMatch) {
    try {
      const items = JSON.parse(`[${arrayMatch[1]}]`);
      if (Array.isArray(items) && items.length > 0) {
        return items.map((item) => String(item)).join('\n');
      }
    } catch {
      // fall through to the raw value
    }
  }

  const stringMatch = trimmed.match(new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  if (stringMatch) {
    try {
      return normalizeEscapedNewlines(JSON.parse(`"${stringMatch[1]}"`));
    } catch {
      // fall through to the raw value
    }
  }

  return normalizeEscapedNewlines(value);
};

const normalizeImportedQuestionGroups = (rawQuestions: any[]): Question[] => {
    const normalized: Question[] = [];
    let index = 0;

    while (index < rawQuestions.length) {
      const current = rawQuestions[index];
      const currentContent = String(current?.content ?? '');
      const isMcqInstruction = /সঠিক\s*উত্তর|বহুনির্বাচনী|choose\s+the\s+correct|multiple\s*choice|\bmcq\b/i.test(currentContent);

      if (isMcqInstruction && !Array.isArray(current?.subQuestions)) {
        const subQuestions: Question[] = [];
        let nextIndex = index + 1;
        while (nextIndex < rawQuestions.length && rawQuestions[nextIndex]?.type !== 'section-header') {
          const subQuestion = normalizeImportedQuestion({ ...rawQuestions[nextIndex], type: 'mcq' });
          subQuestions.push(subQuestion);
          nextIndex += 1;
        }

        normalized.push({
          ...normalizeImportedQuestion({ ...current, type: 'mcq' }),
          options: undefined,
          subQuestions,
          numberingFormat: 'bangla-numeric',
        });
        index = nextIndex;
        continue;
      }

      normalized.push(normalizeImportedQuestion(current));
      index += 1;
    }

    return normalized;
  };

// Read a picked image file and (if it is large) downscale it on a canvas so the
// stored data URL stays small enough for localStorage and quick PDF rendering.
const readImageAsDataUrl = (file: File, maxDim = 1600, quality = 0.85): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read image file'));
        reader.onload = () => {
            const src = reader.result as string;
            const img = new Image();
            img.onerror = () => resolve(src);
            img.onload = () => {
                const longest = Math.max(img.width, img.height);
                const scale = longest > maxDim ? maxDim / longest : 1;
                if (scale >= 1 && file.size < 400 * 1024) {
                    resolve(src);
                    return;
                }
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(src);
                    return;
                }
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const isPng = file.type === 'image/png';
                resolve(canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', quality));
            };
            img.src = src;
        };
        reader.readAsDataURL(file);
    });



export type NumberingFormat = 'english-numeric' | 'bangla-alpha' | 'bangla-numeric' | 'roman' | null;

export type MainNumberingFormat = 'english-numeric' | 'bangla-numeric' | 'roman' | null;

export type MarksFormat = 'bangla-numeric' | 'english-numeric';

export interface Question {
  id: string;
  numberingLabel?: string;
  type: 'passage' | 'fill-in-the-blanks' | 'short' | 'mcq' | 'essay' | 'table' | 'creative' | 'section-header' | 'text-box' | 'image' | 'or';
  content: string;
  contentAlign?: TextAlign;
  contentDocument?: RichTextDocument;
  textBoxContent?: string;
  textBoxDocument?: RichTextDocument;
  marks?: number;
  options?: { id: string; text: string }[];
  subQuestions?: Question[];
  alternatives?: (string | QuestionAlternative)[];
  numberingFormat?: NumberingFormat | null;
  tableData?: string[][];
  tableDataRich?: (RichTextDocument | null)[][];
  tableBorderMode?: 'grid' | 'box';
  tableColWidths?: number[];
  tableRowHeights?: number[];
  tableMarginLeft?: number;
  rows?: number;
  cols?: number;
  showHints?: boolean;
  imageData?: string;
  images?: QuestionImage[];
  imageWidth?: number;
  imageAlign?: 'left' | 'center' | 'right';
  imageGrayscale?: number;
  imageBrightness?: number;
  imageContrast?: number;
  imageLight?: number;
}

export interface Paper {
  id: string; // Project ID
  schoolName: string;
  examTitle: string;
  subject: string;
  grade: string;
  timeAllowed: string;
  totalMarks: string | number;
  questions: Question[];
  notes?: string;
  mainNumberingFormat?: MainNumberingFormat;
  marksFormat?: MarksFormat;
  headerTemplate?: HeaderRow[];
  headerLayoutVersion?: number;
  logoUrl?: string;
}

export interface PaperSettings {
  margins: { top: number; bottom: number; left: number; right: number; };
  width: number;
  height: number;
  fontSize: number;
  lineHeight: number;
}

export type SubPart = {
    sub: Question;
    content: boolean;
    optionRows: readonly [number, number] | null;
};

export type PageContent = {
    mainQuestion: Question;
    subParts: SubPart[];
    showMainContent: boolean;
    tableRows: readonly [number, number] | null;
    optionRows: readonly [number, number] | null;
    textBoxLines?: readonly [number, number] | null;
    formLines?: readonly [number, number] | null;
    stemLines?: readonly [number, number] | null;
    alternativeRange?: readonly [number, number] | null;
}

export interface HalfPayload {
  content: PageContent[];
  isFirstPage: boolean;
}

export interface BookletSpread {
  left: HalfPayload | null;
  right: HalfPayload | null;
}

const initialPaperData: Omit<Paper, 'id'> = {
  schoolName: 'ABC GOVT. School and College',
  examTitle: 'Annual Examination-2025',
  subject: 'Bangla',
  grade: '9',
  timeAllowed: '3 Hours',
  totalMarks: 100,
  questions: [],
  headerTemplate: defaultHeaderTemplate(),
  headerLayoutVersion: HEADER_LAYOUT_VERSION,
};


function EditorPage() {
  const [paper, setPaper] = useState<Paper | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project');
  const paperRef = useRef<Paper | null>(null);
  const lastSaveErrorRef = useRef<string | null>(null);
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());

  // Keep a ref to the latest paper so it can be flushed when the editor
  // unmounts or the page is closed (e.g. when opening the image importer).
  useEffect(() => {
    paperRef.current = paper;
  }, [paper]);

  // Load the project and its saved paper from Neon.
  useEffect(() => {
    let cancelled = false;

    const loadPaper = async () => {
      if (!projectId) {
        toast({ title: "Error", description: "No project specified.", variant: "destructive" });
        router.push('/');
        return;
      }

      try {
        await migrateLocalDataIfNeeded();

        const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
          cache: 'no-store',
        });

        if (cancelled) return;

        if (response.status === 404) {
          toast({ title: "Error", description: "Project not found.", variant: "destructive" });
          router.push('/');
          return;
        }

        if (!response.ok) {
          throw new Error(`Could not load project (${response.status})`);
        }

        const payload = await response.json() as {
          project: { id: string; name: string; class: string; subject: string };
          paper: Paper | null;
        };

        const initialData: Paper = payload.paper
          ? { ...payload.paper, id: projectId }
          : {
              ...initialPaperData,
              id: projectId,
              examTitle: payload.project.name,
              subject: payload.project.subject,
              grade: payload.project.class,
            };

        const storedQuestions = initialData.questions || [];
        const questionsWithUniqueIds = ensureUniqueIds(storedQuestions.map(normalizeQuestionText));
        const headerNeedsReset = (initialData.headerLayoutVersion ?? 1) < HEADER_LAYOUT_VERSION;
        const normalizedHeader = normalizeHeaderTemplate(initialData.headerTemplate, headerNeedsReset);
        const cleanedPaper: Paper = {
          ...initialData,
          questions: questionsWithUniqueIds,
          headerTemplate: normalizedHeader,
          headerLayoutVersion: HEADER_LAYOUT_VERSION,
        };
        const contentChanged = JSON.stringify(storedQuestions) !== JSON.stringify(questionsWithUniqueIds);
        const headerChanged =
          JSON.stringify(initialData.headerTemplate ?? null) !== JSON.stringify(normalizedHeader) ||
          initialData.headerLayoutVersion !== HEADER_LAYOUT_VERSION;

        if (!cancelled) {
          setPaper(cleanedPaper);
          // Persist the cleanup (restored line breaks, upgraded header layout) so
          // the stored paper matches what the editor and the preview show.
          if (contentChanged || headerChanged) {
            void persistPaper(cleanedPaper);
          }
        }
      } catch (error) {
        console.error('Failed to load paper from Neon', error);
        if (!cancelled) {
          toast({
            variant: "destructive",
            title: "Failed to Load Paper",
            description: "Could not load your paper from the database. Please try again.",
          });
          router.push('/');
        }
      }
    };

    void loadPaper();

    return () => {
      cancelled = true;
    };
  }, [projectId, router, toast]);

  // --- Undo/Redo history (snapshot-based) ---
  // historyRef: past states ending with the present at the last index.
  // futureRef: re-doable states. Every paper change adds a snapshot via the effect below,
  // so no individual setPaper call needs to be wrapped.
  const paperHistoryRef = useRef<Paper[]>([]);
  const paperFutureRef = useRef<Paper[]>([]);
  const skipHistoryPushRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    if (!paper) return;
    if (skipHistoryPushRef.current) {
      skipHistoryPushRef.current = false;
    } else {
      paperHistoryRef.current.push(paper);
      if (paperHistoryRef.current.length > 100) paperHistoryRef.current.shift();
      paperFutureRef.current = [];
    }
    setCanUndo(paperHistoryRef.current.length > 1);
    setCanRedo(paperFutureRef.current.length > 0);
  }, [paper]);

  const undo = () => {
    if (paperHistoryRef.current.length <= 1) return;
    const current = paperHistoryRef.current[paperHistoryRef.current.length - 1];
    paperHistoryRef.current = paperHistoryRef.current.slice(0, -1);
    paperFutureRef.current.unshift(current);
    skipHistoryPushRef.current = true;
    setPaper(paperHistoryRef.current[paperHistoryRef.current.length - 1]);
    setCanUndo(paperHistoryRef.current.length > 1);
    setCanRedo(paperFutureRef.current.length > 0);
  };

  const redo = () => {
    if (paperFutureRef.current.length === 0) return;
    const restored = paperFutureRef.current.shift() as Paper;
    paperHistoryRef.current.push(restored);
    skipHistoryPushRef.current = true;
    setPaper(restored);
    setCanUndo(paperHistoryRef.current.length > 1);
    setCanRedo(paperFutureRef.current.length > 0);
  };

  // Keyboard shortcuts: Ctrl+Z = undo, Ctrl+Shift+Z / Ctrl+Y = redo, Ctrl+S = save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const [focusedInput, setFocusedInput] = useState<{ element: HTMLElement; id: string } | null>(null);

  const [pages, setPages] = useState<PageContent[][]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showAddQuestions, setShowAddQuestions] = useState(true);
  const [isRightRailHidden, setIsRightRailHidden] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [isEditingHeaderLayout, setIsEditingHeaderLayout] = useState(false);
  const [boardZoom, setBoardZoom] = useState(1);
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const boardViewportRef = useRef<HTMLDivElement>(null);
  const boardPanRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const [bookletPages, setBookletPages] = useState<BookletSpread[]>([]);
  const hiddenRenderRef = useRef<HTMLDivElement>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  type ImageTarget = { kind: 'append'; questionId: string } | { kind: 'replace'; questionId: string; imageId: string };
  const [imageTarget, setImageTarget] = useState<ImageTarget | null>(null);
  const [settings, setSettings] = useState<PaperSettings>({
    margins: { top: 10, bottom: 10, left: 10, right: 10 },
    width: 560,
    height: 794,
    fontSize: 12,
    lineHeight: 1.4,
  });

  useEffect(() => {
    const handleSpaceKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      setIsSpaceHeld(event.type === 'keydown');
    };

    window.addEventListener('keydown', handleSpaceKey);
    window.addEventListener('keyup', handleSpaceKey);
    return () => {
      window.removeEventListener('keydown', handleSpaceKey);
      window.removeEventListener('keyup', handleSpaceKey);
    };
  }, []);

  useEffect(() => {
    if (!isPreview) {
      setBoardZoom(1);
      if (boardViewportRef.current) {
        boardViewportRef.current.scrollTo({ left: 0, top: 0 });
      }
    }
  }, [isPreview]);

  useEffect(() => {
    const viewport = boardViewportRef.current;
    if (!viewport) return;

    const handleBoardWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      event.stopPropagation();
      setBoardZoom(current => Math.min(2, Math.max(0.5, current - event.deltaY * 0.0015)));
    };

    viewport.addEventListener('wheel', handleBoardWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleBoardWheel);
  }, [isPreview]);

  const handleBoardPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isSpaceHeld || event.button !== 0) return;
    event.preventDefault();
    boardPanRef.current = {
      active: true,
      lastX: event.clientX,
      lastY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleBoardPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!boardPanRef.current.active) return;
    const viewport = boardViewportRef.current;
    if (!viewport) return;
    viewport.scrollLeft -= event.clientX - boardPanRef.current.lastX;
    viewport.scrollTop -= event.clientY - boardPanRef.current.lastY;
    boardPanRef.current.lastX = event.clientX;
    boardPanRef.current.lastY = event.clientY;
  };

  const handleBoardPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    boardPanRef.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const persistPaper = useCallback((value: Paper, options?: { notify?: boolean }): Promise<boolean> => {
    if (!projectId) return Promise.resolve(false);

    // Keep the flush-on-unmount ref in sync even if this runs before React has
    // committed the corresponding state update (e.g. right after an import).
    paperRef.current = value;

    const save = async (): Promise<boolean> => {
      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/paper`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(value),
          }
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || `Save failed (${response.status})`);
        }

        lastSaveErrorRef.current = null;

        if (options?.notify) {
          toast({
            title: "Progress Saved",
            description: "Your question paper has been saved to the database.",
          });
        }

        return true;
      } catch (error) {
        console.error("Failed to save paper to Neon", error);
        if (options?.notify || lastSaveErrorRef.current !== 'failed') {
          lastSaveErrorRef.current = 'failed';
          toast({
            variant: "destructive",
            title: "Save Failed",
            description:
              error instanceof Error
                ? error.message
                : "Could not save your paper. Please try again.",
          });
        }
        return false;
      }
    };

    // Serialize saves so a slower, older request can never overwrite newer data.
    const task = saveChainRef.current.then(save, save);
    saveChainRef.current = task.catch(() => undefined);
    return task;
  }, [projectId, toast]);

  const handleSave = () => {
    if (paper) {
      void persistPaper(paper, { notify: true });
    }
  };

  const handleExit = () => {
    if (paper) {
      void persistPaper(paper);
    }
    router.push('/');
  };

  // Autosave the paper shortly after any edit so progress is never lost when
  // navigating to the image/AI importers or reloading the page.
  const autosaveReadyRef = useRef(false);
  useEffect(() => {
    if (!paper || !projectId) return;
    if (!autosaveReadyRef.current) {
      // The first paper value comes from the database; nothing new to save yet.
      autosaveReadyRef.current = true;
      return;
    }
    const timer = window.setTimeout(() => {
      void persistPaper(paper);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [paper, projectId, persistPaper]);

  // Flush the latest state when the editor unmounts (e.g. opening the image
  // importer) and use keepalive requests when the tab is closed.
  useEffect(() => {
    const flushOnHide = () => {
      const latest = paperRef.current;
      if (!latest || !projectId) return;
      try {
        void fetch(`/api/projects/${encodeURIComponent(projectId)}/paper`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(latest),
          keepalive: true,
        }).catch(() => undefined);
      } catch (error) {
        console.error("Failed to flush paper to Neon", error);
      }
    };

    window.addEventListener('beforeunload', flushOnHide);
    window.addEventListener('pagehide', flushOnHide);
    return () => {
      window.removeEventListener('beforeunload', flushOnHide);
      window.removeEventListener('pagehide', flushOnHide);
      if (paperRef.current) {
        void persistPaper(paperRef.current);
      }
    };
  }, [projectId, persistPaper]);

  const mergeImportedQuestions = (existingPaper: Paper, importedData: any): Paper => {
    const newQuestions = normalizeImportedQuestionGroups(importedData.questions || []);

    const combinedPaper: Paper = produce(existingPaper, draft => {
        if (importedData.title) draft.examTitle = importedData.title;
        if (importedData.subject) draft.subject = importedData.subject;
        if (importedData.grade) draft.grade = importedData.grade;

        draft.questions.push(...newQuestions);
      });

    const questionsWithUniqueIds = ensureUniqueIds(combinedPaper.questions);
    return { ...combinedPaper, questions: questionsWithUniqueIds };
  };


  // Import effect - append imported questions to the already saved paper.
  useEffect(() => {
    const from = searchParams.get('from');
    if ((from === 'image' || from === 'suggest') && paper) {
      const dataToImportRaw = localStorage.getItem('newImageData');
      if (dataToImportRaw) {
        try {
          const dataToImport = JSON.parse(dataToImportRaw);
          const mergedPaper = mergeImportedQuestions(paper, dataToImport);

          setPaper(mergedPaper);
          // Persist immediately so a second import (or an immediate navigation)
          // never drops the questions that were just added.
          void persistPaper(mergedPaper);

          toast({
            title: "Questions Imported",
            description: `${dataToImport.questions?.length || 0} new question(s) have been added to your paper.`,
          });

        } catch (e) {
          console.error("Failed to parse or append paper data from localStorage", e);
          toast({
            variant: "destructive",
            title: "Import Failed",
            description: "Could not import the questions. The data was not in the correct format.",
          });
        } finally {
          localStorage.removeItem('newImageData');
          // Clean the URL
          const url = new URL(window.location.href);
          url.searchParams.delete('from');
          router.replace(url.pathname + url.search, { scroll: false });
        }
      }
    }
  }, [searchParams, router, paper, toast, persistPaper]);

  const handleFocus = <T extends HTMLElement>(e: React.FocusEvent<T>, id: string) => {
    setFocusedInput({ element: e.currentTarget, id });
  };

  const handleInsertExpression = (expression: string) => {
    if (!focusedInput) return;

    const { element } = focusedInput;

    if (element.isContentEditable) {
      if (insertTextIntoRichTextarea(element, expression)) {
        setFocusedInput({ element, id: focusedInput.id });
      }
      return;
    }

    if (!(element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement)) return;

    const { selectionStart, selectionEnd } = element;
    const currentValue = element.value;
    const valuePrototype =
      element instanceof HTMLInputElement
        ? window.HTMLInputElement.prototype
        : window.HTMLTextAreaElement.prototype;
    const nativeValueSetter = Object.getOwnPropertyDescriptor(valuePrototype, "value")?.set;

    if (selectionStart === null || selectionEnd === null) {
      const newValue = currentValue + expression;
      nativeValueSetter?.call(element, newValue);
      const event = new Event("input", { bubbles: true });
      element.dispatchEvent(event);
      return;
    }

    const newValue =
      currentValue.substring(0, selectionStart) +
      expression +
      currentValue.substring(selectionEnd);

    nativeValueSetter?.call(element, newValue);

    const event = new Event("input", { bubbles: true });
    element.dispatchEvent(event);

    setTimeout(() => {
      element.focus();
      const newCursorPos = selectionStart + expression.length;
      element.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const getFocusedFieldLabel = (): string | null => {
    if (!focusedInput || !paper) return null;
    const parts = focusedInput.id.split('-');
    const kind = parts[0];
    const qNum = (idx: number) => paper.questions.slice(0, idx + 1).filter(q => q.type !== 'section-header' && q.type !== 'or').length;
    if ((kind === 'content' || kind === 'marks') && parts.length === 2) {
      for (let qi = 0; qi < paper.questions.length; qi++) {
        const q = paper.questions[qi];
        if (q.type === 'section-header' && q.id === parts[1]) return 'section title';
        if (q.id === parts[1]) return `Q${qNum(qi)}${kind === 'marks' ? ' marks' : ''}`;
        const si = q.subQuestions?.findIndex(sq => sq.id === parts[1]) ?? -1;
        if (si !== -1) return `Q${qNum(qi)} → ${getNumbering(q.numberingFormat, si)}${kind === 'marks' ? ' marks' : ''}`;
      }
      return 'question field';
    }
    if (kind === 'option' && parts.length >= 3) {
      const qi = paper.questions.findIndex(q => q.id === parts[1]);
      if (qi === -1) return 'question field';
      if (parts.length === 3) return `Q${qNum(qi)} option`;
      const si = paper.questions[qi].subQuestions?.findIndex(sq => sq.id === parts[2]) ?? -1;
      if (si === -1) return `Q${qNum(qi)} option`;
      return `Q${qNum(qi)} → ${getNumbering(paper.questions[qi].numberingFormat, si)} option`;
    }
    if (kind === 'table' && parts.length === 4) {
      const qi = paper.questions.findIndex(q => q.id === parts[1]);
      if (qi === -1) return 'question field';
      return `Q${qNum(qi)} table R${Number(parts[2]) + 1}C${Number(parts[3]) + 1}`;
    }
    return 'question field';
  };

  const handlePaperDetailChange = (field: keyof Paper, value: string | number) => {
    setPaper(prev => produce(prev, draft => {
        if(draft) (draft as any)[field] = value
    }));
  };

  const onHeaderTemplateChange = (rows: HeaderRow[]) => {
    setPaper(prev => produce(prev, draft => {
        if (draft) draft.headerTemplate = rows;
    }));
  };

  const handleQuestionChange = (id: string, field: keyof Question, value: any) => {
    setPaper(prev => produce(prev, draft => {
        if (!draft) return;
        const question = draft.questions.find(q => q.id === id);
        if (question) {
            (question as any)[field] = value;
        }
    }));
  };

  const handleQuestionTextChange = (id: string, value: string, richDocument: RichTextDocument) => {
    setPaper(prev => produce(prev, draft => {
        if (!draft) return;
        const question = draft.questions.find(q => q.id === id);
        if (question) {
            question.content = value;
            question.contentDocument = richDocument;
        }
    }));
  };

  const handleTextBoxChange = (id: string, value: string, richDocument: RichTextDocument) => {
    setPaper(prev => produce(prev, draft => {
        if (!draft) return;
        const question = draft.questions.find(q => q.id === id);
        if (question) {
            question.textBoxContent = value;
            question.textBoxDocument = richDocument;
        }
    }));
  };

    const handleSubQuestionChange = (parentId: string, subId: string, field: keyof Question, value: any) => {
        setPaper(prev => produce(prev, draft => {
            if (!draft) return;
            const parentQuestion = draft.questions.find(q => q.id === parentId);
            if (parentQuestion && parentQuestion.subQuestions) {
                const subQuestion = parentQuestion.subQuestions.find(sq => sq.id === subId);
                if (subQuestion) {
                    (subQuestion as any)[field] = value;
                }
            }
        }));
      };

    const handleSubQuestionTextChange = (
        parentId: string,
        subId: string,
        value: string,
        richDocument: RichTextDocument
    ) => {
        setPaper(prev => produce(prev, draft => {
            if (!draft) return;
            const parentQuestion = draft.questions.find(q => q.id === parentId);
            const subQuestion = parentQuestion?.subQuestions?.find(sq => sq.id === subId);
            if (subQuestion) {
                subQuestion.content = value;
                subQuestion.contentDocument = richDocument;
            }
        }));
    };

    const updateTableQuestion = (id: string, updater: (q: Question) => void) => {
        setPaper(prev => produce(prev, draft => {
            if (!draft) return;
            const q = draft.questions.find(x => x.id === id);
            if (q) updater(q);
        }));
    };

    const handleImageFiles = async (files: FileList | null) => {
        const target = imageTarget;
        setImageTarget(null);
        if (!files || files.length === 0) return;
        const valid = Array.from(files).filter((f) => f.type.startsWith('image/'));
        if (valid.length === 0) return;
        try {
            const dataUrls = await Promise.all(valid.map((f) => readImageAsDataUrl(f)));
            setPaper(prev => produce(prev, draft => {
                if (!draft) return;
                if (target) {
                    const question = draft.questions.find(q => q.id === target.questionId);
                    if (!question) return;
                    if (!question.images) {
                        question.images = question.imageData ? [{ id: generateId('img'), data: question.imageData }] : [];
                        question.imageData = undefined;
                    }
                    if (target.kind === 'replace') {
                        const img = question.images.find(i => i.id === target.imageId);
                        if (img) img.data = dataUrls[0];
                        else question.images[question.images.length - 1].data = dataUrls[0];
                        if (question.images.length === 0) question.images.push({ id: generateId('img'), data: dataUrls[0] });
                    } else {
                        for (const d of dataUrls) question.images.push({ id: generateId('img'), data: d });
                        if (question.images.length > 1 && (question.imageWidth ?? 100) === 100) {
                            question.imageWidth = 49;
                        }
                    }
                } else {
                    const added: Question[] = dataUrls.map(d => ({
                        id: generateId('img'),
                        type: 'image',
                        content: '',
                        images: [{ id: generateId('img'), data: d }],
                        imageWidth: 100,
                        imageAlign: 'center',
                    }));
                    draft.questions.push(...added);
                }
            }));
            toast({ title: 'ছবি যোগ করা হয়েছে', description: `${valid.length}টি ছবি প্রশ্নপত্রে যুক্ত হয়েছে।` });
        } catch (e) {
            toast({ variant: 'destructive', title: 'ছবি যোগ করা যায়নি', description: 'ছবিটি পড়া সম্ভব হয়নি।' });
        }
    };

    const pickImage = (target: ImageTarget | null) => {
        setImageTarget(target);
        imageFileInputRef.current?.click();
    };

    const onTableCellChange = (id: string, row: number, col: number, value: string, richDocument?: RichTextDocument) => {
        updateTableQuestion(id, (q) => {
            if (!q.tableData) return;
            if (row < q.tableData.length && q.tableData[row]) q.tableData[row][col] = value;
            if (!q.tableDataRich) q.tableDataRich = q.tableData.map((r) => r.map(() => null));
            if (!q.tableDataRich[row]) q.tableDataRich[row] = [];
            q.tableDataRich[row][col] = richDocument ?? q.tableDataRich[row][col] ?? null;
        });
    };

    const onTableAddRow = (id: string) => {
        updateTableQuestion(id, (q) => {
            if (!q.tableData) return;
            const colCount = Math.max(1, q.tableData[0]?.length ?? 1);
            q.tableData.push(Array(colCount).fill(''));
            if (!q.tableDataRich) q.tableDataRich = q.tableData.map((r) => r.map(() => null));
            q.tableDataRich.push(Array(colCount).fill(null));
            q.rows = q.tableData.length;
        });
    };

    const onTableRemoveRow = (id: string, row: number) => {
        updateTableQuestion(id, (q) => {
            if (q.tableData) q.tableData.splice(row, 1);
            if (q.tableDataRich) q.tableDataRich.splice(row, 1);
            if (q.tableRowHeights) q.tableRowHeights.splice(row, 1);
            if (q.tableData) q.rows = q.tableData.length;
        });
    };

    const onTableAddCol = (id: string) => {
        updateTableQuestion(id, (q) => {
            if (!q.tableData || q.tableData.length === 0) return;
            if (!q.tableDataRich) q.tableDataRich = q.tableData.map((r) => r.map(() => null));
            q.tableData.forEach((r) => r.push(''));
            q.tableDataRich.forEach((r) => r.push(null));
            if (q.tableColWidths) q.tableColWidths.push(0);
            q.cols = q.tableData[0]?.length ?? q.cols;
        });
    };

    const onTableRemoveCol = (id: string, col: number) => {
        updateTableQuestion(id, (q) => {
            if (q.tableData) q.tableData.forEach((r) => r.splice(col, 1));
            if (q.tableDataRich) q.tableDataRich.forEach((r) => r.splice(col, 1));
            if (q.tableColWidths) q.tableColWidths.splice(col, 1);
            if (q.tableData) q.cols = q.tableData[0]?.length ?? q.cols;
        });
    };

    const onTableResizeRow = (id: string, row: number, height: number) => {
        updateTableQuestion(id, (q) => {
            if (!q.tableRowHeights || q.tableRowHeights.length !== q.tableData?.length) {
                q.tableRowHeights = Array(q.tableData?.length ?? 0).fill(0);
            }
            q.tableRowHeights[row] = height;
        });
    };

    const onTableColWidths = (id: string, widths: number[]) => {
        updateTableQuestion(id, (q) => {
            const colCount = q.tableData?.[0]?.length ?? 0;
            if (widths.length !== colCount) return;
            q.tableColWidths = widths.map((w) => Math.max(0, Math.round(w)));
        });
    };

    const onTableMarginLeftChange = (id: string, value: number) => {
        updateTableQuestion(id, (q) => {
            q.tableMarginLeft = Math.min(300, Math.max(0, Math.round(value)));
        });
    };

    const onTableBorderModeChange = (id: string, mode: 'grid' | 'box') => {
        updateTableQuestion(id, (q) => {
            q.tableBorderMode = mode;
        });
    };

    const tableEditCallbacks = {
        onCellChange: onTableCellChange,
        onAddRow: onTableAddRow,
        onRemoveRow: onTableRemoveRow,
        onAddCol: onTableAddCol,
        onRemoveCol: onTableRemoveCol,
        onResizeRow: onTableResizeRow,
        onColWidths: onTableColWidths,
        onMarginLeftChange: onTableMarginLeftChange,
        onBorderModeChange: onTableBorderModeChange,
    };

    const onImageChange = (id: string, patch: Partial<Question>) => {
        updateTableQuestion(id, (q) => {
            if (patch.imageWidth !== undefined) q.imageWidth = Math.min(100, Math.max(5, Math.round(patch.imageWidth)));
            if (patch.imageAlign !== undefined) q.imageAlign = patch.imageAlign;
            if (patch.imageGrayscale !== undefined) q.imageGrayscale = Math.min(100, Math.max(0, Math.round(patch.imageGrayscale)));
            if (patch.imageBrightness !== undefined) q.imageBrightness = Math.min(200, Math.max(0, Math.round(patch.imageBrightness)));
            if (patch.imageContrast !== undefined) q.imageContrast = Math.min(200, Math.max(0, Math.round(patch.imageContrast)));
            if (patch.imageLight !== undefined) q.imageLight = Math.min(100, Math.max(10, Math.round(patch.imageLight)));
        });
    };

    const imageEditCallbacks = {
        onImageChange,
    };

  const addSubQuestion = (questionId: string, type: Question['type'] = 'short') => {
    setPaper(prev => produce(prev, draft => {
        if (!draft) return;
        const question = draft.questions.find(q => q.id === questionId);
        if (question) {
            const newSubQuestion: Question = {
                id: generateId('sq'),
                type: type,
                content: 'New question...',
                marks: 1,
            };
            if (type === 'mcq') {
                newSubQuestion.options = [
                    { id: generateId('opt'), text: 'Option 1' },
                    { id: generateId('opt'), text: 'Option 2' },
                    { id: generateId('opt'), text: 'Option 3' },
                    { id: generateId('opt'), text: 'Option 4' },
                ];
            }
            if (!question.subQuestions) {
                question.subQuestions = [];
            }
            question.subQuestions.push(newSubQuestion);
        }
    }));
  };

  const removeSubQuestion = (questionId: string, subQuestionId: string) => {
    setPaper(prev => produce(prev, draft => {
        if (!draft) return;
        const question = draft.questions.find(q => q.id === questionId);
        if (question && question.subQuestions) {
            question.subQuestions = question.subQuestions.filter(sq => sq.id !== subQuestionId);
        }
    }));
  };

  const addAlternative = (questionId: string) => {
    setPaper(prev => produce(prev, draft => {
        if (!draft) return;
        const question = draft.questions.find(q => q.id === questionId);
        if (question) {
            question.alternatives = [...(question.alternatives ?? []), { content: '' }];
        }
    }));
  };

  const updateAlternative = (questionId: string, index: number, value: string, richDocument?: RichTextDocument) => {
    setPaper(prev => produce(prev, draft => {
        if (!draft) return;
        const question = draft.questions.find(q => q.id === questionId);
        if (question?.alternatives && index >= 0 && index < question.alternatives.length) {
            const current = question.alternatives[index];
            question.alternatives[index] = {
                content: value,
                contentAlign: typeof current === 'string' ? undefined : current.contentAlign,
                contentDocument: richDocument ?? (typeof current === 'string' ? undefined : current.contentDocument),
            };
        }
    }));
  };

  const setAlternativeAlign = (questionId: string, index: number, align: TextAlign) => {
    setPaper(prev => produce(prev, draft => {
        if (!draft) return;
        const question = draft.questions.find(q => q.id === questionId);
        if (question?.alternatives && index >= 0 && index < question.alternatives.length) {
            const current = question.alternatives[index];
            question.alternatives[index] = {
                content: typeof current === 'string' ? current : current.content,
                contentAlign: align,
                contentDocument: typeof current === 'string' ? undefined : current.contentDocument,
            };
        }
    }));
  };

  const removeAlternative = (questionId: string, index: number) => {
    setPaper(prev => produce(prev, draft => {
        if (!draft) return;
        const question = draft.questions.find(q => q.id === questionId);
        if (question?.alternatives) {
            question.alternatives.splice(index, 1);
        }
    }));
  };

  const addOption = (questionId: string, subQuestionId?: string) => {
    setPaper(prev => produce(prev, draft => {
      if (!draft) return;
      const q = draft.questions.find(q => q.id === questionId);
      if (!q) return;

      let target: Question | undefined = q;
      // If subQuestionId is provided, find the sub-question
      if (subQuestionId) {
        target = q.subQuestions?.find(sq => sq.id === subQuestionId);
      }

      if (target) {
        const newOption = { id: generateId('opt'), text: 'New Option' };
        if (!target.options) {
          target.options = [];
        }
        target.options.push(newOption);
      }
    }));
  };

  const removeOption = (questionId: string, optionId: string, subQuestionId?: string) => {
    setPaper(prev => produce(prev, draft => {
      if (!draft) return;
      const q = draft.questions.find(q => q.id === questionId);
      if (!q) return;

      let target: Question | undefined = q;
      if (subQuestionId) {
        target = q.subQuestions?.find(sq => sq.id === subQuestionId);
      }

      if (target && target.options) {
        target.options = target.options.filter(opt => opt.id !== optionId);
      }
    }));
  };

  const handleOptionChange = (questionId: string, optionId: string, text: string, subQuestionId?: string) => {
    setPaper(prev => produce(prev, draft => {
      if (!draft) return;
      const q = draft.questions.find(q => q.id === questionId);
      if (!q) return;

      let target: Question | undefined = q;
      if (subQuestionId) {
        target = q.subQuestions?.find(sq => sq.id === subQuestionId);
      }

      if (target && target.options) {
        const opt = target.options.find(opt => opt.id === optionId);
        if (opt) {
          opt.text = text;
        }
      }
    }));
  };

  const toggleHints = (questionId: string) => {
    setPaper(prev => produce(prev, draft => {
      if (!draft) return;
      const q = draft.questions.find(q => q.id === questionId);
      if (q) {
            if (q.showHints === false) {
                q.showHints = true;
                if (!q.tableData || q.tableData.length === 0) {
                    q.rows = 2;
                    q.cols = 4;
                    q.tableData = [
                        ['hint 1', 'hint 2', 'hint 3', 'hint 4'],
                        ['hint 5', 'hint 6', 'hint 7', 'hint 8'],
                    ];
                }
            } else {
                q.showHints = false;
            }
        }
    }));
  };

  const addQuestionTable = (questionId: string) => {
    setPaper(prev => produce(prev, draft => {
      if (!draft) return;
      const q = draft.questions.find(x => x.id === questionId);
      if (!q) return;
      if (!q.tableData || q.tableData.length === 0) {
        q.rows = 2;
        q.cols = 2;
        q.tableData = [
          ['', ''],
          ['', ''],
        ];
      }
    }));
  };

  const removeQuestionTable = (questionId: string) => {
    setPaper(prev => produce(prev, draft => {
      if (!draft) return;
      const q = draft.questions.find(x => x.id === questionId);
      if (!q) return;
      q.tableData = undefined;
      q.tableDataRich = undefined;
      q.rows = undefined;
      q.cols = undefined;
    }));
  };


  const getNumbering = (format: NumberingFormat | undefined, index: number): string => {
    const banglaNumerals = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    const banglaAlphabet = ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ', 'ট', 'ঠ', 'ড', 'ঢ', 'ণ', 'ত', 'থ', 'দ', 'ধ', 'ন'];
    const toRoman = (num: number): string => {
      const roman = {M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1};
      let str = '';
      for (let i of Object.keys(roman)) {
        let qCount = Math.floor(num / (roman as any)[i]);
        num -= qCount * (roman as any)[i];
        str += i.repeat(qCount);
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
      case undefined:
      default:
        return banglaAlphabet[index % banglaAlphabet.length];
    }
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    setPaper(prev => produce(prev, draft => {
        if (!draft) return;
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= draft.questions.length) {
            return;
        }
        const [movedQuestion] = draft.questions.splice(index, 1);
        draft.questions.splice(newIndex, 0, movedQuestion);
    }));
  };

  const removeQuestion = (id: string) => {
    setPaper(prev => produce(prev, draft => {
        if (!draft) return;
        draft.questions = draft.questions.filter(q => q.id !== id);
    }));
  };

  const addQuestion = (type: Question['type']) => {
    const newQuestion: Question = {
      id: generateId('q'),
      type: type,
      content: '',
      marks: 5,
    };

    if (type === 'section-header') {
        newQuestion.content = 'ক বিভাগ';
        delete newQuestion.marks;
    }

    if (type === 'text-box') {
        newQuestion.content = '';
        newQuestion.textBoxContent = '';
        delete newQuestion.marks;
    }

    if (type === 'passage' || type === 'short' || type === 'essay' || type === 'fill-in-the-blanks' || type === 'mcq' || type === 'creative') {
      newQuestion.subQuestions = [];
      newQuestion.numberingFormat = 'bangla-alpha';

      switch (type) {
        case 'passage':
          newQuestion.content = 'নিচের অনুচ্ছেদটি পড় এবং প্রশ্নগুলোর উত্তর দাও:';
          newQuestion.marks = 10;
          newQuestion.subQuestions.push({ id: generateId('sq'), type: 'short', content: 'নতুন প্রশ্ন...', marks: 2});
          break;
        case 'creative':
          newQuestion.content = 'নিচের উদ্দীপকটি পড় এবং প্রশ্নগুলোর উত্তর দাও:';
          delete newQuestion.marks;
          newQuestion.subQuestions.push({ id: generateId('sq'), type: 'short', content: 'জ্ঞানমূলক', marks: 1});
          newQuestion.subQuestions.push({ id: generateId('sq'), type: 'short', content: 'অনুধাবনমূলক', marks: 2});
          newQuestion.subQuestions.push({ id: generateId('sq'), type: 'short', content: 'প্রয়োগমূলক', marks: 3});
          newQuestion.subQuestions.push({ id: generateId('sq'), type: 'short', content: 'উচ্চতর দক্ষতামূলক', marks: 4});
          break;
case 'fill-in-the-blanks':
          newQuestion.content = 'খালি জায়গা পূরণ কর:';
          newQuestion.marks = 5;
          newQuestion.showHints = true;
          newQuestion.rows = 2;
          newQuestion.cols = 4;
          newQuestion.tableData = [
            ['hint 1', 'hint 2', 'hint 3', 'hint 4'],
            ['hint 5', 'hint 6', 'hint 7', 'hint 8'],
          ];
          newQuestion.subQuestions.push({ id: generateId('sq'), type: 'fill-in-the-blanks', content: 'নতুন লাইন...', marks: 1});
          break;
        case 'short':
          newQuestion.content = 'নিচের প্রশ্নগুলোর উত্তর দাও:';
          newQuestion.marks = 10;
          newQuestion.subQuestions.push({ id: generateId('sq'), type: 'short', content: 'নতুন প্রশ্ন...', marks: 2});
          break;
        case 'essay':
          newQuestion.content = 'নিচের প্রশ্নগুলোর উত্তর দাও:';
          newQuestion.marks = 20;
          newQuestion.subQuestions.push({ id: generateId('sq'), type: 'essay', content: 'নতুন রচনামূলক প্রশ্ন...', marks: 10});
          break;
        case 'mcq':
            newQuestion.content = 'সঠিক উত্তরটি বেছে নাও:';
            newQuestion.marks = 10;
            newQuestion.numberingFormat = 'bangla-numeric';
            newQuestion.subQuestions.push({
                id: generateId('sq'),
                type: 'mcq',
                content: 'নতুন MCQ প্রশ্ন...',
                marks: 1,
                options: [
                    { id: generateId('opt'), text: 'অপশন ১' },
                    { id: generateId('opt'), text: 'অপশন ২' },
                    { id: generateId('opt'), text: 'অপশন ৩' },
                    { id: generateId('opt'), text: 'অপশন ৪' },
                ]
            });
            break;
      }
    }

    if (type === 'table') {
        newQuestion.content = 'Make four sentences from the substitution table.';
        newQuestion.marks = 4;
        newQuestion.rows = 3;
        newQuestion.cols = 3;
        newQuestion.tableData = [
            ['A moonlit night', 'is', 'in the habit of enjoying a moonlit night very much'],
            ['The poets', '', 'different from any other night'],
            ['People in the village', 'are', 'friendly with others in a moonlit night'],
        ];
    }

    setPaper(prev => produce(prev, draft => {
      if (!draft) return;
      draft.questions.push(newQuestion);
    }));
  };

  const addNote = () => {
    setPaper(prev => produce(prev, draft => {
        if (!draft) return;
        draft.notes = '(ক ও খ বিভাগ থেকে দুটি এবং গ ও ঘ বিভাগ থেকে ১টি সহ মোট ৭ টি প্রশ্নের উত্তর দাও)';
        draft.headerTemplate = draft.headerTemplate && draft.headerTemplate.length > 0
            ? draft.headerTemplate
            : defaultHeaderTemplate();
        if (!draft.headerTemplate.some(row => row.cells.some(c => c.kind === 'notes'))) {
            draft.headerTemplate = [
                ...draft.headerTemplate,
                { id: generateId('hr'), layout: 'center', cells: [{ id: generateId('hc'), kind: 'notes', align: 'center', bold: true, size: 12 }] },
            ];
        }
    }));
  };

  const handleLogoFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'লোগো হিসেবে ছবি ফাইল দিন', variant: 'destructive' });
      return;
    }
    try {
      const dataUrl = await readImageAsDataUrl(file, 512, 0.9);
      setPaper(prev => produce(prev, draft => { if (draft) draft.logoUrl = dataUrl; }));
    } catch {
      toast({ title: 'লোগো আপলোড করা যায়নি', variant: 'destructive' });
    }
  };

  const removeLogo = () => {
    setPaper(prev => produce(prev, draft => { if (draft) draft.logoUrl = undefined; }));
  };

  const containsMath = (text: string) => {
    if(!text) return false;
    return text.includes('$') || text.includes('\\');
  }

  const QuestionActions = ({ index }: { index: number }) => (
    <div className="absolute top-0 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
       <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveQuestion(index, 'up')} disabled={index === 0}>
        <ArrowUp className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveQuestion(index, 'down')} disabled={!paper || index === paper.questions.length - 1}>
        <ArrowDown className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => paper && removeQuestion(paper.questions[index].id)}>
        <Trash2 className="size-4" />
      </Button>
    </div>
  );

  const renderQuestion = (question: Question, index: number) => {
    if (!paper) return null;
    const isContainer = ['passage', 'fill-in-the-blanks', 'short', 'mcq', 'essay', 'creative'].includes(question.type);

    const questionNumber = paper.questions.slice(0, index + 1).filter(q => q.type !== 'section-header' && q.type !== 'image' && q.type !== 'or').length;

    if (question.type === 'or') {
        return (
            <Card key={question.id} className="group relative border-0 bg-transparent shadow-none py-1">
                <QuestionActions index={index} />
                <div className="text-center font-bold text-base select-none">{question.content || 'অথবা'}</div>
            </Card>
        );
    }

    if (question.type === 'section-header') {
        return (
            <Card key={question.id} className="group relative p-4 bg-slate-100 dark:bg-slate-800">
                 <QuestionActions index={index} />
                 <Input
                    value={question.content}
                    onFocus={(e) => handleFocus(e, `content-${question.id}`)}
                    onChange={(e) => handleQuestionChange(question.id, 'content', e.target.value)}
                    className="text-center font-bold underline decoration-dotted text-lg border-0 focus-visible:ring-0 shadow-none bg-transparent"
                 />
            </Card>
        )
    }

    const questionCard = (children: React.ReactNode) => (
        <Card key={question.id} className="group relative p-4 space-y-3 bg-slate-50 dark:bg-slate-900">
          <QuestionActions index={index} />
          <div className="flex items-start justify-between">
            <Label className="font-bold pt-1.5">{(() => {
              const num = question.numberingLabel ?? getNumbering(paper.mainNumberingFormat === undefined ? 'bangla-numeric' : paper.mainNumberingFormat, questionNumber - 1);
              return num ? `${num}.` : '';
            })()}</Label>
            <div className="flex-1 ml-2">
                 <RichTextarea
                    value={question.content}
                    richDocument={question.contentDocument}
                    onFocus={(e) => handleFocus(e, `content-${question.id}`)}
                    onChange={(value, richDocument) => handleQuestionTextChange(question.id, value, richDocument)}
                    align={question.contentAlign ?? 'left'}
                    onAlignChange={(value) => handleQuestionChange(question.id, 'contentAlign', value)}
                    textareaClassName="bg-white dark:bg-slate-800 font-semibold"
                    rows={2}
                 />
                 {containsMath(question.content) && (
                    <div className="p-2 border rounded-md mt-1 bg-white dark:bg-slate-800/50 min-h-[3rem] prose prose-sm max-w-none">
                        <LatexRenderer content={question.content} />
                    </div>
                 )}
                 {question.type === 'text-box' && (
                    <div className="mt-2 border border-slate-500 dark:border-slate-400 rounded-sm bg-white dark:bg-slate-800 p-2">
                       <RichTextarea
                          value={question.textBoxContent ?? ''}
                          richDocument={question.textBoxDocument}
                          onFocus={(e) => handleFocus(e, `textbox-${question.id}`)}
                          onChange={(value, richDocument) => handleTextBoxChange(question.id, value, richDocument)}
                          align="left"
                          rows={5}
                          placeholder="টেক্সট বক্সের লেখা..."
                       />
                    </div>
                 )}
                 <div className="mt-2 space-y-2">
                   {question.alternatives?.map((alternative, altIndex) => {
                     const alternativeContent = getAlternativeContent(alternative);
                     const alternativeAlign = getAlternativeAlign(alternative) ?? question.contentAlign ?? 'left';
                     return (
                       <div key={`${question.id}-alt-${altIndex}`} className="flex items-start gap-2">
                         <span className="italic font-semibold pt-8 shrink-0">অথবা,</span>
                         <div className="flex-1">
                           <RichTextarea
                             value={alternativeContent}
                             richDocument={getAlternativeDocument(alternative)}
                             onFocus={(e) => handleFocus(e, `alternative-${question.id}-${altIndex}`)}
                             onChange={(value, richDocument) => updateAlternative(question.id, altIndex, value, richDocument)}
                             align={alternativeAlign}
                             onAlignChange={(value) => setAlternativeAlign(question.id, altIndex, value)}
                             textareaClassName="bg-white dark:bg-slate-800"
                             rows={1}
                             placeholder="বিকল্প প্রশ্ন..."
                           />
                           {containsMath(alternativeContent) && (
                             <div className="p-2 border rounded-md mt-1 bg-white dark:bg-slate-800/50 min-h-[1.5rem] prose prose-sm max-w-none">
                               <LatexRenderer content={alternativeContent} />
                             </div>
                           )}
                         </div>
                         <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0 mt-7" onClick={() => removeAlternative(question.id, altIndex)}>
                           <Trash2 className="size-4" />
                         </Button>
                       </div>
                     );
                   })}
                   <Button variant="ghost" size="sm" className="-ml-2 h-7 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white" onClick={() => addAlternative(question.id)}>
                     <Plus className="mr-1 size-3.5" /> অথবা যোগ করুন
                   </Button>
                 </div>
            </div>
          </div>
            <div className="flex items-center gap-4 pl-8">
              <div className="flex items-center gap-2">
                  <Label htmlFor={`marks-${question.id}`} className="text-sm">Marks:</Label>
                  <Input
                    id={`marks-${question.id}`}
                    type="number"
                    min={0}
                    value={question.marks ?? ''}
                    onFocus={(e) => handleFocus(e, `marks-${question.id}`)}
                    onChange={(e) => handleQuestionChange(question.id, 'marks', e.target.value === '' ? undefined : Number(e.target.value))}
                    className="w-20 h-8"
                    placeholder="Marks"
                  />
              </div>
              { isContainer && (
              <div className="flex items-center gap-2">
                  <Label htmlFor={`numbering-${question.id}`} className="text-sm">নাম্বারিং:</Label>
                  <Select
                    value={question.numberingFormat === null ? 'none' : (question.numberingFormat ?? 'bangla-alpha')}
                    onValueChange={(value) => handleQuestionChange(question.id, 'numberingFormat', value === 'none' ? null : (value as NumberingFormat))}
                  >
                    <SelectTrigger id={`numbering-${question.id}`} className="w-32 h-8 text-xs">
                      <SelectValue placeholder="Format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="english-numeric">1, 2, 3</SelectItem>
                      <SelectItem value="bangla-alpha">ক, খ, গ</SelectItem>
                      <SelectItem value="bangla-numeric">১, ২, ৩</SelectItem>
                      <SelectItem value="roman">i, ii, iii</SelectItem>
                      <SelectItem value="none">কিছু না দেখাও</SelectItem>
                    </SelectContent>
                  </Select>
              </div>
              )}
            </div>
          {question.type !== 'table' && question.type !== 'fill-in-the-blanks' && (
            <div className="pl-8 space-y-2">
              {question.tableData && question.tableData.length > 0 ? (
                <>
                  {tableEditor()}
                  <Button variant="outline" size="sm" onClick={() => removeQuestionTable(question.id)}>
                    <Trash2 className="mr-2 size-4" /> সারণি মুছুন
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => addQuestionTable(question.id)}>
                  <Plus className="mr-2 size-4" /> সারণি যোগ করুন
                </Button>
              )}
            </div>
          )}
          {children}
        </Card>
      );

      const subQuestionRenderer = (qType: Question['type']) => (
        <>
            <div className="pl-6 space-y-2">
            {question.subQuestions?.map((sq, sqIndex) => (
                <div key={sq.id} className="flex items-start gap-2 pt-2">
                <span className="font-semibold pt-2">{(() => {
                  const num = sq.numberingLabel ?? getNumbering(question.numberingFormat, sqIndex);
                  return num ? `${num})` : '';
                })()}</span>
                <div className="flex-grow space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      {(() => {
                        const subContentEditor = (
                          <>
                            <RichTextarea
                                value={sq.content}
                                richDocument={sq.contentDocument}
                                onFocus={(e) => handleFocus(e, `content-${sq.id}`)}
                                onChange={(value, richDocument) => handleSubQuestionTextChange(question.id, sq.id, value, richDocument)}
                                align={sq.contentAlign ?? 'left'}
                                onAlignChange={(value) => handleSubQuestionChange(question.id, sq.id, 'contentAlign', value)}
                                textareaClassName="bg-white dark:bg-slate-800"
                                rows={sq.type === 'text-box' ? 3 : 1}
                            />
                            {containsMath(sq.content) && (
                              <div className="p-2 border rounded-md mt-1 bg-white dark:bg-slate-800/50 min-h-[1.5rem] prose prose-sm max-w-none">
                                  <LatexRenderer content={sq.content} />
                              </div>
                            )}
                          </>
                        );

                        if (sq.type !== 'text-box') return subContentEditor;

                        return (
                          <div className="border border-slate-500 dark:border-slate-400 rounded-sm bg-white dark:bg-slate-800 p-2">
                            {subContentEditor}
                          </div>
                        );
                      })()}
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeSubQuestion(question.id, sq.id)}>
                        <Trash2 className="size-4" />
                    </Button>
                  </div>
                  {sq.type === 'mcq' && (
                    <div className="pl-8 space-y-2 group/sub">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {sq.options?.map((opt, optIndex) => (
                                <div key={opt.id} className="flex items-center gap-2">
                    <span className="font-semibold">{(() => {
                      const num = getNumbering('bangla-alpha', optIndex);
                      return num ? `${num})` : '';
                    })()}</span>
                                <Input
                                    value={opt.text}
                                    onInput={(e) => handleOptionChange(question.id, opt.id, (e.target as HTMLInputElement).value, sq.id)}
                                    onFocus={(e) => handleFocus(e, `option-${question.id}-${sq.id}-${opt.id}`)}
                                    className="bg-white dark:bg-slate-800"
                                />
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0 opacity-0 group-hover/sub:opacity-100" onClick={() => removeOption(question.id, opt.id, sq.id)}>
                                    <Trash2 className="size-4" />
                                </Button>
                                </div>
                            ))}
                        </div>
                         <Button variant="outline" size="sm" onClick={() => addOption(question.id, sq.id)}><Plus className="mr-2 size-4" /> অপশন যোগ করুন</Button>
                    </div>
                  )}
                </div>
                </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addSubQuestion(question.id, qType)}><Plus className="mr-2 size-4" /> প্রশ্ন যোগ করুন</Button>
            </div>
        </>
    );

      const tableEditor = () => (
        <EditableTable
          questionId={question.id}
          data={question.tableData ?? []}
          richData={question.tableDataRich}
          borderMode={question.tableBorderMode ?? 'grid'}
          colWidths={question.tableColWidths}
          rowHeights={question.tableRowHeights}
          tableMarginLeft={question.tableMarginLeft}
          callbacks={tableEditCallbacks}
          forceEditing
        />
      );

    switch (question.type) {
        case 'image': {
            const w = Math.min(100, Math.max(5, question.imageWidth ?? 100));
            const align = question.imageAlign ?? 'center';
            const grayscale = question.imageGrayscale ?? 0;
            const brightness = question.imageBrightness ?? 100;
            const contrast = question.imageContrast ?? 100;
            const light = question.imageLight ?? 100;
            const filter = imageFilterCss({ grayscale, brightness, contrast, light });
            const images = getQuestionImages(question);
            const setField = (field: keyof Question) => (e: React.ChangeEvent<HTMLInputElement>) =>
                handleQuestionChange(question.id, field, Number(e.target.value));
            const sliderRow = (label: string, value: number, min: number, max: number, field: keyof Question) => (
                <div className="flex items-center gap-2">
                    <Label className="w-20 text-sm">{label}</Label>
                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={1}
                        value={value}
                        onChange={setField(field)}
                        className="h-3 flex-1 cursor-pointer"
                    />
                    <span className="w-10 text-right text-xs tabular-nums">{value}%</span>
                </div>
            );
            const onRemoveImage = (imageId: string) => {
                setPaper(prev => produce(prev, draft => {
                    const q = draft?.questions.find(x => x.id === question.id);
                    if (!q || !q.images) return;
                    q.images = q.images.filter(i => i.id !== imageId);
                    if (q.images.length === 1) {
                        q.imageData = q.images[0].data;
                        q.images = undefined;
                    }
                }));
            };
            return (
                <Card key={question.id} className="group relative p-4 space-y-3 bg-slate-50 dark:bg-slate-900">
                    <QuestionActions index={index} />
                    <div className="flex items-center justify-between gap-2 pr-20">
                        <Label className="font-bold">ছবি{images.length > 1 ? ` (${images.length}টি)` : ''}</Label>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => pickImage({ kind: 'append', questionId: question.id })}>
                                <Plus className="mr-2 size-4" /> আরেকটি ছবি
                            </Button>
                            {images.length > 0 && (
                                <Button variant="outline" size="sm" onClick={() => pickImage({ kind: 'replace', questionId: question.id, imageId: images[images.length - 1].id })}>
                                    <ImageIcon className="mr-2 size-4" /> ছবি বদলান
                                </Button>
                            )}
                        </div>
                    </div>
                    <div className="rounded-md border bg-white dark:bg-slate-800 p-2">
                        {images.length > 0 ? (
                            <div style={imageGroupStyle(align)}>
                                {images.map(img => (
                                    <div key={img.id} className="relative">
                                        <img
                                            src={img.data}
                                            alt=""
                                            style={imageItemStyle(images.length, w, filter)}
                                        />
                                        {images.length > 1 && (
                                            <button
                                                type="button"
                                                title="ছবি মুছুন"
                                                onClick={() => onRemoveImage(img.id)}
                                                className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600"
                                            >
                                                <Minus className="size-3" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => pickImage({ kind: 'append', questionId: question.id })}
                                className="flex w-full items-center justify-center gap-2 py-8 text-sm text-slate-400 hover:text-slate-600"
                            >
                                <ImageIcon className="size-5" /> ছবি নির্বাচন করুন
                            </button>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Label className="text-sm">প্রস্থ:</Label>
                            <input
                                type="range"
                                min={5}
                                max={100}
                                step={1}
                                value={w}
                                onChange={(e) => handleQuestionChange(question.id, 'imageWidth', Number(e.target.value))}
                                className="h-3 w-40 cursor-pointer"
                            />
                            <span className="w-10 text-right text-xs tabular-nums">{w}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Label className="text-sm">অবস্থান:</Label>
                            <Select value={align} onValueChange={(value) => handleQuestionChange(question.id, 'imageAlign', value)}>
                                <SelectTrigger className="h-8 w-28 text-xs">
                                    <SelectValue placeholder="অবস্থান" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="left">বাম</SelectItem>
                                    <SelectItem value="center">মাঝখানে</SelectItem>
                                    <SelectItem value="right">ডান</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                handleQuestionChange(question.id, 'imageGrayscale', 0);
                                handleQuestionChange(question.id, 'imageBrightness', 100);
                                handleQuestionChange(question.id, 'imageContrast', 100);
                                handleQuestionChange(question.id, 'imageLight', 100);
                            }}
                        >
                            রিসেট
                        </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                        {sliderRow('গ্রেস্কেল', grayscale, 0, 100, 'imageGrayscale')}
                        {sliderRow('ব্রাইটনেস', brightness, 0, 200, 'imageBrightness')}
                        {sliderRow('কনট্রাস্ট', contrast, 0, 200, 'imageContrast')}
                        {sliderRow('লাইট', light, 10, 100, 'imageLight')}
                    </div>
                </Card>
            );
        }
        case 'passage':
            return questionCard(subQuestionRenderer('short'));
        case 'creative':
            return questionCard(subQuestionRenderer('short'));
        case 'fill-in-the-blanks':
             return questionCard(
                <>
                  <div className="flex gap-2 mb-2">
                    <Button size="sm" variant="outline" onClick={() => toggleHints(question.id)}>
                        {question.showHints === false ? <PlusCircle className="mr-2 size-4" /> : <MinusCircle className="mr-2 size-4" />}
                        {question.showHints === false ? 'Hints যোগ করুন' : 'Hints লুকান'}
                    </Button>
                  </div>
                  {question.showHints !== false && tableEditor()}
                  {subQuestionRenderer('fill-in-the-blanks')}
                </>
             );
        case 'short':
          return questionCard(subQuestionRenderer('short'));
        case 'essay':
          return questionCard(subQuestionRenderer('essay'));
        case 'mcq':
            if (question.subQuestions && question.subQuestions.length > 0) {
              return questionCard(subQuestionRenderer('mcq'));
            }
            return questionCard(
              <div className="pl-8 space-y-2 group/sub">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {question.options?.map((opt, optIndex) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <span className="font-semibold">{getNumbering('bangla-alpha', optIndex)})</span>
                      <Input
                        value={opt.text}
                        onInput={(e) => handleOptionChange(question.id, opt.id, (e.target as HTMLInputElement).value)}
                        onFocus={(e) => handleFocus(e, `option-${question.id}-${opt.id}`)}
                        className="bg-white dark:bg-slate-800"
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0 opacity-0 group-hover/sub:opacity-100" onClick={() => removeOption(question.id, opt.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={() => addOption(question.id)}><Plus className="mr-2 size-4" /> Add Option</Button>
              </div>
            );
        case 'text-box':
            return questionCard(null);
        case 'table':
            return questionCard(tableEditor());
        default:
            return null;
    }
  }

  useLayoutEffect(() => {
    if (!paper) return;

    // Debounce pagination calculation to avoid recalculating on every keystroke (500ms)
    let cancelled = false;
    const debounceTimer = setTimeout(() => {
      // mm -> px (96dpi)
      const mmToPx = (mm: number) => mm * 3.7795275591;

      // choose the selector that identifies each question block in the rendered PaperPage
      const QUESTION_SELECTOR = '[data-question-id]';

      const calculatePages = async () => {
      if (!hiddenRenderRef.current) {
        setPages([]);
        return;
      }

      // clean any previous content
      hiddenRenderRef.current.innerHTML = '';

      // create a temporary container to render the full continuous page
      const tempRenderContainer = document.createElement('div');
      // ensure same width as preview rendering to match measurements
      tempRenderContainer.style.width = `${settings.width}px`;
      tempRenderContainer.style.boxSizing = 'border-box';
      hiddenRenderRef.current.appendChild(tempRenderContainer);
      const root = createRoot(tempRenderContainer);

      // Render entire paper into the temp container (single long flow)
      root.render(
        <PaperPage
          paper={paper}
          pageContent={paper.questions.map(q => ({ mainQuestion: q, subParts: (q.subQuestions || []).map(sub => ({ sub, content: true, optionRows: null })), showMainContent: true, tableRows: null, optionRows: null }))}
          isFirstPage={true}
          settings={settings}
          allQuestions={paper.questions}
        />
      );

      try {
        // wait for webfonts/images to finish loading (more reliable than a fixed delay)
        if ((document as any).fonts && (document as any).fonts.ready) {
          try {
            // The paper font is loaded with font-display: swap, so the first paint
            // of the measuring container can still use the fallback font. That
            // changes the line wrapping and makes every page end too early, so
            // the font is requested explicitly before anything is measured.
            const fonts = (document as any).fonts;
            if (fonts.load) {
              await Promise.all([
                fonts.load(`16px "SolaimanLipi"`),
                fonts.load(`16px "Noto Serif Bengali"`),
                fonts.load(`16px "Times New Roman"`),
              ]);
            }
            await fonts.ready;
          } catch (e) { /* ignore */ }
        }

        // wait for images inside container to load
        const imgs = tempRenderContainer.querySelectorAll('img');
        if (imgs.length) {
          await Promise.all(Array.from(imgs).map(img => {
            const im = img as HTMLImageElement;
            return im.complete ? Promise.resolve() : new Promise<void>(res => { im.onload = im.onerror = () => res(); });
          }));
        }

        // small stabilization pause so layout settles (safe but tiny)
        await new Promise(r => setTimeout(r, 50));

        if (cancelled) return;

        // PAGE geometry (px). Convert margins from mm to px and subtract from height.
        // The content is allowed to run right up to the bottom margin line so no
        // page wastes vertical space; the tolerance only absorbs sub-pixel rounding.
        const PAGE_BOTTOM_TOLERANCE_PX = 2;
        const pageInnerHeight =
          settings.height -
          mmToPx(settings.margins.top) -
          mmToPx(Math.max(settings.margins.bottom, MIN_BOTTOM_PADDING_MM));
        // Every page fills the same content box: the top margin is identical on
        // all pages and the content stops on the bottom margin line, so every
        // page has the same, level bottom margin.
        const fillLimit = pageInnerHeight - PAGE_BOTTOM_TOLERANCE_PX;
        // Every page starts its content at the same top offset (margins.top); no
        // extra top padding is rendered on continuation pages, so a flush simply
        // starts accounting from zero again.

        // get the rendered paper page root inside the temp container
        const renderedPaperPage = tempRenderContainer.querySelector('.paper-page') as HTMLElement | null;
        if (!renderedPaperPage) {
          root.unmount();
          if (hiddenRenderRef.current?.contains(tempRenderContainer)) hiddenRenderRef.current.removeChild(tempRenderContainer);
          return;
        }

        const allQuestionElements = Array.from(renderedPaperPage.querySelectorAll<HTMLElement>(QUESTION_SELECTOR));
        if ((globalThis as any).__PAGINATION_DEBUG__) {
            const firstSub = renderedPaperPage.querySelector<HTMLElement>('.subquestion-content');
            const firstLine = renderedPaperPage.querySelector<HTMLElement>('[data-stem-line]');
            console.log('[measure] pageWidth', renderedPaperPage.getBoundingClientRect().width,
                'subWidth', firstSub?.getBoundingClientRect().width,
                'subHeight', firstSub?.getBoundingClientRect().height,
                'lineWidth', firstLine?.getBoundingClientRect().width,
                'fontSize', window.getComputedStyle(renderedPaperPage).fontSize,
                'fontFamily', window.getComputedStyle(renderedPaperPage).fontFamily);
            renderedPaperPage.querySelectorAll<HTMLElement>('.subquestion-content').forEach((el, index) => {
                console.log('[measure-sub]', index, Math.round(el.getBoundingClientRect().height), Math.round(el.getBoundingClientRect().width), (el.textContent || '').slice(0, 40));
            });
        }

        const newPages: PageContent[][] = [];
        let currentPageContent: PageContent[] = [];
        let usedHeight = 0;

        const flushPage = () => {
            if (currentPageContent.length > 0) {
                if ((globalThis as any).__PAGINATION_DEBUG__) {
                    console.log('[flush]', newPages.length, Math.round(usedHeight), 'limit', Math.round(fillLimit));
                }
                newPages.push(currentPageContent);
            }
            currentPageContent = [];
            usedHeight = 0;
        };

        let headerHeight = 0;
        const headerEl = renderedPaperPage.querySelector<HTMLElement>('.preview-header');
        const topInfoElements = renderedPaperPage.querySelectorAll('.flex.justify-between.text-sm, .text-center.text-sm.font-semibold');

        if (newPages.length === 0) { // Only calculate for the first page
            if (headerEl) {
                const st = window.getComputedStyle(headerEl);
                headerHeight += headerEl.offsetHeight + parseFloat(st.marginTop) + parseFloat(st.marginBottom);
            }
            topInfoElements.forEach(el => {
                const st = window.getComputedStyle(el as Element);
                headerHeight += (el as HTMLElement).offsetHeight + parseFloat(st.marginTop) + parseFloat(st.marginBottom);
            });
        }

        usedHeight = newPages.length === 0 ? headerHeight : 0;

        for (const questionEl of allQuestionElements) {
            if (cancelled) break;
            const qId = questionEl.getAttribute('data-question-id');
            const questionObj = paper.questions.find(q => q.id === qId);
            if (!questionObj) continue;

            const mainContentEl = questionEl.querySelector<HTMLElement>('.question-content');
            const subQuestionEls = Array.from(questionEl.querySelectorAll<HTMLElement>('.subquestion-item'));
            const tableEl = questionEl.querySelector<HTMLElement>('[data-table-element]');
            const tableRowEls = tableEl ? Array.from(tableEl.querySelectorAll<HTMLElement>('[data-table-row]')) : [];
            // Main-level option rows (options belonging to sub-questions live inside
            // .subquestion-item and are handled with that sub-question).
            const mainOptionRowEls = Array.from(questionEl.querySelectorAll<HTMLElement>('[data-option-row]'))
                .filter(el => !el.closest('.subquestion-item'));
            // The question wrapper carries mb-2; without counting it pages accumulate
            // enough extra height to overflow the configured page height.
            const wrapperMb = parseFloat(window.getComputedStyle(questionEl).marginBottom) || 0;
            let wrapperTracked = false;
            const trackWrapper = () => {
                if (!wrapperTracked && wrapperMb > 0) {
                    wrapperTracked = true;
                    usedHeight += wrapperMb;
                }
            };

            const outerHeight = (el: HTMLElement) => {
                const cs = window.getComputedStyle(el);
                // getBoundingClientRect().height is sub-pixel accurate; offsetHeight
                // rounds to integers and accumulates enough drift over a page of many
                // fragments that the real last line can poke past the bottom margin
                // and get clipped by the strict, non-growing page height.
                return el.getBoundingClientRect().height + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
            };

            const ensureItem = (showMainContent: boolean) => {
                let existing = currentPageContent.find(item => item.mainQuestion.id === qId);
                if (!existing) {
                    existing = { mainQuestion: questionObj, subParts: [], showMainContent, tableRows: null, optionRows: null, textBoxLines: null, formLines: null, stemLines: null, alternativeRange: null };
                    currentPageContent.push(existing);
                }
                return existing;
            };

            // Whether the stem is rendered on the page currently being filled. Used so
            // fragments that continue on the next page do not re-render the stem.
            let stemOnThisPage = false;

             // Start a new page when the next fragment would overflow a non-empty one.
            const flushIfOver = (height: number) => {
                if (usedHeight + height > fillLimit) {
                    if (currentPageContent.length > 0) {
                        flushPage();
                        stemOnThisPage = false;
                    }
                    usedHeight = newPages.length === 0 ? headerHeight : 0;
                    return true;
                }
                return false;
            };

            const mergeRange = (prev: readonly [number, number] | null, index: number): [number, number] =>
                prev && index === prev[1] + 1 ? [prev[0], index] : [index, index];

            // Case 1: Main content (stem). The stem is measured line by line so a
            // long question can start at the bottom of a page and continue on the
            // next one instead of jumping as a block.
            let stemItem: PageContent | null = null;
            const stemLineEls = Array.from(questionEl.querySelectorAll<HTMLElement>('[data-stem-line]'));
            const alternativeEls = Array.from(questionEl.querySelectorAll<HTMLElement>('[data-alternative-row]'));

            if (stemLineEls.length > 0) {
                stemLineEls.forEach((lineEl, lineIndex) => {
                    const lineHeight = outerHeight(lineEl);
                    trackWrapper();
                    flushIfOver(lineHeight);
                    const item = ensureItem(lineIndex === 0 ? true : stemOnThisPage);
                    item.stemLines = mergeRange(item.stemLines ?? null, lineIndex);
                    stemOnThisPage = true;
                    stemItem = item;
                    usedHeight += lineHeight;
                });
            } else if (mainContentEl) {
                const mainHeight = outerHeight(mainContentEl);
                trackWrapper();
                flushIfOver(mainHeight);
                const item = ensureItem(true);
                item.showMainContent = true;
                stemItem = item;
                stemOnThisPage = true;
                usedHeight += mainHeight;
            }

            // Case 1a: Alternatives ("অথবা" lines) are separate fragments.
            alternativeEls.forEach((alternativeEl, alternativeIndex) => {
                const alternativeHeight = outerHeight(alternativeEl);
                trackWrapper();
                flushIfOver(alternativeHeight);
                const item = ensureItem(stemOnThisPage);
                item.alternativeRange = mergeRange(item.alternativeRange ?? null, alternativeIndex);
                usedHeight += alternativeHeight;
            });

            // Case 5: A single text box. Every line is measured on its own so the
            // box can start where there is room and continue on the next page
            // instead of jumping as one block and leaving a gap behind.
            const textBoxEl = questionEl.querySelector<HTMLElement>('[data-text-box-element]');
            const formEl = questionEl.querySelector<HTMLElement>('[data-form-element]');
            const boxEl = textBoxEl ?? formEl;
            if (boxEl) {
                const boxLineEls = textBoxEl
                    ? Array.from(textBoxEl.querySelectorAll<HTMLElement>('[data-text-box-line]'))
                    : Array.from(formEl!.querySelectorAll<HTMLElement>('[data-form-line]'));
                if (boxLineEls.length > 0) {
                    const boxStyle = window.getComputedStyle(boxEl);
                    const chromeTop =
                        (parseFloat(boxStyle.marginTop) || 0) +
                        (parseFloat(boxStyle.borderTopWidth) || 0) +
                        (parseFloat(boxStyle.paddingTop) || 0);
                    const chromeBottom =
                        (parseFloat(boxStyle.borderBottomWidth) || 0) +
                        (parseFloat(boxStyle.paddingBottom) || 0);

                    boxLineEls.forEach((lineEl, lineIndex) => {
                        const lineHeight = outerHeight(lineEl);
                        const isLastLine = lineIndex === boxLineEls.length - 1;
                        const startsNewChunk =
                            usedHeight + lineHeight + chromeTop > fillLimit && currentPageContent.length > 0;
                        const chunkChrome = lineIndex === 0 || startsNewChunk ? chromeTop : 0;
                        const height = lineHeight + chunkChrome + (isLastLine ? chromeBottom : 0);

                        trackWrapper();
                        flushIfOver(height);
                        const item = ensureItem(stemOnThisPage);
                        if (textBoxEl) {
                            item.textBoxLines = mergeRange(item.textBoxLines ?? null, lineIndex);
                        } else {
                            item.formLines = mergeRange(item.formLines ?? null, lineIndex);
                        }
                        usedHeight += height;
                    });
                }
            }

            // Case 4: Built-in table rows (fill-in-the-blanks hints / substitution
            // table). Each row is paginated independently so the table can start at the
            // bottom of a page and continue on the next instead of jumping as a block.
            const tableMarginTop = tableEl ? (parseFloat(window.getComputedStyle(tableEl).marginTop) || 0) : 0;
            for (let ri = 0; ri < tableRowEls.length; ri++) {
                if (cancelled) break;
                const rowHeight = outerHeight(tableRowEls[ri]) + (ri === 0 ? tableMarginTop : 0);
                trackWrapper();
                flushIfOver(rowHeight);
                const item = ensureItem(stemOnThisPage);
                item.tableRows = mergeRange(item.tableRows, ri);
                usedHeight += rowHeight;
            }
            // If every row moved to a later page the stem's page must render no table
            // rows at all (an empty range) instead of silently repeating the full table.
            if (tableRowEls.length > 0 && stemItem && stemItem.tableRows === null) {
                stemItem.tableRows = [0, -1];
            }

            // Case 2: Sub-questions. The numbered line and every options row are
            // separate fragments, so a long MCQ fills the remaining space and spills.
            for (const subEl of subQuestionEls) {
                if (cancelled) break;
                const subId = subEl.getAttribute('data-subquestion-id');
                const subQuestionObj = questionObj.subQuestions?.find(sq => sq.id === subId);
                if (!subQuestionObj) continue;

                const contentEl = subEl.querySelector<HTMLElement>('.subquestion-content');
                let contentSubPart: SubPart | null = null;
                if (contentEl) {
                    // The sub-question wrapper carries its own top padding; it belongs
                    // to the first fragment of that sub-question.
                    const subPaddingTop = parseFloat(window.getComputedStyle(subEl).paddingTop) || 0;
                    const lineHeight = outerHeight(contentEl) + subPaddingTop;
                    trackWrapper();
                    flushIfOver(lineHeight);
                    const item = ensureItem(false);
                    const existing = item.subParts.find(p => p.sub.id === subQuestionObj.id);
                    if (existing) {
                        existing.content = true;
                        contentSubPart = existing;
                    } else {
                        contentSubPart = { sub: subQuestionObj, content: true, optionRows: null };
                        item.subParts.push(contentSubPart);
                    }
                    usedHeight += lineHeight;
                }

                const subOptionRowEls = Array.from(subEl.querySelectorAll<HTMLElement>('[data-option-row]'));
                for (let ri = 0; ri < subOptionRowEls.length; ri++) {
                    if (cancelled) break;
                    const rowHeight = outerHeight(subOptionRowEls[ri]);
                    trackWrapper();
                    flushIfOver(rowHeight);
                    const item = ensureItem(false);
                    const existing = item.subParts.find(p => p.sub.id === subQuestionObj.id);
                    if (existing) {
                        existing.optionRows = mergeRange(existing.optionRows, ri);
                    } else {
                        item.subParts.push({ sub: subQuestionObj, content: false, optionRows: [ri, ri] });
                    }
                    usedHeight += rowHeight;
                }
                // If all options moved to a later page, the sub-question's own page must
                // render no options rather than the full (now duplicated) grid.
                if (subOptionRowEls.length > 0 && contentSubPart && contentSubPart.optionRows === null) {
                    contentSubPart.optionRows = [0, -1];
                }
            }

            // Case 1b: Main options grid rows (rendered after the sub-questions).
            const gridBaseItem = currentPageContent.find(i => i.mainQuestion.id === qId);
            for (let ri = 0; ri < mainOptionRowEls.length; ri++) {
                if (cancelled) break;
                const rowHeight = outerHeight(mainOptionRowEls[ri]);
                trackWrapper();
                flushIfOver(rowHeight);
                const item = ensureItem(stemOnThisPage);
                item.optionRows = mergeRange(item.optionRows, ri);
                usedHeight += rowHeight;
            }
            if (mainOptionRowEls.length > 0 && gridBaseItem && gridBaseItem.optionRows === null) {
                gridBaseItem.optionRows = [0, -1];
            }

            // Case 3: No sub-questions, no main content, no table (e.g. section headers)
            if (subQuestionEls.length === 0 && !mainContentEl && !tableEl) {
                const elHeight = outerHeight(questionEl);
                flushIfOver(elHeight);
                currentPageContent.push({ mainQuestion: questionObj, subParts: [], showMainContent: true, tableRows: null, optionRows: null });
                usedHeight += elHeight;
            }
        }

        if (currentPageContent.length > 0) {
            newPages.push(currentPageContent);
        }

        if (!cancelled) {
            setPages(newPages);
        }

    } catch (err) {
        console.error('Error while calculating pages', err);
    } finally {
        try { root.unmount(); } catch (e) {}
        if (hiddenRenderRef.current?.contains(tempRenderContainer)) {
            hiddenRenderRef.current.removeChild(tempRenderContainer);
        }
    }
      };

      calculatePages();
    }, 500); // 500ms debounce

    return () => {
      clearTimeout(debounceTimer);
    };
  }, [paper, settings]);

  if (!paper) {
      return (
          <div className="flex h-screen items-center justify-center bg-background">
              <p>Loading paper...</p>
          </div>
      );
  }

  const headerInputStyle = "h-10 rounded-lg bg-slate-700/50 text-white placeholder:text-gray-500 border-slate-700 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:ring-2 focus-visible:bg-slate-800/60 transition-colors";

  const getHeaderCellValue = (kind: HeaderRow['cells'][number]['kind'], cellText?: string) => {
    switch (kind) {
      case 'school': return paper.schoolName;
      case 'examTitle': return paper.examTitle;
      case 'subject': return paper.subject;
      case 'grade': return paper.grade;
      case 'time': return paper.timeAllowed;
      case 'marks': return String(paper.totalMarks);
      case 'notes': return paper.notes ?? '';
      default: return cellText ?? '';
    }
  };

  const updateHeaderCellValue = (rowIndex: number, cellIndex: number, kind: HeaderRow['cells'][number]['kind'], value: string) => {
    if (kind === 'text') {
      setPaper(prev => produce(prev, draft => {
        const row = draft?.headerTemplate?.[rowIndex];
        if (row?.cells[cellIndex]) row.cells[cellIndex].text = value;
      }));
      return;
    }
    const fieldMap = {
      school: 'schoolName',
      examTitle: 'examTitle',
      subject: 'subject',
      grade: 'grade',
      time: 'timeAllowed',
      marks: 'totalMarks',
      notes: 'notes',
    } as const;
    const field = fieldMap[kind as keyof typeof fieldMap];
    if (field) handlePaperDetailChange(field, value);
  };


  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <EditorHeader
        paper={paper}
        settings={settings}
        setSettings={setSettings}
        setPaper={setPaper}
        pages={pages}
        handleSave={handleSave}
        handleExit={handleExit}
        isDownloading={isDownloading}
        setIsDownloading={setIsDownloading}
        bookletPages={bookletPages}
        setBookletPages={setBookletPages}
        isPreview={isPreview}
        setIsPreview={setIsPreview}
        isRightRailHidden={isRightRailHidden}
        setIsRightRailHidden={setIsRightRailHidden}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main className="min-h-0 flex-1 overflow-y-auto contain-layout app-scrollbar bg-slate-200 dark:bg-gray-800 p-4">
              {isPreview ? (
                <div
                  ref={boardViewportRef}
                  className={`app-scrollbar-light min-h-[calc(100vh-140px)] w-full overflow-auto rounded-lg bg-gray-100 p-3 shadow-lg ${isSpaceHeld ? 'cursor-grab' : ''}`}
                  onPointerDown={handleBoardPointerDown}
                  onPointerMove={handleBoardPointerMove}
                  onPointerUp={handleBoardPointerUp}
                  onPointerCancel={handleBoardPointerUp}
                >
                  <div
                    className="origin-top-left transition-transform duration-75"
                    style={{ transform: `scale(${boardZoom})` }}
                  >
                    <PaperPreview
                      paper={paper}
                      pages={pages}
                      settings={settings}
                      stacked
                      tableEditCallbacks={tableEditCallbacks}
                      imageEditCallbacks={imageEditCallbacks}
                    />
                  </div>
                </div>
              ) : (
              <div className="space-y-4">
                    <div className="bg-white dark:bg-slate-800/50 p-6 space-y-6 shadow-lg rounded-lg">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-700">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                          {isEditingHeaderLayout ? 'হেডার লেআউট সম্পাদনা' : 'প্রশ্নপত্রের তথ্য'}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditingHeaderLayout(value => !value)}
                        >
                          {isEditingHeaderLayout ? 'ফিরে যান' : 'হেডার লেআউট সম্পাদনা'}
                        </Button>
                      </div>
                      {isEditingHeaderLayout ? (
                        <HeaderBuilder value={paper.headerTemplate} onChange={onHeaderTemplateChange} />
                      ) : (
                      <>
                      <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                        <input
                          ref={logoFileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            void handleLogoFile(event.target.files?.[0]);
                            event.target.value = '';
                          }}
                        />
                        {paper.logoUrl ? (
                          <img
                            src={paper.logoUrl}
                            alt="স্কুল লোগো"
                            className="h-14 w-14 rounded bg-white object-contain"
                          />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded bg-slate-100 text-slate-400 dark:bg-slate-800">
                            <ImageIcon className="size-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            স্কুল লোগো (ঐচ্ছিক) — স্কুল ও পরীক্ষার নামের বাম পাশে বসবে
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => logoFileInputRef.current?.click()}
                            >
                              <ImageIcon className="mr-1.5 size-3.5" />
                              {paper.logoUrl ? 'লোগো পরিবর্তন' : 'লোগো আপলোড'}
                            </Button>
                            {paper.logoUrl && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={removeLogo}
                              >
                                <Trash2 className="mr-1.5 size-3.5" /> মুছুন
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        {(paper.headerTemplate && paper.headerTemplate.length > 0 ? paper.headerTemplate : defaultHeaderTemplate()).map((row, rowIndex) => (
                          <div key={row.id} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(row.cells.length, 1)}, minmax(0, 1fr))` }}>
                            {row.cells.map((cell, cellIndex) => (
                              <div key={cell.id} className="space-y-1">
                                <Label className="px-1 text-xs text-slate-500 dark:text-slate-400">{cell.kind === 'text' ? 'Text' : cell.kind}</Label>
                                <Input
                                  type="text"
                                  className={`${headerInputStyle} ${cell.align === 'center' ? 'text-center' : cell.align === 'right' ? 'text-right' : ''}`}
                                  value={getHeaderCellValue(cell.kind, cell.text)}
                                  onChange={event => updateHeaderCellValue(rowIndex, cellIndex, cell.kind, event.target.value)}
                                />
                              </div>
                            ))}
                          </div>
                        ))}
                        {paper.headerTemplate?.some(row => row.cells.some(cell => cell.kind === 'notes')) !== true && (
                          <Button variant="outline" onClick={addNote} className={`${headerInputStyle} w-full`}>
                            <Plus className="mr-2 size-4" />নোট যোগ করুন
                          </Button>
                        )}
                      </div>

                      </>
                      )}
                  </div>

                  {paper.questions.length === 0 ? (
                  <div className="flex flex-grow items-center justify-center text-center text-muted-foreground rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700">
                      <div>
                        <p className="font-semibold text-foreground">Your paper is empty</p>
                        <p className="text-sm">Add questions from the panel on the right.</p>
                      </div>
                  </div>
                  ) : (
                  <div className="space-y-4">
                      {paper.questions.map((q, index) => renderQuestion(q, index))}
                  </div>
                  )}
              </div>
              )}
        </main>

        {/* Right rail: layout-contained so its internal scroll never grows page scroll.
            The scroll container is a plain block wrapper: a flex scroll container
            ignores mouse-wheel scrolling in Chromium. */}
        {!isRightRailHidden && (
        <aside className="relative w-[400px] min-h-0 flex-shrink-0 flex flex-col contain-layout bg-slate-800">
         <div className="min-h-0 flex-1 overflow-y-auto app-scrollbar">
          <div className="space-y-6 p-4 pt-6">
            {/* Add Questions (collapsible so the math panel stays reachable) */}
            <Card className="bg-slate-900 border-slate-700 overflow-hidden">
              <button
                onClick={() => setShowAddQuestions((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/60 transition-colors"
              >
                <span className="text-white font-semibold">প্রশ্ন যোগ করুন</span>
                <span className="flex items-center gap-2">
                  {paper && paper.questions.length > 0 && (
                    <span className="rounded-full bg-slate-700/80 px-1.5 py-px text-[11px] text-slate-300">
                      {paper.questions.length}
                    </span>
                  )}
                  {showAddQuestions ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </span>
              </button>
              {showAddQuestions && (
              <CardContent className="flex flex-col gap-2 px-4 pb-4">
                <Button variant="outline" onClick={() => addQuestion('section-header')} className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 hover:text-white"><Minus className="mr-2 size-4" /> বিভাগ যোগ করুন</Button>
                <Button variant="outline" onClick={() => addQuestion('creative')} className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 hover:text-white"><BookMarked className="mr-2 size-4" /> সৃজনশীল প্রশ্ন</Button>
                <Button variant="outline" onClick={() => addQuestion('passage')} className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 hover:text-white"><Pilcrow className="mr-2 size-4" /> অনুচ্ছেদ</Button>
                <Button variant="outline" onClick={() => addQuestion('mcq')} className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 hover:text-white"><ListOrdered className="mr-2 size-4" /> MCQ</Button>
                <Button variant="outline" onClick={() => addQuestion('short')} className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 hover:text-white"><Type className="mr-2 size-4" /> সংক্ষিপ্ত প্রশ্ন</Button>
                <Button variant="outline" onClick={() => addQuestion('fill-in-the-blanks')} className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 hover:text-white"><Type className="mr-2 size-4" /> শূন্যস্থান পূরণ</Button>
                <Button variant="outline" onClick={() => addQuestion('essay')} className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 hover:text-white"><Pilcrow className="mr-2 size-4" /> রচনামূলক প্রশ্ন</Button>
                <Button variant="outline" onClick={() => addQuestion('table')} className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 hover:text-white"><TableIcon className="mr-2 size-4" /> সারণী</Button>
                <Button variant="outline" onClick={() => addQuestion('text-box')} className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 hover:text-white"><Square className="mr-2 size-4" /> একটি টেক্সট বক্স</Button>
                <Link href={`/editor/image?project=${projectId}`} passHref onClick={() => { if (paper) void persistPaper(paper); }}>
                    <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary/10"><ImageIcon className="mr-2 size-4" /> ছবি থেকে ইম্পোর্ট</Button>
                </Link>
                  <Link href={`/ai/suggest?project=${projectId}`} passHref onClick={() => { if (paper) void persistPaper(paper); }}>
                  <Button variant="outline" className="w-full border-purple-500 text-purple-500 hover:bg-purple-500/10">
                    <Sparkles className="mr-2 size-4" />
                    AI দিয়ে তৈরি করুন
                  </Button>
                </Link>
              </CardContent>
              )}
            </Card>

            {/* Add images into the question paper */}
            <Card className="bg-slate-900 border-slate-700 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-white font-semibold">ছবি যোগ করুন</span>
                <ImageIcon className="h-4 w-4 text-slate-400" />
              </div>
              <CardContent className="px-4 pb-4">
                <input
                  ref={imageFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void handleImageFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <Button
                  variant="outline"
                  className="w-full bg-slate-800 border-slate-600 text-white hover:bg-slate-700 hover:text-white"
                  onClick={() => pickImage(null)}
                >
                  <ImageIcon className="mr-2 size-4" /> ছবি আপলোড করুন
                </Button>
                <p className="mt-2 text-xs text-slate-400">
                  PNG/JPG ছবি নিচের তালিকায় যুক্ত হবে। এরপর উপ/নিচ করে ছবিকে প্রশ্নের মাঝে সাজাতে পারবেন এবং মেইন এডিটরে প্রস্থ ও অবস্থান ঠিক করতে পারবেন।
                </p>
              </CardContent>
            </Card>

            <TallyMarks onInsert={handleInsertExpression} targetLabel={getFocusedFieldLabel()} />

            <MathExpressions onInsert={handleInsertExpression} targetLabel={getFocusedFieldLabel()} />
          </div>
         </div>
        </aside>
        )}

        {/* Hidden div for calculations */}
        <div className="absolute top-0 left-[-9999px] opacity-0 pointer-events-none" style={{ width: `${settings.width}px` }}>
            <div ref={hiddenRenderRef}></div>
        </div>
      </div>
    </div>
  );
}

export default function EditorPageWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EditorPage />
    </Suspense>
  );
}

    