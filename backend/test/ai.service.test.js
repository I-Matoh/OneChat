const test = require('node:test');
const assert = require('node:assert/strict');

const { generateAssistantText, extractActionsWithAI } = require('../src/ai/ai.service');

test('assistant generation falls back to local summary', async () => {
  const originalApiKey = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;

  const result = await generateAssistantText(
    'Summarize the discussion',
    'Kickoff went well. - Fix onboarding bug by Friday. Review analytics dashboard next week.',
    'chat'
  );

  assert.equal(result.provider, 'fallback');
  assert.match(result.text, /Context type: chat/);
  assert.match(result.text, /Action items:/);

  process.env.GROQ_API_KEY = originalApiKey;
});

test('action extraction falls back to local heuristics', async () => {
  const originalApiKey = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;

  const result = await extractActionsWithAI(`
    - Review sprint board
    Next step: ship the release notes
    Follow up with design on the landing page
  `);

  assert.equal(result.provider, 'fallback');
  assert.deepEqual(result.actions, [
    'Review sprint board',
    'Next step: ship the release notes',
    'Follow up with design on the landing page',
  ]);

  process.env.GROQ_API_KEY = originalApiKey;
});
