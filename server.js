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

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
