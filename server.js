import express from 'express';
import { YoutubeTranscript } from 'youtube-transcript';
import { GoogleGenAI } from '@google/genai';
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

// Church search API endpoint (uses Gemini with Google Maps grounding)
app.post('/api/church/search', async (req, res) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Search query is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Find the church matching "${query}".
    Provide the name, address, latitude, and longitude for the top matches (max 3).
    Crucial: Try to find Sunday service times from the available information and include them as an array of strings (e.g. ["9:00 AM", "11:00 AM"]). If unknown, return empty array.
    Return the response as a raw JSON array of objects.
    Each object must have these keys: "name", "address", "lat" (number), "lng" (number), "uri" (Google Maps link if available), "serviceTimes" (array of strings).
    Do not include markdown formatting.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
      }
    });

    const text = response.text;
    if (!text) return res.json([]);

    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const results = JSON.parse(cleaned);

    if (Array.isArray(results)) {
      const filtered = results.filter(r =>
        r && typeof r.name === 'string' && typeof r.lat === 'number' && typeof r.lng === 'number'
      );
      return res.json(filtered);
    }

    res.json([]);
  } catch (err) {
    console.error('Church search error:', err.message);
    res.status(500).json({ error: 'Church search failed' });
  }
});

// SPA fallback — serve index.html for navigation requests only
app.get('*', (req, res) => {
  // If the request looks like a static file (has extension), return 404
  // instead of serving index.html with wrong MIME type
  if (req.path.match(/\.\w+$/)) {
    return res.status(404).send('Not found');
  }
  // Prevent browsers from caching index.html so they always get fresh
  // asset references after deployments (hashed filenames change per build)
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
