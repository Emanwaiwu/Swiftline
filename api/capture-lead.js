import { Resend } from 'resend';
import { logToNotion } from './_lib/notion.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const args = body.args || body;

  const { name, email, spa_name, summary } = args;

  if (!email) {
    return res.status(200).json({
      success: false,
      message: 'Need at least an email to capture a lead. Ask the caller for their email.'
    });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.LEAD_FROM_EMAIL;
  const toEmail = process.env.LEAD_NOTIFICATION_EMAIL;

  if (!resendKey || !fromEmail || !toEmail) {
    console.log('LEAD CAPTURED (Resend not configured):', { name, email, spa_name, summary });
    // Still try to log to Notion since Resend is the only thing missing
    await logToNotion({
      type: 'lead',
      name,
      email,
      spaName: spa_name,
      notes: summary,
      status: 'New',
      source: 'Voice AI'
    });
    return res.status(200).json({
      success: true,
      message: 'Got it. Tell the caller Eman will reach out.'
    });
  }

  try {
    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: `Swiftline AI <${fromEmail}>`,
      to: [toEmail],
      replyTo: email,
      subject: `📞 Voice AI lead${spa_name ? ': ' + spa_name : ''}`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #0E1413;">
          <h2 style="font-family: Georgia, serif; font-weight: 400; font-size: 24px; margin: 0 0 8px;">Lead from voice AI call</h2>
          <p style="color: #4A5D4F; font-size: 14px; margin: 0 0 24px;">Caller didn't book a demo but left their info. ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT</p>

          <table style="width: 100%; border-collapse: collapse;">
            ${name ? `<tr><td style="padding: 12px 0; border-bottom: 1px solid #EBE4D6; color: #4A5D4F; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Name</td><td style="padding: 12px 0; border-bottom: 1px solid #EBE4D6; text-align: right;">${escapeHtml(name)}</td></tr>` : ''}
            <tr><td style="padding: 12px 0; border-bottom: 1px solid #EBE4D6; color: #4A5D4F; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Email</td><td style="padding: 12px 0; border-bottom: 1px solid #EBE4D6; text-align: right;"><a href="mailto:${escapeHtml(email)}" style="color: #B8954E;">${escapeHtml(email)}</a></td></tr>
            ${spa_name ? `<tr><td style="padding: 12px 0; border-bottom: 1px solid #EBE4D6; color: #4A5D4F; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Med spa</td><td style="padding: 12px 0; border-bottom: 1px solid #EBE4D6; text-align: right;">${escapeHtml(spa_name)}</td></tr>` : ''}
          </table>

          ${summary ? `<div style="background: #F4EFE6; padding: 16px 20px; border-radius: 8px; margin-top: 16px;"><div style="color: #4A5D4F; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Conversation summary</div><div style="font-size: 15px; line-height: 1.55; white-space: pre-wrap;">${escapeHtml(summary)}</div></div>` : ''}

          <p style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #EBE4D6; color: #4A5D4F; font-size: 12px;">Reply to this email to reach out to ${escapeHtml(name || 'them')}.</p>
        </div>
      `,
      text: `Lead from voice AI call\n\n${name ? `Name: ${name}\n` : ''}Email: ${email}\n${spa_name ? `Med spa: ${spa_name}\n` : ''}${summary ? `\nConversation summary:\n${summary}` : ''}`
    });

    // Log to Notion (fails silently if not configured)
    await logToNotion({
      type: 'lead',
      name,
      email,
      spaName: spa_name,
      notes: summary,
      status: 'New',
      source: 'Voice AI'
    });

    return res.status(200).json({
      success: true,
      message: 'Lead captured. Tell the caller Eman will reach out within a day.'
    });
  } catch (err) {
    console.error('Lead capture error:', err);
    return res.status(200).json({
      success: false,
      message: 'Tell the caller to email eman@getswiftline.com directly.'
    });
  }
}