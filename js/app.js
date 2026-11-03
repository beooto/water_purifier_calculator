/**
 * 深空当铺 · 净水器核心计算器
 * 计算逻辑基于游戏 MachinePurifier 净化公式
 */

const DIRT_CURVE = [
  { p: 9800, b: 1.0 },
  { p: 9400, b: 2.0 },
  { p: 8850, b: 5.0 },
  { p: 8000, b: 10.0 },
  { p: 6250, b: 15.0 },
  { p: 3750, b: 20.0 }
];

function getDirtBonus(purityInt) {
  if (purityInt >= DIRT_CURVE[0].p) return DIRT_CURVE[0].b;
  for (let i = 1; i < DIRT_CURVE.length; i++) {
    const p1 = DIRT_CURVE[i - 1].p;
    const b1 = DIRT_CURVE[i - 1].b;
    const p2 = DIRT_CURVE[i].p;
    const b2 = DIRT_CURVE[i].b;
    if (purityInt >= p2) {
      const t = (p1 - purityInt) / (p1 - p2);
      return b1 + t * (b2 - b1);
    }
  }
  return DIRT_CURVE[DIRT_CURVE.length - 1].b;
}

function getPurityMult(bonusQuality) {
  if (bonusQuality >= 200) return 0.0;
  if (bonusQuality >= 100) return 0.1;
  if (bonusQuality >= 75) return 0.2;
  if (bonusQuality >= 50) return 0.35;
  if (bonusQuality >= 25) return 0.65;
  if (bonusQuality >= 15) return 0.85;
  return 1.0;
}

function getMaxPurityCapInt(bonusQuality) {
  return 10000 - Math.round(100.0 * getPurityMult(bonusQuality));
}

function getWaterGradeName(purityInt) {
  if (purityInt >= 9990) return "纯水 (Pure)";
  if (purityInt >= 9900) return "优质水 (High-Quality)";
  if (purityInt >= 9800) return "基础水 (Base)";
  if (purityInt >= 9600) return "幽灵水 (Ghost)";
  if (purityInt >= 9000) return "铁锈水 (Rust)";
  return "阴沟水 (Gutterflow)";
}

function getNightBudgetUl(totalVolumeUl, purityInt, perfBonusInt) {
  const dirtBonus = getDirtBonus(purityInt);
  let mult = dirtBonus + (perfBonusInt / 100.0);
  if (mult < 0) mult = 0;
  mult *= 1.25;

  const cappedVolUl = Math.min(totalVolumeUl, 10000000);
  const baseBudgetUl = Math.floor((cappedVolUl * 3) / 1000) + 25000;
  return {
    budgetUl: Math.floor(baseBudgetUl * mult),
    dirtBonus,
    mult,
    baseBudgetUl
  };
}

function syncFromInput(type) {
  if (type === 'perf') {
    document.getElementById('perfRange').value = document.getElementById('perfInput').value;
  } else if (type === 'qual') {
    document.getElementById('qualRange').value = document.getElementById('qualInput').value;
  } else if (type === 'purity') {
    document.getElementById('purityRange').value = document.getElementById('purityInput').value;
  } else if (type === 'vol') {
    document.getElementById('volRange').value = document.getElementById('volInput').value;
  }
  calculateAll();
}

function syncFromRange(type) {
  if (type === 'perf') {
    document.getElementById('perfInput').value = document.getElementById('perfRange').value;
  } else if (type === 'qual') {
    document.getElementById('qualInput').value = document.getElementById('qualRange').value;
  } else if (type === 'purity') {
    document.getElementById('purityInput').value = document.getElementById('purityRange').value;
  } else if (type === 'vol') {
    document.getElementById('volInput').value = document.getElementById('volRange').value;
  }
  calculateAll();
}

function setQuality(q) {
  document.getElementById('qualInput').value = q;
  document.getElementById('qualRange').value = q;
  calculateAll();
}

function setVolume(v) {
  document.getElementById('volInput').value = v;
  document.getElementById('volRange').value = v;
  calculateAll();
}

function setTarget(t) {
  const input = document.getElementById('targetInput');
  if (t === 0) {
    input.value = '';
  } else {
    input.value = t.toFixed(2);
  }
  calculateAll();
}

