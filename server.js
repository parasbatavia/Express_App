const express = require('express');
require('dotenv').config();
const { google } = require('googleapis');

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
    redirect_uri: process.env.REDIRECT_URI
  });
  res.redirect(url);
});

// === /oauth/callback route ===
app.get('/oauth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ error: 'Missing code parameter' });
  }

  try {
    const { tokens } = await oauth2Client.getToken({
      code,
      redirect_uri: process.env.REDIRECT_URI
    });
    oauth2Client.setCredentials(tokens);

    const myBusiness = google.mybusiness({ version: 'v4', auth: oauth2Client });
    const accountsRes = await myBusiness.accounts.list();
    const accounts = accountsRes.data.accounts || [];

    res.json({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      accounts: accounts
    });
  } catch (err) {
    console.error('OAuth or Google API Error:', err.response?.data || err.message);
    res.status(500).json({ error: 'OAuth failed', details: err.response?.data || err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
