// NeuroAccess — popup.js
'use strict';

const MODES = ['dyslexia','adhd','autism','literacy','elderly'];

const MODE_META = {
  dyslexia: { label:'📖 Dyslexia Mode active',   strip:'mode-dys-active'  },
  adhd:     { label:'🎯 ADHD Focus Mode active',  strip:'mode-adhd-active' },
  autism:   { label:'🗂️ Autism Mode active',      strip:'mode-aut-active'  },
  literacy: { label:'🔤 Low Literacy Mode active', strip:'mode-lit-active'  },
  elderly:  { label:'👴 Elderly Mode active',      strip:'mode-eld-active'  },
};

// Score ring constants
const CIRCUMFERENCE = 2 * Math.PI * 27; // r=27 → 169.6

let state = { activeMode: null, guideOn: false, simplifyOn: false };
let tabId = null;

// ── Boot ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  tabId = tab.id;

  await loadState();
  renderUI();
  runAnalysis();
  bindEvents();
});

// ── State ───────────────────────────────────────────
async function loadState() {
  return new Promise(r => chrome.storage.local.get(['naState'], d => {
    if (d.naState) state = { ...state, ...d.naState };
    r();
  }));
}
function saveState() { chrome.storage.local.set({ naState: state }); }

// ── Render ──────────────────────────────────────────
function renderUI() {
  // Mode buttons
  MODES.forEach(m => {
    const btn = document.getElementById(m);
    if (!btn) return;
    const on = state.activeMode === m;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', String(on));
  });

  // Tools
  setTool('guide',    state.guideOn);
  setTool('simplify', state.simplifyOn);

  // Active strip
  const strip = document.getElementById('activeStrip');
  const lbl   = document.getElementById('asLabel');
  if (state.activeMode) {
    const meta = MODE_META[state.activeMode];
    strip.classList.remove('hidden');
    // reset colour classes
    strip.className = 'active-strip ' + meta.strip;
    lbl.textContent = meta.label;
  } else {
    strip.classList.add('hidden');
    strip.className = 'active-strip hidden';
  }
}

function setTool(name, on) {
  const btn    = document.getElementById(name);
  const status = document.getElementById(name + 'Status');
  if (!btn) return;
  btn.classList.toggle('active', on);
  btn.setAttribute('aria-pressed', String(on));
  if (status) status.textContent = on ? 'On' : 'Off';
}

// ── Events ──────────────────────────────────────────
function bindEvents() {
  MODES.forEach(m => document.getElementById(m)?.addEventListener('click', () => toggleMode(m)));
  document.getElementById('guide')?.addEventListener('click',    () => toggleTool('guide'));
  document.getElementById('simplify')?.addEventListener('click', () => toggleTool('simplify'));
  document.getElementById('resetBtn')?.addEventListener('click', resetAll);
  document.getElementById('runAuditBtn')?.addEventListener('click', runAudit);
}

// ── Mode toggle ─────────────────────────────────────
async function toggleMode(mode) {
  const turningOn = state.activeMode !== mode;
  if (state.activeMode) await msg({ action: 'disableMode', mode: state.activeMode });
  state.activeMode = turningOn ? mode : null;
  if (turningOn) await msg({ action: 'enableMode', mode });
  saveState(); renderUI();
}

async function toggleTool(tool) {
  if (tool === 'guide') {
    state.guideOn = !state.guideOn;
    await msg({ action: state.guideOn ? 'enableGuide' : 'disableGuide' });
  } else {
    state.simplifyOn = !state.simplifyOn;
    await msg({ action: state.simplifyOn ? 'enableSimplify' : 'disableSimplify' });
  }
  saveState(); renderUI();
}

async function resetAll() {
  if (state.activeMode) { await msg({ action: 'disableMode', mode: state.activeMode }); state.activeMode = null; }
  if (state.guideOn)    { await msg({ action: 'disableGuide' });    state.guideOn    = false; }
  if (state.simplifyOn) { await msg({ action: 'disableSimplify' }); state.simplifyOn = false; }
  await msg({ action: 'resetAll' });
  saveState(); renderUI();
}

// ── Complexity analysis ─────────────────────────────
async function runAnalysis() {
  const res = await msg({ action: 'analyzePage' });
  if (!res) return;

  const { level, avgSentenceLen, wordCount } = res;
  const pct = { easy: 0.22, moderate: 0.56, complex: 0.90 }[level] || 0.5;
  const colours = { easy: '#16A34A', moderate: '#CA8A04', complex: '#E11D48' };
  const labels  = { easy: 'Easy Read', moderate: 'Moderate', complex: 'Complex' };

  // Animate ring
  const fill = document.getElementById('srFill');
  const num  = document.getElementById('scoreNum');
  if (fill) {
    fill.style.stroke = colours[level] || '#3B82F6';
    fill.style.strokeDashoffset = CIRCUMFERENCE * (1 - pct);
  }
  if (num) { num.textContent = labels[level] ? labels[level].split(' ')[0][0] + Math.round(pct*100) : '?'; num.style.color = colours[level]; }

  // Chips
  ['Easy','Mod','Hard'].forEach(id => document.getElementById('chip'+id)?.classList.remove('active-chip'));
  const chipMap = { easy:'chipEasy', moderate:'chipMod', complex:'chipHard' };
  document.getElementById(chipMap[level])?.classList.add('active-chip');

  // Label
  const lbl = document.getElementById('scoreLbl');
  if (lbl) lbl.textContent = `~${avgSentenceLen} words/sentence · ${wordCount.toLocaleString()} words`;
}

// ── WCAG Audit ──────────────────────────────────────
async function runAudit() {
  const box = document.getElementById('auditResults');
  const btn = document.getElementById('runAuditBtn');
  box.classList.remove('hidden');
  box.innerHTML = '<div class="audit-spin"><div class="spinner"></div><span>Running WCAG audit…</span></div>';
  btn.disabled = true;

  const res = await msg({ action: 'runAxeAudit' });
  btn.disabled = false;

  if (!res) { box.innerHTML = '<div class="audit-spin">⚠ Could not reach page. Reload tab first.</div>'; return; }
  if (res.error) { box.innerHTML = `<div class="audit-spin">⚠ ${esc(res.error)}</div>`; return; }

  const { violations, passes, incomplete } = res;
  let html = `
    <div class="audit-row viol"><span class="audit-count">${violations.length}</span> violation${violations.length!==1?'s':''}</div>
    <div class="audit-row pass"><span class="audit-count">${passes}</span> rule${passes!==1?'s':''} passed</div>
    <div class="audit-row inc"><span class="audit-count">${incomplete}</span> need review</div>
  `;
  violations.slice(0,3).forEach(v => {
    html += `<div class="audit-vitem"><strong>${esc(v.id)} [${esc(v.impact||'?')}]</strong>${esc(v.description)}</div>`;
  });
  if (violations.length > 3) html += `<div style="font-size:10px;color:var(--ink3);margin-top:3px">…and ${violations.length-3} more</div>`;
  box.innerHTML = html;
}

// ── Messaging ───────────────────────────────────────
function msg(payload) {
  return new Promise(r => {
    if (!tabId) return r(null);
    chrome.tabs.sendMessage(tabId, payload, resp => {
      if (chrome.runtime.lastError) { console.warn('[NA]', chrome.runtime.lastError.message); r(null); }
      else r(resp || null);
    });
  });
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