let lastCalculatedMaxSafeL = 5.0;

function applyMaxSafeVolume() {
  if (lastCalculatedMaxSafeL > 0) {
    const v = Math.floor(lastCalculatedMaxSafeL * 100) / 100;
    setVolume(v);
  }
}

function resetDefault() {
  document.getElementById('perfInput').value = 0;
  document.getElementById('perfRange').value = 0;
  document.getElementById('qualInput').value = 0;
  document.getElementById('qualRange').value = 0;
  document.getElementById('effInput').value = 0;
  document.getElementById('purityInput').value = 98.00;
  document.getElementById('purityRange').value = 98.00;
  document.getElementById('volInput').value = 10;
  document.getElementById('volRange').value = 10;
  document.getElementById('targetInput').value = '99.00';
  document.getElementById('impOther').value = 10;
  document.getElementById('impMineral').value = 20;
  document.getElementById('impHeavy').value = 90;
  document.getElementById('impChem').value = 80;
  calculateAll();
}

function highlightButtons(qualBonus, volL, targetVal) {
  const qTiers = [0, 15, 25, 50, 75, 100, 200];
  let activeQ = 0;
  for (const t of qTiers) {
    if (qualBonus >= t) activeQ = t;
  }
  for (const t of qTiers) {
    const btn = document.getElementById('qBtn' + t);
    if (!btn) continue;
    const spanClass = t === 100 ? "col-span-2 " : "";
    if (t === activeQ) {
      btn.className = "preset-btn " + spanClass + "px-2 py-1.5 rounded-lg text-xs border border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)] text-center shadow-sm";
      btn.children[1].className = "opacity-90";
    } else {
      btn.className = "preset-btn " + spanClass + "px-2 py-1.5 rounded-lg text-xs border border-[var(--border)] bg-[var(--secondary)] text-center";
      btn.children[1].className = "text-[var(--muted-foreground)]";
    }
  }

  const vPresets = [3, 5, 20, 50];
  for (const v of vPresets) {
    const btn = document.getElementById('vBtn' + v);
    if (!btn) continue;
    if (Math.abs(volL - v) < 0.01) {
      btn.className = "preset-btn px-2 py-1.5 rounded-lg text-xs border border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)] text-center shadow-sm";
      btn.children[1].className = "opacity-90";
    } else {
      btn.className = "preset-btn px-2 py-1.5 rounded-lg text-xs border border-[var(--border)] bg-[var(--secondary)] text-center";
      btn.children[1].className = "text-[var(--muted-foreground)]";
    }
  }

  const tBtns = [
    { id: 'tBtn98', val: 98.0 },
    { id: 'tBtn99', val: 99.0 },
    { id: 'tBtn999', val: 99.9 },
    { id: 'tBtnCap', val: null }
  ];
  for (const item of tBtns) {
    const btn = document.getElementById(item.id);
    const isMatch = (item.val === null && isNaN(targetVal)) || (item.val !== null && !isNaN(targetVal) && Math.abs(targetVal - item.val) < 0.005);
    if (isMatch) {
      btn.className = "preset-btn px-2 py-1.5 rounded-lg text-xs border border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)] text-center shadow-sm";
      btn.children[1].className = "opacity-90";
    } else {
      btn.className = "preset-btn px-2 py-1.5 rounded-lg text-xs border border-[var(--border)] bg-[var(--secondary)] text-center";
      btn.children[1].className = "text-[var(--muted-foreground)]";
    }
  }
}

