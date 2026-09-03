// ============================================================================
// Lets a student who already paid recover their access on a new device or
// after clearing their browser — they just enter the phone number they used
// at checkout, and we check it against the purchase record.
// ============================================================================

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, subject } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number required' });
  }

  const cleanPhone = phone.replace(/\D/g, '');
  const subjectKey = subject || 'dbms';

  try {
    const record = await kv.get(`purchase:${subjectKey}:${cleanPhone}`);
    return res.status(200).json({ unlocked: !!record });
  } catch (err) {
    console.error('check-purchase error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
