import { Resend } from 'resend';

// Helper: parse a natural-language time into a Cal.com slot
// Retell will pass us something like "tomorrow at 2pm" - we need ISO 8601 UTC
// We'll let the LLM resolve this and pass us actual ISO dates instead.

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

  // Retell sends the function args inside an "args" object
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const args = body.args || body;

  const { name, email, preferred_time_iso, notes } = args;

  if (!name || !email || !preferred_time_iso) {
    return res.status(200).json({
      success: false,
      message: 'Missing required info. Ask the caller for their name, email, and preferred time.'
    });
  }

  const calApiKey = process.env.CAL_API_KEY;
  const eventTypeSlug = process.env.CAL_EVENT_TYPE_SLUG || '15min';
  const calUsername = process.env.CAL_USERNAME || 'eman-swiftline';
  const fromEmail = process.env.LEAD_FROM_EMAIL;
  const toEmail = process.env.LEAD_NOTIFICATION_EMAIL;

  if (!calApiKey) {
    console.error('CAL_API_KEY not configured');
    return res.status(200).json({
      success: false,
      message: 'Calendar system temporarily unavailable. Please ask the caller to book at getswiftline.com instead.'
    });
  }

  try {
    // Create the Cal.com booking
    const calResponse = await fetch('https://api.cal.com/v2/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${calApiKey}`,
        'cal-api-version': '2024-08-13'
      },
      body: JSON.stringify({
        start: preferred_time_iso,
        eventTypeSlug: eventTypeSlug,
        username: calUsername,
        attendee: {
          name: name,
          email: email,
          timeZone: 'America/Los_Angeles',
          language: 'en'
        },
        bookingFieldsResponses: notes ? { notes: notes } : undefined,
        metadata: {
          source: 'swiftline_voice_ai'
        }
      })
    });

    const calData = await calResponse.json();

    if (!calResponse.ok || calData.status === 'error') {
      console.error('Cal.com booking failed:', calData);

      // Common case: time slot not available
      const errorMessage = calData.error?.message || calData.message || 'Slot unavailable';

      return res.status(200).json({
        success: false,
        message: `That time isn't available. Try suggesting a different time or ask what works for them. Error: ${errorMessage}`
      });
    }

    // Booking succeeded - send Eman a heads-up email
    if (process.env.RESEND_API_KEY && fromEmail && toEmail) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: `Swiftline AI <${fromEmail}>`,
          to: [toEmail],
          replyTo: email,
          subject: `📞 New demo booked via voice AI: ${name}`,
          html: `
            <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #0E1413;">
              <h2 style="font-family: Georgia, serif; font-weight: 400; font-size: 24px; margin: 0 0 8px;">Demo booked via voice AI</h2>
              <p style="color: #4A5D4F; font-size: 14px; margin: 0 0 24px;">Booked by Swiftline AI agent at ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT</p>

              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 12px 0; border-bottom: 1px solid #EBE4D6; color: #4A5D4F; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Name</td><td style="padding: 12px 0; border-bottom: 1px solid #EBE4D6; text-align: right;">${escapeHtml(name)}</td></tr>
                <tr><td style="padding: 12px 0; border-bottom: 1px solid #EBE4D6; color: #4A5D4F; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Email</td><td style="padding: 12px 0; border-bottom: 1px solid #EBE4D6; text-align: right;"><a href="mailto:${escapeHtml(email)}" style="color: #B8954E;">${escapeHtml(email)}</a></td></tr>
                <tr><td style="padding: 12px 0; border-bottom: 1px solid #EBE4D6; color: #4A5D4F; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Time</td><td style="padding: 12px 0; border-bottom: 1px solid #EBE4D6; text-align: right;">${escapeHtml(preferred_time_iso)}</td></tr>
              </table>

              ${notes ? `<div style="background: #F4EFE6; padding: 16px 20px; border-radius: 8px; margin-top: 16px;"><div style="color: #4A5D4F; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Notes</div><div style="font-size: 15px; line-height: 1.55;">${escapeHtml(notes)}</div></div>` : ''}

              <p style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #EBE4D6; color: #4A5D4F; font-size: 12px;">Cal.com booking ID: ${calData.data?.uid || 'unknown'}</p>
            </div>
          `,
          text: `Demo booked via voice AI\n\nName: ${name}\nEmail: ${email}\nTime: ${preferred_time_iso}\n${notes ? `\nNotes: ${notes}` : ''}\n\nCal.com booking ID: ${calData.data?.uid || 'unknown'}`
        });
      } catch (emailErr) {
        // Don't fail the whole call if email fails
        console.error('Email notification failed:', emailErr);
      }
    }

    // Tell the agent it succeeded - this comes back to the AI mid-call
    return res.status(200).json({
      success: true,
      message: `Booked successfully for ${name} on ${preferred_time_iso}. Tell them they're locked in and a calendar invite will arrive shortly.`,
      booking_id: calData.data?.uid
    });

  } catch (err) {
    console.error('Booking error:', err);
    return res.status(200).json({
      success: false,
      message: 'Something went wrong booking. Tell the caller to book at getswiftline.com instead.'
    });
  }
}
