// server-2.js
const express = require('express');
const axios = require('axios');
const qs = require('qs');
const { OpenAI } = require('openai');

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const port = process.env.PORT || 3000;

// ✅ Root endpoint
app.get('/', (req, res) => {
  res.send('API is live at LabhSoftware!');
});

// ✅ Smart reply generator endpoint
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
          content: 'You are a kind Indian business owner replying to Google reviews for Labh Software. Be short, professional, and grateful.'
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

// ✅ OAuth Login - Redirect to Google
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

// ✅ OAuth Callback - Handle the code and get tokens
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

// ✅ Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
