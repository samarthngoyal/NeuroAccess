// NeuroAccess — content.js  (Final Production Build)
// Handles Amazon, Flipkart, banking sites, news sites, blogs — all safely.
'use strict';

// ══════════════════════════════════════════════════
//  SIMPLIFICATION DICTIONARY
// ══════════════════════════════════════════════════
const DICT = {
  utilize:'use', utilise:'use', utilization:'use', utilisation:'use',
  individuals:'people', individual:'person',
  approximately:'about', approximate:'close',
  numerous:'many', multiple:'many',
  demonstrate:'show', demonstrates:'shows', demonstrated:'showed',
  facilitate:'help', facilitates:'helps', facilitated:'helped',
  implement:'use', implementing:'using', implemented:'used',
  regarding:'about', concerning:'about',
  sufficient:'enough', insufficient:'not enough',
  require:'need', requires:'needs', required:'needed',
  obtain:'get', obtaining:'getting', obtained:'got',
  determine:'find out', determines:'finds out',
  commence:'start', commences:'starts', commenced:'started',
  terminate:'end', terminates:'ends', terminated:'ended',
  assistance:'help', assist:'help', assists:'helps',
  purchase:'buy', purchases:'buys', purchased:'bought',
  residence:'home', residences:'homes',
  employment:'work', employer:'boss',
  subsequently:'later', consequently:'so', therefore:'so',
  nevertheless:'still', nonetheless:'still',
  comprehend:'understand', comprehension:'understanding',
  adequate:'enough', inadequate:'not enough',
  accomplish:'do', accomplishes:'does', accomplished:'done',
  enormous:'huge', considerable:'large', substantial:'large',
  beneficial:'helpful', detrimental:'harmful',
  prior:'before', subsequent:'after', preceding:'earlier',
  initiate:'start', initiates:'starts', initiated:'started',
  possess:'have', possesses:'has', possessed:'had',
  reside:'live', resides:'lives', resided:'lived',
  inquire:'ask', inquires:'asks', inquired:'asked',
  component:'part', components:'parts',
  objective:'goal', objectives:'goals',
  methodology:'method', methodologies:'methods',
  formulate:'make', formulates:'makes', formulated:'made',
  indicate:'show', indicates:'shows', indicated:'showed',
  provide:'give', provides:'gives', provided:'gave',
  receive:'get', receives:'gets', received:'got',
  modification:'change', modifications:'changes',
  requirement:'need', requirements:'needs',
  ramifications:'effects', multifaceted:'complex',
  encompassing:'including', contemporary:'modern',
  preliminary:'early', corroborate:'confirm',
  augmented:'increased', dependency:'reliance',
  obsolete:'outdated', legislative:'legal',
  concurrently:'at the same time', unprecedented:'never seen before',
  breakthrough:'discovery',
};
const DICT_RE = new RegExp('\\b(' + Object.keys(DICT).join('|') + ')\\b', 'gi');

// ══════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════
let activeMode      = null;
let styleEls        = [];        // all injected <style> tags
let hiddenEls       = [];        // { el, oldDisplay } — for safe restore
let guideEl         = null;
let simplifiedNodes = [];
let observer        = null;
let adhdParas       = [];
let progressBar     = null;
let progressScrollFn = null;

// ══════════════════════════════════════════════════
//  MESSAGE ROUTER
// ══════════════════════════════════════════════════
chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  try {
    switch (msg.action) {
      case 'analyzePage':    reply(analyzePage());     break;
      case 'enableMode':     enableMode(msg.mode);     reply({ ok: true }); break;
      case 'disableMode':    disableMode(msg.mode);    reply({ ok: true }); break;
      case 'enableGuide':    enableGuide();            reply({ ok: true }); break;
      case 'disableGuide':   disableGuide();           reply({ ok: true }); break;
      case 'enableSimplify': simplifyText();           reply({ ok: true }); break;
      case 'disableSimplify':restoreText();            reply({ ok: true }); break;
      case 'resetAll':       resetAll();               reply({ ok: true }); break;
      case 'runAxeAudit':
        runAudit().then(reply).catch(e => reply({ error: e.message }));
        break;
      default: reply({ error: 'unknown action' });
    }
  } catch (e) {
    reply({ error: e.message });
  }
  return true; // keep channel open for async
});

// ══════════════════════════════════════════════════
//  PAGE COMPLEXITY ANALYSIS
// ══════════════════════════════════════════════════
function analyzePage() {
  // Prefer readable text containers; fall back to body
  const containers = [
    ...document.querySelectorAll('article, main, [role="main"], .content, #content, #main')
  ];
  let text = containers.length
    ? containers.map(e => e.innerText || '').join(' ')
    : (document.body?.innerText || '');

  const words     = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 4);
  const sentCount = Math.max(sentences.length, 1);
  const avgSentenceLen = Math.round(wordCount / sentCount);

  const level = (avgSentenceLen <= 12 && wordCount < 400)  ? 'easy'
              : (avgSentenceLen <= 22 && wordCount < 1200)  ? 'moderate'
              : 'complex';

  return { level, avgSentenceLen, wordCount, sentCount };
}

