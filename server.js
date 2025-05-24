const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Test route for Render health check
app.get('/', (req, res) => {
  res.send('Express App Running...');
});

const accountId = process.env.GMB_ACCOUNT_ID;
const locationId = process.env.GMB_LOCATION_ID;
const accessToken = process.env.GMB_ACCESS_TOKEN;

app.get('/api/pending-replies', async (req, res) => {
  try {
    if (!accountId || !locationId || !accessToken) {
      return res.status(500).json({ error: 'Missing GMB env variables' });
    }

    const url = `https://mybusiness.googleapis.com/v1/accounts/${accountId}/locations/${locationId}/reviews`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// added 23/5

const { google } = require('googleapis');
const oauth2Client = new google.auth.OAuth2(); // Set this up with your credentials

// You must have a valid access token already stored or refreshed
oauth2Client.setCredentials({
  access_token: process.env.ACCESS_TOKEN
});

app.get('/gmb/pending-replies', async (req, res) => {
  try {
    const mybusiness = google.mybusinessbusinessinformation({
      version: 'v1',
      auth: oauth2Client,
    });

    const accountId = process.env.ACCOUNT_ID;
    const locationId = process.env.LOCATION_ID;

    const reviewsResponse = await google.mybusiness(v1).accounts.locations.reviews.list({
      parent: `accounts/${accountId}/locations/${locationId}`,
      auth: oauth2Client
    });

    const reviews = reviewsResponse.data.reviews || [];

    // Filter reviews without reply
    const pending = reviews.filter(r => !r.reply);

    res.status(200).json({ pending });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch pending reviews' });
  }
});
// added 24/5
app.get('/oauth/callback', async (req, res) => {
  const { google } = require('googleapis');
  const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
  );

  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log(' ACCESS TOKEN:', tokens.access_token);
    console.log(' REFRESH TOKEN:', tokens.refresh_token);
    res.send(" Google Auth Successful! Check server logs for tokens.");
  } catch (err) {
    console.error(' OAuth Error:', err.response?.data || err.message);
    res.status(500).send("OAuth Failed");
  }
});



app.listen(PORT, () => {
  console.log(`??? Server running on port ${PORT}`);
});
