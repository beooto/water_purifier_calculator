/**
 * 深空当铺 · 净水器计算器
 * 计算逻辑基于游戏 MachinePurifier 净化公式（不考虑质量加成带来的纯度上限）
 */

const $ = (id) => document.getElementById(id);

const DEFAULTS = { perf: 0, purity: 98, vol: 10, target: 99, tab: 'sim' };
const STORAGE_KEY = 'purifier-calc-v2';

// 各场景使用到的参数（未使用的参数在界面上自动标为求解项）
const TAB_FIELDS = {
  sim: ['perf', 'purity', 'vol', 'target'],
  maxVol: ['perf', 'purity', 'target'],
  minPurity: ['perf', 'vol', 'target']
};

/* ---------------- 游戏公式 ---------------- */

const DIRT_CURVE = [
  { p: 9800, b: 1.0 },
  { p: 9400, b: 2.0 },
  { p: 8850, b: 5.0 },
  { p: 8000, b: 10.0 },
  { p: 6250, b: 15.0 },
  { p: 3750, b: 20.0 }
];

/** 污秽系数：purityInt 为万分比纯度（98.00% → 9800） */
function getDirtBonus(purityInt) {
  if (purityInt >= DIRT_CURVE[0].p) return DIRT_CURVE[0].b;
  for (let i = 1; i < DIRT_CURVE.length; i++) {
    const a = DIRT_CURVE[i - 1], b = DIRT_CURVE[i];
    if (purityInt >= b.p) return a.b + ((a.p - purityInt) / (a.p - b.p)) * (b.b - a.b);
  }
  return DIRT_CURVE[DIRT_CURVE.length - 1].b;
}

function getMult(purityInt, perf) {
  return Math.max(0, getDirtBonus(purityInt) + perf / 100) * 1.25;
}

/** 单晚清理额度（单位 µL） */
function getNightBudgetUl(volUl, purityInt, perf) {
  const mult = getMult(purityInt, perf);
  const baseUl = Math.floor((Math.min(volUl, 10000000) * 3) / 1000) + 25000;
  return { budgetUl: Math.floor(baseUl * mult), mult };
}

function getGradeMeta(purityInt) {
  if (purityInt >= 9990) return { name: '纯水', cls: 'grade-pure' };
  if (purityInt >= 9900) return { name: '优质水', cls: 'grade-high' };
  if (purityInt >= 9800) return { name: '基础水', cls: 'grade-base' };
  if (purityInt >= 9600) return { name: '幽灵水', cls: 'grade-ghost' };
  if (purityInt >= 9000) return { name: '铁锈水', cls: 'grade-rust' };
  return { name: '阴沟水', cls: 'grade-gutter' };
}

const gradeName = (purityInt) => getGradeMeta(purityInt).name;

function setGradePill(el, purityInt) {
  const { name, cls } = getGradeMeta(purityInt);
  el.textContent = name;
  el.className = `grade-pill ${cls}`;
}

const toInt = (pct) => Math.round(pct * 100);
const ml = (ul, d = 1) => `${(ul / 1000).toFixed(d)} mL`;

/* ---------------- 状态 ---------------- */

let state = { ...DEFAULTS };
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  if (saved && typeof saved === 'object') Object.assign(state, saved);
} catch (e) { /* ignore */ }
if (!TAB_FIELDS[state.tab]) state.tab = DEFAULTS.tab;

const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