// ══════════════════════════════════════════════════
//  MODE LIFECYCLE
// ══════════════════════════════════════════════════
function enableMode(mode) {
  if (activeMode) teardownCurrentMode();
  activeMode = mode;
  document.documentElement.setAttribute('data-na-mode', mode);
  switch (mode) {
    case 'dyslexia': applyDyslexia(); break;
    case 'adhd':     applyADHD();     break;
    case 'autism':   applyAutism();   break;
    case 'literacy': applyLiteracy(); break;
    case 'elderly':  applyElderly();  break;
  }
  startObserver(mode);
}

function disableMode(mode) {
  if (activeMode === mode) teardownCurrentMode();
}

function teardownCurrentMode() {
  if (!activeMode) return;

  stopObserver();
  document.documentElement.removeAttribute('data-na-mode');

  // Remove all injected styles
  styleEls.forEach(el => { try { el.remove(); } catch (_) {} });
  styleEls = [];

  // Restore all hidden elements
  hiddenEls.forEach(({ el, oldDisplay }) => {
    try {
      el.style.removeProperty('display');
      if (oldDisplay) el.style.display = oldDisplay;
      delete el.dataset.naHidden;
    } catch (_) {}
  });
  hiddenEls = [];

  // Remove injected DOM nodes
  document.querySelectorAll(
    '#na-badge, #na-progress, #na-tts-bar, .na-section-warn'
  ).forEach(el => { try { el.remove(); } catch (_) {} });

  // Restore ADHD paragraphs
  adhdParas.forEach(p => {
    try {
      ['opacity','background','border','border-radius','padding','color','cursor','transition','box-shadow']
        .forEach(prop => p.style.removeProperty(prop));
      if (p._naEnter) p.removeEventListener('mouseenter', p._naEnter);
      delete p._naEnter;
    } catch (_) {}
  });
  adhdParas = [];

  // Remove progress bar scroll listener
  if (progressScrollFn) {
    window.removeEventListener('scroll', progressScrollFn);
    progressScrollFn = null;
    progressBar = null;
  }

  activeMode = null;
}

function resetAll() {
  teardownCurrentMode();
  disableGuide();
  restoreText();
}

// ══════════════════════════════════════════════════
//  SAFE CONTENT DETECTION
//  Works on Amazon, Flipkart, banks, news, blogs.
//  Returns the best readable container or null.
// ══════════════════════════════════════════════════
function findMainContent() {
  // Priority order — most semantic first
  const SELECTORS = [
    'main', '[role="main"]', 'article',
    '#content', '#main', '#main-content', '#page-content',
    '.main-content', '.article-body', '.post-content',
    '.entry-content', '.story-body', '.page-content',
    // e-commerce product pages
    '#dp', '#ppd',                           // Amazon product detail
    '#productDescriptionWrapper',
    '.product-description', '.pdp-content',  // Flipkart / generic
    '#item-description',
    // Banking / forms
    '.main-wrapper', '.page-wrapper', '#wrapper',
  ];
  for (const sel of SELECTORS) {
    const el = document.querySelector(sel);
    if (el && el.innerText?.trim().length > 80) return el;
  }
  return null;
}

// ══════════════════════════════════════════════════
//  SAFE AD / CLUTTER HIDING
//  NEVER hides: nav, header, search bars, checkout,
//  cart, login forms, bank account panels.
//  Only hides elements that are provably decorative
//  or advertising.
// ══════════════════════════════════════════════════
const SAFE_CLUTTER_SELECTORS = [
  // Pure ad slots
  '[class*="ad-slot"]', '[class*="ad-unit"]', '[class*="adslot"]',
  '[class*="advertisement"]', '[class*="adsense"]',
  '[id*="ad-slot"]', '[id*="adunit"]',
  'ins.adsbygoogle',
  'iframe[src*="doubleclick"]', 'iframe[src*="googlesyndication"]',
  'iframe[src*="amazon-adsystem"]',
  // Sidebars that are not navigation (use very specific patterns)
  '[class*="sidebar-widget"]', '[class*="widget-area"]',
  '[id*="sidebar"]',
  // Social share / related
  '[class*="social-share"]', '[class*="share-buttons"]',
  '[class*="related-posts"]', '[class*="recommended-articles"]',
  '[class*="also-read"]', '[class*="more-stories"]',
  // Newsletter / cookie banners (non-functional)
  '[class*="newsletter-signup"]', '[class*="cookie-banner"]',
  '[class*="cookie-consent"]', '[id*="cookie-banner"]',
  // Floating promos / chat widgets (not bank portals)
  '[class*="livechat"]:not([class*="support"])',
  '[class*="promo-banner"]', '[class*="offer-banner"]',
];

