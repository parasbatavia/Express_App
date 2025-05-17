const express = require('express');
const axios = require('axios');
const qs = require('qs');
const { OpenAI } = require('openai');
const { google } = require('googleapis');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;

// GPT-4 setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Google Sheets API setup
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

// ✅ Root test
app.get('/', (req, res) => {
  res.send('API is live at LabhSoftware!');
});

// ✅ GPT review reply
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

// ✅ Process new reviews
app.get('/gmb/process-new', async (req, res) => {
  const access_token = process.env.GOOGLE_ACCESS_TOKEN;
  const accountId = process.env.GMB_ACCOUNT_ID;
  const locationId = process.env.GMB_LOCATION_ID;

  try {
    const reviewRes = await axios.get(
      `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews`,
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
        `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews/${reviewId}/reply`,
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

    res.send(`✅ Processed ${replyCount} new reviews.`);
  } catch (err) {
    console.error("🚨 Error processing reviews:", err?.response?.data || err.message);
    res.status(500).send("Failed to process new reviews.");
  }
});

// ✅ OAuth login route
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

// ✅ OAuth callback
app.get('/oauth/callback', async (req, res) => {
  const { code } = req.query;
  const client_id = process.env.GOOGLE_CLIENT_ID;
  const client_secret = process.env.GOOGLE_CLIENT_SECRET;
  const redirect_uri = "https://api.labhsoftware.com/oauth/callback";

  if (!code) return res.status(400).send('Missing auth code.');

  try {
    const tokenResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      qs.stringify({
        code,
        client_id,
        client_secret,
        redirect_uri,
        grant_type: 'authorization_code',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, refresh_token } = tokenResponse.data;

    console.log("✅ Access Token:", access_token);
    console.log("🔁 Refresh Token:", refresh_token);

    res.send("✅ Google authorization successful. You're ready to fetch reviews!");
  } catch (error) {
    console.error("OAuth callback error:", error.response?.data || error.message);
    res.status(500).send("Failed to exchange code for tokens.");
  }
});

// ✅ Start server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
