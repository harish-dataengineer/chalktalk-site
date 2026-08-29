// ============================================================================
// ChalkTalk Chat Backend — Vercel Serverless Function
// Deploy this at:  /api/chat.js  in a Vercel project (Vercel auto-detects it)
//
// WHY THIS FILE EXISTS:
// Your API key must NEVER appear in chat-widget.js or any file the browser
// downloads — anyone could open dev tools, copy it, and run up your bill.
// This file runs on Vercel's servers, not in the student's browser, so the
// key stays hidden. The widget calls THIS file; this file calls Anthropic.
//
// SETUP STEPS:
// 1. Create a free account at https://vercel.com and install the Vercel CLI,
//    or just connect your GitHub repo to Vercel (no CLI needed).
// 2. Put this file at:  your-project/api/chat.js
// 3. In Vercel's dashboard → Project → Settings → Environment Variables, add:
//      ANTHROPIC_API_KEY = sk-ant-xxxxxxxxxxxxxxxx
//    (get this key from https://console.anthropic.com/ after creating an
//    Anthropic account — you'll need billing set up there since API usage
//    is paid, separate from the free claude.ai chat app.)
// 4. Deploy. Vercel automatically makes this file live at yoursite.com/api/chat
// ============================================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing messages array' });
  }

  // Keep only the last 10 messages to control cost — a doubt-solving widget
  // doesn't need unlimited history, and this caps how much you pay per chat.
  const trimmedHistory = messages.slice(-10);

  const SYSTEM_PROMPT = `You are the ChalkTalk study assistant, helping CSE engineering
students understand subjects like DBMS, Data Structures & Algorithms, Java/OOP,
Software Engineering, and Discrete Mathematics.

Rules for how you answer:
- ALWAYS explain the idea in the simplest possible everyday language first —
  as if explaining to a curious 10-year-old, using a relatable comparison.
- THEN give the "exam language" version — the proper technical definition,
  since the student needs this to actually write in their exam.
- Keep answers short and focused — this is a chat widget, not an essay.
  Roughly 4-8 sentences total unless the student asks for more detail.
- If asked something completely unrelated to their coursework, gently steer
  back: "I'm best at helping with your CSE subjects — ask me about DBMS, DSA,
  Java, Software Engineering, or Discrete Maths!"
- Never claim to be a human. If asked, say you're ChalkTalk's AI study buddy.
- Do not help with anything unrelated to academics (no general chit-chat
  tasks, no unrelated coding help outside the syllabus, no personal advice).`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: trimmedHistory
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', errText);
      return res.status(502).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const replyBlock = data.content.find(block => block.type === 'text');
    const reply = replyBlock ? replyBlock.text : "I couldn't generate a reply — try rephrasing your question.";

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Chat handler error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
