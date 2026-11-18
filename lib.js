import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, BUCKET } from './config.js';
export { BUCKET };
export const isConfigured = /^https:\/\/.+\.supabase\.co/.test(SUPABASE_URL) && !SUPABASE_ANON_KEY.startsWith('YOUR_');
export const sb = createClient(isConfigured ? SUPABASE_URL : 'https://placeholder.supabase.co', isConfigured ? SUPABASE_ANON_KEY : 'placeholder');
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const safeUrl = u => (/^https?:\/\//i.test(u || '') ? esc(u) : '');
export const isPdf = u => /\.pdf(\?|$)/i.test(u || '');
export const fmtDate = d => (d ? new Date(d).toLocaleDateString('en', { year: 'numeric', month: 'short' }) : '');
export function toast(msg, bad) {
  const t = document.createElement('div');
  t.className = 'toast' + (bad ? ' bad' : '');
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 3500);
}
