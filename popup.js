// ============================================================
// AI Prompt Vault v2.0 — popup.js
// Vanilla JS · Chrome Manifest V3 · No dependencies
// ============================================================

// ── Constants ─────────────────────────────────────────────────
const TRUNCATE_LEN = 160;
const CATEGORY_COLORS = [
  '#7c6aff','#ec4899','#f59e0b','#10b981','#3b82f6',
  '#8b5cf6','#ef4444','#06b6d4','#84cc16','#f97316',
];

// ── State ──────────────────────────────────────────────────────
const state = {
  prompts: [],
  trash: [],
  settings: {
    theme: 'dark',
    fontSize: 'medium',
    cardSize: 'normal',
    defaultSort: 'newest',
  },
  recentlyViewed: [],
  // UI
  activeTab: 'vault',
  activeFilters: new Set(),
  searchQuery: '',
  sortValue: 'newest',
  categoryFilter: 'all',
  editingId: null,
  selectedIds: new Set(),
  multiSelectMode: false,
};

// ── Storage helpers ────────────────────────────────────────────
const storage = {
  get: keys => new Promise(r => chrome.storage.local.get(keys, r)),
  set: data  => new Promise(r => chrome.storage.local.set(data, r)),
};

// ── DOM refs (resolved after DOMContentLoaded) ─────────────────
let themeToggle, sortSelect, categoryFilterEl, searchEl, searchClear,
    bulkBar, selectedCountEl, promptListEl;

// ── Init ───────────────────────────────────────────────────────
async function init() {
  themeToggle      = document.getElementById('themeToggle');
  sortSelect       = document.getElementById('sortSelect');
  categoryFilterEl = document.getElementById('categoryFilter');
  searchEl         = document.getElementById('search');
  searchClear      = document.getElementById('searchClear');
  bulkBar          = document.getElementById('bulkBar');
  selectedCountEl  = document.getElementById('selectedCount');
  promptListEl     = document.getElementById('promptList');

  const data = await storage.get(['prompts','trash','settings','recentlyViewed']);
  state.prompts        = data.prompts        || [];
  state.trash          = data.trash          || [];
  state.recentlyViewed = data.recentlyViewed || [];
  state.settings       = Object.assign({ theme:'dark', fontSize:'medium', cardSize:'normal', defaultSort:'newest' }, data.settings || {});

  applySettings(false);
  state.sortValue = state.settings.defaultSort;
  sortSelect.value = state.sortValue;

  bindEvents();
  setupKeyboardShortcuts();
  renderVault();
}

// ── Settings ───────────────────────────────────────────────────
function applySettings(save = true) {
  const { theme, fontSize, cardSize, defaultSort } = state.settings;
  document.body.className     = theme;
  document.body.dataset.fontSize = fontSize;
  document.body.dataset.cardSize = cardSize;

  // Sync setting toggle buttons
  document.querySelectorAll('[data-setting]').forEach(btn => {
    btn.classList.toggle('active', state.settings[btn.dataset.setting] === btn.dataset.value);
  });
  const defSortEl = document.getElementById('defaultSort');
  if (defSortEl) defSortEl.value = defaultSort;
  if (themeToggle) themeToggle.textContent = theme === 'dark' ? '🌙' : '☀️';

  if (save) storage.set({ settings: state.settings });
}

function setSetting(key, value) {
  state.settings[key] = value;
  applySettings(true);
}

// ── Toast ──────────────────────────────────────────────────────
let toastTimer = null;

function showToast(message, type = 'success', action = null) {
  const el = document.getElementById('toast');
  el.innerHTML = '';

  const msg = document.createElement('span');
  msg.textContent = message;
  el.appendChild(msg);

  if (action) {
    const btn = document.createElement('button');
    btn.className  = 'toast-action';
    btn.textContent = action.label;
    btn.onclick = () => { action.fn(); hideToast(); };
    el.appendChild(btn);
  }

  el.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, action ? 5000 : 2500);
}

function hideToast() {
  document.getElementById('toast').classList.remove('show');
}

// ── Confirm Dialog ─────────────────────────────────────────────
function showConfirm({ icon = '⚠️', title = 'Are you sure?', message = '', okText = 'Confirm', okClass = 'btn-danger' } = {}) {
  return new Promise(resolve => {
    document.getElementById('confirmIcon').textContent   = icon;
    document.getElementById('confirmTitle').textContent  = title;
    document.getElementById('confirmMessage').textContent = message;
    const okBtn = document.getElementById('confirmOk');
    okBtn.textContent = okText;
    okBtn.className   = `btn ${okClass}`;

    const overlay = document.getElementById('confirmModal');
    overlay.classList.remove('hidden');

    function finish(result) {
      overlay.classList.add('hidden');
      // Re-clone to remove old listeners
      const newOk     = okBtn.cloneNode(true);
      const newCancel = document.getElementById('confirmCancel').cloneNode(true);
      okBtn.replaceWith(newOk);
      document.getElementById('confirmCancel').replaceWith(newCancel);
      resolve(result);
    }

    document.getElementById('confirmOk').addEventListener('click', () => finish(true), { once: true });
    document.getElementById('confirmCancel').addEventListener('click', () => finish(false), { once: true });
    overlay.addEventListener('click', e => { if (e.target === overlay) finish(false); }, { once: true });
  });
}

