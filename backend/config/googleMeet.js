const jwt = require('jsonwebtoken');
const crypto = require('crypto');

async function getAccessToken() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) {
    throw new Error('Google Meet credentials are not configured.');
  }
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/calendar.events',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };
  const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });
  const params = new URLSearchParams();
  params.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  params.append('assertion', token);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || 'Failed to acquire access token');
  }
  return data.access_token;
}

async function createGoogleMeet(summary, startTime) {
  // If Google credentials are missing, fall back to a dummy meeting link
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) {
    // Generate a pseudo meeting link so scheduling still works in development
    return {
      id: crypto.randomUUID(),
      meetLink: `https://meet.google.com/${crypto.randomBytes(3).toString('hex')}`
    };
  }

  const accessToken = await getAccessToken();
  const startISO = new Date(startTime).toISOString();
  const endISO = new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString();
  const event = {
    summary,
    start: { dateTime: startISO },
    end: { dateTime: endISO },
    conferenceData: {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: 'hangoutsMeet' }
      }
    }
  };
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(event)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to create meeting');
  }
  return { id: data.id, meetLink: data.hangoutLink };
}

module.exports = { createGoogleMeet };