// Elements that must NEVER be hidden regardless of class name
function isFunctionalElement(el) {
  // Protect navigation, search, forms, checkout, account panels
  const tag = el.tagName?.toLowerCase();
  if (['nav','header','form','input','button','select','textarea'].includes(tag)) return true;
  const role = el.getAttribute('role') || '';
  if (['navigation','search','banner','main','form','dialog','alertdialog'].includes(role)) return true;
  // Protect by common e-commerce / banking identifiers
  const id  = (el.id || '').toLowerCase();
  const cls = (el.className || '').toLowerCase();
  const combined = id + ' ' + cls;
  const PROTECT = [
    'nav','menu','search','checkout','cart','basket','account','login',
    'header','topbar','toolbar','breadcrumb','pagination',
    'filter','sort','price','buy','payment','bank','transfer',
    'balance','transaction','otp','verify','auth',
  ];
  return PROTECT.some(kw => combined.includes(kw));
}

function hideClutter() {
  SAFE_CLUTTER_SELECTORS.forEach(sel => {
    let els;
    try { els = document.querySelectorAll(sel); } catch (_) { return; }
    els.forEach(el => {
      if (isFunctionalElement(el)) return;
      if (el.dataset.naHidden) return;
      const oldDisplay = el.style.display || '';
      el.dataset.naHidden = '1';
      el.style.setProperty('display', 'none', 'important');
      hiddenEls.push({ el, oldDisplay });
    });
  });
}

// ══════════════════════════════════════════════════
//  STYLE INJECTION (stacks multiple style tags)
// ══════════════════════════════════════════════════
function addStyle(css, id) {
  // Remove same-id style if exists
  const existing = document.getElementById('na-style-' + id);
  if (existing) existing.remove();
  const el = document.createElement('style');
  el.id = 'na-style-' + id;
  el.textContent = css;
  (document.head || document.documentElement).appendChild(el);
  styleEls.push(el);
  return el;
}

// ══════════════════════════════════════════════════
//  MODE BADGE
// ══════════════════════════════════════════════════
function insertBadge(text, color, bg) {
  document.getElementById('na-badge')?.remove();
  const badge = document.createElement('div');
  badge.id = 'na-badge';
  badge.setAttribute('aria-live', 'polite');
  badge.textContent = text;
  Object.assign(badge.style, {
    position:     'fixed',
    top:          '10px',
    left:         '50%',
    transform:    'translateX(-50%)',
    background:   bg,
    border:       `2px solid ${color}`,
    color:        color,
    fontSize:     '11px',
    fontWeight:   '800',
    fontFamily:   "'Nunito', 'Segoe UI', sans-serif",
    padding:      '5px 18px',
    borderRadius: '20px',
    zIndex:       '2147483647',
    whiteSpace:   'nowrap',
    boxShadow:    '0 4px 20px rgba(0,0,0,.14)',
    letterSpacing:'.02em',
    pointerEvents:'none',
  });
  (document.body || document.documentElement).appendChild(badge);
}

// ══════════════════════════════════════════════════
//  ① DYSLEXIA MODE
//  Sky blue #0EA5E9
//  Lexend font · wider spacing · alternating para highlights
//  Works on any site — uses :not() guards to skip UI chrome
// ══════════════════════════════════════════════════
function applyDyslexia() {
  hideClutter();

  addStyle(`
    @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;700&display=swap');

    /* Apply only to readable text — skip nav/button/input chrome */
    body *:not(nav):not(nav *):not(header *):not(script):not(style):not(noscript) {
      font-family: 'Lexend', 'Arial', sans-serif !important;
    }

    /* Spacing — scoped to paragraph-level text only */
    p, li, td, th, blockquote, dd, dt, figcaption {
      letter-spacing: 0.07em  !important;
      word-spacing:   0.14em  !important;
      line-height:    2.1     !important;
      text-align:     left    !important;
      max-width:      72ch    !important;
    }

    /* Page background — soft warm white */
    html, body { background: #fffef8 !important; }

    /* Alternating paragraph highlight */
    p:nth-of-type(even) {
      background: rgba(14,165,233,.07) !important;
      border-radius: 5px !important;
      padding: 4px 8px !important;
    }

    /* Heading clarity */
    h1, h2, h3, h4, h5, h6 {
      letter-spacing: 0.01em !important;
      line-height: 1.4 !important;
      word-spacing: 0.08em !important;
    }

    /* Remove justified alignment everywhere */
    * { text-align: revert !important; }
    p, li { text-align: left !important; }
  `, 'dyslexia');

  insertBadge('📖 Dyslexia Mode — Lexend Font · Wider Spacing · Highlights', '#0EA5E9', '#E0F2FE');
}