// ── Tab Navigation ─────────────────────────────────────────────
function switchTab(name) {
  state.activeTab = name;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-content').forEach(s => s.classList.toggle('active', s.id === `tab-${name}`));
  if (name === 'vault')     renderVault();
  if (name === 'dashboard') renderDashboard();
  if (name === 'add')       { loadDraft(); updateCharCount(); }
}

// Make switchTab globally accessible (used in empty state innerHTML)
window.switchTab = switchTab;

// ── Utilities ──────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatRelative(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d)) return isoStr;
  const diff  = Date.now() - d.getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)  return `${days}d ago`;
  return d.toLocaleDateString();
}

function getCategoryColor(cat) {
  if (!cat) return CATEGORY_COLORS[0];
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) | 0;
  return CATEGORY_COLORS[Math.abs(h) % CATEGORY_COLORS.length];
}

function parseTags(raw) {
  return raw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
}

function downloadFile(content, filename, mime) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}

// ── Category Filter + Datalist ─────────────────────────────────
function populateCategoryFilter() {
  const activePrompts = state.prompts.filter(p => !p.archived);
  const cats = [...new Set(activePrompts.map(p => (p.category || 'General').trim() || 'General'))].sort();

  const prev = categoryFilterEl.value || 'all';
  categoryFilterEl.innerHTML = '<option value="all">All Categories</option>';
  cats.forEach(c => {
    const o = document.createElement('option');
    o.value = o.textContent = c;
    categoryFilterEl.appendChild(o);
  });
  categoryFilterEl.value = cats.includes(prev) || prev === 'all' ? prev : 'all';
  state.categoryFilter = categoryFilterEl.value;

  const dl = document.getElementById('categoryList');
  if (dl) {
    dl.innerHTML = '';
    cats.forEach(c => { const o = document.createElement('option'); o.value = c; dl.appendChild(o); });
  }
}

// ── Vault Rendering ────────────────────────────────────────────
function renderVault() {
  populateCategoryFilter();

  const inTrash    = state.activeFilters.has('trash');
  const inArchived = state.activeFilters.has('archived');

  let source = inTrash ? state.trash : state.prompts;
  if (!inTrash) {
    source = inArchived
      ? source.filter(p => p.archived)
      : source.filter(p => !p.archived);
  }

  const q = state.searchQuery.toLowerCase();
  let filtered = source.filter(p => {
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      (p.prompt || '').toLowerCase().includes(q) ||
      (p.tags || []).some(t => t.includes(q))
    );
  });

  if (state.categoryFilter !== 'all') {
    filtered = filtered.filter(p => (p.category || 'General') === state.categoryFilter);
  }
  if (state.activeFilters.has('favorites')) filtered = filtered.filter(p => p.favorite);
  if (state.activeFilters.has('pinned'))    filtered = filtered.filter(p => p.pinned);

  // Sort
  filtered = [...filtered];
  switch (state.sortValue) {
    case 'oldest': filtered.sort((a,b) => a.id - b.id); break;
    case 'az':     filtered.sort((a,b) => a.title.localeCompare(b.title)); break;
    case 'za':     filtered.sort((a,b) => b.title.localeCompare(a.title)); break;
    case 'edited': filtered.sort((a,b) => new Date(b.updatedAt||b.createdAt) - new Date(a.updatedAt||a.createdAt)); break;
    default:       filtered.sort((a,b) => b.id - a.id); break;
  }
  // Pinned float to top (not in trash)
  if (!inTrash) filtered.sort((a,b) => (b.pinned?1:0) - (a.pinned?1:0));

  promptListEl.innerHTML = '';

  if (filtered.length === 0) {
    promptListEl.innerHTML = renderEmptyState(inTrash, inArchived, q);
    return;
  }

  const frag = document.createDocumentFragment();
  filtered.forEach(p => frag.appendChild(createCard(p, inTrash)));
  promptListEl.appendChild(frag);
  updateBulkBar();
}

