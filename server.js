const express = require('express');
require('dotenv').config();
const { google } = require('googleapis');
const session = require('express-session'); // For session management (OAuth state, token storage)
const crypto = require('crypto');         // For generating random state string
const helmet = require('helmet');           // For security headers

// --- Environment Variable Check ---
const requiredEnvVars = ['CLIENT_ID', 'CLIENT_SECRET', 'REDIRECT_URI', 'SESSION_SECRET'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Error: Missing required environment variable ${envVar}. Please check your .env file.`);
    process.exit(1); // Exit if critical env vars are missing
  }
}

const app = express();

// --- Middleware ---
app.use(helmet()); // Apply basic security headers

// Configure session middleware
// In a production environment, you'd typically use a more robust session store like connect-redis or connect-mongo.
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true, // Set to false if you want to explicitly save sessions
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (requires HTTPS)
    httpOnly: true, // Helps prevent XSS
    maxAge: 24 * 60 * 60 * 1000 // Example: 1 day session expiry
  }
}));

// --- Google OAuth2 Client Setup ---
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// === /auth route: Initiate OAuth flow ===
app.get('/auth', (req, res) => {
  // Generate a random string for the state parameter for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');
  req.session.oauthState = state; // Store state in session to verify in callback

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Request a refresh token
    prompt: 'consent',      // Ensure user is prompted for consent, useful for getting refresh token on subsequent auths
    scope: ['https://www.googleapis.com/auth/business.manage'], // Define necessary scopes
    redirect_uri: process.env.REDIRECT_URI,
    state: state            // Pass the state parameter
  });
  res.redirect(authUrl);
});

// === /oauth/callback route: Handle Google's redirect ===
app.get('/oauth/callback', async (req, res) => {
  const { code, state } = req.query;

  // 1. Validate state parameter to prevent CSRF
  if (!state || state !== req.session.oauthState) {
    console.error('Invalid OAuth state:', { queryState: state, sessionState: req.session.oauthState });
    req.session.destroy(); // Clear potentially compromised session
    return res.status(403).json({ error: 'Invalid state parameter. Possible CSRF attack.' });
  }
  // Clear the state from session as it's now used
  delete req.session.oauthState;

  // 2. Check for authorization code
  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code parameter.' });
  }

  try {
    // 3. Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken({
      code,
      redirect_uri: process.env.REDIRECT_URI
    });

    // IMPORTANT: Securely store tokens.
    // For this example, storing in session. For production, a secure database is recommended for refresh tokens.
    // Access tokens are short-lived. Refresh tokens are long-lived and sensitive.
    req.session.googleTokens = tokens;
    oauth2Client.setCredentials(tokens); // Set credentials for current client instance for immediate use

    // 4. (Optional) Fetch user info or perform initial API call
    const myBusiness = google.mybusiness({ version: 'v4', auth: oauth2Client }); // Note: Check for latest API versions
    const accountsResponse = await myBusiness.accounts.list();
    const accounts = accountsResponse.data.accounts || [];

    // Redirect to a success page or send a success response
    // res.redirect('/profile'); // Example redirect
    res.json({
      message: 'Authentication successful!',
      access_token_expires_in: tokens.expiry_date, // Let client know when access token expires
      // Avoid sending refresh_token to client unless absolutely necessary and handled securely
      accounts: accounts.map(acc => ({ name: acc.name, accountName: acc.accountName, type: acc.type })) // Send relevant account info
    });

  } catch (err) {
    console.error('OAuth Callback Error or Google API Error:', err.response?.data || err.message, err.stack);
    // Provide a generic error message to the client for security
    res.status(500).json({ error: 'Authentication failed due to an internal server error.' });
  }
});

// === Example Protected Route: /my-accounts ===
app.get('/my-accounts', async (req, res) => {
  if (!req.session.googleTokens) {
    return res.status(401).json({ error: 'Unauthorized. Please authenticate via /auth.' });
  }

  // Create a new OAuth2 client instance for this request or ensure the global one has credentials.
  // If you have multiple users, you'd fetch the specific user's tokens from your secure store.
  const clientForRequest = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
  );
  clientForRequest.setCredentials(req.session.googleTokens);

  // Handle potential token refresh if the googleapis library doesn't do it automatically
  // or if credentials are stale. The library often handles this if a refresh token is present.
  clientForRequest.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
      // Store the new refresh token if you got one
      console.log("Received a new refresh token.");
      req.session.googleTokens.refresh_token = tokens.refresh_token;
    }
    // Update the access token in session
    req.session.googleTokens.access_token = tokens.access_token;
    req.session.googleTokens.expiry_date = tokens.expiry_date;
    console.log("Access token refreshed.");
  });


  try {
    const myBusiness = google.mybusiness({ version: 'v4', auth: clientForRequest });
    const accountsResponse = await myBusiness.accounts.list();
    const accounts = accountsResponse.data.accounts || [];
    res.json({
        message: "Successfully fetched accounts.",
        accounts: accounts.map(acc => ({ name: acc.name, accountName: acc.accountName, type: acc.type }))
    });
  } catch (err) {
    console.error('Error fetching accounts:', err.response?.data || err.message, err.stack);
    if (err.response?.status === 401 || err.message.toLowerCase().includes('token') || err.message.toLowerCase().includes('expired')) {
        // Token might have expired or been revoked
        delete req.session.googleTokens; // Clear invalid tokens
        return res.status(401).json({ error: 'Authentication token is invalid or expired. Please re-authenticate via /auth.' });
    }
    res.status(500).json({ error: 'Failed to fetch accounts due to an internal server error.' });
  }
});

// === /logout route (Example) ===
app.get('/logout', (req, res) => {
  // Optionally, revoke the token with Google if you have a refresh token
  // if (req.session.googleTokens && req.session.googleTokens.refresh_token) {
  //   oauth2Client.revokeToken(req.session.googleTokens.refresh_token, (err, body) => {
  //     if (err) {
  //       console.error("Error revoking token:", err);
  //     } else {
  //       console.log("Token revoked.");
  //     }
  //   });
  // } // Revoking might not be necessary for all app types / if you want to allow re-auth without full consent.

  req.session.destroy(err => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.status(500).json({ error: 'Failed to logout.' });
    }
    res.clearCookie('connect.sid'); // Default session cookie name, adjust if different
    res.json({ message: 'Successfully logged out.' });
  });
});


// --- Server Listening ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}.`);
  console.log(`Visit http://localhost:${PORT}/auth to authenticate with Google.`);
});