// ══════════════════════════════════════════════════
//  ② ADHD FOCUS MODE
//  Cyan #06B6D4
//  Progress bar + paragraph focus tunnel
//  Safe on e-commerce — only dims article paragraphs,
//  never touches product cards, forms, or navigation
// ══════════════════════════════════════════════════
function applyADHD() {
  hideClutter();

  addStyle(`
    html, body { background: #fffdf7 !important; }
    p, li { line-height: 1.9 !important; font-size: 15px !important; }
  `, 'adhd');

  insertBadge('🎯 ADHD Focus Mode — Distraction Free · Paragraph Focus', '#06B6D4', '#CFFAFE');

  // Progress bar
  const bar = document.createElement('div');
  bar.id = 'na-progress';
  Object.assign(bar.style, {
    position:     'fixed', top: '0', left: '0',
    height:       '4px',  width: '0%',
    background:   'linear-gradient(90deg, #06B6D4, #0EA5E9)',
    zIndex:       '2147483647',
    borderRadius: '0 3px 3px 0',
    pointerEvents:'none',
  });
  (document.body || document.documentElement).appendChild(bar);
  progressBar = bar;

  progressScrollFn = () => {
    const scrolled = window.scrollY;
    const total = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = total > 0 ? Math.min((scrolled / total) * 100, 100) + '%' : '0%';
  };
  window.addEventListener('scroll', progressScrollFn, { passive: true });

  // Paragraph focus — only target article/blog text paragraphs
  // Skip product cards, price text, nav items, buttons
  const paras = [...document.querySelectorAll(
    'article p, main p, [role="main"] p, ' +
    '.content p, .post-content p, .entry-content p, ' +
    '.article-body p, .story-body p, .page-content p'
  )].filter(p => {
    const text = p.innerText?.trim() || '';
    if (text.length < 40) return false;                  // skip tiny fragments
    if (p.closest('nav, header, footer, form')) return false; // skip chrome
    if (p.closest('[class*="product"], [class*="price"]')) return false; // skip e-commerce
    return true;
  });

  if (!paras.length) return;
  adhdParas = paras;

  paras.forEach(p => {
    Object.assign(p.style, {
      opacity:    '0.2',
      transition: 'opacity .22s ease, box-shadow .22s ease',
    });
  });

  function activate(target) {
    paras.forEach(p => {
      if (p === target) {
        p.style.opacity   = '1';
        p.style.boxShadow = '0 0 0 3px rgba(6,182,212,.25)';
        p.style.borderRadius = '6px';
        p.style.padding   = '8px 12px';
      } else {
        p.style.opacity   = '0.15';
        p.style.boxShadow = 'none';
        p.style.padding   = '';
      }
    });
  }

  activate(paras[0]);
  paras.forEach(p => {
    const fn = () => activate(p);
    p._naEnter = fn;
    p.addEventListener('mouseenter', fn);
  });
}

