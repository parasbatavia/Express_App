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
    scope: ['https://www.googleapis.com/auth/business.manage'],
    redirect_uri: process.env.REDIRECT_URI  // ✅ this fixes it
  });
  res.redirect(url);
});


// === /oauth/callback route ===

app.get('/oauth/callback', async (req, res) => {
  const { code } = req.query;

  const { google } = require('googleapis');
  const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
  );

  try {
    const { tokens } = await oauth2Client.getToken({
      code,
      redirect_uri: process.env.REDIRECT_URI   // ✅ REQUIRED EXPLICITLY HERE
    });

    console.log('✅ ACCESS TOKEN:', tokens.access_token);
    console.log('🔁 REFRESH TOKEN:', tokens.refresh_token);

    res.send('✅ Google Auth Success! Check Render logs for tokens.');
  } catch (err) {
    console.error('❌ Token Exchange Error:', err.response?.data || err.message);
    res.status(500).send('OAuth failed');
  }
});



const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
