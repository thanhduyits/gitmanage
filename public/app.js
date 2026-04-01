// --- DOM References ---
    const stateLoading     = document.getElementById('state-loading');
    const stateData        = document.getElementById('state-data');
    const stateEmpty       = document.getElementById('state-empty');
    const stateError       = document.getElementById('state-error');
    const stateNoWorkspace = document.getElementById('state-no-workspace');
    const errorMessage     = document.getElementById('error-message');
    const reposTbody       = document.getElementById('repos-tbody');
    const statsBar         = document.getElementById('stats-bar');
    const statTotal        = document.getElementById('stat-total');
    const statClean        = document.getElementById('stat-clean');
    const statDirty        = document.getElementById('stat-dirty');
    const statConflict     = document.getElementById('stat-conflict');
    const refreshIcon      = document.getElementById('refresh-icon');
    const workspacesBar    = document.getElementById('workspaces-bar');
    const workspaceChips   = document.getElementById('workspace-chips');
    const browserModal     = document.getElementById('browser-modal');
    const browserList      = document.getElementById('browser-list');
    const browserPath      = document.getElementById('browser-current-path');
    const btnBrowseBack    = document.getElementById('btn-browse-back');
    const btnAddSelected   = document.getElementById('btn-add-selected');
    const btnAddLabel      = document.getElementById('btn-add-label');
    const btnSelectAll     = document.getElementById('btn-select-all');

    let currentBrowsePath  = null;
    let currentParentPath  = null;
    let currentItems       = [];
    let selectedPaths      = new Set();
    let workspaces         = [];
    let currentRepos       = [];

    // --- State Management ---
    function customConfirm(message) {
      return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const inner = modal.querySelector('.scale-95') || modal.querySelector('.scale-100');
        const msgEl = document.getElementById('confirm-message');
        const btnOk = document.getElementById('btn-ok-confirm');
        const btnCancel = document.getElementById('btn-cancel-confirm');
        const btnClose = document.getElementById('btn-close-confirm');
        
        msgEl.textContent = message;
        
        modal.classList.remove('hidden');
        void modal.offsetWidth;
        modal.classList.remove('opacity-0');
        if (inner) {
          inner.classList.remove('scale-95');
          inner.classList.add('scale-100');
        }
        
        const cleanupAndClose = (result) => {
          modal.classList.add('opacity-0');
          if (inner) {
            inner.classList.remove('scale-100');
            inner.classList.add('scale-95');
          }
          setTimeout(() => modal.classList.add('hidden'), 200);
          
          btnOk.removeEventListener('click', onOk);
          btnCancel.removeEventListener('click', onCancel);
          btnClose.removeEventListener('click', onCancel);
          resolve(result);
        };
        
        const onOk = () => cleanupAndClose(true);
        const onCancel = () => cleanupAndClose(false);
        
        btnOk.addEventListener('click', onOk);
        btnCancel.addEventListener('click', onCancel);
        btnClose.addEventListener('click', onCancel);
      });
    }

    function showState(state) {
      [stateLoading, stateData, stateEmpty, stateError, stateNoWorkspace].forEach((el) => el.classList.add('hidden'));
      statsBar.classList.add('hidden');
      statsBar.classList.remove('flex');

      if (state === 'loading')      stateLoading.classList.remove('hidden');
      if (state === 'data')         { stateData.classList.remove('hidden'); statsBar.classList.remove('hidden'); statsBar.classList.add('flex'); }
      if (state === 'empty')        stateEmpty.classList.remove('hidden');
      if (state === 'error')        stateError.classList.remove('hidden');
      if (state === 'no-workspace') stateNoWorkspace.classList.remove('hidden');
    }

    // --- Badges ---
    function buildStatusBadge(repo, i) {
      if (repo.error) {
        return `<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 shadow-[inset_0_0_12px_rgba(239,68,68,0.1)]">🔴 Error</span>`;
      }
      if (repo.status && repo.status.conflicted && repo.status.conflicted.length > 0) {
        const escapedPath = repo.path.replace(/\\/g, '\\\\');
        const escapedWs = repo.workspace ? repo.workspace.replace(/\\/g, '\\\\') : '';
        return `<button onclick="openConflictModal('${escapedPath}', '${escapedWs}', ${i})" class="badge-pulse inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-[inset_0_0_12px_rgba(244,63,94,0.1)] hover:bg-rose-500/20 hover:border-rose-500/40 transition-all cursor-pointer" title="Click to view conflicts">⚔️ Conflict: ${repo.status.conflicted.length}</button>`;
      }
      if (repo.status.isClean) {
        return `<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[inset_0_0_12px_rgba(16,185,129,0.1)]">🟢 Clean</span>`;
      }
      const count = (repo.status.modified?.length || 0) + (repo.status.deleted?.length || 0) + (repo.status.not_added?.length || 0);
      const escapedPath = repo.path.replace(/\\/g, '\\\\');
      const escapedWs = repo.workspace ? repo.workspace.replace(/\\/g, '\\\\') : '';
      return `<button onclick="openCommitModal('${escapedPath}', '${escapedWs}', ${i})" class="badge-pulse inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[inset_0_0_12px_rgba(245,158,11,0.1)] hover:bg-amber-500/20 hover:border-amber-500/40 transition-all cursor-pointer" title="Click to view diff & commit">🟡 Modified: ${count}</button>`;
    }

    function buildBranchBadge(repo, i) {
      const branch = repo.branch;
      if (!branch) return '<span class="text-slate-600">—</span>';
      const isMain = ['main', 'master', 'develop'].includes(branch);
      const cls = isMain ? 'text-sky-400 bg-sky-500/10 border-sky-500/20 shadow-[inset_0_0_12px_rgba(14,165,233,0.1)]' : 'text-violet-400 bg-violet-500/10 border-violet-500/20 shadow-[inset_0_0_12px_rgba(139,92,246,0.1)]';
      const escapedPath = repo.path.replace(/\\/g, '\\\\');
      const escapedWs = repo.workspace ? repo.workspace.replace(/\\/g, '\\\\') : '';

      let syncHtml = '';
      if (repo.status) {
        if (repo.status.behind > 0) syncHtml += `<span class="ml-1.5 flex items-center gap-0.5 text-emerald-400" title="Behind: ${repo.status.behind} commits (Need Pull)"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>${repo.status.behind}</span>`;
        if (repo.status.ahead > 0) syncHtml += `<span class="ml-1.5 flex items-center gap-0.5 text-amber-400" title="Ahead: ${repo.status.ahead} commits (Need Push)"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>${repo.status.ahead}</span>`;
      }

      return `<button onclick="openBranchModal('${escapedPath}', '${escapedWs}', ${i}, '${branch}')" class="inline-flex items-center px-3 py-1.5 rounded-lg text-[13px] font-mono font-semibold ${cls} border cursor-pointer hover:border-accent/40 hover:ring-2 hover:ring-accent/20 transition-all focus:outline-none" title="Click to change branch">
        <svg class="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
        ${branch}
        ${syncHtml}
      </button>`;
    }


    function updateStats(repos) {
      const total = repos.length;
      const clean = repos.filter((r) => !r.error && r.status?.isClean).length;
      const conflicts = repos.filter((r) => !r.error && r.status?.conflicted && r.status.conflicted.length > 0).length;
      
      statTotal.textContent = `${total} repos`;
      statClean.textContent = `${clean} clean`;
      statDirty.textContent = `${total - clean} changed`;
      
      if (conflicts > 0) {
        statConflict.textContent = `${conflicts} conflict${conflicts > 1 ? 's' : ''}`;
        statConflict.classList.remove('hidden');
      } else {
        statConflict.classList.add('hidden');
      }
    }

    // --- Render Workspace Chips ---
    function renderWorkspaces() {
      if (workspaces.length === 0) { workspacesBar.classList.add('hidden'); return; }
      workspacesBar.classList.remove('hidden');
      workspaceChips.innerHTML = workspaces.map((ws) => {
        const wsName = ws.split(/[/\\]/).filter(Boolean).pop();
        return `
        <div class="ws-chip flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-xs font-mono text-slate-300 group cursor-default">
          <svg class="w-3.5 h-3.5 text-accent/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
          </svg>
          <span class="truncate max-w-[200px]" title="${ws}">${wsName}</span>
          <button onclick="removeWorkspace('${ws.replace(/\\/g, '\\\\')}')" class="ws-remove ml-1 w-4 h-4 flex items-center justify-center rounded text-slate-600 hover:text-red-400 transition-colors" title="Remove">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      `}).join('');
    }

    let selectedRepoPaths = new Set();

    function renderRepoRowInner(repo, i) {
      const wsLabel = repo.workspace ? repo.workspace.split(/[/\\]/).pop() : '';
      const escapedPath = repo.path.replace(/\\/g, '\\\\');
      const encodedPath = encodeURIComponent(repo.path);
      const isSelected = selectedRepoPaths.has(repo.path);
      const escapedWs = repo.workspace ? repo.workspace.replace(/\\/g, '\\\\') : '';
      return `
        <td class="px-3 sm:px-6 py-3 sm:py-4 text-center">
          <input type="checkbox" value="${encodedPath}" ${isSelected ? 'checked' : ''} onchange="toggleRepoSelection(this, '${encodedPath}')" class="repo-checkbox w-4 h-4 rounded appearance-none border-2 border-slate-600 bg-surface/50 text-accent checked:bg-accent checked:border-accent cb-folder cursor-pointer transition-all hover:border-accent/50">
        </td>
        <td class="hidden sm:table-cell px-3 sm:px-6 py-3 sm:py-4 text-sm text-slate-500/80 font-mono">${String(i + 1).padStart(2, '0')}</td>
        <td class="px-3 sm:px-6 py-3 sm:py-4">
          <div class="flex items-center gap-2 sm:gap-3">
            <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-accent/20 to-purple-500/20 border border-white/5 shadow-inner flex items-center justify-center flex-shrink-0 cursor-pointer hover:scale-110 transition-transform" onclick="openGraphModal('${escapedPath}', '${repo.name}')" title="Xem Git Graph">
              <svg class="w-4 h-4 sm:w-4.5 sm:h-4.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
              </svg>
            </div>
            <div class="min-w-0">
              <p class="text-[14px] sm:text-[15px] font-semibold text-slate-200 tracking-tight leading-snug cursor-pointer hover:text-accent transition-colors w-fit truncate" onclick="openGraphModal('${escapedPath}', '${repo.name}')" title="Xem Git Graph">${repo.name}</p>
              <p class="text-[11px] sm:text-[12px] text-slate-500 font-mono tracking-tight truncate max-w-[150px] sm:max-w-[200px]" title="${repo.path}">${wsLabel ? '<span class="text-accent/50">' + wsLabel + '/</span>' : ''}${repo.name}</p>
            </div>
          </div>
        </td>
        <td class="px-3 sm:px-6 py-3 sm:py-4">${buildBranchBadge(repo, i)}</td>
        <td class="px-3 sm:px-6 py-3 sm:py-4">${buildStatusBadge(repo, i)}</td>
        <td class="px-3 sm:px-6 py-3 sm:py-4">
          <div class="grid grid-cols-4 gap-1 sm:gap-2 w-max ml-auto opacity-70 group-hover:opacity-100 transition-opacity">
            <button onclick="openFolder('${escapedPath}')" class="btn-action btn-linear p-1.5 sm:p-2 text-slate-400 hover:text-white hover:!border-slate-500/40 hover:bg-white/10 rounded-xl transition-all shadow-sm flex items-center justify-center" title="Open Folder (Explorer)">
              <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
            </button>
            <button onclick="repoAction('${escapedPath}', '${escapedWs}', ${i}, 'fetch', this)" class="btn-action btn-linear p-1.5 sm:p-2 text-slate-300 hover:text-sky-400 hover:!border-sky-500/40 hover:bg-sky-500/10 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center" title="Fetch from remote">
              <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3 3m0 0l-3-3m3 3V8"/></svg>
            </button>
            <button onclick="repoAction('${escapedPath}', '${escapedWs}', ${i}, 'pull', this)" class="btn-action btn-linear p-1.5 sm:p-2 text-slate-300 hover:text-emerald-400 hover:!border-emerald-500/40 hover:bg-emerald-500/10 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center" title="Pull latest changes">
              <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            </button>
            <button onclick="repoAction('${escapedPath}', '${escapedWs}', ${i}, 'push', this)" class="btn-action btn-linear p-1.5 sm:p-2 text-slate-300 hover:text-amber-400 hover:!border-amber-500/40 hover:bg-amber-500/10 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center" title="Push local commits">
              <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            </button>
            <button onclick="repoAction('${escapedPath}', '${escapedWs}', ${i}, 'stash', this)" class="btn-action btn-linear p-1.5 sm:p-2 text-slate-300 hover:text-white hover:!border-slate-500/40 hover:bg-white/10 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center" title="Stash Changes">
              <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
            </button>
            <button onclick="repoAction('${escapedPath}', '${escapedWs}', ${i}, 'pop', this)" class="btn-action btn-linear p-1.5 sm:p-2 text-slate-300 hover:text-white hover:!border-slate-500/40 hover:bg-white/10 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center" title="Pop Stash">
              <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 8H5M19 8a2 2 0 100-4H5a2 2 0 100 4M19 8v10a2 2 0 01-2 2H7a2 2 0 01-2-2V8m9 4H8m4 0v4"/></svg>
            </button>
            <button onclick="refreshSingleRepo('${escapedPath}', '${escapedWs}', ${i})" class="btn-refresh-row p-1.5 sm:p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-accent/20 border border-transparent hover:border-accent/40 rounded-xl transition-all disabled:opacity-50 shadow-sm flex items-center justify-center" title="Refresh local status">
              <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button onclick="removeSingleRepoWorkspace('${escapedPath}')" class="btn-refresh-row p-1.5 sm:p-2 text-slate-400 hover:text-red-400 bg-white/5 hover:bg-red-500/10 border border-transparent hover:border-red-500/40 rounded-xl transition-all disabled:opacity-50 shadow-sm flex items-center justify-center" title="Remove Repository">
              <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </td>
      `;
    }

    // --- Render Table ---
    function renderRepos(repos) {
      reposTbody.innerHTML = '';
      repos.forEach((repo, i) => {
        const tr = document.createElement('tr');
        tr.id = 'repo-row-' + i;
        tr.className = 'group table-row-modern fade-in-up';
        tr.style.animationDelay = `${(i % 15) * 20}ms`;
        tr.innerHTML = renderRepoRowInner(repo, i);
        reposTbody.appendChild(tr);
      });
    }

    async function refreshSingleRepo(repoPath, wsPath, i) {
      const tr = document.getElementById('repo-row-' + i);
      if (!tr) return;

      const btn = tr.querySelector('.btn-refresh-row');
      const icon = btn.querySelector('svg');
      icon.classList.add('spin');
      btn.disabled = true;

      try {
        const url = `/api/repo?path=${encodeURIComponent(repoPath)}&workspace=${encodeURIComponent(wsPath)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to refresh');
        const updatedRepo = await res.json();

        const originalIndex = currentRepos.findIndex(r => r.path === repoPath);
        if (originalIndex !== -1) {
          currentRepos[originalIndex] = updatedRepo;
          updateStats(currentRepos);
        }

        tr.innerHTML = renderRepoRowInner(updatedRepo, i);
      } catch (err) {
        console.error('Failed to refresh repo:', err);
        showToast(`Lỗi Refresh:\n${err.message}`, 'error');
        icon.classList.remove('spin');
        btn.disabled = false;
      }
    }

    async function openFolder(repoPath) {
      try {
        const res = await fetch('/api/repo/open_folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: repoPath })
        });
        const data = await res.json();
        if(!res.ok) throw new Error(data.error || 'Mở thư mục thất bại');
        showToast(`Đã mở thư mục: ${repoPath.split(/[/\\]/).pop()}`, 'success');
      } catch (err) {
        console.error('Lỗi khi mở thư mục', err);
        showToast(err.message, 'error');
      }
    }

    async function repoAction(repoPath, wsPath, rowIndex, action, btn) {
      const tr = document.getElementById('repo-row-' + rowIndex);
      if (!tr) return;

      const originalText = btn.innerHTML;
      const originalWidth = btn.offsetWidth;
      btn.style.width = originalWidth + 'px';
      
      btn.innerHTML = `<svg class="w-4 h-4 spin mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>`;
      
      const allBtns = tr.querySelectorAll('button');
      allBtns.forEach(b => b.disabled = true);

      try {
        const url = '/api/repo/action';
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: repoPath, workspace: wsPath, action: action })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Action failed');
        
        const originalIndex = currentRepos.findIndex(r => r.path === repoPath);
        if (originalIndex !== -1) {
          currentRepos[originalIndex] = data.repo;
          updateStats(currentRepos);
        }
        tr.innerHTML = renderRepoRowInner(data.repo, rowIndex);
        showToast(`Thành công: <b>${action.toUpperCase()}</b> ${repoPath.split(/[/\\]/).pop()}`, 'success');
      } catch (err) {
        showToast(`${action.toUpperCase()} thất bại (${repoPath.split(/[/\\]/).pop()}):\n${err.message}`, 'error');
        btn.innerHTML = originalText;
        btn.style.width = '';
        allBtns.forEach(b => b.disabled = false);
      }
    }

    // --- API calls ---
    async function loadWorkspaces() {
      try { const res = await fetch('/api/workspaces'); workspaces = await res.json(); }
      catch { workspaces = []; }
      renderWorkspaces();
      return workspaces;
    }

    async function removeWorkspace(wsPath) {
      try { await fetch('/api/workspaces', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: wsPath }) }); }
      catch (e) { console.error(e); }
      await loadWorkspaces();
      
      // Filter locally to avoid full page reload
      currentRepos = currentRepos.filter(r => r.workspace !== wsPath);
      updateStats(currentRepos);
      
      if (!currentRepos.length) {
        showState(workspaces.length === 0 ? 'no-workspace' : 'empty');
      } else {
        filterReposText();
        showState('data');
      }
    }

    async function addWorkspace(wsPath) {
      const res = await fetch('/api/repos/scan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: wsPath }),
      });
      return res.ok;
    }

    async function loadRepos(forceRefresh = false) {
      if (workspaces.length === 0) { showState('no-workspace'); return; }
      showState('loading');
      refreshIcon.classList.add('spin');
      try {
        const url = forceRefresh ? '/api/repos?force=true' : '/api/repos';
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Server responded with ${response.status}`);
        const repos = await response.json();
        if (repos.error) throw new Error(repos.detail || repos.error);
        currentRepos = repos;
        if (!currentRepos.length) { showState('empty'); return; }
        updateStats(currentRepos);
        filterReposText();
        showState('data');
      } catch (err) {
        errorMessage.textContent = err.message || 'Failed to connect to the server.';
        showState('error');
      } finally {
        refreshIcon.classList.remove('spin');
      }
    }

    // ===== FOLDER BROWSER WITH MULTI-SELECT =====

    function openBrowser() {
      selectedPaths.clear();
      browserModal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      browseTo(null);
    }

    function closeBrowser() {
      browserModal.classList.add('hidden');
      document.body.style.overflow = '';
      selectedPaths.clear();
    }

    function updateAddButton() {
      const count = selectedPaths.size;
      btnAddSelected.disabled = count === 0;
      btnAddLabel.textContent = count === 0 ? 'Add Selected' : `Add ${count} Folder${count > 1 ? 's' : ''}`;
    }

    function toggleCheck(itemPath) {
      if (selectedPaths.has(itemPath)) {
        selectedPaths.delete(itemPath);
      } else {
        selectedPaths.add(itemPath);
      }
      updateAddButton();
      // Update row visual
      const row = document.querySelector(`[data-browse-path="${CSS.escape(itemPath)}"]`);
      const cb = document.getElementById('cb-' + CSS.escape(itemPath));
      if (row) row.classList.toggle('selected', selectedPaths.has(itemPath));
      if (cb) cb.checked = selectedPaths.has(itemPath);
      updateSelectAllLabel();
    }

    function toggleSelectAll() {
      const allSelected = currentItems.length > 0 && currentItems.every((item) => selectedPaths.has(item.path));
      if (allSelected) {
        // Deselect all
        currentItems.forEach((item) => selectedPaths.delete(item.path));
      } else {
        // Select all
        currentItems.forEach((item) => selectedPaths.add(item.path));
      }
      // Update all checkboxes
      currentItems.forEach((item) => {
        const row = document.querySelector(`[data-browse-path="${CSS.escape(item.path)}"]`);
        const cb = document.getElementById('cb-' + CSS.escape(item.path));
        if (row) row.classList.toggle('selected', selectedPaths.has(item.path));
        if (cb) cb.checked = selectedPaths.has(item.path);
      });
      updateAddButton();
      updateSelectAllLabel();
    }

    function updateSelectAllLabel() {
      const allSelected = currentItems.length > 0 && currentItems.every((item) => selectedPaths.has(item.path));
      btnSelectAll.textContent = allSelected ? 'Deselect All' : 'Select All';
    }

    async function browseTo(targetPath) {
      // Don't clear selectedPaths when navigating — keep previous selections
      browserList.innerHTML = `
        <div class="flex items-center justify-center py-12">
          <svg class="w-6 h-6 text-accent spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </div>`;

      try {
        const url = targetPath ? `/api/browse?path=${encodeURIComponent(targetPath)}` : '/api/browse';
        const res = await fetch(url);
        const data = await res.json();

        currentBrowsePath = data.current;
        currentParentPath = data.parent;
        currentItems = data.items;

        browserPath.textContent = data.current || 'My Computer';
        btnBrowseBack.style.visibility = data.parent ? 'visible' : 'hidden';
        btnSelectAll.style.display = data.items.length > 0 ? 'block' : 'none';

        if (data.items.length === 0) {
          browserList.innerHTML = `
            <div class="flex flex-col items-center justify-center py-12 text-slate-500">
              <svg class="w-8 h-8 mb-2 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
              </svg>
              <p class="text-sm">No subdirectories found</p>
            </div>`;
          return;
        }

        browserList.innerHTML = data.items.map((item) => {
          const isChecked = selectedPaths.has(item.path);
          const escapedPath = item.path.replace(/\\/g, '\\\\');
          return `
          <div class="browse-row flex items-center border-b border-surface-border/30 ${isChecked ? 'selected' : ''}" data-browse-path="${item.path}">
            <!-- Checkbox area -->
            <label class="flex items-center gap-3 px-5 py-3 cursor-pointer flex-1 min-w-0" onclick="event.stopPropagation()">
              <input type="checkbox" class="cb-folder" id="cb-${item.path}" ${isChecked ? 'checked' : ''}
                onchange="toggleCheck('${escapedPath}')" />
              <svg class="w-5 h-5 text-amber-400/70 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
              </svg>
              <span class="text-sm text-slate-300 truncate">${item.name}</span>
            </label>
            <!-- Navigate arrow (go inside folder) -->
            <button onclick="browseTo('${escapedPath}')" class="btn-navigate px-4 py-3 text-slate-500 hover:text-accent transition-colors" title="Open folder">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          </div>`;
        }).join('');

        updateAddButton();
        updateSelectAllLabel();
      } catch (err) {
        browserList.innerHTML = `
          <div class="flex flex-col items-center justify-center py-12 text-red-400">
            <p class="text-sm">Failed to browse: ${err.message}</p>
          </div>`;
      }
    }

    function browseParent() {
      if (currentParentPath) browseTo(currentParentPath);
    }

    async function addSelectedFolders() {
      if (selectedPaths.size === 0) return;
      const paths = [...selectedPaths];
      closeBrowser();

      showState('loading');
      refreshIcon.classList.add('spin');

      // Add all selected folders in parallel
      await Promise.all(paths.map((p) => addWorkspace(p)));
      await loadWorkspaces();
      
      try {
        // Only load the newly added repos
        const promises = paths.map(async p => {
          const res = await fetch(`/api/repos?workspace=${encodeURIComponent(p)}`);
          if(res.ok) return await res.json();
          return [];
        });
        const repArrs = await Promise.all(promises);
        const newRepos = repArrs.flat();
        
        // Lọc trùng: chỉ thêm các repo chưa có trong currentRepos (dựa trên đường dẫn path)
        const uniqueNewRepos = newRepos.filter(nr => !currentRepos.some(cr => cr.path === nr.path));
        
        currentRepos = [...currentRepos, ...uniqueNewRepos];
        
        if (!currentRepos.length) { showState('empty'); }
        else {
          updateStats(currentRepos);
          filterReposText();
          showState('data');
        }
      } catch(e) {
        console.error("Failed to load new repos", e);
        showToast("Lỗi khi tải repo mới", "error");
      } finally {
        refreshIcon.classList.remove('spin');
      }
    }

    // Keyboard: ESC to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !browserModal.classList.contains('hidden')) {
        closeBrowser();
      }
    });

    // --- Init ---
    (async () => {
      await loadWorkspaces();
      await loadRepos();
    })();
    // ===== BULK ACTIONS & FILTERING =====
    function filterReposText() {
      const term = document.getElementById('repo-search').value.toLowerCase().trim();
      const statusFilter = document.getElementById('status-filter').value;
      
      const filtered = currentRepos.filter(repo => {
        // Text Match
        const matchText = !term || repo.name.toLowerCase().includes(term) ||
               (repo.branch && repo.branch.toLowerCase().includes(term)) ||
               (repo.workspace && repo.workspace.toLowerCase().includes(term));
               
        if (!matchText) return false;
        
        // Status Match
        if (statusFilter === 'all') return true;
        if (repo.error) return statusFilter === 'error';
        if (!repo.status) return false;
        
        switch (statusFilter) {
          case 'clean': return repo.status.isClean && repo.status.behind === 0 && repo.status.ahead === 0;
          case 'modified': return !repo.status.isClean;
          case 'behind': return repo.status.behind > 0;
          case 'ahead': return repo.status.ahead > 0;
          case 'error': return false; // Handled
        }
        return true;
      });
      renderRepos(filtered);
      updateSelectionUI();
    }
    
    // Kept for retro compatibility with older oninput reference
    function filterRepos() { filterReposText() }

    function toggleRepoSelection(cb, encodedPath) {
      const path = decodeURIComponent(encodedPath);
      if (cb.checked) selectedRepoPaths.add(path);
      else selectedRepoPaths.delete(path);
      updateSelectionUI();
    }

    function toggleSelectAll(cb) {
      const visibleCheckboxes = document.querySelectorAll('.repo-checkbox');
      visibleCheckboxes.forEach(c => {
        c.checked = cb.checked;
        const path = decodeURIComponent(c.value);
        if (cb.checked) selectedRepoPaths.add(path);
        else selectedRepoPaths.delete(path);
      });
      updateSelectionUI();
    }

    function updateSelectionUI() {
      const visibleCheckboxes = Array.from(document.querySelectorAll('.repo-checkbox'));
      const allChecked = visibleCheckboxes.every(c => c.checked) && visibleCheckboxes.length > 0;
      const someChecked = visibleCheckboxes.some(c => c.checked);
      
      const selectAllCb = document.getElementById('selectAll');
      if (selectAllCb) {
        selectAllCb.checked = allChecked;
        selectAllCb.indeterminate = someChecked && !allChecked;
      }
      
      const bulkActions = document.getElementById('bulk-actions');
      const bulkCount = document.getElementById('bulk-count');
      if (selectedRepoPaths.size > 0) {
        bulkActions.classList.remove('hidden');
        bulkActions.classList.add('flex');
        bulkCount.textContent = `${selectedRepoPaths.size} selected`;
      } else {
        bulkActions.classList.add('hidden');
        bulkActions.classList.remove('flex');
      }
    }

    async function bulkAction(action) {
      if (selectedRepoPaths.size === 0) return;
      const isConfirmed = await customConfirm(`Bạn có chắc chắn muốn ${action.toUpperCase()} ${selectedRepoPaths.size} repositories?`);
      if (!isConfirmed) return;
      
      const paths = Array.from(selectedRepoPaths);
      let btnHtmlOriginals = new Map();
      const actionNameMap = { 'fetch': 'Fetch', 'pull': 'Pull', 'push': 'Push', 'stash': 'Stash', 'pop': 'Pop' };
      
      let successCount = 0;
      let errorCount = 0;
      let processedCount = 0;
      const totalCount = paths.length;
      
      const bulkCountEl = document.getElementById('bulk-count');
      const originalBulkCountText = bulkCountEl ? bulkCountEl.textContent : '';
      
      for (const repoPath of paths) {
        processedCount++;
        if (bulkCountEl) {
          bulkCountEl.innerHTML = `<span class="animate-pulse text-amber-400">Đang xử lý ${processedCount}/${totalCount}...</span>`;
        }
        
        const repoIndex = currentRepos.findIndex(r => r.path === repoPath);
        if (repoIndex === -1) continue;
        const repo = currentRepos[repoIndex];
        
        // Find visible row to show spinner
        const visibleTrs = Array.from(reposTbody.querySelectorAll('tr'));
        const tr = visibleTrs.find(t => {
           const cb = t.querySelector('.repo-checkbox');
           return cb && decodeURIComponent(cb.value) === repoPath;
        });
        
        let btn;
        let allBtns = [];
        if (tr) {
           // Locate the button via its title matching the action
           btn = Array.from(tr.querySelectorAll('.btn-action')).find(b => b.title && b.title.toLowerCase().includes(action.toLowerCase()));
           allBtns = Array.from(tr.querySelectorAll('button'));
           if (btn) {
              btnHtmlOriginals.set(repoPath, btn.innerHTML);
              btn.innerHTML = `<svg class="w-4 h-4 spin mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>`;
              allBtns.forEach(b => b.disabled = true);
           }
        }
        
        try {
          const res = await fetch('/api/repo/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: repoPath, workspace: repo.workspace, action: action })
          });
          const data = await res.json();
          if (res.ok) {
            currentRepos[repoIndex] = data.repo;
            successCount++;
          } else {
            throw new Error(data.error);
          }
        } catch (e) {
          console.error(`Bulk ${action} failed on ${repoPath}`, e);
          errorCount++;
          showToast(`Lỗi ${action} - ${repo.name}:\n${e.message}`, 'error');
        } finally {
          if (btn && btnHtmlOriginals.has(repoPath)) {
            btn.innerHTML = btnHtmlOriginals.get(repoPath);
            allBtns.forEach(b => b.disabled = false);
          }
        }
        
        // We defer re-rendering individual rows to filterReposText() at the end to prevent replacing tr elements containing our tracking state
        updateStats(currentRepos);
      }
      
      if (bulkCountEl) {
         bulkCountEl.textContent = originalBulkCountText;
      }
      
      if (errorCount === 0) {
        showToast(`Thành công thực thi ${action.toUpperCase()} cho ${successCount} repos!`, 'success');
      } else {
        showToast(`Hoàn thành bulk action: ${successCount} thành công, ${errorCount} lỗi.`, 'warning');
      }
      
      // Cleanup selection or just re-render properly
      selectedRepoPaths.clear(); // Auto clear after bulk action completes to prevent accidental duplicate actions
      filterReposText(); // Re-render and update UI bounds
    }

    async function removeSelectedRepos() {
      if (selectedRepoPaths.size === 0) return;
      const paths = Array.from(selectedRepoPaths);
      
      const isConfirmed = await customConfirm(`Bạn có chắc muốn xoá [${paths.length}] Repositories này khỏi danh sách quản lý?`);
      if (!isConfirmed) return;

      try {
        await fetch('/api/repos', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths })
        });
      } catch(e) { console.error(e); }
      
      await loadWorkspaces();
      
      // Filter locally
      currentRepos = currentRepos.filter(r => !paths.includes(r.path));
      updateStats(currentRepos);
      
      // Cleanup selection
      paths.forEach(p => selectedRepoPaths.delete(p));
      updateSelectionUI();
      
      if (!currentRepos.length) {
        showState(workspaces.length === 0 ? 'no-workspace' : 'empty');
      } else {
        filterReposText();
        showState('data');
      }
      showToast(`Đã xoá ${paths.length} repo khỏi quản lý.`, 'success');
    }

    async function removeSingleRepoWorkspace(repoPath) {
      const repo = currentRepos.find(r => r.path === repoPath);
      if(!repo) return;
      
      const isConfirmed = await customConfirm(`Xoá repository này khỏi danh sách quản lý?\n${repo.name}`);
      if (!isConfirmed) return;
      
      try {
        await fetch('/api/repos', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths: [repoPath] })
        });
      } catch(e) { console.error(e); }
      
      await loadWorkspaces();

      // Filter locally
      currentRepos = currentRepos.filter(r => r.path !== repoPath);
      updateStats(currentRepos);
      
      if (!currentRepos.length) {
        showState(workspaces.length === 0 ? 'no-workspace' : 'empty');
      } else {
        filterReposText();
        showState('data');
      }

      showToast(`Đã xoá ${repo.name} khỏi danh sách quản lý`, 'success');
    }
  


    // Branch Modal Logic
    let branchModalContext = { path: null, workspace: null, rowIndex: null, currentBranch: null };
    let currentBranchesList = [];
    let selectedBranchName = null;

    async function openBranchModal(repoPath, wsPath, rowIndex, currentBranch) {
      branchModalContext = { path: repoPath, workspace: wsPath, rowIndex, currentBranch };
      const modal = document.getElementById('branch-modal');
      const inner = modal.querySelector('.scale-95');
      const loading = document.getElementById('branch-modal-loading');
      const errorDiv = document.getElementById('branch-modal-error');
      const content = document.getElementById('branch-modal-content');
      const filterInput = document.getElementById('branch-filter');

      modal.classList.remove('hidden');
      void modal.offsetWidth; // reflow
      modal.classList.remove('opacity-0');
      inner.classList.remove('scale-95');
      inner.classList.add('scale-100');

      loading.classList.remove('hidden');
      errorDiv.classList.add('hidden');
      content.classList.add('hidden');
      if (filterInput) filterInput.value = '';

      try {
        const res = await fetch(`/api/repo/branches?path=${encodeURIComponent(repoPath)}`);
        const branches = await res.json();
        if (!res.ok) throw new Error(branches.error || 'Failed to load');
        
        currentBranchesList = branches;
        selectedBranchName = currentBranch;
        
        loading.classList.add('hidden');
        content.classList.remove('hidden');
        renderBranchList(currentBranchesList);
        if (filterInput) filterInput.focus();
      } catch (err) {
        loading.classList.add('hidden');
        errorDiv.classList.remove('hidden');
        document.getElementById('branch-error-msg').textContent = err.message;
      }
    }

    function renderBranchList(branchesToShow) {
      const list = document.getElementById('branch-list');
      const btnCheckout = document.getElementById('btn-checkout');
      
      if (branchesToShow.length === 0) {
        list.innerHTML = `<div class="px-3 py-4 text-sm text-slate-500 text-center italic">Không tìm thấy nhánh phù hợp</div>`;
        btnCheckout.disabled = true;
        return;
      }
      
      list.innerHTML = branchesToShow.map(b => {
        const isSelected = b === selectedBranchName;
        const isCurrent = b === branchModalContext.currentBranch;
        return `<button onclick="selectBranchForCheckout('${b}')" class="group flex items-center w-full px-3 py-2.5 rounded-md text-sm text-left transition-colors ${isSelected ? 'bg-accent/20 text-accent font-medium' : 'text-slate-300 hover:bg-surface-hover border border-transparent'}">
          ${isCurrent ? '<span class="mr-2 text-emerald-400" title="Nhánh hiện tại">★</span>' : '<span class="mr-2 opacity-0">★</span>'}
          <span class="truncate flex-1 ${isSelected ? '' : 'group-hover:text-white'}">${b}</span>
          ${isSelected ? '<svg class="w-4 h-4 ml-2 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>' : ''}
        </button>`;
      }).join('');
      
      btnCheckout.disabled = !selectedBranchName || selectedBranchName === branchModalContext.currentBranch;
    }

    function selectBranchForCheckout(branch) {
      selectedBranchName = branch;
      filterBranchList(document.getElementById('branch-filter').value);
    }

    function filterBranchList(term) {
      term = term.toLowerCase().trim();
      if (!term) {
        renderBranchList(currentBranchesList);
        return;
      }
      const filtered = currentBranchesList.filter(b => b.toLowerCase().includes(term));
      renderBranchList(filtered);
    }

    function closeBranchModal() {
      const modal = document.getElementById('branch-modal');
      const inner = modal.querySelector('.scale-100');
      modal.classList.add('opacity-0');
      if (inner) {
        inner.classList.remove('scale-100');
        inner.classList.add('scale-95');
      }
      setTimeout(() => modal.classList.add('hidden'), 200);
    }

    async function executeCheckout() {
      const { path, workspace, rowIndex } = branchModalContext;
      const targetBranch = selectedBranchName;
      if (!targetBranch || targetBranch === branchModalContext.currentBranch) return;

      const btn = document.getElementById('btn-checkout');
      const originalText = btn.textContent;
      
      btn.disabled = true;
      btn.innerHTML = `<svg class="w-4 h-4 spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>`;
      
      try {
        const res = await fetch('/api/repo/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path, workspace, branch: targetBranch })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Checkout failed');
        
        closeBranchModal();
        
        const tr = document.getElementById('repo-row-' + rowIndex);
        const originalIndex = currentRepos.findIndex(r => r.path === path);
        if (originalIndex !== -1) {
          currentRepos[originalIndex] = data.repo;
          updateStats(currentRepos);
        }
        if (tr) {
          tr.innerHTML = renderRepoRowInner(data.repo, rowIndex);
        }
        showToast(`Chuyển sang nhánh <b>${targetBranch}</b> thành công!`, 'success');
      } catch (err) {
        showToast(`Checkout thất bại:\n${err.message}`, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    }

    // --- TIMELINE LOGIC ---
    let timelineOpen = false;
    async function toggleTimeline() {
      const panel = document.getElementById('timeline-sidebar');
      const backdrop = document.getElementById('timeline-backdrop');
      if (timelineOpen) {
        panel.classList.add('translate-x-full');
        backdrop.classList.add('opacity-0', 'pointer-events-none');
        timelineOpen = false;
      } else {
        backdrop.classList.remove('opacity-0', 'pointer-events-none');
        panel.classList.remove('translate-x-full');
        timelineOpen = true;
        await loadTimeline();
      }
    }

    async function loadTimeline() {
      const content = document.getElementById('timeline-content');
      
      // If some repos are selected, use them. Otherwise use all loaded repos.
      const targetPaths = selectedRepoPaths.size > 0 
        ? Array.from(selectedRepoPaths) 
        : currentRepos.map(r => r.path);
        
      if (targetPaths.length === 0) {
        content.innerHTML = '<div class="text-center p-6 text-slate-500">Chưa có repository nào để lấy lịch sử.</div>';
        return;
      }

      content.innerHTML = `
        <div class="flex flex-col items-center justify-center p-12 text-slate-400">
          <svg class="w-8 h-8 spin mb-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          <span class="text-sm">Đang gom lịch sử Git${selectedRepoPaths.size > 0 ? ` từ ${selectedRepoPaths.size} repo` : ''}...</span>
        </div>`;

      try {
        const res = await fetch('/api/commits/timeline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths: targetPaths })
        });
        const commits = await res.json();
        
        if (!res.ok) throw new Error(commits.error);

        if (commits.length === 0) {
          content.innerHTML = '<div class="text-center py-10 text-slate-500">Không tìm thấy commit nào gần đây.</div>';
          return;
        }

        const timeFormat = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
        
        content.innerHTML = '<div class="relative border-l-2 border-surface-border ml-3 mt-4 space-y-8 pb-8">' + commits.map((c) => {
          const dt = timeFormat.format(new Date(c.date));
          const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(c.author_name)}&background=random&color=fff&size=40`;
          return `
            <div class="relative pl-6 group">
              <span class="absolute -left-[11px] top-1 w-5 h-5 rounded-full bg-surface border-2 border-purple-500/50 group-hover:border-purple-400 group-hover:bg-purple-500/20 transition-all flex items-center justify-center shadow-[0_0_10px_rgba(168,85,247,0.4)]">
                <span class="w-1.5 h-1.5 rounded-full bg-purple-400 group-hover:bg-white transition-colors"></span>
              </span>
              <div class="flex items-start gap-4">
                <img src="${avatarUrl}" alt="${c.author_name}" class="w-10 h-10 rounded-xl shadow-lg border border-white/5 opacity-80 group-hover:opacity-100 transition-opacity" />
                <div class="flex-1 bg-surface-card border border-surface-border rounded-xl p-3 shadow-sm hover:border-purple-500/30 transition-all">
                  <div class="flex justify-between items-start mb-1">
                    <p class="text-[13px] font-bold text-white tracking-wide">${c.repoName}</p>
                    <span class="text-[11px] font-mono text-slate-500 whitespace-nowrap">${dt}</span>
                  </div>
                  <p class="text-sm text-slate-300 font-medium mb-2">${c.message}</p>
                  <div class="flex items-center gap-3 text-[11px] font-mono text-slate-500">
                    <span class="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-purple-300">${c.hash.substring(0,7)}</span>
                    <span class="flex items-center gap-1"><svg class="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>${c.author_name}</span>
                  </div>
                </div>
              </div>
            </div>`;
        }).join('') + '</div>';

      } catch (err) {
        content.innerHTML = `<div class="p-6 text-red-400 text-sm text-center">Lỗi lấy timeline: ${err.message}</div>`;
      }
    }
  


    // ===== TOAST NOTIFICATION =====
    function showToast(message, type = 'success') {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      
      let icon = '';
      if (type === 'success') toast.className = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-3.5 rounded-xl shadow-lg shadow-black/30 backdrop-blur-md flex items-start gap-3 w-80 translate-y-2 opacity-0 transition-all duration-300 pointer-events-auto';
      else if (type === 'error') toast.className = 'bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-3.5 rounded-xl shadow-lg shadow-black/30 backdrop-blur-md flex items-start gap-3 w-80 translate-y-2 opacity-0 transition-all duration-300 pointer-events-auto';
      else if (type === 'warning') toast.className = 'bg-amber-500/10 text-amber-400 border border-amber-500/20 px-4 py-3.5 rounded-xl shadow-lg shadow-black/30 backdrop-blur-md flex items-start gap-3 w-80 translate-y-2 opacity-0 transition-all duration-300 pointer-events-auto';
      
      const iconPath = type === 'success' ? 'M5 13l4 4L19 7' : (type === 'error' ? 'M6 18L18 6M6 6l12 12' : 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z');
      const title = type === 'success' ? 'Thành công' : (type === 'error' ? 'Lỗi hệ thống' : 'Cảnh báo');
      
      toast.innerHTML = `
        <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${iconPath}"/></svg>
        <div class="flex-1">
          <h4 class="text-sm font-semibold mb-0.5">${title}</h4>
          <p class="text-[13px] opacity-90 leading-relaxed max-h-32 overflow-y-auto break-words" style="scrollbar-width: thin">${message.replace(/\n/g, '<br>')}</p>
        </div>
        <button onclick="this.parentElement.remove()" class="text-current opacity-60 hover:opacity-100 transition-opacity"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
      `;
      
      container.appendChild(toast);
      
      requestAnimationFrame(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
      });
      
      setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
      }, type === 'error' ? 8000 : 5000); // Lỗi hiện lâu hơn (8s).
    }

    // --- Conflict Modal Logic ---
    function openConflictModal(repoPath, wsPath, rowIndex) {
      const repo = currentRepos.find(r => r.path === repoPath);
      if (!repo || !repo.status || !repo.status.conflicted) return;
      
      const modal = document.getElementById('conflict-modal');
      const inner = modal.querySelector('.scale-95');
      const fileList = document.getElementById('conflict-file-list');
      const btnOpenFolder = document.getElementById('btn-open-conflict-folder');
      
      if (repo.status.conflicted.length === 0) {
        fileList.innerHTML = `<div class="p-4 text-center text-slate-400 italic">Không có file conflict.</div>`;
      } else {
        fileList.innerHTML = repo.status.conflicted.map(file => {
          const escapedFile = file.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          return `<div class="flex items-center justify-between bg-black/30 p-2.5 rounded border border-rose-500/20">
            <span class="truncate text-rose-300 font-semibold mr-2" title="${file}">⚠️ ${file}</span>
            <button onclick="navigator.clipboard.writeText('${escapedFile}'); showToast('Đã copy đường dẫn file', 'success')" class="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-md text-xs font-bold text-slate-300 transition-colors shrink-0 border border-white/5">Copy File Path</button>
          </div>`;
        }).join('');
      }
      
      btnOpenFolder.onclick = () => { closeConflictModal(); openFolder(repoPath); };
      
      modal.classList.remove('hidden');
      void modal.offsetWidth; // reflow
      modal.classList.remove('opacity-0');
      if(inner) {
        inner.classList.remove('scale-95');
        inner.classList.add('scale-100');
      }
    }

    function closeConflictModal() {
      const modal = document.getElementById('conflict-modal');
      const inner = modal.querySelector('.scale-100');
      modal.classList.add('opacity-0');
      if (inner) {
        inner.classList.remove('scale-100');
        inner.classList.add('scale-95');
      }
      setTimeout(() => modal.classList.add('hidden'), 200);
    }

    // --- Global Search Logic ---
    function toggleSearch() {
      const sidebar = document.getElementById('search-sidebar');
      const backdrop = document.getElementById('search-backdrop');
      const input = document.getElementById('global-search-input');
      
      const isOpen = !sidebar.classList.contains('translate-x-full');
      
      if (isOpen) {
        sidebar.classList.add('translate-x-full');
        backdrop.classList.add('opacity-0');
        backdrop.classList.remove('pointer-events-auto');
        backdrop.classList.add('pointer-events-none');
      } else {
        sidebar.classList.remove('translate-x-full');
        backdrop.classList.remove('opacity-0');
        backdrop.classList.remove('pointer-events-none');
        backdrop.classList.add('pointer-events-auto');
        setTimeout(() => input.focus(), 300);
      }
    }

    async function handleSearchInput(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        await performSearch();
      }
    }

    async function performSearch() {
      const input = document.getElementById('global-search-input');
      const query = input.value.trim();
      if (!query) return;

      const optCase = document.getElementById('search-opt-case').checked;
      const optWord = document.getElementById('search-opt-word').checked;
      const optRegex = document.getElementById('search-opt-regex').checked;
      
      const loading = document.getElementById('search-loading');
      const resultsContainer = document.getElementById('search-results-content');
      
      loading.classList.remove('hidden');
      resultsContainer.innerHTML = '';
      
      // Get selected repos or all repos if none selected
      let repoPathsToSearch = Array.from(selectedRepoPaths);
      if (repoPathsToSearch.length === 0) {
        repoPathsToSearch = currentRepos.map(r => r.path);
      }
      
      if (repoPathsToSearch.length === 0) {
        loading.classList.add('hidden');
        resultsContainer.innerHTML = '<div class="flex items-center justify-center p-8 text-slate-500 italic text-sm">Không có repository nào để tìm kiếm.</div>';
        return;
      }

      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paths: repoPathsToSearch,
            query: query,
            options: { ignoreCase: !optCase, wholeWord: optWord, isRegex: optRegex }
          })
        });
        
        const data = await res.json();
        loading.classList.add('hidden');
        
        if (!res.ok) throw new Error(data.error || 'Lỗi tìm kiếm');
        
        if (!data || data.length === 0) {
          resultsContainer.innerHTML = '<div class="flex items-center justify-center p-8 text-slate-500 italic text-sm">Không tìm thấy kết quả nào.</div>';
          return;
        }

        let totalMatches = 0;
        let html = '';
        
        data.forEach(repoResult => {
          totalMatches += repoResult.matches.length;
          
          html += `
          <div class="border-b border-surface-border bg-black/10">
            <div class="px-4 py-2 bg-black/40 border-y border-white/5 sticky top-0 backdrop-blur-md flex items-center justify-between z-10">
              <span class="text-[13px] font-bold text-sky-400">repo: ${repoResult.repo}</span>
              <span class="text-[11px] text-slate-500 font-mono">${repoResult.matches.length} matches</span>
            </div>
            <div class="py-2">
          `;
          
          // Group by file
          const byFile = {};
          repoResult.matches.forEach(m => {
            if(!byFile[m.file]) byFile[m.file] = [];
            byFile[m.file].push(m);
          });
          
          for (const [file, matches] of Object.entries(byFile)) {
            html += `<div class="px-3 pt-2 pb-1 text-[12px] font-bold text-slate-300 break-all border-l-2 border-sky-500/30 ml-2 flex items-center gap-2">
              <svg class="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
              ${file}
            </div>`;
            matches.forEach(m => {
              const safeContent = m.content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
              let displayContent = safeContent;
              if (!optRegex) {
                try {
                  const regex = new RegExp(`(${query.replace(/[.*+?^$\{}\(\)|[\\]\\\\]/g, '\\\\$&')})`, optCase ? 'g' : 'gi');
                  displayContent = safeContent.replace(regex, '<span class="bg-sky-500/30 text-sky-200 rounded px-0.5">$1</span>');
                } catch(e) {}
              }
              
              const escapedRepo = repoResult.path.replace(/\\/g, '\\\\');
              html += `
              <div class="group flex items-start gap-2 px-3 py-1.5 hover:bg-white/5 cursor-pointer ml-2 border-l-2 border-transparent hover:border-sky-500/50 transition-colors" onclick="openFolder('${escapedRepo}')" title="Mở thư mục chứa file trong Explorer">
                <span class="text-[11px] text-slate-500 font-mono w-8 text-right shrink-0 select-none opacity-60">${m.line}</span>
                <span class="text-[12px] font-mono whitespace-pre-wrap break-words text-slate-400 group-hover:text-slate-200 pb-0.5">
                  ${displayContent}
                </span>
              </div>`;
            });
          }
          
          html += `</div></div>`;
        });
        
        resultsContainer.innerHTML = `
          <div class="px-4 py-2 bg-sky-500/10 text-sky-400 text-xs font-bold border-b border-sky-500/20 text-center sticky top-0 z-20 backdrop-blur-md">
            Tìm thấy ${totalMatches} kết quả trong ${data.length} repositories
          </div>
          ${html}
        `;
        
      } catch (e) {
        loading.classList.add('hidden');
        resultsContainer.innerHTML = `<div class="p-6 text-center text-red-400 text-sm">Lỗi: ${e.message}</div>`;
      }
    }

    // --- Git Graph Modal Logic ---
    function closeGraphModal() {
      const modal = document.getElementById('graph-modal');
      const inner = modal.querySelector('.scale-100');
      modal.classList.add('opacity-0');
      if (inner) {
        inner.classList.remove('scale-100');
        inner.classList.add('scale-95');
      }
      setTimeout(() => modal.classList.add('hidden'), 200);
    }

    async function openGraphModal(repoPath, repoName) {
      const modal = document.getElementById('graph-modal');
      const inner = modal.querySelector('.scale-95');
      document.getElementById('graph-repo-name').textContent = repoName;
      
      const svgContainer = document.getElementById('graph-svg-container');
      const commitsContainer = document.getElementById('graph-commits-container');
      const loading = document.getElementById('graph-loading');
      
      svgContainer.innerHTML = '';
      commitsContainer.innerHTML = '';
      loading.classList.remove('hidden');
      
      modal.classList.remove('hidden');
      void modal.offsetWidth;
      modal.classList.remove('opacity-0');
      if(inner) {
        inner.classList.remove('scale-95');
        inner.classList.add('scale-100');
      }

      try {
        const res = await fetch(`/api/repo/graph?path=${encodeURIComponent(repoPath)}&count=100`);
        const data = await res.json();
        if(!res.ok) throw new Error(data.error || 'Failed to fetch graph');
        
        renderGitGraph(data, svgContainer, commitsContainer);
      } catch (e) {
        commitsContainer.innerHTML = `<div class="p-4 text-red-500 text-sm">Lỗi: ${e.message}</div>`;
      } finally {
        loading.classList.add('hidden');
      }
    }

    function renderGitGraph(commits, svgContainer, commitsContainer) {
      if (!commits || commits.length === 0) {
        commitsContainer.innerHTML = `<div class="p-4 text-slate-400 text-sm text-center italic">Không có commit nào</div>`;
        return;
      }

      const commitNodes = new Map();
      commits.forEach((c, idx) => {
        const parents = c.parents ? c.parents.split(' ').filter(p => p.trim()) : [];
        commitNodes.set(c.hash, { index: idx, hash: c.hash, parents, commit: c, column: -1 });
      });

      const activeColumns = [];
      const branchColors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
      const paths = [];

      const ROW_HEIGHT = 44; // match UI elements
      const COL_WIDTH = 14;
      const DOT_RADIUS = 4;
      const START_X = 14;
      const START_Y = ROW_HEIGHT / 2;

      commits.forEach((c, rowIndex) => {
        const node = commitNodes.get(c.hash);
        if (!node) return;

        let col = activeColumns.indexOf(c.hash);
        if (col === -1) {
          col = 0;
          while (activeColumns[col]) col++;
        }
        
        node.column = col;
        activeColumns[col] = c.hash; 

        activeColumns.forEach((activeHash, activeCol) => {
           if (activeHash && activeHash !== c.hash) {
              const color = branchColors[activeCol % branchColors.length];
              const x1 = START_X + activeCol * COL_WIDTH;
              const y1 = START_Y + (rowIndex - 1) * ROW_HEIGHT;
              const x2 = x1;
              const y2 = START_Y + rowIndex * ROW_HEIGHT;
              if (rowIndex > 0) paths.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2" />`);
           }
        });

        const parents = node.parents;
        if (parents.length === 0) {
          activeColumns[col] = null;
        } else {
          activeColumns[col] = parents[0];
          for (let pIdx = 1; pIdx < parents.length; pIdx++) {
            let pCol = activeColumns.indexOf(parents[pIdx]);
            if (pCol === -1) {
              pCol = 0;
              while (activeColumns[pCol]) pCol++;
              activeColumns[pCol] = parents[pIdx];
            }
            const color = branchColors[pCol % branchColors.length];
            const startX = START_X + col * COL_WIDTH;
            const startY = START_Y + rowIndex * ROW_HEIGHT;
            const endX = START_X + pCol * COL_WIDTH;
            const endY = START_Y + (rowIndex + 1) * ROW_HEIGHT;
            
            paths.push(`<path d="M ${startX} ${startY} C ${startX} ${startY + ROW_HEIGHT/2}, ${endX} ${startY + ROW_HEIGHT/2}, ${endX} ${endY}" stroke="${color}" stroke-width="2" fill="none" opacity="0.8"/>`);
          }
        }
        
        if (rowIndex < commits.length - 1 && parents.length > 0) {
           const color = branchColors[col % branchColors.length];
           paths.push(`<line x1="${START_X + col * COL_WIDTH}" y1="${START_Y + rowIndex * ROW_HEIGHT}" x2="${START_X + col * COL_WIDTH}" y2="${START_Y + (rowIndex + 1) * ROW_HEIGHT}" stroke="${color}" stroke-width="2" />`);
        }
      });

      let svgHtml = '';
      let commitsHtml = '';
      
      const timeFormat = new Intl.DateTimeFormat('vi-VN', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });

      commits.forEach((c, rowIndex) => {
        const node = commitNodes.get(c.hash);
        const col = node ? node.column : 0;
        const color = branchColors[col % branchColors.length];
        
        const cx = START_X + col * COL_WIDTH;
        const cy = START_Y + rowIndex * ROW_HEIGHT;
        
        svgHtml += `<circle cx="${cx}" cy="${cy}" r="${DOT_RADIUS}" fill="${color}" stroke="#0b0c10" stroke-width="2" class="cursor-pointer hover:stroke-white transition-colors title='${c.hash}'"/>`;
        
        const dateStr = timeFormat.format(new Date(c.date));
        
        let refsHtml = '';
        if (c.refs) {
          const refs = c.refs.split(',').map(r => r.trim()).filter(r => r);
          refs.forEach(r => {
            const isHead = r.includes('HEAD');
            const isTag = r.includes('tag:');
            const bgClass = isHead ? 'bg-sky-500/20 border-sky-500/30 text-sky-400' : (isTag ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400');
            refsHtml += `<span class="px-1.5 py-[2px] rounded text-[10px] font-bold border ${bgClass} ml-1.5 whitespace-nowrap">${r.replace('tag: ', '')}</span>`;
          });
        }
        
        const safeMsg = c.message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        commitsHtml += `
        <div class="flex items-center gap-3 px-2 border-b border-white/5 hover:bg-white/5 transition-colors group cursor-default" style="height: ${ROW_HEIGHT}px;">
          <span class="text-[12px] font-mono text-slate-500/80 w-14 shrink-0" title="${c.hash}">${c.hash.substring(0,7)}</span>
          <div class="flex-1 truncate group" title="${c.message.replace(/"/g, '&quot;')}">
            <span class="text-[13px] text-slate-300 font-medium group-hover:text-accent transition-colors">${safeMsg}</span>
            ${refsHtml}
          </div>
          <div class="flex items-center gap-2 w-32 shrink-0 justify-end">
            <span class="text-[11px] font-mono text-slate-400 truncate w-full text-right" title="${c.author_name}">${c.author_name}</span>
          </div>
          <div class="w-[90px] shrink-0 text-right pr-2">
            <span class="text-[10px] uppercase font-mono text-slate-600">${dateStr}</span>
          </div>
        </div>`;
      });
      
      const maxCol = Math.max(...Array.from(commitNodes.values()).map(n => n.column));
      const svgWidth = START_X * 2 + (maxCol > 0 ? maxCol : 1) * COL_WIDTH;
      const svgHeight = commits.length * ROW_HEIGHT;
      
      svgContainer.style.width = `${svgWidth}px`;
      svgContainer.innerHTML = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
        ${paths.join('')}
        ${svgHtml}
      </svg>`;
      
      commitsContainer.innerHTML = commitsHtml;
    }

    // --- Commit Modal ---
    let commitModalContext = { path: null, workspace: null, rowIndex: null };

    window.openCommitModal = function(repoPath, wsPath, rowIndex) {
      commitModalContext = { path: repoPath, workspace: wsPath, rowIndex };
      const modal = document.getElementById('commit-modal');
      const inner = modal.querySelector('.scale-95') || modal.querySelector('.scale-100');
      const input = document.getElementById('commit-message');
      
      if (input) input.value = '';
      
      // Populate modified file list
      const fileList = document.getElementById('commit-file-list');
      if (fileList) {
        const repo = currentRepos.find(r => r.path === repoPath);
        if (repo && repo.status) {
          const allFiles = [...(repo.status.modified || []), ...(repo.status.deleted || []), ...(repo.status.not_added || [])];
          fileList.innerHTML = allFiles.map(f => `<div class="px-2 py-1 rounded-lg bg-white/5 text-amber-300/80">${f}</div>`).join('') || '<div class="text-slate-500 px-2">No changes detected</div>';
        }
      }
      
      modal.classList.remove('hidden');
      void modal.offsetWidth;
      modal.classList.remove('opacity-0');
      if (inner) {
        inner.classList.remove('scale-95');
        inner.classList.add('scale-100');
      }
      
      setTimeout(() => input.focus(), 200);
    };

    window.closeCommitModal = function() {
      const modal = document.getElementById('commit-modal');
      if (!modal) return;
      const inner = modal.querySelector('.scale-100');
      modal.classList.add('opacity-0');
      if (inner) {
        inner.classList.remove('scale-100');
        inner.classList.add('scale-95');
      }
      setTimeout(() => modal.classList.add('hidden'), 200);
    };

    window.executeCommit = async function() {
      const input = document.getElementById('commit-message');
      const msg = (input && input.value) ? input.value.trim() : '';
      if (!msg) {
        showToast('Vui lòng nhập tóm tắt thay đổi (Commit Message)!', 'warning');
        if (input) input.focus();
        return;
      }
      
      const btn = document.getElementById('btn-commit-action');
      let originalText = '';
      if (btn) {
        originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<svg class="w-4 h-4 spin mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>`;
      }
      
      const { path, workspace, rowIndex } = commitModalContext;
      const tr = document.getElementById('repo-row-' + rowIndex);
      
      let refreshBtn;
      if (tr) {
        refreshBtn = tr.querySelector('.btn-refresh-row svg');
        if (refreshBtn) refreshBtn.classList.add('spin');
      }

      try {
        const res = await fetch('/api/repo/commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path, workspace, message: msg })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Commit thất bại');
        
        window.closeCommitModal();
        let repoName = path.replace(/\\/g, '/').split('/').filter(Boolean).pop();
        showToast(`Commit thành công: ${repoName}`, 'success');
        
        // Update local object & re-render
        const originalIndex = currentRepos.findIndex(r => r.path === path);
        if (originalIndex !== -1) {
          currentRepos[originalIndex] = data.repo;
          updateStats(currentRepos);
        }
        if (tr) {
          tr.outerHTML = renderRepoRowInner(data.repo, rowIndex);
        }
      } catch (err) {
        showToast(`Commit thất bại:\\n${err.message}`, 'error');
      } finally {
        if(btn) {
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
        if (refreshBtn) refreshBtn.classList.remove('spin');
      }
    };