// ══════════════════════════════════════════════════
//  ③ AUTISM MODE
//  Blue #3B82F6
//  Structured boxes · no animations · calm palette
//  Gentle — doesn't hide functional elements
// ══════════════════════════════════════════════════
function applyAutism() {
  hideClutter();

  addStyle(`
    /* Freeze all motion */
    *, *::before, *::after {
      animation-duration:        0.001ms !important;
      animation-iteration-count: 1       !important;
      transition-duration:       0.001ms !important;
      scroll-behavior:           auto    !important;
    }

    /* Mute auto-play media */
    video { display: none !important; }
    audio { display: none !important; }

    /* Calm background */
    html, body { background: #f0f7ff !important; }

    /* Desaturate busy images slightly */
    img:not([role="presentation"]):not([alt=""]) {
      filter: saturate(0.65) !important;
    }

    /* Paragraph boxes — clear visual containers */
    p {
      background:    #ffffff      !important;
      border:        2px solid #BFDBFE !important;
      border-left:   4px solid #3B82F6 !important;
      border-radius: 8px          !important;
      padding:       12px 16px    !important;
      margin-bottom: 14px         !important;
      line-height:   1.85         !important;
      font-size:     15px         !important;
      color:         #1e293b      !important;
    }

    /* Heading label style */
    h1, h2, h3 {
      background:    #DBEAFE  !important;
      color:         #1e40af  !important;
      padding:       8px 14px !important;
      border-radius: 8px      !important;
      margin-bottom: 10px     !important;
      border:        none     !important;
    }

    /* Reduce carousel/slider visual noise */
    [class*="carousel"], [class*="slider"], [class*="marquee"],
    [class*="ticker"], [class*="rotate"] {
      animation: none !important;
    }
  `, 'autism');

  insertBadge('🗂️ Autism Mode — Structured · No Motion · Calm Layout', '#3B82F6', '#DBEAFE');

  // Section-change warnings — safe, only inside article/main
  const headings = document.querySelectorAll(
    'main h2, main h3, article h2, article h3, [role="main"] h2, [role="main"] h3'
  );
  headings.forEach((h, i) => {
    try {
      const warn = document.createElement('div');
      warn.className = 'na-section-warn';
      warn.innerHTML = `📌 <span>New section: <strong>${escHtml(h.textContent.trim().slice(0,60))}</strong> — ${i + 1} of ${headings.length}</span>`;
      Object.assign(warn.style, {
        background:    '#fff8e1',
        border:        '2px solid #f4b400',
        borderRadius:  '8px',
        padding:       '9px 14px',
        fontSize:      '13px',
        fontWeight:    '700',
        fontFamily:    "'Nunito','Segoe UI',sans-serif",
        color:         '#7a5900',
        display:       'flex',
        alignItems:    'center',
        gap:           '8px',
        marginBottom:  '10px',
      });
      h.parentNode?.insertBefore(warn, h);
    } catch (_) {}
  });
}

// ══════════════════════════════════════════════════
//  ④ LOW LITERACY MODE
//  Violet #8B5CF6
//  Large font · TTS bar
//  Word simplification is a separate manual tool
// ══════════════════════════════════════════════════
function applyLiteracy() {
  hideClutter();

  addStyle(`
    html, body { background: #fdf8ff !important; }

    /* Larger readable text — skip nav/UI chrome */
    p, li, td, th, blockquote, dd, dt {
      font-size:   18px !important;
      line-height: 2.0  !important;
      color:       #0f172a !important;
    }
    p { margin-bottom: 1.3em !important; }

    h1 { font-size: 1.8em !important; }
    h2 { font-size: 1.5em !important; }
    h3 { font-size: 1.3em !important; }
  `, 'literacy');

  insertBadge('🔤 Low Literacy Mode — Larger Text · TTS Ready · Simplified', '#8B5CF6', '#EDE9FE');

  // TTS bar — fixed at bottom
  const bar = document.createElement('div');
  bar.id = 'na-tts-bar';
  Object.assign(bar.style, {
    position:   'fixed', bottom: '0', left: '0', right: '0',
    background: '#0F172A',
    padding:    '9px 20px',
    display:    'flex',
    alignItems: 'center',
    gap:        '12px',
    zIndex:     '2147483646',
    boxShadow:  '0 -4px 20px rgba(0,0,0,.22)',
  });

  const playBtn = makeBtn('▶ Read Aloud', { background:'#8B5CF6', color:'#fff', border:'none' });
  const stopBtn = makeBtn('■ Stop', {
    background:'transparent', color:'#fff',
    border:'1.5px solid rgba(255,255,255,.3)', display:'none',
  });
  const lbl = document.createElement('span');
  lbl.textContent = '🔊 Reads the main content aloud';
  Object.assign(lbl.style, { fontSize:'12px', color:'rgba(255,255,255,.55)', flex:'1' });

  bar.appendChild(playBtn);
  bar.appendChild(stopBtn);
  bar.appendChild(lbl);
  (document.body || document.documentElement).appendChild(bar);

  let utt = null;

  playBtn.addEventListener('click', () => {
    if (utt) { speechSynthesis.cancel(); utt = null; }
    const main = document.querySelector('main,article,[role="main"],.content,#content') || document.body;
    const text = main.innerText.slice(0, 3000);
    utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.88;
    utt.onstart = () => { playBtn.style.display = 'none'; stopBtn.style.display = 'inline-block'; };
    utt.onend = utt.onerror = () => { utt = null; playBtn.style.display = 'inline-block'; stopBtn.style.display = 'none'; };
    speechSynthesis.speak(utt);
  });
  stopBtn.addEventListener('click', () => {
    speechSynthesis.cancel(); utt = null;
    playBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';
  });
}

function makeBtn(text, styles) {
  const btn = document.createElement('button');
  btn.textContent = text;
  Object.assign(btn.style, {
    padding:'7px 16px', borderRadius:'7px',
    fontSize:'13px', fontWeight:'700', cursor:'pointer',
    fontFamily:"'Nunito','Segoe UI',sans-serif",
    ...styles,
  });
  return btn;
}

