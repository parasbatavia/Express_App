const express = require('express');
const axios = require('axios');
const qs = require('qs');
const { OpenAI } = require('openai');
const { google } = require('googleapis');
require('dotenv').config();
const fs = require('fs');

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;

// GPT setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Google Sheets setup
const auth = new google.auth.GoogleAuth({
  keyFile: 'credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheetId = process.env.SHEET_ID;

async function logToSheet(dataArray) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'Sheet1!A:E',
    valueInputOption: 'RAW',
    requestBody: {
      values: [dataArray],
    },
  });
}

// Root route
app.get('/', (req, res) => {
  res.send('✅ LabhSoftware GMB API is live and ready!');
});

// GPT reply endpoint
app.post('/gmb/reply', async (req, res) => {
  const { review } = req.body;

  if (!review) {
    return res.status(400).json({ error: 'Review text is required' });
  }

  try {
    const gptResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a kind Indian business owner replying to Google reviews for Labh Software. Be short, professional, and grateful.',
        },
        {
          role: 'user',
          content: `Reply to this review: "${review}"`
        }
      ]
    });

    const reply = gptResponse.choices[0].message.content;
    res.json({ reply });
  } catch (error) {
    console.error('OpenAI error:', error);
    res.status(500).json({ error: 'Failed to generate reply' });
  }
});

// Auto-process new GMB reviews
app.get('/gmb/process-new', async (req, res) => {
  const access_token = process.env.GOOGLE_ACCESS_TOKEN;
  const accountId = process.env.GMB_ACCOUNT_ID;
  const locationId = process.env.GMB_LOCATION_ID;

  try {
    const reviewRes = await axios.get(
      `https://mybusiness.googleapis.com/v4/${accountId}/${locationId}/reviews`,
      {
        headers: { Authorization: `Bearer ${access_token}` }
      }
    );

    const reviews = reviewRes.data.reviews || [];
    let replyCount = 0;

    for (const review of reviews) {
      if (review.reviewReply) continue;

      const reviewText = review.comment;
      const reviewId = review.reviewId;

      const gptReplyRes = await axios.post(
        'https://api.labhsoftware.com/gmb/reply',
        { review: reviewText }
      );

      const aiReply = gptReplyRes.data.reply;

      await axios.put(
        `https://mybusiness.googleapis.com/v4/${accountId}/${locationId}/reviews/${reviewId}/reply`,
        { comment: aiReply },
        {
          headers: { Authorization: `Bearer ${access_token}` }
        }
      );

      await logToSheet([
        review.reviewer?.displayName || 'Anonymous',
        reviewText,
        review.createTime,
        aiReply,
        new Date().toISOString()
      ]);

      replyCount++;
    }

    res.send(`✅ Replied to ${replyCount} new reviews and logged to Google Sheet.`);
  } catch (err) {
    console.error("🚨 Error processing reviews:", err?.response?.data || err.message);
    res.status(500).send("Failed to process new reviews.");
  }
});

// Google OAuth Login
app.get('/oauth/login', (req, res) => {
  const client_id = process.env.GOOGLE_CLIENT_ID;
  const redirect_uri = "https://api.labhsoftware.com/oauth/callback";
  const scope = encodeURIComponent("https://www.googleapis.com/auth/business.manage");

  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${client_id}&redirect_uri=${redirect_uri}` +
    `&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;

  res.redirect(authUrl);
});

// Google OAuth Callback (Token visible in browser)
app.get('/oauth/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) return res.status(400).send('❌ Missing authorization code.');

  try {
    const tokenResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      qs.stringify({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: "https://api.labhsoftware.com/oauth/callback",
        grant_type: 'authorization_code'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, refresh_token } = tokenResponse.data;

    res.send(`
      <h2>✅ Google Authorization Successful!</h2>
      <p><strong>Access Token:</strong></p><code>${access_token}</code>
      <p><strong>Refresh Token:</strong></p><code>${refresh_token}</code>
      <p>👉 Copy these into your <code>.env</code> file.</p>
    `);
  } catch (err) {
    res.status(500).send(`
      <h2>❌ Failed to retrieve tokens</h2>
      <pre>${JSON.stringify(err.response?.data || err.message, null, 2)}</pre>
    `);
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Labh Software GMB API running at http://localhost:${port}`);
});
