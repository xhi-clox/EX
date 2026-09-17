'use client';
import { Suspense } from 'react';
import { useState, useEffect, useRef, useLayoutEffect } from 'react';
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
import { Plus, Type, Pilcrow, Image as ImageIcon, Trash2, ArrowUp, ArrowDown, ListOrdered, TableIcon, PlusCircle, MinusCircle, BookMarked, Minus, Sparkles, LogOut, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { EditorHeader } from './EditorHeader';
import MathExpressions from './MathExpressions';
import { produce } from 'immer';
import { createRoot } from 'react-dom/client';
import { useToast } from '@/hooks/use-toast';
import { PaperPage } from './PaperPreview';
import PaperPreview from './PaperPreview';
import { MIN_BOTTOM_PADDING_MM } from './paper-render';
import { imageFilterCss, imageGroupStyle, imageItemStyle, getQuestionImages, type QuestionImage } from './image-style';
import { defaultHeaderTemplate, type HeaderRow } from './header-template';
import HeaderBuilder from './HeaderBuilder';
import 'katex/dist/katex.min.css';
import LatexRenderer from './LatexRenderer';
import { useProjects } from '@/hooks/use-projects';


const generateId = (prefix: string) => {
    return `${prefix}${Date.now()}${Math.random().toString(36).substring(2, 9)}`;
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


        if (isNew) {
            node.id = newId;
        }
        seenIds.add(newId);

        const newParentIdPrefix = newId;

        if (node.subQuestions) {
          node.subQuestions.forEach((sub: any, i: number) => {
            let subIdSuffix = String.fromCharCode(97 + i); // e.g., a, b
            let subId = `${newParentIdPrefix}${subIdSuffix}`;

            if(isNew || !sub.id || seenIds.has(sub.id) || !sub.id.startsWith(newParentIdPrefix)) {
              sub.id = subId;
            }
            processNode(sub, newParentIdPrefix);
          });
        }
        
        if (node.options) {
            node.options.forEach((option: any, i: number) => {
                let optId = option.id;
                if (!optId || seenIds.has(optId) || isNew || !optId.startsWith(newParentIdPrefix)) {
                    optId = `${newParentIdPrefix}_opt${i + 1}`;
                }
                while (seenIds.has(optId)) {
                    optId = `${newParentIdPrefix}_opt${i + 1}_${Math.random().toString(36).substring(2, 5)}`;
                }
                option.id = optId;
                seenIds.add(optId);
            });
        }
    };

    const draft = produce(questions, draft => {
        draft.forEach(q => processNode(q));
    });

    return draft;
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



export type NumberingFormat = 'english-numeric' | 'bangla-alpha' | 'bangla-numeric' | 'roman';

export type MainNumberingFormat = 'english-numeric' | 'bangla-numeric' | 'roman';

export type MarksFormat = 'bangla-numeric' | 'english-numeric';

export interface Question {
  id: string;
  type: 'passage' | 'fill-in-the-blanks' | 'short' | 'mcq' | 'essay' | 'table' | 'creative' | 'section-header' | 'image';
  content: string;
  marks?: number;
  options?: { id: string; text: string }[];
  subQuestions?: Question[];
  numberingFormat?: NumberingFormat;
  tableData?: string[][];
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
  totalMarks: number;
  questions: Question[];
  notes?: string;
  mainNumberingFormat?: MainNumberingFormat;
  marksFormat?: MarksFormat;
  headerTemplate?: HeaderRow[];
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
};


function EditorPage() {
  const [paper, setPaper] = useState<Paper | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project');
  const { getProject, updateProject, isLoaded } = useProjects();
  
  // This effect runs once on mount to initialize the paper state from project data.
  useEffect(() => {
    if (!isLoaded) return; // Wait for projects to be loaded from localStorage

    if (!projectId) {
        toast({ title: "Error", description: "No project specified.", variant: "destructive" });
        router.push('/');
        return;
    }

    const project = getProject(projectId);
    if (!project) {
        toast({ title: "Error", description: "Project not found.", variant: "destructive" });
        router.push('/');
        return;
    }

    const storageKey = `paper_${projectId}`;
    const savedPaper = localStorage.getItem(storageKey);
    let initialData: Paper;

    if (savedPaper) {
        try {
            initialData = JSON.parse(savedPaper);
        } catch (e) {
            console.error("Failed to parse saved paper from localStorage", e);
            initialData = {
                ...initialPaperData,
                id: projectId,
                examTitle: project.name,
                subject: project.subject,
                grade: project.class,
                questions: [], // Start with empty questions on parse error
            };
        }
    } else {
        initialData = {
            ...initialPaperData,
            id: projectId,
            examTitle: project.name,
            subject: project.subject,
            grade: project.class,
        };
    }
    
    const questionsWithUniqueIds = ensureUniqueIds(initialData.questions || []);
    setPaper({ ...initialData, questions: questionsWithUniqueIds });

  }, [projectId, getProject, router, toast, isLoaded]);

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

  const [focusedInput, setFocusedInput] = useState<{ element: HTMLTextAreaElement | HTMLInputElement; id: string } | null>(null);
  
  const [pages, setPages] = useState<PageContent[][]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showAddQuestions, setShowAddQuestions] = useState(true);
  const [isPreview, setIsPreview] = useState(false);
  const [bookletPages, setBookletPages] = useState<BookletSpread[]>([]);
  const hiddenRenderRef = useRef<HTMLDivElement>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  type ImageTarget = { kind: 'append'; questionId: string } | { kind: 'replace'; questionId: string; imageId: string };
  const [imageTarget, setImageTarget] = useState<ImageTarget | null>(null);
  const [settings, setSettings] = useState<PaperSettings>({ 
    margins: { top: 10, bottom: 10, left: 10, right: 10 },
    width: 560, 
    height: 794,
    fontSize: 12,
    lineHeight: 1.4,
  });

  const handleSave = () => {
    if (paper && projectId) {
      try {
        const storageKey = `paper_${projectId}`;
        const serialized = JSON.stringify(paper);
        
        // Check localStorage size before saving (5MB limit for most browsers)
        const sizeInMB = new Blob([serialized]).size / (1024 * 1024);
        if (sizeInMB > 4) {
          toast({
            variant: "destructive",
            title: "Paper Too Large",
            description: `Your paper is ${sizeInMB.toFixed(1)}MB. Please remove images or split into smaller papers.`,
          });
          return;
        }
        
        localStorage.setItem(storageKey, serialized);
        updateProject(projectId, { name: paper.examTitle, subject: paper.subject, class: paper.grade });

        toast({
          title: "Progress Saved",
          description: `Your question paper has been saved (${sizeInMB.toFixed(1)}MB).`,
        });
      } catch (e) {
        console.error("Failed to save paper to localStorage", e);
        const errorMsg = e instanceof DOMException && e.code === 22 
          ? "Paper is too large. Try removing images or creating a new paper." 
          : "Could not save your paper. Please try again.";
        toast({
          variant: "destructive",
          title: "Save Failed",
          description: errorMsg,
        });
      }
    }
  };

  const handleExit = () => {
    router.push('/');
  };

  const mergeImportedQuestions = (existingPaper: Paper, importedData: any): Paper => {
    const newQuestions = importedData.questions || [];
    
    const combinedPaper: Paper = produce(existingPaper, draft => {
        if (importedData.title) draft.examTitle = importedData.title;
        if (importedData.subject) draft.subject = importedData.subject;
        if (importedData.grade) draft.grade = importedData.grade;
        
        draft.questions.push(...newQuestions);
      });
    
    const questionsWithUniqueIds = ensureUniqueIds(combinedPaper.questions);
    return { ...combinedPaper, questions: questionsWithUniqueIds };
  };


  // Import effect - Updated version
  useEffect(() => {
    const from = searchParams.get('from');
    if ((from === 'image' || from === 'suggest') && paper) {
      const dataToImportRaw = localStorage.getItem('newImageData');
      if (dataToImportRaw) {
        try {
          const dataToImport = JSON.parse(dataToImportRaw);
          
          setPaper(currentPaper => {
            if (!currentPaper) return null;
            return mergeImportedQuestions(currentPaper, dataToImport);
          });
          
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
  }, [searchParams, router, paper, toast]);

  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>, id: string) => {
    setFocusedInput({ element: e.currentTarget, id });
  };

  const handleInsertExpression = (expression: string) => {
    if (!focusedInput) return;
  
    const { element } = focusedInput;
    const { selectionStart, selectionEnd } = element;
    const currentValue = element.value;
  
    if (selectionStart === null || selectionEnd === null) {
      const newValue = currentValue + expression;
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      nativeInputValueSetter?.call(element, newValue);
      const event = new Event("input", { bubbles: true });
      element.dispatchEvent(event);
      return;
    }
  
    const newValue =
      currentValue.substring(0, selectionStart) +
      expression +
      currentValue.substring(selectionEnd);
  
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set;
    nativeInputValueSetter?.call(element, newValue);
  
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
    const qNum = (idx: number) => paper.questions.slice(0, idx + 1).filter(q => q.type !== 'section-header').length;
    if ((kind === 'content' || kind === 'marks') && parts.length === 2) {
      for (let qi = 0; qi < paper.questions.length; qi++) {
        const q = paper.questions[qi];
        if (q.type === 'section-header' && q.id === parts[1]) return 'section title';
        if (q.id === parts[1]) return `Q${qNum(qi)}${kind === 'marks' ? ' marks' : ''}`;
        const si = q.subQuestions?.findIndex(sq => sq.id === parts[1]) ?? -1;
        if (si !== -1) return `Q${qNum(qi)} → ${getNumbering(q.numberingFormat, si)}`;
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

    const onTableCellChange = (id: string, row: number, col: number, value: string) => {
        updateTableQuestion(id, (q) => {
            if (!q.tableData) return;
            if (row < q.tableData.length && q.tableData[row]) q.tableData[row][col] = value;
        });
    };

    const onTableAddRow = (id: string) => {
        updateTableQuestion(id, (q) => {
            if (!q.tableData) return;
            const colCount = Math.max(1, q.tableData[0]?.length ?? 1);
            q.tableData.push(Array(colCount).fill(''));
        });
    };

    const onTableRemoveRow = (id: string, row: number) => {
        updateTableQuestion(id, (q) => {
            if (q.tableData) q.tableData.splice(row, 1);
            if (q.tableRowHeights) q.tableRowHeights.splice(row, 1);
        });
    };

    const onTableAddCol = (id: string) => {
        updateTableQuestion(id, (q) => {
            if (!q.tableData || q.tableData.length === 0) return;
            q.tableData.forEach((r) => r.push(''));
            if (q.tableColWidths) q.tableColWidths.push(0);
        });
    };

    const onTableRemoveCol = (id: string, col: number) => {
        updateTableQuestion(id, (q) => {
            if (q.tableData) q.tableData.forEach((r) => r.splice(col, 1));
            if (q.tableColWidths) q.tableColWidths.splice(col, 1);
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

    const tableEditCallbacks = {
        onCellChange: onTableCellChange,
        onAddRow: onTableAddRow,
        onRemoveRow: onTableRemoveRow,
        onAddCol: onTableAddCol,
        onRemoveCol: onTableRemoveCol,
        onResizeRow: onTableResizeRow,
        onColWidths: onTableColWidths,
        onMarginLeftChange: onTableMarginLeftChange,
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

  const handleTableCellChange = (questionId: string, rowIndex: number, colIndex: number, value: string) => {
    setPaper(prev => produce(prev, draft => {
        if (!draft) return;
        const q = draft.questions.find(q => q.id === questionId);
        if (q && q.tableData) {
            q.tableData[rowIndex][colIndex] = value;
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
  
  const addRow = (questionId: string) => {
    setPaper(prev => produce(prev, draft => {
        if (!draft) return;
        const q = draft.questions.find(q => q.id === questionId);
        if (q) {
            const newRow = Array(q.cols || 1).fill('');
            if (!q.tableData) q.tableData = [];
            q.tableData.push(newRow);
            q.rows = (q.rows || 0) + 1;
        }
    }));
  };
  
  const removeRow = (questionId: string) => {
    setPaper(prev => produce(prev, draft => {
        if (!draft) return;
        const q = draft.questions.find(q => q.id === questionId);
        if (q && q.tableData && q.rows && q.rows > 1) {
            q.tableData.pop();
            q.rows -= 1;
        }
    }));
  };
  
  const addCol = (questionId: string) => {
    setPaper(prev => produce(prev, draft => {
        if (!draft) return;
        const q = draft.questions.find(q => q.id === questionId);
        if (q) {
            if (!q.tableData) q.tableData = [[]];
            q.tableData.forEach(row => row.push(''));
            q.cols = (q.cols || 0) + 1;
        }
    }));
  };
  
  const removeCol = (questionId: string) => {
    setPaper(prev => produce(prev, draft => {
        if (!draft) return;
        const q = draft.questions.find(q => q.id === questionId);
        if (q && q.tableData && q.cols && q.cols > 1) {
            q.tableData.forEach(row => row.pop());
            q.cols -= 1;
        }
    }));
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
                { id: generateId('hr'), cells: [{ id: generateId('hc'), kind: 'notes', align: 'center', bold: true, size: 12 }] },
            ];
        }
    }));
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
    
    const questionNumber = paper.questions.slice(0, index + 1).filter(q => q.type !== 'section-header' && q.type !== 'image').length;

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
            <Label className="font-bold pt-1.5">{`${getNumbering(paper.mainNumberingFormat ?? 'bangla-numeric', questionNumber - 1)}.`}</Label>
            <div className="flex-1 ml-2">
                 <Textarea 
                    value={question.content}
                    onFocus={(e) => handleFocus(e, `content-${question.id}`)}
                    onChange={(e) => handleQuestionChange(question.id, 'content', e.target.value)}
                    className="bg-white dark:bg-slate-800 font-semibold"
                    rows={2}
                 />
                 {containsMath(question.content) && (
                    <div className="p-2 border rounded-md mt-1 bg-white dark:bg-slate-800/50 min-h-[3rem] prose prose-sm max-w-none">
                        <LatexRenderer content={question.content} />
                    </div>
                 )}
            </div>
          </div>
            <div className="flex items-center gap-4 pl-8">
              { question.type !== 'creative' && (
                <div className="flex items-center gap-2">
                    <Label htmlFor={`marks-${question.id}`} className="text-sm">Marks:</Label>
                    <Input 
                      id={`marks-${question.id}`}
                      type="number" 
                      value={question.marks || ''} 
                      onFocus={(e) => handleFocus(e, `marks-${question.id}`)}
                      onChange={(e) => handleQuestionChange(question.id, 'marks', Number(e.target.value))}
                      className="w-20 h-8"
                      placeholder="Marks"
                    />
                </div>
              )}
              { isContainer && (
              <div className="flex items-center gap-2">
                  <Label htmlFor={`numbering-${question.id}`} className="text-sm">নাম্বারিং:</Label>
                  <Select 
                    value={question.numberingFormat} 
                    onValueChange={(value: NumberingFormat) => handleQuestionChange(question.id, 'numberingFormat', value)}
                  >
                    <SelectTrigger id={`numbering-${question.id}`} className="w-32 h-8 text-xs">
                      <SelectValue placeholder="Format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="english-numeric">1, 2, 3</SelectItem>
                      <SelectItem value="bangla-alpha">ক, খ, গ</SelectItem>
                      <SelectItem value="bangla-numeric">১, ২, ৩</SelectItem>
                      <SelectItem value="roman">i, ii, iii</SelectItem>
                    </SelectContent>
                  </Select>
              </div>
              )}
            </div>
          {children}
        </Card>
      );

      const subQuestionRenderer = (qType: Question['type']) => (
        <>
            <div className="pl-6 space-y-2">
            {question.subQuestions?.map((sq, sqIndex) => (
                <div key={sq.id} className="flex items-start gap-2 pt-2">
                <span className="font-semibold pt-2">{getNumbering(question.numberingFormat, sqIndex)})</span>
                <div className="flex-grow space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Textarea 
                          value={sq.content}
                          onFocus={(e) => handleFocus(e, `content-${sq.id}`)}
                          onChange={(e) => handleSubQuestionChange(question.id, sq.id, 'content', e.target.value)}
                          className="bg-white dark:bg-slate-800"
                          rows={1}
                      />
                      {containsMath(sq.content) && (
                        <div className="p-2 border rounded-md mt-1 bg-white dark:bg-slate-800/50 min-h-[1.5rem] prose prose-sm max-w-none">
                            <LatexRenderer content={sq.content} />
                        </div>
                      )}
                    </div>
                    { question.type === 'creative' && sq.marks !== undefined && (
                       <div className="flex items-center gap-2 shrink-0">
                         <Label htmlFor={`marks-${sq.id}`} className="text-sm">Marks:</Label>
                         <Input 
                           id={`marks-${sq.id}`}
                           type="number" 
                           value={sq.marks || ''} 
                           onFocus={(e) => handleFocus(e, `marks-${sq.id}`)}
                           onChange={(e) => handleSubQuestionChange(question.id, sq.id, 'marks', Number(e.target.value))}
                           className="w-20 h-8"
                           placeholder="Marks"
                         />
                      </div>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeSubQuestion(question.id, sq.id)}>
                        <Trash2 className="size-4" />
                    </Button>
                  </div>
                  {sq.type === 'mcq' && (
                    <div className="pl-8 space-y-2 group/sub">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {sq.options?.map((opt, optIndex) => (
                                <div key={opt.id} className="flex items-center gap-2">
                                <span className="font-semibold">{getNumbering('bangla-alpha', optIndex)})</span>
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
        <>
          <div className="flex gap-2 mb-2">
             <Button size="sm" variant="outline" onClick={() => addRow(question.id)}><PlusCircle className="mr-2 size-4" /> Add Row</Button>
             <Button size="sm" variant="outline" onClick={() => removeRow(question.id)}><MinusCircle className="mr-2 size-4" /> Remove Row</Button>
             <Button size="sm" variant="outline" onClick={() => addCol(question.id)}><PlusCircle className="mr-2 size-4" /> Add Column</Button>
             <Button size="sm" variant="outline" onClick={() => removeCol(question.id)}><MinusCircle className="mr-2 size-4" /> Remove Column</Button>
          </div>
          <div className="overflow-x-auto app-scrollbar">
            <table className="w-full border-collapse border border-slate-400">
              <tbody>
                {question.tableData?.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, colIndex) => (
                      <td key={colIndex} className="border border-slate-300 p-0">
                        <Textarea
                          value={cell}
                          onFocus={(e) => handleFocus(e, `table-${question.id}-${rowIndex}-${colIndex}`)}
                          onChange={(e) => handleTableCellChange(question.id, rowIndex, colIndex, e.target.value)}
                          className="w-full h-full border-0 rounded-none focus-visible:ring-1 ring-inset focus-visible:ring-blue-400 bg-white dark:bg-slate-800"
                          rows={2}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
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
          try { await (document as any).fonts.ready; } catch (e) { /* ignore */ }
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
        // Reserve this many pixels below the last content line before the bottom margin.
        // Increased to 60px (instead of 40px) to ensure all continuation pages (2+) don't
        // appear fuller than page 1. This creates visual consistency across all pages.
        const PAGE_BOTTOM_SAFETY_PX = 60;
        const pageInnerHeight =
          settings.height -
          mmToPx(settings.margins.top) -
          mmToPx(Math.max(settings.margins.bottom, MIN_BOTTOM_PADDING_MM));
        // Keep a conservative reserve above the bottom margin line so content never
        // crosses into the margin area and gets cut off. Every page maintains a 
        // consistent, visible bottom margin. Page 1 has header space; pages 2+ are level.
        const fillLimit = pageInnerHeight - PAGE_BOTTOM_SAFETY_PX;
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
  
        const newPages: PageContent[][] = [];
        let currentPageContent: PageContent[] = [];
        let usedHeight = 0;
  
        const flushPage = () => {
          if (currentPageContent.length > 0) {
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
                    existing = { mainQuestion: questionObj, subParts: [], showMainContent, tableRows: null, optionRows: null };
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

            // Case 1: Main content (stem)
            let stemItem: PageContent | null = null;
            if (mainContentEl) {
                const mainHeight = outerHeight(mainContentEl);
                trackWrapper();
                flushIfOver(mainHeight);
                const item = ensureItem(true);
                item.showMainContent = true;
                stemItem = item;
                stemOnThisPage = true;
                usedHeight += mainHeight;
            }

            // Case 4: Built-in table rows (fill-in-the-blanks hints / substitution
            // table). Each row is paginated independently so the table can start at the
            // bottom of a page and continue on the next instead of jumping as a block.
            for (let ri = 0; ri < tableRowEls.length; ri++) {
                if (cancelled) break;
                const rowHeight = outerHeight(tableRowEls[ri]);
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
                    const lineHeight = outerHeight(contentEl);
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
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main className="min-h-0 flex-1 overflow-y-auto contain-layout app-scrollbar bg-slate-200 dark:bg-gray-800 p-4">
              {isPreview ? (
                <div className="w-full max-w-full">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Preview</h2>
                    <Button variant="outline" size="sm" onClick={() => setIsPreview(false)} className="bg-white dark:bg-slate-800">
                      Back to Editor
                    </Button>
                  </div>
                  <div className="bg-gray-100 p-3 rounded-lg shadow-lg w-full overflow-hidden">
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
                      <div className="space-y-4">
                          <div className="space-y-1">
                              <Label htmlFor="schoolName" className="text-xs text-slate-500 dark:text-slate-400 px-1">School Name</Label>
                              <Input id="schoolName" className={`${headerInputStyle} text-lg text-center font-semibold`} value={paper.schoolName} onChange={e => handlePaperDetailChange('schoolName', e.target.value)} placeholder="School Name" />
                          </div>
                          <div className="space-y-1">
                              <Label htmlFor="examTitle" className="text-xs text-slate-500 dark:text-slate-400 px-1">Exam Title</Label>
                              <Input id="examTitle" className={`${headerInputStyle} text-center`} value={paper.examTitle} onChange={e => handlePaperDetailChange('examTitle', e.target.value)} placeholder="Exam Title" />
                          </div>
                      </div>

                      <div className="max-h-60 overflow-y-auto p-1">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 text-sm">
                            <div className="space-y-1">
                                <Label htmlFor="subject" className="text-xs text-slate-500 dark:text-slate-400 px-1">Subject</Label>
                                <Input id="subject" className={headerInputStyle} value={paper.subject} onChange={e => handlePaperDetailChange('subject', e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="grade" className="text-xs text-slate-500 dark:text-slate-400 px-1">Class</Label>
                                <Input id="grade" className={headerInputStyle} value={paper.grade} onChange={e => handlePaperDetailChange('grade', e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="totalMarks" className="text-xs text-slate-500 dark:text-slate-400 px-1">Marks</Label>
                                <Input id="totalMarks" type="number" className={headerInputStyle} value={paper.totalMarks} onChange={e => handlePaperDetailChange('totalMarks', parseInt(e.target.value))}/>
                            </div>
                            <div className="space-y-1">
                                  <Label htmlFor="timeAllowed" className="text-xs text-slate-500 dark:text-slate-400 px-1">Time</Label>
                                  <Input id="timeAllowed" className={headerInputStyle} value={paper.timeAllowed} onChange={e => handlePaperDetailChange('timeAllowed', e.target.value)}/>
                            </div>
                        </div>
                        
                        <div className="pt-4 text-center">
                        {paper.notes === undefined ? (
                            <div className="text-center">
                                <Button 
                                    variant="outline" 
                                    onClick={addNote}
                                    className={`${headerInputStyle} w-full`}
                                >
                                    <Plus className="mr-2 size-4" />নোট যোগ করুন
                                </Button>
                            </div>
                        ) : (
                            <Textarea 
                                value={paper.notes}
                                onChange={e => handlePaperDetailChange('notes', e.target.value)}
                                placeholder="নোট লিখুন..."
                                className={`${headerInputStyle} text-sm text-center py-2.5 min-h-[40px] h-auto dark:text-white`}
                                rows={1}
                            />
                        )}
                        </div>
                      </div>

                      <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                        <HeaderBuilder value={paper.headerTemplate} onChange={onHeaderTemplateChange} />
                      </div>
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
        <aside className="w-[400px] min-h-0 flex-shrink-0 flex flex-col contain-layout bg-slate-800">
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
                <Link href={`/editor/image?project=${projectId}`} passHref>
                    <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary/10"><ImageIcon className="mr-2 size-4" /> ছবি থেকে ইম্পোর্ট</Button>
                </Link>
                  <Link href={`/ai/suggest?project=${projectId}`} passHref>
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

            <MathExpressions onInsert={handleInsertExpression} targetLabel={getFocusedFieldLabel()} />
          </div>
         </div>
        </aside>

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

    