
'use client';
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
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Plus, Type, Pilcrow, Image as ImageIcon, Trash2, ArrowUp, ArrowDown, ListOrdered, TableIcon, PlusCircle, MinusCircle, BookMarked, Minus, Sparkles, LogOut, Save } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { EditorHeader } from './EditorHeader';
import MathExpressions from './MathExpressions';
import { produce } from 'immer';
import { createRoot } from 'react-dom/client';
import { useToast } from '@/hooks/use-toast';
import { PaperPage } from './PaperPreview';
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



export type NumberingFormat = 'bangla-alpha' | 'bangla-numeric' | 'roman';

export interface Question {
  id: string;
  type: 'passage' | 'fill-in-the-blanks' | 'short' | 'mcq' | 'essay' | 'table' | 'creative' | 'section-header';
  content: string;
  marks?: number;
  options?: { id: string; text: string }[];
  subQuestions?: Question[];
  numberingFormat?: NumberingFormat;
  tableData?: string[][];
  rows?: number;
  cols?: number;
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
}

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

const initialPaperData: Omit<Paper, 'id'> = {
  schoolName: 'ABC GOVT. School and College',
  examTitle: 'Annual Examination-2025',
  subject: 'Bangla',
  grade: '9',
  timeAllowed: '3 Hours',
  totalMarks: 100,
  questions: [],
};


