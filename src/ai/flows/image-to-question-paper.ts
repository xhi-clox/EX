
'use server';

/**
 * @fileOverview Converts an image of an exam paper into a structured question paper format.
 *
 * - imageToQuestionPaper - A function that takes an image as input and returns a structured question paper.
 * - ImageToQuestionPaperInput - The input type for the imageToQuestionPaper function.
 * - ImageToQuestionPaperOutput - The return type for the imageToQuestionPaper function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ImageToQuestionPaperInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      'A photo of an exam paper, as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.'    ),
});
export type ImageToQuestionPaperInput = z.infer<typeof ImageToQuestionPaperInputSchema>;

// This schema should align with the `Paper` interface in `src/app/editor/page.tsx`
// This is a simplified, non-recursive schema for improved AI consistency.
const SimpleQuestionSchema = z.object({
  id: z.string().describe("A unique identifier for the question (e.g., 'q1', 'q2a')."),
  type: z.enum(['passage', 'fill-in-the-blanks', 'short', 'mcq', 'essay', 'table', 'creative', 'section-header']),
  content: z.string().describe("The text content of the question, passage, or section header."),
  marks: z.number().optional().describe("The marks for this specific question."),
  options: z.array(z.object({ id: z.string(), text: z.string() })).optional().describe("Multiple choice options, if applicable."),
  numberingFormat: z.enum(['bangla-alpha', 'bangla-numeric', 'roman']).optional().describe("The numbering style for sub-questions (e.g., ক, খ, গ)."),
  tableData: z.array(z.array(z.string())).optional().describe("Data for table questions."),
  rows: z.number().optional(),
  cols: z.number().optional(),
  subQuestions: z.array(z.object({
      id: z.string().describe("A unique identifier for the sub-question that follows the parent's ID (e.g., 'q1a', 'q1b')."),
      type: z.enum(['passage', 'fill-in-the-blanks', 'short', 'mcq', 'essay', 'table', 'creative', 'section-header']),
      content: z.string().describe("The text content of the sub-question."),
      marks: z.number().optional().describe("The marks for this sub-question."),
      options: z.array(z.object({ id: z.string(), text: z.string() })).optional().describe("Multiple choice options for the sub-question, with IDs following the sub-question ID (e.g., 'q1a_opt1')."),
  })).optional().describe("An array of sub-questions nested under a main question (e.g., a passage or creative question)."),
});


const ImageToQuestionPaperOutputSchema = z.object({
    questions: z.array(SimpleQuestionSchema).describe('The array of questions extracted from the image.'),
});

export type ImageToQuestionPaperOutput = z.infer<typeof ImageToQuestionPaperOutputSchema>;

export async function imageToQuestionPaper(input: ImageToQuestionPaperInput): Promise<ImageToQuestionPaperOutput> {
  return imageToQuestionPaperFlow(input);
}

const prompt = ai.definePrompt({
  name: 'imageToQuestionPaperPrompt',
  input: {schema: ImageToQuestionPaperInputSchema},
  output: {schema: ImageToQuestionPaperOutputSchema},
  prompt: `You are an expert in processing exam papers from images, especially for the Bangladeshi education system. Your task is to analyze the provided image, which could be anything from a polished document to a rough, unorganized, or handwritten draft of questions.

You must interpret the content and structure it into a valid JSON object that matches the output schema. Your SOLE FOCUS is on the questions themselves. DO NOT extract header information like School Name, Exam Title, Subject, Time, or Total Marks.

Key Instructions:
1.  **Analyze and Structure**: Carefully analyze the image to identify all questions, passages (উদ্দীপক), section headers (e.g., ক-বিভাগ), and instructions. Infer the structure. A 'creative' question or a 'passage' will have a main 'content' body and its associated questions should be listed in the 'subQuestions' array.
2.  **Identify Question Types**: Determine the type for each item. Use 'section-header' for section titles (e.g., ক-বিভাগ). Use 'creative' for a main passage followed by sub-questions (like ক, খ, গ, ঘ). Use 'passage' for other stimulus texts. Use 'mcq' for multiple choice, 'short' for short answers, and 'essay' for long answers.
3.  **Handle Mathematics with LaTeX**: If you identify any mathematical expressions (fractions, exponents, roots, symbols, etc.), you MUST enclose them in LaTeX delimiters. Use single dollar signs ($...$) for inline math and double dollar signs ($$...$$) for block/display math. For example, 'x squared plus y squared equals z squared' should be written as '$x^2 + y^2 = z^2$'. A fraction 'a over b' should be '$\\frac{a}{b}$'.
4.  **Extract Details**: Extract the question content and marks. For creative questions, the total marks might be on the main question, but individual marks MUST be on each sub-question.
5.  **MANDATORY: Generate Hierarchical IDs**: You MUST create a unique 'id' for every single item.
    - Main questions: 'q1', 'q2', etc.
    - Sub-questions: Must be based on the parent ID. E.g., for 'q1', sub-questions are 'q1a', 'q1b'.
    - Options: Must be based on their question/sub-question ID. E.g., for 'q1a', options are 'q1a_opt1', 'q1a_opt2'.
    - IDs must be unique across the entire JSON object.
6.  **Language**: The content is likely in Bengali. Ensure your output maintains the correct language and characters.

Image: {{media url=photoDataUri}}

Return a single, valid JSON object containing ONLY the 'questions' array. Do not wrap it in other keys.`,
});

const imageToQuestionPaperFlow = ai.defineFlow(
  {
    name: 'imageToQuestionPaperFlow',
    inputSchema: ImageToQuestionPaperInputSchema,
    outputSchema: ImageToQuestionPaperOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
