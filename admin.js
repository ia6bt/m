import { sb, $, $$, esc, safeUrl, toast, isConfigured, isPdf, BUCKET } from './lib.js';

const OK_IMG = ['image/jpeg', 'image/png', 'image/webp'], MAX = 10 * 1024 * 1024;
const F = (k, l, t = 'text', o = {}) => ({ k, l, t, ...o });
const E = {
  projects: { label: 'Projects', icon: '🗂️', title: 'title', sub: r => r.category, thumb: r => r.cover_url, preview: true, fields: [
    F('title', 'Title', 'text', { req: 1 }), F('category', 'Category'), F('description', 'Description', 'textarea', { rows: 6 }),
    F('cover_url', 'Cover image', 'image'), F('images', 'Additional images', 'images'),
    F('technologies', 'Technologies (comma separated)', 'tags'), F('github_url', 'GitHub URL', 'url'), F('demo_url', 'Live demo URL', 'url'), F('published_on', 'Publication date', 'date')] },
  certificates: { label: 'Certificates', icon: '🎓', title: 'title', sub: r => [r.institution, r.year].filter(Boolean).join(' • '), thumb: r => r.image_url, preview: true, fields: [
    F('title', 'Title', 'text', { req: 1 }), F('institution', 'Institution'), F('field_of_study', 'Field of study'), F('year', 'Year', 'number'),
    F('description', 'Description', 'textarea'), F('image_url', 'Certificate image', 'image')] },
  experiences: { label: 'Experience', icon: '💼', title: 'position', sub: r => r.company, thumb: () => '', fields: [
    F('company', 'Company', 'text', { req: 1 }), F('position', 'Position', 'text', { req: 1 }), F('location', 'Location'),
    F('start_date', 'Start date', 'date'), F('end_date', 'End date', 'date'), F('is_current', 'I currently work here', 'checkbox', { def: false }),
    F('description', 'Description', 'textarea'), F('responsibilities', 'Responsibilities (one per line)', 'lines', { rows: 5 }),
    F('attachments', 'Supporting images or documents (PDF)', 'files')] },
  profile: { label: 'Personal info', icon: '👤', single: true, folder: 'profile', fields: [
    F('full_name', 'Full name', 'text', { req: 1 }), F('title', 'Professional title'), F('avatar_url', 'Profile picture', 'image'), F('bio', 'Biography', 'textarea', { rows: 6 }),
    F('location', 'Location'), F('email', 'Email', 'email'), F('phone', 'Phone', 'tel'),
    F('github_url', 'GitHub URL', 'url'), F('linkedin_url', 'LinkedIn URL', 'url'), F('facebook_url', 'Facebook URL', 'url'), F('instagram_url', 'Instagram URL', 'url'),
    F('skills', 'Technical skills (comma separated)', 'tags'), F('languages', 'Languages (comma separated)', 'tags'), F('interests', 'Interests (comma separated)', 'tags')] },
  settings: { label: 'Settings', icon: '⚙️', single: true, folder: 'library', fields: [
    F('site_title', 'Website title', 'text', { req: 1 }), F('meta_description', 'Search description', 'textarea', { rows: 3 }), F('footer_text', 'Footer name'),
    F('show_projects', 'Show Projects section', 'checkbox', { def: true }), F('show_certificates', 'Show Certificates section', 'checkbox', { def: true }), F('show_experience', 'Show Experience section', 'checkbox', { def: true })] },
};
const NAV = [['dashboard', '📊', 'Dashboard'], ['projects'], ['certificates'], ['experiences'], ['profile'], ['media', '🖼️', 'Media'], ['settings']];
const view = $('#view');
let rows = [], ready = false;

// ---------- helpers ----------
const fail = e => { view.innerHTML = `<div class="notice">Something went wrong: ${esc(e.message || e)}</div>`; };
const confirmBox = msg => new Promise(res => { const d = $('#confirm'); $('#confirm-msg').textContent = msg; d.returnValue = ''; d.showModal(); d.onclose = () => res(d.returnValue === 'yes'); });
const pathOf = url => { const m = '/storage/v1/object/public/' + BUCKET + '/'; const i = (url || '').indexOf(m); return i < 0 ? null : decodeURIComponent(url.slice(i + m.length).split('?')[0]); };
const removeFiles = async urls => { const p = urls.map(pathOf).filter(Boolean); if (p.length) await sb.storage.from(BUCKET).remove(p); };
const urlsOf = (t, r) => E[t].fields.flatMap(f => (f.t === 'image' ? [r[f.k]] : ['images', 'files'].includes(f.t) ? r[f.k] || [] : [])).filter(Boolean);