function calculateAll() {
  const perfBonus = parseInt(document.getElementById('perfInput').value || '0', 10);
  const qualBonus = parseInt(document.getElementById('qualInput').value || '0', 10);
  const effBonus = parseInt(document.getElementById('effInput').value || '0', 10);
  const inPurityPct = Math.min(99.99, Math.max(0.01, parseFloat(document.getElementById('purityInput').value || '98')));
  const volL = Math.max(0.01, parseFloat(document.getElementById('volInput').value || '10'));
  const rawTargetStr = document.getElementById('targetInput').value.trim();
  const userTargetPct = rawTargetStr === '' ? NaN : Math.min(100, Math.max(0.01, parseFloat(rawTargetStr)));

  highlightButtons(qualBonus, volL, userTargetPct);

  const basePower = 4;
  const powerReduction = Math.trunc((basePower * effBonus) / 100);
  const actualPower = Math.max(1, basePower - powerReduction);
  document.getElementById('powerBadge').textContent = `耗电: ${actualPower} / 天`;
  document.getElementById('perfEffectText').textContent = `清理效率 ${perfBonus >= 0 ? '+' : ''}${perfBonus}%`;

  const capInt = getMaxPurityCapInt(qualBonus);
  const capPct = capInt / 100.0;
  document.getElementById('capDisplay').textContent = `${capPct.toFixed(2)}% (${getWaterGradeName(capInt)})`;

  const inPurityInt = Math.round(inPurityPct * 100);
  const inContaminantPct = 100 - inPurityPct;
  const dirtBonus = getDirtBonus(inPurityInt);
  let mult = (dirtBonus + perfBonus / 100.0);
  if (mult < 0) mult = 0;
  mult *= 1.25;

  document.getElementById('inputGradeBadge').textContent = `当前: ${getWaterGradeName(inPurityInt)}`;
  document.getElementById('contaminantPctText').textContent = `初始杂质占比: ${inContaminantPct.toFixed(2)}%`;
  document.getElementById('dirtBonusText').textContent = `污秽系数: ${dirtBonus.toFixed(2)}x | 总倍率: ${mult.toFixed(3)}x`;

  const desiredTargetPct = isNaN(userTargetPct) ? capPct : userTargetPct;
  const effectiveTargetPct = Math.min(desiredTargetPct, capPct);

  const maxNightBudgetMl = 55.0 * mult;
  document.getElementById('maxNightBudget').textContent = maxNightBudgetMl.toFixed(2);
  document.getElementById('budgetFormulaHint').textContent = `55mL × ${mult.toFixed(2)} 倍率`;
  document.getElementById('maxVolStatusBadge').textContent = isNaN(userTargetPct)
    ? `目标: 机器上限 ${capPct.toFixed(2)}% (${getWaterGradeName(capInt)})`
    : `目标: ${desiredTargetPct.toFixed(2)}% (${getWaterGradeName(Math.round(desiredTargetPct * 100))})`;

  const warnBox = document.getElementById('maxVolWarningBox');
  const warnTitle = document.getElementById('maxVolWarningTitle');
  const warnDesc = document.getElementById('maxVolWarningDesc');
  const applyBtn = document.getElementById('applyMaxVolBtn');

  if (!isNaN(userTargetPct) && userTargetPct > capPct + 0.001) {
    warnBox.classList.remove('hidden');
    let neededQual = 15;
    if (userTargetPct > 99.9) neededQual = 200;
    else if (userTargetPct > 99.8) neededQual = 100;
    else if (userTargetPct > 99.65) neededQual = 75;
    else if (userTargetPct > 99.35) neededQual = 50;
    else if (userTargetPct > 99.15) neededQual = 25;
    warnTitle.textContent = `⚠️ 目标水质 (${userTargetPct.toFixed(2)}%) 高于当前机器纯度上限 (${capPct.toFixed(2)}%)！`;
    warnDesc.textContent = `净水器到达 ${capPct.toFixed(2)}% 后会强制停机。若要达到 ${userTargetPct.toFixed(2)}%（${getWaterGradeName(Math.round(userTargetPct * 100))}），请至少堆叠 +${neededQual}% 质量加成。下方已按当前机器最高上限 (${capPct.toFixed(2)}%) 为您折算。`;
  } else {
    warnBox.classList.add('hidden');
  }

  const deltaPurityFraction = (effectiveTargetPct - inPurityPct) / 100.0;
  if (deltaPurityFraction <= 0) {
    document.getElementById('maxSafeVolL').textContent = "已达标";
    document.getElementById('maxSafeVolMl').textContent = "无需净化，当前水质已 ≥ 目标";
    document.getElementById('removePerLiter').textContent = "0.00";
    document.getElementById('removePctPerLiter').textContent = "需降低杂质占比 0.00%";
    document.getElementById('quickApplyMaxText').innerHTML = `✅ 当前输入水质 (<strong class="text-[var(--foreground)]">${inPurityPct.toFixed(2)}%</strong>) 已经达到或超过有效目标 (<strong class="text-[var(--foreground)]">${effectiveTargetPct.toFixed(2)}%</strong>)。`;
    applyBtn.classList.add('hidden');
    lastCalculatedMaxSafeL = 0;
  } else if (mult <= 0) {
    document.getElementById('maxSafeVolL').textContent = "0.00";
    document.getElementById('maxSafeVolMl').textContent = "性能过低，机器无法工作";
    applyBtn.classList.add('hidden');
    lastCalculatedMaxSafeL = 0;
  } else {
    applyBtn.classList.remove('hidden');
    const removeMlPerL = deltaPurityFraction * 1000.0;
    document.getElementById('removePerLiter').textContent = removeMlPerL.toFixed(2);
    document.getElementById('removePctPerLiter').textContent = `需降低杂质占比 ${(deltaPurityFraction * 100).toFixed(2)}%`;

    const neededAt10L = 10000.0 * deltaPurityFraction;
    let maxSafeMl = 0;
    if (neededAt10L <= maxNightBudgetMl) {
      maxSafeMl = maxNightBudgetMl / deltaPurityFraction;
    } else {
      maxSafeMl = (25.0 * mult) / (deltaPurityFraction - 0.003 * mult);
    }
    lastCalculatedMaxSafeL = maxSafeMl / 1000.0;
    document.getElementById('maxSafeVolL').textContent = lastCalculatedMaxSafeL.toFixed(2);
    document.getElementById('maxSafeVolMl').textContent = `约 ${Math.floor(maxSafeMl).toLocaleString()} mL`;
    document.getElementById('quickApplyMaxText').innerHTML =
      `💡 只要装入不超过 <strong class="text-[var(--foreground)]">${lastCalculatedMaxSafeL.toFixed(2)} L</strong> 的 <strong class="text-[var(--foreground)]">${inPurityPct.toFixed(2)}%</strong> 水，睡一觉必定全桶质变为 <strong class="text-[var(--foreground)]">${effectiveTargetPct.toFixed(2)}% (${getWaterGradeName(Math.round(effectiveTargetPct * 100))})</strong>。`;
  }

  document.getElementById('curVolTitle').textContent = `${volL.toFixed(2)} L`;
  const totalVolUl = Math.round(volL * 1000000);
  const waterUl = Math.round(totalVolUl * (inPurityPct / 100.0));
  const totalContaminantsUl = totalVolUl - waterUl;

  const capAllowedContamUl = Math.floor((totalVolUl * (10000 - capInt)) / 10000);
  const excessAboveCapUl = Math.max(0, totalContaminantsUl - capAllowedContamUl);

  const budgetInfo = getNightBudgetUl(totalVolUl, inPurityInt, perfBonus);
  const curBudgetUl = budgetInfo.budgetUl;

  const actualRemovedUl = Math.min(curBudgetUl, excessAboveCapUl);
  const newWaterUl = waterUl + actualRemovedUl;
  const newContamUl = totalContaminantsUl - actualRemovedUl;
  const newPurityPct = (newWaterUl / totalVolUl) * 100.0;
  const newPurityInt = Math.floor((newWaterUl * 10000) / totalVolUl);
  const newImpurityPct = 100.0 - newPurityPct;

  document.getElementById('outPurityText').textContent = `${newPurityPct.toFixed(2)}%`;
  const deltaPct = newPurityPct - inPurityPct;
  document.getElementById('purityDeltaText').textContent = `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(2)}%`;
  document.getElementById('outGradeBadge').textContent = getWaterGradeName(newPurityInt);
  document.getElementById('outImpurityPct').textContent = `${newImpurityPct.toFixed(2)}%`;
  document.getElementById('outImpurityMl').textContent = `${(newContamUl / 1000.0).toFixed(1)} mL`;

  const removedMl = actualRemovedUl / 1000.0;
  const curBudgetMl = curBudgetUl / 1000.0;
  document.getElementById('removedMlText').textContent = `${removedMl.toFixed(1)} mL`;
  document.getElementById('removedTooltipInt').textContent = `(面板显示约 ${Math.round(removedMl)} 毫升)`;
  document.getElementById('curNightBudgetText').textContent = `${curBudgetMl.toFixed(1)} mL`;
  document.getElementById('inImpurityMlText').textContent = `${(totalContaminantsUl / 1000.0).toFixed(1)} mL`;

  const usageRatio = curBudgetUl > 0 ? Math.min(100, Math.round((actualRemovedUl / curBudgetUl) * 100)) : 0;
  document.getElementById('budgetUsagePctBadge').textContent = `额度消耗 ${usageRatio}%`;

  const targetAllowedContamUl = Math.floor((totalVolUl * (100.0 - desiredTargetPct)) / 100.0);
  const neededForUserTargetUl = Math.max(0, totalContaminantsUl - targetAllowedContamUl);

  const simBadge = document.getElementById('simStatusBadge');
  const simSummary = document.getElementById('simSummaryBox');

  if (!isNaN(userTargetPct) && userTargetPct > capPct + 0.001) {
    simBadge.textContent = "🚫 受限于纯度上限";
    simBadge.className = "text-xs px-2.5 py-1 rounded-full font-semibold bg-[var(--secondary)] text-[var(--foreground)] self-start sm:self-auto";
    simSummary.innerHTML = `⚠️ <strong>机器纯度上限不足：</strong>你设定的目标是 <strong>${desiredTargetPct.toFixed(2)}%</strong>，但当前机器纯度上限只有 <strong>${capPct.toFixed(2)}%</strong>。明早最多只能净化到 <strong>${newPurityPct.toFixed(2)}%</strong>（剩余杂质占比 ${newImpurityPct.toFixed(2)}%）。`;
  } else if (newPurityPct + 0.005 >= desiredTargetPct) {
    simBadge.textContent = "✅ 一晚达标";
    simBadge.className = "text-xs px-2.5 py-1 rounded-full font-semibold bg-[var(--primary)] text-[var(--primary-foreground)] self-start sm:self-auto";
    const spareMl = Math.max(0, (curBudgetUl - neededForUserTargetUl) / 1000.0);
    simSummary.innerHTML = `🎉 <strong>一晚稳出目标水质！</strong>这桶 <strong>${volL.toFixed(2)} L</strong> 的水只需去除 <strong>${(neededForUserTargetUl / 1000.0).toFixed(1)} mL</strong> 杂质即可达到 <strong>${desiredTargetPct.toFixed(2)}%</strong>，而机器今晚有 <strong>${curBudgetMl.toFixed(1)} mL</strong> 额度（富余 <strong>${spareMl.toFixed(1)} mL</strong>）。明早纯度将达到 <strong>${newPurityPct.toFixed(2)}% (${getWaterGradeName(newPurityInt)})</strong>，达到上限后自动停机保护。`;
  } else {
    simBadge.textContent = "⏳ 一晚不够 (水量偏多)";
    simBadge.className = "text-xs px-2.5 py-1 rounded-full font-semibold bg-[var(--secondary)] text-[var(--foreground)] self-start sm:self-auto";
    const shortfallMl = (neededForUserTargetUl - actualRemovedUl) / 1000.0;
    simSummary.innerHTML = `⚠️ <strong>一晚上无法达到 ${desiredTargetPct.toFixed(2)}%！</strong>要将 <strong>${volL.toFixed(2)} L</strong> 水升到目标纯度共需去除 <strong>${(neededForUserTargetUl / 1000.0).toFixed(1)} mL</strong> 杂质，但今晚满打满算只能去除 <strong>${removedMl.toFixed(1)} mL</strong>（还差 <strong>${shortfallMl.toFixed(1)} mL</strong>）。明早纯度将停在 <strong>${newPurityPct.toFixed(2)}% (${getWaterGradeName(newPurityInt)})</strong>。建议将水量减少至 <strong>${lastCalculatedMaxSafeL.toFixed(2)} L</strong> 以内，或连续净化多晚。`;
  }

  const tbody = document.getElementById('multiNightBody');
  tbody.innerHTML = '';
  let simWaterUl = waterUl;
  let nightsToTarget = null;

  for (let night = 1; night <= 6; night++) {
    const startPurityPct = (simWaterUl / totalVolUl) * 100.0;
    const startPurityInt = Math.floor((simWaterUl * 10000) / totalVolUl);
    const startContamUl = totalVolUl - simWaterUl;
    const remToCapUl = Math.max(0, startContamUl - capAllowedContamUl);

    const bInfo = getNightBudgetUl(totalVolUl, startPurityInt, perfBonus);
    const nightRemUl = Math.min(bInfo.budgetUl, remToCapUl);
    simWaterUl += nightRemUl;

    const endPurityPct = (simWaterUl / totalVolUl) * 100.0;
    const endPurityInt = Math.floor((simWaterUl * 10000) / totalVolUl);
    const endImpurityPct = 100.0 - endPurityPct;

    if (nightsToTarget === null && endPurityPct + 0.005 >= effectiveTargetPct) {
      nightsToTarget = night;
    }

    const tr = document.createElement('tr');
    tr.className = night === 1 ? "font-semibold" : "text-[var(--muted-foreground)]";
    tr.innerHTML = `
      <td class="py-2 px-3">第 ${night} 晚</td>
      <td class="py-2 px-3">${startPurityPct.toFixed(2)}%</td>
      <td class="py-2 px-3">${(bInfo.budgetUl / 1000.0).toFixed(1)} mL (${bInfo.mult.toFixed(2)}x)</td>
      <td class="py-2 px-3">${(nightRemUl / 1000.0).toFixed(1)} mL</td>
      <td class="py-2 px-3">${endPurityPct.toFixed(2)}% (杂质 ${endImpurityPct.toFixed(2)}%)</td>
      <td class="py-2 px-3">${getWaterGradeName(endPurityInt)}</td>
    `;
    tbody.appendChild(tr);

    if (remToCapUl - nightRemUl <= 0 || nightRemUl === 0) break;
  }

  document.getElementById('nightsNeededText').textContent = nightsToTarget
    ? `预计第 ${nightsToTarget} 晚达到 ${effectiveTargetPct.toFixed(2)}%`
    : `多晚后逼近上限 ${capPct.toFixed(2)}%`;

  window.lastActualRemovedMl = removedMl;
  calcDetailedContaminants();
}