function renderEmptyState(inTrash, inArchived, q) {
  let icon, title, sub, cta = '';
  if (q) {
    icon = '🔍'; title = 'No results found';
    sub = `Nothing matched "<strong>${escapeHtml(q)}</strong>". Try different keywords.`;
  } else if (inTrash) {
    icon = '🗑'; title = 'Trash is empty'; sub = 'Deleted prompts will appear here.';
  } else if (inArchived) {
    icon = '📦'; title = 'Archive is empty'; sub = 'Archived prompts will appear here.';
  } else {
    icon = '✨'; title = 'Your vault is empty'; sub = 'Create your first prompt to get started!';
    cta = `<button class="btn btn-primary" onclick="switchTab('add')" style="margin-top:8px;padding:8px 20px">✦ Create Prompt</button>`;
  }
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><h3>${title}</h3><p>${sub}</p>${cta}</div>`;
}

// ── Card Builder ───────────────────────────────────────────────
function createCard(prompt, inTrash = false) {
  const card = document.createElement('div');
  const isSelected = state.selectedIds.has(prompt.id);
  const color = getCategoryColor(prompt.category);
  const fullText = prompt.prompt || '';
  const truncated = fullText.length > TRUNCATE_LEN;
  const displayText = truncated ? fullText.slice(0, TRUNCATE_LEN) + '…' : fullText;
  const tagsHtml = (prompt.tags || []).map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('');
  const dateLabel = prompt.updatedAt && prompt.updatedAt !== prompt.createdAt
    ? `Edited ${formatRelative(prompt.updatedAt)}`
    : `Added ${formatRelative(prompt.createdAt)}`;

  card.className = [
    'card',
    prompt.pinned && !inTrash ? 'pinned' : '',
    isSelected ? 'selected' : '',
  ].filter(Boolean).join(' ');
  card.dataset.id = prompt.id;

  const selectClass = state.multiSelectMode ? '' : 'hidden';

  card.innerHTML = `
    <div class="card-select ${selectClass}">
      <input type="checkbox" class="checkbox" ${isSelected ? 'checked' : ''}>
    </div>
    <div class="card-body">
      <div class="card-header">
        <div class="card-title-row">
          ${prompt.pinned && !inTrash ? '<span class="pin-indicator">📌</span>' : ''}
          ${prompt.favorite && !inTrash ? '<span class="fav-indicator">⭐</span>' : ''}
          <h3 class="card-title">${escapeHtml(prompt.title)}</h3>
        </div>
        <span class="badge" style="background:${color}22;color:${color};border-color:${color}44">
          ${escapeHtml(prompt.category || 'General')}
        </span>
      </div>
      ${tagsHtml ? `<div class="card-tags">${tagsHtml}</div>` : ''}
      <div class="card-prompt">
        <p class="prompt-text">${escapeHtml(displayText)}</p>
        ${truncated ? '<button class="read-more-btn">Read more</button>' : ''}
      </div>
      <div class="card-footer">
        <span class="timestamp">${dateLabel}</span>
        <div class="card-actions">
          ${inTrash ? `
            <button class="action-btn restore-btn" title="Restore">♻️</button>
            <button class="action-btn perm-delete-btn" title="Delete permanently">🗑</button>
          ` : `
            <button class="action-btn copy-btn" title="Copy prompt">📋</button>
            <button class="action-btn copy-md-btn" title="Copy as Markdown">Ⓜ</button>
            <button class="action-btn edit-btn" title="Edit">✏️</button>
            <button class="action-btn dupe-btn" title="Duplicate">⧉</button>
            <button class="action-btn pin-btn ${prompt.pinned ? 'active' : ''}" title="${prompt.pinned ? 'Unpin' : 'Pin'}">📌</button>
            <button class="action-btn fav-btn ${prompt.favorite ? 'active' : ''}" title="${prompt.favorite ? 'Remove from favorites' : 'Add to favorites'}">⭐</button>
            <button class="action-btn archive-btn" title="${prompt.archived ? 'Unarchive' : 'Archive'}">📦</button>
            <button class="action-btn delete-btn" title="Delete">🗑</button>
          `}
        </div>
      </div>
    </div>`;

  const body = card.querySelector('.card-body');

  // ── Multi-select
  const cb = card.querySelector('.checkbox');
  if (cb) cb.addEventListener('change', () => toggleSelect(prompt.id));

  // Long-press on body to enter multi-select
  let pressTimer;
  body.addEventListener('mousedown', () => { pressTimer = setTimeout(() => enterMultiSelect(prompt.id), 600); });
  body.addEventListener('mouseup',   () => clearTimeout(pressTimer));
  body.addEventListener('mouseleave',() => clearTimeout(pressTimer));

  // Click in multi-select mode
  body.addEventListener('click', e => {
    if (!state.multiSelectMode) return;
    if (e.target.closest('.card-actions') || e.target.closest('.read-more-btn')) return;
    toggleSelect(prompt.id);
  });

  // ── Read more
  const rmBtn = card.querySelector('.read-more-btn');
  if (rmBtn) {
    const pEl = card.querySelector('.prompt-text');
    let expanded = false;
    rmBtn.addEventListener('click', e => {
      e.stopPropagation();
      expanded = !expanded;
      pEl.textContent = expanded ? fullText : fullText.slice(0, TRUNCATE_LEN) + '…';
      rmBtn.textContent = expanded ? 'Read less' : 'Read more';
    });
  }

  // ── Action buttons
  if (inTrash) {
    card.querySelector('.restore-btn').addEventListener('click', e => { e.stopPropagation(); restoreFromTrash(prompt.id); });
    card.querySelector('.perm-delete-btn').addEventListener('click', e => { e.stopPropagation(); permanentDelete(prompt.id); });
  } else {
    card.querySelector('.copy-btn').addEventListener('click', e => { e.stopPropagation(); copyPrompt(prompt); });
    card.querySelector('.copy-md-btn').addEventListener('click', e => { e.stopPropagation(); copyAsMarkdown(prompt); });
    card.querySelector('.edit-btn').addEventListener('click', e => { e.stopPropagation(); openEdit(prompt); });
    card.querySelector('.dupe-btn').addEventListener('click', e => { e.stopPropagation(); duplicatePrompt(prompt.id); });
    card.querySelector('.pin-btn').addEventListener('click', e => { e.stopPropagation(); togglePin(prompt.id); });
    card.querySelector('.fav-btn').addEventListener('click', e => { e.stopPropagation(); toggleFavorite(prompt.id); });
    card.querySelector('.archive-btn').addEventListener('click', e => { e.stopPropagation(); toggleArchive(prompt.id); });
    card.querySelector('.delete-btn').addEventListener('click', e => { e.stopPropagation(); deletePrompt(prompt.id); });
    // Track view on non-action card clicks
    body.addEventListener('click', e => {
      if (!e.target.closest('.card-actions') && !e.target.closest('.read-more-btn') && !state.multiSelectMode) {
        trackRecentlyViewed(prompt.id);
      }
    });
  }

  return card;
}

// ── CRUD ───────────────────────────────────────────────────────
async function savePrompt() {
  const title    = document.getElementById('titleInput').value.trim();
  const category = document.getElementById('categoryInput').value.trim();
  const tagsRaw  = document.getElementById('tagsInput').value.trim();
  const prompt   = document.getElementById('promptInput').value.trim();

  if (!title)  { showToast('Please enter a title.', 'error'); return; }
  if (!prompt) { showToast('Please enter a prompt.', 'error'); return; }

  const tags = parseTags(tagsRaw);
  const now  = new Date().toISOString();

  if (state.editingId) {
    const idx = state.prompts.findIndex(p => p.id === state.editingId);
    if (idx !== -1) {
      state.prompts[idx] = { ...state.prompts[idx], title, category, tags, prompt, updatedAt: now };
    }
    showToast('✅ Prompt updated!', 'success');
    state.editingId = null;
  } else {
    state.prompts.unshift({
      id: Date.now(), title, category, tags, prompt,
      favorite: false, pinned: false, archived: false,
      createdAt: now, updatedAt: now,
    });
    showToast('✅ Prompt saved!', 'success');
  }

  clearDraft();
  await storage.set({ prompts: state.prompts });
  clearForm();
  switchTab('vault');
}

function openEdit(prompt) {
  state.editingId = prompt.id;
  document.getElementById('formTitle').textContent    = 'Edit Prompt';
  document.getElementById('saveBtnText').textContent  = 'Update Prompt';
  document.getElementById('titleInput').value    = prompt.title;
  document.getElementById('categoryInput').value = prompt.category || '';
  document.getElementById('tagsInput').value     = (prompt.tags || []).join(', ');
  document.getElementById('promptInput').value   = prompt.prompt;
  updateCharCount();
  switchTab('add');
}

async function deletePrompt(id) {
  const prompt = state.prompts.find(p => p.id === id);
  if (!prompt) return;

  // Snapshot for undo
  const snap = { prompts: [...state.prompts], trash: [...state.trash] };
  state.prompts = state.prompts.filter(p => p.id !== id);
  state.trash.push({ ...prompt, deletedAt: new Date().toISOString() });
  await storage.set({ prompts: state.prompts, trash: state.trash });
  renderVault();

  showToast('Prompt moved to trash.', 'info', {
    label: 'Undo',
    fn: async () => {
      state.prompts = snap.prompts;
      state.trash   = snap.trash;
      await storage.set({ prompts: state.prompts, trash: state.trash });
      renderVault();
      showToast('Delete undone!', 'success');
    },
  });
}

async function permanentDelete(id) {
  const confirmed = await showConfirm({
    icon: '🗑', title: 'Delete permanently?',
    message: 'This prompt will be gone forever and cannot be recovered.',
    okText: 'Delete Forever',
  });
  if (!confirmed) return;
  state.trash = state.trash.filter(p => p.id !== id);
  await storage.set({ trash: state.trash });
  renderVault();
  showToast('Permanently deleted.', 'info');
}

async function restoreFromTrash(id) {
  const item = state.trash.find(p => p.id === id);
  if (!item) return;
  const { deletedAt, ...restored } = item;
  state.trash = state.trash.filter(p => p.id !== id);
  state.prompts.unshift({ ...restored, updatedAt: new Date().toISOString() });
  await storage.set({ prompts: state.prompts, trash: state.trash });
  renderVault();
  showToast('♻️ Prompt restored!', 'success');
}

async function toggleFavorite(id) {
  const p = state.prompts.find(p => p.id === id);
  if (!p) return;
  p.favorite = !p.favorite;
  await storage.set({ prompts: state.prompts });
  renderVault();
  showToast(p.favorite ? '⭐ Added to favorites!' : 'Removed from favorites.', p.favorite ? 'success' : 'info');
}

async function togglePin(id) {
  const p = state.prompts.find(p => p.id === id);
  if (!p) return;
  p.pinned = !p.pinned;
  await storage.set({ prompts: state.prompts });
  renderVault();
  showToast(p.pinned ? '📌 Pinned!' : 'Unpinned.', p.pinned ? 'success' : 'info');
}

async function toggleArchive(id) {
  const p = state.prompts.find(p => p.id === id);
  if (!p) return;
  p.archived = !p.archived;
  await storage.set({ prompts: state.prompts });
  renderVault();
  showToast(p.archived ? '📦 Archived.' : 'Moved back to vault.', 'info');
}

async function duplicatePrompt(id) {
  const p = state.prompts.find(p => p.id === id);
  if (!p) return;
  const now = new Date().toISOString();
  const copy = { ...p, id: Date.now(), title: p.title + ' (Copy)', pinned: false, createdAt: now, updatedAt: now };
  const idx = state.prompts.findIndex(p => p.id === id);
  state.prompts.splice(idx + 1, 0, copy);
  await storage.set({ prompts: state.prompts });
  renderVault();
  showToast('⧉ Prompt duplicated!', 'success');
}

// ── Copy ───────────────────────────────────────────────────────
function copyPrompt(prompt) {
  navigator.clipboard.writeText(prompt.prompt).then(() => {
    trackRecentlyViewed(prompt.id);
    showToast('📋 Copied to clipboard!', 'success');
  }).catch(() => showToast('Copy failed.', 'error'));
}

function copyAsMarkdown(prompt) {
  const tagsLine = prompt.tags && prompt.tags.length
    ? `\n**Tags:** ${prompt.tags.map(t => `#${t}`).join(' ')}` : '';
  const md = `# ${prompt.title}\n\n**Category:** ${prompt.category || 'General'}${tagsLine}\n\n---\n\n${prompt.prompt}`;
  navigator.clipboard.writeText(md).then(() => {
    showToast('Ⓜ Copied as Markdown!', 'success');
  }).catch(() => showToast('Copy failed.', 'error'));
}