async function optimize(file) {
  if (file.type === 'application/pdf') return file;
  try {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return (await new Promise(r => c.toBlob(r, 'image/webp', 0.82))) || file;
  } catch { return file; }
}
async function upload(file, folder) {
  const blob = await optimize(file);
  const ext = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'application/pdf': 'pdf' }[blob.type] || 'jpg';
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000' });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
function checkFile(f, pdf) {
  if (!(OK_IMG.includes(f.type) || (pdf && f.type === 'application/pdf'))) return `${f.name}: only JPG, PNG, WebP${pdf ? ' or PDF' : ''} files are allowed.`;
  if (f.size > MAX) return `${f.name} is larger than 10 MB.`;
}

// ---------- form builder ----------
function fieldHTML(f, row) {
  const v = row[f.k], L = esc(f.l) + (f.req ? ' *' : '');
  if (['image', 'images', 'files'].includes(f.t)) {
    const acc = f.t === 'files' ? 'image/jpeg,image/png,image/webp,application/pdf' : 'image/jpeg,image/png,image/webp';
    return `<div class="fld media" data-k="${f.k}"><span class="lbl">${L}</span><div class="thumbs"></div><label class="btn ghost sm">${f.t === 'image' ? 'Choose or replace' : 'Add files'}<input type="file" hidden accept="${acc}" ${f.t === 'image' ? '' : 'multiple'}></label></div>`;
  }
  if (f.t === 'checkbox') return `<label class="chk"><input type="checkbox" name="${f.k}" ${(v ?? f.def ?? false) ? 'checked' : ''}> ${L}</label>`;
  if (f.t === 'textarea' || f.t === 'lines') return `<label class="fld">${L}<textarea name="${f.k}" rows="${f.rows || 4}">${esc(f.t === 'lines' ? (v || []).join('\n') : v)}</textarea></label>`;
  const type = { tags: 'text', url: 'url', email: 'email', tel: 'tel', number: 'number', date: 'date', text: 'text' }[f.t];
  return `<label class="fld">${L}<input name="${f.k}" type="${type}" value="${esc(f.t === 'tags' ? (v || []).join(', ') : v)}" ${f.t === 'number' ? 'min="1950" max="2100"' : ''}></label>`;
}
function readField(f, form) {
  const el = form.elements[f.k];
  if (f.t === 'checkbox') return el.checked;
  if (f.t === 'tags') return el.value.split(',').map(s => s.trim()).filter(Boolean);
  if (f.t === 'lines') return el.value.split('\n').map(s => s.trim()).filter(Boolean);
  if (f.t === 'number') return el.value === '' ? null : Number(el.value);
  return el.value.trim() || null;
}

