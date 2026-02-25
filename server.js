import express from 'express';
import { YoutubeTranscript } from 'youtube-transcript';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Serve static frontend files with caching
app.use(express.static(join(__dirname, 'dist'), {
  maxAge: '1y',
  immutable: true,
  index: false, // handled by SPA fallback below
}));

// Transcript API endpoint
app.get('/api/transcript', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const items = await YoutubeTranscript.fetchTranscript(url);
    const transcript = items.map(item => item.text).join(' ');
    res.json({ transcript });
  } catch (err) {
    console.error('Transcript fetch error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to fetch transcript' });
  }
});

// SPA fallback — all unmatched routes serve index.html
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
