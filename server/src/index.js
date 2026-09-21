require('dotenv').config();
const express = require('express');
const cors = require('cors');
const store = require('./store');
const apiRoutes = require('./routes/api');

const app = express();

// CORS allow-list from ALLOWED_ORIGINS (comma-separated). Unset or empty keeps
// the permissive development behaviour. Requests without an Origin header
// (health checks, curl, server-to-server) are always allowed.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

app.use(cors(allowedOrigins.length === 0 ? undefined : {
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.includes(origin));
  },
}));
app.use(express.json());

// Liveness/readiness probe for Render and the keep-alive pinger. Sits outside
// /api so the 503-until-ready guard below does not apply to it.
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', ready: store.state.ready });
});

// Block requests until the in-memory data has finished loading
app.use('/api', (req, res, next) => {
  if (!store.state.ready) {
    return res.status(503).json({ error: 'Data still loading, try again in a moment.' });
  }
  next();
});

app.use('/api', apiRoutes);
app.get('/', (req, res) => res.json({ status: 'SynerGuard API running', ready: store.state.ready }));

const PORT = process.env.PORT || 5000;

// Load data first, then start listening
store.load()
  .then(() => {
    app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to load data:', err);
    process.exit(1);
  });
