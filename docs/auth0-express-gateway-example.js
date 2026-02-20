/**
 * Example Express API protected with Auth0 JWT (express-oauth2-jwt-bearer).
 * Uses the same audience & issuer as the FastAPI backend so tokens are interchangeable.
 *
 * Install: npm init -y && npm install express express-oauth2-jwt-bearer
 * Run: AUTH0_AUDIENCE=https://api.nivogroup.se AUTH0_ISSUER_BASE_URL=https://dev-fkrjopczcor0bjzt.us.auth0.com/ node docs/auth0-express-gateway-example.js
 */
const express = require('express');
const app = express();
const { auth } = require('express-oauth2-jwt-bearer');

const port = process.env.PORT || 8080;

const jwtCheck = auth({
  audience: process.env.AUTH0_AUDIENCE || 'https://api.nivogroup.se',
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL || 'https://dev-fkrjopczcor0bjzt.us.auth0.com/',
  tokenSigningAlg: 'RS256'
});

// Enforce JWT on all routes
app.use(jwtCheck);

app.get('/authorized', function (req, res) {
  res.json({ message: 'Secured Resource', user: req.auth?.sub });
});

app.listen(port);
console.log('Running on port', port);
