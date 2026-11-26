'use client';
import { Suspense } from 'react';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BrainCircuit, Upload, ArrowRight, Image as ImageIcon, X } from 'lucide-react';
import { imageToQuestionPaper, type ImageToQuestionPaperOutput } from '@/ai/flows/image-to-question-paper';
import { useRouter, useSearchParams } from 'next/navigation';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

const MAX_AI_IMAGE_DIMENSION = 2000;
const AI_IMAGE_QUALITY = 0.92;
const questionTypes = new Set([
  'passage',
  'fill-in-the-blanks',
  'short',
  'mcq',
  'essay',
  'table',
  'creative',
  'section-header',
  'text-box',
  'image',
  'or',
]);

type ImportedQuestion = {
  id: string;
  type: string;
  content: string;
  [key: string]: unknown;
};

type ImportedQuestionPaper = {
  title?: string;
  examTitle?: string;
  schoolName?: string;
  subject?: string;
  grade?: string;
  timeAllowed?: string;
  totalMarks?: string | number;
  questions: ImportedQuestion[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseQuestionPaperJson = (text: string): unknown => {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.search(/[{[]/);
    if (start === -1) throw new Error('JSON object বা array পাওয়া যায়নি।');

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < cleaned.length; index += 1) {
      const character = cleaned[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') inString = true;
      else if (character === '{' || character === '[') depth += 1;
      else if (character === '}' || character === ']') {
        depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(cleaned.slice(start, index + 1));
          } catch {
            break;
          }
        }
      }
    }

    throw new Error('JSON পড়া যায়নি। অতিরিক্ত টেক্সট বা ভাঙা অংশ বাদ দিয়ে সম্পূর্ণ JSON দিন।');
  }
};

const validateQuestion = (
  value: unknown,
  path: string,
  ids: Set<string>
): value is ImportedQuestion => {
  if (!isRecord(value)) throw new Error(`${path} অবশ্যই একটি JSON object হতে হবে।`);
  if (typeof value.id !== 'string' || !value.id.trim()) {
    throw new Error(`${path}.id একটি non-empty string হতে হবে।`);
  }
  if (ids.has(value.id)) throw new Error(`${path}.id "${value.id}" আগেই ব্যবহৃত হয়েছে।`);
  ids.add(value.id);
  if (typeof value.type !== 'string' || !questionTypes.has(value.type)) {
    throw new Error(`${path}.type-এ supported question type দিতে হবে।`);
  }
  if (typeof value.content !== 'string') {
    throw new Error(`${path}.content অবশ্যই string হতে হবে।`);
  }
  if (value.marks !== undefined && (typeof value.marks !== 'number' || !Number.isFinite(value.marks) || value.marks < 0)) {
    throw new Error(`${path}.marks শূন্য বা তার বেশি number হতে হবে।`);
  }
  if (value.options !== undefined) {
    if (!Array.isArray(value.options) || value.options.some(
      (option) => !isRecord(option) || typeof option.id !== 'string' || typeof option.text !== 'string'
    )) {
      throw new Error(`${path}.options-এ { "id": string, "text": string } object-এর array দিতে হবে।`);
    }
  }
  if (value.tableData !== undefined && (!Array.isArray(value.tableData) || value.tableData.some(
    (row) => !Array.isArray(row) || row.some((cell) => typeof cell !== 'string')
  ))) {
    throw new Error(`${path}.tableData string cell-সহ two-dimensional array হতে হবে।`);
  }
  if (value.textBoxContent !== undefined && typeof value.textBoxContent !== 'string' && (
    !Array.isArray(value.textBoxContent) || value.textBoxContent.some((line) => typeof line !== 'string')
  )) {
    throw new Error(`${path}.textBoxContent string অথবা string-এর array হতে হবে।`);
  }
  if (value.type === 'table' && !Array.isArray(value.tableData)) {
    throw new Error(`${path}.type "table" হলে tableData দিতে হবে।`);
  }
  if (value.type === 'text-box' && value.textBoxContent === undefined) {
    throw new Error(`${path}.type "text-box" হলে textBoxContent দিতে হবে।`);
  }
  if (value.subQuestions !== undefined) {
    if (!Array.isArray(value.subQuestions)) {
      throw new Error(`${path}.subQuestions অবশ্যই array হতে হবে।`);
    }
    value.subQuestions.forEach((question, index) => {
      validateQuestion(question, `${path}.subQuestions[${index}]`, ids);
    });
  }
  return true;
};

function ImageToQuestionPage() {
  const [image, setImage] = useState<string | null>(null);
  const [preparedImage, setPreparedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [extractedJson, setExtractedJson] = useState<ImageToQuestionPaperOutput | ImportedQuestionPaper | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project');

   useEffect(() => {
    if (!projectId) {
      // Handle case where project ID is missing, maybe redirect or show an error
      router.push('/');
    }
  }, [projectId, router]);

  // The vision model only accepts clean, standard image data. Phone photos can
  // carry unusual EXIF markers or be too large, which makes the API reject
  // them, so every upload is decoded and re-encoded before it is sent.
  const prepareImageForAi = async (dataUri: string): Promise<string> => {
    const imageElement = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('The image could not be decoded.'));
      element.src = dataUri;
    });

    const naturalWidth = imageElement.naturalWidth || imageElement.width;
    const naturalHeight = imageElement.naturalHeight || imageElement.height;
    if (!naturalWidth || !naturalHeight) {
      throw new Error('The image has no readable dimensions.');
    }

    const scale = Math.min(1, MAX_AI_IMAGE_DIMENSION / Math.max(naturalWidth, naturalHeight));
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not prepare the image for the AI.');
    }
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(imageElement, 0, 0, width, height);

    return canvas.toDataURL('image/jpeg', AI_IMAGE_QUALITY);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (!event.target?.result) return;
        const dataUri = event.target.result as string;
        setImage(dataUri);
        setPreparedImage(null);
        setExtractedJson(null);
        setError(null);
        try {
          setPreparedImage(await prepareImageForAi(dataUri));
        } catch (err) {
          console.error('Failed to prepare the image for the AI:', err);
          setError('ছবিটি প্রস্তুত করা যায়নি। অন্য একটি ছবি বেছে নিন।');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!image) return;
    setIsLoading(true);
    setExtractedJson(null);
    setError(null);
    try {
      const result = await imageToQuestionPaper({ photoDataUri: preparedImage ?? image });
      setExtractedJson(result);
    } catch (err) {
      console.error('Failed to convert image to question paper:', err);
      setError('An error occurred while processing the image. Please try again.');
    }
    setIsLoading(false);
  };

  const handleJsonImport = () => {
    setError(null);
    setExtractedJson(null);
    try {
      const parsed: unknown = parseQuestionPaperJson(jsonText);
      if (!isRecord(parsed) || !Array.isArray(parsed.questions)) {
        throw new Error('JSON-এর root object-এ "questions" array থাকতে হবে।');
      }
      if (parsed.questions.length === 0) {
        throw new Error('"questions" array-তে অন্তত একটি question দিন।');
      }
      if (parsed.title !== undefined && typeof parsed.title !== 'string') {
        throw new Error('"title" string হতে হবে।');
      }
      if (parsed.examTitle !== undefined && typeof parsed.examTitle !== 'string') {
        throw new Error('"examTitle" string হতে হবে।');
      }
      if (parsed.schoolName !== undefined && typeof parsed.schoolName !== 'string') {
        throw new Error('"schoolName" string হতে হবে।');
      }
      if (parsed.subject !== undefined && typeof parsed.subject !== 'string') {
        throw new Error('"subject" string হতে হবে।');
      }
      if (parsed.grade !== undefined && typeof parsed.grade !== 'string') {
        throw new Error('"grade" string হতে হবে।');
      }
      if (parsed.timeAllowed !== undefined && typeof parsed.timeAllowed !== 'string') {
        throw new Error('"timeAllowed" string হতে হবে।');
      }
      if (
        parsed.totalMarks !== undefined &&
        typeof parsed.totalMarks !== 'string' &&
        (typeof parsed.totalMarks !== 'number' || !Number.isFinite(parsed.totalMarks) || parsed.totalMarks < 0)
      ) {
        throw new Error('"totalMarks" non-negative number অথবা string হতে হবে।');
      }
      const ids = new Set<string>();
      parsed.questions.forEach((question, index) => {
        validateQuestion(question, `questions[${index}]`, ids);
      });
      setExtractedJson(parsed as ImportedQuestionPaper);
    } catch (err) {
      console.error('Could not parse question paper JSON:', err);
      setError(err instanceof Error ? err.message : 'JSON পড়া যায়নি। Format যাচাই করুন।');
    }
  };
  
  const openEditorWithContent = () => {
    if (!extractedJson || !projectId) return;
    try {
      localStorage.setItem('newImageData', JSON.stringify(extractedJson));
      router.push(`/editor?project=${projectId}&from=image`);
    } catch (e) {
      console.error("Invalid JSON format or localStorage error", e);
      setError("Failed to prepare data for the editor due to an invalid format.");
    }
  };

  return (
    <div className="container mx-auto max-w-4xl p-4 md:p-6 lg:p-8">
      <header className="text-center mb-10">
        <h1 className="text-4xl font-bold font-headline">ছবি থেকে প্রশ্ন তৈরি করুন</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          আপনার প্রশ্নপত্রের ছবি আপলোড করুন এবং AI-এর সাহায্যে ডিজিটাল প্রশ্নপত্রে রূপান্তর করুন।
        </p>
      </header>

      <div className="space-y-8">
        {/* Step 1: Upload */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <span className="flex items-center justify-center size-8 rounded-full bg-primary text-primary-foreground font-bold">1</span>
              ছবি আপলোড করুন
            </CardTitle>
            <CardDescription>আপনার প্রশ্নপত্রের একটি স্পষ্ট ছবি নির্বাচন করুন। হাতে লেখা বা অগোছালো নোটও চলবে।</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {image ? (
              <div className="relative w-full p-4 border rounded-lg">
                <img src={image} alt="Uploaded paper" className="max-h-[400px] w-auto mx-auto rounded-md object-contain" />
                <Button 
                  variant="destructive" 
                  size="icon" 
                  className="absolute top-2 right-2 rounded-full h-8 w-8"
                  onClick={() => {
                    setImage(null);
                    setExtractedJson(null);
                    if(fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  <X className="size-4"/>
                  <span className="sr-only">Remove image</span>
                </Button>
              </div>
            ) : (
              <div
                className="w-full h-64 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground cursor-pointer transition-colors hover:border-primary hover:bg-primary/5"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 font-semibold">ছবি আপলোড করতে এখানে ক্লিক করুন</p>
                <p className="text-xs mt-1">PNG, JPG, or WEBP formats</p>
              </div>
            )}
             <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleImageUpload}
              accept="image/png, image/jpeg, image/webp"
            />
            <Button onClick={handleGenerate} disabled={!image || !preparedImage || isLoading} className="w-full text-lg py-6">
              <BrainCircuit className="mr-2 size-5" />
              {isLoading ? 'প্রসেসিং চলছে...' : preparedImage ? 'ডিজিটাল প্রশ্নপত্র তৈরি করুন' : 'ছবি প্রস্তুত হচ্ছে...'}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>অথবা JSON থেকে যোগ করুন</CardTitle>
            <CardDescription>
              Cloud AI-তে ব্যবহারের জন্য <a className="underline font-medium" href="/question-paper.schema.json" download="question-paper.schema.json">প্রশ্নপত্রের JSON Schema ডাউনলোড করুন</a>।
              AI-এর JSON ফল নিচে paste করে যাচাই করুন।
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              className="min-h-64 font-code bg-slate-50 text-black"
              value={jsonText}
              onChange={(event) => {
                setJsonText(event.target.value);
                setError(null);
              }}
              placeholder={'{\n  "questions": [\n    { "id": "q1", "type": "short", "content": "প্রশ্ন লিখুন" }\n  ]\n}'}
              aria-label="Question paper JSON"
            />
            <Button onClick={handleJsonImport} disabled={!jsonText.trim() || isLoading} className="w-full">
              JSON যাচাই করে যোগ করুন
            </Button>
          </CardContent>
        </Card>

        {/* Step 2: Review and Edit */}
        {(isLoading || extractedJson || error) && (
          <Card className="shadow-md animate-in fade-in-50">
             <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <span className="flex items-center justify-center size-8 rounded-full bg-primary text-primary-foreground font-bold">2</span>
                 ফলাফল পর্যালোচনা করুন
              </CardTitle>
              <CardDescription>AI দ্বারা তৈরি প্রশ্নপত্রটি দেখুন এবং এডিটরে নিয়ে সম্পাদনা করুন।</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-1/3" />
                  <Skeleton className="h-64 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : error ? (
                 <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : (
                <>
                  <Textarea
                    className="h-80 font-code bg-slate-50 text-black"
                    value={extractedJson ? JSON.stringify(extractedJson, null, 2) : ''}
                    readOnly
                    placeholder="এখানে AI দ্বারা তৈরি JSON আউটপুট দেখা যাবে..."
                  />
                  <Button onClick={openEditorWithContent} disabled={!extractedJson} className="w-full text-lg py-6">
                    এডিটরে খুলুন <ArrowRight className="ml-2 size-5" />
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function ImageToQuestionPageWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ImageToQuestionPage />
    </Suspense>
  );
}
