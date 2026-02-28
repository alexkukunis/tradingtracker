import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import authRouter from './server/api/auth.js';
import tradesRouter from './server/api/trades.js';
import settingsRouter from './server/api/settings.js';
import tradelockerRouter from './server/api/tradelocker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// API Routes (must be before static file serving)
app.use('/api/auth', authRouter);
app.use('/api/trades', tradesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/tradelocker', tradelockerRouter);

// Serve static files from the dist directory
app.use(express.static(join(__dirname, 'dist')));

// Handle React Router - serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