// ── Multi-select ───────────────────────────────────────────────
function enterMultiSelect(id) {
  state.multiSelectMode = true;
  state.selectedIds.add(id);
  renderVault();
}

function toggleSelect(id) {
  state.selectedIds.has(id) ? state.selectedIds.delete(id) : state.selectedIds.add(id);
  if (state.selectedIds.size === 0) state.multiSelectMode = false;
  updateBulkBar();
  const card = document.querySelector(`.card[data-id="${id}"]`);
  if (card) {
    card.classList.toggle('selected', state.selectedIds.has(id));
    const cb = card.querySelector('.checkbox');
    if (cb) cb.checked = state.selectedIds.has(id);
  }
}

function updateBulkBar() {
  const show = state.multiSelectMode && state.selectedIds.size > 0;
  bulkBar.classList.toggle('hidden', !show);
  if (show) selectedCountEl.textContent = `${state.selectedIds.size} selected`;
}

async function bulkDelete() {
  if (!state.selectedIds.size) return;
  const confirmed = await showConfirm({
    title: `Delete ${state.selectedIds.size} prompt${state.selectedIds.size !== 1 ? 's' : ''}?`,
    message: 'They will be moved to Trash. You can restore them later.',
    okText: 'Delete Selected',
  });
  if (!confirmed) return;
  const now = new Date().toISOString();
  const toDelete = state.prompts.filter(p => state.selectedIds.has(p.id));
  state.trash.push(...toDelete.map(p => ({ ...p, deletedAt: now })));
  state.prompts = state.prompts.filter(p => !state.selectedIds.has(p.id));
  state.selectedIds.clear();
  state.multiSelectMode = false;
  await storage.set({ prompts: state.prompts, trash: state.trash });
  renderVault();
  showToast(`${toDelete.length} prompts moved to Trash.`, 'info');
}

