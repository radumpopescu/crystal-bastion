import { R } from './state';
import { balanceConfigStore, computeWeaponLevelStats, listBalanceSections, listNumericFields, setValueAtPath, summarizeWeaponLevelPreviewRows } from './balance-config';

const store = balanceConfigStore;

let selectedSection = 'player';
let overlayOpen = false;
let resumeState: string | null = null;
let draftConfig = store.getActive();
let modalMode: 'import' | 'export-active' | 'export-override' | null = null;
let selectedWeaponPreviewLevel = 1;
const selectedMetaUpgradeLevel: Record<string, number> = {};
const selectedBaseUpgradeLevel: Record<string, number> = {};

const root = document.createElement('div');
root.id = 'balance-editor';
root.innerHTML = `
  <div class="be-shell">
    <div class="be-header">
      <div class="be-title-wrap">
        <div class="be-kicker">CRYSTAL BASTION</div>
        <div class="be-title">Balance Editor</div>
        <div class="be-subtitle">Structured config editor backed by the shipped JSON schema.</div>
      </div>
      <div class="be-actions">
        <button type="button" data-action="save">Save Override</button>
        <button type="button" data-action="reset-draft">Reset Draft</button>
        <button type="button" data-action="clear-override">Clear Override</button>
        <button type="button" data-action="export-active">Export Active</button>
        <button type="button" data-action="export-override">Export Override</button>
        <button type="button" data-action="import-json">Import JSON</button>
        <button type="button" data-action="close">Close</button>
      </div>
    </div>
    <div class="be-body">
      <aside class="be-sidebar">
        <div class="be-sidebar-title">Sections</div>
        <div class="be-sections"></div>
      </aside>
      <main class="be-content">
        <div class="be-section-meta"></div>
        <div class="be-field-grid"></div>
      </main>
    </div>
    <div class="be-footer">
      <div class="be-status" data-role="status">Ready.</div>
      <div class="be-hint">Open with 8+9+0 together on desktop.</div>
    </div>
  </div>
  <div class="be-modal-backdrop is-hidden">
    <div class="be-modal">
      <div class="be-modal-title">JSON Transfer</div>
      <div class="be-modal-copy"></div>
      <textarea class="be-modal-textarea" spellcheck="false"></textarea>
      <div class="be-modal-actions">
        <button type="button" data-modal-action="confirm">Confirm</button>
        <button type="button" data-modal-action="copy">Copy</button>
        <button type="button" data-modal-action="cancel">Cancel</button>
      </div>
    </div>
  </div>
`;
document.body.appendChild(root);


const sectionsEl = root.querySelector('.be-sections') as HTMLDivElement;
const fieldGridEl = root.querySelector('.be-field-grid') as HTMLDivElement;
const sectionMetaEl = root.querySelector('.be-section-meta') as HTMLDivElement;
const statusEl = root.querySelector('[data-role="status"]') as HTMLDivElement;
const modalBackdrop = root.querySelector('.be-modal-backdrop') as HTMLDivElement;
const modalCopy = root.querySelector('.be-modal-copy') as HTMLDivElement;
const modalTextarea = root.querySelector('.be-modal-textarea') as HTMLTextAreaElement;

const SECTION_EXPLANATIONS: Record<string, string> = {
  player: 'Core player baseline values used when a run starts, before run cards and meta upgrades modify them.',
  economy: 'Gold, reroll, shop, and early-start reward tuning. These values shape pacing rather than combat output directly.',
  base: 'Home crystal/base baseline stats plus the upgrade shop progression that improves it during a run.',
  towers: 'Current deployed-tower baseline behavior, including cost scaling, placement rules, and per-level tower growth.',
  towerTypes: 'Expansion foundation for typed towers. This defines per-tower-family multipliers, unlock timing, slot order, and future per-type balance knobs.',
  towerProgression: 'Shared tuning for tower leveling systems, including future per-tower leveling cards and scaling rules.',
  runStats: 'Run-level systems that are not tied to one weapon or one structure, such as the upcoming repair stat.',
  intermission: 'Between-wave phase tuning for tower refresh, repairs, and other intermission-only systems.',
  endless: 'Wave-14 continuation and endless-run scaling knobs. This is the future authority for endless progression rules.',
  difficulty: 'Difficulty ladder definitions and multipliers. Each profile should eventually shape enemy, economy, and sustain behavior from config.',
  characters: 'Character archetype definitions for future run-start selection, including baseline stat multipliers and unlock costs.',
  waves: 'Wave timing, enemy-count growth, spawn distance, and scaling formulas that make later waves harder.',
  enemies: 'Per-enemy archetype stats. These are the direct building blocks for monster difficulty.',
  weapons: 'Per-weapon stats and level bonus texts. This section controls how each weapon family behaves.',
  runCards: 'Cards offered during a run. These modify current-run stats, economy, base, or towers.',
  metaUpgrades: 'Permanent progression upgrades bought outside a run. Each one lists all levels and total effect values.',
};

