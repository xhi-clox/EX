
'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BrainCircuit, Upload, ArrowRight, Image as ImageIcon, X } from 'lucide-react';
import { imageToQuestionPaper, type ImageToQuestionPaperOutput } from '@/ai/flows/image-to-question-paper';
import { useRouter, useSearchParams } from 'next/navigation';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

export default function ImageToQuestionPage() {
  const [image, setImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [extractedJson, setExtractedJson] = useState<ImageToQuestionPaperOutput | null>(null);
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImage(event.target.result as string);
          setExtractedJson(null);
          setError(null);
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
      const result = await imageToQuestionPaper({ photoDataUri: image });
      setExtractedJson(result);
    } catch (err) {
      console.error('Failed to convert image to question paper:', err);
      setError('An error occurred while processing the image. Please try again.');
    }
    setIsLoading(false);
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
            <Button onClick={handleGenerate} disabled={!image || isLoading} className="w-full text-lg py-6">
              <BrainCircuit className="mr-2 size-5" />
              {isLoading ? 'প্রসেসিং চলছে...' : 'ডিজিটাল প্রশ্নপত্র তৈরি করুন'}
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
