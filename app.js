import { sb, $, esc, safeUrl, isConfigured, isPdf, fmtDate } from './lib.js';

const sel = t => sb.from(t).select('*').order('sort_order').order('created_at', { ascending: false });
const chips = a => (a || []).map(x => `<span class="chip">${esc(x)}</span>`).join('');
const draft = r => (r.published ? '' : '<span class="badge">Draft</span>');
const img = (u, alt) => (safeUrl(u) ? `<img src="${safeUrl(u)}" alt="${esc(alt)}" loading="lazy" decoding="async">` : '');
const dlg = $('#modal');
const D = { projects: [], certificates: [] };
const show = html => { $('#modal-body').innerHTML = html; dlg.showModal(); };

function renderHero(p) {
  const init = (p.full_name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  $('#home').innerHTML = `<div class="hero-txt"><p class="hello">Hello, I'm</p><h1>${esc(p.full_name)}</h1>
    <p class="role grad">${esc(p.title)}</p><p class="bio">${esc(p.bio)}</p>
    <div class="chips">${chips(p.skills)}</div>
    <div class="cta"><a class="btn" href="#projects">View Projects</a><a class="btn ghost" href="#contact">Contact Me</a></div></div>
    <div class="avatar">${safeUrl(p.avatar_url) ? `<img src="${safeUrl(p.avatar_url)}" alt="${esc(p.full_name)}" decoding="async">` : `<span>${esc(init)}</span>`}</div>`;
}

function renderProjects(cat = '') {
  const cats = [...new Set(D.projects.map(p => p.category).filter(Boolean))];
  $('#filters').innerHTML = cats.length > 1 ? ['All', ...cats].map(c => `<button class="chip btnchip ${(c === 'All' ? '' : c) === cat ? 'on' : ''}" data-cat="${esc(c === 'All' ? '' : c)}">${esc(c)}</button>`).join('') : '';
  const list = D.projects.filter(p => !cat || p.category === cat);
  $('#projects-grid').innerHTML = list.length ? list.map(p => `<article class="card pc" tabindex="0" role="button" data-p="${p.id}" aria-label="Open ${esc(p.title)}">
    <div class="cover">${img(p.cover_url, p.title) || '<span class="ph">💻</span>'}</div>
    <div class="cb"><h3>${esc(p.title)} ${draft(p)}</h3><p class="mut clamp">${esc(p.description)}</p>
    <div class="chips">${chips((p.technologies || []).slice(0, 4))}</div></div></article>`).join('') : '<p class="mut empty">No projects published yet.</p>';
}

function openProject(p) {
  const imgs = [p.cover_url, ...(p.images || [])].filter(safeUrl);
  show(`<div class="gal">${imgs.length ? `<img id="gmain" src="${safeUrl(imgs[0])}" alt="${esc(p.title)}">` : ''}
    ${imgs.length > 1 ? `<div class="thumbs">${imgs.map(u => `<img data-src="${safeUrl(u)}" src="${safeUrl(u)}" loading="lazy" alt="">`).join('')}</div>` : ''}</div>
    <div class="det"><h2>${esc(p.title)}</h2><p class="mut">${[p.category, fmtDate(p.published_on)].filter(Boolean).map(esc).join(' • ')}</p>
    <p class="pre">${esc(p.description)}</p><div class="chips">${chips(p.technologies)}</div>
    <div class="cta">${safeUrl(p.demo_url) ? `<a class="btn" target="_blank" rel="noopener" href="${safeUrl(p.demo_url)}">Live demo</a>` : ''}
    ${safeUrl(p.github_url) ? `<a class="btn ghost" target="_blank" rel="noopener" href="${safeUrl(p.github_url)}">GitHub</a>` : ''}</div></div>`);
}

function renderCerts() {
  $('#certs-grid').innerHTML = D.certificates.length ? D.certificates.map(c => `<article class="card cc" tabindex="0" role="button" data-c="${c.id}" aria-label="Open ${esc(c.title)}">
    <div class="cover">${img(c.image_url, c.title) || '<span class="ph">🎓</span>'}</div>
    <div class="cb"><h3>${esc(c.title)} ${draft(c)}</h3><p class="mut">${[c.institution, c.year].filter(Boolean).map(esc).join(' • ')}</p></div></article>`).join('') : '<p class="mut empty">No certificates published yet.</p>';
}

function openCert(c) {
  show(`<div class="gal">${safeUrl(c.image_url) ? `<img id="gmain" src="${safeUrl(c.image_url)}" alt="${esc(c.title)}">` : ''}</div>
    <div class="det"><h2>${esc(c.title)}</h2><p class="mut">${[c.institution, c.field_of_study, c.year].filter(Boolean).map(esc).join(' • ')}</p><p class="pre">${esc(c.description)}</p></div>`);
}

function renderExp(list) {
  $('#exp-list').innerHTML = list.length ? list.map(x => {
    const when = [fmtDate(x.start_date), x.is_current ? 'Present' : fmtDate(x.end_date)].filter(Boolean).join(' – ');
    const att = (x.attachments || []).filter(safeUrl).map(u => isPdf(u)
      ? `<a class="chip btnchip" target="_blank" rel="noopener" href="${safeUrl(u)}">📄 Document</a>`
      : `<a href="${safeUrl(u)}" data-lb="${safeUrl(u)}" class="att"><img src="${safeUrl(u)}" alt="" loading="lazy"></a>`).join('');
    return `<li class="tl"><div class="card"><h3>${esc(x.position)} ${draft(x)}</h3><p class="co">${esc(x.company)}${x.location ? ' • ' + esc(x.location) : ''}</p>
      ${when ? `<p class="mut">${esc(when)}</p>` : ''}<p class="pre">${esc(x.description)}</p>
      ${(x.responsibilities || []).length ? `<ul class="resp">${x.responsibilities.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
      ${att ? `<div class="atts">${att}</div>` : ''}</div></li>`;
  }).join('') : '<p class="mut empty">No experience published yet.</p>';
}

function renderAbout(p) {
  const soc = [['GitHub', p.github_url], ['LinkedIn', p.linkedin_url], ['Facebook', p.facebook_url], ['Instagram', p.instagram_url]].filter(s => safeUrl(s[1]));
  $('#about-body').innerHTML = `<div class="card"><h3>About</h3>${p.location ? `<p class="mut">${esc(p.location)}</p>` : ''}
    ${(p.interests || []).length ? `<p class="lbl">Interests</p><div class="chips">${chips(p.interests)}</div>` : ''}
    ${(p.languages || []).length ? `<p class="lbl">Languages</p><div class="chips">${chips(p.languages)}</div>` : ''}</div>
    <div class="card"><h3>Contact</h3><ul class="contact">
    ${p.email ? `<li><span class="lbl">Email</span><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></li>` : ''}
    ${p.phone ? `<li><span class="lbl">Phone</span><a href="tel:${esc(p.phone.replace(/[^\d+]/g, ''))}">${esc(p.phone)}</a></li>` : ''}</ul>
    <div class="chips">${soc.map(s => `<a class="chip btnchip" target="_blank" rel="noopener" href="${safeUrl(s[1])}">${s[0]}</a>`).join('')}</div>
    ${!p.email && !p.phone && !soc.length ? '<p class="mut">Contact details have not been added yet.</p>' : ''}</div>`;
}

async function load() {
  if (!isConfigured) { $('#app-error').hidden = false; return; }
  const res = await Promise.all([sb.from('profile').select('*').eq('id', 1).maybeSingle(), sb.from('settings').select('*').eq('id', 1).maybeSingle(), sel('projects'), sel('certificates'), sel('experiences')]);
  const bad = res.find(r => r.error);
  if (bad) { const e = $('#app-error'); e.hidden = false; e.textContent = 'Could not load content: ' + bad.error.message; return; }
  const [p, s, pj, ce, ex] = res.map(r => r.data);
  const pr = p || {}, st = s || {};
  D.projects = pj; D.certificates = ce;
  document.title = st.site_title || pr.full_name || 'Portfolio';
  if (st.meta_description) $('meta[name=description]').content = st.meta_description;
  $('#logo').textContent = pr.full_name || 'Portfolio';
  $('#foot').textContent = `© ${new Date().getFullYear()} ${st.footer_text || pr.full_name || ''}`;
  renderHero(pr); renderProjects(); renderCerts(); renderExp(ex); renderAbout(pr);
  for (const k of ['projects', 'certificates', 'experience']) {
    const on = st['show_' + k] !== false;
    $('#' + k).hidden = !on; $(`nav [data-s="${k}"]`).hidden = !on;
  }
  const id = new URLSearchParams(location.search).get('open');
  if (id) { const a = pj.find(x => x.id === id), b = ce.find(x => x.id === id); if (a) openProject(a); else if (b) openCert(b); }
}

document.addEventListener('click', e => {
  const t = e.target;
  if (t.closest('[data-close]') || t === dlg) return dlg.close();
  const f = t.closest('[data-cat]'); if (f) return renderProjects(f.dataset.cat);
  const p = t.closest('[data-p]'); if (p) return openProject(D.projects.find(x => x.id === p.dataset.p));
  const c = t.closest('[data-c]'); if (c) return openCert(D.certificates.find(x => x.id === c.dataset.c));
  const lb = t.closest('[data-lb]'); if (lb) { e.preventDefault(); return show(`<div class="gal"><img id="gmain" src="${lb.dataset.lb}" alt=""></div>`); }
  if (t.dataset.src) $('#gmain').src = t.dataset.src;
  if (t.closest('#nav a')) $('#nav').classList.remove('open');
});
document.addEventListener('keydown', e => { if (e.key === 'Enter') { const el = e.target.closest?.('[data-p],[data-c]'); if (el) el.click(); } });
$('#menu').onclick = () => { const o = $('#nav').classList.toggle('open'); $('#menu').setAttribute('aria-expanded', o); };
load();
