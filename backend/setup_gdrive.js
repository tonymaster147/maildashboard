/**
 * Google Drive OAuth2 Setup Helper
 * 
 * Run this script AFTER setting GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET in .env
 * It will open a browser for you to authorize, then give you the refresh token.
 * 
 * Usage: node setup_gdrive.js
 */
const { google } = require('googleapis');
const http = require('http');
const open = require('child_process').exec;
require('dotenv').config();

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3333/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(`
╔══════════════════════════════════════════════════════════════════╗
║  ❌ Missing GOOGLE_DRIVE_CLIENT_ID or GOOGLE_DRIVE_CLIENT_SECRET ║
╚══════════════════════════════════════════════════════════════════╝

STEP 1: Go to Google Cloud Console:
   https://console.cloud.google.com/apis/credentials?project=tutoring-dashboard-storage

STEP 2: Click "+ CREATE CREDENTIALS" → "OAuth client ID"

STEP 3: If asked to configure consent screen:
   - Choose "External" user type
   - Fill in App name: "Tutoring Platform"
   - Add your email as test user
   - Save

STEP 4: For the OAuth client:
   - Application type: "Web application"
   - Name: "Tutoring Drive Upload"
   - Authorized redirect URIs: Add "http://localhost:3333/callback"
   - Click "Create"

STEP 5: Copy the Client ID and Client Secret, add to your .env:
   GOOGLE_DRIVE_CLIENT_ID=your_client_id_here
   GOOGLE_DRIVE_CLIENT_SECRET=your_client_secret_here

STEP 6: Run this script again: node setup_gdrive.js
`);
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive']
});

// Start a temporary local server to catch the callback
const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/callback')) {
    const url = new URL(req.url, 'http://localhost:3333');
    const code = url.searchParams.get('code');
    
    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h1>❌ No authorization code received</h1>');
      return;
    }

    try {
      const { tokens } = await oauth2Client.getToken(code);
      
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <h1 style="color: green;">✅ Authorization Successful!</h1>
        <p>You can close this browser tab now.</p>
        <p>Check your terminal for the refresh token.</p>
      `);

      console.log(`
╔══════════════════════════════════════════════╗
║  ✅ SUCCESS! Got your refresh token!         ║
╚══════════════════════════════════════════════╝

Add this to your .env file:

GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}

Then restart your backend server.
`);

      server.close();
      process.exit(0);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`<h1>❌ Error: ${err.message}</h1>`);
      console.error('Token exchange error:', err.message);
    }
  }
});

server.listen(3333, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  🔐 Google Drive OAuth2 Setup                               ║
╚══════════════════════════════════════════════════════════════╝

Opening browser for Google authorization...
If the browser doesn't open, visit this URL manually:

${authUrl}

Waiting for authorization...
`);

  // Try to open the browser
  const startCmd = process.platform === 'win32' ? 'start' : 'open';
  open(`${startCmd} "${authUrl}"`);
});
