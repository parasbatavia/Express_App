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

// Step 1: Initiate Google OAuth flow
app.get('/auth', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/business.manage'],
    redirect_uri: process.env.REDIRECT_URI
  });
  res.redirect(url);
});

// Step 2: Handle OAuth callback and fetch Google Business data
app.get('/oauth/callback', async (req, res) => {
  const { code } = req.query;

  const tempOauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
  );

  try {
    // Exchange code for tokens
    const { tokens } = await tempOauth2Client.getToken({
      code,
      redirect_uri: process.env.REDIRECT_URI
    });
    tempOauth2Client.setCredentials(tokens);

    // Step 3: List business accounts
    const businessInfo = google.mybusinessbusinessinformation({ version: 'v1', auth: tempOauth2Client });
    const accountsRes = await businessInfo.accounts.list();
    const account = accountsRes.data.accounts && accountsRes.data.accounts[0];
    if (!account) {
      return res.status(404).send('No Google Business account found for this user.');
    }

    // Step 4: List locations under the account
    const locationsRes = await businessInfo.accounts.locations.list({ parent: account.name });
    const locations = locationsRes.data.locations;
    if (!locations || locations.length === 0) {
      return res.status(404).send('No locations found for this account.');
    }

    const locationName = locations[0].name; // e.g., 'locations/987654321'
    const locationId = locationName;

    // Step 5: Fetch reviews for the location (using My Business API v4)
    const myBusiness = google.mybusiness({ version: 'v4', auth: tempOauth2Client });
    const reviewsRes = await myBusiness.accounts.locations.reviews.list({ parent: locationName });
    const reviews = reviewsRes.data.reviews || [];

    // Step 6: Respond with account, location, and reviews
    res.json({
      account: account.name,
      location: locationId,
      reviews: reviews
    });
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
    res.status(500).send('Error retrieving Google Business data');
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