function mountForm(box, t, row, done) {
  const e = E[t], fields = e.fields, folder = e.folder || t, media = {};
  row = row || {};
  box.innerHTML = `<form novalidate>${fields.map(f => fieldHTML(f, row)).join('')}
    ${e.single ? '' : `<label class="chk"><input type="checkbox" name="published" ${row.published !== false ? 'checked' : ''}> Published (visible to visitors)</label>`}
    <div class="err" hidden></div><div class="acts"><button type="submit" class="btn">Save changes</button>${e.single ? '' : '<button type="button" class="btn ghost" data-close>Cancel</button>'}</div></form>`;
  const form = $('form', box), errBox = $('.err', form);
  const showErr = m => { errBox.textContent = m || ''; errBox.hidden = !m; if (m) errBox.scrollIntoView({ block: 'nearest' }); };
  fields.filter(f => ['image', 'images', 'files'].includes(f.t)).forEach(f => {
    const cur = f.t === 'image' ? (row[f.k] ? [row[f.k]] : []) : [...(row[f.k] || [])];
    media[f.k] = { keep: cur, add: [], gone: [] }; draw(f.k);
  });
  function draw(k) {
    const m = media[k];
    const th = (src, r, name) => `<div class="th">${isPdf(name) ? '<span class="pdf">📄</span>' : `<img src="${src}" alt="">`}<button type="button" class="rm" data-r="${r}" aria-label="Remove">✕</button></div>`;
    $(`.media[data-k="${k}"] .thumbs`, form).innerHTML = (m.keep.map((u, i) => th(safeUrl(u), 'k' + i, u)).join('') + m.add.map((x, i) => th(x.pv, 'a' + i, x.file.name)).join('')) || '<span class="mut">No file selected</span>';
  }
  form.addEventListener('change', ev => {
    if (ev.target.type !== 'file') return;
    const k = ev.target.closest('.media').dataset.k, f = fields.find(x => x.k === k), m = media[k];
    const files = [...ev.target.files]; ev.target.value = '';
    for (const file of files) { const bad = checkFile(file, f.t === 'files'); if (bad) return showErr(bad); }
    showErr('');
    if (f.t === 'image' && files.length) { m.gone.push(...m.keep); m.keep = []; m.add.forEach(x => URL.revokeObjectURL(x.pv)); m.add = []; files.splice(1); }
    files.forEach(file => m.add.push({ file, pv: URL.createObjectURL(file) }));
    draw(k);
  });
  form.addEventListener('click', ev => {
    const b = ev.target.closest('[data-r]'); if (!b) return;
    const k = b.closest('.media').dataset.k, m = media[k], i = +b.dataset.r.slice(1);
    if (b.dataset.r[0] === 'k') m.gone.push(...m.keep.splice(i, 1)); else URL.revokeObjectURL(m.add.splice(i, 1)[0].pv);
    draw(k);
  });
  form.onsubmit = async ev => {
    ev.preventDefault(); showErr('');
    const btn = $('button[type=submit]', form), p = {}, uploaded = [];
    try {
      for (const f of fields) {
        if (media[f.k]) continue;
        p[f.k] = readField(f, form);
        if (f.req && (p[f.k] == null || p[f.k] === '')) throw new Error(`${f.l} is required.`);
        if (f.t === 'url' && p[f.k] && !/^https?:\/\/\S+$/i.test(p[f.k])) throw new Error(`${f.l} must start with http:// or https://`);
        if (f.t === 'email' && p[f.k] && !/^\S+@\S+\.\S+$/.test(p[f.k])) throw new Error('Enter a valid email address.');
        if (f.t === 'number' && p[f.k] != null && !(p[f.k] >= 1950 && p[f.k] <= 2100)) throw new Error(`${f.l} must be between 1950 and 2100.`);
      }
      btn.disabled = true; btn.textContent = 'Saving…';
      for (const f of fields) if (media[f.k]) {
        const m = media[f.k], urls = [...m.keep];
        for (const x of m.add) { const u = await upload(x.file, folder); uploaded.push(u); urls.push(u); }
        p[f.k] = f.t === 'image' ? urls[0] || null : urls;
      }
      if (!e.single) p.published = form.elements.published.checked;
      let q;
      if (e.single) q = sb.from(t).upsert({ id: 1, ...p });
      else if (row.id) q = sb.from(t).update(p).eq('id', row.id);
      else { p.sort_order = Math.max(-1, ...rows.map(r => r.sort_order || 0)) + 1; q = sb.from(t).insert(p); }
      const { error } = await q; if (error) throw error;
      await removeFiles(Object.values(media).flatMap(m => m.gone)).catch(() => {});
      Object.values(media).forEach(m => m.add.forEach(x => URL.revokeObjectURL(x.pv)));
      toast('Saved'); done();
    } catch (err) {
      await removeFiles(uploaded).catch(() => {});
      showErr(err.message || String(err)); btn.disabled = false; btn.textContent = 'Save changes';
    }
  };
}

// ---------- pages ----------
async function dashboard() {
  view.innerHTML = '<h1>Dashboard</h1><p class="mut">Loading…</p>';
  try {
    const stats = await Promise.all(['projects', 'certificates', 'experiences'].map(async t => {
      const [a, b] = await Promise.all([sb.from(t).select('*', { count: 'exact', head: true }), sb.from(t).select('*', { count: 'exact', head: true }).eq('published', true)]);
      if (a.error || b.error) throw a.error || b.error;
      return { t, total: a.count || 0, pub: b.count || 0 };
    }));
    const pub = stats.reduce((n, s) => n + s.pub, 0), tot = stats.reduce((n, s) => n + s.total, 0);
    view.innerHTML = `<h1>Dashboard</h1><div class="stats">${stats.map(s => `<a class="card stat" href="#/${s.t}"><b>${s.total}</b><span>Total ${E[s.t].label.toLowerCase()}</span><small class="mut">${s.pub} published</small></a>`).join('')}
      <div class="card stat"><b>${pub}</b><span>Published content</span><small class="mut">${tot - pub} hidden drafts</small></div></div>
      <div class="acts"><a class="btn" href="#/projects">Add a project</a><a class="btn ghost" href="#/certificates">Add a certificate</a><a class="btn ghost" href="#/experiences">Add experience</a></div>`;
  } catch (e) { fail(e); }
}