const RELATED_SECTIONS: Record<string, string[]> = {
  player: ['runCards', 'metaUpgrades', 'weapons', 'characters', 'difficulty'],
  economy: ['runCards', 'metaUpgrades', 'waves', 'difficulty', 'characters'],
  base: ['metaUpgrades', 'runCards', 'towers', 'intermission'],
  towers: ['towerTypes', 'towerProgression', 'runCards', 'metaUpgrades', 'base', 'intermission'],
  towerTypes: ['towers', 'towerProgression', 'intermission'],
  towerProgression: ['towers', 'towerTypes', 'runCards', 'intermission'],
  runStats: ['runCards', 'intermission', 'characters', 'difficulty'],
  intermission: ['runStats', 'towers', 'towerProgression', 'endless'],
  endless: ['waves', 'difficulty', 'intermission'],
  difficulty: ['waves', 'enemies', 'economy', 'characters', 'runStats'],
  characters: ['player', 'economy', 'runStats', 'difficulty'],
  waves: ['enemies', 'economy', 'endless', 'difficulty'],
  enemies: ['waves', 'difficulty'],
  weapons: ['player', 'runCards', 'metaUpgrades', 'characters'],
  runCards: ['player', 'base', 'towers', 'towerProgression', 'runStats', 'economy', 'weapons'],
  metaUpgrades: ['player', 'base', 'towers', 'economy', 'weapons'],
};

const FIELD_EXPLANATIONS: Record<string, string> = {
  'player.base.hp': 'Starting player health before run modifiers and meta bonuses are applied during gameplay.',
  'player.base.speed': 'Base movement speed used for normal walking.',
  'player.base.radius': 'Collision/body radius of the player.',
  'player.base.dashSpeed': 'Movement speed while dashing.',
  'player.base.dashDuration': 'How long one dash lasts.',
  'player.base.dashCooldown': 'How quickly dash charges recover.',
  'player.base.maxWeaponSlots': 'Maximum number of weapon slots available before extra unlocks/modifiers.',
  'economy.startingGold': 'Gold available at the beginning of a run before meta bonuses are added.',
  'economy.shopRefreshCost': 'Base price to refresh the paid shop offers between waves.',
  'economy.freeDeployGold': 'Gold-equivalent bonus granted by free deploy unlocks.',
  'economy.rerollBaseCost': 'Base reroll cost before progression discounts.',
  'economy.cardCost.common': 'Base shop price for common cards.',
  'economy.cardCost.uncommon': 'Base shop price for uncommon cards.',
  'economy.cardCost.rare': 'Base shop price for rare cards.',
  'economy.cardCost.weaponUpgradeDiscountMultiplier': 'Weapon upgrade cards are cheaper than new cards by this multiplier.',
  'economy.cardCost.waveScale': 'How much paid card costs rise each wave.',
  'economy.earlyStartBonus.base': 'Base value for starting the next wave early.',
  'economy.earlyStartBonus.minimum': 'Minimum early-start bonus even with almost no timer left.',
  'economy.earlyStartBonus.waveScale': 'How much the early-start reward scales with wave number.',
  'base.core.hp': 'Base hit points before base shop upgrades and progression bonuses.',
  'base.core.buildRange': 'Radius used for the build/connection zone around the base.',
  'base.core.attackRange': 'Turret attack radius of the base itself.',
  'base.core.damage': 'Damage dealt by the base turret before other multipliers.',
  'base.core.attackSpeed': 'Shots per second for the base turret.',
  'base.core.auraRadius': 'Radius of the damaging aura around the base.',
  'base.core.auraDamage': 'Aura damage tick value.',
  'base.core.multishot': 'How many targets the base turret can shoot at once.',
  'towers.generic.hp': 'Base HP for newly placed towers.',
  'towers.generic.buildRange': 'Safe/connection zone radius provided by each tower.',
  'towers.generic.damage': 'Tower projectile damage before tower-level scaling.',
  'towers.generic.attackRange': 'Attack radius of a placed tower.',
  'towers.generic.attackSpeed': 'Shots per second for a placed tower.',
  'towers.generic.levelDamageMultiplier': 'Damage growth factor applied per tower level.',
  'towers.generic.levelRangeAdd': 'Extra attack range added per tower level.',
  'waves.interval': 'Default delay between waves before bonuses are added.',
  'waves.startingDelay': 'Delay before the very first wave starts.',
  'waves.baseMonsters': 'Base enemy count before per-wave growth is added.',
  'waves.monstersPerWave': 'Linear increase in enemy count per wave.',
  'waves.wavePower': 'Extra nonlinear wave-size scaling exponent.',
  'waves.hpScalePerWave': 'Main enemy HP increase per wave.',
  'waves.hpScaleAfterWave': 'Wave number after which extra late HP scaling begins.',
  'waves.hpScaleLateBonus': 'Additional HP scaling for late waves.',
  'waves.speedScalePerWave': 'Enemy movement-speed increase per wave.',
  'waves.damageScalePerWave': 'Enemy damage increase per wave.',
  'towerTypes.basic.costMultiplier': 'Relative cost tuning for this tower family compared with the generic tower baseline.',
  'towerProgression.baseMaxLevel': 'Shared fallback max level for tower progression systems before per-type overrides are added.',
  'runStats.repair.basePerSecond': 'Starting passive repair rate for the future repair run stat.',
  'runStats.repair.maxPerSecond': 'Upper intended cap for repair-per-second tuning.',
  'intermission.towerRefresh.healPercent': 'Percent of tower HP restored by the intermission refresh effect.',
  'endless.unlockWave': 'Wave where the bank-win-or-continue endless decision should appear.',
  'difficulty.normal.enemyHpMultiplier': 'Baseline enemy HP multiplier for this difficulty profile.',
  'characters.survivor.baseHpMultiplier': 'Character-level multiplier applied to the player HP baseline at run start.',
};

