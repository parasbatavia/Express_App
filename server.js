const express = require('express');
const dotenv = require('dotenv');
const { google } = require('googleapis');

dotenv.config();
const app = express();

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// === /auth route ===
app.get('/auth', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/business.manage']
  });
  res.redirect(url);
});

// === /oauth/callback route ===
app.get('/oauth/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('✅ ACCESS TOKEN:', tokens.access_token);
    console.log('🔁 REFRESH TOKEN:', tokens.refresh_token);
    res.send('✅ Auth Success! Check Render logs for tokens.');
  } catch (error) {
    console.error('❌ Error exchanging code:', error.response?.data || error.message);
    res.status(500).send('OAuth failed');
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