async function list(t) {
  const e = E[t];
  view.innerHTML = `<div class="pgh"><h1>${e.label}</h1><button class="btn" id="add">＋ Add new</button></div><div id="items" class="items"><p class="mut">Loading…</p></div>`;
  $('#add').onclick = () => edit(t, null);
  const { data, error } = await sb.from(t).select('*').order('sort_order').order('created_at', { ascending: false });
  if (error) return fail(error);
  rows = data; paint(t);
}
function paint(t) {
  const e = E[t];
  $('#items').innerHTML = rows.length ? rows.map((r, i) => `<div class="card item" data-id="${r.id}">
    ${e.thumb(r) ? `<img class="tn" src="${safeUrl(e.thumb(r))}" alt="">` : '<span class="tn ph">📄</span>'}
    <div class="im"><b>${esc(r[e.title])}</b><span class="mut">${esc(e.sub(r))}</span><span class="badge ${r.published ? 'ok' : ''}">${r.published ? 'Published' : 'Hidden'}</span></div>
    <div class="ia">
      <button class="btn ghost sm" data-a="up" ${i === 0 ? 'disabled' : ''} aria-label="Move up">▲</button><button class="btn ghost sm" data-a="down" ${i === rows.length - 1 ? 'disabled' : ''} aria-label="Move down">▼</button>
      ${e.preview ? '<button class="btn ghost sm" data-a="prev">Preview</button>' : ''}
      <button class="btn ghost sm" data-a="pub">${r.published ? 'Unpublish' : 'Publish'}</button>
      <button class="btn ghost sm" data-a="edit">Edit</button><button class="btn danger sm" data-a="del">Delete</button></div></div>`).join('')
    : '<div class="card empty">Nothing here yet. Use “Add new” to create your first entry.</div>';
  $('#items').onclick = async ev => {
    const b = ev.target.closest('[data-a]'); if (!b) return;
    const idx = rows.findIndex(r => r.id === b.closest('.item').dataset.id), r = rows[idx];
    try {
      if (b.dataset.a === 'edit') edit(t, r);
      else if (b.dataset.a === 'prev') window.open(`index.html?open=${r.id}#${t}`, '_blank', 'noopener');
      else if (b.dataset.a === 'pub') { const { error } = await sb.from(t).update({ published: !r.published }).eq('id', r.id); if (error) throw error; toast(r.published ? 'Unpublished' : 'Published'); list(t); }
      else if (b.dataset.a === 'del') {
        if (!(await confirmBox(`Delete “${r[e.title]}”? Its uploaded files are removed too. This cannot be undone.`))) return;
        const { error } = await sb.from(t).delete().eq('id', r.id); if (error) throw error;
        await removeFiles(urlsOf(t, r)).catch(() => {}); toast('Deleted'); list(t);
      } else {
        const j = idx + (b.dataset.a === 'up' ? -1 : 1); [rows[idx], rows[j]] = [rows[j], rows[idx]];
        const res = await Promise.all(rows.map((x, n) => x.sort_order === n ? null : sb.from(t).update({ sort_order: n }).eq('id', x.id)));
        const bad = res.find(x => x && x.error); if (bad) throw bad.error; list(t);
      }
    } catch (err) { toast(err.message || 'Action failed', true); }
  };
}
function edit(t, row) {
  $('#editor-title').textContent = (row ? 'Edit ' : 'New ') + E[t].label.toLowerCase().replace(/s$/, '');
  mountForm($('#editor-body'), t, row, () => { $('#editor').close(); list(t); });
  $('#editor').showModal();
}
async function single(t) {
  view.innerHTML = `<div class="pgh"><h1>${E[t].label}</h1></div><div class="card pad" id="sf"><p class="mut">Loading…</p></div>`;
  const { data, error } = await sb.from(t).select('*').eq('id', 1).maybeSingle();
  if (error) return fail(error);
  mountForm($('#sf'), t, data, () => single(t));
}