const downKeys = new Set<string>();

function setStatus(message: string) {
  statusEl.textContent = message;
}

function labelize(value: string) {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[._-]+/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
}

function jumpToSection(sectionId: string) {
  selectedSection = sectionId;
  renderSections();
  renderSectionFields();
  setStatus(`Jumped to related section: ${labelize(sectionId)}`);
}

function buildRelatedLinks(sectionId: string) {
  const wrap = document.createElement('div');
  wrap.className = 'be-related-links';
  const related = RELATED_SECTIONS[sectionId] || [];
  if (!related.length) return wrap;
  const label = document.createElement('div');
  label.className = 'be-related-label';
  label.textContent = 'Related:';
  wrap.appendChild(label);
  related.forEach(id => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'be-related-btn';
    btn.textContent = labelize(id);
    btn.addEventListener('click', () => jumpToSection(id));
    wrap.appendChild(btn);
  });
  return wrap;
}

function setSectionMeta(sectionId: string, title: string, note: string) {
  sectionMetaEl.innerHTML = '';
  const titleEl = document.createElement('div');
  titleEl.className = 'be-section-title';
  titleEl.textContent = title;
  const noteEl = document.createElement('div');
  noteEl.className = 'be-section-note';
  noteEl.textContent = note;
  const explainEl = document.createElement('div');
  explainEl.className = 'be-section-explainer';
  explainEl.textContent = SECTION_EXPLANATIONS[sectionId] || '';
  sectionMetaEl.append(titleEl, noteEl);
  if (explainEl.textContent) sectionMetaEl.appendChild(explainEl);
  sectionMetaEl.appendChild(buildRelatedLinks(sectionId));
}

function isGameScreen(state: string) {
  return ['playing', 'paused', 'levelup'].includes(state);
}

function openEditor() {
  if (overlayOpen) return;
  overlayOpen = true;
  draftConfig = store.getActive();
  selectedSection = visibleSections().find(section => section.id === selectedSection)?.id || visibleSections()[0]?.id || 'player';
  if (R.state === 'playing' || R.state === 'levelup') {
    resumeState = R.state;
    R.state = 'paused';
  } else {
    resumeState = null;
  }
  root.classList.add('is-visible');
  renderSections();
  renderSectionFields();
  setStatus(store.hasOverride() ? 'Loaded active config with local override applied.' : 'Loaded shipped default config. No local override active.');
}

function closeEditor() {
  overlayOpen = false;
  root.classList.remove('is-visible');
  closeModal();
  if (resumeState) {
    R.state = resumeState as any;
    resumeState = null;
  }
}

function closeModal() {
  modalMode = null;
  modalBackdrop.classList.add('is-hidden');
  modalTextarea.value = '';
}

function getFieldStep(value: number) {
  if (Number.isInteger(value)) return '1';
  if (Math.abs(value) >= 10) return '0.1';
  if (Math.abs(value) >= 1) return '0.05';
  if (Math.abs(value) >= 0.1) return '0.01';
  return '0.001';
}

function visibleSections() {
  return listBalanceSections(draftConfig).filter(section => !['notes', 'schemaVersion', 'baseUpgradeShop'].includes(section.id));
}

function renderSections() {
  const sections = visibleSections();
  sectionsEl.innerHTML = '';
  sections.forEach(section => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `be-section-btn${selectedSection === section.id ? ' is-active' : ''}`;
    btn.textContent = section.label;
    btn.addEventListener('click', () => {
      selectedSection = section.id;
      renderSections();
      renderSectionFields();
    });
    sectionsEl.appendChild(btn);
  });
}

