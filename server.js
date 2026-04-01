import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import simpleGit from 'simple-git';

// --- Configuration ---
const PORT = 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.join(__dirname, 'config.json');

// ===== PERFORMANCE SAFEGUARDS =====

// 1. Concurrency Limiter - Limit parallel git processes to avoid CPU/RAM/Disk overload
const GIT_CONCURRENCY = 5; // Max 5 git processes at a time
function createLimiter(concurrency) {
  let active = 0;
  const queue = [];

  function next() {
    if (active >= concurrency || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve, reject).finally(() => {
      active--;
      next();
    });
  }

  return function limit(fn) {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
  };
}

const gitLimit = createLimiter(GIT_CONCURRENCY);

// 2. Per-Repo Mutex Lock - Prevents concurrent git write operations on the same repo
const repoLocks = new Map();
async function withRepoLock(repoPath, fn) {
  // Wait for any existing operation on this repo to finish
  while (repoLocks.has(repoPath)) {
    await repoLocks.get(repoPath);
  }
  // Create a new lock promise for this repo
  let releaseLock;
  const lockPromise = new Promise(resolve => { releaseLock = resolve; });
  repoLocks.set(repoPath, lockPromise);
  try {
    return await fn();
  } finally {
    repoLocks.delete(repoPath);
    releaseLock();
  }
}

// 3. In-Memory Cache - Avoid re-scanning repos that haven't changed
const repoCache = new Map();
const CACHE_TTL_MS = 60_000; // Cache valid for 30 seconds

function getCachedRepo(repoPath) {
  const entry = repoCache.get(repoPath);
  if (entry && (Date.now() - entry.timestamp < CACHE_TTL_MS)) {
    return entry.data;
  }
  return null;
}

function setCachedRepo(repoPath, data) {
  repoCache.set(repoPath, { data, timestamp: Date.now() });
}

function invalidateCache(repoPath) {
  repoCache.delete(repoPath);
}

// 4. Network Rate Limiter - Separate slower limit for fetch/pull/push to avoid remote rate-limiting
const NETWORK_CONCURRENCY = 3; // Max 3 network git operations at a time
const networkLimit = createLimiter(NETWORK_CONCURRENCY);

// --- Config Helpers ---
function loadConfig() {
  if (existsSync(CONFIG_FILE)) {
    try {
      const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
      if (!config.repos) {
        // Migration state: if user had old config with workspaces, clean it
        if (config.workspaces) delete config.workspaces;
        config.repos = [];
      }
      return config;
    } catch {
      return { repos: [] };
    }
  }
  return { repos: [] };
}

