
'use server';

/**
 * @fileOverview Converts an image of an exam paper into a structured question paper format.
 *
 * - imageToQuestionPaper - A function that takes an image as input and returns a structured question paper.
 * - ImageToQuestionPaperInput - The input type for the imageToQuestionPaper function.
 * - ImageToQuestionPaperOutput - The return type for the imageToQuestionPaper function.
 */

import {ai, fallbackAi, modelChain} from '@/ai/genkit';
import {z} from 'genkit';
import {generateWithFallback, generateWithModelChain} from '@/ai/generate-with-fallback';

const ImageToQuestionPaperInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      'A photo of an exam paper, as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.'
    ),
});
export type ImageToQuestionPaperInput = z.infer<typeof ImageToQuestionPaperInputSchema>;

// This schema should align with the `Paper` interface in `src/app/editor/page.tsx`
// This is a simplified, non-recursive schema for improved AI consistency.
const editorQuestionTypes = z.enum([
  'passage',
  'fill-in-the-blanks',
  'short',
  'mcq',
  'essay',
  'table',
  'text-box',
  'creative',
  'section-header',
  'or',
]);

const SimpleQuestionSchema = z.object({
  id: z.string().describe("A unique identifier for the question (e.g., 'q1', 'q2a')."),
  numberingLabel: z.string().optional().describe("The exact printed question label, such as ১, ২, or ক, খ, without punctuation."),
  type: editorQuestionTypes,
  content: z.string().describe("The text content of the question, passage, or section header."),
  textBoxContent: z.array(z.string()).optional().describe("For a 'text-box' question only: one array entry per visible line inside the single bordered box, in top-to-bottom order. Plain text only - never JSON, never field names, never quotes."),
  textBoxAligns: z.array(z.enum(['left', 'center', 'right', 'justify'])).optional().describe("For a 'text-box' question only: one alignment value per line of 'textBoxContent' (same order). Use 'center' or 'right' for lines that are centred or pushed to the right in the image, 'left' for the rest."),
  marks: z.number().optional().describe("The marks for this specific question."),
  options: z.array(z.object({ id: z.string(), text: z.string() })).optional().describe("Multiple choice options, if applicable."),
  numberingFormat: z.enum(['bangla-alpha', 'bangla-numeric', 'roman']).optional().describe("The numbering style for sub-questions (e.g., ক, খ, গ)."),
  tableData: z.array(z.array(z.string())).optional().describe("Data for table questions. For a boxed fill-in form that has internal divider lines, put each field label in the first cell of a row and leave the second cell empty."),
  rows: z.number().optional(),
  cols: z.number().optional(),
  subQuestions: z.array(z.object({
      id: z.string().describe("A unique identifier for the sub-question that follows the parent's ID (e.g., 'q1a', 'q1b')."),
      numberingLabel: z.string().optional().describe("The exact printed sub-question label, such as ১, ২ or ক, খ, without punctuation."),
      type: editorQuestionTypes,
      content: z.string().describe("The text content of the sub-question."),
      textBoxContent: z.array(z.string()).optional().describe("For a 'text-box' sub-question only: one array entry per visible line inside the single bordered box, in top-to-bottom order. Plain text only."),
      textBoxAligns: z.array(z.enum(['left', 'center', 'right', 'justify'])).optional().describe("For a 'text-box' sub-question only: one alignment value per line of 'textBoxContent'."),
      marks: z.number().optional().describe("The marks for this sub-question."),
      options: z.array(z.object({ id: z.string(), text: z.string() })).optional().describe("Multiple choice options for the sub-question, with IDs following the sub-question ID (e.g., 'q1a_opt1', 'q1a_opt2')."),
      tableData: z.array(z.array(z.string())).optional().describe("Data for a table printed with this sub-question (any section, any question type). One array per row."),
      rows: z.number().optional(),
      cols: z.number().optional(),
  })).optional().describe("An array of sub-questions nested under a main question (e.g., a passage or creative question)."),
});


const ImageToQuestionPaperOutputSchema = z.object({
    questions: z.array(SimpleQuestionSchema).describe('The array of questions extracted from the image.'),
});

export type ImageToQuestionPaperOutput = z.infer<typeof ImageToQuestionPaperOutputSchema>;