function buildFieldControl(field: any) {
  const card = document.createElement('label');
  card.className = 'be-field-card';

  const title = document.createElement('div');
  title.className = 'be-field-title';
  title.textContent = field.label;

  const path = document.createElement('div');
  path.className = 'be-field-path';
  path.textContent = field.key;

  const explainer = document.createElement('div');
  explainer.className = 'be-field-explainer';
  explainer.textContent = FIELD_EXPLANATIONS[field.key] || `Controls ${field.label.toLowerCase()} for this config node.`;

  const controls = document.createElement('div');
  controls.className = 'be-field-controls';

  const input = document.createElement('input');
  input.type = 'number';
  input.value = String(field.value);
  input.step = getFieldStep(field.value);
  const commitNumericValue = () => {
    const parsed = Number(input.value);
    if (Number.isNaN(parsed)) {
      input.value = String(field.value);
      return;
    }
    draftConfig = setValueAtPath(draftConfig, field.path, parsed);
    renderSectionFields();
    setStatus(`Draft updated: ${field.key} = ${parsed}`);
  };
  input.addEventListener('change', commitNumericValue);
  input.addEventListener('input', commitNumericValue);

  const minus = document.createElement('button');
  minus.type = 'button';
  minus.textContent = '−';
  minus.addEventListener('click', () => {
    const step = Number(input.step || '1');
    draftConfig = setValueAtPath(draftConfig, field.path, Number((field.value - step).toFixed(6)));
    renderSectionFields();
    setStatus(`Draft updated: ${field.key}`);
  });

  const plus = document.createElement('button');
  plus.type = 'button';
  plus.textContent = '+';
  plus.addEventListener('click', () => {
    const step = Number(input.step || '1');
    draftConfig = setValueAtPath(draftConfig, field.path, Number((field.value + step).toFixed(6)));
    renderSectionFields();
    setStatus(`Draft updated: ${field.key}`);
  });

  controls.append(minus, input, plus);
  card.append(title, path, explainer, controls);
  return card;
}

function renderTreeNode(value: any, path: string[], depth: number) {
  const key = path[path.length - 1] || selectedSection;

  if (typeof value === 'number') {
    return buildFieldControl({
      path,
      key: path.join('.'),
      label: labelize(key),
      value,
    });
  }

  if (value == null || typeof value !== 'object') return null;

  const node = document.createElement('div');
  node.className = `be-tree-node be-depth-${Math.min(depth, 5)}`;

  const header = document.createElement('div');
  header.className = 'be-tree-header';
  header.innerHTML = `
    <div class="be-tree-title">${labelize(key)}</div>
    <div class="be-tree-path">${path.join('.')}</div>
  `;
  node.appendChild(header);

  const children = document.createElement('div');
  children.className = 'be-tree-children';

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      const child = renderTreeNode(entry, [...path, String(index)], depth + 1);
      if (child) children.appendChild(child);
    });
  } else {
    Object.entries(value).forEach(([childKey, childValue]) => {
      const child = renderTreeNode(childValue, [...path, childKey], depth + 1);
      if (child) children.appendChild(child);
    });
  }

  node.appendChild(children);
  return node;
}

function buildUpgradePreviewRows(core: any, upgrade: any) {
  const rows = [];
  for (let level = 1; level <= (upgrade.maxLevel || 0); level++) {
    const effect = upgrade.effect || {};
    let value = null;
    if (effect.target === 'base.core.hp') value = core.hp + (effect.value || 0) * level;
    if (effect.target === 'base.core.buildRange') value = core.buildRange + (effect.value || 0) * level;
    if (effect.target === 'base.core.damage') value = Number((core.damage * Math.pow(effect.value || 1, level)).toFixed(2));
    if (effect.target === 'base.core.multishot') value = core.multishot + (effect.value || 0) * level;
    rows.push({
      level,
      cost: upgrade.costs?.[level - 1] ?? null,
      value,
    });
  }
  return rows;
}

