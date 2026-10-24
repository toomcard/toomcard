// 미니 홈페이지: toomcard.com/<아이디>/page
// 카드 데이터(card.page)를 읽어 page.html 틀에 제목·미리보기 이미지·데이터를 넣어 돌려준다. 미니홈을 켜지 않은 카드는 카드로 돌려보낸다.
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.TC_SUPABASE_URL || 'https://omlcbrslzvdtqwbszgvg.supabase.co';
const SUPABASE_ANON_KEY = process.env.TC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tbGNicnNsenZkdHF3YnN6Z3ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3Mzc4NTQsImV4cCI6MjEwODMxMzg1NH0.j2YVNIFIit7nzvaGGCprpFhPQfpQ6cQCf5n-2Dctg3g';
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = async (req, res) => {
  const mode = (req.query && req.query.mode) === 'links' ? 'links' : 'home';
  const raw = decodeURIComponent(String((req.query && req.query.slug) || '')).trim();
  const slug = raw.replace(/[^a-zA-Z0-9_\-\/.가-힣]/g, '').slice(0, 80);
  if (!slug) return res.status(404).send('');
  let card = null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/pods?select=components_json&slug=eq.${encodeURIComponent(slug)}&limit=1`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
    });
    const rows = await r.json();
    const cj = Array.isArray(rows) && rows[0] && rows[0].components_json;
    card = cj ? (cj.card || cj) : null;
  } catch (e) {}
  // 공식 데모 카드(cards/demo.*.json)는 DB 에 없어도 연다
  if (!card && /^demo\.[a-z0-9.]+$/.test(slug)) {
    try { const f = path.join(process.cwd(), 'cards', slug + '.json'); if (fs.existsSync(f)) card = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) {}
  }
  // 별칭(바뀐 아이디)이면 새 주소의 미니홈으로
  if (!card) {
    try {
      const ar = await fetch(`${SUPABASE_URL}/rest/v1/tc_slug_alias?select=new_slug&old_slug=eq.${encodeURIComponent(slug)}&limit=1`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
      const rows = await ar.json();
      if (Array.isArray(rows) && rows[0] && rows[0].new_slug) { res.setHeader('Location', '/' + rows[0].new_slug.split('/').map(encodeURIComponent).join('/') + (mode === 'links' ? '/links' : '/page')); return res.status(301).send(''); }
    } catch (e) {}
    return res.status(404).send('');
  }
  const page = card.page || {};
  const ml = card.ml || (card.kind === 'multilink' && page.blocks ? { on: true, blocks: page.blocks } : {});
  const isOn = mode === 'links' ? (ml.on || card.kind === 'multilink') : (page.on || card.kind === 'minihome');
  if (!isOn) { res.setHeader('Location', '/' + slug.split('/').map(encodeURIComponent).join('/')); return res.status(302).send(''); }

  // 이젠스타에 올린 카드는 미니홈에서도 실명 대신 대화명/가린 이름
  const mask = (n) => { const t = String(n || '').trim(); return t ? t.charAt(0) + '○'.repeat(Math.max(1, Math.min(t.length - 1, 2))) : ''; };
  const starOn = card.star && card.star.on && !(req.query && req.query.k);
  const shownName = starOn ? (String(card.star.nick || '').trim() || mask(card.name)) : (card.name || '');
  const pub = {
    slug, mode, kind: card.kind || 'personal', hasCard: card.cardOn !== false && !['multilink', 'minihome'].includes(card.kind), hasHome: !!(page.on || card.kind === 'minihome'), hasLinks: !!(ml.on || card.kind === 'multilink'), name: shownName, company: card.company || '', role: card.role || '', industry: card.industry || '', industryText: card.industryText || '',
    region: card.region || null, logo: (card.logo && card.logo.src && !/\/assets\/(logo_toomcard|logo_toomus|logo_setupod|toomcard_hd)/.test(card.logo.src)) ? card.logo.src : '', avatar: (card.avatar && !/\/assets\/logo_/.test(card.avatar)) ? card.avatar : '',
    front: card.front && card.front.bg && card.front.bg.type === 'image' ? card.front.bg.src : (card.plateCardImage || ''),
    socials: (card.socials || []).filter((s) => s && s.url && !['kakao', 'whatsapp', 'telegram'].includes(s.type)).slice(0, 8),
    website: card.primaryAction && card.primaryAction.url && card.primaryAction.url !== '#' ? card.primaryAction.url : '',
    phone: starOn ? '' : (card.phone || ''), star: !!starOn,
    page: { title: page.title || '', intro: page.intro || '', gallery: (page.gallery || []).slice(0, 12), items: (page.items || []).slice(0, 20),
            address: page.address || '', mapUrl: page.mapUrl || '', hours: page.hours || '', reviews: (page.reviews || []).slice(0, 10), news: (page.news || []).slice(0, 10), blocks: mode === 'links' ? (ml.blocks || []).slice(0, 20) : (page.blocks || []).slice(0, 20), mlTitle: ml.title || '', phone: String(page.phone || '').replace(/[^0-9+\-() ]/g, '').slice(0, 24), layout: ['shop', 'room'].includes(page.layout) ? page.layout : '', skin: ['sky', 'pink', 'mint', 'night'].includes(page.skin) ? page.skin : '', mood: String(page.mood || '').slice(0, 60), bgm: /^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(page.bgm || '') ? page.bgm : '' },
    friend: card.friend && card.friend.id ? { id: String(card.friend.id).replace(/[^a-z0-9-]/gi, '').slice(0, 20), color: /^#[0-9a-f]{3,8}$/i.test(card.friend.color || '') ? card.friend.color : '' } : null
  };
  const head = (mode === 'links' ? (ml.title || pub.name) : (pub.page.title || pub.company || pub.name));
  const title = head === pub.name ? `${pub.name} - TOOMCARD` : `${head} | ${pub.name} - TOOMCARD`;
  const desc = (pub.page.intro || '').replace(/\s+/g, ' ').slice(0, 120) || `${pub.name}의 미니 홈페이지`;
  let html = fs.readFileSync(path.join(process.cwd(), 'page.html'), 'utf8');
  const og = `https://toomcard.com/api/ogimg?s=${encodeURIComponent(slug)}`;
  html = html.replace('<title>TOOMCARD</title>', `<title>${esc(title)}</title>`)
    .replace('<!--META-->', `<meta name="description" content="${esc(desc)}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${esc(og)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:url" content="https://toomcard.com/${esc(slug)}${mode === 'links' ? '/links' : '/page'}"><meta property="twitter:card" content="summary_large_image"><meta property="twitter:title" content="${esc(title)}"><meta property="twitter:image" content="${esc(og)}">`)
    .replace('<!--DATA-->', `<script>window.PAGE_DATA = ${JSON.stringify(pub).replace(/</g, '\\u003c')};</script>`);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
  return res.status(200).send(html);
};
