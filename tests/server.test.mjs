// Server checks. Needs the server running: PORT=8080 node --env-file=.env.local server.js
// Run: node --env-file=.env.local tests/server.test.mjs
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';

const BASE = process.env.TEST_SERVER || 'http://localhost:8080';
const c = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, { auth: { persistSession: false } });
const stamp = Date.now();
const { data, error } = await c.auth.signUp({ email: `server-test-${stamp}@example.com`, password: `Pw-${stamp}!x` });
if (error) throw error;
const token = data.session.access_token;
const call = (path, { body, auth = token, origin } = {}) => fetch(BASE + path, {
  method: body ? 'POST' : 'GET',
  headers: { ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(origin ? { Origin: origin } : {}) },
  body: body ? JSON.stringify(body) : undefined,
});
let passed = 0;
const check = async (name, fn) => { try { await fn(); passed++; console.log('ok   ' + name); } catch (e) { console.log('FAIL ' + name + ': ' + e.message); process.exitCode = 1; } };

try {
  await check('health responds', async () => { const r = await call('/api/health', { auth: null }); assert.equal(r.status, 200); assert.equal((await r.json()).ok, true); });
  await check('every AI route refuses a caller with no sign-in', async () => {
    for (const [p, body] of [['/api/studies/generate', { text: 'x' }], ['/api/bulletins/process', { images: [] }], ['/api/church/search', { query: 'x' }], ['/api/transcript?url=https://youtu.be/x', null]]) {
      assert.equal((await call(p, { body, auth: null })).status, 401, p);
    }
  });
  await check('a made-up token is refused', async () => { assert.equal((await call('/api/church/search', { body: { query: 'x' }, auth: 'not-a-token' })).status, 401); });
  await check('empty study request is rejected before any AI call', async () => { const r = await call('/api/studies/generate', { body: {} }); assert.equal(r.status, 400); });
  await check('non-YouTube link is rejected', async () => { const r = await call('/api/studies/generate', { body: { youtubeUrl: 'https://example.com/v' } }); assert.equal(r.status, 400); });
  await check("another user's audio path is rejected", async () => { const r = await call('/api/studies/generate', { body: { audioPath: '00000000-0000-0000-0000-000000000000/a.aac' } }); assert.equal(r.status, 400); });
  await check('the phone app origin is allowed, an unknown site is not', async () => {
    const ok = await call('/api/health', { auth: null, origin: 'capacitor://localhost' });
    assert.equal(ok.headers.get('access-control-allow-origin'), 'capacitor://localhost');
    const bad = await call('/api/health', { auth: null, origin: 'https://evil.example' });
    assert.equal(bad.headers.get('access-control-allow-origin'), null);
  });
  await check('unknown API path returns JSON 404, not the web page', async () => { const r = await call('/api/nope'); assert.equal(r.status, 404); });
  await check('the web app is served', async () => { const r = await call('/', { auth: null }); assert.equal(r.status, 200); assert.match(await r.text(), /<div id="root">/); });
  if (process.env.TEST_AI === '1') {
    await check('a study is generated from pasted text', async () => {
      const r = await call('/api/studies/generate', { body: { text: 'Sermon on John 15:1-11. Jesus is the true vine. Abide in him. The Father prunes fruitful branches. Joy made full.', settings: { studyDuration: 5, studyLength: '5 mins', supportingReferencesCount: 2 } } });
      const j = await r.json();
      assert.equal(r.status, 200, JSON.stringify(j));
      assert.equal(j.days.length, 5);
      assert.equal(j.days[0].supportingScriptures.length, 2);
    });
  }
} finally {
  await c.rpc('delete_my_account');
}
console.log(`${passed} checks passed${process.exitCode ? ', with failures' : ''}`);