function renderBaseSectionFields() {
  const baseSection = draftConfig.base || {};
  const core = baseSection.core || {};
  const upgradeShop = draftConfig.baseUpgradeShop || {};
  setSectionMeta('base', 'Base', 'Core base stats and upgrade progression shown together so you can see both the current values and what each upgrade level does.');
  fieldGridEl.innerHTML = '';

  const tree = renderTreeNode(baseSection, ['base'], 0);
  if (tree) fieldGridEl.appendChild(tree);

  const upgradePanel = document.createElement('div');
  upgradePanel.className = 'be-upgrade-panel';
  const panelHeader = document.createElement('div');
  panelHeader.className = 'be-upgrade-panel-header';
  panelHeader.innerHTML = `
    <div class="be-section-title">Base Upgrade Shop</div>
    <div class="be-section-note">Upgrade costs and resulting stat values by level.</div>
  `;
  upgradePanel.appendChild(panelHeader);

  const cards = document.createElement('div');
  cards.className = 'be-upgrade-cards';

  Object.entries(upgradeShop).forEach(([id, upgrade]: [string, any]) => {
    const card = document.createElement('div');
    card.className = 'be-upgrade-card';

    const title = document.createElement('div');
    title.className = 'be-upgrade-card-title';
    title.textContent = upgrade.label || id;
    card.appendChild(title);

    const effectLine = document.createElement('div');
    effectLine.className = 'be-upgrade-card-effect';
    effectLine.textContent = `Effect: ${upgrade.effect?.mode || 'n/a'} ${upgrade.effect?.value ?? ''} → ${upgrade.effect?.target || 'n/a'}`;
    card.appendChild(effectLine);

    const selectedLevel = selectedBaseUpgradeLevel[id] || 1;
    card.appendChild(buildLevelSelector(upgrade.maxLevel || 1, selectedLevel, level => {
      selectedBaseUpgradeLevel[id] = level;
      renderBaseSectionFields();
      setStatus(`Base upgrade preview for ${upgrade.label} set to L${level}`);
    }));

    const selectedRow = buildUpgradePreviewRows(core, upgrade).find(row => row.level === selectedLevel);
    const preview = document.createElement('div');
    preview.className = 'be-level-preview';
    preview.textContent = `Selected L${selectedLevel}: cost ${selectedRow?.cost ?? '—'}, result ${selectedRow?.value ?? '—'}`;
    card.appendChild(preview);

    const table = document.createElement('div');
    table.className = 'be-upgrade-level-table';
    const header = document.createElement('div');
    header.className = 'be-upgrade-level-row be-upgrade-level-head';
    header.innerHTML = '<div>Level</div><div>Cost</div><div>Result</div>';
    table.appendChild(header);

    buildUpgradePreviewRows(core, upgrade).forEach(row => {
      const rowEl = document.createElement('div');
      rowEl.className = 'be-upgrade-level-row';
      rowEl.innerHTML = `<div>L${row.level}</div><div>${row.cost ?? '—'}</div><div>${row.value ?? '—'}</div>`;
      table.appendChild(rowEl);
    });

    const costNode = renderTreeNode({ costs: upgrade.costs }, ['baseUpgradeShop', id], 1);
    if (costNode) card.appendChild(costNode);
    card.appendChild(table);
    cards.appendChild(card);
  });

  upgradePanel.appendChild(cards);
  fieldGridEl.appendChild(upgradePanel);
}

function buildInfoCard(title: string, subtitle: string, description: string) {
  const card = document.createElement('div');
  card.className = 'be-info-card';
  const titleEl = document.createElement('div');
  titleEl.className = 'be-info-card-title';
  titleEl.textContent = title;
  const subEl = document.createElement('div');
  subEl.className = 'be-info-card-subtitle';
  subEl.textContent = subtitle;
  const descEl = document.createElement('div');
  descEl.className = 'be-info-card-desc';
  descEl.textContent = description;
  card.append(titleEl, subEl, descEl);
  return card;
}

function buildLevelSelector(levelCount: number, selectedLevel: number, onSelect: (level: number) => void) {
  const wrap = document.createElement('div');
  wrap.className = 'be-level-selector';
  for (let level = 1; level <= levelCount; level++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `be-level-btn${level === selectedLevel ? ' is-active' : ''}`;
    btn.textContent = `L${level}`;
    btn.addEventListener('click', () => onSelect(level));
    wrap.appendChild(btn);
  }
  return wrap;
}

function buildDataTable(columns: { key: string; label: string; className?: string }[], rows: Record<string, any>[]) {
  const table = document.createElement('div');
  table.className = 'be-data-table';
  const head = document.createElement('div');
  head.className = 'be-data-row be-data-head';
  head.style.gridTemplateColumns = `repeat(${columns.length}, minmax(0, 1fr))`;
  head.innerHTML = columns.map(col => `<div class="${col.className || ''}">${col.label}</div>`).join('');
  table.appendChild(head);
  rows.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'be-data-row';
    rowEl.style.gridTemplateColumns = `repeat(${columns.length}, minmax(0, 1fr))`;
    rowEl.innerHTML = columns.map(col => `<div class="${col.className || ''}">${row[col.key] ?? '—'}</div>`).join('');
    table.appendChild(rowEl);
  });
  return table;
}