// ══════════════════════════════════════════════════
//  ⑤ ELDERLY MODE
//  Rose #F43F5E
//  Large text · high contrast · bigger targets
//  No tooltips (removed per spec)
//  Safe on banking / e-commerce — doesn't break forms
// ══════════════════════════════════════════════════
function applyElderly() {
  hideClutter();

  addStyle(`
    /* Stop animations — important for elderly comfort */
    *, *::before, *::after {
      animation-duration:        0.001ms !important;
      animation-iteration-count: 1       !important;
      transition-duration:       0.001ms !important;
    }

    /* Large readable text — skip tiny UI labels in nav/inputs */
    p, li, td, th, blockquote, dd, .product-title,
    [class*="description"], [class*="detail"] {
      font-size:   20px !important;
      line-height: 2.0  !important;
      color:       #0f172a !important;
    }

    h1 { font-size: 2.0em  !important; margin-bottom: .5em !important; }
    h2 { font-size: 1.6em  !important; }
    h3 { font-size: 1.4em  !important; }

    /* High contrast links */
    a { color: #1D4ED8 !important; text-decoration: underline !important; }
    a:visited { color: #5b21b6 !important; }

    /* Bigger tap targets — but ONLY visually, don't break layout */
    button:not([class*="na-"]),
    input[type="button"],
    input[type="submit"],
    input[type="reset"],
    [role="button"] {
      min-height:  48px !important;
      padding:     10px 20px !important;
      font-size:   17px !important;
      border-radius: 8px !important;
    }

    /* Clean background */
    html, body { background: #ffffff !important; }
  `, 'elderly');

  insertBadge('👴 Elderly Mode — Large Text · High Contrast · No Animations', '#F43F5E', '#FFE4E6');
}

// ══════════════════════════════════════════════════
//  READING GUIDE
// ══════════════════════════════════════════════════
function enableGuide() {
  if (guideEl) return;
  guideEl = document.createElement('div');
  guideEl.id = 'na-guide';
  Object.assign(guideEl.style, {
    position:      'fixed',
    left:          '0',
    width:         '100%',
    height:        '34px',
    background:    'rgba(255,220,60,.22)',
    borderTop:     '2px solid rgba(200,165,0,.35)',
    borderBottom:  '2px solid rgba(200,165,0,.35)',
    pointerEvents: 'none',
    zIndex:        '2147483647',
    top:           '-100px',
  });
  (document.body || document.documentElement).appendChild(guideEl);
  document.addEventListener('mousemove', _moveGuide, { passive: true });
}

function _moveGuide(e) {
  if (guideEl) guideEl.style.top = (e.clientY - 17) + 'px';
}

function disableGuide() {
  document.removeEventListener('mousemove', _moveGuide);
  if (guideEl) { guideEl.remove(); guideEl = null; }
}

// ══════════════════════════════════════════════════
//  TEXT SIMPLIFICATION
// ══════════════════════════════════════════════════
function simplifyText() {
  simplifiedNodes = [];
  if (!document.body) return;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const tag = node.parentElement?.tagName?.toLowerCase() || '';
      if (['script','style','noscript','textarea','input','code','pre','svg'].includes(tag))
        return NodeFilter.FILTER_REJECT;
      // Skip nav / header text
      if (node.parentElement?.closest('nav, header')) return NodeFilter.FILTER_SKIP;
      DICT_RE.lastIndex = 0;
      return DICT_RE.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });

  let node;
  while ((node = walker.nextNode())) {
    const orig = node.nodeValue;
    DICT_RE.lastIndex = 0;
    const rep = orig.replace(DICT_RE, m => {
      const sub = DICT[m.toLowerCase()];
      if (!sub) return m;
      return m[0] === m[0].toUpperCase() && m[0] !== m[0].toLowerCase()
        ? sub[0].toUpperCase() + sub.slice(1)
        : sub;
    });
    if (rep !== orig) {
      simplifiedNodes.push({ node, orig });
      node.nodeValue = rep;
    }
  }
}

function restoreText() {
  simplifiedNodes.forEach(({ node, orig }) => {
    try { node.nodeValue = orig; } catch (_) {}
  });
  simplifiedNodes = [];
}

