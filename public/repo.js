// ===== GitKraken-Style Repo Detail =====

// === Constants ===
const LANE_COLORS = ['#00b4d8','#e040fb','#66bb6a','#ffa726','#7c4dff','#ef5350','#26c6da','#29b6f6'];
const ROW_HEIGHT = 34;
const LANE_WIDTH = 14;
const LANE_OFFSET = 14;
const NODE_R = 5;

// === State ===
const repoPath = new URLSearchParams(window.location.search).get('path');
let repoData = null;
let graphCommits = [];
let graphLayout = [];
let selectedHash = null;
let maxLane = 0;

// === Toast ===
function showToast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity 0.3s,transform 0.3s';
    t.style.opacity = '0';
    t.style.transform = 'translateY(8px)';
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

// === Utilities ===
function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDate(date) {
  const pad = n => n < 10 ? '0' + n : n;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function getInitials(name) {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  if (p.length >= 2) return (p[0][0] + p[p.length-1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}
function hashToColor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}
function remoteUrlToHttp(url) {
  if (!url) return null;
  if (url.startsWith('git@')) return url.replace(/^git@([^:]+):/,'https://$1/').replace(/\.git$/,'');
  return url.replace(/\.git$/,'');
}

// === Data Loading ===
async function loadAll() {
  if (!repoPath) { showError('No repository path specified.'); return; }
  try {
    const [detailRes, graphRes] = await Promise.all([
      fetch(`/api/repo/detail?path=${encodeURIComponent(repoPath)}`),
      fetch(`/api/repo/graph?path=${encodeURIComponent(repoPath)}&count=100`),
    ]);
    if (!detailRes.ok) throw new Error((await detailRes.json()).error || 'Failed to load detail');
    if (!graphRes.ok) throw new Error((await graphRes.json()).error || 'Failed to load graph');
    repoData = await detailRes.json();
    graphCommits = await graphRes.json();
    renderAll();
  } catch (err) {
    showError(err.message);
  }
}

function showError(msg) {
  document.getElementById('state-loading').classList.add('hidden');
  document.getElementById('state-data').style.display = 'none';
  const errEl = document.getElementById('state-error');
  errEl.classList.remove('hidden');
  document.getElementById('error-message').textContent = msg;
}

function renderAll() {
  document.getElementById('state-loading').classList.add('hidden');
  document.getElementById('state-error').classList.add('hidden');
  const dataEl = document.getElementById('state-data');
  dataEl.classList.remove('hidden');
  dataEl.style.display = 'flex';

  renderToolbar();
  renderSidebar();
  buildGraph();
  renderGraphSvg();
  renderCommitList();
}

// === Toolbar ===
function renderToolbar() {
  document.title = `${repoData.name} — GitManage`;
  document.getElementById('repo-name').textContent = repoData.name;
  document.getElementById('repo-branch').textContent = repoData.branch;

  const st = document.getElementById('repo-status');
  if (repoData.status.isClean) {
    st.style.background = 'rgba(34,197,94,0.1)';
    st.style.color = '#4ade80';
    st.style.border = '1px solid rgba(34,197,94,0.2)';
    st.textContent = '● Clean';
  } else {
    const cnt = (repoData.status.modified?.length||0)+(repoData.status.deleted?.length||0)+(repoData.status.not_added?.length||0);
    st.style.background = 'rgba(251,191,36,0.1)';
    st.style.color = '#fbbf24';
    st.style.border = '1px solid rgba(251,191,36,0.2)';
    st.textContent = `● ${cnt} changed`;
  }

  const goBtn = document.getElementById('btn-goto-repo');
  if (repoData.remoteUrl) {
    const url = remoteUrlToHttp(repoData.remoteUrl);
    if (url) { goBtn.href = url; goBtn.classList.remove('hidden'); }
  }
}

// === Sidebar ===
function renderSidebar() {
  // Local branches
  const localEl = document.getElementById('local-branches');
  document.getElementById('local-count').textContent = repoData.localBranches.length;
  localEl.innerHTML = repoData.localBranches.map(b => `
    <div class="branch-item ${b === repoData.branch ? 'active' : ''}" ondblclick="checkoutBranch('${escapeHtml(b)}')" title="Double-click to checkout">
      <svg class="branch-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
      <span class="branch-name">${escapeHtml(b)}</span>
    </div>
  `).join('');

  // Remote branches
  const remoteEl = document.getElementById('remote-branches');
  document.getElementById('remote-count').textContent = repoData.remoteBranches.length;
  remoteEl.innerHTML = repoData.remoteBranches.map(b => {
    const display = b.replace(/^remotes\//,'');
    return `
      <div class="branch-item" ondblclick="checkoutBranch('${escapeHtml(b)}')" title="Double-click to checkout">
        <svg class="branch-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064"/></svg>
        <span class="branch-name">${escapeHtml(display)}</span>
      </div>
    `;
  }).join('');

  // Tags
  const tagsEl = document.getElementById('tags-list');
  const tags = repoData.tags || [];
  document.getElementById('tags-count').textContent = tags.length;
  tagsEl.innerHTML = tags.map(t => `
    <div class="branch-item">
      <svg class="branch-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
      <span class="branch-name">${escapeHtml(t)}</span>
    </div>
  `).join('');

  // Re-apply filter if active
  const searchInput = document.getElementById('branch-search');
  if (searchInput && searchInput.value) {
    window.filterBranches(searchInput.value);
  }
}

window.toggleSection = function(header) {
  header.classList.toggle('collapsed');
  const list = header.nextElementSibling;
  if (list) list.classList.toggle('collapsed');
};

// === Branch Search ===
window.filterBranches = function(query) {
  const lowerQuery = query.toLowerCase();
  document.querySelectorAll('.branch-item').forEach(item => {
    const branchName = item.querySelector('.branch-name').textContent.toLowerCase();
    item.style.display = branchName.includes(lowerQuery) ? 'flex' : 'none';
  });
};

// === Graph Engine ===
function buildGraph() {
  const commits = graphCommits;
  const lanes = []; // each entry: hash this lane expects next
  graphLayout = [];
  maxLane = 0;

  for (let i = 0; i < commits.length; i++) {
    const c = commits[i];
    const hash = c.hash;
    const parents = c.parents ? c.parents.split(' ').filter(Boolean) : [];

    // Find lanes expecting this hash
    const occupied = [];
    lanes.forEach((h, idx) => { if (h === hash) occupied.push(idx); });

    let myLane;
    if (occupied.length > 0) {
      myLane = occupied[0];
      // Close extra lanes (merge point)
      for (let j = occupied.length - 1; j >= 1; j--) lanes[occupied[j]] = null;
    } else {
      let free = lanes.indexOf(null);
      if (free === -1) { free = lanes.length; lanes.push(null); }
      myLane = free;
    }

    // First parent continues on this lane
    lanes[myLane] = parents[0] || null;

    // Additional parents: find or create lanes
    for (let p = 1; p < parents.length; p++) {
      if (lanes.indexOf(parents[p]) === -1) {
        let free = lanes.indexOf(null);
        if (free === -1) { free = lanes.length; lanes.push(null); }
        lanes[free] = parents[p];
      }
    }

    // Trim trailing nulls
    while (lanes.length > 0 && lanes[lanes.length - 1] === null) lanes.pop();

    if (myLane > maxLane) maxLane = myLane;

    graphLayout.push({
      ...c,
      lane: myLane,
      rowIndex: i,
      color: LANE_COLORS[myLane % LANE_COLORS.length],
    });
  }
}

// === Graph SVG Rendering ===
function renderGraphSvg() {
  const svg = document.getElementById('graph-svg');
  const graphWidth = LANE_OFFSET + (maxLane + 1) * LANE_WIDTH + LANE_OFFSET;
  const svgHeight = graphLayout.length * ROW_HEIGHT;

  svg.setAttribute('width', graphWidth);
  svg.setAttribute('height', svgHeight);
  svg.style.width = graphWidth + 'px';
  svg.style.height = svgHeight + 'px';

  // Build position map
  const posMap = {};
  graphLayout.forEach(d => {
    posMap[d.hash] = {
      x: LANE_OFFSET + d.lane * LANE_WIDTH,
      y: d.rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2,
      lane: d.lane,
    };
  });

  let paths = '';
  let circles = '';

  // Draw lines (parent-child connections)
  graphLayout.forEach(d => {
    const parents = d.parents ? d.parents.split(' ').filter(Boolean) : [];
    const from = posMap[d.hash];
    parents.forEach(ph => {
      const to = posMap[ph];
      if (!to) return;
      const color = LANE_COLORS[to.lane % LANE_COLORS.length];
      if (from.lane === to.lane) {
        paths += `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${color}" stroke-width="2" opacity="0.6"/>`;
      } else {
        // Bezier curve for branch/merge
        const midY = from.y + ROW_HEIGHT;
        if (midY >= to.y) {
          // Adjacent rows - simple S-curve
          paths += `<path d="M${from.x},${from.y} C${from.x},${(from.y+to.y)/2} ${to.x},${(from.y+to.y)/2} ${to.x},${to.y}" stroke="${color}" stroke-width="2" fill="none" opacity="0.6"/>`;
        } else {
          // Far apart - curve then straight
          paths += `<path d="M${from.x},${from.y} C${from.x},${midY} ${to.x},${midY} ${to.x},${midY}" stroke="${color}" stroke-width="2" fill="none" opacity="0.6"/>`;
          paths += `<line x1="${to.x}" y1="${midY}" x2="${to.x}" y2="${to.y}" stroke="${color}" stroke-width="2" opacity="0.6"/>`;
        }
      }
    });
  });

  // Draw nodes
  graphLayout.forEach(d => {
    const pos = posMap[d.hash];
    const color = d.color;
    circles += `<circle cx="${pos.x}" cy="${pos.y}" r="${NODE_R}" fill="${color}" stroke="#0e1017" stroke-width="2.5"/>`;
  });

  svg.innerHTML = paths + circles;
}

// === Commit List Rendering ===
function renderCommitList() {
  const container = document.getElementById('commit-list');
  const graphWidth = LANE_OFFSET + (maxLane + 1) * LANE_WIDTH + LANE_OFFSET;

  let wipRowHtml = '';
  if (!repoData.status.isClean) {
    wipRowHtml = `
      <div class="commit-row ${selectedHash === 'WORKING_DIR' ? 'selected' : ''}" data-hash="WORKING_DIR" onclick="selectCommit('WORKING_DIR')">
        <div class="graph-cell" style="width:${graphWidth}px"></div>
        <div class="info-cell">
          <span class="commit-msg" style="font-weight:600; color:#fbbf24">Work In Progress (Uncommitted Changes)</span>
        </div>
        <div class="commit-author-cell"></div>
        <div class="commit-date-cell">Now</div>
      </div>
    `;
  }

  const commitsHtml = graphLayout.map(d => {
    const date = new Date(d.date);
    const ago = formatDate(date);
    const initials = getInitials(d.author_name);
    const avatarColor = hashToColor(d.author_email || d.author_name);

    // Parse refs
    const refs = d.refs ? d.refs.split(',').map(r => r.trim()).filter(Boolean) : [];
    const refBadges = refs.map(ref => {
      let cls = 'local';
      if (ref.includes('HEAD')) cls = 'head';
      else if (ref.includes('tag:')) cls = 'tag';
      else if (ref.includes('/')) cls = 'remote';
      const label = ref.replace('HEAD -> ','').replace('tag: ','');
      return `<span class="ref-badge ${cls}">${escapeHtml(label)}</span>`;
    }).join('');

    return `
      <div class="commit-row ${d.hash === selectedHash ? 'selected' : ''}" data-hash="${d.hash}" onclick="selectCommit('${d.hash}')">
        <div class="graph-cell" style="width:${graphWidth}px"></div>
        <div class="info-cell">
          <span class="commit-msg">${escapeHtml(d.message)}</span>
          ${refBadges ? `<div class="commit-refs">${refBadges}</div>` : ''}
        </div>
        <div class="commit-author-cell">
          <div class="author-avatar" style="background:${avatarColor}">${initials}</div>
          <span class="author-name">${escapeHtml(d.author_name)}</span>
        </div>
        <div class="commit-date-cell" title="${date.toLocaleString()}">${formatDate(date)}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = wipRowHtml + commitsHtml;
}

// === Commit Selection & Detail ===
window.selectCommit = async function(hash) {
  if (selectedHash === hash) return;
  selectedHash = hash;

  // Update row highlights
  document.querySelectorAll('.commit-row').forEach(r => {
    r.classList.toggle('selected', r.dataset.hash === hash);
  });

  const placeholder = document.getElementById('detail-placeholder');
  const content = document.getElementById('detail-content');
  const stagingPanel = document.getElementById('staging-panel');
  
  placeholder.classList.add('hidden');
  
  if (hash === 'WORKING_DIR') {
    content.classList.add('hidden');
    stagingPanel.classList.remove('hidden');
    renderStagingPanel();
    return;
  }
  
  stagingPanel.classList.add('hidden');
  content.classList.remove('hidden');
  content.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted)">
    <svg style="width:20px;height:20px;animation:spin 1s linear infinite;margin:0 auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
    </svg>
  </div>`;

  try {
    const res = await fetch(`/api/repo/commit-detail?path=${encodeURIComponent(repoPath)}&hash=${encodeURIComponent(hash)}`);
    if (!res.ok) throw new Error('Failed to load commit detail');
    const data = await res.json();
    renderCommitDetail(data);
  } catch (err) {
    content.innerHTML = `<div style="padding:20px;color:#ef4444;font-size:12px">${escapeHtml(err.message)}</div>`;
  }
};

function renderCommitDetail(data) {
  const content = document.getElementById('detail-content');
  const authorDate = new Date(data.authorDate);
  const committerDate = new Date(data.committerDate);
  const authorInitials = getInitials(data.authorName);
  const committerInitials = getInitials(data.committerName);
  const authorColor = hashToColor(data.authorEmail || data.authorName);
  const committerColor = hashToColor(data.committerEmail || data.committerName);
  const parentHashes = data.parents ? data.parents.split(' ').filter(Boolean) : [];

  const fileStatusLabel = { M:'M', A:'A', D:'D', R:'R', C:'C', T:'T' };

  content.innerHTML = `
    <div class="detail-header">
      <div class="detail-hash">
        <span>commit:</span>
        <code>${data.shortHash}</code>
        <button class="copy-btn" onclick="navigator.clipboard.writeText('${data.hash}');showToast('Hash copied!','success')" title="Copy full hash">
          <svg style="width:12px;height:12px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
        </button>
      </div>
      <div class="detail-subject">${escapeHtml(data.subject)}</div>
      ${data.body ? `<div class="detail-body">${escapeHtml(data.body)}</div>` : ''}
    </div>

    <div class="detail-meta">
      <div class="meta-row">
        <div class="meta-avatar" style="background:${authorColor}">${authorInitials}</div>
        <div class="meta-info">
          <div class="meta-name">${escapeHtml(data.authorName)}</div>
          <div class="meta-detail">authored ${formatDate(authorDate)}</div>
        </div>
      </div>
      ${data.committerName !== data.authorName ? `
      <div class="meta-row">
        <div class="meta-avatar" style="background:${committerColor}">${committerInitials}</div>
        <div class="meta-info">
          <div class="meta-name">${escapeHtml(data.committerName)}</div>
          <div class="meta-detail">committed ${formatDate(committerDate)}</div>
        </div>
      </div>` : ''}
      ${parentHashes.length > 0 ? `
      <div style="margin-top:8px">
        <div class="meta-label">Parent${parentHashes.length > 1 ? 's' : ''}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${parentHashes.map(p => `<span class="meta-parent" onclick="selectCommit('${p.substring(0,7)}')">${p.substring(0,7)}</span>`).join('')}
        </div>
      </div>` : ''}
    </div>

    <div class="detail-files">
      <div class="files-header">
        <span class="files-count">${data.files.length} changed file${data.files.length !== 1 ? 's' : ''}</span>
      </div>
      ${data.files.map(f => `
        <div class="file-item" onclick="showFileDiff('${data.hash}', '${escapeHtml(f.file).replace(/'/g, "\\'")}')">
          <span class="file-status ${f.status}">${f.status}</span>
          <span class="file-name" title="${escapeHtml(f.file)}">${escapeHtml(f.file)}</span>
        </div>
      `).join('')}
      ${data.files.length === 0 ? '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:11px">No files changed (root commit)</div>' : ''}
    </div>
  `;
}

// === Sidebar Actions ===
window.checkoutBranch = async function(branch) {
  if (!confirm(`Checkout "${branch}"?`)) return;
  try {
    const res = await fetch('/api/repo/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: repoPath, workspace: '', branch }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Checkout failed');
    showToast(`Checked out ${data.message || branch}`, 'success');
    await loadAll();
  } catch (err) {
    showToast(`Checkout failed: ${err.message}`, 'error');
  }
};

// === Toolbar Actions ===
window.doAction = async function(action) {
  const btn = document.getElementById(`tb-${action}`) || document.getElementById('tb-fetch');
  btn.classList.add('loading');
  btn.disabled = true;
  try {
    const res = await fetch('/api/repo/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: repoPath, action, workspace: '' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `${action} failed`);
    showToast(`${action.charAt(0).toUpperCase() + action.slice(1)} successful!`, 'success');
    await loadAll();
  } catch (err) {
    showToast(`${action} failed: ${err.message}`, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
};

window.refreshAll = async function() {
  const btn = document.getElementById('tb-refresh');
  btn.classList.add('loading');
  btn.disabled = true;
  try {
    await loadAll();
    showToast('Refreshed!', 'success');
  } catch (err) {
    showToast('Refresh failed', 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
};

// === Modals ===
window.openCreateBranchModal = function() {
  const allBranches = [...repoData.localBranches, ...repoData.remoteBranches];
  const list = document.getElementById('cb-dropdown');
  list.innerHTML = allBranches.map(b => {
    const isRemote = b.startsWith('remotes/');
    const display = isRemote ? b.replace('remotes/','') : b;
    return `<div class="dropdown-option" onclick="selectDropdownOption('create-branch-from', '${escapeHtml(b)}')">${isRemote ? '☁ ' : ''}${escapeHtml(display)}</div>`;
  }).join('');
  document.getElementById('create-branch-from').value = repoData.branch;
  document.getElementById('create-branch-name').value = '';
  document.getElementById('modal-create-branch').classList.remove('hidden');
  setTimeout(() => document.getElementById('create-branch-name').focus(), 100);
};

window.createBranch = async function() {
  const name = document.getElementById('create-branch-name').value.trim();
  const from = document.getElementById('create-branch-from').value;
  const btn = document.getElementById('btn-create-branch');
  if (!name) { showToast('Enter a branch name', 'warning'); return; }
  btn.disabled = true;
  btn.textContent = 'Creating...';
  try {
    const res = await fetch('/api/repo/create-branch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: repoPath, name, from }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    showToast(`Branch "${name}" created!`, 'success');
    document.getElementById('modal-create-branch').classList.add('hidden');
    await loadAll();
  } catch (err) {
    showToast(`Failed: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Branch';
  }
};

window.openMergeModal = function() {
  document.getElementById('merge-into-label').textContent = repoData.branch;
  // Show repo name in modal header so user can verify which repo they're merging on
  const mergeRepoLabel = document.getElementById('merge-repo-label');
  if (mergeRepoLabel) mergeRepoLabel.textContent = repoData.name;
  const allBranches = [...repoData.localBranches, ...repoData.remoteBranches].filter(b => b !== repoData.branch);
  const list = document.getElementById('m-dropdown');
  list.innerHTML = allBranches.map(b => {
    const isRemote = b.startsWith('remotes/');
    const display = isRemote ? b.replace('remotes/','') : b;
    return `<div class="dropdown-option" onclick="selectDropdownOption('merge-branch', '${escapeHtml(b)}')">${isRemote ? '☁ ' : ''}${escapeHtml(display)}</div>`;
  }).join('');
  document.getElementById('merge-branch').value = '';
  document.getElementById('modal-merge').classList.remove('hidden');
};

window.selectDropdownOption = function(inputId, val) {
  document.getElementById(inputId).value = val;
};

window.filterCustomDropdown = function(dropdownId, query) {
  const lowerQuery = query.toLowerCase();
  document.querySelectorAll(`#${dropdownId} .dropdown-option`).forEach(opt => {
    const text = opt.textContent.toLowerCase();
    opt.style.display = text.includes(lowerQuery) ? 'block' : 'none';
  });
};

window.mergeBranch = async function() {
  const branch = document.getElementById('merge-branch').value;
  const noFf = document.getElementById('merge-noff').checked;
  const btn = document.getElementById('btn-merge');
  if (!branch) { showToast('Select a branch', 'warning'); return; }
  const display = branch.startsWith('remotes/') ? branch.replace('remotes/','') : branch;
  // Include repo name in confirmation so user can verify they're merging on the correct repository
  if (!confirm(`[${repoData.name}] Merge "${display}" into "${repoData.branch}"?\n\nRepo: ${repoPath}`)) return;
  btn.disabled = true;
  btn.textContent = 'Merging...';
  try {
    const res = await fetch('/api/repo/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: repoPath, workspace: '', branch, noFf }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Merge failed');
    showToast(`Merge successful on <b>${escapeHtml(repoData.name)}</b>!`, 'success');
    document.getElementById('modal-merge').classList.add('hidden');
    await loadAll();
  } catch (err) {
    showToast(`Merge failed on <b>${escapeHtml(repoData.name)}</b>: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Merge';
  }
};

// === Keyboard Shortcuts ===
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.getElementById('modal-create-branch').classList.add('hidden');
    document.getElementById('modal-merge').classList.add('hidden');
  }
});

// === Resizer Logic ===
function initResizers() {
  const sidebar = document.getElementById('sidebar');
  const resizerLeft = document.getElementById('resizer-left');
  const detailPanel = document.getElementById('detail-panel');
  const resizerRight = document.getElementById('resizer-right');

  let isResizingLeft = false;
  let isResizingRight = false;
  
  if (resizerLeft) {
    resizerLeft.addEventListener('mousedown', (e) => {
      isResizingLeft = true;
      resizerLeft.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
  }

  if (resizerRight) {
    resizerRight.addEventListener('mousedown', (e) => {
      isResizingRight = true;
      resizerRight.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
  }

  window.addEventListener('mousemove', (e) => {
    if (!isResizingLeft && !isResizingRight) return;
    
    if (isResizingLeft) {
      const newWidth = Math.max(150, Math.min(e.clientX, 600));
      sidebar.style.width = newWidth + 'px';
    }
    
    if (isResizingRight) {
      const newWidth = Math.max(200, Math.min(window.innerWidth - e.clientX, 800));
      detailPanel.style.width = newWidth + 'px';
    }
  });

  window.addEventListener('mouseup', () => {
    if (isResizingLeft) {
      isResizingLeft = false;
      resizerLeft.classList.remove('dragging');
    }
    if (isResizingRight) {
      isResizingRight = false;
      resizerRight.classList.remove('dragging');
    }
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
}

// === Diff Viewer ===
window.showFileDiff = async function(hash, file) {
  const modal = document.getElementById('modal-diff');
  document.getElementById('diff-file-name').textContent = file;
  document.getElementById('diff-content').innerHTML = '<span class="diff-ctx">Loading diff...</span>';
  modal.classList.remove('hidden');

  try {
    const res = await fetch(`/api/repo/file-diff?path=${encodeURIComponent(repoPath)}&hash=${encodeURIComponent(hash)}&file=${encodeURIComponent(file)}`);
    if (!res.ok) throw new Error('Failed to load file diff');
    const data = await res.json();
    
    if (!data.diff) {
      document.getElementById('diff-content').innerHTML = '<span class="diff-ctx">No diff available (might be a binary file, empty file, or new file).</span>';
      return;
    }

    const lines = data.diff.split('\n');
    let diffHtml = '';
    let insideDiff = false;

    lines.forEach(line => {
      if (line.startsWith('diff --git')) insideDiff = true;
      if (!insideDiff) return;

      const escaped = escapeHtml(line);
      if (line.startsWith('+') && !line.startsWith('+++')) {
        diffHtml += `<span class="diff-add">${escaped}</span>\n`;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        diffHtml += `<span class="diff-del">${escaped}</span>\n`;
      } else if (line.startsWith('@@')) {
        diffHtml += `<span class="diff-hdr">${escaped}</span>\n`;
      } else if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) {
        diffHtml += `<span style="opacity:0.5">${escaped}</span>\n`;
      } else {
        diffHtml += `<span class="diff-ctx">${escaped}</span>\n`;
      }
    });

    document.getElementById('diff-content').innerHTML = diffHtml || '<span class="diff-ctx">No text diff available (binary file?).</span>';
  } catch (err) {
    document.getElementById('diff-content').innerHTML = `<span style="color:#ef4444">${escapeHtml(err.message)}</span>`;
  }
};

// === Staging & conflict management ===
function renderStagingPanel() {
  const panel = document.getElementById('staging-panel');
  const files = repoData.status.files || [];
  const conflicts = repoData.status.conflicted || [];
  
  // Build a unique list of uncommitted files mapping from the status
  const uncommittedFiles = files.filter(f => f.index !== ' ' || f.working_dir !== ' ' || f.working_dir === '?');
  
  let conflictHtml = '';
  if (conflicts.length > 0) {
    conflictHtml = `
      <div style="padding:16px 16px 0">
        <div class="conflict-banner" style="border-radius:6px; margin-bottom:8px;">
          <svg style="width:16px;height:16px;flex-shrink:0;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
          <span style="flex:1">Merge Conflicts Detected (${conflicts.length})</span>
        </div>
        ${conflicts.map(c => `
          <div style="display:flex;align-items:center;padding:8px 12px;background:rgba(239,68,68,0.05);border-bottom:1px solid rgba(239,68,68,0.1)">
            <span style="flex:1;font-size:12px;color:var(--text-primary);font-family:'JetBrains Mono',monospace">${escapeHtml(c)}</span>
            <button class="resolve-btn" style="margin-right:4px;color:#cbd5e1" onclick="resolveConflict('${escapeHtml(c).replace(/'/g, "\\'")}', 'ours')">Accept Ours</button>
            <button class="resolve-btn" style="color:#cbd5e1" onclick="resolveConflict('${escapeHtml(c).replace(/'/g, "\\'")}', 'theirs')">Accept Theirs</button>
          </div>
        `).join('')}
      </div>
    `;
  }

  panel.innerHTML = `
    <div class="staging-header">
      <div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:12px">Work In Progress</div>
      <div class="commit-box">
        <textarea id="commit-message" class="commit-textarea" placeholder="Commit message..."></textarea>
        <button class="commit-btn" onclick="executeCommit()">Commit Changes</button>
      </div>
    </div>
    ${conflictHtml}
    <div class="detail-files" style="flex:1;overflow-y:auto">
      <div class="files-header">
        <span class="files-count">${uncommittedFiles.length} changed file${uncommittedFiles.length !== 1 ? 's' : ''}</span>
      </div>
      ${uncommittedFiles.map(f => {
        let statusChar = 'M';
        if (f.index === 'A' || f.working_dir === 'A') statusChar = 'A';
        if (f.index === 'D' || f.working_dir === 'D') statusChar = 'D';
        if (f.index === 'R' || f.working_dir === 'R') statusChar = 'R';
        if (f.working_dir === '?') statusChar = '?';
        if (f.index === 'U' || f.working_dir === 'U') statusChar = '!'; // Conflicted

        return `
          <div class="file-item">
            <input type="checkbox" class="stage-checkbox" value="${escapeHtml(f.path)}" ${statusChar !== '!' ? 'checked' : 'disabled title="Resolve conflict first"'}>
            <div style="display:flex;flex:1;align-items:center;min-width:0;cursor:pointer" onclick="showFileDiff('WORKING_DIR', '${escapeHtml(f.path).replace(/'/g, "\\'")}')">
              <span class="file-status ${statusChar}">${statusChar}</span>
              <span class="file-name" title="${escapeHtml(f.path)}">${escapeHtml(f.path)}</span>
            </div>
          </div>
        `;
      }).join('')}
      ${uncommittedFiles.length === 0 ? '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:11px">Working directory clean</div>' : ''}
    </div>
  `;
}

window.executeCommit = async function() {
  const msg = document.getElementById('commit-message').value.trim();
  if (!msg) { showToast('Please enter a commit message', 'warning'); return; }
  
  const checkboxes = document.querySelectorAll('.stage-checkbox:checked');
  const files = Array.from(checkboxes).map(cb => cb.value);
  if (files.length === 0) { showToast('No files selected', 'warning'); return; }
  
  const btn = document.querySelector('.commit-btn');
  btn.disabled = true;
  btn.textContent = 'Committing...';
  
  try {
    const res = await fetch('/api/repo/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: repoPath, workspace: '', message: msg, files, push: false }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Commit failed');
    showToast('Commit successful!', 'success');
    await loadAll();
    if (graphLayout[0]) setTimeout(() => selectCommit(graphLayout[0].hash), 200);
  } catch (err) {
    showToast(`Commit failed: ${err.message}`, 'error');
    btn.disabled = false;
    btn.textContent = 'Commit Changes';
  }
};

window.resolveConflict = async function(file, resolution) {
  if (!confirm(`Resolve "${file}" using ${resolution}?`)) return;
  try {
    const res = await fetch('/api/repo/resolve-conflict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: repoPath, file, resolution, workspace: '' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to resolve');
    showToast(`Resolved using ${resolution}`, 'success');
    await loadAll();
    setTimeout(() => selectCommit('WORKING_DIR'), 200);
  } catch (err) {
    showToast(`Failed: ${err.message}`, 'error');
  }
};

// === Start ===
initResizers();
loadAll();
