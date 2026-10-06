const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'docs', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// 1. UPDATE renderProblems FUNCTION
const renderProblemsStartMarker = 'function renderProblems(filter = currentProblemFilter) {';
const renderProblemsEndMarker = 'function loadMoreProblems() {';

const rStart = html.indexOf(renderProblemsStartMarker);
const rEnd = html.indexOf(renderProblemsEndMarker);

if (rStart === -1 || rEnd === -1) {
  console.error("Could not find renderProblems function in index.html");
  process.exit(1);
}

const newRenderProblemsFunction = `function renderProblems(filter = currentProblemFilter) {
      const grid = document.getElementById('problems-grid');
      if (!grid || !appData || !appData.problems) return;

      if (!currentAuth) {
        grid.innerHTML = \`
          <div class="col-span-full p-12 text-center bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
            <div class="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-2xl">🔒</div>
            <div class="space-y-1">
              <div class="font-bold text-white text-base">Kho Bài Tập Được Bảo Mật</div>
              <p class="text-xs text-slate-400">Vui lòng đăng nhập bằng Mã PIN để truy cập danh sách bài tập.</p>
            </div>
            <button onclick="showAuthModal()" class="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/25 cursor-pointer">
              🔑 Đăng Nhập Bằng Mã PIN →
            </button>
          </div>
        \`;
        return;
      }
      grid.innerHTML = '';

      const totalStudents = (appData.students || []).length;
      const searchInput = document.getElementById('prob-search-input');
      const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

      const filteredList = appData.problems.filter(p => {
        const plat = getPlatformName(p.platform);
        const matchPlat = (filter === 'all' || plat === filter);
        if (!matchPlat) return false;

        // Class filter
        if (currentProblemClassFilter !== 'all') {
          const pClasses = p.classes || [];
          if (currentProblemClassFilter === 'Public') {
            if (!pClasses.includes('Public') && !pClasses.includes('Tất cả') && pClasses.length > 0) return false;
          } else {
            const matches = pClasses.includes(currentProblemClassFilter) || pClasses.includes('Tất cả');
            if (!matches) return false;
          }
        }

        // Search query
        if (query) {
          const matchQuery = (p.name && p.name.toLowerCase().includes(query)) ||
            (p.id && p.id.toLowerCase().includes(query)) ||
            (p.category && p.category.toLowerCase().includes(query)) ||
            (p.difficulty && p.difficulty.toLowerCase().includes(query)) ||
            (p.types && p.types.some(t => t.toLowerCase().includes(query)));
          if (!matchQuery) return false;
        }

        return canViewItem(p);
      });

      const countBadge = document.getElementById('prob-count-badge');
      if (countBadge) {
        countBadge.innerHTML = \`<span class="text-slate-400 font-mono">Hiển thị <span class="text-indigo-400 font-bold">\${Math.min(filteredList.length, currentProblemDisplayLimit)}</span> / <span class="text-slate-300 font-bold">\${filteredList.length}</span> bài DMOJ</span>\`;
      }

      if (filteredList.length === 0) {
        grid.innerHTML = \`
          <div class="col-span-full p-12 text-center text-slate-500 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
            <div class="text-4xl">🔍</div>
            <div class="text-sm font-bold text-slate-300">Không tìm thấy bài tập phù hợp</div>
            <p class="text-xs text-slate-400 max-w-md mx-auto">Vui lòng thử tìm kiếm với từ khóa khác hoặc chuyển sang bộ lọc lớp khác.</p>
          </div>
        \`;
        return;
      }

      const itemsToRender = filteredList.slice(0, currentProblemDisplayLimit);
      itemsToRender.forEach(p => {
        const card = document.createElement('div');
        card.className = "bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition group shadow-lg";
        
        const plat = getPlatformName(p.platform);
        let platBadge = "";
        if (plat === "Codeforces") {
          platBadge = \`<span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1"><span>🔵</span> CF</span>\`;
        } else if (plat === "VJudge") {
          platBadge = \`<span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1"><span>🟢</span> VJ</span>\`;
        } else if (plat === "DeruckOJ" || p.platform === "DeruckOJ") {
          platBadge = \`<span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1"><span>⚡</span> DMOJ</span>\`;
        } else if (plat === "ChuyenTinPro") {
          platBadge = \`<span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-teal-500/15 text-teal-300 border border-teal-500/30 flex items-center gap-1"><span>🌐</span> ChuyênTin</span>\`;
        } else if (plat === "ClueOJ") {
          platBadge = \`<span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1"><span>🧩</span> Clue</span>\`;
        } else {
          platBadge = \`<span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1"><span>🟣</span> Marisa</span>\`;
        }

        const pointsBadge = \`<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-0.5">★ \${p.points || 10}p</span>\`;

        const solvedCount = (appData.students || []).filter(s => s.solved && s.solved.includes(p.id)).length;

        // Check if student has submitted
        let mySubBadge = '';
        if (currentAuth && appData.submissions) {
          const mySub = (typeof findStudentSubmission === 'function')
            ? findStudentSubmission(appData.submissions, p.id, currentAuth)
            : appData.submissions.find(s => s.problem_id === p.id && (s.student_id === currentAuth.pin || s.student_name === currentAuth.name));
          if (mySub) {
            if (mySub.status === 'Chấm đạt' || mySub.status === 'Hoàn thành') {
              mySubBadge = \`<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">✅ \${mySub.score ? \`\${mySub.score}/10 \` : ''}AC</span>\`;
            } else if (mySub.score !== undefined && mySub.score !== '') {
              mySubBadge = \`<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">\${mySub.score}/10</span>\`;
            } else if (mySub.status === 'Cần sửa') {
              mySubBadge = \`<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">⚠️ Cần sửa</span>\`;
            } else {
              mySubBadge = \`<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">📨 \${mySub.status || 'Đã nộp'}</span>\`;
            }
          }
        }

        // Admin action buttons on card (compact)
        const adminCardActions = (currentAuth && (currentAuth.role === 'admin' || currentAuth.role === 'teacher')) ? \`
          <div class="flex items-center gap-1">
            <button onclick="openEditProblemModal('\${p.id}')" class="p-1 rounded-lg text-xs text-indigo-300 hover:text-white bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 transition" title="Sửa bài">✏️</button>
            <button onclick="deleteProblem('\${p.id}')" class="p-1 rounded-lg text-xs text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/30 border border-rose-500/30 transition" title="Xóa bài">🗑️</button>
          </div>
        \` : '';

        // Type tags
        const typesList = p.types || [p.category || 'Cơ bản'];
        const typesHtml = typesList.slice(0, 3).map(t => 
          \`<span class="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-950 text-slate-300 border border-slate-800">\${t}</span>\`
        ).join(' ');

        card.innerHTML = \`
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="font-mono text-xs font-bold text-slate-300">\${p.id}</span>
                \${pointsBadge}
              </div>
              <div class="flex items-center gap-1.5">
                \${platBadge}
                \${adminCardActions}
              </div>
            </div>

            <h3 class="text-base font-bold text-white group-hover:text-indigo-300 transition leading-snug cursor-pointer" onclick="openJudgeWithProblem('\${p.id}')">
              \${p.name}
            </h3>

            <div class="flex items-center gap-2 text-[11px] font-mono text-slate-400">
              <span>⏱️ \${p.time_limit || '1.0s'}</span>
              <span>•</span>
              <span>💾 \${p.memory_limit || '256M'}</span>
            </div>

            <div class="flex items-center gap-1.5 flex-wrap pt-0.5">
              \${typesHtml}
            </div>
          </div>

          <!-- Footer: 1 Clean Action Button -->
          <div class="mt-4 pt-3.5 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2">
            <div class="flex items-center gap-2">
              <div class="text-[11px] text-slate-400 font-mono">
                AC: <span class="text-emerald-400 font-bold">\${solvedCount}/\${totalStudents}</span>
              </div>
              \${mySubBadge}
            </div>

            <div class="flex items-center gap-2">
              \${(p.url && !p.url.startsWith('#judge')) ? \`
                <a href="\${p.url}" target="_blank" class="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs transition shadow" title="Xem đề bài gốc trên \${plat}">
                  ↗
                </a>
              \` : ''}
              <button onclick="openJudgeWithProblem('\${p.id}')" class="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white transition flex items-center gap-1.5 shadow-md shadow-indigo-600/25 cursor-pointer active:scale-95">
                <span>⚡</span> Giải bài
              </button>
            </div>
          </div>
        \`;
        grid.appendChild(card);
      });

      if (filteredList.length > currentProblemDisplayLimit) {
        const loadMore = document.createElement('div');
        loadMore.className = 'col-span-full text-center py-6';
        loadMore.innerHTML = \`
          <button onclick="loadMoreProblems()" class="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold transition shadow cursor-pointer">
            ⬇️ Hiển thị thêm bài tập (Đang xem \${currentProblemDisplayLimit} / \${filteredList.length} bài)
          </button>
        \`;
        grid.appendChild(loadMore);
      }
    }

    `;