function saveConfig(config) {
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

// --- App Setup ---
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Routes ---

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ===== WORKSPACE MANAGEMENT =====

// GET /api/workspaces - List unique workspaces from tracked repos
app.get('/api/workspaces', (req, res) => {
  const config = loadConfig();
  const wsSet = new Set();
  config.repos.forEach(r => {
    if (r.workspace) wsSet.add(r.workspace);
  });
  res.json(Array.from(wsSet));
});

// POST /api/repos/scan - Scan a folder and add all unique repos to config
app.post('/api/repos/scan', async (req, res) => {
  try {
    const { path: wsPath } = req.body;

    if (!wsPath || typeof wsPath !== 'string') {
      return res.status(400).json({ error: 'Path is required' });
    }

    const normalizedPath = path.resolve(wsPath);

    try {
      const stat = await fs.stat(normalizedPath);
      if (!stat.isDirectory()) {
        return res.status(400).json({ error: 'Path is not a directory' });
      }
    } catch {
      return res.status(400).json({ error: 'Directory does not exist' });
    }

    // Perform the heavy scan once
    const foundRepos = await scanWorkspace(normalizedPath, normalizedPath);

    const config = loadConfig();
    let addedCount = 0;

    // Save to static list
    foundRepos.forEach(repoInfo => {
      const exists = config.repos.some(r => r.path === repoInfo.path);
      if (!exists) {
        config.repos.push({ path: repoInfo.path, workspace: repoInfo.workspace });
        addedCount++;
      }
    });

    saveConfig(config);

    res.status(201).json({ message: 'Workspace scanned and repos added', addedCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to scan workspace', detail: err.message });
  }
});

// DELETE /api/workspaces - Remove all tracked repos belonging to a workspace
app.delete('/api/workspaces', (req, res) => {
  try {
    const { path: wsPath } = req.body;
    const config = loadConfig();
    const normalizedPath = path.resolve(wsPath);

    config.repos = config.repos.filter(
      (r) => path.resolve(r.workspace) !== normalizedPath
    );
    saveConfig(config);

    res.json({ message: 'Workspace repos removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove workspace', detail: err.message });
  }
});

// DELETE /api/repos - Remove explicit repos from list
app.delete('/api/repos', (req, res) => {
  try {
    const { paths } = req.body;
    if (!Array.isArray(paths)) {
      return res.status(400).json({ error: 'Paths array is required' });
    }
    const config = loadConfig();
    const normalizedPathsToRemove = paths.map(p => path.resolve(p));

    config.repos = config.repos.filter(
      (r) => !normalizedPathsToRemove.includes(path.resolve(r.path))
    );
    saveConfig(config);

    res.json({ message: 'Repos removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove repos', detail: err.message });
  }
});

// ===== DIRECTORY BROWSER =====

// GET /api/browse?path=... - Browse directories for the folder picker
app.get('/api/browse', async (req, res) => {
  try {
    let targetPath = req.query.path;

    // If no path given, return drive roots (Windows) or /
    if (!targetPath) {
      if (process.platform === 'win32') {
        // List available drives on Windows
        const { execSync } = await import('child_process');
        const drives = execSync('wmic logicaldisk get name', { encoding: 'utf-8' })
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => /^[A-Z]:$/.test(line))
          .map((drive) => ({
            name: drive + '\\',
            path: drive + '\\',
            isDirectory: true,
          }));
        return res.json({ current: '', parent: null, items: drives });
      }
      targetPath = '/';
    }

    const resolvedPath = path.resolve(targetPath);
    const parentPath = path.dirname(resolvedPath);

    const entries = await fs.readdir(resolvedPath, { withFileTypes: true });

    // Only show directories, skip hidden/system folders
    const dirs = entries
      .filter((entry) => {
        if (!entry.isDirectory()) return false;
        const name = entry.name;
        // Skip common non-useful directories
        if (name.startsWith('.') || name === 'node_modules' || name === '$RECYCLE.BIN' || name === 'System Volume Information') return false;
        return true;
      })
      .map((entry) => ({
        name: entry.name,
        path: path.join(resolvedPath, entry.name),
        isDirectory: true,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      current: resolvedPath,
      parent: resolvedPath !== parentPath ? parentPath : null,
      items: dirs,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to browse directory', detail: err.message });
  }
});

// ===== GIT REPOS =====

// Max depth to scan for .git directories inside a workspace
const SCAN_DEPTH = 3;

// Helper: get git info for a single repo directory (with cache + concurrency limit)
async function getRepoInfo(dirPath, workspacePath, { skipCache = false } = {}) {
  // Check cache first
  if (!skipCache) {
    const cached = getCachedRepo(dirPath);
    if (cached && cached.workspace === workspacePath) return cached;
  }

  // Use the concurrency limiter to avoid spawning too many git processes
  return gitLimit(async () => {
    try {
      const git = simpleGit(dirPath);
      const [branchSummary, statusSummary] = await Promise.all([
        git.branch(),
        git.status(),
      ]);

      const result = {
        name: path.basename(dirPath),
        path: dirPath,
        workspace: workspacePath,
        branch: branchSummary.current,
        status: {
          modified: statusSummary.modified,
          deleted: statusSummary.deleted,
          not_added: statusSummary.not_added,
          conflicted: statusSummary.conflicted || [],
          ahead: statusSummary.ahead,
          behind: statusSummary.behind,
          isClean: statusSummary.isClean(),
        },
      };

      // Store in cache
      setCachedRepo(dirPath, result);
      return result;
    } catch (err) {
      return {
        name: path.basename(dirPath),
        path: dirPath,
        workspace: workspacePath,
        branch: null,
        status: null,
        error: err.message,
      };
    }
  });
}

// Helper: recursively scan for git repos up to SCAN_DEPTH levels
async function scanWorkspace(dirPath, workspacePath, depth = 0) {
  if (depth >= SCAN_DEPTH) return [];

  // Check if this directory itself is a git repo
  try {
    await fs.access(path.join(dirPath, '.git'));
    return [await getRepoInfo(dirPath, workspacePath)];
  } catch {
    // Not a git repo itself — scan children
  }

  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const directories = entries.filter((entry) => entry.isDirectory());

  const promises = directories.map(async (dir) => {
    const childPath = path.join(dirPath, dir.name);
    const gitDir = path.join(childPath, '.git');

    try {
      await fs.access(gitDir);
      // Found a git repo — collect info, don't go deeper
      return [await getRepoInfo(childPath, workspacePath)];
    } catch {
      // No .git here — recurse deeper
      return scanWorkspace(childPath, workspacePath, depth + 1);
    }
  });

  const nestedResults = await Promise.all(promises);
  return nestedResults.flat();
}

// GET /api/repo - Refresh a single repo
app.get('/api/repo', async (req, res) => {
  const repoPath = req.query.path;
  const workspacePath = req.query.workspace;
  if (!repoPath || !workspacePath) {
    return res.status(400).json({ error: 'Missing path or workspace' });
  }

  try {
    const info = await getRepoInfo(repoPath, workspacePath, { skipCache: true });
    res.json(info);
  } catch (err) {
    console.error(`Failed to refresh repo ${repoPath}:`, err);
    res.status(500).json({ error: 'Failed to refresh repo', detail: err.message });
  }
});

// POST /api/repo/open_folder - Open repo in Windows File Explorer
app.post('/api/repo/open_folder', (req, res) => {
  const repoPath = req.body.path;
  if (!repoPath) return res.status(400).json({ error: 'Missing path' });

  exec(`explorer "${repoPath}"`, (err) => {
    if (err) {
      // explorer.exe thường trả về exit code 1 ở một số thiết lập Windows dù vẫn mở được folder
      console.warn(`Explorer returned error code for ${repoPath}, but folder might be opened:`, err.message);
    }
    res.json({ success: true });
  });
});

// POST /api/repo/action - Execute fetch, pull, or push (with lock + rate-limit)
app.post('/api/repo/action', async (req, res) => {
  const { path: repoPath, action, workspace } = req.body;
  if (!repoPath || !action) {
    return res.status(400).json({ error: 'Missing path or action' });
  }

  const isNetworkAction = ['fetch', 'pull', 'push'].includes(action);
  const limiter = isNetworkAction ? networkLimit : gitLimit;

  try {
    // Use per-repo lock to prevent concurrent writes on the same repo
    const result = await withRepoLock(repoPath, () => limiter(async () => {
      const git = simpleGit(repoPath);
      if (action === 'fetch') {
        await git.fetch();
      } else if (action === 'pull') {
        await git.pull();
      } else if (action === 'push') {
        await git.push();
      } else if (action === 'stash') {
        await git.stash(['save', 'GitManage UI Stash']);
      } else if (action === 'pop') {
        await git.stash(['pop']);
      } else {
        throw new Error('Invalid action');
      }

      // Invalidate cache after write operation
      invalidateCache(repoPath);

      // After action, grab fresh info (skip cache)
      const info = await getRepoInfo(repoPath, workspace, { skipCache: true });
      return { message: `Successfully executed ${action}`, repo: info };
    }));

    res.json(result);
  } catch (err) {
    console.error(`[${action}] failed on ${repoPath}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/search - Global cross-repo search
app.post('/api/search', async (req, res) => {
  const { paths, query, options } = req.body;
  if (!paths || !Array.isArray(paths) || !query) {
    return res.status(400).json({ error: 'Missing paths array or query string' });
  }

  const results = [];
  await Promise.all(paths.map(async (repoPath) => {
    return gitLimit(async () => {
      try {
        const git = simpleGit(repoPath);
        const args = ['grep', '-n', '-I'];
        if (options?.ignoreCase) args.push('-i');
        if (options?.isRegex) args.push('-E');
        if (options?.wholeWord) args.push('-w');
        args.push('--', query);

        // Use raw execution
        const out = await git.raw(args).catch(err => {
          // If exit code is 1, git grep found nothing
          if (err.message && err.message.includes('Command failed')) return '';
          throw err;
        });

        if (!out || !out.trim()) return;

        const lines = out.trim().split('\n');
        const matches = [];

        for (const line of lines) {
          const firstColon = line.indexOf(':');
          if (firstColon === -1) continue;
          const secondColon = line.indexOf(':', firstColon + 1);
          if (secondColon === -1) continue;

          matches.push({
            file: line.substring(0, firstColon),
            line: parseInt(line.substring(firstColon + 1, secondColon), 10),
            content: line.substring(secondColon + 1)
          });
        }

        if (matches.length > 0) {
          results.push({
            repo: path.basename(repoPath),
            path: repoPath,
            matches
          });
        }
      } catch (err) {
        console.error(`Search failed in ${repoPath}:`, err.message);
      }
    });
  }));

  res.json(results);
});

// GET /api/repo/graph - Get git log for visualization
app.get('/api/repo/graph', async (req, res) => {
  const repoPath = req.query.path;
  const count = parseInt(req.query.count) || 100;
  if (!repoPath) return res.status(400).json({ error: 'Missing path' });

  try {
    const git = simpleGit(repoPath);
    const log = await git.log({
      format: {
        hash: '%h',
        parents: '%p',
        author_name: '%an',
        date: '%ai',
        message: '%s',
        refs: '%D'
      },
      '--all': null,
      '--date-order': null,
      n: count,
    });
    res.json(log.all);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get graph data', detail: err.message });
  }
});

// GET /api/repo/diff - Get status
app.get('/api/repo/diff', async (req, res) => {
  const repoPath = req.query.path;
  if (!repoPath) return res.status(400).json({ error: 'Missing path' });
  try {
    const git = simpleGit(repoPath);
    const status = await git.status();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get diff', detail: err.message });
  }
});

// POST /api/repo/commit - Commit changes (with repo lock)
app.post('/api/repo/commit', async (req, res) => {
  const { path: repoPath, message, workspace } = req.body;
  if (!repoPath || !message) return res.status(400).json({ error: 'Missing path or message' });
  try {
    const result = await withRepoLock(repoPath, () => gitLimit(async () => {
      const git = simpleGit(repoPath);
      await git.add('.');
      await git.commit(message);
      invalidateCache(repoPath);
      const info = await getRepoInfo(repoPath, workspace, { skipCache: true });
      return { message: 'Committed successfully', repo: info };
    }));
    res.json(result);
  } catch (err) {
    console.error('Commit error:', err);
    res.status(500).json({ error: 'Failed to commit', detail: err.message });
  }
});

// GET /api/repo/branches - List all local branches for a repo
app.get('/api/repo/branches', async (req, res) => {
  const repoPath = req.query.path;
  if (!repoPath) return res.status(400).json({ error: 'Missing path' });
  try {
    const git = simpleGit(repoPath);
    const summary = await git.branchLocal();
    res.json(summary.all);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list branches', detail: err.message });
  }
});

// POST /api/repo/checkout - Checkout a branch (with repo lock)
app.post('/api/repo/checkout', async (req, res) => {
  const { path: repoPath, workspace, branch } = req.body;
  if (!repoPath || !branch) return res.status(400).json({ error: 'Missing path or branch' });
  try {
    const result = await withRepoLock(repoPath, () => gitLimit(async () => {
      const git = simpleGit(repoPath);
      await git.checkout(branch);
      invalidateCache(repoPath);
      const info = await getRepoInfo(repoPath, workspace, { skipCache: true });
      return { message: `Checked out ${branch}`, repo: info };
    }));
    res.json(result);
  } catch (err) {
    console.error(`Checkout failed on ${repoPath}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/commits/timeline - Get recent commits from specified repos (with concurrency limit)
app.post('/api/commits/timeline', async (req, res) => {
  const { paths } = req.body;
  if (!Array.isArray(paths)) return res.status(400).json({ error: 'Missing paths array' });

  try {
    const promises = paths.map((repoPath) => gitLimit(async () => {
      try {
        const git = simpleGit(repoPath);
        const log = await git.log({ maxCount: 5 });
        return log.all.map(commit => ({
          ...commit,
          repoPath,
          repoName: path.basename(repoPath)
        }));
      } catch {
        return [];
      }
    }));

    const results = await Promise.all(promises);
    const flattened = results.flat();

    // Sort descending by date
    flattened.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Return top 50
    res.json(flattened.slice(0, 50));
  } catch (err) {
    res.status(500).json({ error: 'Failed to build timeline', detail: err.message });
  }
});

// GET /api/repos - Get info of all tracked repos
app.get('/api/repos', async (req, res) => {
  try {
    const config = loadConfig();
    const targetWs = req.query.workspace;

    const reposToProcess = targetWs
      ? config.repos.filter(r => r.workspace === targetWs)
      : config.repos;

    if (reposToProcess.length === 0) {
      return res.json([]);
    }

    const forceRefresh = req.query.force === 'true';

    // Get info in parallel (internally limited by gitLimit)
    const promises = reposToProcess.map(async (r) => {
      try {
        return await getRepoInfo(r.path, r.workspace, { skipCache: forceRefresh });
      } catch (err) {
        console.error(`Failed to get info for ${r.path}:`, err.message);
        return null; // Ignore errors, it will just drop the repo or we can return error entry
      }
    });

    const results = await Promise.all(promises);
    const validResults = results.filter(Boolean);

    res.json(validResults);
  } catch (err) {
    console.error('Failed to get repositories:', err);
    res.status(500).json({ error: 'Failed to get repositories', detail: err.message });
  }
});

// --- Start Server ---
app.listen(PORT, () => {
  const config = loadConfig();
  console.log(`🚀 GitManage server running at http://localhost:${PORT}`);
  console.log(`📂 Tracked Repos: ${config.repos?.length || 0} configured`);
  console.log(`⚡ Git concurrency: ${GIT_CONCURRENCY} local / ${NETWORK_CONCURRENCY} network`);
  console.log(`💾 Cache TTL: ${CACHE_TTL_MS / 1000}s`);
});