function renderEnemiesSection() {
  const enemies = draftConfig.enemies || {};
  setSectionMeta('enemies', 'Enemies', `${Object.keys(enemies).length} enemy archetypes shown in a comparison table for easier balancing.`);
  fieldGridEl.innerHTML = '';

  const rows = Object.entries(enemies).map(([id, enemy]: [string, any]) => ({
    enemy: labelize(id),
    hp: enemy.hp,
    damage: enemy.damage,
    speed: enemy.speed,
    gold: enemy.gold,
    radius: enemy.radius,
  }));
  fieldGridEl.appendChild(buildDataTable([
    { key: 'enemy', label: 'Enemy' },
    { key: 'hp', label: 'HP' },
    { key: 'damage', label: 'Damage' },
    { key: 'speed', label: 'Speed' },
    { key: 'gold', label: 'Gold' },
    { key: 'radius', label: 'Radius' },
  ], rows));

  const grid = document.createElement('div');
  grid.className = 'be-info-grid';
  Object.entries(enemies).forEach(([id, enemy]: [string, any]) => {
    const card = buildInfoCard(labelize(id), `${id} enemy`, 'Defines this enemy archetype before wave scaling formulas are applied.');
    const tree = renderTreeNode(enemy, ['enemies', id], 1);
    if (tree) card.appendChild(tree);
    card.appendChild(buildRelatedLinks('waves'));
    grid.appendChild(card);
  });
  fieldGridEl.appendChild(grid);
}

function renderWeaponsSection() {
  const weapons = draftConfig.weapons || {};
  setSectionMeta('weapons', 'Weapons', `${Object.keys(weapons).length} weapons shown with editable base stats, per-level modifiers, and computed final values for each weapon level.`);
  fieldGridEl.innerHTML = '';

  const controlsCard = document.createElement('div');
  controlsCard.className = 'be-toolbar-card';
  const controlsLabel = document.createElement('div');
  controlsLabel.className = 'be-toolbar-label';
  controlsLabel.textContent = 'Preview weapon level';
  controlsCard.appendChild(controlsLabel);
  controlsCard.appendChild(buildLevelSelector(4, selectedWeaponPreviewLevel, level => {
    selectedWeaponPreviewLevel = level;
    renderWeaponsSection();
    setStatus(`Weapon preview level set to L${level}`);
  }));
  fieldGridEl.appendChild(controlsCard);

  const rows = Object.entries(weapons).map(([id, weapon]: [string, any]) => {
    const levelData = computeWeaponLevelStats(weapon, selectedWeaponPreviewLevel);
    return {
      weapon: `${weapon.icon || ''} ${weapon.name || labelize(id)}`.trim(),
      rarity: weapon.rarity,
      mode: weapon.mode,
      damage: levelData.dmg ?? '—',
      range: levelData.range ?? '—',
      rate: levelData.rate ?? '—',
      cost: levelData.cost ?? '—',
      level: levelData.bonusText || 'No specific override',
    };
  });
  fieldGridEl.appendChild(buildDataTable([
    { key: 'weapon', label: 'Weapon' },
    { key: 'rarity', label: 'Rarity' },
    { key: 'mode', label: 'Mode' },
    { key: 'damage', label: 'Damage' },
    { key: 'range', label: 'Range' },
    { key: 'rate', label: 'Rate' },
    { key: 'cost', label: 'Cost' },
    { key: 'level', label: `L${selectedWeaponPreviewLevel} Notes`, className: 'be-cell-nowrap' },
  ], rows));

  const grid = document.createElement('div');
  grid.className = 'be-info-grid';
  Object.entries(weapons).forEach(([id, weapon]: [string, any]) => {
    const card = buildInfoCard(`${weapon.icon || ''} ${weapon.name || labelize(id)}`.trim(), `${weapon.mode || 'weapon'} • ${weapon.rarity || 'common'}`, weapon.desc || 'Weapon behavior and scaling.');
    card.appendChild(buildLevelSelector(4, selectedWeaponPreviewLevel, level => {
      selectedWeaponPreviewLevel = level;
      renderWeaponsSection();
      setStatus(`Weapon preview level set to L${level}`);
    }));

    const selectedLevelData = computeWeaponLevelStats(weapon, selectedWeaponPreviewLevel);
    const preview = document.createElement('div');
    preview.className = 'be-level-preview';
    preview.textContent = `Computed L${selectedWeaponPreviewLevel}: dmg ${selectedLevelData.dmg ?? '—'}, range ${selectedLevelData.range ?? '—'}, rate ${selectedLevelData.rate ?? '—'}, cost ${selectedLevelData.cost ?? '—'}${selectedLevelData.bonusText ? ` • ${selectedLevelData.bonusText}` : ''}`;
    card.appendChild(preview);

    const identityTree = renderTreeNode({
      name: weapon.name,
      icon: weapon.icon,
      color: weapon.color,
      desc: weapon.desc,
      mode: weapon.mode,
      rarity: weapon.rarity,
    }, ['weapons', id, 'identity'], 1);

    const baseStatsTree = renderTreeNode({
      dmg: weapon.dmg,
      range: weapon.range,
      rate: weapon.rate,
      projSpeed: weapon.projSpeed,
      projSize: weapon.projSize,
      pellets: weapon.pellets,
      spread: weapon.spread,
      blastR: weapon.blastR,
      chains: weapon.chains,
      arcAngle: weapon.arcAngle,
      maxRate: weapon.maxRate,
      spinup: weapon.spinup,
    }, ['weapons', id], 1);

    const modifierTree = renderTreeNode(weapon.levels?.[selectedWeaponPreviewLevel - 1] || {}, ['weapons', id, 'levels', String(selectedWeaponPreviewLevel - 1)], 1);
    if (identityTree) card.appendChild(identityTree);
    if (baseStatsTree) card.appendChild(baseStatsTree);
    if (modifierTree) card.appendChild(modifierTree);

    const previewRows = summarizeWeaponLevelPreviewRows(weapon).map(row => ({
      level: `L${row.level}`,
      damage: row.dmg ?? '—',
      range: row.range ?? '—',
      rate: row.rate ?? '—',
      pellets: row.pellets ?? '—',
      blast: row.blastR ?? '—',
      chains: row.chains ?? '—',
      note: row.bonusText || '—',
    }));
    card.appendChild(buildDataTable([
      { key: 'level', label: 'Level' },
      { key: 'damage', label: 'Damage' },
      { key: 'range', label: 'Range' },
      { key: 'rate', label: 'Rate' },
      { key: 'pellets', label: 'Pellets' },
      { key: 'blast', label: 'Blast' },
      { key: 'chains', label: 'Chains' },
      { key: 'note', label: 'Notes', className: 'be-cell-nowrap' },
    ], previewRows));

    card.appendChild(buildRelatedLinks('weapons'));
    grid.appendChild(card);
  });
  fieldGridEl.appendChild(grid);
}

