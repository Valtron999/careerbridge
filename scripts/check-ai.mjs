#!/usr/bin/env node
// Diagnoses the Gemini setup using the same environment variables as the app.   Usage: npm run ai:check
// It never prints your API key and sends no CV data, only tiny test prompts.
import { existsSync, readFileSync } from 'node:fs';

// Load .env.local then .env the way Next.js does (surrounding quotes are stripped, existing variables win).
for (const f of ['.env.local', '.env']) if (existsSync(f)) for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m || line.trim().startsWith('#')) continue;
  let v = m[2]; if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1); if (process.env[m[1]] === undefined) process.env[m[1]] = v;
}
const BASE = process.env.AI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
const provider = process.env.AI_PROVIDER ?? 'none', key = process.env.AI_API_KEY ?? '', model = process.env.AI_MODEL || 'gemini-flash-latest';
const mask = (k) => (k ? `${k.slice(0, 4)}…${k.slice(-2)} (${k.length} characters)` : '(missing)');
const say = (icon, text) => console.log(`${icon} ${text}`);
const problems = [];
const safe = (s) => String(s).split(key || '\u0000').join('[key]').replace(/AIza[0-9A-Za-z_-]{20,}|AQ\.[0-9A-Za-z_-]{20,}/g, '[key]');

console.log('\nCareerBridge AI check\n');
say('•', `AI_PROVIDER = ${provider}`); say('•', `AI_MODEL    = ${model}${process.env.AI_MODEL ? '' : ' (default)'}`); say('•', `AI_API_KEY  = ${mask(key)}`);

// 1. Configuration
if (provider !== 'gemini') problems.push('AI_PROVIDER is not "gemini", so the app will report AI as not configured.');
if (!key) problems.push('AI_API_KEY is empty. Create one at https://aistudio.google.com/apikey and put it in .env.local (or your host\'s environment settings).');
if (/^["']|["']$/.test(key)) problems.push('The key has quote characters around it. In .env.local the quotes are removed for you, but many hosting dashboards keep them. Paste the key with no quotes.');
if (/\s/.test(key)) problems.push('The key contains a space or line break. Paste it again without extra characters.');
const keyLooksOdd = Boolean(key) && !/^(AIza|AQ\.)/.test(key); // Google issues more than one key format, so this only matters if Google rejects the key
const modelInvalid = !/^[A-Za-z0-9][A-Za-z0-9._-]{1,80}$/.test(model);
if (modelInvalid) problems.push(`AI_MODEL is "${model}", which is not a model name. It looks like placeholder text copied from instructions. Replace it with a real name such as gemini-flash-latest (no angle brackets or spaces), then restart the app.`);
if (/gemma/i.test(model)) problems.push('You are using a Gemma model. Gemma models do not support JSON mode or system instructions, which this app needs. Choose a Gemini model.');
if (/^gemini-(1\.|2\.0|2\.5)/.test(model)) problems.push(`"${model}" is an older model. Google has retired the 1.x and 2.0 models and scheduled the 2.5 models for shutdown on 16 October 2026, so it may return 404. Pick a current model from the list below, or use gemini-flash-latest.`);
if (!key) { report(); }

const headers = { 'x-goog-api-key': key, 'content-type': 'application/json' };
async function call(label, body) {
  try {
    const r = await fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(25000) });
    const text = await r.text(); let j = {}; try { j = JSON.parse(text); } catch {}
    if (r.ok) { const out = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim() ?? ''; return { ok: true, status: r.status, out }; }
    return { ok: false, status: r.status, google: j.error?.status ?? '', reason: j.error?.details?.find((d) => d.reason)?.reason ?? '', message: safe(j.error?.message ?? text.slice(0, 200)) };
  } catch (e) { return { ok: false, status: 0, message: safe(e.message) }; }
}
const user = { role: 'user', parts: [{ text: 'Reply with the JSON {"ok": true}' }] };

// 2. Can the key list models?
console.log('\nStep 1: does Google accept the key?');
let models = [];
try {
  const r = await fetch(`${BASE}/models?pageSize=200`, { headers, signal: AbortSignal.timeout(25000) }); const text = await r.text(); let j = {}; try { j = JSON.parse(text); } catch {}
  if (r.ok) {
    models = (j.models ?? []).filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent')).map((m) => m.name.replace(/^models\//, ''));
    say('✔', `Key accepted. ${models.length} models can generate content.`);
  } else {
    if (keyLooksOdd) problems.push('The key does not start with "AIza" or "AQ.", the formats Google normally uses. Check you copied the whole key and that it is not from another service.');
    const msg = safe(j.error?.message ?? text.slice(0, 200)); say('✘', `Google answered ${r.status} ${j.error?.status ?? ''}: ${msg}`);
    if (/api key (not valid|expired)|API_KEY_INVALID/i.test(msg + (j.error?.details ?? []).map((d) => d.reason).join())) problems.push('Google says the API key is not valid. Create a new key at https://aistudio.google.com/apikey and replace AI_API_KEY (then restart the app).');
    else if (/free tier is not available|location is not supported|billing/i.test(msg) || j.error?.status === 'FAILED_PRECONDITION') problems.push('Google says the free tier is not available where this request comes from (it depends on the region of the server making the call, not your own location). Enable billing for the project in Google AI Studio, or run the app from a supported region.');
    else if (r.status === 403) problems.push('Google refused the key (permission denied). It may be restricted, blocked or reported as leaked. Create a fresh key.');
  }
} catch (e) { say('✘', `Could not reach Google: ${safe(e.message)}`); problems.push('The server could not reach generativelanguage.googleapis.com. Check the internet connection or any firewall/proxy.'); }