function calcDetailedContaminants() {
  let budgetLeft = window.lastActualRemovedMl || 0;
  const other = Math.max(0, parseFloat(document.getElementById('impOther').value || '0'));
  const mineral = Math.max(0, parseFloat(document.getElementById('impMineral').value || '0'));
  const heavy = Math.max(0, parseFloat(document.getElementById('impHeavy').value || '0'));
  const chem = Math.max(0, parseFloat(document.getElementById('impChem').value || '0'));

  const rem1 = Math.min(other, budgetLeft);
  budgetLeft -= rem1;
  const leftOther = other - rem1;

  const rem2 = Math.min(mineral, budgetLeft);
  budgetLeft -= rem2;
  const leftMineral = mineral - rem2;

  const rem3 = Math.min(heavy, budgetLeft);
  budgetLeft -= rem3;
  const leftHeavy = heavy - rem3;

  const rem4 = Math.min(chem, budgetLeft);
  budgetLeft -= rem4;
  const leftChem = chem - rem4;

  document.getElementById('remOther').textContent = `去除 ${rem1.toFixed(2)} | 残留: ${leftOther.toFixed(2)} mL`;
  document.getElementById('remMineral').textContent = `去除 ${rem2.toFixed(2)} | 残留: ${leftMineral.toFixed(2)} mL`;
  document.getElementById('remHeavy').textContent = `去除 ${rem3.toFixed(2)} | 残留: ${leftHeavy.toFixed(2)} mL`;
  document.getElementById('remChem').textContent = `去除 ${rem4.toFixed(2)} | 残留: ${leftChem.toFixed(2)} mL`;
}

calculateAll();
