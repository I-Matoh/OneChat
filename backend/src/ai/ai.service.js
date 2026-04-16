/**
 * AI Service Layer
 * 
 * Architecture Note:
 * This module encapsulates all interactions with Large Language Models (LLMs).
 * We default to the `groq-sdk` for ultra-fast, low-latency inference using Llama models.
 * A fallback mechanism is provided to ensure continuous availability if the LLM API is unreachable,
 * which is critical for resilient enterprise applications.
 */

const Groq = require('groq-sdk');

// Initialize the Groq client. It automatically picks up process.env.GROQ_API_KEY
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

/**
 * Normalizes text input defensively to prevent type errors on missing or invalid data.
 * @param {any} value - The input to normalize
 * @returns {string} - Cleaned, trimmed string
 */
function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Splits prose into individual sentences based on punctuation.
 * Used primarily by the fallback analyzer for basic text processing without an ML model.
 */
function splitSentences(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Core primitive for extracting relevant keywords using frequency analysis.
 * Filters out common English stop words to maintain high signal-to-noise ratio.
 */
function topKeywords(text, limit = 6) {
  const stopWords = new Set([
    'the', 'and', 'for', 'that', 'with', 'this', 'from', 'have', 'will', 'your',
    'into', 'about', 'they', 'their', 'there', 'were', 'when', 'what', 'where',
    'which', 'would', 'should', 'could', 'then', 'than', 'also', 'just', 'over',
    'some', 'more', 'like', 'been', 'after', 'before', 'them', 'only', 'very',
    'into', 'chat', 'document', 'conversation', 'user', 'users',
  ]);

  const counts = new Map();
  // Using a regex to extract word-like segments composed of a-z, 0-9, and dashes.
  for (const raw of text.toLowerCase().match(/[a-z][a-z0-9_-]{2,}/g) || []) {
    if (stopWords.has(raw)) continue;
    counts.set(raw, (counts.get(raw) || 0) + 1);
  }

  // Sort frequencies descending and return the top keywords natively.
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

/**
 * Extracts action items using regex pattern matching when LLM extraction is unavailable.
 * Matches bullet points or specific action-oriented prefixes.
 */
function extractActionItems(text) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const actionLines = lines.filter((line) => (
    /^\s*[-*]\s+/.test(line) ||
    /\b(todo|action|next step|follow up|deadline|assign|owner|ship|deliver|fix|build|review)\b/i.test(line)
  ));

  return actionLines.slice(0, 20).map((line) => line.replace(/^\s*[-*]\s+/, '').trim()).filter(Boolean);
}

/**
 * Fallback summary generator.
 * Used when the Groq completion API fails or times out. Provides a functional summary
 * and ensures the application doesn't hard-crash.
 */
function fallbackSummary(prompt, content, contextType = 'general') {
  const text = normalizeText(content);
  if (!text) return 'No context provided. Add chat or document content and try again.';

  const sentences = splitSentences(text);
  const preview = sentences.slice(0, 4);
  const actions = extractActionItems(text).slice(0, 8);
  const keywords = topKeywords(text);

  const sections = [];
  sections.push(`Context type: ${contextType}`);

  if (prompt) sections.push(`Prompt focus: ${normalizeText(prompt).slice(0, 220)}`);
  if (preview.length > 0) sections.push('Key points:\n' + preview.map((line) => `- ${line}`).join('\n'));
  if (actions.length > 0) sections.push('Action items:\n' + actions.map((line) => `- ${line}`).join('\n'));
  if (keywords.length > 0) sections.push(`Keywords: ${keywords.join(', ')}`);

  return sections.join('\n\n');
}

/**
 * Executes a chat completion query against Groq API via their official SDK.
 * Handles timeouts and model selection implicitly.
 */
async function callGroqChat(prompt, { temperature = 0.2, maxTokens = 700 } = {}) {
  // Defensive check: if no API key is provided, fail-fast to trigger fallback processing
  if (!process.env.GROQ_API_KEY) return null;

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  const chatCompletion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: 'You are a highly efficient collaboration assistant. Return concise, practical, and highly accurate output formatted in Markdown where appropriate.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    model: model,
    temperature: temperature,
    max_tokens: maxTokens,
  });

  return chatCompletion.choices[0]?.message?.content?.trim() || '';
}

/**
 * Orchestrator for generating conversational AI text.
 * Combines system context with user prompts and executes the LLM pipeline, falling back sequentially if needed.
 */
async function generateAssistantText(prompt, content, contextType) {
  const mergedPrompt = [
    `Context type: ${contextType || 'general'}`,
    'User request:',
    normalizeText(prompt),
    '',
    'Context:',
    normalizeText(content),
  ].join('\n');

  try {
    const groqText = await callGroqChat(mergedPrompt);
    if (groqText) return { text: groqText, provider: 'groq' };
  } catch (err) {
    // Graceful fallback on networking or permission errors
    console.warn('[AI Service] Groq API Failed, using local fallback analyzer. Error:', err.message);
  }

  // Fallback executed synchronously if API call fails
  return { text: fallbackSummary(prompt, content, contextType), provider: 'fallback' };
}

/**
 * Specialized LLM orchestrator for extracting discrete action items.
 * Enforces highly structured output from the LLM to facilitate seamless ingestion into the database (Tasks).
 */
async function extractActionsWithAI(text) {
  // Pre-calculate fallback in case it's needed
  const fallback = extractActionItems(text);

  try {
    const prompt = [
      'Extract actionable tasks from this text.',
      'Return exactly one task per line without any numbers, markdown structures, or leading/trailing characters. Max 15 tasks.',
      '',
      normalizeText(text),
    ].join('\n');

    // Using lower temperature (0.1) for strictly structured, deterministic extraction
    const groqText = await callGroqChat(prompt, { temperature: 0.1, maxTokens: 500 });
    
    // Bubble up to fallback if the model returned an empty string
    if (!groqText) return { actions: fallback, provider: 'fallback' };

    // Format the raw LLM string into an array, cleaning out edge-case hallucinations
    const actions = groqText
      .split('\n')
      .map((line) => line.replace(/^\s*[-*\d.)]+\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 15);

    if (actions.length === 0) return { actions: fallback, provider: 'fallback' };
    
    return { actions, provider: 'groq' };
  } catch (err) {
    console.warn('[AI Service] Action Extraction API Failed, using local fallback. Error:', err.message);
    return { actions: fallback, provider: 'fallback' };
  }
}

module.exports = {
  generateAssistantText,
  extractActionsWithAI,
};