function renderRunCardsSection() {
  const cards = draftConfig.runCards?.statCards || {};
  setSectionMeta('runCards', 'Run Cards', `${Object.keys(cards).length} run cards grouped per card with rarity, stack limit, and tuning.`);
  fieldGridEl.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'be-info-grid';
  Object.entries(cards).forEach(([id, cardDef]: [string, any]) => {
    const card = buildInfoCard(`${cardDef.icon || ''} ${cardDef.name || labelize(id)}`.trim(), `${cardDef.rarity || 'common'}${cardDef.maxStacks ? ` • max ${cardDef.maxStacks}` : ''}`, cardDef.description || 'Run-card tuning.');
    const tree = renderTreeNode(cardDef, ['runCards', 'statCards', id], 1);
    if (tree) card.appendChild(tree);
    card.appendChild(buildRelatedLinks('runCards'));
    grid.appendChild(card);
  });
  fieldGridEl.appendChild(grid);
}

function renderMetaUpgradesSection() {
  const upgrades = draftConfig.metaUpgrades || {};
  setSectionMeta('metaUpgrades', 'Meta Upgrades', `${Object.keys(upgrades).length} permanent upgrades with per-level costs and values.`);
  fieldGridEl.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'be-info-grid';
  Object.entries(upgrades).forEach(([id, upgrade]: [string, any]) => {
    const card = buildInfoCard(upgrade.label || labelize(id), `${upgrade.category || 'meta'} • max ${upgrade.maxLevel || 0}`, upgrade.description || 'Permanent progression upgrade.');
    const selectedLevel = selectedMetaUpgradeLevel[id] || 1;
    card.appendChild(buildLevelSelector(upgrade.maxLevel || 1, selectedLevel, level => {
      selectedMetaUpgradeLevel[id] = level;
      renderMetaUpgradesSection();
      setStatus(`Meta upgrade preview for ${upgrade.label} set to L${level}`);
    }));
    const selectedRow = (upgrade.levels || []).find((row: any) => row.level === selectedLevel);
    const preview = document.createElement('div');
    preview.className = 'be-level-preview';
    preview.textContent = `Selected L${selectedLevel}: cost ${selectedRow?.cost ?? '—'}, value ${selectedRow?.value ?? '—'}`;
    card.appendChild(preview);
    const levelTable = document.createElement('div');
    levelTable.className = 'be-upgrade-level-table';
    const head = document.createElement('div');
    head.className = 'be-upgrade-level-row be-upgrade-level-head';
    head.innerHTML = '<div>Level</div><div>Cost</div><div>Value</div>';
    levelTable.appendChild(head);
    (upgrade.levels || []).forEach((row: any) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'be-upgrade-level-row';
      rowEl.innerHTML = `<div>L${row.level}</div><div>${row.cost}</div><div>${row.value}</div>`;
      levelTable.appendChild(rowEl);
    });
    const tree = renderTreeNode({ baseCost: upgrade.baseCost, perLevelValue: upgrade.perLevelValue }, ['metaUpgrades', id], 1);
    if (tree) card.appendChild(tree);
    card.appendChild(levelTable);
    card.appendChild(buildRelatedLinks('metaUpgrades'));
    grid.appendChild(card);
  });
  fieldGridEl.appendChild(grid);
}