// ── Recently Viewed ────────────────────────────────────────────
async function trackRecentlyViewed(id) {
  state.recentlyViewed = [id, ...state.recentlyViewed.filter(x => x !== id)].slice(0, 10);
  await storage.set({ recentlyViewed: state.recentlyViewed });
}

// ── Draft (localStorage, not chrome.storage) ───────────────────
let draftTimer = null;
function saveDraft() {
  if (state.editingId) return;
  const draft = {
    title:    document.getElementById('titleInput').value,
    category: document.getElementById('categoryInput').value,
    tags:     document.getElementById('tagsInput').value,
    prompt:   document.getElementById('promptInput').value,
  };
  localStorage.setItem('vault_draft_v2', JSON.stringify(draft));
}
function loadDraft() {
  if (state.editingId) return;
  try {
    const raw = localStorage.getItem('vault_draft_v2');
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.title || d.prompt) {
      document.getElementById('titleInput').value    = d.title    || '';
      document.getElementById('categoryInput').value = d.category || '';
      document.getElementById('tagsInput').value     = d.tags     || '';
      document.getElementById('promptInput').value   = d.prompt   || '';
      updateCharCount();
    }
  } catch {}
}
function clearDraft() { localStorage.removeItem('vault_draft_v2'); }

function clearForm() {
  state.editingId = null;
  document.getElementById('formTitle').textContent   = 'New Prompt';
  document.getElementById('saveBtnText').textContent = 'Save Prompt';
  ['titleInput','categoryInput','tagsInput','promptInput'].forEach(id => {
    document.getElementById(id).value = '';
  });
  updateCharCount();
}

