import { Resend } from 'resend';

// Simple in-memory rate limiting per IP (resets on cold start, fine for low volume)
const submissions = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 3;

function rateLimit(ip) {
  const now = Date.now();
  const record = submissions.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }

  record.count += 1;
  submissions.set(ip, record);

  return record.count <= RATE_LIMIT_MAX;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(req, res) {
  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(ip)) {
    return res.status(429).json({ error: 'Too many submissions. Please try again in a minute.' });
  }

  // Parse and validate body
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const { name, email, spaName, message, honeypot } = body || {};

  // Honeypot trap (bots fill hidden fields)
  if (honeypot) {
    // Pretend success so bots don't retry
    return res.status(200).json({ success: true });
  }

  // Required field validation
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ error: 'Please provide your name.' });
  }
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please provide a valid email.' });
  }
  if (!spaName || typeof spaName !== 'string' || spaName.trim().length < 2) {
    return res.status(400).json({ error: 'Please provide your med spa name.' });
  }

  // Length limits to prevent abuse
  if (name.length > 100 || email.length > 200 || spaName.length > 200 || (message && message.length > 2000)) {
    return res.status(400).json({ error: 'One or more fields are too long.' });
  }

  // Send via Resend
  const resendKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.LEAD_NOTIFICATION_EMAIL;
  const fromEmail = process.env.LEAD_FROM_EMAIL;

  // If env vars aren't configured yet, log and return success (so the form works during early setup)
  if (!resendKey || !toEmail || !fromEmail) {
    console.log('LEAD CAPTURED (Resend not configured):', { name, email, spaName, message });
    return res.status(200).json({ success: true });
  }

  try {
    const resend = new Resend(resendKey);

    await resend.emails.send({
      from: `Swiftline Leads <${fromEmail}>`,
      to: [toEmail],
      replyTo: email,
      subject: `New lead: ${spaName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #0E1413;">
          <h2 style="font-family: Georgia, serif; font-weight: 400; font-size: 24px; margin: 0 0 8px;">New Swiftline lead</h2>
          <p style="color: #4A5D4F; margin: 0 0 24px; font-size: 14px;">Submitted at ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'medium', timeStyle: 'short' })} PT</p>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <tr><td style="padding: 12px 0; border-bottom: 1px solid #EBE4D6; color: #4A5D4F; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Name</td><td style="padding: 12px 0; border-bottom: 1px solid #EBE4D6; text-align: right;">${escapeHtml(name)}</td></tr>
            <tr><td style="padding: 12px 0; border-bottom: 1px solid #EBE4D6; color: #4A5D4F; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Email</td><td style="padding: 12px 0; border-bottom: 1px solid #EBE4D6; text-align: right;"><a href="mailto:${escapeHtml(email)}" style="color: #B8954E;">${escapeHtml(email)}</a></td></tr>
            <tr><td style="padding: 12px 0; border-bottom: 1px solid #EBE4D6; color: #4A5D4F; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Med spa</td><td style="padding: 12px 0; border-bottom: 1px solid #EBE4D6; text-align: right;">${escapeHtml(spaName)}</td></tr>
          </table>

          ${message ? `
            <div style="background: #F4EFE6; padding: 16px 20px; border-radius: 8px; margin-top: 16px;">
              <div style="color: #4A5D4F; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Message</div>
              <div style="font-size: 15px; line-height: 1.55; white-space: pre-wrap;">${escapeHtml(message)}</div>
            </div>
          ` : ''}

          <p style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #EBE4D6; color: #4A5D4F; font-size: 12px;">Reply directly to this email to respond to ${escapeHtml(name)}.</p>
        </div>
      `,
      text: `New Swiftline lead

Name: ${name}
Email: ${email}
Med spa: ${spaName}

${message ? `Message:\n${message}\n\n` : ''}Reply to this email to respond to ${name}.`
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Resend error:', err);
    return res.status(500).json({ error: 'Could not send your message. Please try again or email us directly.' });
  }
}
