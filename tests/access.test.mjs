// Access-rule checks against the real Supabase project.
// Creates two throwaway accounts, proves one cannot reach the other's data, then deletes both.
// Run: node --env-file=.env.local tests/access.test.mjs
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';

const { SUPABASE_URL, SUPABASE_KEY } = process.env;
const client = () => createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const stamp = Date.now();
let passed = 0;
const check = (name, fn) => fn().then(() => { passed++; console.log('ok   ' + name); }, (e) => { console.log('FAIL ' + name + ': ' + e.message); process.exitCode = 1; });

async function account(tag) {
  const c = client();
  const email = `access-test-${tag}-${stamp}@example.com`;
  const { data, error } = await c.auth.signUp({ email, password: `Pw-${stamp}-${tag}!x`, options: { data: { full_name: `Test ${tag}` } } });
  if (error) throw error;
  return { c, id: data.user.id, email };
}

const anon = client();
const a = await account('a');
const b = await account('b');
const studyId = crypto.randomUUID();
let postId = crypto.randomUUID();

try {
  await check('A can save a study', async () => {
    const { error } = await a.c.from('studies').insert({ id: studyId, user_id: a.id, sermon_title: 'Access test', days: [{ day: 1 }] });
    assert.equal(error, null);
  });
  await check('B cannot read A\'s study', async () => {
    const { data } = await b.c.from('studies').select('id').eq('id', studyId);
    assert.equal(data.length, 0);
  });
  await check('signed-out visitor cannot read studies, profiles or posts', async () => {
    for (const t of ['studies', 'profiles', 'posts', 'comments', 'study_participants', 'waitlist']) {
      const { data } = await anon.from(t).select('*').limit(1);
      assert.ok(!data || data.length === 0, `${t} readable`);
    }
  });
  await check('profiles carry no email', async () => {
    const { data } = await b.c.from('profiles').select('*').eq('id', a.id).single();
    assert.ok(data && !('email' in data));
  });
  await check('B can open the study through its share id, then join', async () => {
    const { data } = await b.c.rpc('get_shared_study', { p_study: studyId });
    assert.equal(data.length, 1);
    const { error } = await b.c.from('study_participants').insert({ study_id: studyId, user_id: b.id, user_name: 'Test b' });
    assert.equal(error, null);
    const { data: rows } = await b.c.from('studies').select('id').eq('id', studyId);
    assert.equal(rows.length, 1);
  });
  await check('B cannot change or delete A\'s study', async () => {
    await b.c.from('studies').update({ sermon_title: 'hacked' }).eq('id', studyId);
    await b.c.from('studies').delete().eq('id', studyId);
    const { data } = await a.c.from('studies').select('sermon_title').eq('id', studyId).single();
    assert.equal(data.sermon_title, 'Access test');
  });
  await check('B cannot record progress as A', async () => {
    const { error } = await b.c.from('study_day_progress').insert({ study_id: studyId, user_id: a.id, day_number: 1 });
    assert.ok(error);
  });
  await check('B cannot edit A\'s profile or write a friends list directly', async () => {
    await b.c.from('profiles').update({ name: 'hacked' }).eq('id', a.id);
    const { error } = await b.c.from('profiles').update({ friends: [a.id] }).eq('id', b.id);
    assert.ok(error, 'direct friends write allowed');
    const { data } = await a.c.from('profiles').select('name').eq('id', a.id).single();
    assert.equal(data.name, 'Test a');
  });
  await check('adding a friend updates both sides', async () => {
    const { data, error } = await b.c.rpc('toggle_friend', { p_target: a.id });
    assert.equal(error, null);
    assert.ok(data.includes(a.id));
    const { data: pa } = await a.c.from('profiles').select('friends').eq('id', a.id).single();
    assert.ok(pa.friends.includes(b.id));
  });
  await check('A posts; B can like it but cannot rewrite it', async () => {
    const { error } = await a.c.from('posts').insert({ id: postId, user_id: a.id, user_name: 'Test a', content: 'hello', type: 'testimony' });
    assert.equal(error, null);
    const { data: likes } = await b.c.rpc('toggle_like', { p_post: postId });
    assert.equal(likes, 1);
    await b.c.from('posts').update({ content: 'hacked' }).eq('id', postId);
    const { data } = await a.c.from('posts').select('content, likes').eq('id', postId).single();
    assert.deepEqual(data, { content: 'hello', likes: 1 });
  });
  await check('B can report the post but cannot read reports', async () => {
    const { error } = await b.c.from('content_reports').insert({ reporter_id: b.id, target_type: 'post', target_id: postId, target_user_id: a.id, reason: 'test' });
    assert.equal(error, null);
    const { data } = await b.c.from('content_reports').select('*');
    assert.ok(!data || data.length === 0);
  });
  await check('after B blocks A, neither sees the other\'s posts and the friendship is gone', async () => {
    const { error } = await b.c.rpc('block_user', { p_target: a.id });
    assert.equal(error, null);
    const { data } = await b.c.from('posts').select('id').eq('id', postId);
    assert.equal(data.length, 0);
    const { data: pa } = await a.c.from('profiles').select('friends').eq('id', a.id).single();
    assert.ok(!pa.friends.includes(b.id));
  });
  await check('audio storage is private to its owner', async () => {
    const path = `${a.id}/test.txt`;
    const up = await a.c.storage.from('sermon-audio').upload(path, new Blob(['x']), { upsert: true });
    assert.equal(up.error, null);
    const dl = await b.c.storage.from('sermon-audio').download(path);
    assert.ok(dl.error, 'B downloaded A\'s file');
    const bad = await b.c.storage.from('sermon-audio').upload(`${a.id}/b.txt`, new Blob(['x']));
    assert.ok(bad.error, 'B wrote into A\'s folder');
    await a.c.storage.from('sermon-audio').remove([path]);
  });
} finally {
  await check('accounts delete themselves and their data', async () => {
    for (const u of [a, b]) { const { error } = await u.c.rpc('delete_my_account'); assert.equal(error, null); }
    const c = client();
    const { error } = await c.auth.signInWithPassword({ email: a.email, password: `Pw-${stamp}-a!x` });
    assert.ok(error, 'deleted account can still sign in');
  });
}
console.log(`${passed} checks passed${process.exitCode ? ', with failures' : ''}`);