function updateCharCount() {
  const len = (document.getElementById('promptInput').value || '').length;
  document.getElementById('charCount').textContent = `${len} character${len !== 1 ? 's' : ''}`;
}

// ── Dashboard ──────────────────────────────────────────────────
function renderDashboard() {
  const active   = state.prompts.filter(p => !p.archived);
  const archived = state.prompts.filter(p =>  p.archived);

  document.getElementById('statTotal').textContent     = active.length;
  document.getElementById('statFavorites').textContent = active.filter(p => p.favorite).length;
  document.getElementById('statPinned').textContent    = active.filter(p => p.pinned).length;
  document.getElementById('statArchived').textContent  = archived.length;

  const cats = new Set(active.map(p => p.category || 'General'));
  document.getElementById('statCategories').textContent = cats.size;

  const bytes = JSON.stringify({ p: state.prompts, t: state.trash }).length;
  document.getElementById('statStorage').textContent = `${(bytes / 1024).toFixed(1)} KB`;

  // Top category
  const catMap = {};
  active.forEach(p => { const c = p.category || 'General'; catMap[c] = (catMap[c] || 0) + 1; });
  const topEntry = Object.entries(catMap).sort((a,b) => b[1] - a[1])[0];
  const topCatEl = document.getElementById('topCategory');
  if (topEntry) {
    const col = getCategoryColor(topEntry[0]);
    topCatEl.innerHTML = `<span class="badge" style="background:${col}22;color:${col};border-color:${col}44">${escapeHtml(topEntry[0])}</span>&nbsp;<span class="text-muted">${topEntry[1]} prompt${topEntry[1] !== 1 ? 's' : ''}</span>`;
  } else {
    topCatEl.textContent = '—';
  }

  // Recently added
  const raEl = document.getElementById('recentlyAdded');
  const added = [...active].sort((a,b) => b.id - a.id).slice(0, 3);
  raEl.innerHTML = added.length
    ? added.map(miniCard).join('')
    : '<p class="text-muted">No prompts yet.</p>';

  // Recently viewed
  const rvEl = document.getElementById('recentlyViewed');
  const viewed = state.recentlyViewed
    .map(id => state.prompts.find(p => p.id === id))
    .filter(Boolean).slice(0, 3);
  rvEl.innerHTML = viewed.length
    ? viewed.map(miniCard).join('')
    : '<p class="text-muted">No recently viewed prompts.</p>';
}

function miniCard(p) {
  const c = getCategoryColor(p.category);
  return `<div class="mini-card">
    <span class="mini-title">${escapeHtml(p.title)}</span>
    <span class="badge badge-sm" style="background:${c}22;color:${c};border-color:${c}44">${escapeHtml(p.category || 'General')}</span>
  </div>`;
}

