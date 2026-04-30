// Shared Notion logging utility for voice AI calls.
// Posts a new row to the Notion database for each call.
// Fails silently if Notion isn't configured - never blocks the actual call response.

export async function logToNotion({ type, name, email, spaName, time, notes, status, source }) {
  const notionToken = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!notionToken || !databaseId) {
    console.log('Notion not configured, skipping log:', { type, name, email });
    return { logged: false, reason: 'not_configured' };
  }

  try {
    // Build properties object based on what's provided
    const properties = {
      // Title field - required for every Notion page
      'Name': {
        title: [
          {
            text: {
              content: name || email || 'Unknown caller'
            }
          }
        ]
      },
      'Type': {
        select: {
          name: type === 'booking' ? 'Demo Booked' : 'Lead Captured'
        }
      },
      'Status': {
        select: {
          name: status || 'New'
        }
      },
      'Source': {
        select: {
          name: source || 'Voice AI'
        }
      },
      'Created': {
        date: {
          start: new Date().toISOString()
        }
      }
    };

    if (email) {
      properties['Email'] = { email: email };
    }
    if (spaName) {
      properties['Med Spa'] = {
        rich_text: [{ text: { content: spaName } }]
      };
    }
    if (time) {
      properties['Demo Time'] = {
        rich_text: [{ text: { content: time } }]
      };
    }
    if (notes) {
      properties['Notes'] = {
        rich_text: [{ text: { content: notes.slice(0, 1900) } }] // Notion has a 2000 char limit
      };
    }

    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: properties
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Notion logging failed:', response.status, errorData);
      return { logged: false, reason: 'api_error', error: errorData };
    }

    const data = await response.json();
    return { logged: true, pageId: data.id };
  } catch (err) {
    console.error('Notion logging exception:', err);
    return { logged: false, reason: 'exception', error: err.message };
  }
}
