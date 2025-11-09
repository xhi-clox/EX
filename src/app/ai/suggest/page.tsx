'use client';
import { Suspense } from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sparkles, ArrowRight } from 'lucide-react';
import { suggestQuestionPaper, type SuggestQuestionPaperOutput } from '@/ai/flows/ai-suggest-question-paper';
import { useRouter, useSearchParams } from 'next/navigation';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function AiSuggest() {
  const [topic, setTopic] = useState('');
  const [gradeLevel, setGradeLevel] = useState('9');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedJson, setSuggestedJson] = useState<SuggestQuestionPaperOutput | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project');

  useEffect(() => {
    if (!projectId) {
      router.push('/');
    }
  }, [projectId, router]);

  const handleGenerate = async () => {
    if (!topic || !gradeLevel) return;
    setIsLoading(true);
    setSuggestedJson(null);
    try {
      const result = await suggestQuestionPaper({ topic, gradeLevel });
      setSuggestedJson(result);
    } catch (error) {
      console.error('Failed to suggest question paper:', error);
      // You can add a toast notification here to inform the user
    }
    setIsLoading(false);
  };
  
  const openEditorWithContent = () => {
    if (!suggestedJson || !projectId) return;
    try {
      // Convert the AI output into the format expected by the editor's import logic.
      const newQuestions: any[] = [];
      (suggestedJson.sections || []).forEach(section => {
        newQuestions.push({
          id: `section_${Date.now()}_${Math.random()}`,
          type: 'section-header',
          content: section.title,
          marks: 0,
        });
        (section.questions || []).forEach(q => {
          newQuestions.push({
            ...q,
            id: `q_${Date.now()}_${Math.random()}`,
          });
        });
      });

      const importData = {
        questions: newQuestions,
        title: suggestedJson.title,
        subject: suggestedJson.subject,
        grade: suggestedJson.grade,
      };

      // Save the new data to localStorage for the editor to pick up.
      localStorage.setItem('newImageData', JSON.stringify(importData));
      
      // Navigate to the editor with a flag.
      router.push(`/editor?project=${projectId}&from=suggest`);
    } catch (e) {
      console.error("Invalid JSON format or localStorage error", e);
      // Show error toast
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <header className="text-center mb-8">
        <h1 className="text-3xl font-bold font-headline">AI দ্বারা প্রশ্নপত্র তৈরি করুন</h1>
        <p className="text-muted-foreground mt-2">
          একটি বিষয় এবং গ্রেড প্রদান করুন এবং AI আপনার জন্য একটি প্রশ্নপত্র তৈরি করবে।
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>১. বিবরণ প্রদান করুন</CardTitle>
            <CardDescription>প্রশ্নপত্রের জন্য একটি বিষয় এবং গ্রেড নির্বাচন করুন।</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="topic">বিষয়</Label>
              <Input
                id="topic"
                placeholder="e.g., বাংলা সাহিত্য"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grade">শ্রেণি</Label>
               <Select value={gradeLevel} onValueChange={setGradeLevel}>
                <SelectTrigger id="grade">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9">নবম শ্রেণি</SelectItem>
                  <SelectItem value="10">দশম শ্রেণি</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerate} disabled={!topic || !gradeLevel || isLoading} className="w-full">
              <Sparkles className="mr-2 size-4" />
              {isLoading ? 'জেনারেট হচ্ছে...' : 'প্রশ্নপত্র জেনারেট করুন'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>২. ফলাফল সম্পাদনা করুন</CardTitle>
            <CardDescription>AI দ্বারা তৈরি প্রশ্নপত্রটি দেখুন এবং প্রয়োজন হলে সম্পাদনা করুন।</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              className="h-80 font-code bg-slate-50 text-black"
              value={suggestedJson ? JSON.stringify(suggestedJson, null, 2) : ""}
              readOnly
              placeholder="এখানে AI দ্বারা তৈরি JSON আউটপুট দেখা যাবে..."
            />
            <Button onClick={openEditorWithContent} disabled={!suggestedJson} className="w-full">
              এডিটরে খুলুন <ArrowRight className="ml-2 size-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


export default function AiSuggestPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AiSuggest />
    </Suspense>
  );
}