// ── Export ─────────────────────────────────────────────────────
function exportJson() {
  const payload = { version: 2, exportedAt: new Date().toISOString(), prompts: state.prompts };
  downloadFile(JSON.stringify(payload, null, 2), 'ai-prompt-vault.json', 'application/json');
  showToast('📤 JSON exported!', 'success');
}

function exportCsv() {
  const header = ['Title','Category','Tags','Prompt','Favorite','Pinned','Archived','Created','Updated'];
  const rows = state.prompts.map(p => [
    p.title,
    p.category || 'General',
    (p.tags || []).join('; '),
    p.prompt,
    p.favorite ? 'Yes' : 'No',
    p.pinned   ? 'Yes' : 'No',
    p.archived ? 'Yes' : 'No',
    p.createdAt,
    p.updatedAt || p.createdAt,
  ]);
  const csv = [header, ...rows]
    .map(row => row.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(','))
    .join('\n');
  downloadFile(csv, 'ai-prompt-vault.csv', 'text/csv');
  showToast('📊 CSV exported!', 'success');
}

function exportMarkdown() {
  const sections = state.prompts.map(p => {
    const tagsLine = p.tags && p.tags.length ? `\n**Tags:** ${p.tags.map(t=>`#${t}`).join(' ')}` : '';
    return `## ${p.title}\n\n**Category:** ${p.category || 'General'}${tagsLine}\n\n${p.prompt}\n\n---`;
  }).join('\n\n');
  const content = `# AI Prompt Vault Export\n_Exported ${new Date().toLocaleString()}_\n\n---\n\n${sections}`;
  downloadFile(content, 'ai-prompt-vault.md', 'text/markdown');
  showToast('📝 Markdown exported!', 'success');
}

async function importJson(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(reader.result);
      const raw = Array.isArray(parsed) ? parsed : (parsed.prompts || []);
      const valid = raw.filter(p => p && typeof p.title === 'string' && typeof p.prompt === 'string');
      if (!valid.length) { showToast('No valid prompts found in file.', 'error'); return; }
      const now = new Date().toISOString();
      const existingIds = new Set(state.prompts.map(p => p.id));
      const normalized = valid
        .filter(p => !existingIds.has(p.id))
        .map(p => ({
          id: p.id || (Date.now() + Math.random()),
          title: p.title, category: p.category || '', tags: p.tags || [],
          prompt: p.prompt, favorite: !!p.favorite, pinned: !!p.pinned,
          archived: !!p.archived,
          createdAt: p.createdAt || now, updatedAt: p.updatedAt || now,
        }));
      state.prompts = [...normalized, ...state.prompts];
      await storage.set({ prompts: state.prompts });
      renderVault();
      showToast(`✅ Imported ${normalized.length} prompt${normalized.length !== 1 ? 's' : ''}!`, 'success');
    } catch { showToast('Invalid JSON file.', 'error'); }
  };
  reader.readAsText(file);
}

// ── Keyboard Shortcuts ─────────────────────────────────────────
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    const ctrl = e.ctrlKey || e.metaKey;
    const modal = document.getElementById('confirmModal');
    if (!modal.classList.contains('hidden')) return;

    if (ctrl && e.key === 'n') {
      e.preventDefault();
      clearForm();
      switchTab('add');
    }
    if (ctrl && e.key === 'f') {
      e.preventDefault();
      switchTab('vault');
      setTimeout(() => searchEl.focus(), 50);
    }
    if (e.key === 'Escape') {
      if (state.multiSelectMode) {
        state.multiSelectMode = false;
        state.selectedIds.clear();
        renderVault();
        return;
      }
      if (state.editingId) {
        state.editingId = null;
        clearForm();
        switchTab('vault');
        return;
      }
      if (searchEl.value) {
        searchEl.value = '';
        state.searchQuery = '';
        searchClear.classList.add('hidden');
        renderVault();
      }
    }
  });
}

// ── Filter chips ───────────────────────────────────────────────
function toggleFilter(name) {
  if (state.activeFilters.has(name)) {
    state.activeFilters.delete(name);
  } else {
    if (name === 'trash')    state.activeFilters.delete('archived');
    if (name === 'archived') state.activeFilters.delete('trash');
    if (name === 'favorites' || name === 'pinned') {
      state.activeFilters.delete('trash');
      state.activeFilters.delete('archived');
    }
    state.activeFilters.add(name);
  }
  document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', state.activeFilters.has(c.dataset.filter)));
  renderVault();
}

