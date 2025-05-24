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

    // Use the correct Google My Business API for accounts
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

    // Retrieve Google My Business account info
    const businessInfo = google.mybusinessbusinessinformation({ version: 'v1', auth: oauth2Client });
    // This is the correct way to list accounts (per Google API docs)
    const accountsRes = await businessInfo.accounts.list();
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