export async function imageToQuestionPaper(input: ImageToQuestionPaperInput): Promise<ImageToQuestionPaperOutput> {
  return imageToQuestionPaperFlow(input);
}

const IMAGE_PROMPT = `You are an expert in processing exam papers from images, especially for the Bangladeshi education system. Your task is to analyze the provided image, which could be anything from a polished document to a rough, unorganized, or handwritten draft of questions.

You must interpret the content and structure it into a valid JSON object that matches the output schema. Your SOLE FOCUS is on the questions themselves. DO NOT extract header information like School Name, Exam Title, Subject, Time, or Total Marks.

Key Instructions:
1.  **Analyze and Structure**: Carefully analyze the image to identify all questions, passages (উদ্দীপক), section headers (e.g., ক-বিভাগ), and instructions. Infer the structure. A 'creative' question or a 'passage' will have a main 'content' body and its associated questions should be listed in the 'subQuestions' array.
2.  **Identify Question Types - map every item to the editor format**: Use only the exact type values in the schema.
  - 'mcq': বহুনির্বাচনী / MCQ questions with selectable options. Put every option in the 'options' array.
  - 'fill-in-the-blanks': শূন্যস্থান পূরণ questions. Preserve blanks using underscores or the visible blank marker in 'content'.
  - 'table': সারণি / ছক / table-based questions that are divided into separate cells by visible internal lines. Put the visible cells in 'tableData' and set 'rows' and 'cols'. If the rectangle has NO internal dividers, use 'text-box' instead.
  - 'text-box': a single bordered rectangle (a framed block, a boxed note, a ruled writing area, a form drawn as one empty box) that contains text but NO internal horizontal or vertical dividers and no separate cells. The lines written inside the box go into 'textBoxContent' (an ARRAY with one array entry per visible line), the instruction printed OUTSIDE the box goes into 'content', and 'textBoxAligns' carries one alignment value per line of 'textBoxContent'. Never flatten such a box into plain text, never split it into table cells, and never invent table rows for the fields written inside it.
  - 'creative': সৃজনশীল questions with an উদ্দীপক or stimulus and related ক, খ, গ, ঘ parts. Put each part in 'subQuestions' and classify each part as 'short' unless it is clearly another supported type.
  - 'short': সংক্ষিপ্ত প্রশ্ন or brief-answer questions.
  - 'essay': রচনামূলক / long-form questions.
  - 'passage': a standalone passage or reading stimulus that is not a creative question.
  - 'section-header': section labels such as ক-বিভাগ, খ-বিভাগ, or instructions that introduce a group.
  - 'or': a printed separator such as 'অথবা' between alternative questions.
    If a section instruction says 'সঠিক উত্তরটি দাও', 'সঠিক উত্তরটি বেছে নাও', 'বহুনির্বাচনী', or an equivalent phrase, emit one 'mcq' container for that section. Put the instruction in the container content and put each numbered item in its 'subQuestions' as type 'mcq', preserving the complete item text. If options are not visible in the image, return an empty options array rather than inventing answers.
   Never flatten an MCQ into a short question, never flatten a table into plain text, never flatten a single bordered box into plain text (use 'text-box'), and never flatten creative sub-parts into the parent content.
3.  **Handle Mathematics with LaTeX**: If you identify any mathematical expressions (fractions, exponents, roots, symbols, etc.), you MUST enclose them in LaTeX delimiters. Use single dollar signs ($...$) for inline math and double dollar signs ($$...$$) for block/display math. For example, 'x squared plus y squared equals z squared' should be written as '$x^2 + y^2 = z^2$'. A fraction 'a over b' should be '$\\frac{a}{b}$'.
4.  **Extract Details - MARKS ARE MANDATORY**: Extract the question content and the marks. The marks are the most important value after the question text, so never drop them.
    - Every printed mark value MUST be captured as a plain JSON number in 'marks' (Bengali digits included: '১০' becomes 10, '২' becomes 2). Never write marks as a string and never put the mark text inside 'content'.
    - Read the marks from wherever they are printed: at the end of the question line, in brackets, after the question number, in the right margin, or as a section total next to the instruction.
    - Give EVERY item its own 'marks': a main question, a creative ক/খ/গ/ঘ part, an MCQ item and a passage question all carry their own printed mark value.
    - For a creative question the total may be printed on the main question while each ক/খ/গ/ঘ part prints its own value - capture BOTH: the total on the parent and the part values on the sub-questions.
    - If only a section total is printed (for example 'সব প্রশ্নের নম্বর ১০') put that total on the container question and leave the individual items without 'marks'.
    - If the image prints no marks at all for an item, simply omit the 'marks' key for that item - never invent a number. The editor keeps an empty marks field so the teacher can type it in.
5.  **Preserve Printed Numbering**: Extract every visible printed label exactly into 'numberingLabel', without trailing punctuation. Preserve Bengali digits such as ১, ২, ৩ and Bengali letters such as ক, খ, গ, ঘ. Do not include the label again in 'content'. For MCQ options, preserve their text without the visible ক/খ/গ/ঘ prefix because the editor renders option labels.
6.  **MANDATORY: Generate Hierarchical IDs**: You MUST create a unique 'id' for every single item.
    - Main questions: 'q1', 'q2', etc.
    - Sub-questions: Must be based on the parent ID. E.g., for 'q1', sub-questions are 'q1a', 'q1b'.
    - Options: Must be based on their question/sub-question ID. E.g., for 'q1a', options are 'q1a_opt1', 'q1a_opt2'.
    - IDs must be unique across the entire JSON object.
7.  **Language**: The content is likely in Bengali. Ensure your output maintains the correct language and characters.
8.  **Keep the original layout with real line breaks**: When the source has several lines (a heading block, an address block, a form, a list of fields), reproduce that vertical order inside 'content' (or as separate entries of the 'textBoxContent' array for a 'text-box' question).
    - In the JSON string, a line break must be a single escaped newline (one backslash followed by n) so it decodes to an actual line break. Never double-escape it (two backslashes followed by n) and never write the visible characters backslash-n inside the text.
    - Use a blank line (two escaped newlines in a row) where the original has visible vertical space between blocks.
    - Centered headings stay on their own lines, in the same order as the image.
9.  **Boxed forms and framed blocks (ছক) - decide by the INTERNAL LINES, never by the fact that it is a box, and never by the section it appears in**:
     - FIRST look inside the rectangle of the box.
     - If the rectangle has NO internal horizontal or vertical divider lines (one single empty box, or a box where the fields are only written as text lines), emit it as a 'text-box' question:
       - 'content' holds the instruction printed OUTSIDE the box (for example 'শিক্ষার্থী ফরমের অনুষ্ঠানীর নাম ...'). If nothing is printed outside the box, leave 'content' empty.
       - 'textBoxContent' is an ARRAY of strings: one array entry per line written INSIDE the box, in the original order (the heading lines first - institution name, form title, year - then one entry per written field such as '১. শিক্ষার্থীর নাম', then the signature lines). Each entry holds ONLY that line of plain text. Never put JSON, braces, quotes, field names or the whole answer payload inside a single entry.
       - 'textBoxAligns' holds one value per line of 'textBoxContent' in the same order: 'center' for a centred heading, 'right' for a line pushed to the right edge (for example the signature lines at the bottom right), 'left' for everything else.
       - Do NOT create 'tableData', 'rows' or 'cols' for such a box.
     - If the rectangle DOES have internal divider lines (a ruled form with one row per field and a column for the answer), emit it as a 'table' question:
       - 'content' holds the form heading lines (institution name, competition name, form title) separated by escaped newlines.
       - 'tableData' holds one row per field: the label (for example '1. শিক্ষার্থীর নাম') in the first cell and an empty string in the second cell so the answer can be written in a ruled box.
       - 'rows' must equal the number of fields and 'cols' must equal 2.
       - Keep the field order exactly as written in the image.
       - Signature lines at the bottom of a form become the last rows of the same table with their labels in the first cell and an empty second cell.
10. **TABLES, ছক AND CLUES BELONG TO EVERY QUESTION, NOT ONLY TO শূন্যস্থান**:
     - A table (সারণি, তালিকা, নামের তালিকা, তুল্য মূল্যের সারণি, দামের তালিকা, পরিসংখ্যানের ছক) or a ছক (a ruled box / framed form / grid) can be printed under ANY question of ANY section - বহুনির্বাচনী, সৃজনশীল, সংক্ষিপ্ত, রচনামূলক, উদ্দীপক, সাধারণ প্রশ্ন. Never skip a সারণি or a ছক because the question sits outside the শূন্যস্থান (fill-in-the-blanks) section, and never skip it because the table belongs to a creative or MCQ question.
     - When a question refers to a printed সারণি, attach that table to that question: put the visible cells in 'tableData', set 'rows' and 'cols', and keep the instruction line in 'content'. The question keeps its own type ('short', 'creative', 'mcq', 'essay', ...) - you do NOT have to change the type to 'table'.
     - A ছক (boxed block) that belongs to a question follows rule 9: no internal lines -> 'text-box' with 'textBoxContent', internal lines -> 'table' with 'tableData'. Emit it as its own 'text-box' or 'table' item directly before the question that uses it (or attach 'textBoxContent' to the question itself when the box is clearly part of that question).
     - If the table is printed separately (not directly under a question), emit it as its own 'table' question right before the question that uses it, with a short 'content' that names it (for example 'নিচের সারণিতে ...').
     - A clue block is anything the student must read before answering: উদ্দীপক (stimulus/passage), নির্দেশনা (instruction such as 'নিচের উদ্দীপকটি পড়...'), a তথ্য/সূত্র/নোট block, a boxed hint (ক্লু), or a worked example. Keep it with its question: put the text in the question's 'content' (or as a separate 'passage' or 'text-box' item placed just before the question) and NEVER drop it.
     - Sub-questions may carry a table as well - use 'tableData', 'rows' and 'cols' on the sub-question when a table is printed with that ক/খ/গ/ঘ part.
     - Rule of thumb: every visible box, table, list, passage and hint in the image must appear somewhere in the output. If you are unsure whether a block belongs to a question, keep it - a duplicated block is better than a missing one.

Return a single, valid JSON object containing ONLY the 'questions' array. Do not wrap it in other keys.`;