if (models.length) {
  const picks = models.filter((m) => /^gemini-.*(flash|pro)/.test(m) && !/(image|tts|audio|live|embedding|computer|robotics|lyria|veo)/.test(m)).slice(0, 14);
  say('•', `Models your key can use (first ${picks.length}): ${picks.join(', ')}`);
  if (modelInvalid) { /* explained above */ }
  else if (models.includes(model)) say('✔', `Your model "${model}" is available to this key.`);
  else if (model === 'gemini-flash-latest' && models.some((m) => m === 'gemini-flash-latest')) say('✔', 'gemini-flash-latest is available.');
  else { say('✘', `Your model "${model}" is not in that list.`); problems.push(`The model "${model}" is not available to your key. Set AI_MODEL to one of the names listed above.`); }
}

if (modelInvalid) { console.log('\nSkipping the request tests: fix the model name first.'); report(); }
// 3. The exact request shape the app sends, then each feature on its own
console.log('\nStep 2: the request exactly as the app sends it');
const app = await call('app', { systemInstruction: { parts: [{ text: 'You answer with JSON only.' }] }, contents: [user], generationConfig: { responseMimeType: 'application/json', temperature: 0.4, maxOutputTokens: 200 } });
if (app.ok) { say('✔', `Works. Model replied: ${safe(app.out).slice(0, 80)}`); }
else {
  say('✘', `HTTP ${app.status} ${app.google ?? ''} ${app.reason ?? ''}: ${app.message}`);
  console.log('\nStep 3: which part does Google reject?');
  const plain = await call('plain', { contents: [user] });
  const sys = await call('system', { systemInstruction: { parts: [{ text: 'You answer with JSON only.' }] }, contents: [user] });
  const json = await call('json', { contents: [user], generationConfig: { responseMimeType: 'application/json' } });
  say(plain.ok ? '✔' : '✘', `Plain request:            ${plain.ok ? 'works' : `HTTP ${plain.status} ${plain.message}`}`);
  say(sys.ok ? '✔' : '✘', `With system instruction:  ${sys.ok ? 'works' : `HTTP ${sys.status} ${sys.message}`}`);
  say(json.ok ? '✔' : '✘', `With JSON mode:           ${json.ok ? 'works' : `HTTP ${json.status} ${json.message}`}`);
  const already = problems.some((p) => /API key is not valid|billing|region|permission denied/i.test(p)); // do not repeat what Step 1 already explained
  if (already) { /* Step 1 explained it */ }
  else if (!plain.ok && /api key (not valid|expired)|API_KEY_INVALID/i.test(`${plain.message} ${plain.reason}`)) problems.push('Even a plain request fails because the API key is not valid. Create a new key at https://aistudio.google.com/apikey.');
  else if (!plain.ok && (plain.google === 'FAILED_PRECONDITION' || /free tier|location|billing/i.test(plain.message))) problems.push('Even a plain request fails with a region or billing precondition. Enable billing for the project in Google AI Studio, or run the app from a supported region.');
  else if (!plain.ok && plain.status === 404) problems.push(`The model "${model}" does not exist or has been retired. Set AI_MODEL to a model from the list above.`);
  else if (!plain.ok) problems.push(`Even a plain request fails (HTTP ${plain.status}). See the message above.`);
  else if (!sys.ok) problems.push(`The model "${model}" rejects system instructions, which the app uses. Choose a different Gemini model.`);
  else if (!json.ok) problems.push(`The model "${model}" does not support JSON mode, which the app uses. Choose a different Gemini model.`);
  else problems.push('Each feature works alone but the combination fails. Copy the message above when asking for help.');
}
report();

function report() {
  console.log('\nResult');
  if (problems.length === 0) { say('✔', 'Everything the app needs works. If a feature still fails inside the app, check the server log line that starts with "ai failed".'); process.exit(0); }
  for (const p of problems) say('→', p);
  process.exit(1);
}
