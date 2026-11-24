import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const primaryModel = process.env.GEMINI_MODEL || 'googleai/gemini-3.6-flash';

const configuredFallbackModels =
  process.env.GEMINI_FALLBACK_MODELS ||
  process.env.GEMINI_FALLBACK_MODEL ||
  'googleai/gemini-flash-lite-latest,googleai/gemini-3.5-flash-lite,googleai/gemini-3.1-flash-lite';

export const modelChain = [
  primaryModel,
  ...configuredFallbackModels
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean),
].filter((model, index, models) => models.indexOf(model) === index);

export const ai = genkit({
  plugins: [googleAI()],
  model: primaryModel,
});

const fallbackApiKey = process.env.GEMINI_API_KEY_FALLBACK || process.env.GEMINI_API_KEY;

export const fallbackAi = fallbackApiKey
  ? genkit({
      plugins: [googleAI({apiKey: fallbackApiKey})],
      model: modelChain[1] ?? primaryModel,
    })
  : undefined;
