// ---- Waitlist -------------------------------------------------------------
// Signups go to a Supabase table (see supabase/migrations/003_waitlist.sql).
// Fill in the project URL and the anon (public) key. Until both are set the
// form tells the visitor the list is not open instead of pretending to save.
const WAITLIST = {
  supabaseUrl: '',
  supabaseAnonKey: '',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function saveEmail(email) {
  const res = await fetch(`${WAITLIST.supabaseUrl}/rest/v1/waitlist`, {
    method: 'POST',
    headers: {
      apikey: WAITLIST.supabaseAnonKey,
      Authorization: `Bearer ${WAITLIST.supabaseAnonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ email, source: 'website' }),
  });
  // 409 means the address is already on the list. That is a success for the visitor.
  if (!res.ok && res.status !== 409) throw new Error(`Waitlist save failed: ${res.status}`);
}

document.querySelectorAll('form[data-waitlist]').forEach((form) => {
  const input = form.querySelector('input[type="email"]');
  const button = form.querySelector('button');
  const msg = form.querySelector('.signup-msg');
  const say = (state, text) => { msg.dataset.state = state; msg.textContent = text; };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = input.value.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) { say('err', 'Enter a full email address, like name@example.com.'); input.focus(); return; }
    if (!WAITLIST.supabaseUrl || !WAITLIST.supabaseAnonKey) { say('err', 'The waitlist is not open yet. Please check back soon.'); return; }
    button.disabled = true;
    say('', 'Saving…');
    try {
      await saveEmail(email);
      say('ok', "You're on the list. We'll email you when the app is ready.");
      input.value = '';
    } catch (err) {
      say('err', 'That did not go through. Check your connection and try again.');
    } finally {
      button.disabled = false;
    }
  });
});

// ---- Example study in the phone ------------------------------------------
const DAYS = [
  { topic: 'The true vine', ref: 'John 15:1–2', support: ['Psalm 80:8–9', 'Isaiah 5:1–2'],
    body: "Jesus doesn't say He is like a vine. He says He is the true vine, and His Father tends it. Before this passage asks anything of you, it tells you where life comes from.",
    reflect: 'Where have you been looking for life this week besides Christ?',
    pray: 'Thank the Father that He is the one tending the vine.' },
  { topic: 'Abide in Me', ref: 'John 15:4–5', support: ['1 John 2:6', 'Colossians 2:6–7'],
    body: "A branch has one job: stay attached. It doesn't strain to make grapes. Fruit is what happens when the life of the vine runs through it.",
    reflect: 'What does staying close to Jesus look like on an ordinary Tuesday?',
    pray: 'Ask for a heart that stays near Him all day, not only in the morning.' },
  { topic: 'Pruned to bear more', ref: 'John 15:2', support: ['Hebrews 12:11', 'James 1:2–4'],
    body: "The gardener cuts back the branches that are already bearing fruit, so that they bear more. Pruning isn't punishment. It is the attention of someone who expects a harvest.",
    reflect: 'What has God been cutting back in your life? What might He be making room for?',
    pray: "Ask for trust in the Father's hand when it is uncomfortable." },
  { topic: 'Ask', ref: 'John 15:7–8', support: ['1 John 5:14', 'Psalm 37:4'],
    body: 'Jesus ties prayer to abiding. When His words live in you they shape what you want, and you begin to ask for the things the Father loves to give.',
    reflect: 'What would you ask for today if His words were shaping the request?',
    pray: 'Bring one specific request to the Father, and ask that it bring Him glory.' },
  { topic: 'Joy made full', ref: 'John 15:9–11', support: ['Nehemiah 8:10', 'Psalm 16:11'],
    body: "Jesus says why He told them all of this: so that His joy would be in them, and their joy would be full. Obedience isn't the price of His love. It is how you stay in it.",
    reflect: 'Where did you see His joy this week?',
    pray: "Thank Him for the week, and ask to carry Sunday's word into the next one." },
];

const tabs = Array.from(document.querySelectorAll('.days [role="tab"]'));
const panel = document.getElementById('day-panel');

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
}

function showDay(i, focus) {
  const d = DAYS[i];
  tabs.forEach((t, n) => {
    t.setAttribute('aria-selected', String(n === i));
    t.tabIndex = n === i ? 0 : -1;
  });
  panel.setAttribute('aria-labelledby', tabs[i].id);
  const support = el('div', 'day-support');
  d.support.forEach((s) => support.append(el('span', '', s)));
  const block = (label, text) => { const b = el('div', 'day-block'); b.append(el('b', '', label), el('p', '', text)); return b; };
  panel.replaceChildren(
    el('div', 'day-topic', d.topic), el('span', 'day-ref', d.ref), el('p', 'day-body', d.body),
    support, block('Reflect', d.reflect), block('Pray', d.pray)
  );
  panel.classList.remove('swap'); void panel.offsetWidth; panel.classList.add('swap');
  if (focus) tabs[i].focus();
}

tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => showDay(i, false));
  tab.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (step) { e.preventDefault(); showDay((i + step + tabs.length) % tabs.length, true); }
    if (e.key === 'Home') { e.preventDefault(); showDay(0, true); }
    if (e.key === 'End') { e.preventDefault(); showDay(tabs.length - 1, true); }
  });
});