function renderSectionFields() {
  if (selectedSection === 'base') {
    renderBaseSectionFields();
    return;
  }
  if (selectedSection === 'weapons') {
    renderWeaponsSection();
    return;
  }
  if (selectedSection === 'metaUpgrades') {
    renderMetaUpgradesSection();
    return;
  }
  if (selectedSection === 'enemies') {
    renderEnemiesSection();
    return;
  }
  if (selectedSection === 'runCards') {
    renderRunCardsSection();
    return;
  }
  const sectionValue = draftConfig[selectedSection];
  const section = listBalanceSections(draftConfig).find(entry => entry.id === selectedSection);
  const fields = listNumericFields(sectionValue, [selectedSection]);
  setSectionMeta(selectedSection, section?.label || selectedSection, `${fields.length} numeric values in this section, grouped by nested config structure.`);
  fieldGridEl.innerHTML = '';
  const tree = renderTreeNode(sectionValue, [selectedSection], 0);
  if (tree) fieldGridEl.appendChild(tree);
}

function openModal(mode: typeof modalMode, value = '') {
  modalMode = mode;
  modalBackdrop.classList.remove('is-hidden');
  modalTextarea.value = value;
  modalTextarea.readOnly = mode === 'export-active' || mode === 'export-override';
  modalCopy.textContent = mode === 'import'
    ? 'Paste a full JSON config or override JSON here, then confirm to load it into the editor.'
    : 'Copy this JSON out, or download/copy it elsewhere. Editing happens in the structured controls, not here.';
}

async function copyModalText() {
  try {
    await navigator.clipboard.writeText(modalTextarea.value);
    setStatus('JSON copied to clipboard.');
  } catch {
    setStatus('Clipboard copy failed. You can still select and copy manually.');
  }
}

function applyDraftToGame() {
  store.setOverride(draftConfig);
  window.dispatchEvent(new CustomEvent('crystal-bastion:balance-config-applied', { detail: { config: store.getActive() } }));
  setStatus('Override saved to localStorage.');
}

function clearOverride() {
  store.clearOverride();
  draftConfig = store.getActive();
  renderSections();
  renderSectionFields();
  window.dispatchEvent(new CustomEvent('crystal-bastion:balance-config-applied', { detail: { config: store.getActive() } }));
  setStatus('Local override cleared. Shipped defaults restored.');
}

root.addEventListener('click', event => {
  const target = event.target as HTMLElement;
  const action = target?.dataset?.action;
  if (!action) return;

  if (action === 'close') closeEditor();
  if (action === 'save') applyDraftToGame();
  if (action === 'reset-draft') {
    draftConfig = store.getDefault();
    renderSections();
    renderSectionFields();
    setStatus('Draft reset to shipped defaults.');
  }
  if (action === 'clear-override') clearOverride();
  if (action === 'export-active') openModal('export-active', JSON.stringify(draftConfig, null, 2));
  if (action === 'export-override') openModal('export-override', store.exportOverrideConfig());
  if (action === 'import-json') openModal('import', store.exportOverrideConfig() === '{}' ? '' : store.exportOverrideConfig());
});

modalBackdrop.addEventListener('click', event => {
  const target = event.target as HTMLElement;
  if (target === modalBackdrop) closeModal();
  const action = target?.dataset?.modalAction;
  if (!action) return;
  if (action === 'cancel') closeModal();
  if (action === 'copy') copyModalText();
  if (action === 'confirm') {
    if (modalMode === 'import') {
      try {
        store.importOverrideFromJson(modalTextarea.value);
        draftConfig = store.getActive();
        renderSections();
        renderSectionFields();
        window.dispatchEvent(new CustomEvent('crystal-bastion:balance-config-applied', { detail: { config: store.getActive() } }));
        setStatus('JSON override imported and applied.');
        closeModal();
      } catch (error: any) {
        setStatus(`Import failed: ${error?.message || error}`);
      }
    } else {
      closeModal();
    }
  }
});

window.addEventListener('keydown', event => {
  downKeys.add(event.code);
  const hasCombo = downKeys.has('Digit8') && downKeys.has('Digit9') && downKeys.has('Digit0');
  if (hasCombo && !overlayOpen) {
    event.preventDefault();
    openEditor();
  } else if (event.code === 'Escape' && overlayOpen) {
    event.preventDefault();
    closeEditor();
  }
});

window.addEventListener('keyup', event => {
  downKeys.delete(event.code);
});

window.addEventListener('crystal-bastion:balance-config-refresh-editor', () => {
  draftConfig = store.getActive();
  if (overlayOpen) {
    renderSections();
    renderSectionFields();
  }
});