function readNum(id, fallback, min, max) {
  const v = parseFloat($(id).value);
  if (isNaN(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function readInputs() {
  state.perf = readNum('perfInput', 0, -100, 1000);
  state.purity = readNum('purityInput', 98, 1, 100);
  state.vol = readNum('volInput', 10, 0.01, 1000);
  state.target = readNum('targetInput', 99, 1, 100);
}

function syncRangeTracks() {
  ['perfRange', 'purityRange', 'volRange'].forEach((id) => {
    const el = $(id);
    const min = parseFloat(el.min);
    const max = parseFloat(el.max);
    const val = parseFloat(el.value);
    const pct = Math.min(100, Math.max(0, ((val - min) / (max - min)) * 100));
    el.style.setProperty('--pct', `${pct.toFixed(2)}%`);
  });
}

function writeInputs() {
  $('perfInput').value = state.perf;
  $('perfRange').value = state.perf;
  $('purityInput').value = (+state.purity).toFixed(2);
  $('purityRange').value = state.purity;
  $('volInput').value = state.vol;
  $('volRange').value = state.vol;
  $('targetInput').value = (+state.target).toFixed(2);
  syncRangeTracks();
}

/* ---------------- 场景计算 ---------------- */

function renderSim() {
  const { perf, purity, vol, target } = state;
  const volUl = Math.round(vol * 1e6);
  const waterUl = Math.round(volUl * purity / 100);
  const contamUl = volUl - waterUl;
  const inInt = toInt(purity);

  const { budgetUl } = getNightBudgetUl(volUl, inInt, perf);
  const removedUl = Math.min(budgetUl, contamUl);
  const outPct = (waterUl + removedUl) / volUl * 100;
  const outInt = Math.floor((waterUl + removedUl) * 10000 / volUl);
  const needUl = Math.max(0, contamUl - Math.floor(volUl * (100 - target) / 100));

  $('simBefore').textContent = `${purity.toFixed(2)}%`;
  setGradePill($('simBeforeGrade'), inInt);
  $('simAfter').textContent = `${outPct.toFixed(2)}%`;
  setGradePill($('simAfterGrade'), outInt);
  $('simAfterDelta').textContent = `+${(outPct - purity).toFixed(2)}%`;

  $('simBudget').textContent = ml(budgetUl);
  $('simRemoved').textContent = ml(removedUl);
  $('simLeft').textContent = ml(contamUl - removedUl);

  const ok = outPct + 0.005 >= target;
  const badge = $('simBadge');
  badge.className = 'badge ' + (ok ? 'ok' : 'no');
  badge.textContent = ok ? '一晚达标' : '一晚不够';

  // 单晚目标推进进度条
  let progress = 100;
  if (purity < target) {
    progress = ok ? 100 : Math.min(100, Math.max(0, ((outPct - purity) / (target - purity)) * 100));
  }
  $('simProgressBar').style.width = `${progress.toFixed(1)}%`;
  $('simProgressText').textContent = purity >= target
    ? '已达标 (100%)'
    : `${progress.toFixed(1)}%`;

  $('simSummary').innerHTML = ok
    ? `这桶 <strong>${vol.toFixed(2)} L</strong> 的水需去除 <strong>${ml(needUl)}</strong> 杂质，今晚额度 <strong>${ml(budgetUl)}</strong>，足够一晚达到 <strong>${target.toFixed(2)}%</strong>。`
    : `达到 <strong>${target.toFixed(2)}%</strong> 共需去除 <strong>${ml(needUl)}</strong> 杂质，今晚只能去除 <strong>${ml(removedUl)}</strong>（还差 ${ml(needUl - removedUl)}）。可切换到「最大水量」或「最低入水纯度」查看如何一晚达标。`;

  // 多晚推演
  const tbody = $('nightBody');
  const tableWrap = $('nightTableWrap');
  const emptyTip = $('nightEmptyTip');
  tbody.innerHTML = '';

  if (purity >= target) {
    tableWrap.classList.add('hidden');
    emptyTip.classList.remove('hidden');
    $('nightsText').textContent = '已达标';
    return;
  }

  tableWrap.classList.remove('hidden');
  emptyTip.classList.add('hidden');

  let w = waterUl, hitNight = null;
  for (let n = 1; n <= 8; n++) {
    const sInt = Math.floor(w * 10000 / volUl);
    const sPct = w / volUl * 100;
    const b = getNightBudgetUl(volUl, sInt, perf);
    const rem = Math.min(b.budgetUl, volUl - w);
    w += rem;
    const ePct = w / volUl * 100;
    const eInt = Math.floor(w * 10000 / volUl);
    const hit = hitNight === null && ePct + 0.005 >= target;
    if (hit) hitNight = n;

    const meta = getGradeMeta(eInt);
    const tr = document.createElement('tr');
    if (hit) tr.className = 'hit';
    tr.innerHTML = `<td>第 ${n} 晚${hit ? ' · 达标' : ''}</td>`
      + `<td>${sPct.toFixed(2)}%</td>`
      + `<td>${ml(b.budgetUl)} (${b.mult.toFixed(2)}x)</td>`
      + `<td>${ml(rem)}</td>`
      + `<td>${ePct.toFixed(2)}%</td>`
      + `<td><span class="grade-pill ${meta.cls}">${meta.name}</span></td>`;
    tbody.appendChild(tr);
    if (hitNight !== null || rem === 0) break;
  }

  $('nightsText').textContent = hitNight
    ? `第 ${hitNight} 晚达到 ${target.toFixed(2)}%`
    : '8 晚内未达标';
}

let lastMaxVol = 0;

function renderMaxVol() {
  const { perf, purity, target } = state;
  const d = (target - purity) / 100;
  const mult = getMult(toInt(purity), perf);
  const budget10 = 55 * mult;

  $('mvBudget').textContent = `${budget10.toFixed(1)} mL`;
  $('mvPerL').textContent = `${Math.max(0, d * 1000).toFixed(2)} mL`;
  $('mvApply').classList.add('hidden');
  $('mvUnit').textContent = 'L';
  lastMaxVol = 0;

  if (d <= 0) {
    $('mvValue').textContent = '不限';
    $('mvUnit').textContent = '';
    $('mvSub').textContent = '输入水已达到目标纯度';
    $('mvSummary').innerHTML = `输入水 <strong>${purity.toFixed(2)}%</strong> ≥ 目标 <strong>${target.toFixed(2)}%</strong>，无需净化。`;
    return;
  }
  if (mult <= 0) {
    $('mvValue').textContent = '0';
    $('mvSub').textContent = '性能过低，机器无法工作';
    $('mvSummary').textContent = '请提高性能加成。';
    return;
  }

  const perL = d * 1000; // 每升需去除 mL
  const maxL = perL * 10 <= budget10 ? budget10 / perL : (25 * mult) / (perL - 3 * mult);
  lastMaxVol = Math.floor(maxL * 100) / 100;

  $('mvValue').textContent = lastMaxVol.toFixed(2);
  $('mvSub').textContent = `约 ${Math.floor(maxL * 1000).toLocaleString()} mL`;
  $('mvSummary').innerHTML = `装入不超过 <strong>${lastMaxVol.toFixed(2)} L</strong> 的 ${purity.toFixed(2)}% 水，睡一觉必定达到 <strong>${target.toFixed(2)}%（${gradeName(toInt(target))}）</strong>。`;
  $('mvApply').classList.remove('hidden');
}

let lastMinPurity = null;

/** 从目标纯度往下逐 0.01% 扫描，找到"连续可一晚达标"的最低入水纯度 */
function findMinPurity(volUl, tInt, perf) {
  let lowest = tInt;
  for (let p = tInt - 1; p >= 9000; p--) {
    const needUl = volUl * (tInt - p) / 10000;
    if (getNightBudgetUl(volUl, p, perf).budgetUl < needUl) break;
    lowest = p;
  }
  return lowest;
}

function renderMinPurity() {
  const { perf, vol, target } = state;
  const volUl = Math.round(vol * 1e6);
  const tInt = toInt(target);
  $('mpApply').classList.add('hidden');
  lastMinPurity = null;

  if (tInt <= 9000) {
    $('mpValue').textContent = '任意';
    $('mpUnit').textContent = '';
    $('mpSub').textContent = '目标低于滑动范围下限 90%';
    $('mpBudget').textContent = $('mpNeed').textContent = '-';
    $('mpSummary').textContent = '目标纯度过低，无需计算。';
    return;
  }

  const p = findMinPurity(volUl, tInt, perf);
  const needUl = volUl * (tInt - p) / 10000;
  const { budgetUl } = getNightBudgetUl(volUl, p, perf);
  lastMinPurity = p / 100;

  $('mpUnit').textContent = '%';
  $('mpBudget').textContent = ml(budgetUl);
  $('mpNeed').textContent = ml(needUl);

  if (p === tInt) {
    $('mpValue').textContent = (p / 100).toFixed(2);
    $('mpSub').textContent = '性能不足以一晚提升 0.01%';
    $('mpSummary').innerHTML = `当前性能下，<strong>${vol.toFixed(2)} L</strong> 水一晚连 0.01% 都提升不了，请减少水量或提高性能。`;
    return;
  }

  const atFloor = p === 9000;
  $('mpValue').textContent = (atFloor ? '≤ ' : '') + (p / 100).toFixed(2);
  $('mpSub').textContent = `${gradeName(p)} · 比目标低 ${((tInt - p) / 100).toFixed(2)}%`;
  $('mpSummary').innerHTML = atFloor
    ? `只要输入水纯度不低于 <strong>90%</strong>，<strong>${vol.toFixed(2)} L</strong> 水都能一晚达到 <strong>${target.toFixed(2)}%</strong>。`
    : `输入水纯度 ≥ <strong>${(p / 100).toFixed(2)}%</strong> 时，<strong>${vol.toFixed(2)} L</strong> 水睡一觉即可达到 <strong>${target.toFixed(2)}%（${gradeName(tInt)}）</strong>。`;
  $('mpApply').classList.remove('hidden');
}

/* ---------------- 界面 ---------------- */

function renderUI() {
  // 标签页
  document.querySelectorAll('.tab').forEach((t) => {
    const active = t.dataset.tab === state.tab;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.dataset.panel === state.tab));
  // 参数置灰
  document.querySelectorAll('.field').forEach((f) => f.classList.toggle('off', !TAB_FIELDS[state.tab].includes(f.dataset.field)));
  // 快捷按钮高亮
  document.querySelectorAll('#volChips .chip').forEach((c) => c.classList.toggle('active', Math.abs(+c.dataset.v - state.vol) < 0.01));
  document.querySelectorAll('#targetChips .chip').forEach((c) => c.classList.toggle('active', Math.abs(+c.dataset.t - state.target) < 0.005));
  setGradePill($('purityGrade'), toInt(state.purity));
  syncRangeTracks();
}

function update() {
  renderUI();
  if (state.tab === 'sim') renderSim();
  else if (state.tab === 'maxVol') renderMaxVol();
  else renderMinPurity();
  save();
}

function bindPair(name) {
  const input = $(name + 'Input'), range = $(name + 'Range');
  input.addEventListener('input', () => { readInputs(); range.value = state[name]; update(); });
  input.addEventListener('change', writeInputs);
  range.addEventListener('input', () => { input.value = range.value; readInputs(); update(); });
}

['perf', 'purity', 'vol'].forEach(bindPair);
$('targetInput').addEventListener('input', () => { readInputs(); update(); });
$('targetInput').addEventListener('change', writeInputs);

document.querySelectorAll('#volChips .chip').forEach((c) => c.addEventListener('click', () => {
  state.vol = +c.dataset.v; writeInputs(); update();
}));
document.querySelectorAll('#targetChips .chip').forEach((c) => c.addEventListener('click', () => {
  state.target = +c.dataset.t; writeInputs(); update();
}));
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
  state.tab = t.dataset.tab; update();
}));

$('mvApply').addEventListener('click', () => {
  if (lastMaxVol > 0) { state.vol = lastMaxVol; state.tab = 'sim'; writeInputs(); update(); }
});
$('mpApply').addEventListener('click', () => {
  if (lastMinPurity !== null) { state.purity = lastMinPurity; state.tab = 'sim'; writeInputs(); update(); }
});
$('resetBtn').addEventListener('click', () => {
  state = { ...DEFAULTS, tab: state.tab }; writeInputs(); update();
});

writeInputs();
update();
