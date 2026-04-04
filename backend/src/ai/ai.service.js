function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function splitSentences(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function topKeywords(text, limit = 6) {
  const stopWords = new Set([
    'the', 'and', 'for', 'that', 'with', 'this', 'from', 'have', 'will', 'your',
    'into', 'about', 'they', 'their', 'there', 'were', 'when', 'what', 'where',
    'which', 'would', 'should', 'could', 'then', 'than', 'also', 'just', 'over',
    'some', 'more', 'like', 'been', 'after', 'before', 'them', 'only', 'very',
    'into', 'chat', 'document', 'conversation', 'user', 'users',
  ]);

  const counts = new Map();
  for (const raw of text.toLowerCase().match(/[a-z][a-z0-9_-]{2,}/g) || []) {
    if (stopWords.has(raw)) continue;
    counts.set(raw, (counts.get(raw) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

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

async function callGroqChat(prompt, { temperature = 0.2, maxTokens = 700 } = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  if (!apiKey) return null;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'system',
          content: 'You are a collaboration assistant. Return concise, practical output.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Groq request failed: ${response.status} ${body.slice(0, 240)}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || '';
}

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
  } catch {
    // Graceful fallback below
  }

  return { text: fallbackSummary(prompt, content, contextType), provider: 'fallback' };
}

async function extractActionsWithAI(text) {
  const fallback = extractActionItems(text);

  try {
    const prompt = [
      'Extract actionable tasks from this text.',
      'Return one task per line, no numbering, no markdown, max 15 tasks.',
      '',
      text,
    ].join('\n');

    const groqText = await callGroqChat(prompt, { temperature: 0.1, maxTokens: 500 });
    if (!groqText) return { actions: fallback, provider: 'fallback' };

    const actions = groqText
      .split('\n')
      .map((line) => line.replace(/^\s*[-*\d.)]+\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 15);

    if (actions.length === 0) return { actions: fallback, provider: 'fallback' };
    return { actions, provider: 'groq' };
  } catch {
    return { actions: fallback, provider: 'fallback' };
  }
}

module.exports = {
  generateAssistantText,
  extractActionsWithAI,
};
