function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    let appData = { students: [], problems: [], submissions: [] };
    let currentStudent = null;
    let currentStudentWeekFilter = 'all';

    function setStudentWeekFilter(weekVal) {
      currentStudentWeekFilter = weekVal;
      if (currentStudent) {
        renderHomeworkChecklist(currentStudent);
      }
    }

    async function initStudentPage() {
      // Kiểm tra trạng thái xác thực người dùng trước tiên
      const isAuthed = checkAuthSession();

      try {
        const response = await fetch('data.json?v=' + Date.now());
        if (response.ok) {
          appData = (await response.json()) || { students: [], problems: [], submissions: [] };
        }
      } catch (e) {
        console.error("Could not fetch data.json", e);
      }

      // 1. Tải dữ liệu học sinh, bài nộp & bài tập theo tuần trực tiếp từ Firebase Realtime Database
      if (typeof fetchStudentsFromFirebase === 'function' && isFirebaseConfigured()) {
        try {
          const fbStudents = await fetchStudentsFromFirebase();
          if (fbStudents && fbStudents.length > 0) {
            if (!appData) appData = {};
            appData.students = fbStudents;
            try { localStorage.setItem('cp_cached_students', JSON.stringify(fbStudents)); } catch(e) {}
          }
          const fbSubs = await fetchSubmissionsFromFirebase();
          if (fbSubs && fbSubs.length > 0) {
            const isAdminUser = Boolean(currentAuth && (currentAuth.role === 'admin' || currentAuth.role === 'teacher'));
            const incomingSubs = (typeof sanitizeSubmissionsForRole === 'function')
              ? sanitizeSubmissionsForRole(fbSubs, isAdminUser)
              : fbSubs;
            appData.submissions = typeof mergeSubmissionCollections === 'function'
              ? mergeSubmissionCollections(appData.submissions || [], incomingSubs)
              : incomingSubs;
            if (typeof archiveSubmissionsLocally === 'function') {
              archiveSubmissionsLocally(appData.submissions, { silent: true });
            }
            try {
              localStorage.setItem('cp_cached_submissions', JSON.stringify(appData.submissions));
            } catch(e) {}
          }
          if (typeof fetchWeeklyHomeworkFromFirebase === 'function') {
            try {
              const fbWeekly = await fetchWeeklyHomeworkFromFirebase();
              if (fbWeekly && typeof fbWeekly === 'object' && Object.keys(fbWeekly).length > 0) {
                if (!appData) appData = {};
                appData.weekly_homework = fbWeekly;
                try { localStorage.setItem('cp_cached_weekly_homework', JSON.stringify(fbWeekly)); } catch(e) {}
              }
            } catch(wErr) {
              console.warn("Could not fetch weekly homework from Firebase:", wErr);
            }
          }
        } catch(fbErr) {
          console.warn("Could not fetch students from Firebase:", fbErr);
        }
      }

      // 1b. Dự phòng: Nếu appData.submissions rỗng, tải từ bộ nhớ đệm cp_cached_submissions
      if (!appData.submissions || appData.submissions.length === 0) {
        const cachedSubs = localStorage.getItem('cp_cached_submissions');
        if (cachedSubs) {
          try {
            const parsed = JSON.parse(cachedSubs);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const isAdminUser = Boolean(currentAuth && (currentAuth.role === 'admin' || currentAuth.role === 'teacher'));
              const deruckParsed = (typeof isDeruckSubmission === 'function') ? parsed.filter(isDeruckSubmission) : parsed;
              appData.submissions = (typeof sanitizeSubmissionsForRole === 'function')
                ? sanitizeSubmissionsForRole(deruckParsed, isAdminUser)
                : deruckParsed;
            }
          } catch(e) {}
        }
      }

      if (typeof loadArchivedSubmissions === 'function' && typeof mergeSubmissionCollections === 'function') {
        const archivedSubs = await loadArchivedSubmissions();
        appData.submissions = mergeSubmissionCollections(archivedSubs, appData.submissions || []);
        try { localStorage.setItem('cp_cached_submissions', JSON.stringify(appData.submissions)); } catch(e) {}
        if (appData.submissions.length && typeof archiveSubmissionsLocally === 'function') {
          await archiveSubmissionsLocally(appData.submissions, { silent: true });
        }
      }

      // 2. Dự phòng: Tải từ bộ nhớ cache nếu Firebase chưa cấu hình URL hoặc offline
      if (!appData || !appData.students || appData.students.length === 0) {
        const cached = localStorage.getItem('cp_cached_students') || localStorage.getItem('cp_app_data');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            const list = Array.isArray(parsed) ? parsed : (parsed.students || []);
            if (list.length > 0) {
              if (!appData) appData = {};
              appData.students = list;
            }
          } catch(e) {}
        }
      }

      // 2b. Dự phòng: Tải weekly_homework từ cache
      if (appData && !appData.weekly_homework) {
        const cachedWeekly = localStorage.getItem('cp_cached_weekly_homework');
        if (cachedWeekly) {
          try {
            appData.weekly_homework = JSON.parse(cachedWeekly);
          } catch(e) {}
        }
      }

      if (!appData || !appData.students || appData.students.length === 0) {
        document.getElementById('loading-state').innerHTML = `
          <div class="text-rose-400 font-bold">Chưa kết nối Firebase hoặc chưa có dữ liệu học sinh. Vui lòng kiểm tra lại cấu hình Firebase.</div>
        `;
        return;
      }

      // Check security auth session from Cookie
      if (!isAuthed) {
        document.getElementById('loading-state').innerHTML = `
          <div class="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl space-y-4 max-w-lg mx-auto shadow-2xl">
            <div class="text-4xl">🔒</div>
            <h2 class="text-lg font-bold text-white">Nội Dung Riêng Tư Học Viên</h2>
            <p class="text-xs text-slate-400">Hệ thống bảo vệ quyền riêng tư: mỗi học sinh chỉ xem được tiến độ và thông tin của bản thân. Vui lòng đăng nhập bằng Mã PIN cá nhân.</p>
            <div class="flex items-center justify-center gap-3 pt-2">
              <button onclick="showAuthModal()" class="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/25">
                Đăng Nhập Bằng Mã PIN →
              </button>
              <a href="index.html" class="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition">
                Về Trang Chủ Giới Thiệu
              </a>
            </div>
          </div>
        `;
        document.getElementById('loading-state').classList.remove('hidden');
        document.getElementById('profile-container').classList.add('hidden');
        showAuthModal();
        return;
      }

      // Determine target student ID
      const params = new URLSearchParams(window.location.search);
      let targetId = parseInt(params.get('id'));

      // PRIVACY ENFORCEMENT: Students can ONLY view their own ID!
      if (currentAuth.role === 'student') {
        targetId = currentAuth.stt;
      } else if (!appData.students.some(s => String(s.stt) === String(targetId))) {
        targetId = appData.students[0].stt;
      }

      // Update selector if admin
      const selector = document.getElementById('student-selector');
      if (selector) selector.value = targetId;

      loadStudentProfile(targetId);

      // Start continuous background auto-refresh for newly submitted student problems
      startLiveAutoRefresh();
    }

    function switchStudent(id) {
      if (currentAuth && currentAuth.role === 'student') {
        id = currentAuth.stt; // Cannot switch to another student
      }
      window.history.pushState({}, '', `student.html?id=${id}`);
      loadStudentProfile(parseInt(id));
    }

    function loadStudentProfile(id) {
      if (!currentAuth) {
        showAuthModal();
        return;
      }

      // Privacy check: student can only view own profile
      if (currentAuth.role === 'student' && currentAuth.stt) {
        id = currentAuth.stt;
      }

      const student = appData.students.find(s => String(s.stt) === String(id));
      if (!student) return;

      currentStudent = student;
      currentStudentWeekFilter = 'all';

      document.getElementById('loading-state').classList.add('hidden');
      document.getElementById('profile-container').classList.remove('hidden');

      // Update page title
      document.title = `${student.name} • Hồ Sơ Coder & Tiến Độ Cá Nhân`;

      // Avatar initials (e.g. "LMK", "NDP")
      const initials = student.name.split(' ').map(p => p[0]).slice(-3).join('').toUpperCase();
      document.getElementById('student-avatar').textContent = initials;

      // Basic Info
      document.getElementById('student-name').textContent = student.name;
      document.getElementById('student-class').textContent = student.class || 'Tin học';

      // Compute rank within their class
      const sameClassStudents = (appData.students || []).filter(s => s.class === student.class);
      sameClassStudents.sort((a, b) => {
        const totalB = (b.stats ? b.stats.total : (b.solved ? b.solved.length : 0));
        const totalA = (a.stats ? a.stats.total : (a.solved ? a.solved.length : 0));
        if (totalB !== totalA) return totalB - totalA;
        return (b.target_solved_count || 0) - (a.target_solved_count || 0);
      });
      const classRank = sameClassStudents.findIndex(s => s.stt === student.stt) + 1;
      document.getElementById('student-rank').textContent = `#${classRank > 0 ? classRank : student.stt}`;
      document.getElementById('student-rank-desc').textContent = `Lớp ${student.class || ''} (${sameClassStudents.length} hs)`;
      document.getElementById('student-rating').textContent = student.rating !== undefined ? student.rating : 0;

      // Handles row
      const handlesContainer = document.getElementById('handles-container');
      handlesContainer.innerHTML = '';
      let handlesFound = false;

      if (student.marisa_handle) {
        handlesFound = true;
        handlesContainer.innerHTML += `
          <a href="https://marisaoj.com/user/${student.marisa_handle}/submissions" target="_blank" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 transition">
            <span>🟣</span> Marisa: <strong>${student.marisa_handle}</strong> ↗
          </a>
        `;
      }
      if (student.cf_handle) {
        handlesFound = true;
        handlesContainer.innerHTML += `
          <a href="https://codeforces.com/profile/${student.cf_handle}" target="_blank" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-300 border border-blue-500/30 hover:bg-blue-500/25 transition">
            <span>🔵</span> CF: <strong>${student.cf_handle}</strong> ↗
          </a>
        `;
      }
      if (student.vjudge_handle) {
        handlesFound = true;
        handlesContainer.innerHTML += `
          <a href="https://vjudge.net/user/${student.vjudge_handle}" target="_blank" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition">
            <span>🟢</span> VJ: <strong>${student.vjudge_handle}</strong> ↗
          </a>
        `;
      }
      if (student.vnoi_handle) {
        handlesFound = true;
        handlesContainer.innerHTML += `
          <a href="https://oj.vnoi.info/user/${student.vnoi_handle}" target="_blank" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition">
            <span>🟠</span> VNOI: <strong>${student.vnoi_handle}</strong> ↗
          </a>
        `;
      }
      if (student.clue_handle) {
        handlesFound = true;
        handlesContainer.innerHTML += `
          <a href="https://oj.clue.edu.vn/user/${student.clue_handle}" target="_blank" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition">
            <span>🔷</span> ClueOJ: <strong>${student.clue_handle}</strong> ↗
          </a>
        `;
      }
      if (student.ctoj_handle) {
        handlesFound = true;
        handlesContainer.innerHTML += `
          <a href="https://oj.chuyentin.pro/user/${student.ctoj_handle}" target="_blank" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-500/15 text-teal-300 border border-teal-500/30 hover:bg-teal-500/25 transition">
            <span>💻</span> CTOJ: <strong>${student.ctoj_handle}</strong> ↗
          </a>
        `;
      }
      if (!handlesFound) {
        handlesContainer.innerHTML = `<span class="text-slate-500 italic">(Chưa liên kết tài khoản thi đấu)</span>`;
      }

      // Stats
      const stats = student.stats || {
        week: student.target_solved_count || 0,
        month: student.total_solved_count || 0,
        year: student.total_solved_count || 0,
        total: student.solved ? student.solved.length : 0
      };

      document.getElementById('stat-week').textContent = stats.week;
      document.getElementById('stat-month').textContent = stats.month;
      document.getElementById('stat-year').textContent = stats.year;
      document.getElementById('stat-total').textContent = stats.total;

      // Homework Progress specific to student's class
      renderHomeworkChecklist(student);

      // Tuition Status (Tháng 9, 10, 11, 12)
      renderStudentTuition(student);

      // Activity Heatmap & Year Switching
      setupStudentHeatmap(student);

      // Solved Archive Table
      renderSolvedArchive(student);
    }

    function renderStudentTuition(student) {
      const section = document.getElementById('student-tuition-section');
      const grid = document.getElementById('student-tuition-grid');
      const summaryBadge = document.getElementById('student-tuition-summary-badge');
      if (!section || !grid || !summaryBadge) return;

      const months = appData.tuition_months || ['Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
      const tuitionMap = student.tuition || {};

      let paidCount = 0;
      grid.innerHTML = '';

      months.forEach(m => {
        const isPaid = Boolean(tuitionMap[m]);
        if (isPaid) paidCount++;

        const card = document.createElement('div');
        card.className = isPaid 
          ? "bg-slate-950/80 border border-emerald-500/30 rounded-xl p-3.5 flex flex-col justify-between space-y-2 shadow-sm transition hover:border-emerald-500/60"
          : "bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between space-y-2 shadow-sm transition hover:border-slate-700";

        card.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-200 font-mono tracking-wide">${m}</span>
            <span class="text-base">${isPaid ? '✅' : '⏳'}</span>
          </div>
          <div class="flex items-center justify-between pt-1">
            <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-lg border transition ${
              isPaid 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                : 'bg-slate-800 text-rose-300 border-slate-700'
            }">
              ${isPaid ? 'Đã đóng ✅' : 'Chưa đóng ⏳'}
            </span>
          </div>
        `;
        grid.appendChild(card);
      });

      const totalMonths = months.length;
      if (paidCount === totalMonths) {
        summaryBadge.className = "text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5";
        summaryBadge.innerHTML = `<span>✓</span> Hoàn thành ${paidCount}/${totalMonths} tháng`;
      } else {
        summaryBadge.className = "text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5";
        summaryBadge.innerHTML = `<span>⏳</span> Đã đóng ${paidCount}/${totalMonths} tháng`;
      }
    }

    function isProblemSolvedByStudent(pid, student, submissions) {
      if (!student) return false;
      const solvedList = student.solved || [];
      const targetSolved = student.target_solved || [];
      if (solvedList.includes(pid) || targetSolved.includes(pid)) return true;
      const sub = (typeof findStudentSubmission === 'function')
        ? findStudentSubmission(submissions || [], pid, student)
        : (submissions || []).find(s => s.problem_id === pid && (s.student_name === student.name || (s.student_id && s.student_id == student.stt)));
      if (sub && (sub.status === 'Chấm đạt' || sub.status === 'Hoàn thành' || (typeof sub.score === 'number' && sub.score >= 8))) {
        return true;
      }
      return false;
    }

    function createProblemCardHtml(p, student, submissions) {
      const isSolved = isProblemSolvedByStudent(p.id, student, submissions);
      const mySub = (typeof findStudentSubmission === 'function')
        ? findStudentSubmission(submissions || [], p.id, student)
        : (submissions || []).find(s => s.problem_id === p.id && (s.student_name === student.name || (s.student_id && s.student_id == student.stt)));

      let subBadge = '';
      if (isSolved) {
        subBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">ĐÃ AC ✅</span>';
      } else if (mySub) {
        if (mySub.status === 'Chấm đạt' || mySub.status === 'Hoàn thành') {
          subBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">✅ ${mySub.score ? `${mySub.score}/10 ` : ''}(Chấm đạt)</span>`;
        } else if (mySub.score !== undefined && mySub.score !== '') {
          subBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">💯 ${mySub.score}/10 (${escapeHtml(mySub.status)})</span>`;
        } else if (mySub.status === 'Cần sửa') {
          subBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">⚠️ Cần sửa</span>`;
        } else {
          subBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">📨 ${escapeHtml(mySub.status || 'Đã nộp')}</span>`;
        }
      } else {
        subBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">Chưa nộp ⏳</span>';
      }

      const hasDeruckOJ = (p.platform === 'DeruckOJ' || (p.testcases && p.testcases.length > 0) || (p.url && p.url.startsWith('#judge')));

      return `
        <div class="${(isSolved || (mySub && (mySub.status === 'Chấm đạt' || mySub.status === 'Hoàn thành')))
          ? "bg-slate-900/90 border border-emerald-500/40 rounded-xl p-3.5 space-y-2 flex flex-col justify-between" 
          : "bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-2 flex flex-col justify-between opacity-95"}">
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="font-mono text-[11px] font-bold text-slate-400">${escapeHtml(p.id)}</span>
              ${subBadge}
            </div>
            <div class="text-xs font-bold text-white leading-snug">${escapeHtml(p.name)}</div>
            ${mySub && mySub.feedback ? `
              <div class="p-2 bg-indigo-950/40 border border-indigo-500/30 rounded-lg text-[11px] text-indigo-300 leading-snug">
                💬 <strong>Thầy nhận xét:</strong> ${escapeHtml(mySub.feedback)}
              </div>
            ` : ''}
          </div>
          <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-1.5">
            <span class="text-[10px] text-slate-400 font-mono">${escapeHtml(p.difficulty || 'Level 1')}</span>
            <div class="flex items-center gap-1.5">
              ${hasDeruckOJ ? `
                <a href="index.html#judge-${escapeHtml(p.id)}" class="px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30 transition flex items-center gap-1">
                  <span>⚡</span> DeruckOJ
                </a>
              ` : `
                <a href="${escapeHtml(p.url || '#')}" target="_blank" class="text-[11px] font-semibold text-slate-400 hover:text-slate-200 transition">
                  Đề bài ↗
                </a>
              `}
              <button onclick="openStudentSubmitModal('${escapeHtml(p.id)}')" class="px-2.5 py-1 rounded-md text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1 shadow cursor-pointer">
                <span>📝</span> ${mySub ? 'Nộp lại' : 'Nộp bài'}
              </button>
            </div>
          </div>
        </div>
      `;
    }

    function renderHomeworkChecklist(student) {
      const container = document.getElementById('homework-grid');
      const badge = document.getElementById('target-stat-badge');
      const bar = document.getElementById('target-progress-bar');
      const pillsContainer = document.getElementById('student-weekly-pills');
      const titleEl = document.getElementById('homework-title');
      const descEl = document.getElementById('homework-desc');
      if (!container || !appData) return;

      container.innerHTML = '';
      const sClass = student.class || 'C++ nâng cao';
      const submissions = appData.submissions || [];
      const weeklyList = (appData.weekly_homework && Array.isArray(appData.weekly_homework[sClass]))
        ? appData.weekly_homework[sClass]
        : [];

      // TH1: Lớp này có lộ trình Bài tập theo tuần (Weekly Homework)
      if (weeklyList.length > 0) {
        const sortedWeeks = [...weeklyList].sort((a, b) => (a.week || 0) - (b.week || 0));
        const allAssignedIds = [...new Set(sortedWeeks.flatMap(w => w.problem_ids || []))];
        const totalOverall = allAssignedIds.length;
        const solvedOverall = allAssignedIds.filter(pid => isProblemSolvedByStudent(pid, student, submissions)).length;
        const percentOverall = totalOverall > 0 ? Math.round((solvedOverall / totalOverall) * 100) : 0;

        if (titleEl) titleEl.innerHTML = `<span>🎯</span> Lộ Trình Bài Tập Theo Tuần • <span class="text-indigo-400">Lớp ${escapeHtml(sClass)}</span>`;
        if (descEl) descEl.textContent = `Lộ trình bài tập hàng tuần kèm thời hạn nộp bài và trạng thái nộp bài cá nhân (${sortedWeeks.length} tuần học).`;
        if (badge) badge.textContent = `${solvedOverall} / ${totalOverall} bài (${percentOverall}%)`;
        if (bar) bar.style.width = `${percentOverall}%`;

        // Render filter pills
        if (pillsContainer) {
          pillsContainer.classList.remove('hidden');
          let pillsHtml = `
            <button onclick="setStudentWeekFilter('all')" class="px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${currentStudentWeekFilter === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}">
              Tất cả (${sortedWeeks.length} tuần)
            </button>
          `;
          sortedWeeks.forEach(w => {
            const pids = w.problem_ids || [];
            const wSolved = pids.filter(pid => isProblemSolvedByStudent(pid, student, submissions)).length;
            const isAct = String(currentStudentWeekFilter) === String(w.week);
            pillsHtml += `
              <button onclick="setStudentWeekFilter('${w.week}')" class="px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${isAct ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}">
                <span>Tuần ${w.week}</span>
                <span class="text-[10px] px-1.5 py-0.2 rounded-full ${wSolved === pids.length && pids.length > 0 ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'bg-slate-900/80 text-slate-300'}">${wSolved}/${pids.length}</span>
              </button>
            `;
          });
          pillsContainer.innerHTML = pillsHtml;
        }

        const displayWeeks = (currentStudentWeekFilter === 'all')
          ? sortedWeeks
          : sortedWeeks.filter(w => String(w.week) === String(currentStudentWeekFilter));

        container.className = "space-y-6 pt-2";
        let weeksHtml = '';

        displayWeeks.forEach(w => {
          const pids = w.problem_ids || [];
          const wSolved = pids.filter(pid => isProblemSolvedByStudent(pid, student, submissions)).length;
          const wPct = pids.length > 0 ? Math.round((wSolved / pids.length) * 100) : 0;

          let deadlineBadge = '';
          if (w.deadline) {
            const d = new Date(w.deadline);
            const isPast = d.getTime() < Date.now();
            const dStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            if (isPast) {
              deadlineBadge = `<span class="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-rose-500/10 text-rose-300 border border-rose-500/20">⏳ Hạn: ${dStr} (Đã hết hạn)</span>`;
            } else {
              deadlineBadge = `<span class="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">⏳ Hạn: ${dStr}</span>`;
            }
          }

          let probCardsHtml = '';
          if (pids.length === 0) {
            probCardsHtml = `<div class="col-span-full py-4 text-center text-xs text-slate-500 italic">Chưa có bài tập nào được gán cho tuần này.</div>`;
          } else {
            pids.forEach(pid => {
              const p = (appData.problems || []).find(x => x.id === pid) || {
                id: pid,
                name: pid,
                difficulty: 'Level 1',
                category: 'Cơ bản',
                platform: 'DeruckOJ'
              };
              probCardsHtml += createProblemCardHtml(p, student, submissions);
            });
          }

          weeksHtml += `
            <div class="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-800/80">
                <div class="flex items-center gap-2.5 flex-wrap">
                  <span class="px-2.5 py-1 rounded-lg text-xs font-mono font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Tuần ${w.week}</span>
                  <h3 class="text-sm sm:text-base font-bold text-white">${escapeHtml(w.title)}</h3>
                </div>
                <div class="flex items-center gap-2 flex-wrap">
                  ${deadlineBadge}
                  <span class="px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${wPct === 100 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'}">
                    ${wSolved}/${pids.length} AC (${wPct}%)
                  </span>
                </div>
              </div>
              ${w.description ? `
                <div class="text-xs text-slate-400 italic bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/50">
                  📌 ${escapeHtml(w.description)}
                </div>
              ` : ''}
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                ${probCardsHtml}
              </div>
            </div>
          `;
        });

        container.innerHTML = weeksHtml;
        return;
      }

      // TH2: Dự phòng danh sách phẳng khi lớp chưa tạo lộ trình tuần
      if (pillsContainer) pillsContainer.classList.add('hidden');
      container.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-2";

      const classProblems = (appData.problems || []).filter(p => {
        const pClasses = p.classes || [];
        return pClasses.includes(sClass) || pClasses.includes('Tất cả');
      });

      if (classProblems.length === 0) {
        container.innerHTML = `
          <div class="col-span-full p-8 text-center bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
            <span class="text-3xl">📭</span>
            <div class="text-sm font-bold text-slate-300">Chưa có bài tập nào được giao cho lớp ${escapeHtml(sClass)}</div>
            <p class="text-xs text-slate-400">Các bài tập mới sẽ tự động hiển thị tại đây khi Thầy giao bài.</p>
          </div>
        `;
        if (badge) badge.textContent = `0 / 0 bài (0%)`;
        if (bar) bar.style.width = `0%`;
        return;
      }

      const totalProblems = classProblems.length;
      let count = 0;

      if (titleEl) titleEl.innerHTML = `<span>🎯</span> Tiến Độ Bài Tập Giao Tuần Này • <span class="text-indigo-400">Lớp ${escapeHtml(sClass)}</span>`;
      if (descEl) descEl.textContent = `Mức độ hoàn thành đối với ${totalProblems} bài tập giao riêng cho lớp ${sClass}`;

      classProblems.forEach(p => {
        if (isProblemSolvedByStudent(p.id, student, submissions)) count++;
        container.innerHTML += createProblemCardHtml(p, student, submissions);
      });

      const percent = totalProblems > 0 ? Math.round((count / totalProblems) * 100) : 0;
      if (badge) badge.textContent = `${count} / ${totalProblems} bài (${percent}%)`;
      if (bar) bar.style.width = `${percent}%`;
    }

    function formatDateKey(d) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    let currentHeatmapYear = '2026';

    function setupStudentHeatmap(student) {
      const currentYear = new Date().getFullYear();
      const yearsSet = new Set([currentYear]);
      Object.keys(student.activity || {}).forEach(k => {
        const y = parseInt(k.split('-')[0]);
        if (!isNaN(y)) yearsSet.add(y);
      });
      if (yearsSet.size === 1) {
        yearsSet.add(currentYear - 1);
      }
      const availableYears = Array.from(yearsSet).sort((a, b) => b - a);

      if (currentHeatmapYear !== 'recent' && !yearsSet.has(parseInt(currentHeatmapYear))) {
        currentHeatmapYear = String(availableYears[0]);
      }

      renderYearSelector(student, availableYears);
      renderHeatmap(student, currentHeatmapYear);
    }

    function renderYearSelector(student, availableYears) {
      const container = document.getElementById('heatmap-year-selector');
      if (!container) return;
      container.innerHTML = '';

      availableYears.forEach(yr => {
        const btn = document.createElement('button');
        const isAct = String(yr) === String(currentHeatmapYear);
        btn.className = isAct 
          ? "px-3 py-1 rounded-lg font-bold text-xs bg-indigo-600 text-white shadow-sm transition"
          : "px-3 py-1 rounded-lg font-medium text-xs text-slate-400 hover:text-white hover:bg-slate-700/60 transition";
        btn.textContent = `Năm ${yr}`;
        btn.onclick = () => {
          currentHeatmapYear = String(yr);
          renderYearSelector(student, availableYears);
          renderHeatmap(student, currentHeatmapYear);
        };
        container.appendChild(btn);
      });

      const recentBtn = document.createElement('button');
      const isRecentAct = currentHeatmapYear === 'recent';
      recentBtn.className = isRecentAct
        ? "px-3 py-1 rounded-lg font-bold text-xs bg-indigo-600 text-white shadow-sm transition"
        : "px-3 py-1 rounded-lg font-medium text-xs text-slate-400 hover:text-white hover:bg-slate-700/60 transition";
      recentBtn.textContent = '16 tuần qua';
      recentBtn.onclick = () => {
        currentHeatmapYear = 'recent';
        renderYearSelector(student, availableYears);
        renderHeatmap(student, currentHeatmapYear);
      };
      container.appendChild(recentBtn);
    }

    function renderHeatmap(student, yearMode) {
      const container = document.getElementById('heatmap-calendar');
      if (!container) return;
      container.innerHTML = '';

      const mode = yearMode || currentHeatmapYear || '2026';
      const activity = student.activity || {};
      const now = new Date();

      let startDate, endDate;
      let targetYear = null;

      if (mode === 'recent') {
        const endDayOfWeek = now.getDay();
        const daysUntilSunday = (7 - endDayOfWeek) % 7;
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilSunday);
        startDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - (16 * 7 - 1));
      } else {
        targetYear = parseInt(mode) || now.getFullYear();
        startDate = new Date(targetYear, 0, 1);
        endDate = new Date(targetYear, 11, 31);
      }

      // Monday offset for week 0: (getDay() + 6) % 7
      const startDayOffset = (startDate.getDay() + 6) % 7;
      const startMonday = new Date(startDate);
      startMonday.setDate(startMonday.getDate() - startDayOffset);

      // Sunday offset for last week: (7 - ((getDay() + 6) % 7 + 1)) % 7
      const endDayOffset = (7 - ((endDate.getDay() + 6) % 7 + 1)) % 7;
      const endSunday = new Date(endDate);
      endSunday.setDate(endSunday.getDate() + endDayOffset);

      const weeks = [];
      let cur = new Date(startMonday);
      let curWeek = [];

      let activeDaysCount = 0;
      let maxDay = '--';
      let maxCount = 0;
      let totalSubs = 0;
      let totalAc = 0;

      while (cur <= endSunday) {
        const iso = formatDateKey(cur);
        const dayIndex = (cur.getDay() + 6) % 7;
        const act = activity[iso] || { total: 0, ac: 0 };
        const isInRange = (mode === 'recent')
          ? (cur >= startDate && cur <= endDate)
          : (cur.getFullYear() === targetYear);

        if (isInRange && act.total > 0) {
          activeDaysCount++;
          totalSubs += act.total;
          totalAc += act.ac;
          if (act.total > maxCount) {
            maxCount = act.total;
            maxDay = `${iso} (${act.total} bài)`;
          }
        }

        curWeek.push({
          date: iso,
          act,
          dayIndex,
          month: cur.getMonth() + 1,
          isInRange
        });

        if (curWeek.length === 7) {
          weeks.push(curWeek);
          curWeek = [];
        }
        cur.setDate(cur.getDate() + 1);
      }

      // Update stat cards below heatmap
      const maxDayEl = document.getElementById('heatmap-max-day');
      if (maxDayEl) maxDayEl.textContent = maxDay;

      const activeDaysEl = document.getElementById('heatmap-active-days');
      if (activeDaysEl) activeDaysEl.textContent = `${activeDaysCount} ngày`;

      const totalSubsEl = document.getElementById('heatmap-total-subs');
      if (totalSubsEl) {
        totalSubsEl.textContent = `${totalSubs} bài (${totalAc} AC)`;
      }

      const platformsEl = document.getElementById('heatmap-platforms');
      if (platformsEl) {
        const plats = [];
        if (student.marisa_handle) plats.push('Marisa');
        if (student.cf_handle) plats.push('CF');
        if (student.clue_handle) plats.push('ClueOJ');
        if (student.vnoi_handle) plats.push('VNOI');
        if (student.ctoj_handle) plats.push('CTOJ');
        if (student.vjudge_handle) plats.push('VJudge');
        platformsEl.textContent = plats.length > 0 ? plats.join(', ') : 'Chưa liên kết';
      }

      // Month labels header row
      let monthHeaderHtml = '<div class="flex gap-1.5 text-[10px] text-slate-400 font-mono mb-1.5 ml-7">';
      let lastMonth = -1;
      weeks.forEach((w, wIdx) => {
        const inRangeDays = w.filter(d => d.isInRange);
        const firstDayOfMonth = inRangeDays.find(d => d.date.endsWith('-01')) || (wIdx === 0 ? inRangeDays[0] : null);
        if (firstDayOfMonth && firstDayOfMonth.month !== lastMonth) {
          lastMonth = firstDayOfMonth.month;
          monthHeaderHtml += `<div class="w-3.5 text-slate-300 font-bold whitespace-nowrap">Th${lastMonth}</div>`;
        } else {
          monthHeaderHtml += `<div class="w-3.5"></div>`;
        }
      });
      monthHeaderHtml += '</div>';

      // Render weeks as vertical columns
      let html = monthHeaderHtml + '<div class="flex gap-1.5 items-start">';

      // Days of week label column (T2 to CN)
      html += `
        <div class="flex flex-col gap-1.5 text-[9px] text-slate-500 font-mono pr-2 select-none">
          <div class="h-3.5 leading-3.5">T2</div>
          <div class="h-3.5 leading-3.5"></div>
          <div class="h-3.5 leading-3.5">T4</div>
          <div class="h-3.5 leading-3.5"></div>
          <div class="h-3.5 leading-3.5">T6</div>
          <div class="h-3.5 leading-3.5"></div>
          <div class="h-3.5 leading-3.5">CN</div>
        </div>
      `;

      weeks.forEach(w => {
        html += '<div class="flex flex-col gap-1.5 heatmap-column">';
        w.forEach(d => {
          if (!d.isInRange) {
            html += '<div class="w-3.5 h-3.5 opacity-0 pointer-events-none"></div>';
            return;
          }

          const tot = d.act.total;
          const ac = d.act.ac;
          let colorClass = "bg-slate-800/80 border border-slate-700/40";
          if (tot >= 5) {
            colorClass = "bg-emerald-400 border border-emerald-300";
          } else if (tot >= 3) {
            colorClass = "bg-emerald-600 border border-emerald-500";
          } else if (tot >= 1) {
            colorClass = "bg-emerald-900 border border-emerald-700/60";
          }

          const tooltip = `${d.date}: ${tot} bài nộp (${ac} bài AC)`;
          html += `<div class="w-3.5 h-3.5 rounded-sm heatmap-cell ${colorClass} cursor-pointer transition-transform hover:scale-125" data-tooltip="${tooltip}"></div>`;
        });
        html += '</div>';
      });

      html += '</div>';
      container.innerHTML = html;

      // Attach floating tooltip event listeners to guarantee overlay on top of all cells
      const tipEl = document.getElementById('heatmap-floating-tooltip');
      container.querySelectorAll('.heatmap-cell').forEach(cell => {
        cell.addEventListener('mouseenter', (e) => {
          const raw = cell.getAttribute('data-tooltip');
          if (!raw || !tipEl) return;
          const parts = raw.split(': ');
          const dStr = parts[0];
          const detail = parts.slice(1).join(': ');
          tipEl.innerHTML = `
            <div class="text-[11px] font-bold text-slate-300">📅 ${dStr}</div>
            <div class="text-xs font-semibold text-emerald-400 mt-0.5">${detail || ''}</div>
          `;
          tipEl.classList.remove('hidden');
          const rect = cell.getBoundingClientRect();
          tipEl.style.left = `${rect.left + rect.width / 2}px`;
          tipEl.style.top = `${rect.top - 6}px`;
        });
        cell.addEventListener('mouseleave', () => {
          if (tipEl) tipEl.classList.add('hidden');
        });
      });
    }

    function renderSolvedArchive(student) {
      const tbody = document.getElementById('solved-table-body');
      const counter = document.getElementById('solved-archive-count');
      if (!tbody) return;
      tbody.innerHTML = '';

      let detailList = student.solved_problems_detail;
      if (!detailList || detailList.length === 0) {
        detailList = (student.solved || []).map(pid => {
          const matched = (appData.problems || []).find(p => p.id === pid);
          if (matched) {
            let platColor = "text-purple-400";
            const platLower = (matched.platform || '').toLowerCase();
            if (platLower.includes('cf') || platLower.includes('codeforces')) platColor = "text-blue-400";
            else if (platLower.includes('clue')) platColor = "text-cyan-400";
            else if (platLower.includes('vnoi')) platColor = "text-amber-400";
            else if (platLower.includes('chuyentin') || platLower.includes('ctoj')) platColor = "text-teal-400";
            else if (platLower.includes('vjudge')) platColor = "text-emerald-400";

            return {
              id: matched.id,
              name: matched.name,
              platform: matched.platform || 'MarisaOJ',
              platform_color: platColor,
              url: matched.url,
              is_target: (student.target_solved || []).includes(pid)
            };
          }

          let plat = 'MarisaOJ';
          let platColor = 'text-purple-400';
          let url = '#';
          let name = pid;

          if (pid.startsWith('MARISA-')) {
            const num = pid.replace('MARISA-', '');
            plat = 'MarisaOJ';
            platColor = 'text-purple-400';
            url = `https://marisaoj.com/problem/${num}`;
            name = `Bài tập Marisa #${num}`;
          } else if (pid.startsWith('CF-')) {
            const code = pid.replace('CF-', '');
            const m = code.match(/^(\d+)([A-Za-z0-9]+)$/);
            plat = 'Codeforces';
            platColor = 'text-blue-400';
            url = m ? `https://codeforces.com/problemset/problem/${m[1]}/${m[2]}` : `https://codeforces.com/problemset`;
            name = `Codeforces ${code}`;
          } else if (pid.startsWith('CLUE-')) {
            const code = pid.replace('CLUE-', '');
            plat = 'ClueOJ';
            platColor = 'text-cyan-400';
            url = `https://oj.clue.edu.vn/problem/${code}`;
            name = `ClueOJ ${code}`;
          } else if (pid.startsWith('VNOI-')) {
            const code = pid.replace('VNOI-', '');
            plat = 'VNOI';
            platColor = 'text-amber-400';
            url = `https://oj.vnoi.info/problem/${code}`;
            name = `VNOI ${code}`;
          } else if (pid.startsWith('CTOJ-')) {
            const code = pid.replace('CTOJ-', '');
            plat = 'CTOJ';
            platColor = 'text-teal-400';
            url = `https://oj.chuyentin.pro/problem/${code}`;
            name = `CTOJ ${code}`;
          }

          return {
            id: pid,
            name: name,
            platform: plat,
            platform_color: platColor,
            url: url,
            is_target: (student.target_solved || []).includes(pid)
          };
        });
      }

      counter.textContent = `Tổng: ${detailList.length} bài`;

      if (detailList.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="px-4 py-8 text-center text-slate-500 italic">
              Chưa có bài tập nào được giải thành công.
            </td>
          </tr>
        `;
        return;
      }

      detailList.forEach((p, idx) => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-800/40 transition";
        tr.innerHTML = `
          <td class="px-4 py-3 text-center text-slate-400 font-bold">${idx + 1}</td>
          <td class="px-4 py-3 font-bold text-indigo-300 font-mono text-xs">${p.id}</td>
          <td class="px-4 py-3 font-semibold text-white">
            ${p.name}
            ${p.is_target ? '<span class="ml-2 px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">Đề Tuần</span>' : ''}
          </td>
          <td class="px-4 py-3 text-center ${p.platform_color || 'text-purple-400'} font-medium">${p.platform || 'Online Judge'}</td>
          <td class="px-4 py-3 text-center">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              Accepted (100đ)
            </span>
          </td>
          <td class="px-4 py-3 text-center">
            <a href="${p.url}" target="_blank" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-xs">
              Xem đề ↗
            </a>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

        // ==========================================
    // AUTHENTICATION & ACCESS CONTROL (COOKIE PERSISTENCE)
    // ==========================================
    let currentAuth = null;

    async function hashSHA256(str) {
      const encoder = new TextEncoder();
      const data = encoder.encode(str.trim());
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function setAuthCookie(authData) {
      try {
        const json = encodeURIComponent(JSON.stringify(authData));
        // Persistent cookie for 365 days
        document.cookie = `cp_auth_session=${json}; max-age=${365 * 24 * 60 * 60}; path=/; SameSite=Lax`;
        localStorage.setItem('cp_auth_session', JSON.stringify(authData));
      } catch (e) {
        console.warn("Could not set cookie", e);
      }
    }

    function getAuthCookie() {
      try {
        const name = "cp_auth_session=";
        const decodedCookie = decodeURIComponent(document.cookie);
        const ca = decodedCookie.split(';');
        for (let i = 0; i < ca.length; i++) {
          let c = ca[i].trim();
          if (c.indexOf(name) === 0) {
            const raw = c.substring(name.length, c.length);
            return JSON.parse(raw);
          }
        }
      } catch (e) {
        console.warn("Could not read auth cookie", e);
      }
      try {
        const local = localStorage.getItem('cp_auth_session');
        if (local) return JSON.parse(local);
      } catch (e) {}
      return null;
    }

    function clearAuthCookie() {
      try {
        document.cookie = "cp_auth_session=; max-age=0; path=/; SameSite=Lax";
        localStorage.removeItem('cp_auth_session');
        sessionStorage.removeItem('cp_auth_session');
      } catch (e) {
        console.warn("Could not clear auth cookie", e);
      }
    }

    function checkAuthSession() {
      const saved = getAuthCookie();
      if (saved) {
        currentAuth = saved;
        if (currentAuth.role === 'student' && !currentAuth.stt && appData && appData.students) {
          const st = appData.students.find(s => s.name === currentAuth.name);
          if (st) currentAuth.stt = st.stt;
        }
        hideAuthModal();
        applyAuthAccess();
        return true;
      }
      applyAuthAccess();
      return false;
    }

    function showAuthModal() {
      const modal = document.getElementById('auth-modal');
      if (modal) {
        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
        setTimeout(() => document.getElementById('auth-input-code')?.focus(), 150);
      }
    }

    function hideAuthModal() {
      const modal = document.getElementById('auth-modal');
      if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
      }
    }

    function togglePasswordVisibility() {
      const input = document.getElementById('auth-input-code');
      if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
      }
    }

    async function handleAuthSubmit(e) {
      if (e) e.preventDefault();
      const input = document.getElementById('auth-input-code');
      const errorMsg = document.getElementById('auth-error-msg');
      const submitBtn = document.getElementById('auth-submit-btn');
      if (!input || !input.value.trim()) return;

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Đang xác thực qua Firebase...</span>`;
      errorMsg.classList.add('hidden');

      const code = input.value.trim();
      const codeHash = await hashSHA256(code);

      // Verify token directly with Firebase Realtime Database
      const authResult = await verifyAuthTokenFromFirebase(codeHash);

      if (authResult.success && authResult.data) {
        currentAuth = Object.assign({}, authResult.data);
        if (currentAuth.role === 'student' && !currentAuth.stt && appData && appData.students) {
          const st = appData.students.find(s => s.name === currentAuth.name);
          if (st) currentAuth.stt = st.stt;
        }
        setAuthCookie(currentAuth);
        hideAuthModal();
        applyAuthAccess();

        // Route to student profile
        if (currentAuth.role === 'student' && currentAuth.stt) {
          switchStudent(currentAuth.stt);
        } else {
          loadStudentProfile(appData.students?.[0]?.stt);
        }
      } else {
        errorMsg.textContent = authResult.error || "Mã PIN hoặc mật khẩu không chính xác!";
        errorMsg.classList.remove('hidden');
        input.classList.add('border-rose-500');
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Đăng Nhập Vào Hồ Sơ</span> <span>→</span>`;
      }
    }

    function handleLogout() {
      clearAuthCookie();
      currentAuth = null;
      window.location.reload();
    }

    function applyAuthAccess() {
      const nameEl = document.getElementById('user-display-name');
      const badge = document.getElementById('user-badge');
      const authBtn = document.getElementById('btn-auth-action');
      const switcher = document.getElementById('switcher-container');

      if (!currentAuth) {
        if (nameEl) nameEl.textContent = 'Khách';
        if (badge) badge.className = "px-2 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1";
        if (authBtn) {
          authBtn.onclick = showAuthModal;
          authBtn.innerHTML = `<span>🔑</span> <span class="hidden sm:inline">Đăng nhập</span>`;
          authBtn.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 hover:text-white border border-indigo-500/40 transition flex items-center gap-1 cursor-pointer";
        }
        if (switcher) switcher.classList.add('hidden');
        return;
      }

      if (currentAuth.role === 'admin') {
        if (nameEl) nameEl.textContent = '👑 Admin';
        if (badge) badge.className = "px-2 py-1 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1";
        if (switcher) {
          switcher.classList.remove('hidden');
          switcher.classList.add('flex');
          populateStudentSelector();
        }
      } else if (currentAuth.role === 'teacher') {
        if (nameEl) nameEl.textContent = '🧑‍🏫 Giảng Viên';
        if (badge) badge.className = "px-2 py-1 rounded-lg text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/40 flex items-center gap-1";
        if (switcher) {
          switcher.classList.remove('hidden');
          switcher.classList.add('flex');
          populateStudentSelector();
        }
      } else if (currentAuth.role === 'student') {
        if (nameEl) nameEl.textContent = `👤 ${currentAuth.name}`;
        if (badge) badge.className = "px-2 py-1 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1";
        // CRITICAL PRIVACY: Students CANNOT see the switcher!
        if (switcher) switcher.classList.add('hidden');
      } else if (currentAuth.role === 'class') {
        const cls = currentAuth.class || '';
        let badgeColor = "bg-indigo-500/20 text-indigo-300 border-indigo-500/40";
        let icon = "👥";
        if (cls === 'C++ nâng cao') {
          badgeColor = "bg-blue-500/20 text-blue-300 border-blue-500/40";
          icon = "🟦";
        } else if (cls === 'C++ cơ bản') {
          badgeColor = "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
          icon = "🔷";
        } else if (cls === 'Python cơ bản') {
          badgeColor = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
          icon = "🟩";
        } else if (cls === 'Python 1-1') {
          badgeColor = "bg-purple-500/20 text-purple-300 border-purple-500/40";
          icon = "🟪";
        }
        if (nameEl) nameEl.textContent = `${icon} ${currentAuth.name || cls}`;
        if (badge) badge.className = `px-2 py-1 rounded-lg text-xs font-semibold ${badgeColor} border flex items-center gap-1`;
        if (switcher) switcher.classList.add('hidden');
      } else {
        if (nameEl) nameEl.textContent = `👥 ${currentAuth.name}`;
        if (badge) badge.className = "px-2 py-1 rounded-lg text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1";
        if (switcher) switcher.classList.add('hidden');
      }

      if (authBtn) {
        authBtn.onclick = handleLogout;
        authBtn.innerHTML = `<span>🚪</span> <span class="hidden sm:inline">Đăng xuất</span>`;
        authBtn.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-white border border-rose-500/30 transition flex items-center gap-1 cursor-pointer";
      }
    }

    function populateStudentSelector() {
      const selector = document.getElementById('student-selector');
      if (!selector || !appData || !appData.students) return;
      selector.innerHTML = '';

      appData.students.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.stt;
        opt.textContent = `${s.stt}. ${s.name} (${s.class})`;
        selector.appendChild(opt);
      });

      if (currentStudent) {
        selector.value = currentStudent.stt;
      }
    }

    function showLiveToast(msg) {
      const toast = document.getElementById('live-toast');
      const msgEl = document.getElementById('live-toast-msg');
      if (!toast || !msgEl) return;
      msgEl.textContent = msg;
      toast.classList.remove('hidden');
      setTimeout(() => {
        toast.classList.add('hidden');
      }, 4500);
    }

    let lastKnownUpdateTime = null;
    let isRefreshingLiveStudent = false;

    async function checkAndApplyStudentLiveUpdates(force = false) {
      if (isRefreshingLiveStudent) return;
      // QUOTA PROTECTION: Dừng kiểm tra khi tab đang chạy nền
      if (document.hidden && !force) return;

      isRefreshingLiveStudent = true;
      try {
        const dbUrl = (typeof getFirebaseDatabaseUrl === 'function') ? getFirebaseDatabaseUrl() : '';
        const fbReady = Boolean(dbUrl && typeof isFirebaseConfigured === 'function' && isFirebaseConfigured());
        let remoteUpdateTime = null;

        if (fbReady) {
          // BẢO VỆ QUOTA: Chỉ kiểm tra timestamp /metadata/last_updated.json (~25 bytes)
          try {
            const metaResp = await fetch(`${dbUrl}/metadata/last_updated.json`, {
              signal: AbortSignal.timeout(3500)
            });
            if (metaResp.ok) {
              remoteUpdateTime = await metaResp.json();
            }
          } catch(e) {}
        }

        if (!remoteUpdateTime) {
          try {
            const djResp = await fetch('data.json?v=' + Date.now(), { signal: AbortSignal.timeout(3500) });
            if (djResp.ok) {
              const dj = await djResp.json();
              if (dj && dj.last_updated) remoteUpdateTime = dj.last_updated;
            }
          } catch(e) {}
        }

        if (!remoteUpdateTime) {
          isRefreshingLiveStudent = false;
          return;
        }

        if (lastKnownUpdateTime && remoteUpdateTime === lastKnownUpdateTime && !force) {
          isRefreshingLiveStudent = false;
          return;
        }

        console.log('⚡ [5s Auto] Hồ sơ học sinh phát hiện dữ liệu mới:', remoteUpdateTime);
        lastKnownUpdateTime = remoteUpdateTime;

        if (fbReady && typeof fetchStudentsFromFirebase === 'function') {
          const fbStudents = await fetchStudentsFromFirebase();
          if (fbStudents && fbStudents.length > 0) {
            appData.students = fbStudents;
            try { localStorage.setItem('cp_cached_students', JSON.stringify(fbStudents)); } catch(e) {}
          }
        }

        if (fbReady && typeof fetchSubmissionsFromFirebase === 'function') {
          const fbSubs = await fetchSubmissionsFromFirebase();
          if (fbSubs && fbSubs.length > 0) {
            const isAdmin = Boolean(currentAuth && (currentAuth.role === 'admin' || currentAuth.role === 'teacher'));
            appData.submissions = (typeof sanitizeSubmissionsForRole === 'function')
              ? sanitizeSubmissionsForRole(fbSubs, isAdmin)
              : fbSubs;
            try { localStorage.setItem('cp_cached_submissions', JSON.stringify(appData.submissions)); } catch(e) {}
          }
        }

        try {
          const resCatalog = await fetch('data.json?v=' + Date.now(), { signal: AbortSignal.timeout(4000) });
          if (resCatalog.ok) {
            const catalogData = await resCatalog.json();
            if (catalogData.problems) appData.problems = catalogData.problems;
            if (catalogData.curriculum) appData.curriculum = catalogData.curriculum;
          }
        } catch(e) {}

        const selector = document.getElementById('student-selector');
        const curId = currentStudent ? currentStudent.stt : (selector ? parseInt(selector.value) : 1);
        loadStudentProfile(curId);
        if (force) {
          showLiveToast('⚡ Dữ liệu bài nộp & hồ sơ vừa được cập nhật!');
        }
      } catch (e) {
      } finally {
        isRefreshingLiveStudent = false;
      }
    }

    function startLiveAutoRefresh() {
      // Chu kỳ cập nhật mỗi 5 giây, bảo vệ quota tự động bằng micro-polling
      setInterval(() => {
        checkAndApplyStudentLiveUpdates();
      }, 5000);

      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          checkAndApplyStudentLiveUpdates();
        }
      });
    }

    // ============================================================
    // BÀI TẬP NỘP TRÊN TRANG CÁ NHÂN (STUDENT SUBMISSION)
    // ============================================================
    let currentStudentSubmitProbId = null;
    let currentStudentSubmitMode = 'short';

    function openStudentSubmitModal(probId) {
      if (!currentStudent) return;
      currentStudentSubmitProbId = probId;
      const prob = (appData.problems || []).find(p => p.id === probId);
      if (!prob) {
        alert("Không tìm thấy thông tin bài tập này!");
        return;
      }
      const sClass = currentStudent.class;
      const pClasses = prob.classes || [];
      const isAssignedInWeekly = Boolean(
        appData.weekly_homework &&
        Array.isArray(appData.weekly_homework[sClass]) &&
        appData.weekly_homework[sClass].some(w => (w.problem_ids || []).includes(prob.id))
      );
      if (sClass && !pClasses.includes(sClass) && !pClasses.includes('Tất cả') && !isAssignedInWeekly) {
        alert("Bài tập này không thuộc lớp của bạn!");
        return;
      }

      document.getElementById('submit-modal-title').textContent = `Nộp Bài Tập: ${prob.name}`;
      document.getElementById('submit-prob-id').textContent = prob.id;
      document.getElementById('submit-prob-name').textContent = prob.name;
      document.getElementById('submit-prob-meta').textContent = `Dạng bài: ${prob.category || 'Cơ bản'} • Độ khó: ${prob.difficulty || 'Mặc định'}`;
      
      const ojLink = document.getElementById('submit-prob-oj-link');
      if (ojLink) {
        ojLink.href = `index.html#judge-${prob.id}`;
      }

      document.getElementById('submit-student-name').textContent = currentStudent.name;
      document.getElementById('submit-student-class').textContent = currentStudent.class || 'Lớp học';

      switchStudentSubmitMode('short');
      const ansInput = document.getElementById('submit-answer-input');
      const essayInput = document.getElementById('submit-essay-input');
      if (ansInput) ansInput.value = '';
      if (essayInput) essayInput.value = '';

      // Check previous submission
      const prevBox = document.getElementById('submit-previous-box');
      const submissions = appData.submissions || [];
      const mySub = (typeof findStudentSubmission === 'function')
        ? findStudentSubmission(submissions, prob.id, currentStudent)
        : submissions.find(s => s.problem_id === prob.id && (s.student_name === currentStudent.name || (s.student_id && s.student_id == currentStudent.stt)));

      if (mySub && prevBox) {
        prevBox.classList.remove('hidden');
        const badge = document.getElementById('prev-sub-badge');
        const timeEl = document.getElementById('prev-sub-time');
        const scoreEl = document.getElementById('prev-sub-score');
        const contentEl = document.getElementById('prev-sub-content');
        const fbBox = document.getElementById('prev-sub-feedback-box');
        const fbText = document.getElementById('prev-sub-feedback-text');

        if (badge) {
          badge.textContent = mySub.status || 'Đã nộp';
          if (mySub.status === 'Chấm đạt' || mySub.status === 'Hoàn thành') {
            badge.className = "px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
          } else if (mySub.status === 'Cần sửa') {
            badge.className = "px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30";
          } else {
            badge.className = "px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30";
          }
        }
        if (timeEl) timeEl.textContent = mySub.submitted_at || '--';
        if (scoreEl) scoreEl.textContent = (mySub.score !== undefined && mySub.score !== '') ? `${mySub.score}/10` : 'Chờ chấm';
        
        // Hiển thị mã nguồn bài nộp trước đó của học sinh
        if (contentEl) {
          contentEl.textContent = mySub.answer || '--';
        }

        if (fbBox && fbText) {
          if (mySub.feedback) {
            fbBox.classList.remove('hidden');
            fbText.textContent = mySub.feedback;
          } else {
            fbBox.classList.add('hidden');
          }
        }

        // Tự động điền lại mã nguồn hoặc đáp án cũ vào ô nhập liệu
        if (mySub.type === 'short' || mySub.submission_type_display === 'Điền đáp án') {
          if (ansInput && !ansInput.value) ansInput.value = mySub.answer || '';
        } else {
          if (essayInput && !essayInput.value) essayInput.value = mySub.answer || '';
        }
      } else if (prevBox) {
        prevBox.classList.add('hidden');
      }

      document.getElementById('modal-submit-problem')?.classList.remove('hidden');
    }

    function closeStudentSubmitModal() {
      document.getElementById('modal-submit-problem')?.classList.add('hidden');
      currentStudentSubmitProbId = null;
    }

    function switchStudentSubmitMode(mode) {
      currentStudentSubmitMode = mode;
      const btnShort = document.getElementById('btn-submit-tab-short');
      const btnEssay = document.getElementById('btn-submit-tab-essay');
      const boxShort = document.getElementById('submit-mode-short-box');
      const boxEssay = document.getElementById('submit-mode-essay-box');

      if (mode === 'short') {
        if (btnShort) btnShort.className = "py-2 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer bg-indigo-600 text-white shadow";
        if (btnEssay) btnEssay.className = "py-2 rounded-lg font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer text-slate-400 hover:text-white";
        if (boxShort) boxShort.classList.remove('hidden');
        if (boxEssay) boxEssay.classList.add('hidden');
      } else {
        if (btnShort) btnShort.className = "py-2 rounded-lg font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer text-slate-400 hover:text-white";
        if (btnEssay) btnEssay.className = "py-2 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer bg-indigo-600 text-white shadow";
        if (boxShort) boxShort.classList.add('hidden');
        if (boxEssay) boxEssay.classList.remove('hidden');
      }
    }

    function insertStudentEssayTemplate(type) {
      const ta = document.getElementById('submit-essay-input');
      if (!ta) return;
      ta.value = '';
      ta.focus();
    }

    async function handleConfirmStudentSubmit() {
      if (!currentStudentSubmitProbId || !currentStudent) return;
      const prob = (appData.problems || []).find(p => p.id === currentStudentSubmitProbId);
      if (!prob) return;

      let answerContent = '';
      if (currentStudentSubmitMode === 'short') {
        const input = document.getElementById('submit-answer-input');
        answerContent = input ? input.value.trim() : '';
        if (!answerContent) {
          alert("Vui lòng nhập đáp án trước khi bấm nộp bài!");
          input?.focus();
          return;
        }
      } else {
        const input = document.getElementById('submit-essay-input');
        answerContent = input ? input.value.trim() : '';
        if (!answerContent) {
          alert("Vui lòng viết lời giải hoặc dán mã nguồn trước khi nộp!");
          input?.focus();
          return;
        }
      }

      const btnSubmit = document.getElementById('btn-confirm-student-submit');
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span>⏳</span> Đang nộp bài...';
      }

      const subId = 'SUB-' + Date.now();
      let detectedLang = 'Khác';
      if (answerContent.includes('#include') || answerContent.includes('using namespace') || answerContent.includes('std::')) {
        detectedLang = 'C++20';
      } else if (answerContent.includes('def ') || answerContent.includes('import ') || answerContent.includes('print(')) {
        detectedLang = 'Python 3';
      }

      const subData = {
        id: subId,
        submitted_at: new Date().toLocaleString('vi-VN', { hour12: false }),
        student_id: currentStudent.stt ? String(currentStudent.stt) : '',
        student_stt: currentStudent.stt ? Number(currentStudent.stt) : '',
        student_pin: currentStudent.pin || '',
        student_name: currentStudent.name,
        class_name: currentStudent.class || 'C++ nâng cao',
        problem_id: prob.id,
        problem_name: prob.name,
        type: currentStudentSubmitMode,
        submission_type_display: (currentStudentSubmitMode === 'essay' ? (detectedLang !== 'Khác' ? 'Code DeruckOJ' : 'Tự luận') : 'Điền đáp án'),
        answer: (currentStudentSubmitMode === 'essay' && detectedLang !== 'Khác' && !answerContent.startsWith('['))
          ? `[${detectedLang}]\n${answerContent}`
          : answerContent,
        lang: detectedLang,
        status: 'Đã nộp',
        score: '',
        feedback: ''
      };

      if (!appData.submissions) appData.submissions = [];
      appData.submissions.unshift(subData);
      if (typeof archiveSubmissionsLocally === 'function') {
        await archiveSubmissionsLocally([subData], { silent: true });
      }

      // Save to localStorage
      try {
        const localSaved = localStorage.getItem('cp_app_data');
        const fullData = localSaved ? JSON.parse(localSaved) : { ...appData };
        fullData.submissions = [subData, ...(Array.isArray(fullData.submissions) ? fullData.submissions : []).filter(sub => sub && sub.id !== subId)];
        localStorage.setItem('cp_app_data', JSON.stringify(fullData));
        localStorage.setItem('cp_cached_submissions', JSON.stringify(appData.submissions));
      } catch(e) {}

      let savedToFirebase = false;
      // Save remotely before reporting successful delivery.
      if (typeof saveSubmissionToFirebase === 'function' && isFirebaseConfigured()) {
        try {
          savedToFirebase = await saveSubmissionToFirebase(subData);
        } catch(e) {}
      }

      // Sync to backend / Google Sheet
      const gasUrl = localStorage.getItem('cp_gas_sync_url') || (appData && appData.gas_sync_url) || '';
      let synced = false;
      if (gasUrl && gasUrl.startsWith('http')) {
        try {
          const resp = await fetch(gasUrl, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'submit_answer', submission: subData })
          });
          const resJson = await resp.json();
          if (resJson && resJson.status === 'success') synced = true;
        } catch(e) {}
      }
      if (!synced) {
        try {
          const resp = await fetch('http://127.0.0.1:8080/api/submit_answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'submit_answer', submission: subData })
          });
          if (resp.ok) {
            const result = await resp.json();
            synced = result.status === 'success';
          }
        } catch(e) {}
      }

      showLiveToast(savedToFirebase || synced
        ? '🎉 Nộp bài thành công! Thầy sẽ xem và gửi nhận xét cho bạn.'
        : '⚠️ Bài mới được lưu trên máy này, chưa gửi tới thầy. Hãy kiểm tra kết nối và nộp lại.');
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<span>🚀</span> Xác Nhận Nộp Bài';
      }

      closeStudentSubmitModal();
      renderHomeworkChecklist(currentStudent);
    }

    window.addEventListener('DOMContentLoaded', initStudentPage);
