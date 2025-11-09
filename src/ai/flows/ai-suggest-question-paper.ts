'use server';
/**
 * @fileOverview This file defines a Genkit flow for suggesting question papers based on a topic and grade level.
 *
 * The flow takes a topic and grade level as input and returns a suggested question paper.
 * - suggestQuestionPaper - A function that suggests a question paper based on the input.
 * - SuggestQuestionPaperInput - The input type for the suggestQuestionPaper function.
 * - SuggestQuestionPaperOutput - The return type for the suggestQuestionPaper function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestQuestionPaperInputSchema = z.object({
  topic: z.string().describe('The topic of the question paper.'),
  gradeLevel: z.string().describe('The grade level for the question paper (e.g., 6, 7, 8, 9, 10, 11, 12).'),
});
export type SuggestQuestionPaperInput = z.infer<typeof SuggestQuestionPaperInputSchema>;

const SuggestQuestionPaperOutputSchema = z.object({
  title: z.string().describe('The title of the suggested question paper.'),
  subject: z.string().describe('The subject of the question paper.'),
  grade: z.string().describe('The grade level of the question paper.'),
  sections: z.array(z.object({
    title: z.string().describe('The title of the section.'),
    questions: z.array(z.object({
      type: z.string().describe('The type of question (e.g., mcq, short, essay).'),
      content: z.string().describe('The content of the question.'),
      marks: z.number().describe('The marks allocated for the question.'),
    })).describe('The questions in the section.'),
  })).describe('The sections of the question paper.'),
});
export type SuggestQuestionPaperOutput = z.infer<typeof SuggestQuestionPaperOutputSchema>;

export async function suggestQuestionPaper(input: SuggestQuestionPaperInput): Promise<SuggestQuestionPaperOutput> {
  return suggestQuestionPaperFlow(input);
}

const suggestQuestionPaperPrompt = ai.definePrompt({
  name: 'suggestQuestionPaperPrompt',
  input: {schema: SuggestQuestionPaperInputSchema},
  output: {schema: SuggestQuestionPaperOutputSchema},
  prompt: `You are an expert Bangladeshi teacher. You will suggest a question paper based on the given topic and grade level.

Topic: {{{topic}}}
Grade Level: {{{gradeLevel}}}

Suggest a question paper with a title, subject, grade, and sections. Each section should have a title and a list of questions. Each question should have a type (mcq, short, essay), content, and marks.
Follow Bangladeshi education patterns.

Return the question paper in JSON format.`,
});

const suggestQuestionPaperFlow = ai.defineFlow(
  {
    name: 'suggestQuestionPaperFlow',
    inputSchema: SuggestQuestionPaperInputSchema,
    outputSchema: SuggestQuestionPaperOutputSchema,
  },
  async input => {
    const {output} = await suggestQuestionPaperPrompt(input);
    return output!;
  }
);