// ══════════════════════════════════════════════════
//  MUTATION OBSERVER
//  Reapplies clutter hiding to dynamically injected nodes
//  (lazy-loaded ads, infinite scroll, chat widgets)
// ══════════════════════════════════════════════════
function startObserver(mode) {
  stopObserver();
  let debounceTimer = null;

  observer = new MutationObserver(muts => {
    const hasAdded = muts.some(m => m.addedNodes.length > 0);
    if (!hasAdded) return;

    // Debounce to avoid thrashing on rapid mutations (React/Vue SPA renders)
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      // Re-hide any newly injected clutter
      hideClutter();

      // ADHD: hide newly injected ad/sidebar nodes
      if (mode === 'adhd') {
        const AD_QUICK = [
          '[class*="ad-slot"]','[class*="ad-unit"]','ins.adsbygoogle',
          '[id*="ad-"]','[class*="sponsored"]',
        ];
        muts.forEach(m => m.addedNodes.forEach(n => {
          if (n.nodeType !== Node.ELEMENT_NODE) return;
          AD_QUICK.forEach(sel => {
            try {
              if (n.matches(sel) && !isFunctionalElement(n))
                n.style.setProperty('display','none','important');
              n.querySelectorAll(sel).forEach(c => {
                if (!isFunctionalElement(c))
                  c.style.setProperty('display','none','important');
              });
            } catch (_) {}
          });
        }));
      }

      // Autism: hide newly injected videos
      if (mode === 'autism') {
        muts.forEach(m => m.addedNodes.forEach(n => {
          if (n.nodeType !== Node.ELEMENT_NODE) return;
          if (['VIDEO','AUDIO'].includes(n.tagName))
            n.style.setProperty('display','none','important');
          n.querySelectorAll?.('video,audio').forEach(v =>
            v.style.setProperty('display','none','important')
          );
        }));
      }
    }, 150);
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

function stopObserver() {
  if (observer) { observer.disconnect(); observer = null; }
}

// ══════════════════════════════════════════════════
//  BUILT-IN WCAG AUDIT ENGINE
// ══════════════════════════════════════════════════
async function runAudit() {
  const violations = [], passes = [], incomplete = [];

  AUDIT_RULES.forEach(rule => {
    try {
      const r = rule.check();
      if (r.status === 'violation')
        violations.push({ id: rule.id, description: rule.description, impact: rule.impact, nodes: r.count });
      else if (r.status === 'pass')
        passes.push(rule.id);
      else
        incomplete.push(rule.id);
    } catch (_) { incomplete.push(rule.id); }
  });

  return { violations, passes: passes.length, incomplete: incomplete.length };
}

const AUDIT_RULES = [
  {
    id:'image-alt', impact:'critical', description:'Images must have alt text',
    check() {
      const bad = [...document.querySelectorAll('img')].filter(i => {
        if (i.getAttribute('alt') === '') return false;
        if (['presentation','none'].includes(i.getAttribute('role'))) return false;
        if (i.getAttribute('aria-label') || i.getAttribute('aria-labelledby')) return false;
        return i.getAttribute('alt') === null;
      });
      return bad.length ? { status:'violation', count:bad.length } : { status:'pass', count:0 };
    }
  },
  {
    id:'label', impact:'critical', description:'Form inputs must have labels',
    check() {
      const bad = [...document.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]),select,textarea'
      )].filter(el => {
        if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title')) return false;
        if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return false;
        if (el.closest('label')) return false;
        return true;
      });
      return bad.length ? { status:'violation', count:bad.length } : { status:'pass', count:0 };
    }
  },
  {
    id:'document-title', impact:'serious', description:'Page must have a <title>',
    check() { return document.title?.trim() ? { status:'pass', count:0 } : { status:'violation', count:1 }; }
  },
  {
    id:'html-has-lang', impact:'serious', description:'<html> must have a lang attribute',
    check() { return document.documentElement.getAttribute('lang') ? { status:'pass', count:0 } : { status:'violation', count:1 }; }
  },
  {
    id:'landmark-one-main', impact:'moderate', description:'Page must have one main landmark',
    check() {
      const n = document.querySelectorAll('main,[role="main"]').length;
      return n === 1 ? { status:'pass', count:0 } : n === 0 ? { status:'violation', count:1 } : { status:'incomplete', count:n };
    }
  },
  {
    id:'page-has-heading-one', impact:'moderate', description:'Page must have an h1',
    check() {
      return document.querySelectorAll('h1,[role="heading"][aria-level="1"]').length > 0
        ? { status:'pass', count:0 } : { status:'violation', count:1 };
    }
  },
  {
    id:'link-name', impact:'serious', description:'Links must have discernible text',
    check() {
      const bad = [...document.querySelectorAll('a[href]')].filter(a => {
        if (a.getAttribute('aria-label')?.trim() || a.getAttribute('aria-labelledby') || a.getAttribute('title')?.trim()) return false;
        if (a.textContent?.trim()) return false;
        return !a.querySelector('img[alt]')?.getAttribute('alt')?.trim();
      });
      return bad.length ? { status:'violation', count:bad.length } : { status:'pass', count:0 };
    }
  },
  {
    id:'button-name', impact:'critical', description:'Buttons must have discernible text',
    check() {
      const bad = [...document.querySelectorAll('button,[role="button"]')].filter(b => {
        if (b.getAttribute('aria-label')?.trim() || b.getAttribute('aria-labelledby') || b.getAttribute('title')?.trim()) return false;
        if (b.textContent?.trim()) return false;
        return true;
      });
      return bad.length ? { status:'violation', count:bad.length } : { status:'pass', count:0 };
    }
  },
  {
    id:'color-contrast', impact:'serious', description:'Text must meet WCAG AA contrast ratio',
    check() {
      const els = [...document.querySelectorAll('p,h1,h2,h3,li,td,label')].filter(el => {
        for (const n of el.childNodes) { if (n.nodeType === 3 && n.nodeValue.trim()) return true; }
        return false;
      }).slice(0, 40);
      if (!els.length) return { status:'incomplete', count:0 };
      let bad = 0, checked = 0;
      els.forEach(el => {
        try {
          const s  = window.getComputedStyle(el);
          const fg = _parseRgb(s.color);
          const bg = _getBg(el);
          if (!fg || !bg) return;
          const ratio = _cr(fg, bg);
          const fs    = parseFloat(s.fontSize);
          const bold  = parseInt(s.fontWeight, 10) >= 700;
          const large = fs >= 24 || (bold && fs >= 18.67);
          checked++;
          if (ratio < (large ? 3.0 : 4.5)) bad++;
        } catch (_) {}
      });
      if (!checked) return { status:'incomplete', count:0 };
      return bad > 0 ? { status:'violation', count:bad } : { status:'pass', count:0 };
    }
  },
  {
    id:'tabindex', impact:'serious', description:'tabindex > 0 should not be used',
    check() {
      const bad = [...document.querySelectorAll('[tabindex]')].filter(e => parseInt(e.getAttribute('tabindex'), 10) > 0);
      return bad.length ? { status:'violation', count:bad.length } : { status:'pass', count:0 };
    }
  },
  {
    id:'meta-viewport', impact:'critical', description:'Viewport must not disable pinch zoom',
    check() {
      const m = document.querySelector('meta[name="viewport"]');
      if (!m) return { status:'pass', count:0 };
      const c = m.getAttribute('content') || '';
      return /user-scalable\s*=\s*no/i.test(c) || /maximum-scale\s*=\s*1(?:\.0+)?(?:[^0-9]|$)/i.test(c)
        ? { status:'violation', count:1 } : { status:'pass', count:0 };
    }
  },
  {
    id:'video-caption', impact:'critical', description:'Videos must have captions',
    check() {
      const bad = [...document.querySelectorAll('video')].filter(v => !v.querySelector('track[kind="captions"],track[kind="subtitles"]'));
      return bad.length ? { status:'violation', count:bad.length } : { status:'pass', count:0 };
    }
  },
  {
    id:'duplicate-id', impact:'minor', description:'IDs must be unique',
    check() {
      const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
      const seen = new Set(); let d = 0;
      ids.forEach(id => { if (seen.has(id)) d++; seen.add(id); });
      return d > 0 ? { status:'violation', count:d } : { status:'pass', count:0 };
    }
  },
  {
    id:'heading-order', impact:'moderate', description:'Heading levels must not skip',
    check() {
      const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
      if (hs.length < 2) return { status:'pass', count:0 };
      let bad = 0, prev = 0;
      hs.forEach(h => { const l = parseInt(h.tagName[1], 10); if (prev > 0 && l > prev + 1) bad++; prev = l; });
      return bad > 0 ? { status:'violation', count:bad } : { status:'pass', count:0 };
    }
  },
  {
    id:'frame-title', impact:'serious', description:'iframes must have a title',
    check() {
      const bad = [...document.querySelectorAll('iframe,frame')].filter(f =>
        !f.getAttribute('title') && !f.getAttribute('aria-label') && !f.getAttribute('aria-labelledby')
      );
      return bad.length ? { status:'violation', count:bad.length } : { status:'pass', count:0 };
    }
  },
];

// ── Contrast helpers ─────────────────────────────
function _parseRgb(css) {
  const m = css.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  return m ? [+m[1], +m[2], +m[3]] : null;
}
function _getBg(el) {
  let n = el;
  while (n && n !== document.documentElement) {
    const bg = window.getComputedStyle(n).backgroundColor;
    if (bg && bg !== 'transparent' && !bg.startsWith('rgba(0, 0, 0, 0)')) return _parseRgb(bg);
    n = n.parentElement;
  }
  return [255, 255, 255];
}
function _lum([r, g, b]) {
  return [r, g, b].map(c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); })
    .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
}
function _cr(a, b) {
  const l1 = _lum(a), l2 = _lum(b);
  return +((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2);
}

// ── Misc helpers ─────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