html = html.slice(0, rStart) + newRenderProblemsFunction + html.slice(rEnd);

// 2. UPDATE getGraderProblems & renderJudgeWorkspace & DMOJ TAB HELPERS
const getGraderStartMarker = 'function getGraderProblems() {';
const runJudgeStartMarker = 'async function runJudgeCode() {';

const gStart = html.indexOf(getGraderStartMarker);
const gEnd = html.indexOf(runJudgeStartMarker);

if (gStart === -1 || gEnd === -1) {
  console.error("Could not find getGraderProblems or runJudgeCode in index.html");
  process.exit(1);
}

const newJudgeWorkspaceLogic = `function getGraderProblems() {
      let list = [];
      if (appData && Array.isArray(appData.problems) && appData.problems.length > 0) {
        list = appData.problems;
      } else if (appData && Array.isArray(appData.grader_problems) && appData.grader_problems.length > 0) {
        list = appData.grader_problems;
      }
      if (!currentAuth || currentAuth.role === 'admin' || currentAuth.role === 'teacher') {
        return list;
      }
      return list.filter(p => canViewItem(p));
    }

    // Math text formatting helper for DMOJ formulas
    function formatMathText(str) {
      if (!str) return '';
      return String(str)
        .replace(/\\\\le/g, '≤')
        .replace(/\\\\ge/g, '≥')
        .replace(/\\\\times/g, '×')
        .replace(/\\\\ne/g, '≠')
        .replace(/\\\\pmod\\s*([a-zA-Z0-9_]+)/g, 'mod $1')
        .replace(/\\\\dots/g, '...')
        .replace(/\\$([^\\$]+)\\$/g, '<code class="font-mono text-indigo-300 font-semibold px-1 py-0.5 bg-slate-950 rounded text-[11px]">$1</code>');
    }

    // 1-Click Copy helper
    function copyTextToClipboard(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          showLiveToast("Đã sao chép vào bộ nhớ tạm!");
        }).catch(() => {
          fallbackCopyText(text);
        });
      } else {
        fallbackCopyText(text);
      }
    }
    function fallbackCopyText(text) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        showLiveToast("Đã sao chép vào bộ nhớ tạm!");
      } catch(e) {}
      document.body.removeChild(ta);
    }

    // DMOJ Tabs Management
    let currentDmojTab = 'problem'; // 'problem' | 'submit' | 'history'
    let isDmojSplit = false;

    function switchDmojTab(tab) {
      currentDmojTab = tab;
      isDmojSplit = false;
      updateDmojTabsUI();
      if (tab === 'history') {
        renderJudgeSubmissionHistory();
      }
    }

    function toggleDmojSplitView() {
      isDmojSplit = !isDmojSplit;
      updateDmojTabsUI();
    }

    function updateDmojTabsUI() {
      const btnProb = document.getElementById('dmoj-tab-problem');
      const btnSub = document.getElementById('dmoj-tab-submit');
      const btnHist = document.getElementById('dmoj-tab-history');
      const btnSplit = document.getElementById('dmoj-btn-split');
      const splitText = document.getElementById('dmoj-split-text');

      const colProb = document.getElementById('dmoj-col-problem');
      const colSub = document.getElementById('dmoj-col-submit');
      const colHist = document.getElementById('dmoj-col-history');

      if (!colProb || !colSub || !colHist) return;

      if (isDmojSplit) {
        // Split view mode: Side-by-side
        if (splitText) splitText.textContent = "Thoát xem song song";
        if (btnSplit) btnSplit.className = "hidden lg:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 border border-indigo-500 shadow-md transition cursor-pointer";

        colProb.className = "lg:col-span-5 space-y-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl block";
        colSub.className = "lg:col-span-7 space-y-5 block";
        colHist.className = "lg:col-span-12 space-y-4 hidden";
        return;
      }

      // Normal tabbed mode
      if (splitText) splitText.textContent = "Xem Song Song (IDE)";
      if (btnSplit) btnSplit.className = "hidden lg:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition cursor-pointer";

      const activeClass = "px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold transition flex items-center gap-1.5 shadow";
      const inactiveClass = "px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition flex items-center gap-1.5";

      if (btnProb) btnProb.className = (currentDmojTab === 'problem') ? activeClass : inactiveClass;
      if (btnSub) btnSub.className = (currentDmojTab === 'submit') ? activeClass : inactiveClass;
      if (btnHist) btnHist.className = (currentDmojTab === 'history') ? activeClass : inactiveClass;

      if (currentDmojTab === 'problem') {
        colProb.className = "lg:col-span-12 space-y-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl block";
        colSub.className = "lg:col-span-12 space-y-5 hidden";
        colHist.className = "lg:col-span-12 space-y-4 hidden";
      } else if (currentDmojTab === 'submit') {
        colProb.className = "lg:col-span-12 space-y-5 hidden";
        colSub.className = "lg:col-span-12 space-y-5 block";
        colHist.className = "lg:col-span-12 space-y-4 hidden";
      } else if (currentDmojTab === 'history') {
        colProb.className = "lg:col-span-12 space-y-5 hidden";
        colSub.className = "lg:col-span-12 space-y-5 hidden";
        colHist.className = "lg:col-span-12 space-y-4 block";
      }
    }

    // Multi-judge pool configuration (Load balancing & automatic failover)
    let judgeMode = 'auto'; // 'auto' | 'judge0' | 'wandbox' | 'local'
    let judgeRoundRobinCounter = 0;

    const JUDGE_SERVERS = {
      judge0: {
        id: 'judge0',
        name: '26TinyLove',
        fullName: '26TinyLove Judge0 (Cloud C++20 / Py3)',
        url: 'https://judge.26tinylove.com',
        available: true,
        failCount: 0,
        cooldownUntil: 0
      },
      wandbox: {
        id: 'wandbox',
        name: 'Wandbox',
        fullName: 'Wandbox Cloud (GCC 14 / Py 3.12)',
        url: 'https://wandbox.org',
        available: true,
        failCount: 0,
        cooldownUntil: 0
      },
      local: {
        id: 'local',
        name: 'Local Judge',
        fullName: 'Local Judge Siêu Tốc (MinGW & Python)',
        url: 'http://127.0.0.1:8080',
        available: false,
        failCount: 0,
        cooldownUntil: 0
      }
    };

    function updateJudgeEngineUI() {
      const enginePill = document.getElementById('judge-engine-pill');
      const engineText = document.getElementById('judge-engine-text');
      const optLocal = document.getElementById('opt-local-judge');

      if (optLocal) {
        if (JUDGE_SERVERS.local.available) {
          optLocal.classList.remove('hidden');
        } else {
          optLocal.classList.add('hidden');
        }
      }

      if (!enginePill || !engineText) return;

      if (judgeMode === 'judge0') {
        enginePill.className = "px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 flex items-center gap-2 shadow-inner";
        engineText.innerHTML = '<span class="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span> <span>26TinyLove Judge0</span>';
        return;
      }
      if (judgeMode === 'wandbox') {
        enginePill.className = "px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-2 shadow-inner";
        engineText.innerHTML = '<span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span> <span>Wandbox Cloud</span>';
        return;
      }
      if (judgeMode === 'local') {
        enginePill.className = "px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 flex items-center gap-2 shadow-inner";
        engineText.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> <span>Local Judge Siêu Tốc</span>';
        return;
      }

      const activeList = [];
      if (JUDGE_SERVERS.local.available) activeList.push('Local');
      if (JUDGE_SERVERS.judge0.available) activeList.push('26TinyLove');
      if (JUDGE_SERVERS.wandbox.available) activeList.push('Wandbox');

      if (JUDGE_SERVERS.local.available) {
        enginePill.className = "px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 flex items-center gap-2 shadow-inner";
        engineText.innerHTML = \`<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> <span>Luân Phiên (\${activeList.join(' + ')})</span>\`;
      } else if (JUDGE_SERVERS.judge0.available && JUDGE_SERVERS.wandbox.available) {
        enginePill.className = "px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 flex items-center gap-2 shadow-inner";
        engineText.innerHTML = '<span class="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span> <span>Luân Phiên (26TinyLove + Wandbox)</span>';
      } else if (JUDGE_SERVERS.judge0.available) {
        enginePill.className = "px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 flex items-center gap-2 shadow-inner";
        engineText.innerHTML = '<span class="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span> <span>26TinyLove Cloud</span>';
      } else {
        enginePill.className = "px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-2 shadow-inner";
        engineText.innerHTML = '<span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span> <span>Wandbox Cloud</span>';
      }
    }

    function handleJudgeServerChange(val) {
      judgeMode = val;
      updateJudgeEngineUI();
      if (val === 'auto') {
        showLiveToast("Đã kích hoạt chế độ Luân Phiên & Tự Động Dự Phòng (Round-Robin)!");
      } else {
        const srv = JUDGE_SERVERS[val];
        showLiveToast(\`Đã cố định máy chấm: \${srv ? srv.name : val}\`);
      }
    }

    async function checkJudgeServersHealth() {
      try {
        const resp = await fetch('http://127.0.0.1:8080/health', {
          signal: AbortSignal.timeout(1200)
        });
        if (resp.ok) {
          const data = await resp.json();
          JUDGE_SERVERS.local.available = (data && data.status === 'ok');
          localJudgeAvailable = JUDGE_SERVERS.local.available;
        } else {
          JUDGE_SERVERS.local.available = false;
          localJudgeAvailable = false;
        }
      } catch (e) {
        JUDGE_SERVERS.local.available = false;
        localJudgeAvailable = false;
      }

      try {
        const j0Resp = await fetch('https://judge.26tinylove.com/about', {
          signal: AbortSignal.timeout(2500)
        });
        if (j0Resp.ok) {
          JUDGE_SERVERS.judge0.available = true;
          JUDGE_SERVERS.judge0.failCount = 0;
        }
      } catch (e) {
        if (JUDGE_SERVERS.judge0.failCount > 2) {
          JUDGE_SERVERS.judge0.available = false;
        }
      }

      updateJudgeEngineUI();
      return true;
    }
    const checkLocalJudgeHealth = checkJudgeServersHealth;

    function renderJudgeWorkspace() {
      checkLocalJudgeHealth();
      const graderProbs = getGraderProblems();
      
      const countEl = document.getElementById('judge-problems-count');
      if (countEl) countEl.textContent = \`\${graderProbs.length} bài DMOJ\`;

      // Render problem selector carousel pills
      const selector = document.getElementById('judge-problem-selector');
      if (selector) {
        selector.innerHTML = '';
        if (graderProbs.length === 0) {
          selector.innerHTML = '<span class="text-xs text-slate-500 italic">Chưa có bài tập nào.</span>';
        } else {
          graderProbs.forEach(p => {
            const btn = document.createElement('button');
            const isSelected = (p.id === currentJudgeProbId);
            
            let isSolved = false;
            if (currentAuth && currentAuth.role === 'student' && appData && appData.students) {
              const me = appData.students.find(s => s.name === currentAuth.name);
              if (me && me.solved && me.solved.includes(p.id)) isSolved = true;
            }

            btn.onclick = () => selectJudgeProblem(p.id);
            btn.className = \`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold whitespace-nowrap flex items-center gap-1.5 transition cursor-pointer border \${
              isSelected 
                ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30' 
                : 'bg-slate-950/70 hover:bg-slate-800 text-slate-300 border-slate-800'
            }\`;
            btn.innerHTML = \`
              <span>\${isSolved ? '✅' : '⚡'}</span>
              <span class="font-bold">\${p.id}</span>
              <span class="text-[10px] text-amber-300 font-mono">★ \${p.points || 10}p</span>
              <span class="text-[10px] opacity-75 font-sans hidden sm:inline">\${p.name.length > 18 ? p.name.slice(0, 16) + '...' : p.name}</span>
            \`;
            selector.appendChild(btn);
          });
        }
      }

      // Load active problem
      let prob = graderProbs.find(p => p.id === currentJudgeProbId);
      if (!prob && graderProbs.length > 0) {
        prob = graderProbs[0];
        currentJudgeProbId = prob.id;
      }

      if (!prob) return;

      // Update DMOJ Meta & Header Details
      const idEl = document.getElementById('judge-prob-id');
      const nameEl = document.getElementById('judge-prob-name');
      const pointsEl = document.getElementById('judge-prob-points-badge');
      const timeEl = document.getElementById('judge-prob-time');
      const memEl = document.getElementById('judge-prob-mem');
      const authorEl = document.getElementById('judge-prob-author');
      const statusBadge = document.getElementById('judge-prob-status-badge');
      const typesContainer = document.getElementById('judge-prob-types-container');
      const descEl = document.getElementById('judge-prob-desc');
      const inputEl = document.getElementById('judge-prob-input');
      const outputEl = document.getElementById('judge-prob-output');
      const constrEl = document.getElementById('judge-prob-constraints');
      const constrWrapper = document.getElementById('judge-constraints-wrapper');

      if (idEl) idEl.textContent = prob.id;
      if (nameEl) nameEl.textContent = prob.name;
      if (pointsEl) pointsEl.textContent = \`★ \${prob.points || 10} Điểm\`;
      if (timeEl) timeEl.textContent = \`⏱️ \${prob.time_limit || '1.0s'}\`;
      if (memEl) memEl.textContent = \`💾 \${prob.memory_limit || '256M'}\`;
      if (authorEl) authorEl.textContent = \`👤 \${prob.author || 'DMOJ / Thầy Phùng Đức'}\`;

      if (typesContainer) {
        const typesList = prob.types || [prob.category || 'Cơ bản'];
        typesContainer.innerHTML = \`<span class="text-xs text-slate-400">Dạng bài:</span> \` +
          typesList.map(t => \`<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">\${t}</span>\`).join(' ');
      }

      // Solved badge
      if (statusBadge) {
        let isSolved = false;
        if (currentAuth && currentAuth.role === 'student' && appData && appData.students) {
          const me = appData.students.find(s => s.name === currentAuth.name);
          if (me && me.solved && me.solved.includes(prob.id)) isSolved = true;
        }
        if (isSolved) {
          statusBadge.className = "px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
          statusBadge.textContent = "✅ Đã Hoàn Thành (AC)";
        } else {
          statusBadge.className = "px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700";
          statusBadge.textContent = "Chưa nộp";
        }
      }

      if (descEl) descEl.innerHTML = formatMathText(prob.description || 'Đang cập nhật đề bài...');
      if (inputEl) inputEl.innerHTML = formatMathText(prob.input_specification || prob.input_format || 'Dữ liệu đầu vào theo chuẩn bài toán.');
      if (outputEl) outputEl.innerHTML = formatMathText(prob.output_specification || prob.output_format || 'In kết quả ra màn hình chuẩn (stdout).');

      if (constrEl && constrWrapper) {
        if (prob.constraints) {
          constrWrapper.classList.remove('hidden');
          constrEl.innerHTML = formatMathText(prob.constraints);
        } else {
          constrWrapper.classList.add('hidden');
        }
      }

      // DMOJ Sample Cases
      const sampleContainer = document.getElementById('judge-sample-tests-container');
      if (sampleContainer) {
        sampleContainer.innerHTML = '';
        const samples = (prob.sample_cases && prob.sample_cases.length > 0)
          ? prob.sample_cases
          : ((prob.testcases || []).filter(t => t.sample).length > 0 ? (prob.testcases || []).filter(t => t.sample) : (prob.testcases || []).slice(0, 2));

        if (samples.length === 0) {
          sampleContainer.innerHTML = '<div class="text-xs text-slate-500 italic p-3 bg-slate-950/60 rounded-xl">Chưa có bộ test ví dụ.</div>';
        } else {
          samples.forEach((tc, idx) => {
            const card = document.createElement('div');
            card.className = "bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs font-mono shadow-inner";
            card.innerHTML = \`
              <div class="flex items-center justify-between text-slate-400 text-[11px] font-sans font-bold">
                <span class="text-indigo-300 flex items-center gap-1.5"><span>🧪</span> Ví dụ #\${idx + 1}</span>
                <span class="text-[10px] text-emerald-400 font-mono">Test công khai</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div class="space-y-1">
                  <div class="flex items-center justify-between text-[10px] text-slate-400">
                    <span class="font-bold text-indigo-400">Input:</span>
                    <button type="button" onclick="copyTextToClipboard(\${JSON.stringify(tc.input)})" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white transition text-[10px] cursor-pointer">Sao chép</button>
                  </div>
                  <pre class="bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-slate-200 overflow-x-auto whitespace-pre-wrap">\${escapeHtml(tc.input)}</pre>
                </div>
                <div class="space-y-1">
                  <div class="flex items-center justify-between text-[10px] text-slate-400">
                    <span class="font-bold text-emerald-400">Output:</span>
                    <button type="button" onclick="copyTextToClipboard(\${JSON.stringify(tc.output)})" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 hover:text-white transition text-[10px] cursor-pointer">Sao chép</button>
                  </div>
                  <pre class="bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-emerald-300 overflow-x-auto whitespace-pre-wrap">\${escapeHtml(tc.output)}</pre>
                </div>
              </div>
              \${tc.explanation ? \`
                <div class="text-[11px] text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 font-sans">
                  <span class="text-amber-300 font-bold">💡 Giải thích:</span> \${formatMathText(tc.explanation)}
                </div>
              \` : ''}
            \`;
            sampleContainer.appendChild(card);
          });
        }
      }

      // Teacher quick box toggle
      const teacherBox = document.getElementById('judge-teacher-quickbox');
      if (teacherBox) {
        if (currentAuth && (currentAuth.role === 'admin' || currentAuth.role === 'teacher')) {
          teacherBox.classList.remove('hidden');
        } else {
          teacherBox.classList.add('hidden');
        }
      }

      // Update Language Switcher UI & Load code
      updateJudgeLangUI();

      const codeEditor = document.getElementById('judge-code-editor');
      if (codeEditor) {
        const savedCode = localStorage.getItem(\`deruck_code_\${currentJudgeProbId}_\${currentJudgeLang}\`);
        if (savedCode !== null) {
          codeEditor.value = savedCode;
        } else {
          codeEditor.value = getStarterTemplate(currentJudgeProbId, currentJudgeLang);
        }
      }

      // Reset Input / Output for current problem
      const customInputEl = document.getElementById('judge-custom-input');
      if (customInputEl) {
        const tests = (prob.testcases && prob.testcases.length > 0) ? prob.testcases : (prob.sample_cases || []);
        if (tests.length > 0) {
          customInputEl.value = tests[0].input || '';
        } else {
          customInputEl.value = '';
        }
      }
      const resStdout = document.getElementById('judge-custom-run-stdout');
      if (resStdout) {
        resStdout.className = "w-full h-full min-h-[76px] bg-slate-900 border border-slate-700 rounded-xl p-2.5 font-mono text-xs text-slate-400 whitespace-pre-wrap overflow-y-auto max-h-36";
        resStdout.textContent = 'Bấm "▶️ Chạy Thử (Sample)" để xem kết quả xuất ra màn hình tại đây.';
      }
      const resMeta = document.getElementById('judge-custom-run-meta');
      if (resMeta) {
        resMeta.className = "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400";
        resMeta.textContent = "Chưa chạy";
      }
      const resStderrBox = document.getElementById('judge-custom-run-stderr-box');
      if (resStderrBox) resStderrBox.classList.add('hidden');

      updateDmojTabsUI();
      renderJudgeSubmissionHistory();
    }

    function resetInputToSample() {
      const prob = getGraderProblems().find(p => p.id === currentJudgeProbId);
      const customInputEl = document.getElementById('judge-custom-input');
      if (customInputEl && prob) {
        const tests = (prob.testcases && prob.testcases.length > 0) ? prob.testcases : (prob.sample_cases || []);
        if (tests.length > 0) {
          customInputEl.value = tests[0].input || '';
          showLiveToast("Đã nạp lại dữ liệu ví dụ của bài!");
        } else {
          customInputEl.value = '';
        }
      }
    }

    function selectJudgeProblem(probId) {
      saveCurrentJudgeCodeToLocal();
      currentJudgeProbId = probId;
      renderJudgeWorkspace();
    }

    function openJudgeWithProblem(probId) {
      currentJudgeProbId = probId;
      switchTab('problems');
      toggleProblemViewMode('judge');
      switchDmojTab('problem');
      setTimeout(() => {
        selectJudgeProblem(probId);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 50);
    }

    function saveCurrentJudgeCodeToLocal() {
      const codeEditor = document.getElementById('judge-code-editor');
      if (codeEditor && currentJudgeProbId) {
        localStorage.setItem(\`deruck_code_\${currentJudgeProbId}_\${currentJudgeLang}\`, codeEditor.value);
      }
    }

    function setJudgeLanguage(lang) {
      if (currentJudgeLang === lang) return;
      saveCurrentJudgeCodeToLocal();
      currentJudgeLang = lang;
      updateJudgeLangUI();

      const codeEditor = document.getElementById('judge-code-editor');
      if (codeEditor) {
        const savedCode = localStorage.getItem(\`deruck_code_\${currentJudgeProbId}_\${currentJudgeLang}\`);
        if (savedCode !== null) {
          codeEditor.value = savedCode;
        } else {
          codeEditor.value = getStarterTemplate(currentJudgeProbId, currentJudgeLang);
        }
      }
      showLiveToast(\`Đã chuyển sang \${lang === 'cpp' ? 'C++20' : 'Python 3'}\`);
    }

    function updateJudgeLangUI() {
      const btnCpp = document.getElementById('btn-lang-cpp');
      const btnPy = document.getElementById('btn-lang-python');
      const langInfo = document.getElementById('judge-lang-info');
      const codeEditor = document.getElementById('judge-code-editor');
      const statusEl = document.getElementById('judge-editor-status');

      if (currentJudgeLang === 'cpp') {
        if (btnCpp) {
          btnCpp.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer bg-blue-600 text-white shadow-md shadow-blue-500/25 border border-blue-400/40";
        }
        if (btnPy) {
          btnPy.className = "px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer bg-slate-900 text-slate-400 hover:text-slate-200 border border-transparent";
        }
        if (langInfo) {
          langInfo.className = "text-[11px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20";
          langInfo.textContent = "g++ 13 / C++20 (O2)";
        }
        if (codeEditor) {
          codeEditor.placeholder = "// Viết code C++ tại đây...";
        }
        if (statusEl) {
          statusEl.textContent = "C++20 (Tối ưu -O2)";
        }
      } else {
        if (btnCpp) {
          btnCpp.className = "px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer bg-slate-900 text-slate-400 hover:text-slate-200 border border-transparent";
        }
        if (btnPy) {
          btnPy.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer bg-emerald-600 text-white shadow-md shadow-emerald-500/25 border border-emerald-400/40";
        }
        if (langInfo) {
          langInfo.className = "text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20";
          langInfo.textContent = "Python 3.12 (Bù x2.0s)";
        }
        if (codeEditor) {
          codeEditor.placeholder = "# Viết code Python tại đây...";
        }
        if (statusEl) {
          statusEl.textContent = "Python 3 (Tự động bù thời gian)";
        }
      }
    }

    function getStarterTemplate(probId, lang) {
      return "";
    }

    `;

html = html.slice(0, gStart) + newJudgeWorkspaceLogic + html.slice(gEnd);

fs.writeFileSync(indexPath, html, 'utf8');
console.log("Successfully updated JavaScript DMOJ functions and renderProblems in docs/index.html!");
