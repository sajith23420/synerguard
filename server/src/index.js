require('dotenv').config();
const express = require('express');
const cors = require('cors');
const store = require('./store');
const apiRoutes = require('./routes/api');

const app = express();
app.use(cors());
app.use(express.json());

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