const geminiImagePrompt = ai.definePrompt({
  name: 'imageToQuestionPaperPrompt',
  input: { schema: ImageToQuestionPaperInputSchema },
  output: { schema: ImageToQuestionPaperOutputSchema },
  prompt: `${IMAGE_PROMPT}

Image: {{media url=photoDataUri}}`,
});

const fallbackGeminiImagePrompt = fallbackAi?.definePrompt({
  name: 'fallbackImageToQuestionPaperPrompt',
  input: { schema: ImageToQuestionPaperInputSchema },
  output: { schema: ImageToQuestionPaperOutputSchema },
  prompt: `${IMAGE_PROMPT}

Image: {{media url=photoDataUri}}`,
});

const runGeminiImagePrompt = async (
  prompt: typeof geminiImagePrompt,
  input: ImageToQuestionPaperInput
) =>
  generateWithModelChain({
    models: modelChain,
    label: 'Gemini models',
    run: (model) => prompt(input, {model}),
  });

const requireExtractedQuestions = (
  output: ImageToQuestionPaperOutput | null | undefined,
  provider: string
): ImageToQuestionPaperOutput => {
  const parsed = ImageToQuestionPaperOutputSchema.safeParse(output);
  if (!parsed.success || parsed.data.questions.length === 0) {
    throw new Error(`${provider} did not extract any questions from the image.`);
  }
  return parsed.data;
};

const imageToQuestionPaperFlow = ai.defineFlow(
  {
    name: 'imageToQuestionPaperFlow',
    inputSchema: ImageToQuestionPaperInputSchema,
    outputSchema: ImageToQuestionPaperOutputSchema,
  },
  async input => {
    return generateWithFallback<ImageToQuestionPaperOutput>({
      primaryName: 'Gemini',
      fallbackName: 'fallback Gemini model',
      primary: async () => {
        const { output } = await runGeminiImagePrompt(geminiImagePrompt, input);
        return requireExtractedQuestions(output, 'Gemini');
      },
      fallback: async () => {
        if (!fallbackGeminiImagePrompt) {
          throw new Error('No Gemini API key is configured.');
        }
        const { output } = await runGeminiImagePrompt(fallbackGeminiImagePrompt, input);
        return requireExtractedQuestions(output, 'Fallback Gemini');
      },
    });
  }
);