async function media() {
  view.innerHTML = `<div class="pgh"><h1>Media</h1><label class="btn">＋ Upload<input id="up" type="file" hidden multiple accept="image/jpeg,image/png,image/webp"></label></div>
    <p class="mut">Images are resized and converted to WebP automatically. Deleting a file that is still used by a page leaves a broken image there.</p><div id="mg" class="mgrid"><p class="mut">Loading…</p></div>`;
  $('#up').onchange = async ev => {
    const files = [...ev.target.files]; ev.target.value = '';
    for (const f of files) {
      const bad = checkFile(f, false); if (bad) { toast(bad, true); continue; }
      try { await upload(f, 'library'); toast('Uploaded ' + f.name); } catch (er) { toast(er.message, true); }
    }
    media();
  };
  const out = [];
  for (const d of ['library', 'profile', 'projects', 'certificates', 'experiences']) {
    const { data, error } = await sb.storage.from(BUCKET).list(d, { limit: 500, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) return fail(error);
    (data || []).filter(f => f.id).forEach(f => out.push({ path: `${d}/${f.name}`, size: f.metadata?.size || 0 }));
  }
  const url = p => sb.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;
  $('#mg').innerHTML = out.length ? out.map(o => `<div class="card mi" data-p="${esc(o.path)}">${isPdf(o.path) ? '<span class="tn ph big">📄</span>' : `<img src="${safeUrl(url(o.path))}" alt="" loading="lazy">`}
    <small class="mut">${esc(o.path)} • ${Math.round(o.size / 1024)} KB</small><div class="ia"><button class="btn ghost sm" data-a="copy">Copy link</button><button class="btn danger sm" data-a="del">Delete</button></div></div>`).join('') : '<div class="card empty">No files uploaded yet.</div>';
  $('#mg').onclick = async ev => {
    const b = ev.target.closest('[data-a]'); if (!b) return;
    const p = b.closest('.mi').dataset.p;
    if (b.dataset.a === 'copy') { try { await navigator.clipboard.writeText(url(p)); toast('Link copied'); } catch { toast('Copy failed', true); } return; }
    if (!(await confirmBox(`Delete ${p}? This cannot be undone.`))) return;
    const { error } = await sb.storage.from(BUCKET).remove([p]);
    if (error) toast(error.message, true); else { toast('Deleted'); media(); }
  };
}

// ---------- routing & auth ----------
function route() {
  const t = (location.hash.match(/^#\/(\w+)/) || [])[1] || 'dashboard';
  $('#anav').innerHTML = NAV.map(([k, ic, lb]) => `<a href="#/${k}" class="${k === t ? 'on' : ''}"><span>${ic || E[k].icon}</span>${lb || E[k].label}</a>`).join('');
  ({ dashboard, media })[t] ? ({ dashboard, media })[t]() : E[t]?.single ? single(t) : E[t] ? list(t) : dashboard();
}
addEventListener('hashchange', () => ready && route());
const only = id => ['setup', 'login', 'shell'].forEach(x => { $('#' + x).hidden = x !== id; });
async function gate(session, msg) {
  if (!session) { ready = false; only('login'); if (msg) { $('#login-err').textContent = msg; $('#login-err').hidden = false; } return; }
  if (ready) return;
  const { data, error } = await sb.rpc('is_admin');
  if (error || !data) { await sb.auth.signOut(); return gate(null, 'This account is not an authorized administrator.'); }
  ready = true; only('shell'); route();
}
document.addEventListener('click', ev => { if (ev.target.closest('[data-close]')) ev.target.closest('dialog').close(); });
$('#logout').onclick = () => sb.auth.signOut();
$('#login-form').onsubmit = async ev => {
  ev.preventDefault();
  const f = ev.target, b = $('button', f), er = $('#login-err'); er.hidden = true; b.disabled = true;
  const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
  b.disabled = false;
  if (error) { er.textContent = error.message; er.hidden = false; }
};
if (!isConfigured) only('setup');
else sb.auth.onAuthStateChange((ev, s) => { if (['INITIAL_SESSION', 'SIGNED_IN', 'SIGNED_OUT'].includes(ev)) setTimeout(() => gate(s), 0); });