// ── Event Bindings ─────────────────────────────────────────────
function bindEvents() {
  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Theme toggle
  themeToggle.addEventListener('click', () => {
    setSetting('theme', state.settings.theme === 'dark' ? 'light' : 'dark');
  });

  // Search
  searchEl.addEventListener('input', () => {
    state.searchQuery = searchEl.value;
    searchClear.classList.toggle('hidden', !searchEl.value);
    renderVault();
  });
  searchClear.addEventListener('click', () => {
    searchEl.value = '';
    state.searchQuery = '';
    searchClear.classList.add('hidden');
    renderVault();
    searchEl.focus();
  });

  // Sort
  sortSelect.addEventListener('change', () => {
    state.sortValue = sortSelect.value;
    renderVault();
  });

  // Category filter
  categoryFilterEl.addEventListener('change', () => {
    state.categoryFilter = categoryFilterEl.value;
    renderVault();
  });

  // Filter chips
  document.querySelectorAll('.chip').forEach(c => {
    c.addEventListener('click', () => toggleFilter(c.dataset.filter));
  });

  // Bulk bar
  document.getElementById('bulkDeleteBtn').addEventListener('click', bulkDelete);
  document.getElementById('bulkCancelBtn').addEventListener('click', () => {
    state.multiSelectMode = false;
    state.selectedIds.clear();
    renderVault();
  });

  // Form
  document.getElementById('saveBtn').addEventListener('click', savePrompt);
  document.getElementById('clearBtn').addEventListener('click', () => {
    clearForm(); clearDraft();
    if (state.editingId) { state.editingId = null; switchTab('vault'); }
  });

  // Char count + draft auto-save
  document.getElementById('promptInput').addEventListener('input', () => {
    updateCharCount();
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 600);
  });
  ['titleInput','categoryInput','tagsInput'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      clearTimeout(draftTimer);
      draftTimer = setTimeout(saveDraft, 600);
    });
  });

  // Settings toggles
  document.querySelectorAll('[data-setting]').forEach(btn => {
    btn.addEventListener('click', () => setSetting(btn.dataset.setting, btn.dataset.value));
  });
  document.getElementById('defaultSort').addEventListener('change', e => {
    setSetting('defaultSort', e.target.value);
  });

  // Export / Import
  document.getElementById('exportJson').addEventListener('click', exportJson);
  document.getElementById('exportCsv').addEventListener('click', exportCsv);
  document.getElementById('exportMd').addEventListener('click', exportMarkdown);
  document.getElementById('importJsonBtn').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', e => {
    if (e.target.files[0]) importJson(e.target.files[0]);
    e.target.value = '';
  });

  // Backup / Restore
  document.getElementById('backupBtn').addEventListener('click', () => {
    const data = { version: 2, backedUpAt: new Date().toISOString(), prompts: state.prompts, trash: state.trash, settings: state.settings };
    downloadFile(JSON.stringify(data, null, 2), `vault-backup-${Date.now()}.json`, 'application/json');
    showToast('💾 Backup saved!', 'success');
  });
  document.getElementById('restoreBtn').addEventListener('click', () => document.getElementById('restoreFile').click());
  document.getElementById('restoreFile').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.prompts)  state.prompts   = data.prompts;
        if (data.trash)    state.trash     = data.trash;
        if (data.settings) state.settings  = { ...state.settings, ...data.settings };
        await storage.set({ prompts: state.prompts, trash: state.trash, settings: state.settings });
        applySettings(false);
        renderVault();
        showToast('🔄 Backup restored!', 'success');
      } catch { showToast('Invalid backup file.', 'error'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // Empty Trash
  document.getElementById('emptyTrashBtn').addEventListener('click', async () => {
    if (!state.trash.length) { showToast('Trash is already empty.', 'info'); return; }
    const confirmed = await showConfirm({
      title: 'Empty Trash?',
      message: `Permanently delete ${state.trash.length} prompt${state.trash.length !== 1 ? 's' : ''}. This cannot be undone.`,
      okText: 'Empty Trash',
    });
    if (!confirmed) return;
    state.trash = [];
    await storage.set({ trash: state.trash });
    renderVault();
    showToast('Trash emptied.', 'info');
  });

  // Clear All
  document.getElementById('clearAllBtn').addEventListener('click', async () => {
    const confirmed = await showConfirm({
      icon: '⚠️',
      title: 'Clear ALL data?',
      message: 'This permanently deletes every prompt, archived item, and trash entry. This cannot be undone.',
      okText: 'Clear Everything',
    });
    if (!confirmed) return;
    state.prompts = [];
    state.trash   = [];
    state.recentlyViewed = [];
    await storage.set({ prompts: [], trash: [], recentlyViewed: [] });
    renderVault();
    showToast('All data cleared.', 'info');
  });
}

// ── Boot ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
