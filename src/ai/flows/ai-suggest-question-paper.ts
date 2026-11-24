'use server';
/**
 * @fileOverview This file defines a Genkit flow for suggesting question papers based on a topic and grade level.
 *
 * The flow takes a topic and grade level as input and returns a suggested question paper.
 * - suggestQuestionPaper - A function that suggests a question paper based on the input.
 * - SuggestQuestionPaperInput - The input type for the suggestQuestionPaper function.
 * - SuggestQuestionPaperOutput - The return type for the suggestQuestionPaper function.
 */

import {ai, fallbackAi, modelChain} from '@/ai/genkit';
import {z} from 'genkit';
import {generateWithFallback, generateWithModelChain} from '@/ai/generate-with-fallback';

const SuggestQuestionPaperInputSchema = z.object({
  topic: z.string().describe('The topic of the question paper.'),
  gradeLevel: z.string().describe('The grade level for the question paper (e.g., 6, 7, 8, 9, 10, 11, 12).'),
});
export type SuggestQuestionPaperInput = z.infer<typeof SuggestQuestionPaperInputSchema>;

const editorQuestionTypes = z.enum([
  'passage',
  'fill-in-the-blanks',
  'short',
  'mcq',
  'essay',
  'table',
  'creative',
  'section-header',
]);

const suggestedQuestionSchema = z.object({
  id: z.string(),
  numberingLabel: z.string().optional(),
  type: editorQuestionTypes,
  content: z.string(),
  marks: z.number(),
  options: z.array(z.object({ id: z.string(), text: z.string() })).optional(),
  tableData: z.array(z.array(z.string())).optional(),
  rows: z.number().optional(),
  cols: z.number().optional(),
  subQuestions: z.array(z.object({
    id: z.string(),
    numberingLabel: z.string().optional(),
    type: editorQuestionTypes,
    content: z.string(),
    marks: z.number(),
    options: z.array(z.object({ id: z.string(), text: z.string() })).optional(),
  })).optional(),
});

const SuggestQuestionPaperOutputSchema = z.object({
  title: z.string().describe('The title of the suggested question paper.'),
  subject: z.string().describe('The subject of the question paper.'),
  grade: z.string().describe('The grade level of the question paper.'),
  sections: z.array(z.object({
    title: z.string().describe('The title of the section.'),
    questions: z.array(suggestedQuestionSchema).describe('The questions in the section, using the editor question format.'),
  })).describe('The sections of the question paper.'),
});
export type SuggestQuestionPaperOutput = z.infer<typeof SuggestQuestionPaperOutputSchema>;

export async function suggestQuestionPaper(input: SuggestQuestionPaperInput): Promise<SuggestQuestionPaperOutput> {
  return suggestQuestionPaperFlow(input);
}

const SUGGESTION_PROMPT = `You are an expert Bangladeshi teacher. You will suggest a question paper based on the given topic and grade level.

Topic: {{topic}}
Grade Level: {{gradeLevel}}

Suggest a question paper with a title, subject, grade, and sections. Each question must use one of the editor types exactly: 'mcq' for বহুনির্বাচনী with an options array, 'fill-in-the-blanks' for শূন্যস্থান পূরণ, 'table' for সারণি/ছক with tableData, 'creative' for সৃজনশীল with an উদ্দীপক and ক/খ/গ/ঘ subQuestions, 'short' for সংক্ষিপ্ত প্রশ্ন, 'essay' for রচনামূলক প্রশ্ন, 'passage' for a standalone passage, or 'section-header' for section labels. Do not represent an MCQ, table, or creative sub-question as generic plain text. Include IDs for every question, sub-question, and option.
Use a balanced Bangladeshi exam structure and keep the Bengali wording natural. Set numberingLabel for every question and sub-question using Bengali digits or letters where appropriate, without punctuation. Keep those labels out of content because the editor renders them.
Every question AND every sub-question must carry its own 'marks' value as a plain number, and the marks of the sub-questions must add up to the marks of their parent question. A সারণি or ছক may belong to any question type: attach it with 'tableData', 'rows' and 'cols' (or emit it as its own 'table' item) instead of dropping it. Keep every উদ্দীপক, instruction and clue block with the question it belongs to.

Return the question paper in JSON format.`;

const geminiSuggestionPrompt = ai.definePrompt({
  name: 'suggestQuestionPaperPrompt',
  input: { schema: SuggestQuestionPaperInputSchema },
  output: { schema: SuggestQuestionPaperOutputSchema },
  prompt: SUGGESTION_PROMPT.replace('{{topic}}', '{{{topic}}}').replace('{{gradeLevel}}', '{{{gradeLevel}}}'),
});

const fallbackGeminiSuggestionPrompt = fallbackAi?.definePrompt({
  name: 'fallbackSuggestQuestionPaperPrompt',
  input: { schema: SuggestQuestionPaperInputSchema },
  output: { schema: SuggestQuestionPaperOutputSchema },
  prompt: SUGGESTION_PROMPT.replace('{{topic}}', '{{{topic}}}').replace('{{gradeLevel}}', '{{{gradeLevel}}}'),
});

const runGeminiSuggestionPrompt = async (
  prompt: typeof geminiSuggestionPrompt,
  input: SuggestQuestionPaperInput
) =>
  generateWithModelChain({
    models: modelChain,
    label: 'Gemini models',
    run: (model) => prompt(input, {model}),
  });

const suggestQuestionPaperFlow = ai.defineFlow(
  {
    name: 'suggestQuestionPaperFlow',
    inputSchema: SuggestQuestionPaperInputSchema,
    outputSchema: SuggestQuestionPaperOutputSchema,
  },
  async input => {
    return generateWithFallback<SuggestQuestionPaperOutput>({
      primaryName: 'Gemini',
      fallbackName: 'fallback Gemini model',
      primary: async () => {
        const { output } = await runGeminiSuggestionPrompt(geminiSuggestionPrompt, input);
        if (!output) throw new Error('Gemini did not return a question paper.');
        return output;
      },
      fallback: async () => {
        if (!fallbackGeminiSuggestionPrompt) {
          throw new Error('No Gemini API key is configured.');
        }
        const { output } = await runGeminiSuggestionPrompt(fallbackGeminiSuggestionPrompt, input);
        if (!output) throw new Error('Fallback Gemini did not return a question paper.');
        return output;
      },
    });
  }
);
