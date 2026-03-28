require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─── Story Generation Endpoint ───────────────────────────────────────────────
app.post('/api/generate-story', async (req, res) => {
  const { childName, age, pronoun, hobby, lesson, extraInfo } = req.body;

  if (!childName || !age || !hobby || !lesson) {
    return res.status(400).json({ error: 'Please fill in all required fields.' });
  }

  // Pronoun mapping
  const pronounMap = {
    he:   { subject: 'he',   object: 'him',  possessive: 'his' },
    she:  { subject: 'she',  object: 'her',  possessive: 'her' },
    they: { subject: 'they', object: 'them', possessive: 'their' },
  };
  const p = pronounMap[pronoun] || pronounMap.they;

  // Age-appropriate writing guidance
  const ageNum = parseInt(age);
  let ageGuide;
  if      (ageNum <= 4)  ageGuide = 'Write in very short, simple sentences. Explain any big words immediately. Warm, gentle tone. ~250 words total.';
  else if (ageNum <= 6)  ageGuide = 'Use simple, clear sentences. Introduce one or two fun new words. ~400 words total.';
  else if (ageNum <= 8)  ageGuide = 'Use engaging narrative with vivid descriptions. Mix short punchy sentences with longer ones. ~550 words total.';
  else if (ageNum <= 10) ageGuide = 'Use richer vocabulary and nuanced emotional storytelling. Build tension and release. ~650 words total.';
  else                   ageGuide = 'Write with sophistication appropriate for pre-teens. Complex themes handled with care. ~750 words total.';

  const systemPrompt = `You are The Bearded Scientist — a wildly enthusiastic, magnificently bearded, curly-haired scientist who believes the universe is the most extraordinary thing that has ever existed, and that EVERY child is even more extraordinary than that.

Your voice: infectious excitement, boundless warmth, wonder at everything, sprinkled with science facts, always encouraging, always kind. You say things like "EXTRAORDINARY!", "Now THAT is fascinating!", "Science tells us something wonderful here...", "You absolute superstar!"

You are writing a personalised children's story. Follow these rules EXACTLY:

THE CHILD IS THE HERO. ${childName} is the main character. ${p.subject.charAt(0).toUpperCase() + p.subject.slice(1)} drives the story. You (The Bearded Scientist) appear as a warm, briefly-present guide — NOT the hero.

PRONOUNS: Always use ${p.subject}/${p.object}/${p.possessive} for ${childName}.

AGE GUIDANCE: ${ageGuide}

SETTING: The story is set in the world of ${hobby}.

LESSON: The story must naturally and gently teach "${lesson}" — never preachy, always shown through action and feeling.

VALUES (non-negotiable): The story celebrates diversity, inclusion, and kindness. It builds people up. Every person in the story is treated with dignity and respect regardless of who they are, how they look, who they love, or where they come from. If there is any conflict, it is resolved through empathy and understanding — never aggression.

${extraInfo ? `PERSONAL DETAILS about ${childName} to weave in naturally: ${extraInfo}` : ''}

STRUCTURE:
1. A vivid, exciting opening — drop us straight into ${childName}'s world
2. A challenge or discovery that relates to ${lesson}
3. The Bearded Scientist appears briefly — one enthusiastic paragraph of encouragement and a key insight
4. ${childName} applies the lesson and triumphs
5. A heartwarming, empowering ending where ${childName} feels brilliant

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:
Line 1: [Story title only — creative, fun, no "Title:" prefix]
[blank line]
[Story text]
[blank line]
⚡ THE BEARDED SCIENTIST'S SCIENCE SPARK ⚡
[2–3 sentences: a real, fascinating fact connecting the story's themes to science, psychology, or the natural world. Enthusiastic Bearded Scientist voice.]

Make ${childName} feel like the most remarkable person in the entire universe. Because they are.`;

  const userMessage = `Write a personalised story for ${childName}, age ${age}, who loves ${hobby}. The story should naturally explore the theme of "${lesson}". Make it magical, age-appropriate, and deeply personal.`;

  // Set up Server-Sent Events for streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  try {
    const stream = client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 1500,
      thinking: { type: 'adaptive' },
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Story generation error:', err.message);
    res.write(`data: ${JSON.stringify({ error: 'Something went wrong generating the story. Please try again!' })}\n\n`);
    res.end();
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', character: 'The Bearded Scientist' }));

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🧪 The Bearded Scientist Story Generator is LIVE on http://localhost:${PORT}`);
  console.log(`🔬 EXTRAORDINARY! Let the stories begin!`);
});