export default function EditorPage() {
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

  const [focusedInput, setFocusedInput] = useState<{ element: HTMLTextAreaElement | HTMLInputElement; id: string } | null>(null);
  
  const [pages, setPages] = useState<PageContent[][]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [bookletPages, setBookletPages] = useState<{left: string|null; right: string|null}[]>([]);
  const hiddenRenderRef = useRef<HTMLDivElement>(null);
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
        localStorage.setItem(storageKey, JSON.stringify(paper));
        updateProject(projectId, { name: paper.examTitle, subject: paper.subject, class: paper.grade });

        toast({
          title: "Progress Saved",
          description: "Your question paper has been saved.",
        });
      } catch (e) {
        console.error("Failed to save paper to localStorage", e);
        toast({
          variant: "destructive",
          title: "Save Failed",
          description: "Could not save your paper. Please try again.",
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
  
  const handlePaperDetailChange = (field: keyof Paper, value: string | number) => {
    setPaper(prev => produce(prev, draft => {
        if(draft) (draft as any)[field] = value
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
          newQuestion.content = 'খালি জায়গা পূরণ কর:';
          newQuestion.marks = 5;
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
        if(draft) draft.notes = '(ক ও খ বিভাগ থেকে দুটি এবং গ ও ঘ বিভাগ থেকে ১টি সহ মোট ৭ টি প্রশ্নের উত্তর দাও)';
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
    
    const questionNumber = paper.questions.slice(0, index + 1).filter(q => q.type !== 'section-header').length;

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
            <Label className="font-bold pt-1.5">{`${questionNumber}.`}</Label>
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

    switch (question.type) {
        case 'passage':
            return questionCard(subQuestionRenderer('short'));
        case 'creative':
            return questionCard(subQuestionRenderer('short'));
        case 'fill-in-the-blanks':
             return questionCard(subQuestionRenderer('fill-in-the-blanks'));
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
            return questionCard((
                <>
                  <Textarea 
                    value={question.content}
                    onFocus={(e) => handleFocus(e, `content-${question.id}`)}
                    onChange={(e) => handleQuestionChange(question.id, 'content', e.target.value)}
                    className="bg-white dark:bg-slate-800"
                    rows={2}
                  />
                  <div className="flex gap-2 mb-2">
                     <Button size="sm" variant="outline" onClick={() => addRow(question.id)}><PlusCircle className="mr-2 size-4" /> Add Row</Button>
                     <Button size="sm" variant="outline" onClick={() => removeRow(question.id)}><MinusCircle className="mr-2 size-4" /> Remove Row</Button>
                     <Button size="sm" variant="outline" onClick={() => addCol(question.id)}><PlusCircle className="mr-2 size-4" /> Add Column</Button>
                     <Button size="sm" variant="outline" onClick={() => removeCol(question.id)}><MinusCircle className="mr-2 size-4" /> Remove Column</Button>
                  </div>
                  <div className="overflow-x-auto">
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
              ));
        default:
            return null;
    }
  }

  useLayoutEffect(() => {
    if (!paper) return;
  
    // mm -> px (96dpi)
    const mmToPx = (mm: number) => mm * 3.7795275591;
  
    // choose the selector that identifies each question block in the rendered PaperPage
    const QUESTION_SELECTOR = '[data-question-id]';
  
    let cancelled = false;
  
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
          pageContent={paper.questions.map(q => ({ mainQuestion: q, subQuestions: q.subQuestions || [], showMainContent: true }))}
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
  
        // PAGE geometry (px). Convert margins from mm to px and subtract from height:
        const pageInnerHeight = settings.height - (mmToPx(settings.margins.top) + mmToPx(settings.margins.bottom)) + 10; // Add 10px buffer
        
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
        const headerEl = renderedPaperPage.querySelector('.preview-header');
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
            
            // Case 1: Main content (stem)
            if (mainContentEl) {
                const cs = window.getComputedStyle(mainContentEl);
                const mainHeight = mainContentEl.offsetHeight + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);

                if (usedHeight + mainHeight > pageInnerHeight && currentPageContent.length > 0) {
                    flushPage();
                    usedHeight = newPages.length === 0 ? headerHeight : 0;
                }
                
                let existingItem = currentPageContent.find(item => item.mainQuestion.id === qId);
                if (!existingItem) {
                    existingItem = { mainQuestion: questionObj, subQuestions: [], showMainContent: true };
                    currentPageContent.push(existingItem);
                } else {
                    existingItem.showMainContent = true;
                }
                usedHeight += mainHeight;
            }

            // Case 2: Sub-questions
            for (const subEl of subQuestionEls) {
                if(cancelled) break;
                const subId = subEl.getAttribute('data-subquestion-id');
                const subQuestionObj = questionObj.subQuestions?.find(sq => sq.id === subId);
                if (!subQuestionObj) continue;

                const cs = window.getComputedStyle(subEl);
                const subHeight = subEl.offsetHeight + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);

                if (usedHeight + subHeight > pageInnerHeight && currentPageContent.length > 0) {
                    flushPage();
                    usedHeight = newPages.length === 0 ? headerHeight : 0; 
                }

                let existingItem = currentPageContent.find(item => item.mainQuestion.id === qId);
                if (!existingItem) {
                    existingItem = { mainQuestion: questionObj, subQuestions: [], showMainContent: false };
                    currentPageContent.push(existingItem);
                }
                if (!existingItem.subQuestions.some(sq => sq.id === subQuestionObj.id)) {
                    existingItem.subQuestions.push(subQuestionObj);
                }
                usedHeight += subHeight;
            }

             // Case 3: No sub-questions (e.g. section headers)
            if (subQuestionEls.length === 0 && !mainContentEl) {
                 const cs = window.getComputedStyle(questionEl);
                 const elHeight = questionEl.offsetHeight + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
                 if (usedHeight + elHeight > pageInnerHeight && currentPageContent.length > 0) {
                    flushPage();
                    usedHeight = newPages.length === 0 ? headerHeight : 0;
                 }
                 currentPageContent.push({ mainQuestion: questionObj, subQuestions: [], showMainContent: true });
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

    return () => {
        cancelled = true;
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
    <>
      <EditorHeader 
        paper={paper}
        settings={settings}
        setSettings={setSettings}
        pages={pages}
        handleSave={handleSave}
        handleExit={handleExit}
        isDownloading={isDownloading}
        setIsDownloading={setIsDownloading}
        bookletPages={bookletPages}
        setBookletPages={setBookletPages}
      />
      <div className="flex h-[calc(100vh-3.5rem)]">
        <main className="flex-1 overflow-y-auto bg-slate-200 dark:bg-gray-800 p-4">
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
        </main>

        <aside className="w-[400px] flex-shrink-0 flex flex-col gap-6 overflow-y-auto bg-slate-800 p-4 pt-6 gradient-scrollbar">
            {/* Add Questions */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">প্রশ্ন যোগ করুন</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
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
            </Card>

            <MathExpressions onInsert={handleInsertExpression} />
        </aside>

        {/* Hidden div for calculations */}
        <div className="absolute top-0 left-[-9999px] opacity-0 pointer-events-none" style={{ width: `${settings.width}px` }}>
            <div ref={hiddenRenderRef}></div>
        </div>
      </div>
    </>
  );
}

    