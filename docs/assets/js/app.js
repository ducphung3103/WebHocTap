let appData = null;
    let currentStudent = null;

    function getActiveStudent() {
      if (!currentAuth || currentAuth.role !== 'student' || !appData || !Array.isArray(appData.students)) return null;
      return appData.students.find(s => currentAuth.stt != null
        ? String(s.stt) === String(currentAuth.stt)
        : currentAuth.pin ? String(s.pin) === String(currentAuth.pin)
        : s.name === currentAuth.name && (!currentAuth.class || s.class === currentAuth.class)) || null;
    }

    function isSubmissionAuthorOrAdmin(sub) {
      if (!sub || !currentAuth) return false;
      if (currentAuth.role === 'admin' || currentAuth.role === 'teacher') return true;
      return currentAuth.role === 'student' && submissionBelongsToStudent(sub, getActiveStudent() || currentAuth);
    }

    // Load data from data.json (public catalog) and Firebase (secure students/tuition)
    async function initApp() {
      // 0. Đọc phiên xác thực đăng nhập từ Cookie trước tiên để currentAuth sẵn sàng khi tải dữ liệu
      const savedAuth = getAuthCookie();
      if (savedAuth) {
        currentAuth = savedAuth;
      }

      let serverTokens = null;
      try {
        appData = { students: [], problems: [], curriculum: [], submissions: [] };
        try {
          const response = await fetch('data.json?v=' + Date.now());
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const catalog = await response.json();
          if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) throw new Error('Invalid catalog');
          appData = { ...appData, ...catalog };
          if (appData.auth_tokens) serverTokens = { ...appData.auth_tokens };
        } catch (error) {
          console.warn('Could not load public catalog', error);
          showLiveToast('Không tải được kho bài tập. Vui lòng kiểm tra kết nối và tải lại trang.');
        }

        // 1. Tải danh sách học sinh & bài nộp trực tiếp từ Firebase Realtime Database (Bảo mật tuyệt đối)
        if (typeof fetchStudentsFromFirebase === 'function' && isFirebaseConfigured()) {
          try {
            const fbStudents = await fetchStudentsFromFirebase();
            if (fbStudents && fbStudents.length > 0) {
              appData.students = fbStudents;
              try { localStorage.setItem('cp_cached_students', JSON.stringify(fbStudents)); } catch(e) {}
            }
            const fbSubs = await fetchSubmissionsFromFirebase();
            if (fbSubs && fbSubs.length > 0) {
              const isAdminUser = Boolean(currentAuth && (currentAuth.role === 'admin' || currentAuth.role === 'teacher'));
              const deruckSubs = (typeof isDeruckSubmission === 'function') ? fbSubs.filter(isDeruckSubmission) : fbSubs;
              const sanitizedSubs = (typeof sanitizeSubmissionsForRole === 'function')
                ? sanitizeSubmissionsForRole(deruckSubs, isAdminUser)
                : deruckSubs;
              const subMap = new Map();
              (appData.submissions || []).forEach(s => { if (s && s.id) subMap.set(s.id, s); });
              sanitizedSubs.forEach(s => { if (s && s.id) subMap.set(s.id, s); });
              appData.submissions = Array.from(subMap.values());
              if (typeof archiveSubmissionsLocally === 'function') {
                archiveSubmissionsLocally(appData.submissions, { silent: true });
              }
              if (isAdminUser) {
                try {
                  localStorage.setItem('cp_raw_submissions_v2', JSON.stringify(appData.submissions));
                } catch(e) {}
              }
              try {
                localStorage.setItem('cp_cached_submissions', JSON.stringify(appData.submissions));
              } catch(e) {}
            }
            // 1c. Tải Contests từ Firebase Realtime Database
            if (typeof fetchContestsFromFirebase === 'function') {
              try {
                const fbContests = await fetchContestsFromFirebase();
                if (fbContests && fbContests.length > 0) {
                  appData.contests = fbContests;
                }
              } catch(e) {}
            }

            // 1d. Tải Weekly Homework từ Firebase Realtime Database
            if (typeof fetchWeeklyHomeworkFromFirebase === 'function') {
              try {
                const fbWeekly = await fetchWeeklyHomeworkFromFirebase();
                if (fbWeekly && typeof fbWeekly === 'object' && Object.keys(fbWeekly).length > 0) {
                  appData.weekly_homework = fbWeekly;
                }
              } catch(e) {}
            }
          } catch(fbErr) {
            console.warn("Could not fetch students from Firebase:", fbErr);
          }
        }

        // 1b. Dự phòng: Ghép nối và bảo toàn toàn bộ bài nộp cục bộ (chỉ lưu bài nộp WEB DeruckOJ)
        const cachedSubs = localStorage.getItem('cp_cached_submissions');
        if (cachedSubs) {
          try {
            const parsed = JSON.parse(cachedSubs);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const isAdminUser = Boolean(currentAuth && (currentAuth.role === 'admin' || currentAuth.role === 'teacher'));
              const deruckParsed = (typeof isDeruckSubmission === 'function') ? parsed.filter(isDeruckSubmission) : parsed;
              const sanitizedParsed = (typeof sanitizeSubmissionsForRole === 'function') 
                ? sanitizeSubmissionsForRole(deruckParsed, isAdminUser) 
                : deruckParsed;
              if (!appData.submissions || appData.submissions.length === 0) {
                appData.submissions = sanitizedParsed;
              } else {
                sanitizedParsed.forEach(pSub => {
                  if (pSub && pSub.id && !appData.submissions.some(s => s && s.id === pSub.id)) {
                    appData.submissions.push(pSub);
                  }
                });
              }
              try {
                localStorage.setItem('cp_cached_submissions', JSON.stringify(appData.submissions));
              } catch(e) {}
            }
          } catch(e) {}
        }

        // Kho IndexedDB giữ các bài cũ/offline ngay cả khi Firebase trả về tập dữ liệu ngắn hơn.
        if (typeof loadArchivedSubmissions === 'function' && typeof mergeSubmissionCollections === 'function') {
          const archivedSubs = await loadArchivedSubmissions();
          appData.submissions = mergeSubmissionCollections(archivedSubs, appData.submissions || []);
          if (appData.submissions.length) {
            try { localStorage.setItem('cp_cached_submissions', JSON.stringify(appData.submissions)); } catch(e) {}
            if (typeof archiveSubmissionsLocally === 'function') {
              await archiveSubmissionsLocally(appData.submissions, { silent: true });
            }
          }
        }

        // 2. Dự phòng: Nếu appData.students rỗng (do data.json đã làm sạch và Firebase chưa cấu hình URL hoặc offline)
        if (!appData.students || appData.students.length === 0) {
          const cachedStudents = localStorage.getItem('cp_cached_students');
          if (cachedStudents) {
            try {
              const parsed = JSON.parse(cachedStudents);
              const list = Array.isArray(parsed) ? parsed : (parsed.students || []);
              if (list.length > 0) {
                appData.students = list;
              }
            } catch(e) {}
          }
        }

        // Load local overrides only if user explicitly edited locally and server is not newer
        const localSaved = localStorage.getItem('cp_app_data');
        if (localSaved) {
          try {
            const parsed = JSON.parse(localSaved);
            if (parsed && parsed.students && parsed.students.length > 0) {
              let sStr = (appData && appData.last_updated) ? String(appData.last_updated) : "";
              if (sStr && !sStr.endsWith('Z') && !sStr.includes('+')) sStr += 'Z';
              const serverTime = sStr ? new Date(sStr).getTime() : 0;

              let lStr = parsed.last_updated ? String(parsed.last_updated) : "";
              if (lStr && !lStr.endsWith('Z') && !lStr.includes('+')) lStr += 'Z';
              const localTime = lStr ? new Date(lStr).getTime() : 0;

              const serverStudents = (appData && appData.students) ? appData.students.length : 0;
              const localStudents = (parsed && parsed.students) ? parsed.students.length : 0;

              // If server data is newer or has more students, discard stale localStorage cache
              if (serverTime >= localTime || serverStudents > localStudents) {
                // Keep server students
              } else if (localTime > serverTime && localStudents >= serverStudents) {
                appData.students = parsed.students;
              }
            }
          } catch(e) {
            localStorage.removeItem('cp_app_data');
          }
        }
        if (appData && appData.students) {
          delete appData.auth_tokens;
          appData.students.forEach(s => {
            if (s) delete s.pin;
          });
        }
      } catch (e) {
        console.warn("Could not fetch data.json, using embedded fallback", e);
      }

      if (!appData) appData = { students: [], problems: [], curriculum: [], submissions: [] };

      if (appData) {
        const statS = document.getElementById('stat-students');
        if (statS && appData.students) statS.textContent = appData.students.length;
        const statP = document.getElementById('stat-problems');
        if (statP && appData.problems) statP.textContent = appData.problems.length;

        if (appData.last_updated) {
          try {
            let sStr = String(appData.last_updated);
            if (!sStr.endsWith('Z') && !sStr.includes('+')) sStr += 'Z';
            const d = new Date(sStr);
            const updateEl = document.getElementById('sync-last-updated');
            if (updateEl && !isNaN(d.getTime())) {
              updateEl.textContent = `• Cập nhật: ${d.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})} ${d.toLocaleDateString('vi-VN')}`;
            }
          } catch(e) {}
        }
      }

      // Xóa sạch toàn bộ code mẫu / giải pháp cũ trong localStorage để học sinh tự do viết code
      try {
        if (localStorage.getItem('deruck_template_cleared_v2') !== 'true') {
          Object.keys(localStorage).forEach(k => {
            if (k.startsWith('deruck_code_')) {
              localStorage.removeItem(k);
            }
          });
          localStorage.setItem('deruck_template_cleared_v2', 'true');
        }
      } catch(e) {}

      if (typeof reconcileStudentSolvedState === 'function') {
        reconcileStudentSolvedState();
      }
      renderMatrix();
      renderProblems();
      renderCurriculum();
      renderContests();
      if (typeof renderGlobalSubmissions === 'function') {
        renderGlobalSubmissions();
      }
      startCountdown();

      // Check access authentication via Cookie
      checkAuthSession();

      // Check hash tab routing
      if (window.location.hash) {
        const hashRaw = window.location.hash.replace('#', '');
        if (hashRaw.startsWith('judge-') || hashRaw.startsWith('problem-')) {
          const probId = hashRaw.replace('problem-', '').replace('judge-', '');
          switchTab('problems');
          toggleProblemViewMode('judge');
          setTimeout(() => selectJudgeProblem(probId), 80);
        } else if (hashRaw === 'judge') {
          switchTab('problems');
          toggleProblemViewMode('judge');
        } else if (['home', 'problems', 'submissions', 'leaderboard', 'contests', 'curriculum', 'admin'].includes(hashRaw)) {
          switchTab(hashRaw);
        }
      }

      if (appData && appData.last_updated) {
        lastKnownUpdateTime = appData.last_updated;
      }

      // Start continuous background auto-refresh for problems, curriculum, and student submissions
      startLiveAutoRefresh();
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
    let isRefreshingLive = false;

    async function checkAndApplyLiveUpdates(force = false) {
      if (isRefreshingLive) return;
      // QUOTA PROTECTION: Tự động dừng gọi mạng khi tab đang ẩn / chạy nền
      if (document.hidden && !force) return;

      isRefreshingLive = true;
      try {
        const dbUrl = (typeof getFirebaseDatabaseUrl === 'function') ? getFirebaseDatabaseUrl() : '';
        const fbReady = Boolean(dbUrl && typeof isFirebaseConfigured === 'function' && isFirebaseConfigured());
        let remoteUpdateTime = null;

        if (fbReady) {
          // BẢO VỆ QUOTA TUYỆT ĐỐI (MICRO-POLLING):
          // Chỉ kiểm tra timestamp /metadata/last_updated.json (~25 bytes).
          // 25 bytes mỗi 5s tốn chưa tới 500KB/ngày (gần như 0 quota Firebase)!
          try {
            const metaResp = await fetch(`${dbUrl}/metadata/last_updated.json`, {
              signal: AbortSignal.timeout(3500)
            });
            if (metaResp.ok) {
              remoteUpdateTime = await metaResp.json();
            }
          } catch(e) {}
        }

        // Dự phòng khi Firebase chưa kết nối: Kiểm tra last_updated từ data.json
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
          isRefreshingLive = false;
          return;
        }

        if (lastKnownUpdateTime && remoteUpdateTime === lastKnownUpdateTime && !force) {
          // Máy chủ chưa có thay đổi mới -> Bỏ qua tải toàn bộ để tiết kiệm 100% quota!
          isRefreshingLive = false;
          return;
        }

        console.log('⚡ [5s Auto] Phát hiện cập nhật dữ liệu mới:', remoteUpdateTime);
        lastKnownUpdateTime = remoteUpdateTime;

        // Tải danh sách học sinh mới từ Firebase Realtime Database
        if (fbReady && typeof fetchStudentsFromFirebase === 'function') {
          const fbStudents = await fetchStudentsFromFirebase();
          if (fbStudents && fbStudents.length > 0) {
            appData.students = fbStudents;
            try { localStorage.setItem('cp_cached_students', JSON.stringify(fbStudents)); } catch(e) {}
          }
        }

        // Tải danh sách bài nộp từ Firebase
        if (fbReady && typeof fetchSubmissionsFromFirebase === 'function') {
          const fbSubs = await fetchSubmissionsFromFirebase();
          if (fbSubs && fbSubs.length > 0) {
            const isAdmin = Boolean(currentAuth && (currentAuth.role === 'admin' || currentAuth.role === 'teacher'));
            const deruckSubs = (typeof isDeruckSubmission === 'function') ? fbSubs.filter(isDeruckSubmission) : fbSubs;
            const sanitizedSubs = (typeof sanitizeSubmissionsForRole === 'function')
              ? sanitizeSubmissionsForRole(deruckSubs, isAdmin)
              : deruckSubs;
            const subMap = new Map();
            (appData.submissions || []).forEach(s => { if (s && s.id) subMap.set(s.id, s); });
            sanitizedSubs.forEach(s => { if (s && s.id) subMap.set(s.id, s); });
            appData.submissions = Array.from(subMap.values());
            if (typeof archiveSubmissionsLocally === 'function') {
              archiveSubmissionsLocally(appData.submissions, { silent: true });
            }
            try { localStorage.setItem('cp_cached_submissions', JSON.stringify(appData.submissions)); } catch(e) {}
          }
        }

        // Tải bài tập & bài giảng mới nhất nếu có cập nhật
        try {
          const resCatalog = await fetch('data.json?v=' + Date.now(), { signal: AbortSignal.timeout(4000) });
          if (resCatalog.ok) {
            const catalogData = await resCatalog.json();
            if (catalogData.problems) appData.problems = catalogData.problems;
            if (catalogData.curriculum) appData.curriculum = catalogData.curriculum;
            if (catalogData.contests) appData.contests = catalogData.contests;
          }
        } catch(e) {}

        // Cập nhật số lượng trên thanh tiêu đề
        const statS = document.getElementById('stat-students');
        if (statS && appData.students) statS.textContent = appData.students.length;
        const statP = document.getElementById('stat-problems');
        if (statP && appData.problems) statP.textContent = appData.problems.length;

        try {
          let sStr = String(remoteUpdateTime);
          if (!sStr.endsWith('Z') && !sStr.includes('+')) sStr += 'Z';
          const d = new Date(sStr);
          const updateEl = document.getElementById('sync-last-updated');
          if (updateEl && !isNaN(d.getTime())) {
            updateEl.textContent = `• Cập nhật: ${d.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})} ${d.toLocaleDateString('vi-VN')}`;
          }
        } catch(e) {}

        // Tự động render lại toàn bộ giao diện theo dữ liệu mới
        if (typeof reconcileStudentSolvedState === 'function') {
          reconcileStudentSolvedState();
        }
        renderMatrix();
        renderProblems();
        renderCurriculum();
        renderContests();
        if (typeof renderGlobalSubmissions === 'function') {
          renderGlobalSubmissions();
        }
        if (typeof renderJudgeWorkspace === 'function' && currentProblemViewMode === 'judge') {
          renderJudgeWorkspace();
        }
        if (typeof populateTestcaseProblemDropdowns === 'function') {
          populateTestcaseProblemDropdowns();
        }
        if (typeof renderSubmissionsManagerList === 'function') {
          const smm = document.getElementById('modal-submissions-manager');
          if (smm && !smm.classList.contains('hidden')) {
            renderSubmissionsManagerList();
          }
        }

        if (force) {
          showLiveToast('⚡ Bảng xếp hạng vừa cập nhật dữ liệu mới nhất!');
        }
      } catch(e) {
        console.warn("Live auto refresh error:", e);
      } finally {
        isRefreshingLive = false;
      }
    }

    function startLiveAutoRefresh() {
      // Chu kỳ cập nhật mỗi 5 giây, bảo vệ quota tự động bằng micro-polling
      setInterval(() => {
        checkAndApplyLiveUpdates();
      }, 5000);

      // Tự động kích hoạt kiểm tra ngay khi người dùng chuyển lại vào tab trình duyệt
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          checkAndApplyLiveUpdates();
        }
      });
    }

    // TAB SWITCHING & HASH ROUTING (INCLUDES RETURN HOME)
    function switchTab(tabName) {
      if (tabName === 'admin') {
        if (!currentAuth || (currentAuth.role !== 'admin' && currentAuth.role !== 'teacher')) {
          showAuthModal();
          return;
        }
        renderManagementPanel(currentAdminSubTab);
      }

      if (tabName === 'judge') {
        tabName = 'problems';
        setTimeout(() => toggleProblemViewMode('judge'), 30);
      }

      window.location.hash = tabName;

      const sections = ['home', 'problems', 'submissions', 'leaderboard', 'contests', 'curriculum', 'admin'];
      sections.forEach(s => {
        const el = document.getElementById(`section-${s}`);
        const btn = document.getElementById(`tab-btn-${s}`);
        const mBtn = document.getElementById(`tab-btn-${s}-mobile`);
        if (s === tabName) {
          if (el) el.classList.remove('hidden');
          if (btn) {
            btn.className = "tab-btn active px-2.5 py-1.5 rounded-lg text-white bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 flex items-center gap-1.5 transition font-semibold cursor-pointer";
          }
          if (mBtn) mBtn.className = "tab-btn px-2.5 py-1 rounded-lg whitespace-nowrap bg-indigo-600/30 text-indigo-300 font-semibold";
        } else {
          if (el) el.classList.add('hidden');
          if (btn) {
            btn.className = "tab-btn px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 flex items-center gap-1.5 transition cursor-pointer";
          }
          if (mBtn) mBtn.className = "tab-btn px-2.5 py-1 rounded-lg whitespace-nowrap text-slate-400";
        }
      });
      syncManagementAccess();

      if (tabName === 'problems') {
        if (currentProblemViewMode === 'judge') {
          renderJudgeWorkspace();
        } else if (currentProblemViewMode === 'weekly') {
          renderWeeklyHomework();
        } else {
          renderProblems();
        }
      } else if (tabName === 'submissions') {
        renderGlobalSubmissions();
      } else if (tabName === 'leaderboard') {
        renderMatrix();
      } else if (tabName === 'contests') {
        renderContests();
      }
    }

    // TOGGLE PROBLEM VIEW MODE: 'list' (Catalog) vs 'weekly' (Bài Tập Theo Tuần) vs 'judge' (Online Judge Workspace)
    let currentProblemViewMode = 'list'; // 'list' | 'weekly' | 'judge'
    function toggleProblemViewMode(mode) {
      currentProblemViewMode = mode;
      const listEl = document.getElementById('problems-view-list');
      const weeklyEl = document.getElementById('problems-view-weekly');
      const judgeEl = document.getElementById('problems-view-judge');
      const btnList = document.getElementById('btn-prob-view-list');
      const btnWeekly = document.getElementById('btn-prob-view-weekly');
      const btnJudge = document.getElementById('btn-prob-view-judge');

      const inactiveBtn = "px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition cursor-pointer flex items-center gap-1.5";
      if (btnList) btnList.className = inactiveBtn;
      if (btnWeekly) btnWeekly.className = inactiveBtn;
      if (btnJudge) btnJudge.className = inactiveBtn;

      if (listEl) listEl.classList.add('hidden');
      if (weeklyEl) weeklyEl.classList.add('hidden');
      if (judgeEl) judgeEl.classList.add('hidden');

      if (mode === 'judge') {
        if (judgeEl) judgeEl.classList.remove('hidden');
        if (btnJudge) btnJudge.className = "px-3.5 py-1.5 rounded-lg bg-emerald-600/30 text-emerald-300 font-bold border border-emerald-500/40 transition cursor-pointer flex items-center gap-1.5 shadow";
        renderJudgeWorkspace();
      } else if (mode === 'weekly') {
        if (weeklyEl) weeklyEl.classList.remove('hidden');
        if (btnWeekly) btnWeekly.className = "px-3.5 py-1.5 rounded-lg bg-purple-600/30 text-purple-300 font-bold border border-purple-500/40 transition cursor-pointer flex items-center gap-1.5 shadow";
        renderWeeklyHomework();
      } else {
        if (listEl) listEl.classList.remove('hidden');
        if (btnList) btnList.className = "px-3.5 py-1.5 rounded-lg bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/40 transition cursor-pointer flex items-center gap-1.5 shadow";
        renderProblems();
      }
    }

    // TOGGLE ADMIN STUDENT MANAGEMENT & MINI STATS (INTEGRATED ON LEADERBOARD)
    let currentAdminStudentViewMode = 'ranking'; // 'ranking' | 'tuition'
    function toggleAdminStudentView(mode) {
      currentAdminStudentViewMode = mode;
      const rankContainer = document.getElementById('leaderboard-ranking-container');
      const tuitionContainer = document.getElementById('leaderboard-admin-tuition-container');
      const btnRank = document.getElementById('btn-admin-view-ranking');
      const btnTuition = document.getElementById('btn-admin-view-tuition');

      if (mode === 'tuition') {
        if (rankContainer) rankContainer.classList.add('hidden');
        if (tuitionContainer) tuitionContainer.classList.remove('hidden');
        if (btnRank) btnRank.className = "px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition font-semibold cursor-pointer";
        if (btnTuition) btnTuition.className = "px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 transition cursor-pointer";
        renderAdminStudents();
      } else {
        if (rankContainer) rankContainer.classList.remove('hidden');
        if (tuitionContainer) tuitionContainer.classList.add('hidden');
        if (btnRank) btnRank.className = "px-3 py-1.5 rounded-lg bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/40 transition cursor-pointer";
        if (btnTuition) btnTuition.className = "px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition font-semibold cursor-pointer";
        renderMatrix();
      }
      updateAdminMiniStats();
    }

    function updateAdminMiniStats() {
      if (!appData) return;
      const totalS = appData.students ? appData.students.length : 0;
      const activeS = appData.students ? appData.students.filter(s => (s.status || 'Đang học') === 'Đang học').length : 0;
      const currentMonth = (appData.tuition_months && appData.tuition_months.length > 0) 
        ? appData.tuition_months[appData.tuition_months.length - 1] 
        : 'Tháng 10';
      const tuitionPaidCount = appData.students ? appData.students.filter(s => s.tuition && s.tuition[currentMonth]).length : 0;
      const totalProblems = appData.problems ? appData.problems.length : 0;
      const totalCurriculum = appData.curriculum ? appData.curriculum.length : 0;

      const elTotal = document.getElementById('admin-mini-stat-total');
      const elActive = document.getElementById('admin-mini-stat-active');
      const elTuition = document.getElementById('admin-mini-stat-tuition');
      const elContent = document.getElementById('admin-mini-stat-content');

      if (elTotal) elTotal.textContent = totalS;
      if (elActive) elActive.textContent = activeS;
      if (elTuition) elTuition.textContent = `${tuitionPaidCount} / ${totalS}`;
      if (elContent) elContent.textContent = `${totalCurriculum} / ${totalProblems}`;
    }

    // 1. FILTER & RENDER PUBLIC LEADERBOARD (KHÔNG CHIA THEO LỚP, HIỆN TẤT CẢ HỌC SINH, RATING & TỔNG AC)
    let currentClassFilter = 'all';
    let currentSortMetric = 'rating'; // 'rating' | 'total' | 'week' | 'month' | 'year'
    let currentSortDir = 'desc';

    function setLeaderboardSort(metric) {
      if (currentSortMetric === metric) {
        currentSortDir = currentSortDir === 'desc' ? 'asc' : 'desc';
      } else {
        currentSortMetric = metric;
        currentSortDir = 'desc';
      }
      updateSortUI();
      renderMatrix();
    }

    function updateSortUI() {
      const metrics = ['rating', 'total', 'week', 'month'];
      metrics.forEach(m => {
        const btn = document.getElementById(`sort-btn-${m}`);
        const arrow = document.getElementById(`sort-arrow-${m}`);
        if (btn) {
          if (m === currentSortMetric) {
            btn.className = "sort-pill-btn px-2.5 py-1 rounded-lg font-bold bg-indigo-600 text-white shadow-sm transition flex items-center gap-1";
            if (arrow) {
              arrow.classList.remove('hidden');
              arrow.textContent = currentSortDir === 'desc' ? '↓' : '↑';
            }
          } else {
            btn.className = "sort-pill-btn px-2.5 py-1 rounded-lg font-medium text-slate-400 hover:text-white hover:bg-slate-700/60 transition flex items-center gap-1";
            if (arrow) {
              arrow.classList.add('hidden');
            }
          }
        }
      });
    }

    function sortStudentList(list) {
      return list.slice().sort((a, b) => {
        let valA = 0;
        let valB = 0;

        if (currentSortMetric === 'rating') {
          valA = a.rating !== undefined ? a.rating : 0;
          valB = b.rating !== undefined ? b.rating : 0;
          if (valB !== valA) return currentSortDir === 'desc' ? valB - valA : valA - valB;
          const tB = b.stats ? b.stats.total : (b.solved ? b.solved.length : 0);
          const tA = a.stats ? a.stats.total : (a.solved ? a.solved.length : 0);
          return tB - tA;
        } else if (currentSortMetric === 'total') {
          valA = a.stats ? a.stats.total : (a.solved ? a.solved.length : 0);
          valB = b.stats ? b.stats.total : (b.solved ? b.solved.length : 0);
          if (valB !== valA) return currentSortDir === 'desc' ? valB - valA : valA - valB;
          const rB = b.rating !== undefined ? b.rating : 0;
          const rA = a.rating !== undefined ? a.rating : 0;
          return rB - rA;
        } else if (currentSortMetric === 'week') {
          valA = a.stats ? a.stats.week : 0;
          valB = b.stats ? b.stats.week : 0;
          if (valB !== valA) return currentSortDir === 'desc' ? valB - valA : valA - valB;
        } else if (currentSortMetric === 'month') {
          valA = a.stats ? a.stats.month : 0;
          valB = b.stats ? b.stats.month : 0;
          if (valB !== valA) return currentSortDir === 'desc' ? valB - valA : valA - valB;
        } else if (currentSortMetric === 'year') {
          valA = a.stats ? a.stats.year : 0;
          valB = b.stats ? b.stats.year : 0;
          if (valB !== valA) return currentSortDir === 'desc' ? valB - valA : valA - valB;
        }

        const tB = b.stats ? b.stats.total : (b.solved ? b.solved.length : 0);
        const tA = a.stats ? a.stats.total : (a.solved ? a.solved.length : 0);
        return tB - tA;
      });
    }

    function filterClass(cls) {
      currentClassFilter = cls;
      const ids = [
        { key: 'all', id: 'btn-class-all' },
        { key: 'C++ nâng cao', id: 'btn-class-cppnc' },
        { key: 'C++ cơ bản', id: 'btn-class-cppcb' },
        { key: 'Python cơ bản', id: 'btn-class-pythoncb' },
        { key: 'Python 1-1', id: 'btn-class-python11' }
      ];

      ids.forEach(item => {
        const btn = document.getElementById(item.id);
        if (btn) {
          if (item.key === cls) {
            btn.className = "class-filter-btn px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 transition whitespace-nowrap shadow-sm";
          } else {
            btn.className = "class-filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent transition whitespace-nowrap";
          }
        }
      });
      renderMatrix();
    }

    function filterLeaderboard() {
      const q = document.getElementById('leaderboard-search-input')?.value || '';
      renderMatrix(q);
    }

    function getRatingBadge(rating, title = 'Newbie') {
      if (rating === 0 || title === 'Newbie' || !title || rating <= 1200) {
        return `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-700/40 text-slate-400 border border-slate-700">Newbie ⚪</span>`;
      }
      if (rating >= 2100) {
        return `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">Master 🔴</span>`;
      } else if (rating >= 1900) {
        return `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">Candidate Master 🟣</span>`;
      } else if (rating >= 1600) {
        return `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">Expert 🔵</span>`;
      } else if (rating >= 1400) {
        return `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">Specialist 🔷</span>`;
      } else if (rating >= 1200) {
        return `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Pupil 🟢</span>`;
      } else {
        return `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-700/40 text-slate-400 border border-slate-700">Newbie ⚪</span>`;
      }
    }

    function getThSort(metric, label, extraClass = "text-center") {
      const isActive = currentSortMetric === metric;
      const arrow = isActive ? (currentSortDir === 'desc' ? ' ↓' : ' ↑') : '';
      const activeStyle = isActive 
        ? 'text-indigo-400 font-bold bg-indigo-950/30' 
        : 'text-slate-400 hover:text-white hover:bg-slate-800/60';
      return `<th class="px-3 py-3.5 ${extraClass} cursor-pointer select-none transition ${activeStyle}" onclick="setLeaderboardSort('${metric}')" title="Bấm để sắp xếp theo ${label}">
        <span class="inline-flex items-center gap-1">
          <span>${label}</span>
          <span class="text-xs font-mono font-bold">${arrow}</span>
        </span>
      </th>`;
    }

    // STUDENT PERSONAL PROGRESS CARD (CHỈ HIỆN KHI HỌC SINH ĐĂNG NHẬP)
    function renderPersonalProgressCard() {
      const container = document.getElementById('student-personal-progress-card');
      if (!container) return;

      if (!currentAuth || currentAuth.role !== 'student') {
        container.classList.add('hidden');
        container.innerHTML = '';
        return;
      }

      const student = (appData.students || []).find(s => s.stt === currentAuth.stt || s.name === currentAuth.name);
      if (!student) {
        container.classList.add('hidden');
        return;
      }

      const cCfg = (appData.class_config && appData.class_config[student.class]) || {};
      const classProbIds = cCfg.problem_ids || [];
      const cTotal = cCfg.total_problems || classProbIds.length || (student.class === 'C++' ? 6 : 8);

      const solvedSet = new Set(student.solved || []);
      const targetSolvedCount = classProbIds.filter(pid => solvedSet.has(pid)).length;
      const pct = cTotal > 0 ? Math.min(100, Math.round((targetSolvedCount / cTotal) * 100)) : 0;

      let probBadgesHtml = '';
      if (classProbIds.length > 0) {
        probBadgesHtml = `<div class="flex items-center gap-1.5 flex-wrap pt-2">
          <span class="text-xs text-slate-400 font-semibold mr-1">Nhiệm vụ lớp ${student.class}:</span>
          ${classProbIds.map(pid => {
            const isSolved = solvedSet.has(pid);
            if (isSolved) {
              return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <span>✓</span> ${pid}
              </span>`;
            } else {
              return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                <span>⏳</span> ${pid}
              </span>`;
            }
          }).join('')}
        </div>`;
      }

      container.className = "p-5 rounded-2xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-indigo-950/50 border border-indigo-500/30 shadow-xl space-y-4";
      container.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <span>🎯</span> Tiến Độ Mục Tiêu Cá Nhân Của Bạn
            </div>
            <h3 class="text-lg font-bold text-white flex items-center gap-2">
              <span>👤</span> ${student.name}
              <span class="text-xs px-2 py-0.5 rounded bg-indigo-600/30 text-indigo-300 border border-indigo-500/40">Lớp ${student.class}</span>
            </h3>
            <p class="text-xs text-slate-400">Tiến độ và thông tin làm bài chi tiết được bảo mật riêng tư cho bạn.</p>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <a href="student.html?id=${student.stt}" class="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/25 transition flex items-center gap-1.5">
              <span>👤</span> Xem Hồ Sơ & Heatmap Của Tôi ↗
            </a>
          </div>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between text-xs font-mono">
            <span class="text-slate-300">Tiến độ bài tập lớp ${student.class}: <strong class="text-emerald-400">${targetSolvedCount} / ${cTotal} bài</strong></span>
            <span class="font-bold ${pct === 100 ? 'text-emerald-400' : 'text-indigo-300'}">${pct}%</span>
          </div>
          <div class="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div class="h-2.5 rounded-full ${pct === 100 ? 'bg-emerald-400' : 'bg-gradient-to-r from-indigo-500 to-emerald-400'} transition-all duration-500" style="width: ${pct}%"></div>
          </div>
          ${probBadgesHtml}
        </div>
      `;
      container.classList.remove('hidden');
    }

    function createStudentRow(s, rankIdx) {
      const tr = document.createElement('tr');
      const isCurrentStudent = currentAuth && currentAuth.role === 'student' && (currentAuth.stt === s.stt || currentAuth.name === s.name);
      
      if (isCurrentStudent) {
        tr.className = "bg-indigo-950/40 hover:bg-indigo-950/60 border-l-4 border-indigo-500 transition";
      } else {
        tr.className = "hover:bg-slate-800/40 transition";
      }

      const totalAc = s.solved ? s.solved.length : (s.stats ? s.stats.total : 0);
      const rankMedal = rankIdx === 0 ? '🥇 1' : rankIdx === 1 ? '🥈 2' : rankIdx === 2 ? '🥉 3' : `${rankIdx + 1}`;
      
      const rating = s.rating !== undefined ? s.rating : 0;
      const titleBadge = getRatingBadge(rating, s.title || 'Newbie');

      let cBadge = 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
      if (s.class === 'C++ nâng cao' || s.class === 'C++') {
        cBadge = 'bg-blue-500/15 text-blue-300 border-blue-500/30';
      } else if (s.class === 'C++ cơ bản') {
        cBadge = 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
      } else if (s.class === 'Python cơ bản' || s.class === 'Python') {
        cBadge = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      } else if (s.class === 'Python 1-1') {
        cBadge = 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      }

      const classBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold ${cBadge} border">${s.class}</span>`;

      const stWeek = s.stats ? s.stats.week : 0;
      const stMonth = s.stats ? s.stats.month : totalAc;
      const stYear = s.stats ? s.stats.year : totalAc;
      const stTotal = s.stats ? s.stats.total : totalAc;

      // Personal / Admin profile link permission check
      let profileActionHtml = '';
      if (currentAuth && (currentAuth.role === 'admin' || currentAuth.role === 'teacher')) {
        const isFullAdmin = currentAuth.role === 'admin';
        profileActionHtml = `
          <div class="flex items-center justify-center gap-1.5 whitespace-nowrap">
            <a href="student.html?id=${s.stt}" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/30 transition">
              <span>👤</span> Heatmap
            </a>
            ${isFullAdmin ? `
            <button onclick="openEditStudentModal(${s.stt})" class="px-2 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 transition cursor-pointer" title="Sửa học sinh">
              ✏️
            </button>
            <button onclick="deleteStudent(${s.stt})" class="px-2 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition cursor-pointer" title="Xóa học sinh">
              🗑️
            </button>` : ''}
          </div>
        `;
      } else if (isCurrentStudent) {
        profileActionHtml = `
          <a href="student.html?id=${s.stt}" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition whitespace-nowrap">
            <span>👤</span> Heatmap của bạn ↗
          </a>
        `;
      } else {
        profileActionHtml = `
          <span class="inline-flex items-center px-2 py-1 rounded text-xs text-slate-500 italic select-none">
            🔒 Riêng tư
          </span>
        `;
      }

      const meBadge = isCurrentStudent ? `<span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-500/30 text-indigo-300 border border-indigo-500/50">Bạn</span>` : '';

      tr.innerHTML = `
        <td class="px-2.5 py-2.5 text-center font-bold font-mono text-xs text-slate-300">${rankMedal}</td>
        <td class="px-3 py-2.5 font-semibold text-white">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-bold text-white text-xs sm:text-sm">${s.name}</span>
            ${meBadge}
            ${classBadge}
          </div>
        </td>
        <td class="px-2.5 py-2.5 text-center font-mono">
          <span class="px-2 py-0.5 rounded-md font-mono font-bold text-white bg-slate-800/90 border border-slate-700/80 text-xs">
            ${rating}
          </span>
        </td>
        <td class="px-2.5 py-2.5 text-center">
          ${titleBadge}
        </td>
        <td class="px-2.5 py-2.5 text-center font-mono">
          <span class="text-xs font-semibold ${stWeek > 0 ? 'text-indigo-400' : 'text-slate-500'}">${stWeek}</span>
        </td>
        <td class="px-2.5 py-2.5 text-center font-mono">
          <span class="text-xs font-semibold ${stMonth > 0 ? 'text-purple-300' : 'text-slate-500'}">${stMonth}</span>
        </td>
        <td class="px-2.5 py-2.5 text-center font-mono">
          <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-slate-800 text-emerald-400 border border-slate-700">
            ${stTotal} bài
          </span>
        </td>
        <td class="px-2.5 py-2.5 text-center">
          ${profileActionHtml}
        </td>
      `;
      return tr;
    }

    function renderMatrix(filterText = '') {
      const head = document.getElementById('matrix-head');
      const body = document.getElementById('matrix-body');
      if (!head || !body) return;

      if (!currentAuth) {
        head.innerHTML = '';
        body.innerHTML = `
          <tr>
            <td colspan="8" class="px-4 py-16 text-center text-slate-400">
              <div class="max-w-md mx-auto space-y-4">
                <div class="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-2xl">🔒</div>
                <div class="space-y-1">
                  <div class="font-bold text-white text-base">Bảng Xếp Hạng Được Bảo Mật</div>
                  <div class="text-xs text-slate-400 leading-relaxed">
                    Bắt buộc phải có tài khoản để xem thông tin học sinh, điểm số rating và bảng xếp hạng thi đua.
                  </div>
                </div>
                <button onclick="showAuthModal()" class="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/25 cursor-pointer">
                  🔑 Đăng Nhập Bằng Mã PIN →
                </button>
              </div>
            </td>
          </tr>
        `;
        return;
      }

      const searchInput = document.getElementById('leaderboard-search-input');
      const query = (filterText || (searchInput ? searchInput.value : '')).toLowerCase().trim();

      // Compact Sortable Header
      head.innerHTML = `<tr class="text-[11px] uppercase font-semibold text-slate-400 border-b border-slate-700">
        <th class="px-2.5 py-2.5 text-center w-12">Hạng</th>
        <th class="px-3 py-2.5">Học viên & Lớp</th>
        ${getThSort('rating', 'Rating')}
        <th class="px-2.5 py-2.5 text-center">Danh hiệu</th>
        ${getThSort('week', '1 Tuần')}
        ${getThSort('month', '1 Tháng')}
        ${getThSort('total', 'Tổng AC')}
        <th class="px-2.5 py-2.5 text-center">Hồ sơ</th>
      </tr>`;

      body.innerHTML = '';

      const filterStudentByQuery = (s) => {
        if (!query) return true;
        return s.name.toLowerCase().includes(query) || 
          (s.cf_handle && s.cf_handle.toLowerCase().includes(query)) || 
          (s.vjudge_handle && s.vjudge_handle.toLowerCase().includes(query)) || 
          (s.marisa_handle && s.marisa_handle.toLowerCase().includes(query)) ||
          (s.vnoi_handle && s.vnoi_handle.toLowerCase().includes(query)) ||
          (s.clue_handle && s.clue_handle.toLowerCase().includes(query)) ||
          (s.ctoj_handle && s.ctoj_handle.toLowerCase().includes(query));
      };

      // Filter by class if selected (default 'all' shows all students without class division)
      let studentsToShow = (appData.students || []).filter(filterStudentByQuery);
      if (currentClassFilter !== 'all') {
        studentsToShow = studentsToShow.filter(s => {
          if (s.class === currentClassFilter) return true;
          if (currentClassFilter === 'C++' && (s.class === 'C++ nâng cao' || s.class === 'C++ cơ bản')) return true;
          if (currentClassFilter === 'Python' && (s.class === 'Python cơ bản' || s.class === 'Python 1-1')) return true;
          return false;
        });
      }

      if (studentsToShow.length === 0) {
        body.innerHTML = `
          <tr>
            <td colspan="8" class="px-4 py-12 text-center text-slate-400">
              <div class="text-3xl mb-2">🔍</div>
              <div class="font-bold text-white text-base">Không tìm thấy học sinh nào</div>
              <div class="text-xs text-slate-500 mt-1">Vui lòng thử tìm kiếm với từ khóa khác</div>
            </td>
          </tr>
        `;
        return;
      }

      const sortedList = sortStudentList(studentsToShow);

      sortedList.forEach((s, idx) => {
        body.appendChild(createStudentRow(s, idx));
      });
    }

    // ROLE & PERMISSION CHECK FOR CONTENT (PROBLEMS & CURRICULUM)
    function canViewItem(item) {
      // Chuẩn DeruckOJ: Toàn bộ bài tập trong kho bài tập mở công khai cho tất cả mọi người
      return true;
    }

    // 2. RENDER PROBLEMS
    let currentProblemFilter = 'all';
    let currentProblemClassFilter = 'all';
    let currentProblemDisplayLimit = 60;

    function onProblemSearchChange() {
      currentProblemDisplayLimit = 60;
      renderProblems();
    }

    function loadMoreProblems() {
      currentProblemDisplayLimit += 60;
      renderProblems();
    }

    function filterProblemClass(cls) {
      currentProblemClassFilter = cls;
      currentProblemDisplayLimit = 60;
      const classKeys = [
        { key: 'all', id: 'prob-class-filter-all' },
        { key: 'Public', id: 'prob-class-filter-Public' },
        { key: 'C++ nâng cao', id: 'prob-class-filter-cppnc' },
        { key: 'C++ cơ bản', id: 'prob-class-filter-cppcb' },
        { key: 'Python cơ bản', id: 'prob-class-filter-pythoncb' },
        { key: 'Python 1-1', id: 'prob-class-filter-python11' }
      ];
      classKeys.forEach(item => {
        const btn = document.getElementById(item.id);
        if (btn) {
          if (item.key === cls) {
            btn.className = "prob-class-btn px-3 py-1.5 rounded-lg bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/40 transition";
          } else {
            btn.className = "prob-class-btn px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition";
          }
        }
      });
      renderProblems();
    }

    function filterProblemPlatform(plat) {
      filterProblems(plat);
    }

    function filterProblems(filter = currentProblemFilter) {
      currentProblemFilter = filter;
      currentProblemDisplayLimit = 60;
      ['all', 'DeruckOJ', 'MarisaOJ', 'VJudge', 'Codeforces', 'ChuyenTinPro', 'ClueOJ'].forEach(f => {
        const btn = document.getElementById(`prob-filter-${f}`);
        if (btn) {
          if (f === filter) {
            btn.className = "px-2.5 py-1 rounded-lg bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/40 transition cursor-pointer";
          } else {
            btn.className = "px-2.5 py-1 rounded-lg text-slate-400 hover:text-slate-200 transition cursor-pointer";
          }
        }
      });
      renderProblems(filter);
    }

    function getPlatformName(platform) {
      if (!platform) return 'VJudge';
      const p = platform.toLowerCase();
      if (p.includes('codeforces') || p.includes('cf')) return 'Codeforces';
      if (p.includes('marisa')) return 'MarisaOJ';
      if (p.includes('deruck') || p.includes('judge') || p.includes('nội bộ')) return 'DeruckOJ';
      if (p.includes('chuyentin') || p.includes('ctoj') || p.includes('oj.chuyentin.pro')) return 'ChuyenTinPro';
      if (p.includes('clue') || p.includes('clueoj') || p.includes('oj.clue.edu.vn')) return 'ClueOJ';
      return 'VJudge';
    }

    function renderProblems(filter = currentProblemFilter) {
      const tbody = document.getElementById('problems-table-body');
      const loadMoreContainer = document.getElementById('problems-loadmore-container');
      if (!tbody || !appData || !appData.problems) return;

      tbody.innerHTML = '';
      if (loadMoreContainer) loadMoreContainer.innerHTML = '';

      const totalStudents = (appData.students || []).length;
      const searchInput = document.getElementById('prob-search-input');
      const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

      const filteredList = appData.problems.filter(p => {
        const plat = getPlatformName(p.platform);
        const matchPlat = (filter === 'all' || plat === filter);
        if (!matchPlat) return false;

        // Class / Public filter button
        if (currentProblemClassFilter !== 'all') {
          const pClasses = p.classes || [];
          if (currentProblemClassFilter === 'Public') {
            if (!pClasses.includes('Public') && !pClasses.includes('Tất cả') && pClasses.length > 0) return false;
          } else {
            const matches = pClasses.includes(currentProblemClassFilter) || pClasses.includes('Tất cả');
            if (!matches) return false;
          }
        }

        // Search query filter
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
        countBadge.innerHTML = `<span class="text-slate-400 font-mono">Hiển thị <span class="text-indigo-400 font-bold">${Math.min(filteredList.length, currentProblemDisplayLimit)}</span> / <span class="text-slate-300 font-bold">${filteredList.length}</span> bài DeruckOJ</span>`;
      }

      if (filteredList.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" class="p-12 text-center text-slate-500">
              <div class="text-4xl mb-2">🔍</div>
              <div class="text-sm font-bold text-slate-300">Không tìm thấy bài tập phù hợp</div>
              <p class="text-xs text-slate-400 max-w-md mx-auto mt-1">Vui lòng thử tìm kiếm với từ khóa khác hoặc thay đổi bộ lọc lớp.</p>
            </td>
          </tr>
        `;
        return;
      }

      const itemsToRender = filteredList.slice(0, currentProblemDisplayLimit);
      itemsToRender.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-800/50 transition border-b border-slate-800/60";

        // 1. Status of current user
        let isSolved = false;
        let mySub = null;
        if (currentAuth) {
          if (currentAuth.role === 'student' && appData.students) {
            const me = getActiveStudent();
            if (me && me.solved && me.solved.includes(p.id)) isSolved = true;
          }
          if (appData.submissions) {
            mySub = (typeof findStudentSubmission === 'function')
              ? findStudentSubmission(appData.submissions, p.id, currentAuth)
              : appData.submissions.find(s => s.problem_id === p.id && (s.student_id === currentAuth.pin || s.student_name === currentAuth.name));
          }
        }

        let statusHtml = '<span class="text-slate-600 font-mono text-center block select-none">-</span>';
        if (isSolved || (mySub && (mySub.status === 'Chấm đạt' || mySub.status === 'Hoàn thành'))) {
          statusHtml = '<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold" title="Đã hoàn thành (AC)">✓</span>';
        } else if (mySub) {
          statusHtml = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold" title="${mySub.status || 'Đã nộp'}">⏳</span>`;
        }

        // 2. Problem Code
        const codeHtml = `<span class="font-mono text-xs font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/25 px-2 py-0.5 rounded">${p.id}</span>`;

        // 3. Name & Category tags
        const typesList = p.types || [p.category || 'Cơ bản'];
        const typesHtml = typesList.slice(0, 3).map(t => `<span class="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-950 text-slate-400 border border-slate-800">${t}</span>`).join(' ');
        const nameHtml = `
          <div class="space-y-1 py-1">
            <a href="javascript:void(0)" onclick="openJudgeWithProblem('${p.id}')" class="font-bold text-white hover:text-indigo-300 transition text-xs sm:text-sm line-clamp-1 cursor-pointer">
              ${p.name}
            </a>
            <div class="flex items-center gap-1.5 flex-wrap">
              ${typesHtml}
            </div>
          </div>
        `;

        // 4. Platform Badge (SVG)
        const plat = getPlatformName(p.platform);
        let platBadge = "";
        if (plat === "Codeforces") {
          platBadge = `<span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-950 text-slate-300 border border-slate-800 flex items-center justify-center gap-1 mx-auto w-fit"><svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none"><rect x="1.5" y="9" width="5" height="12" rx="1.5" fill="#E5A93C"/><rect x="9.5" y="3" width="5" height="18" rx="1.5" fill="#318CE7"/><rect x="17.5" y="6" width="5" height="15" rx="1.5" fill="#D9383A"/></svg> <span>CF</span></span>`;
        } else if (plat === "VJudge") {
          platBadge = `<span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-950 text-slate-300 border border-slate-800 flex items-center justify-center gap-1 mx-auto w-fit"><svg class="w-3.5 h-3.5 shrink-0 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg> <span>VJ</span></span>`;
        } else if (plat === "DeruckOJ" || p.platform === "DeruckOJ") {
          platBadge = `<span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center gap-1 mx-auto w-fit"><svg class="w-3.5 h-3.5 shrink-0 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> <span>DeruckOJ</span></span>`;
        } else if (plat === "ChuyenTinPro") {
          platBadge = `<span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-950 text-teal-300 border border-slate-800 flex items-center justify-center gap-1 mx-auto w-fit"><span>🌐</span> <span>ChuyênTin</span></span>`;
        } else if (plat === "ClueOJ") {
          platBadge = `<span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-950 text-cyan-300 border border-slate-800 flex items-center justify-center gap-1 mx-auto w-fit"><span>🧩</span> <span>Clue</span></span>`;
        } else {
          platBadge = `<span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-950 text-slate-300 border border-slate-800 flex items-center justify-center gap-1 mx-auto w-fit"><svg class="w-3.5 h-3.5 shrink-0 text-amber-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.6 7.1.6-5.3 4.7 1.6 7-6.3-3.7-6.3 3.7 1.6-7-5.3-4.7 7.1-.6L12 2z"/></svg> <span>Marisa</span></span>`;
        }

        // 5. Points
        const pointsHtml = `<span class="font-mono text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded block text-center w-fit mx-auto">★ ${p.points || 10}p</span>`;

        // 6. Limits
        const limitsHtml = `<span class="font-mono text-[11px] text-slate-400 block text-center">⏱️ ${p.time_limit || '1.0s'} • 💾 ${p.memory_limit || '256M'}</span>`;

        // 7. AC Solved Rate (Chế độ khách hiển thị dấu -)
        let acHtml = '<div class="text-center font-mono text-xs text-slate-500 select-none">-</div>';
        if (currentAuth) {
          const solvedCount = (appData.students || []).filter(s => s.solved && s.solved.includes(p.id)).length;
          const pct = totalStudents > 0 ? Math.round((solvedCount / totalStudents) * 100) : 0;
          acHtml = `<div class="text-center font-mono text-xs"><strong class="text-emerald-400">${solvedCount}</strong><span class="text-slate-500">/${totalStudents}</span> <span class="text-[10px] text-slate-400">(${pct}%)</span></div>`;
        }

        // 8. Actions
        const adminActions = (currentAuth && (currentAuth.role === 'admin' || currentAuth.role === 'teacher')) ? `
          <button onclick="openEditProblemModal('${p.id}')" class="p-1 rounded text-xs text-indigo-300 hover:text-white bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 transition" title="Sửa bài">✏️</button>
          <button onclick="deleteProblem('${p.id}')" class="p-1 rounded text-xs text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/30 border border-rose-500/30 transition" title="Xóa bài">🗑️</button>
        ` : '';

        const actionHtml = `
          <div class="flex items-center justify-end gap-1.5 whitespace-nowrap">
            ${(p.url && !p.url.startsWith('#judge')) ? `
              <a href="${p.url}" target="_blank" class="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs transition" title="Đề bài gốc trên ${plat}">↗</a>
            ` : ''}
            <button onclick="openSubmitModal('${p.id}')" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition flex items-center gap-1 cursor-pointer active:scale-95" title="Nộp bài làm (Điền đáp án / Dán code)">
              <span>📝</span><span>Nộp bài</span>
            </button>
            <button onclick="openJudgeWithProblem('${p.id}')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1 shadow-sm cursor-pointer active:scale-95" title="Mở DeruckOJ IDE để code và chấm trực tiếp">
              <span>⚡</span><span>Giải bài</span>
            </button>
            ${adminActions}
          </div>
        `;

        tr.innerHTML = `
          <td class="py-3 px-3 text-center">${statusHtml}</td>
          <td class="py-3 px-3">${codeHtml}</td>
          <td class="py-3 px-3">${nameHtml}</td>
          <td class="py-3 px-3 text-center">${platBadge}</td>
          <td class="py-3 px-3 text-center">${pointsHtml}</td>
          <td class="py-3 px-3 text-center hidden md:table-cell">${limitsHtml}</td>
          <td class="py-3 px-3 text-center">${acHtml}</td>
          <td class="py-3 px-3 text-right">${actionHtml}</td>
        `;
        tbody.appendChild(tr);
      });

      if (filteredList.length > currentProblemDisplayLimit && loadMoreContainer) {
        loadMoreContainer.innerHTML = `
          <button onclick="loadMoreProblems()" class="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold transition shadow cursor-pointer">
            ⬇️ Hiển thị thêm bài tập (Đang xem ${currentProblemDisplayLimit} / ${filteredList.length} bài)
          </button>
        `;
      }
    }

    function loadMoreProblems() {
      currentProblemDisplayLimit += 60;
      renderProblems();
    }

    function filterProblemClass(cls) {
      currentProblemClassFilter = cls;
      currentProblemDisplayLimit = 60;
      const classKeys = [
        { key: 'all', id: 'prob-class-filter-all' },
        { key: 'Public', id: 'prob-class-filter-Public' },
        { key: 'C++ nâng cao', id: 'prob-class-filter-cppnc' },
        { key: 'C++ cơ bản', id: 'prob-class-filter-cppcb' },
        { key: 'Python cơ bản', id: 'prob-class-filter-pythoncb' },
        { key: 'Python 1-1', id: 'prob-class-filter-python11' }
      ];
      classKeys.forEach(item => {
        const btn = document.getElementById(item.id);
        if (btn) {
          if (item.key === cls) {
            btn.className = "prob-class-btn px-3 py-1.5 rounded-lg bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/40 transition";
          } else {
            btn.className = "prob-class-btn px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition";
          }
        }
      });
      renderProblems();
    }

    function filterProblemPlatform(plat) {
      filterProblems(plat);
    }

    function filterProblems(filter = currentProblemFilter) {
      currentProblemFilter = filter;
      currentProblemDisplayLimit = 60;
      ['all', 'DeruckOJ', 'MarisaOJ', 'VJudge', 'Codeforces', 'ChuyenTinPro', 'ClueOJ'].forEach(f => {
        const btn = document.getElementById(`prob-filter-${f}`);
        if (btn) {
          if (f === filter) {
            btn.className = "px-2.5 py-1 rounded-lg bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/40 transition cursor-pointer";
          } else {
            btn.className = "px-2.5 py-1 rounded-lg text-slate-400 hover:text-slate-200 transition cursor-pointer";
          }
        }
      });
      renderProblems(filter);
    }

    function getPlatformName(platform) {
      if (!platform) return 'VJudge';
      const p = platform.toLowerCase();
      if (p.includes('codeforces') || p.includes('cf')) return 'Codeforces';
      if (p.includes('marisa')) return 'MarisaOJ';
      if (p.includes('deruck') || p.includes('judge') || p.includes('nội bộ')) return 'DeruckOJ';
      if (p.includes('chuyentin') || p.includes('ctoj') || p.includes('oj.chuyentin.pro')) return 'ChuyenTinPro';
      if (p.includes('clue') || p.includes('clueoj') || p.includes('oj.clue.edu.vn')) return 'ClueOJ';
      return 'VJudge';
    }

    // 3. RENDER CURRICULUM & LECTURES
    let currentCurriculumClassFilter = 'all';

    function filterCurriculumClass(cls) {
      if (currentAuth && currentAuth.role === 'student' && currentAuth.class) {
        cls = currentAuth.class;
      }
      currentCurriculumClassFilter = cls;
      const classKeys = [
        { key: 'all', id: 'curr-class-filter-all' },
        { key: 'Public', id: 'curr-class-filter-Public' },
        { key: 'C++ nâng cao', id: 'curr-class-filter-cppnc' },
        { key: 'C++ cơ bản', id: 'curr-class-filter-cppcb' },
        { key: 'Python cơ bản', id: 'curr-class-filter-pythoncb' },
        { key: 'Python 1-1', id: 'curr-class-filter-python11' }
      ];
      classKeys.forEach(item => {
        const btn = document.getElementById(item.id);
        if (btn) {
          if (item.key === cls) {
            btn.className = "curr-class-btn px-3 py-1.5 rounded-lg bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/40 transition";
          } else {
            btn.className = "curr-class-btn px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition";
          }
        }
      });
      renderCurriculum();
    }

    function getCurriculumLinkInfo(url) {
      if (!url || url === '#' || url === '') {
        return { label: 'Xem Tài Liệu', icon: '📖', color: 'bg-indigo-600 hover:bg-indigo-500' };
      }
      const u = url.toLowerCase();
      if (u.includes('docs.google.com/document') || u.includes('/document/')) {
        return { label: 'Mở Google Docs', icon: '📘', color: 'bg-blue-600 hover:bg-blue-500' };
      }
      if (u.includes('docs.google.com/presentation') || u.includes('/presentation/')) {
        return { label: 'Mở Google Slide', icon: '📊', color: 'bg-amber-600 hover:bg-amber-500' };
      }
      if (u.includes('drive.google.com')) {
        return { label: 'Mở Google Drive', icon: '📁', color: 'bg-emerald-600 hover:bg-emerald-500' };
      }
      if (u.includes('notion.so') || u.includes('notion.site')) {
        return { label: 'Mở Notion', icon: '📝', color: 'bg-slate-700 hover:bg-slate-600' };
      }
      if (u.includes('youtube.com') || u.includes('youtu.be')) {
        return { label: 'Xem Video Giảng', icon: '▶️', color: 'bg-rose-600 hover:bg-rose-500' };
      }
      if (u.endsWith('.pdf') || u.includes('.pdf?')) {
        return { label: 'Xem File PDF', icon: '📕', color: 'bg-rose-700 hover:bg-rose-600' };
      }
      return { label: 'Mở Bài Giảng', icon: '📖', color: 'bg-indigo-600 hover:bg-indigo-500' };
    }

    function renderCurriculum() {
      const list = document.getElementById('curriculum-list');
      if (!list || !appData || !appData.curriculum) return;

      if (!currentAuth) {
        list.innerHTML = `
          <div class="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
            <div class="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-2xl">🔒</div>
            <div class="space-y-1">
              <div class="font-bold text-white text-base">Hệ Thống Bài Giảng Được Bảo Mật</div>
              <p class="text-xs text-slate-400">Bắt buộc phải đăng nhập bằng Mã PIN hoặc Mật khẩu để xem giáo trình và bài giảng lý thuyết.</p>
            </div>
            <button onclick="showAuthModal()" class="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/25 cursor-pointer">
              🔑 Đăng Nhập Bằng Mã PIN →
            </button>
          </div>
        `;
        return;
      }
      list.innerHTML = '';

      let lectures = appData.curriculum.filter(l => {
        if (currentCurriculumClassFilter !== 'all') {
          const lClasses = l.classes || [];
          if (currentCurriculumClassFilter === 'Public') {
            if (!lClasses.includes('Public') && !lClasses.includes('Tất cả') && lClasses.length > 0) return false;
          } else {
            const matches = lClasses.includes(currentCurriculumClassFilter) || lClasses.includes('Tất cả');
            if (!matches) return false;
          }
        }
        return canViewItem(l);
      });

      if (lectures.length === 0) {
        const isTotalEmpty = (!appData.curriculum || appData.curriculum.length === 0);
        list.innerHTML = `
          <div class="p-10 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <div class="text-4xl">${isTotalEmpty ? '📚' : '🔍'}</div>
            <div class="text-sm font-bold text-slate-300">${isTotalEmpty ? 'Chưa có bài giảng nào' : 'Không có bài giảng phù hợp với bộ lọc'}</div>
            <p class="text-xs text-slate-400 max-w-md mx-auto">${isTotalEmpty ? 'Hệ thống đã sẵn sàng! Thầy có thể thêm bài giảng mới từ Google Sheet (tab "Bài Giảng") hoặc bấm nút "+ Thêm bài giảng" ở thanh công cụ Quản trị.' : 'Vui lòng chọn bộ lọc lớp khác để xem bài giảng.'}</p>
          </div>
        `;
        return;
      }

      lectures.forEach((c, idx) => {
        const item = document.createElement('div');
        item.className = "bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 hover:border-slate-700 transition";

        const classesList = c.classes || ['Public'];
        const isPublic = classesList.includes('Public') || classesList.includes('Tất cả') || classesList.length === 0;

        const classesBadges = classesList.filter(cls => cls !== 'Public' && cls !== 'Tất cả').map(cls => {
          let col = 'bg-purple-500/15 text-purple-300 border-purple-500/30';
          if (cls === 'C++ nâng cao' || cls === 'C++') col = 'bg-blue-500/15 text-blue-300 border-blue-500/30';
          else if (cls === 'C++ cơ bản') col = 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
          else if (cls === 'Python cơ bản' || cls === 'Python') col = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
          else if (cls === 'Python 1-1') col = 'bg-purple-500/15 text-purple-300 border-purple-500/30';
          return `<span class="px-2 py-0.5 rounded text-[10px] font-bold ${col} border">${cls}</span>`;
        }).join(' ');

        const publicBadge = isPublic ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">🌐 Public</span>` : '';

        // Admin action buttons
        const adminActions = (currentAuth && (currentAuth.role === 'admin' || currentAuth.role === 'teacher')) ? `
          <div class="flex items-center gap-1.5">
            <button onclick="openEditCurriculumModal('${c.id}')" class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/30 transition cursor-pointer">✏️ Sửa</button>
            <button onclick="deleteCurriculum('${c.id}')" class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition cursor-pointer">🗑️ Xóa</button>
          </div>
        ` : '';

        const linkInfo = getCurriculumLinkInfo(c.url);

        item.innerHTML = `
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-sm font-mono ring-1 ring-indigo-500/30 shrink-0">
                ${String(idx + 1).padStart(2, '0')}
              </div>
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-mono text-xs font-bold text-indigo-400">${c.id} • ${c.chapter || 'Chuyên đề'}</span>
                  ${publicBadge}
                  ${classesBadges}
                </div>
                <h3 class="text-base font-bold text-white mt-0.5">${c.title}</h3>
              </div>
            </div>
            <div class="flex items-center gap-2 flex-wrap shrink-0">
              <a href="${c.url || '#'}" target="_blank" 
                 class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow transition ${linkInfo.color}">
                <span>${linkInfo.icon}</span> ${linkInfo.label} ↗
              </a>
              ${adminActions}
            </div>
          </div>
          ${c.summary ? `<p class="text-xs text-slate-400 leading-relaxed">${c.summary}</p>` : ''}
        `;
        list.appendChild(item);
      });
    }

    // TRIGGER QUICK ADD PROBLEM, CONTEST, WEEKLY HOMEWORK & CURRICULUM
    function triggerAddProblem() {
      if (!currentAuth || (currentAuth.role !== 'admin' && currentAuth.role !== 'teacher')) {
        alert('Chỉ tài khoản Giảng viên hoặc Quản trị viên mới có quyền tạo bài tập mới! Vui lòng đăng nhập.');
        showAuthModal();
        return;
      }
      openAddProblemModal();
    }

    function triggerAddCurriculum() {
      if (!currentAuth || (currentAuth.role !== 'admin' && currentAuth.role !== 'teacher')) {
        alert('Chỉ tài khoản Giảng viên hoặc Quản trị viên mới có quyền tạo bài giảng mới! Vui lòng đăng nhập.');
        showAuthModal();
        return;
      }
      openAddCurriculumModal();
    }

    function triggerAddContest() {
      if (!currentAuth || (currentAuth.role !== 'admin' && currentAuth.role !== 'teacher')) {
        alert('Chỉ tài khoản Giảng viên hoặc Quản trị viên mới có quyền tạo kỳ thi / contest mới! Vui lòng đăng nhập.');
        showAuthModal();
        return;
      }
      openAddContestModal();
    }

    function triggerAddWeeklyHomework(preselectedClass) {
      if (!currentAuth || (currentAuth.role !== 'admin' && currentAuth.role !== 'teacher')) {
        alert('Chỉ tài khoản Giảng viên hoặc Quản trị viên mới có quyền tạo bài tập theo tuần! Vui lòng đăng nhập.');
        showAuthModal();
        return;
      }
      openAddWeeklyHomeworkModal(preselectedClass);
    }

    // MODAL QUICK PERMISSION HELPERS
    function setPublicProblem() {
      const pPub = document.getElementById('prob-class-public');
      if (pPub) pPub.checked = true;
      ['prob-class-cppnc', 'prob-class-cppcb', 'prob-class-pythoncb', 'prob-class-python11'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
      });
    }

    function setAllProblemClasses(val) {
      const pPub = document.getElementById('prob-class-public');
      if (pPub) pPub.checked = false;
      ['prob-class-cppnc', 'prob-class-cppcb', 'prob-class-pythoncb', 'prob-class-python11'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = val;
      });
    }

    function setOnlyProblemClass(cls) {
      const pPub = document.getElementById('prob-class-public');
      if (pPub) pPub.checked = false;
      const elCppnc = document.getElementById('prob-class-cppnc');
      if (elCppnc) elCppnc.checked = (cls === 'C++ nâng cao' || cls === 'C++');
      const elCppcb = document.getElementById('prob-class-cppcb');
      if (elCppcb) elCppcb.checked = (cls === 'C++ cơ bản' || cls === 'C++');
      const elPycb = document.getElementById('prob-class-pythoncb');
      if (elPycb) elPycb.checked = (cls === 'Python cơ bản' || cls === 'Python');
      const elPy11 = document.getElementById('prob-class-python11');
      if (elPy11) elPy11.checked = (cls === 'Python 1-1');
    }

    function setPublicCurriculum() {
      const cPub = document.getElementById('curr-class-public');
      if (cPub) cPub.checked = true;
      ['curr-class-cppnc', 'curr-class-cppcb', 'curr-class-pythoncb', 'curr-class-python11'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
      });
    }

    function setAllCurriculumClasses(val) {
      const cPub = document.getElementById('curr-class-public');
      if (cPub) cPub.checked = false;
      ['curr-class-cppnc', 'curr-class-cppcb', 'curr-class-pythoncb', 'curr-class-python11'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = val;
      });
    }

    function setOnlyCurriculumClass(cls) {
      const cPub = document.getElementById('curr-class-public');
      if (cPub) cPub.checked = false;
      const elCppnc = document.getElementById('curr-class-cppnc');
      if (elCppnc) elCppnc.checked = (cls === 'C++ nâng cao' || cls === 'C++');
      const elCppcb = document.getElementById('curr-class-cppcb');
      if (elCppcb) elCppcb.checked = (cls === 'C++ cơ bản' || cls === 'C++');
      const elPycb = document.getElementById('curr-class-pythoncb');
      if (elPycb) elPycb.checked = (cls === 'Python cơ bản' || cls === 'Python');
      const elPy11 = document.getElementById('curr-class-python11');
      if (elPy11) elPy11.checked = (cls === 'Python 1-1');
    }

    // ============================================================
    // 5. CONTEST MANAGEMENT & STANDINGS ENGINE
    // ============================================================
    let currentContestFilter = 'all';
    let selectedContestProblems = [];

    function toggleContestTypeFields(type) {
      const vFields = document.getElementById('contest-vjudge-fields');
      const iFields = document.getElementById('contest-internal-fields');
      const lblV = document.getElementById('label-contest-type-vjudge');
      const lblI = document.getElementById('label-contest-type-internal');

      if (type === 'internal') {
        if (vFields) vFields.classList.add('hidden');
        if (iFields) iFields.classList.remove('hidden');
        if (lblV) lblV.className = "flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-800 bg-slate-900/60 cursor-pointer transition";
        if (lblI) lblI.className = "flex items-center gap-2.5 p-2.5 rounded-xl border border-purple-500/40 bg-purple-950/30 cursor-pointer transition";
        renderContestProblemPickerList();
      } else {
        if (vFields) vFields.classList.remove('hidden');
        if (iFields) iFields.classList.add('hidden');
        if (lblV) lblV.className = "flex items-center gap-2.5 p-2.5 rounded-xl border border-purple-500/40 bg-purple-950/30 cursor-pointer transition";
        if (lblI) lblI.className = "flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-800 bg-slate-900/60 cursor-pointer transition";
      }
    }

    function renderContestProblemPickerList(filterText = '') {
      const listEl = document.getElementById('contest-available-problems-list');
      if (!listEl || !appData || !appData.problems) return;
      listEl.innerHTML = '';

      const query = (filterText || '').toLowerCase().trim();
      const probs = appData.problems.filter(p => {
        if (!query) return true;
        const name = (p.name || '').toLowerCase();
        const id = (p.id || '').toLowerCase();
        const cat = (p.category || '').toLowerCase();
        return name.includes(query) || id.includes(query) || cat.includes(query);
      });

      if (probs.length === 0) {
        listEl.innerHTML = `<div class="p-3 text-center text-slate-500 text-xs">Không tìm thấy bài tập phù hợp</div>`;
        return;
      }

      probs.slice(0, 50).forEach(p => {
        const isSelected = selectedContestProblems.some(sp => sp.id === p.id);
        const item = document.createElement('label');
        item.className = "flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/60 cursor-pointer transition";
        item.innerHTML = `
          <div class="flex items-center gap-2">
            <input type="checkbox" onchange="toggleContestProblemSelection('${p.id}')" ${isSelected ? 'checked' : ''} class="rounded bg-slate-950 border-slate-700 text-purple-600 focus:ring-0">
            <div>
              <span class="font-mono text-[11px] font-bold text-indigo-400">${p.id}</span>
              <span class="text-white text-xs font-medium ml-1.5">${p.name}</span>
            </div>
          </div>
          <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">${p.platform || 'DeruckOJ'}</span>
        `;
        listEl.appendChild(item);
      });
    }

    function filterContestProblemPicker() {
      const q = document.getElementById('contest-prob-filter-input')?.value || '';
      renderContestProblemPickerList(q);
    }

    function toggleContestProblemSelection(probId) {
      const idx = selectedContestProblems.findIndex(p => p.id === probId);
      if (idx !== -1) {
        selectedContestProblems.splice(idx, 1);
      } else {
        const prob = appData.problems.find(p => p.id === probId);
        if (prob) {
          const letter = String.fromCharCode(65 + selectedContestProblems.length);
          selectedContestProblems.push({
            code: letter,
            id: prob.id,
            name: prob.name,
            points: 100,
            oj: prob.platform || 'DeruckOJ'
          });
        }
      }
      selectedContestProblems.forEach((p, i) => {
        p.code = String.fromCharCode(65 + i);
      });
      updateContestSelectedPillsDisplay();
      filterContestProblemPicker();
    }

    function updateContestSelectedPillsDisplay() {
      const countEl = document.getElementById('contest-selected-count');
      const pillsEl = document.getElementById('contest-selected-pills');
      if (countEl) countEl.textContent = `Đã chọn: ${selectedContestProblems.length} bài`;
      if (!pillsEl) return;
      pillsEl.innerHTML = '';

      if (selectedContestProblems.length === 0) {
        pillsEl.innerHTML = `<span class="text-xs text-slate-500 italic">Chưa chọn bài thi nào. Tick chọn danh sách phía trên.</span>`;
        return;
      }

      selectedContestProblems.forEach(p => {
        const pill = document.createElement('span');
        pill.className = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-purple-950/60 text-purple-300 border border-purple-500/30";
        pill.innerHTML = `
          <strong class="text-white">${p.code}.</strong>
          <span>${p.id}</span>
          <button type="button" onclick="toggleContestProblemSelection('${p.id}')" class="text-purple-400 hover:text-white font-bold ml-1">✕</button>
        `;
        pillsEl.appendChild(pill);
      });
    }

    function openAddContestModal() {
      document.getElementById('modal-contest-title').textContent = 'Thêm Kỳ Thi / Contest Mới';
      document.getElementById('form-contest-id-orig').value = '';
      const nextNum = (appData.contests ? appData.contests.length : 0) + 1;
      document.getElementById('form-contest-id').value = `CONTEST-${String(nextNum).padStart(2, '0')}`;
      document.getElementById('form-contest-title').value = '';
      document.getElementById('form-contest-duration').value = '120';
      document.getElementById('form-contest-format').value = 'ICPC Rules (4 bài)';
      document.getElementById('form-contest-status').value = 'UPCOMING';
      document.getElementById('form-contest-desc').value = '';
      document.getElementById('form-contest-editorial').value = '';
      document.getElementById('form-contest-vjudge-url').value = '';

      const now = new Date();
      now.setDate(now.getDate() + 3);
      now.setHours(19, 30, 0, 0);
      const isoLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      document.getElementById('form-contest-start').value = isoLocal;

      document.getElementById('radio-contest-type-vjudge').checked = true;
      toggleContestTypeFields('vjudge');
      selectedContestProblems = [];
      updateContestSelectedPillsDisplay();

      document.getElementById('modal-contest').classList.remove('hidden');
    }

    function openEditContestModal(contestId) {
      if (!appData || !appData.contests) return;
      const c = appData.contests.find(item => item.id === contestId);
      if (!c) return;

      document.getElementById('modal-contest-title').textContent = `Sửa Kỳ Thi: ${c.title}`;
      document.getElementById('form-contest-id-orig').value = c.id;
      document.getElementById('form-contest-id').value = c.id;
      document.getElementById('form-contest-title').value = c.title;
      document.getElementById('form-contest-duration').value = c.duration_minutes || 120;
      document.getElementById('form-contest-format').value = c.format || 'ICPC Rules';
      document.getElementById('form-contest-status').value = c.status || 'UPCOMING';
      document.getElementById('form-contest-desc').value = c.description || '';
      document.getElementById('form-contest-editorial').value = c.editorial_url || '';

      if (c.start_time) {
        try {
          const d = new Date(c.start_time);
          const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
          document.getElementById('form-contest-start').value = isoLocal;
        } catch(e) {}
      }

      const isInternal = c.type === 'internal' || (c.platform && c.platform.includes('DeruckOJ'));
      if (isInternal) {
        document.getElementById('radio-contest-type-internal').checked = true;
        toggleContestTypeFields('internal');
        selectedContestProblems = Array.isArray(c.problems) ? JSON.parse(JSON.stringify(c.problems)) : [];
        updateContestSelectedPillsDisplay();
      } else {
        document.getElementById('radio-contest-type-vjudge').checked = true;
        toggleContestTypeFields('vjudge');
        document.getElementById('form-contest-vjudge-url').value = c.url || '';
        selectedContestProblems = Array.isArray(c.problems) ? JSON.parse(JSON.stringify(c.problems)) : [];
      }

      document.getElementById('modal-contest').classList.remove('hidden');
    }

    function closeContestModal() {
      document.getElementById('modal-contest').classList.add('hidden');
    }

    async function handleSaveContest(e) {
      e.preventDefault();
      const origId = document.getElementById('form-contest-id-orig').value.trim();
      const id = document.getElementById('form-contest-id').value.trim();
      const title = document.getElementById('form-contest-title').value.trim();
      const startTimeVal = document.getElementById('form-contest-start').value;
      const duration = parseInt(document.getElementById('form-contest-duration').value, 10) || 120;
      const status = document.getElementById('form-contest-status').value;
      const format = document.getElementById('form-contest-format').value.trim() || 'ICPC Rules';
      const desc = document.getElementById('form-contest-desc').value.trim();
      const editorialUrl = document.getElementById('form-contest-editorial').value.trim();
      const isInternal = document.getElementById('radio-contest-type-internal').checked;

      let url = '';
      let platform = 'VJudge';
      let problems = [];

      if (isInternal) {
        platform = 'DeruckOJ (Web)';
        url = '#problems-view-judge';
        problems = selectedContestProblems;
      } else {
        platform = 'VJudge';
        const rawUrl = document.getElementById('form-contest-vjudge-url').value.trim();
        if (/^\d+$/.test(rawUrl)) {
          url = `https://vjudge.net/contest/${rawUrl}`;
        } else if (rawUrl.startsWith('http')) {
          url = rawUrl;
        } else if (rawUrl) {
          url = `https://vjudge.net/contest/${rawUrl}`;
        } else {
          url = 'https://vjudge.net/contest';
        }
        problems = selectedContestProblems.length > 0 ? selectedContestProblems : [
          { code: "A", name: "Bài A", points: 100, oj: "VJudge" },
          { code: "B", name: "Bài B", points: 100, oj: "VJudge" }
        ];
      }

      if (!id || !title) {
        alert("Vui lòng điền mã và tiêu đề contest!");
        return;
      }

      const startTimeIso = startTimeVal ? new Date(startTimeVal).toISOString() : new Date().toISOString();

      if (!appData.contests) appData.contests = [];

      const contestObj = {
        id,
        title,
        platform,
        type: isInternal ? 'internal' : 'vjudge',
        status,
        start_time: startTimeIso,
        duration_minutes: duration,
        format: `${format} (${problems.length} bài)`,
        url,
        editorial_url: editorialUrl,
        problems_count: problems.length,
        description: desc,
        problems,
        standings: []
      };

      if (origId) {
        const idx = appData.contests.findIndex(c => c.id === origId);
        if (idx !== -1) {
          contestObj.standings = appData.contests[idx].standings || [];
          appData.contests[idx] = contestObj;
        } else {
          appData.contests.unshift(contestObj);
        }
      } else {
        appData.contests.unshift(contestObj);
      }

      saveAppDataLocally();
      if (typeof saveContestsToFirebase === 'function') {
        saveContestsToFirebase(appData.contests);
      }
      closeContestModal();
      renderContests();
      startCountdown();
      showLiveToast(`✅ Đã lưu kỳ thi "${title}" thành công!`, "success");
    }

    async function deleteContest(contestId) {
      if (!confirm(`Bạn có chắc chắn muốn xóa kỳ thi "${contestId}" không?`)) return;
      if (!appData || !appData.contests) return;
      appData.contests = appData.contests.filter(c => c.id !== contestId);
      saveAppDataLocally();
      if (typeof saveContestsToFirebase === 'function') {
        saveContestsToFirebase(appData.contests);
      }
      renderContests();
      startCountdown();
      showLiveToast(`🗑️ Đã xóa kỳ thi "${contestId}"`, "info");
    }

    function enterInternalContest(contestId) {
      const c = appData && appData.contests ? appData.contests.find(item => item.id === contestId) : null;
      if (!c) return;

      if (c.problems && c.problems.length > 0) {
        const firstProb = c.problems[0];
        const pid = firstProb.id || firstProb.code;
        openProblemInJudge(pid);
        showLiveToast(`⚔️ Đang vào phòng thi trực tiếp DeruckOJ: ${c.title}!`, "info");
      } else {
        switchTab('problems');
      }
    }

    function computeInternalContestStandings(contest) {
      if (!contest || !contest.problems || !appData || !appData.students) return [];
      const students = appData.students;
      const submissions = appData.submissions || [];
      const standings = [];

      students.forEach(st => {
        const solvedList = (st.solved || []).map(s => String(s).toUpperCase());
        let solvedCount = 0;
        let penalty = 0;
        const probMap = {};

        contest.problems.forEach((p, pIdx) => {
          const pid = (p.id || '').toUpperCase();
          const isSolved = solvedList.includes(pid);
          if (isSolved) {
            solvedCount++;
            const sub = submissions.find(s => s && String(s.problem_id).toUpperCase() === pid && (s.student_name === st.name || s.student_stt === st.stt));
            let timeStr = `${String(15 + pIdx * 20).padStart(2, '0')}:${String(10 + pIdx * 5).padStart(2, '0')}`;
            let minutes = 15 + pIdx * 20;
            if (sub && sub.created_at) {
              try {
                const subDate = new Date(sub.created_at);
                timeStr = subDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
              } catch(e) {}
            }
            penalty += minutes;
            probMap[p.code] = { status: 'AC', time: timeStr };
          } else {
            probMap[p.code] = null;
          }
        });

        if (solvedCount > 0) {
          standings.push({
            name: st.name,
            handle: st.vjudge_handle || st.cf_handle || `stt_${st.stt}`,
            solved: solvedCount,
            penalty: penalty,
            problems: probMap
          });
        }
      });

      standings.sort((a, b) => {
        if (b.solved !== a.solved) return b.solved - a.solved;
        return a.penalty - b.penalty;
      });

      standings.forEach((row, i) => {
        row.rank = i + 1;
      });

      return standings;
    }

    function filterContests(filter) {
      currentContestFilter = filter;
      ['all', 'UPCOMING', 'ENDED'].forEach(f => {
        const btn = document.getElementById(`contest-filter-${f}`);
        if (btn) {
          if (f === filter) {
            btn.className = "px-3 py-1.5 rounded-lg bg-indigo-600/30 text-indigo-300 font-medium transition";
          } else {
            btn.className = "px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition";
          }
        }
      });
      renderContests(filter);
    }

    function toggleStandings(contestId) {
      const el = document.getElementById(`standings-${contestId}`);
      const btn = document.getElementById(`btn-standings-${contestId}`);
      if (!el) return;
      if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        if (btn) btn.innerHTML = `<span>📊</span> Ẩn Bảng Điểm ▲`;
      } else {
        el.classList.add('hidden');
        if (btn) btn.innerHTML = `<span>📊</span> Xem Bảng Điểm ▼`;
      }
    }

    function renderContests(filter = currentContestFilter) {
      const grid = document.getElementById('contests-grid');
      if (!grid || !appData || !appData.contests) return;

      if (!currentAuth) {
        grid.innerHTML = `
          <div class="col-span-full p-12 text-center bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
            <div class="w-14 h-14 mx-auto rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-2xl">🔒</div>
            <div class="space-y-1">
              <div class="font-bold text-white text-base">Đấu Trường & Kỳ Thi Được Bảo Mật</div>
              <p class="text-xs text-slate-400">Bắt buộc phải có tài khoản để tham gia và xem bảng điểm contest.</p>
            </div>
            <button onclick="showAuthModal()" class="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/25 cursor-pointer">
              🔑 Đăng Nhập Bằng Mã PIN →
            </button>
          </div>
        `;
        return;
      }
      grid.innerHTML = '';

      const isAdminOrTeacher = Boolean(currentAuth && (currentAuth.role === 'admin' || currentAuth.role === 'teacher'));
      const list = appData.contests.filter(c => filter === 'all' || c.status === filter);

      if (list.length === 0) {
        grid.innerHTML = `
          <div class="col-span-full p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-slate-400 text-xs">
            Không có kỳ thi nào trong danh mục này.
          </div>
        `;
        return;
      }

      list.forEach(c => {
        const card = document.createElement('div');
        card.className = "bg-slate-900 border border-slate-800 hover:border-purple-500/40 rounded-2xl p-5 space-y-4 flex flex-col justify-between transition group shadow-lg";

        let statusBadge = "";
        if (c.status === "UPCOMING") {
          statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Sắp diễn ra
          </span>`;
        } else if (c.status === "LIVE") {
          statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
            <span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span> ĐANG THI
          </span>`;
        } else {
          statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
            Đã kết thúc
          </span>`;
        }

        const isInternal = c.type === 'internal' || (c.platform && c.platform.includes('DeruckOJ'));
        let typeBadge = isInternal
          ? `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">⚡ DeruckOJ (Web)</span>`
          : `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">🌐 VJudge</span>`;

        // Problems list pills
        let problemsPills = "";
        if (c.problems && c.problems.length > 0) {
          problemsPills = `<div class="flex items-center gap-1.5 flex-wrap pt-1">`;
          c.problems.forEach(p => {
            problemsPills += `
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800/80 text-slate-300 border border-slate-700">
                <strong class="text-purple-400">${p.code}.</strong> ${p.name || p.id}
              </span>
            `;
          });
          problemsPills += `</div>`;
        }

        // Contest Standings (compute if internal and empty)
        let standingsList = (c.standings && c.standings.length > 0) ? c.standings : [];
        if (standingsList.length === 0 && isInternal) {
          standingsList = computeInternalContestStandings(c);
        }

        let standingsSection = '';
        if (standingsList && standingsList.length > 0 && c.problems) {
          let problemHeaders = '';
          c.problems.forEach(p => {
            problemHeaders += `<th class="px-2.5 py-2 text-center text-xs font-mono text-purple-300">Bài ${p.code}</th>`;
          });

          let standingsRows = '';
          standingsList.forEach(row => {
            let rowCells = '';
            c.problems.forEach(p => {
              const res = row.problems ? row.problems[p.code] : null;
              if (res && res.status === 'AC') {
                rowCells += `<td class="px-2.5 py-2 text-center">
                  <span class="inline-flex flex-col items-center px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold leading-tight" title="AC lúc ${res.time}">
                    <span>AC</span>
                    <span class="text-[8px] text-emerald-400 font-normal">${res.time}</span>
                  </span>
                </td>`;
              } else {
                rowCells += `<td class="px-2.5 py-2 text-center text-slate-600 font-mono text-xs">-</td>`;
              }
            });

            standingsRows += `
              <tr class="border-b border-slate-800/60 hover:bg-slate-800/30 transition">
                <td class="px-2.5 py-2 text-center font-bold font-mono text-xs text-slate-300">${row.rank}</td>
                <td class="px-2.5 py-2 font-medium text-xs text-white">
                  <div>${row.name}</div>
                  <div class="text-[10px] text-slate-500 font-mono">${row.handle}</div>
                </td>
                <td class="px-2.5 py-2 text-center">
                  <span class="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono font-bold text-xs">${row.solved}/${c.problems.length}</span>
                </td>
                <td class="px-2.5 py-2 text-center font-mono text-xs text-slate-400">${row.penalty}'</td>
                ${rowCells}
              </tr>
            `;
          });

          standingsSection = `
            <div id="standings-${c.id}" class="hidden mt-3 overflow-x-auto border border-purple-500/30 rounded-xl bg-slate-950/80 p-3 shadow-inner">
              <div class="text-xs font-bold text-purple-300 mb-2 flex items-center justify-between">
                <span>📊 Bảng Điểm Contest: Ai Đã AC Bài Nào</span>
                <span class="text-[10px] text-slate-400 font-normal">Xếp hạng theo luật ICPC</span>
              </div>
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-800/80 text-[11px] uppercase font-semibold text-slate-400 border-b border-slate-700">
                  <tr>
                    <th class="px-2.5 py-2 text-center w-10">Hạng</th>
                    <th class="px-2.5 py-2">Thí sinh</th>
                    <th class="px-2.5 py-2 text-center">AC</th>
                    <th class="px-2.5 py-2 text-center">Phút</th>
                    ${problemHeaders}
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/50">
                  ${standingsRows}
                </tbody>
              </table>
            </div>
          `;
        }

        // Action buttons
        let actions = ``;
        if (isInternal) {
          actions = `
            <button onclick="enterInternalContest('${c.id}')" class="px-3.5 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/20 flex items-center gap-1.5 transition cursor-pointer">
              <span>⚡</span> Vào Thi Trên Web (DeruckOJ) →
            </button>
            ${standingsSection ? `
              <button onclick="toggleStandings('${c.id}')" id="btn-standings-${c.id}" class="px-3 py-2 rounded-lg text-xs font-semibold bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/30 transition flex items-center gap-1 cursor-pointer">
                <span>📊</span> Xem Bảng Điểm ▼
              </button>
            ` : ''}
          `;
        } else {
          if (c.status === 'UPCOMING' || c.status === 'LIVE') {
            actions = `
              <a href="${c.url}" target="_blank" class="px-3.5 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/20 flex items-center gap-1.5 transition">
                <span>⚔️</span> Vào Phòng Thi VJudge ↗
              </a>
              ${standingsSection ? `
                <button onclick="toggleStandings('${c.id}')" id="btn-standings-${c.id}" class="px-3 py-2 rounded-lg text-xs font-semibold bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/30 transition flex items-center gap-1 cursor-pointer">
                  <span>📊</span> Xem Bảng Điểm ▼
                </button>
              ` : ''}
            `;
          } else {
            actions = `
              ${standingsSection ? `
                <button onclick="toggleStandings('${c.id}')" id="btn-standings-${c.id}" class="px-3.5 py-2 rounded-lg text-xs font-bold bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/40 border border-indigo-500/40 transition flex items-center gap-1.5 cursor-pointer">
                  <span>📊</span> Xem Bảng Điểm ▼
                </button>
              ` : ''}
              <a href="${c.url}" target="_blank" class="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition">
                Làm lại (Upsolve) ↗
              </a>
              ${c.editorial_url ? `
                <a href="${c.editorial_url}" target="_blank" class="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition">
                  Lời giải 📄
                </a>
              ` : ''}
            `;
          }
        }

        // Admin Edit & Delete buttons
        let adminButtons = '';
        if (isAdminOrTeacher) {
          adminButtons = `
            <div class="flex items-center gap-1.5">
              <button onclick="openEditContestModal('${c.id}')" class="px-2 py-1 rounded-lg text-xs font-semibold bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/30 transition cursor-pointer">✏️ Sửa</button>
              <button onclick="deleteContest('${c.id}')" class="px-2 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition cursor-pointer">🗑️ Xóa</button>
            </div>
          `;
        }

        card.innerHTML = `
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="font-mono text-xs text-purple-400 font-bold">${c.id}</span>
                ${typeBadge}
              </div>
              <div class="flex items-center gap-2">
                ${statusBadge}
                ${adminButtons}
              </div>
            </div>

            <div>
              <h3 class="text-base font-bold text-white group-hover:text-purple-300 transition">${c.title}</h3>
              <p class="text-xs text-slate-400 mt-1 leading-relaxed">${c.description || ''}</p>
            </div>
            
            <div class="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-800/80 text-slate-400">
              <div>Thời lượng: <strong class="text-slate-200">${c.duration_minutes} phút</strong></div>
              <div>Thể thức: <strong class="text-slate-200">${c.format}</strong></div>
              <div>Nền tảng: <strong class="text-slate-200">${c.platform}</strong></div>
              <div>Số lượng: <strong class="text-slate-200">${c.problems ? c.problems.length : c.problems_count} bài</strong></div>
            </div>

            ${problemsPills ? `
              <div>
                <div class="text-[11px] uppercase font-semibold text-slate-500 mb-1.5">Danh sách bài thi:</div>
                ${problemsPills}
              </div>
            ` : ''}

            ${c.winner ? `
              <div class="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <span>👑</span> <strong>Quán quân:</strong> ${c.winner}
              </div>
            ` : ''}

            <!-- Standings Table Container -->
            ${standingsSection}
          </div>

          <div class="pt-3 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2">
            ${actions}
          </div>
        `;
        grid.appendChild(card);
      });
    }

    // ============================================================
    // 6. WEEKLY HOMEWORK ENGINE (BÀI TẬP THEO TUẦN HỌC)
    // ============================================================
    let currentWeeklyClass = 'C++ cơ bản';
    let selectedWeeklyProblems = [];

    function filterWeeklyClass(className) {
      currentWeeklyClass = className;
      ['C++ cơ bản', 'C++ nâng cao', 'Python cơ bản', 'Python 1-1'].forEach(cls => {
        const btnId = cls === 'C++ cơ bản' ? 'weekly-filter-cppcb' :
                      cls === 'C++ nâng cao' ? 'weekly-filter-cppnc' :
                      cls === 'Python cơ bản' ? 'weekly-filter-pythoncb' : 'weekly-filter-python11';
        const btn = document.getElementById(btnId);
        if (btn) {
          if (cls === className) {
            btn.className = "weekly-class-btn px-3 py-1.5 rounded-xl bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/40 transition cursor-pointer";
          } else {
            btn.className = "weekly-class-btn px-3 py-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer";
          }
        }
      });
      renderWeeklyHomework();
    }

    function renderWeeklyHomework() {
      const container = document.getElementById('weekly-homework-list');
      const banner = document.getElementById('weekly-student-progress-banner');
      if (!container) return;

      const weeks = (appData && appData.weekly_homework && appData.weekly_homework[currentWeeklyClass]) || [];

      // Find current student if logged in
      const currentStudent = (currentAuth && currentAuth.role === 'student' && appData && appData.students)
        ? appData.students.find(s => s.name === currentAuth.name || s.stt === currentAuth.stt)
        : null;
      const studentSolvedSet = new Set((currentStudent && currentStudent.solved) || []);

      // Render student progress banner
      if (banner) {
        if (currentStudent && currentAuth.class === currentWeeklyClass) {
          let totalClassProbs = 0;
          let solvedClassProbs = 0;
          let fullyCompletedWeeks = 0;

          weeks.forEach(w => {
            const pids = w.problem_ids || [];
            totalClassProbs += pids.length;
            const sCount = pids.filter(id => studentSolvedSet.has(id)).length;
            solvedClassProbs += sCount;
            if (pids.length > 0 && sCount === pids.length) fullyCompletedWeeks++;
          });

          const pct = totalClassProbs > 0 ? Math.round((solvedClassProbs / totalClassProbs) * 100) : 0;

          banner.className = "p-5 rounded-2xl bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/70 border border-purple-500/30 shadow-xl space-y-3";
          banner.innerHTML = `
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="space-y-1">
                <div class="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  <span>🎯</span> Tiến Độ Theo Tuần Của Bạn
                </div>
                <h3 class="text-base font-bold text-white flex items-center gap-2">
                  <span>👤</span> ${currentStudent.name} • Lớp ${currentWeeklyClass}
                </h3>
              </div>
              <div class="flex items-center gap-3 text-xs font-mono">
                <div class="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
                  <div class="font-bold text-emerald-400">${fullyCompletedWeeks} / ${weeks.length}</div>
                  <div class="text-[10px] text-slate-500 uppercase">Tuần Đạt 100%</div>
                </div>
                <div class="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
                  <div class="font-bold text-indigo-300">${solvedClassProbs} / ${totalClassProbs}</div>
                  <div class="text-[10px] text-slate-500 uppercase">Bài Đã AC</div>
                </div>
              </div>
            </div>

            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs font-mono">
                <span class="text-slate-300">Tổng quan hoàn thành: <strong class="text-emerald-400">${pct}%</strong></span>
                <span class="text-slate-400 text-[11px]">${solvedClassProbs}/${totalClassProbs} bài tập</span>
              </div>
              <div class="w-full bg-slate-800/80 rounded-full h-2.5 overflow-hidden">
                <div class="h-2.5 rounded-full ${pct === 100 ? 'bg-emerald-400' : 'bg-gradient-to-r from-purple-500 to-indigo-500'} transition-all duration-500" style="width: ${pct}%"></div>
              </div>
            </div>
          `;
          banner.classList.remove('hidden');
        } else {
          banner.classList.add('hidden');
        }
      }

      container.innerHTML = '';

      if (weeks.length === 0) {
        container.innerHTML = `
          <div class="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
            <div class="w-14 h-14 mx-auto rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-2xl">📅</div>
            <div class="space-y-1">
              <h3 class="font-bold text-white text-base">Chưa có bài tập theo tuần cho lớp ${currentWeeklyClass}</h3>
              <p class="text-xs text-slate-400">Giảng viên có thể bấm nút "Thêm Tuần Mới" bên trên để giao bài tập theo tuần.</p>
            </div>
            <button onclick="triggerAddWeeklyHomework('${currentWeeklyClass}')" class="admin-only-btn px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 transition shadow">
              ➕ Thêm Tuần Đầu Tiên →
            </button>
          </div>
        `;
        return;
      }

      const isAdminOrTeacher = Boolean(currentAuth && (currentAuth.role === 'admin' || currentAuth.role === 'teacher'));
      const probMap = {};
      if (appData.problems) {
        appData.problems.forEach(p => { probMap[p.id] = p; });
      }

      weeks.forEach((w) => {
        const pids = w.problem_ids || [];
        const solvedCount = pids.filter(id => studentSolvedSet.has(id)).length;
        const totalCount = pids.length;
        const pct = totalCount > 0 ? Math.round((solvedCount / totalCount) * 100) : 0;

        let deadlineBadge = '';
        if (w.deadline) {
          const d = new Date(w.deadline);
          const isPast = d.getTime() < Date.now();
          const dStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          if (isPast) {
            deadlineBadge = `<span class="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-rose-500/10 text-rose-300 border border-rose-500/20">⏰ Hạn: ${dStr} (Đã hết hạn)</span>`;
          } else {
            deadlineBadge = `<span class="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">⏰ Hạn: ${dStr}</span>`;
          }
        }

        let probRows = '';
        pids.forEach((pid, idx) => {
          const p = probMap[pid] || { id: pid, name: pid, platform: 'DeruckOJ', points: 100 };
          const isAC = studentSolvedSet.has(pid);
          const isDeruck = isDeruckProblem(pid, p);

          let solveAction = '';
          if (isDeruck) {
            solveAction = `
              <button onclick="openProblemInJudge('${pid}')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 transition flex items-center gap-1.5 cursor-pointer shadow-sm">
                <span>⚡</span> Chấm trên Web
              </button>
            `;
          } else {
            solveAction = `
              <div class="flex items-center gap-1.5 justify-end">
                <a href="${p.url || '#'}" target="_blank" class="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition">
                  ↗ Đề bài
                </a>
                <button onclick="openSubmitModal('${pid}')" class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 transition">
                  ⚡ Nộp bài
                </button>
              </div>
            `;
          }

          probRows += `
            <tr class="border-b border-slate-800/60 hover:bg-slate-800/30 transition">
              <td class="px-3 py-2.5 text-center text-xs font-mono text-slate-500">${idx + 1}</td>
              <td class="px-3 py-2.5 text-center">
                ${isAC ? `
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <span>✓</span> AC
                  </span>
                ` : `
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono text-slate-500 bg-slate-800/80 border border-slate-700">
                    <span>⏳</span> Chưa
                  </span>
                `}
              </td>
              <td class="px-3 py-2.5 font-mono text-xs font-bold text-indigo-400">
                ${isDeruck ? `<a href="javascript:void(0)" onclick="openProblemInJudge('${pid}')" class="hover:underline">${pid}</a>` : pid}
              </td>
              <td class="px-3 py-2.5 font-medium text-xs text-white">
                <div>${p.name || pid}</div>
                <div class="text-[10px] text-slate-500 font-normal">${p.category || p.difficulty || ''}</div>
              </td>
              <td class="px-3 py-2.5 text-center text-xs font-mono text-purple-300">${p.platform || 'DeruckOJ'}</td>
              <td class="px-3 py-2.5 text-right">${solveAction}</td>
            </tr>
          `;
        });

        let adminControls = '';
        if (isAdminOrTeacher) {
          adminControls = `
            <div class="flex items-center gap-1.5 shrink-0">
              <button onclick="openEditWeeklyHomeworkModal('${currentWeeklyClass}', ${w.week})" class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/30 transition cursor-pointer">
                ✏️ Sửa tuần
              </button>
              <button onclick="deleteWeeklyHomework('${currentWeeklyClass}', ${w.week})" class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition cursor-pointer">
                🗑️ Xóa
              </button>
            </div>
          `;
        }

        const card = document.createElement('div');
        card.className = "bg-slate-900 border border-slate-800 hover:border-purple-500/30 rounded-2xl p-5 space-y-4 transition shadow-lg";
        card.innerHTML = `
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div class="space-y-1.5">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="px-2.5 py-1 rounded-lg text-xs font-mono font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Tuần ${w.week}
                </span>
                ${deadlineBadge}
                ${currentStudent ? `
                  <span class="px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${pct === 100 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'}">
                    ${solvedCount}/${totalCount} bài (${pct}%)
                  </span>
                ` : ''}
              </div>
              <h3 class="text-base sm:text-lg font-bold text-white tracking-tight">${w.title}</h3>
              ${w.description ? `<p class="text-xs text-slate-400 leading-relaxed">${w.description}</p>` : ''}
            </div>
            ${adminControls}
          </div>

          <!-- Problem Table for this week -->
          <div class="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/60 shadow-inner">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-800/80 text-[11px] uppercase font-semibold text-slate-400 border-b border-slate-700">
                <tr>
                  <th class="px-3 py-2 text-center w-10">TT</th>
                  <th class="px-3 py-2 text-center w-16">Kết quả</th>
                  <th class="px-3 py-2 w-28">Mã bài</th>
                  <th class="px-3 py-2">Tên bài tập</th>
                  <th class="px-3 py-2 text-center w-24">Nền tảng</th>
                  <th class="px-3 py-2 text-right w-36">Thao tác</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60">
                ${probRows}
              </tbody>
            </table>
          </div>
        `;
        container.appendChild(card);
      });
    }

    function openAddWeeklyHomeworkModal(preselectedClass) {
      document.getElementById('modal-weekly-title').textContent = 'Thêm Bài Tập Theo Tuần Học';
      document.getElementById('form-weekly-orig-week').value = '';

      const targetClass = preselectedClass || currentWeeklyClass || 'C++ cơ bản';
      document.getElementById('form-weekly-class').value = targetClass;

      const existingWeeks = (appData && appData.weekly_homework && appData.weekly_homework[targetClass]) || [];
      const nextWeekNum = existingWeeks.length + 1;
      document.getElementById('form-weekly-num').value = nextWeekNum;
      document.getElementById('form-weekly-week-title').value = `Tuần ${nextWeekNum}: `;
      document.getElementById('form-weekly-id').value = `WEEK-${targetClass.includes('C++') ? 'CPP' : 'PY'}-${String(nextWeekNum).padStart(2, '0')}`;
      document.getElementById('form-weekly-desc').value = '';

      const now = new Date();
      now.setDate(now.getDate() + 7);
      now.setHours(23, 59, 0, 0);
      const isoLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      document.getElementById('form-weekly-deadline').value = isoLocal;

      selectedWeeklyProblems = [];
      updateWeeklySelectedPillsDisplay();
      renderWeeklyProblemPickerList();

      document.getElementById('modal-weekly-homework').classList.remove('hidden');
    }

    function openEditWeeklyHomeworkModal(className, weekNum) {
      if (!appData || !appData.weekly_homework || !appData.weekly_homework[className]) return;
      const w = appData.weekly_homework[className].find(item => item.week === Number(weekNum));
      if (!w) return;

      document.getElementById('modal-weekly-title').textContent = `Sửa Bài Tập Tuần ${weekNum} (${className})`;
      document.getElementById('form-weekly-orig-week').value = String(w.week);
      document.getElementById('form-weekly-class').value = className;
      document.getElementById('form-weekly-num').value = w.week;
      document.getElementById('form-weekly-week-title').value = w.title || '';
      document.getElementById('form-weekly-id').value = w.id || '';
      document.getElementById('form-weekly-desc').value = w.description || '';

      if (w.deadline) {
        try {
          const d = new Date(w.deadline);
          const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
          document.getElementById('form-weekly-deadline').value = isoLocal;
        } catch(e) {}
      }

      selectedWeeklyProblems = Array.isArray(w.problem_ids) ? [...w.problem_ids] : [];
      updateWeeklySelectedPillsDisplay();
      renderWeeklyProblemPickerList();

      document.getElementById('modal-weekly-homework').classList.remove('hidden');
    }

    function closeWeeklyHomeworkModal() {
      document.getElementById('modal-weekly-homework').classList.add('hidden');
    }

    function onWeeklyClassChange(cls) {
      renderWeeklyProblemPickerList();
    }

    function renderWeeklyProblemPickerList(filterText = '') {
      const listEl = document.getElementById('weekly-available-problems-list');
      if (!listEl || !appData || !appData.problems) return;
      listEl.innerHTML = '';

      const query = (filterText || '').toLowerCase().trim();

      const probs = appData.problems.filter(p => {
        if (query) {
          const name = (p.name || '').toLowerCase();
          const id = (p.id || '').toLowerCase();
          const cat = (p.category || '').toLowerCase();
          if (!name.includes(query) && !id.includes(query) && !cat.includes(query)) return false;
        }
        return true;
      });

      if (probs.length === 0) {
        listEl.innerHTML = `<div class="p-3 text-center text-slate-500 text-xs">Không tìm thấy bài tập nào</div>`;
        return;
      }

      probs.slice(0, 60).forEach(p => {
        const isSelected = selectedWeeklyProblems.includes(p.id);
        const item = document.createElement('label');
        item.className = "flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/60 cursor-pointer transition";
        item.innerHTML = `
          <div class="flex items-center gap-2">
            <input type="checkbox" onchange="toggleWeeklyProblemSelection('${p.id}')" ${isSelected ? 'checked' : ''} class="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0">
            <div>
              <span class="font-mono text-[11px] font-bold text-indigo-400">${p.id}</span>
              <span class="text-white text-xs font-medium ml-1.5">${p.name}</span>
            </div>
          </div>
          <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">${p.platform || 'DeruckOJ'}</span>
        `;
        listEl.appendChild(item);
      });
    }

    function filterWeeklyProblemPicker() {
      const q = document.getElementById('weekly-prob-filter-input')?.value || '';
      renderWeeklyProblemPickerList(q);
    }

    function toggleWeeklyProblemSelection(probId) {
      const idx = selectedWeeklyProblems.indexOf(probId);
      if (idx !== -1) {
        selectedWeeklyProblems.splice(idx, 1);
      } else {
        selectedWeeklyProblems.push(probId);
      }
      updateWeeklySelectedPillsDisplay();
      filterWeeklyProblemPicker();
    }

    function updateWeeklySelectedPillsDisplay() {
      const countEl = document.getElementById('weekly-selected-count');
      const pillsEl = document.getElementById('weekly-selected-pills');
      if (countEl) countEl.textContent = `Đã chọn: ${selectedWeeklyProblems.length} bài`;
      if (!pillsEl) return;
      pillsEl.innerHTML = '';

      if (selectedWeeklyProblems.length === 0) {
        pillsEl.innerHTML = `<span class="text-xs text-slate-500 italic">Chưa chọn bài tập nào. Tick chọn danh sách phía trên.</span>`;
        return;
      }

      selectedWeeklyProblems.forEach(pid => {
        const pill = document.createElement('span');
        pill.className = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-indigo-950/60 text-indigo-300 border border-indigo-500/30";
        pill.innerHTML = `
          <span>${pid}</span>
          <button type="button" onclick="toggleWeeklyProblemSelection('${pid}')" class="text-indigo-400 hover:text-white font-bold ml-1">✕</button>
        `;
        pillsEl.appendChild(pill);
      });
    }

    async function handleSaveWeeklyHomework(e) {
      e.preventDefault();
      const origWeekStr = document.getElementById('form-weekly-orig-week').value.trim();
      const className = document.getElementById('form-weekly-class').value;
      const weekNum = parseInt(document.getElementById('form-weekly-num').value, 10);
      const title = document.getElementById('form-weekly-week-title').value.trim();
      const idVal = document.getElementById('form-weekly-id').value.trim() || `WEEK-${weekNum}`;
      const deadlineVal = document.getElementById('form-weekly-deadline').value;
      const desc = document.getElementById('form-weekly-desc').value.trim();

      if (!className || isNaN(weekNum) || !title) {
        alert("Vui lòng điền đầy đủ Lớp, Tuần số và Tiêu đề tuần!");
        return;
      }

      if (selectedWeeklyProblems.length === 0) {
        alert("Vui lòng chọn ít nhất 1 bài tập cho tuần này!");
        return;
      }

      if (!appData.weekly_homework) appData.weekly_homework = {};
      if (!appData.weekly_homework[className]) appData.weekly_homework[className] = [];

      const weekObj = {
        id: idVal,
        week: weekNum,
        title: title,
        deadline: deadlineVal ? new Date(deadlineVal).toISOString() : null,
        description: desc,
        problem_ids: [...selectedWeeklyProblems]
      };

      if (origWeekStr) {
        const origWeek = parseInt(origWeekStr, 10);
        const idx = appData.weekly_homework[className].findIndex(w => w.week === origWeek);
        if (idx !== -1) {
          appData.weekly_homework[className][idx] = weekObj;
        } else {
          appData.weekly_homework[className].push(weekObj);
        }
      } else {
        const existingIdx = appData.weekly_homework[className].findIndex(w => w.week === weekNum);
        if (existingIdx !== -1) {
          if (!confirm(`Tuần ${weekNum} đã tồn tại trong lớp ${className}. Bạn có muốn ghi đè không?`)) return;
          appData.weekly_homework[className][existingIdx] = weekObj;
        } else {
          appData.weekly_homework[className].push(weekObj);
        }
      }

      appData.weekly_homework[className].sort((a, b) => a.week - b.week);

      if (appData.class_config && appData.class_config[className]) {
        const ccfg = appData.class_config[className];
        if (!ccfg.problem_ids) ccfg.problem_ids = [];
        selectedWeeklyProblems.forEach(pid => {
          if (!ccfg.problem_ids.includes(pid)) {
            ccfg.problem_ids.push(pid);
          }
        });
        ccfg.total_problems = ccfg.problem_ids.length;
      }

      saveAppDataLocally();
      if (typeof saveWeeklyHomeworkToFirebase === 'function') {
        saveWeeklyHomeworkToFirebase(appData.weekly_homework);
      }

      closeWeeklyHomeworkModal();
      currentWeeklyClass = className;
      filterWeeklyClass(className);
      renderProblems();
      showLiveToast(`✅ Đã lưu bài tập Tuần ${weekNum} cho lớp ${className}!`, "success");
    }

    async function deleteWeeklyHomework(className, weekNum) {
      if (!confirm(`Bạn có chắc chắn muốn xóa bài tập Tuần ${weekNum} của lớp "${className}" không?`)) return;
      if (!appData || !appData.weekly_homework || !appData.weekly_homework[className]) return;

      appData.weekly_homework[className] = appData.weekly_homework[className].filter(w => w.week !== Number(weekNum));
      saveAppDataLocally();
      if (typeof saveWeeklyHomeworkToFirebase === 'function') {
        saveWeeklyHomeworkToFirebase(appData.weekly_homework);
      }
      renderWeeklyHomework();
      showLiveToast(`🗑️ Đã xóa bài tập Tuần ${weekNum} của lớp ${className}`, "info");
    }

    function openProblemInJudge(probId) {
      switchTab('problems');
      toggleProblemViewMode('judge');
      setTimeout(() => {
        if (typeof selectJudgeProblem === 'function') {
          selectJudgeProblem(probId);
        }
      }, 60);
    }


    function startCountdown() {
      const upcoming = appData.contests ? appData.contests.find(c => c.status === "UPCOMING") : null;
      if (!upcoming) return;

      const titleEl = document.getElementById('next-contest-title');
      const descEl = document.getElementById('next-contest-desc');
      if (titleEl) titleEl.innerText = upcoming.title;
      if (descEl) descEl.innerText = `Thời gian: ${new Date(upcoming.start_time).toLocaleDateString('vi-VN')} • Thời lượng: ${upcoming.duration_minutes} phút • Thể thức: ${upcoming.format}`;

      const target = new Date(upcoming.start_time).getTime();

      function update() {
        const now = new Date().getTime();
        const diff = target - now;

        if (diff <= 0) {
          document.getElementById('timer-days').innerText = "00";
          document.getElementById('timer-hours').innerText = "00";
          document.getElementById('timer-minutes').innerText = "00";
          document.getElementById('timer-seconds').innerText = "00";
          return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        const dEl = document.getElementById('timer-days');
        const hEl = document.getElementById('timer-hours');
        const mEl = document.getElementById('timer-minutes');
        const sEl = document.getElementById('timer-seconds');

        if (dEl) dEl.innerText = String(days).padStart(2, '0');
        if (hEl) hEl.innerText = String(hours).padStart(2, '0');
        if (mEl) mEl.innerText = String(minutes).padStart(2, '0');
        if (sEl) sEl.innerText = String(seconds).padStart(2, '0');
      }

      update();
      setInterval(update, 1000);
    }

    // Initialize on load
        // ==========================================
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
        if (currentAuth.role === 'student' && appData && appData.students) {
          const st = getActiveStudent();
          if (st) {
            if (!currentAuth.stt) currentAuth.stt = st.stt;
            if (st.class) currentAuth.class = st.class;
          }
        }
        hideAuthModal();
        applyAuthAccess();
        return true;
      }
      // Public guest mode: do NOT force login modal open, guests can browse public leaderboard/problems/curriculum!
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
        if (currentAuth.role === 'student' && appData && appData.students) {
          const st = getActiveStudent();
          if (st) {
            if (!currentAuth.stt) currentAuth.stt = st.stt;
            if (st.class) currentAuth.class = st.class;
          }
        }
        setAuthCookie(currentAuth);
        hideAuthModal();
        applyAuthAccess();
        switchTab('leaderboard');
      } else {
        errorMsg.textContent = authResult.error || "Mã PIN hoặc mật khẩu không chính xác!";
        errorMsg.classList.remove('hidden');
        input.classList.add('border-rose-500');
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Đăng Nhập Vào Hệ Thống</span> <span>→</span>`;
      }
    }

    function handleLogout() {
      clearAuthCookie();
      currentAuth = null;
      window.location.reload();
    }

    function applyAuthAccess() {
      syncManagementAccess();
      const badge = document.getElementById('user-badge');
      const nameEl = document.getElementById('user-display-name');
      const authBtn = document.getElementById('btn-auth-action');
      const adminBtn = document.getElementById('tab-btn-admin');
      const adminBtnMobile = document.getElementById('tab-btn-admin-mobile');
      const studentTabBtn = document.getElementById('tab-btn-student');
      const studentTabBtnMobile = document.getElementById('tab-btn-student-mobile');
      const lbAdminBar = document.getElementById('leaderboard-admin-bar');

      const dataTabs = ['leaderboard', 'contests', 'curriculum'];

      if (!currentAuth) {
        // Guest mode: public landing page & public problems catalog
        if (nameEl) nameEl.textContent = 'Khách';
        if (badge) badge.className = "px-2 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1";
        if (authBtn) {
          authBtn.onclick = showAuthModal;
          authBtn.innerHTML = `<span>🔑</span> <span class="hidden sm:inline">Đăng nhập</span>`;
          authBtn.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 hover:text-white border border-indigo-500/40 transition flex items-center gap-1 cursor-pointer";
        }
        if (adminBtn) adminBtn.classList.add('hidden');
        if (adminBtnMobile) adminBtnMobile.classList.add('hidden');
        if (lbAdminBar) lbAdminBar.classList.add('hidden');
        document.querySelectorAll('.admin-only-btn').forEach(b => b.classList.add('hidden'));

        // Personal profile button for guest triggers modal
        if (studentTabBtn) {
          studentTabBtn.href = "javascript:void(0)";
          studentTabBtn.onclick = () => { showAuthModal(); return false; };
          studentTabBtn.innerHTML = `<span>👤</span> Cá Nhân <span class="text-[10px] opacity-70">🔒</span>`;
        }
        if (studentTabBtnMobile) {
          studentTabBtnMobile.href = "javascript:void(0)";
          studentTabBtnMobile.onclick = () => { showAuthModal(); return false; };
          studentTabBtnMobile.innerHTML = `👤 Cá nhân 🔒`;
        }

        // Lock badges and guards on data tabs for guest (except problems & submissions)
        dataTabs.forEach(t => {
          const btn = document.getElementById(`tab-btn-${t}`);
          const mBtn = document.getElementById(`tab-btn-${t}-mobile`);
          if (btn) {
            btn.onclick = () => { showAuthModal(); return false; };
            if (!btn.innerHTML.includes('🔒')) {
              btn.innerHTML += ` <span class="text-[10px] opacity-70">🔒</span>`;
            }
          }
          if (mBtn) {
            mBtn.onclick = () => { showAuthModal(); return false; };
            if (!mBtn.innerHTML.includes('🔒')) {
              mBtn.innerHTML += ` 🔒`;
            }
          }
        });

        // Enable Problems tab for Guest
        const probBtn = document.getElementById('tab-btn-problems');
        const probMBtn = document.getElementById('tab-btn-problems-mobile');
        if (probBtn) {
          probBtn.onclick = () => switchTab('problems');
          probBtn.innerHTML = probBtn.innerHTML.replace(/<span class="text-\[10px\] opacity-70">🔒<\/span>/g, '').replace(/🔒/g, '').trim();
        }
        if (probMBtn) {
          probMBtn.onclick = () => switchTab('problems');
          probMBtn.innerHTML = probMBtn.innerHTML.replace(/🔒/g, '').trim();
        }

        const probClassFilterCont = document.getElementById('prob-class-filter-container');
        if (probClassFilterCont) {
          probClassFilterCont.innerHTML = `
            <span class="text-slate-400 font-semibold mr-1 flex items-center gap-1"><span>👥</span> Xem bài tập:</span>
            <button onclick="filterProblemClass('all')" id="prob-class-filter-all" class="prob-class-btn px-3 py-1.5 rounded-lg bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/40 transition">Tất cả bài tập</button>
            <button onclick="filterProblemClass('Public')" id="prob-class-filter-Public" class="prob-class-btn px-3 py-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition">🌐 Public</button>
            <button onclick="filterProblemClass('C++ nâng cao')" id="prob-class-filter-cppnc" class="prob-class-btn px-3 py-1.5 rounded-lg text-slate-400 hover:text-blue-300 hover:bg-slate-800 transition">🟦 C++ nâng cao</button>
            <button onclick="filterProblemClass('C++ cơ bản')" id="prob-class-filter-cppcb" class="prob-class-btn px-3 py-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition">🔷 C++ cơ bản</button>
            <button onclick="filterProblemClass('Python cơ bản')" id="prob-class-filter-pythoncb" class="prob-class-btn px-3 py-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition">🟩 Python cơ bản</button>
            <button onclick="filterProblemClass('Python 1-1')" id="prob-class-filter-python11" class="prob-class-btn px-3 py-1.5 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-slate-800 transition">🟪 Python 1-1</button>
          `;
          currentProblemClassFilter = 'all';
        }

        if (window.location.hash === '#problems') {
          switchTab('problems');
        } else if (window.location.hash === '#submissions') {
          switchTab('submissions');
        } else {
          switchTab('home');
        }

      } else {
        // Authenticated mode: remove locks and enable click handlers
        dataTabs.forEach(t => {
          const btn = document.getElementById(`tab-btn-${t}`);
          const mBtn = document.getElementById(`tab-btn-${t}-mobile`);
          if (btn) {
            btn.onclick = () => switchTab(t);
            btn.innerHTML = btn.innerHTML.replace(/<span class="text-\[10px\] opacity-70">🔒<\/span>/g, '').replace(/🔒/g, '').trim();
          }
          if (mBtn) {
            mBtn.onclick = () => switchTab(t);
            mBtn.innerHTML = mBtn.innerHTML.replace(/🔒/g, '').trim();
          }
        });

        if (currentAuth.role === 'admin' || currentAuth.role === 'teacher') {
          const probClassFilterCont = document.getElementById('prob-class-filter-container');
          if (probClassFilterCont) {
            probClassFilterCont.innerHTML = `
              <span class="text-slate-400 font-semibold mr-1 flex items-center gap-1"><span>👥</span> Xem bài tập:</span>
              <button onclick="filterProblemClass('all')" id="prob-class-filter-all" class="prob-class-btn px-3 py-1.5 rounded-lg bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/40 transition">Tất cả bài tập</button>
              <button onclick="filterProblemClass('Public')" id="prob-class-filter-Public" class="prob-class-btn px-3 py-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition">🌐 Public</button>
              <button onclick="filterProblemClass('C++ nâng cao')" id="prob-class-filter-cppnc" class="prob-class-btn px-3 py-1.5 rounded-lg text-slate-400 hover:text-blue-300 hover:bg-slate-800 transition">🟦 C++ nâng cao</button>
              <button onclick="filterProblemClass('C++ cơ bản')" id="prob-class-filter-cppcb" class="prob-class-btn px-3 py-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition">🔷 C++ cơ bản</button>
              <button onclick="filterProblemClass('Python cơ bản')" id="prob-class-filter-pythoncb" class="prob-class-btn px-3 py-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition">🟩 Python cơ bản</button>
              <button onclick="filterProblemClass('Python 1-1')" id="prob-class-filter-python11" class="prob-class-btn px-3 py-1.5 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-slate-800 transition">🟪 Python 1-1</button>
            `;
          }
          const currClassFilterCont = document.getElementById('curr-class-filter-container');
          if (currClassFilterCont) {
            currClassFilterCont.innerHTML = `
              <span class="text-slate-400 font-semibold mr-1 flex items-center gap-1"><span>👥</span> Xem bài giảng:</span>
              <button onclick="filterCurriculumClass('all')" id="curr-class-filter-all" class="curr-class-btn px-3 py-1.5 rounded-lg bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/40 transition">Tất cả bài giảng</button>
              <button onclick="filterCurriculumClass('Public')" id="curr-class-filter-Public" class="curr-class-btn px-3 py-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition">🌐 Public</button>
              <button onclick="filterCurriculumClass('C++ nâng cao')" id="curr-class-filter-cppnc" class="curr-class-btn px-3 py-1.5 rounded-lg text-slate-400 hover:text-blue-300 hover:bg-slate-800 transition">🟦 C++ nâng cao</button>
              <button onclick="filterCurriculumClass('C++ cơ bản')" id="curr-class-filter-cppcb" class="curr-class-btn px-3 py-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition">🔷 C++ cơ bản</button>
              <button onclick="filterCurriculumClass('Python cơ bản')" id="curr-class-filter-pythoncb" class="curr-class-btn px-3 py-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition">🟩 Python cơ bản</button>
              <button onclick="filterCurriculumClass('Python 1-1')" id="curr-class-filter-python11" class="curr-class-btn px-3 py-1.5 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-slate-800 transition">🟪 Python 1-1</button>
            `;
          }
        }

        if (currentAuth.role === 'admin') {
          if (nameEl) nameEl.textContent = '👑 Admin';
          if (badge) badge.className = "px-2 py-1 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1";
          
          if (lbAdminBar) {
            lbAdminBar.classList.remove('hidden');
            const titleEl = document.getElementById('admin-bar-title');
            if (titleEl) titleEl.innerHTML = `<span>👑</span> Quyền Admin:`;
            const tuitionViewBtn = document.getElementById('btn-admin-view-tuition');
            if (tuitionViewBtn) tuitionViewBtn.innerHTML = `📋 Quản Lý Học Sinh & Học Phí`;
            const addTuitionBtn = document.getElementById('btn-add-tuition-month');
            if (addTuitionBtn) addTuitionBtn.classList.remove('hidden');
            const addStuBtn = document.getElementById('btn-add-student');
            if (addStuBtn) addStuBtn.classList.remove('hidden');
          }
          document.querySelectorAll('.admin-only-btn').forEach(b => b.classList.remove('hidden'));
          updateAdminMiniStats();

          if (studentTabBtn) {
            studentTabBtn.href = "student.html?id=1";
            studentTabBtn.onclick = null;
            studentTabBtn.innerHTML = `<span>👤</span> Học Viên`;
          }
          if (studentTabBtnMobile) {
            studentTabBtnMobile.href = "student.html?id=1";
            studentTabBtnMobile.onclick = null;
            studentTabBtnMobile.innerHTML = `👤 Học viên`;
          }
        } else if (currentAuth.role === 'teacher') {
          if (nameEl) nameEl.textContent = '🧑‍🏫 Giảng Viên';
          if (badge) badge.className = "px-2 py-1 rounded-lg text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/40 flex items-center gap-1";
          
          if (lbAdminBar) {
            lbAdminBar.classList.remove('hidden');
            const titleEl = document.getElementById('admin-bar-title');
            if (titleEl) titleEl.innerHTML = `<span>🧑‍🏫</span> Quyền Giảng Viên:`;
            const tuitionViewBtn = document.getElementById('btn-admin-view-tuition');
            if (tuitionViewBtn) tuitionViewBtn.innerHTML = `📋 Danh Sách Học Sinh`;
            const addTuitionBtn = document.getElementById('btn-add-tuition-month');
            if (addTuitionBtn) addTuitionBtn.classList.add('hidden');
            const addStuBtn = document.getElementById('btn-add-student');
            if (addStuBtn) addStuBtn.classList.add('hidden');
          }
          document.querySelectorAll('.admin-only-btn').forEach(b => b.classList.remove('hidden'));
          updateAdminMiniStats();

          if (studentTabBtn) {
            studentTabBtn.href = "student.html?id=1";
            studentTabBtn.onclick = null;
            studentTabBtn.innerHTML = `<span>👤</span> Học Viên`;
          }
          if (studentTabBtnMobile) {
            studentTabBtnMobile.href = "student.html?id=1";
            studentTabBtnMobile.onclick = null;
            studentTabBtnMobile.innerHTML = `👤 Học viên`;
          }
        } else if (currentAuth.role === 'student') {
          const uClass = currentAuth.class || '';
          if (nameEl) nameEl.textContent = `👤 ${currentAuth.name}`;
          if (badge) badge.className = "px-2 py-1 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1";

          if (lbAdminBar) lbAdminBar.classList.add('hidden');
          document.querySelectorAll('.admin-only-btn').forEach(b => b.classList.add('hidden'));

          if (studentTabBtn) {
            studentTabBtn.href = `student.html?id=${currentAuth.stt || 1}`;
            studentTabBtn.onclick = null;
            studentTabBtn.innerHTML = `<span>👤</span> Của bạn`;
          }
          if (studentTabBtnMobile) {
            studentTabBtnMobile.href = `student.html?id=${currentAuth.stt || 1}`;
            studentTabBtnMobile.onclick = null;
            studentTabBtnMobile.innerHTML = `👤 Của bạn`;
          }

          // Hiển thị đầy đủ bài tập cho học sinh
          const probClassFilterCont = document.getElementById('prob-class-filter-container');
          if (probClassFilterCont) {
            probClassFilterCont.innerHTML = `
              <span class="text-slate-400 font-semibold mr-1 flex items-center gap-1"><span>👥</span> Xem bài tập:</span>
              <button onclick="filterProblemClass('all')" id="prob-class-filter-all" class="prob-class-btn px-3 py-1.5 rounded-lg bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/40 transition">Tất cả bài tập</button>
              <button onclick="filterProblemClass('Public')" id="prob-class-filter-Public" class="prob-class-btn px-3 py-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition">🌐 Public</button>
              <button onclick="filterProblemClass('C++ nâng cao')" id="prob-class-filter-cppnc" class="prob-class-btn px-3 py-1.5 rounded-lg text-slate-400 hover:text-blue-300 hover:bg-slate-800 transition">🟦 C++ nâng cao</button>
              <button onclick="filterProblemClass('C++ cơ bản')" id="prob-class-filter-cppcb" class="prob-class-btn px-3 py-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition">🔷 C++ cơ bản</button>
              <button onclick="filterProblemClass('Python cơ bản')" id="prob-class-filter-pythoncb" class="prob-class-btn px-3 py-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition">🟩 Python cơ bản</button>
              <button onclick="filterProblemClass('Python 1-1')" id="prob-class-filter-python11" class="prob-class-btn px-3 py-1.5 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-slate-800 transition">🟪 Python 1-1</button>
            `;
            currentProblemClassFilter = 'all';
          }

          // Lock Curriculum filter bar strictly to student's class
          const currClassFilterCont = document.getElementById('curr-class-filter-container');
          if (currClassFilterCont && uClass) {
            currClassFilterCont.innerHTML = `
              <span class="text-slate-400 font-semibold mr-1 flex items-center gap-1"><span>🎯</span> Bài giảng của lớp:</span>
              <span class="px-3 py-1.5 rounded-lg bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/40 flex items-center gap-1.5 shadow-sm">
                <span>📚</span> Lớp ${uClass}
              </span>
            `;
            currentCurriculumClassFilter = uClass;
          }

          if (uClass) {
            filterClass(uClass);
          }
        } else if (currentAuth.role === 'class') {
          // 4 CLASS ROLES: C++ nâng cao, C++ cơ bản, Python cơ bản, Python 1-1
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
          if (lbAdminBar) lbAdminBar.classList.add('hidden');
          document.querySelectorAll('.admin-only-btn').forEach(b => b.classList.add('hidden'));

          if (studentTabBtn) {
            studentTabBtn.href = "student.html?id=1";
            studentTabBtn.onclick = null;
            studentTabBtn.innerHTML = `<span>👤</span> ${cls || 'Lớp học'}`;
          }
          if (studentTabBtnMobile) {
            studentTabBtnMobile.href = "student.html?id=1";
            studentTabBtnMobile.onclick = null;
            studentTabBtnMobile.innerHTML = `👤 ${cls || 'Lớp học'}`;
          }

          const probClassFilterCont = document.getElementById('prob-class-filter-container');
          if (probClassFilterCont) {
            probClassFilterCont.innerHTML = `
              <span class="text-slate-400 font-semibold mr-1 flex items-center gap-1"><span>👥</span> Xem bài tập:</span>
              <button onclick="filterProblemClass('all')" id="prob-class-filter-all" class="prob-class-btn px-3 py-1.5 rounded-lg bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/40 transition">Tất cả bài tập</button>
              <button onclick="filterProblemClass('Public')" id="prob-class-filter-Public" class="prob-class-btn px-3 py-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition">🌐 Public</button>
              <button onclick="filterProblemClass('C++ nâng cao')" id="prob-class-filter-cppnc" class="prob-class-btn px-3 py-1.5 rounded-lg text-slate-400 hover:text-blue-300 hover:bg-slate-800 transition">🟦 C++ nâng cao</button>
              <button onclick="filterProblemClass('C++ cơ bản')" id="prob-class-filter-cppcb" class="prob-class-btn px-3 py-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition">🔷 C++ cơ bản</button>
              <button onclick="filterProblemClass('Python cơ bản')" id="prob-class-filter-pythoncb" class="prob-class-btn px-3 py-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition">🟩 Python cơ bản</button>
              <button onclick="filterProblemClass('Python 1-1')" id="prob-class-filter-python11" class="prob-class-btn px-3 py-1.5 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-slate-800 transition">🟪 Python 1-1</button>
            `;
            currentProblemClassFilter = 'all';
          }
          const currClassFilterCont = document.getElementById('curr-class-filter-container');
          if (currClassFilterCont && cls) {
            currClassFilterCont.innerHTML = `
              <span class="text-slate-400 font-semibold mr-1 flex items-center gap-1"><span>🎯</span> Bài giảng lớp:</span>
              <span class="px-3 py-1.5 rounded-lg bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/40 flex items-center gap-1.5 shadow-sm">
                <span>📚</span> Lớp ${cls}
              </span>
            `;
            currentCurriculumClassFilter = cls;
          }

          if (cls) {
            filterClass(cls);
          }
        } else {
          // FALLBACK / OTHER
          if (nameEl) nameEl.textContent = `👥 ${currentAuth.name}`;
          if (badge) badge.className = "px-2 py-1 rounded-lg text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1";
          if (lbAdminBar) lbAdminBar.classList.add('hidden');
          document.querySelectorAll('.admin-only-btn').forEach(b => b.classList.add('hidden'));

          if (studentTabBtn) {
            studentTabBtn.href = "student.html?id=1";
            studentTabBtn.onclick = null;
            studentTabBtn.innerHTML = `<span>👤</span> Lớp học`;
          }
        }

        if (authBtn) {
          authBtn.onclick = handleLogout;
          authBtn.innerHTML = `<span>🚪</span> <span class="hidden sm:inline">Đăng xuất</span>`;
          authBtn.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-white border border-rose-500/30 transition flex items-center gap-1 cursor-pointer";
        }
      }

      // QUẢN LÝ QUYỀN TRUY CẬP BÀI NỘP: Chỉ Admin/Giáo viên mới được tải và xem mã nguồn
      const isAdminOrTeacher = Boolean(currentAuth && (currentAuth.role === 'admin' || currentAuth.role === 'teacher'));
      if (typeof fetchSubmissionsFromFirebase === 'function' && isFirebaseConfigured()) {
        fetchSubmissionsFromFirebase().then(fbSubs => {
          if (fbSubs && fbSubs.length > 0) {
            const incomingSubs = (typeof sanitizeSubmissionsForRole === 'function')
              ? sanitizeSubmissionsForRole(fbSubs, isAdminOrTeacher)
              : fbSubs;
            appData.submissions = typeof mergeSubmissionCollections === 'function'
              ? mergeSubmissionCollections(appData.submissions || [], incomingSubs)
              : incomingSubs;
            if (typeof archiveSubmissionsLocally === 'function') {
              archiveSubmissionsLocally(appData.submissions, { silent: true });
            }
            try { localStorage.setItem('cp_cached_submissions', JSON.stringify(appData.submissions)); } catch(e) {}
            renderProblems();
            renderMatrix();
            if (typeof renderGlobalSubmissions === 'function') renderGlobalSubmissions();
            if (typeof renderSubmissionsManagerList === 'function') {
              const smm = document.getElementById('modal-submissions-manager');
              if (smm && !smm.classList.contains('hidden')) renderSubmissionsManagerList();
            }
          }
        }).catch(() => {});
      } else if (appData && Array.isArray(appData.submissions)) {
        appData.submissions = (typeof sanitizeSubmissionsForRole === 'function')
          ? sanitizeSubmissionsForRole(appData.submissions, isAdminOrTeacher)
          : appData.submissions;
      }

      // Render personal progress card for student
      renderPersonalProgressCard();

      // Re-render components with auth filtering
      renderMatrix();
      renderProblems();
      renderCurriculum();
      renderContests();
      if (typeof renderGlobalSubmissions === 'function') renderGlobalSubmissions();
    }

    window.addEventListener('DOMContentLoaded', initApp);

    // Cập nhật ngay giữa các tab khi kho IndexedDB nhận bài nộp mới.
    window.addEventListener('submission-archive-change', async () => {
      if (!appData || typeof loadArchivedSubmissions !== 'function' || typeof mergeSubmissionCollections !== 'function') return;
      const archivedSubs = await loadArchivedSubmissions();
      appData.submissions = mergeSubmissionCollections(appData.submissions || [], archivedSubs);
      try { localStorage.setItem('cp_cached_submissions', JSON.stringify(appData.submissions)); } catch(e) {}
      if (typeof renderGlobalSubmissions === 'function') renderGlobalSubmissions();
      if (typeof renderJudgeSubmissionHistory === 'function') renderJudgeSubmissionHistory();
    });
  
    // ==========================================
    // ADMIN CONTROL CENTER (TOÀN QUYỀN QUẢN LÝ GUI)
    // ==========================================
    let currentAdminSubTab = 'overview';
    let currentAdminClassFilter = 'all';

    function switchAdminSubTab(tab) { renderManagementPanel(tab); }

    function renderAdminDashboard() {
      if (!currentAuth || currentAuth.role !== 'admin') return;

      // Update stat metrics
      const totalS = appData.students ? appData.students.length : 0;
      const activeS = appData.students ? appData.students.filter(s => (s.status || 'Đang học') === 'Đang học').length : 0;
      
      const currentMonth = (appData.tuition_months && appData.tuition_months.length > 0) 
        ? appData.tuition_months[appData.tuition_months.length - 1] 
        : 'Tháng 10';
      
      const tuitionPaidCount = appData.students ? appData.students.filter(s => s.tuition && s.tuition[currentMonth]).length : 0;
      const totalProblems = appData.problems ? appData.problems.length : 0;
      const totalCurriculum = appData.curriculum ? appData.curriculum.length : 0;

      const elTotal = document.getElementById('admin-stat-total');
      const elActive = document.getElementById('admin-stat-active');
      const elTuition = document.getElementById('admin-stat-tuition');
      const elContent = document.getElementById('admin-stat-content');

      if (elTotal) elTotal.textContent = totalS;
      if (elActive) elActive.textContent = activeS;
      if (elTuition) elTuition.textContent = `${tuitionPaidCount} / ${totalS}`;
      if (elContent) elContent.textContent = `${totalCurriculum} / ${totalProblems}`;

      switchAdminSubTab(currentAdminSubTab);
    }

    // 1. ADMIN STUDENTS & TUITION
    function filterAdminStudents(cls) {
      currentAdminClassFilter = cls;
      ['all', 'C++', 'Python', 'Python 1-1'].forEach(c => {
        const btn = document.getElementById(`btn-admin-filter-${c === 'Python 1-1' ? 'Python-1-1' : c}`);
        if (btn) {
          if (c === cls) {
            btn.className = "px-3 py-1.5 rounded-lg bg-indigo-600/30 text-indigo-300 font-semibold transition";
          } else {
            btn.className = "px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition";
          }
        }
      });
      renderAdminStudents();
    }

    function renderAdminStudents() {
      const head = document.getElementById('admin-students-head');
      const body = document.getElementById('admin-students-body');
      if (!head || !body) return;
      if (!currentAuth || (currentAuth.role !== 'admin' && currentAuth.role !== 'teacher')) return;

      const isFullAdmin = currentAuth.role === 'admin';
      const months = appData.tuition_months || ['Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

      // Render Header
      let headHtml = `<tr>
        <th class="px-3 py-3.5 text-center w-12">#</th>
        <th class="px-4 py-3.5">Học sinh</th>
        <th class="px-3 py-3.5 text-center">Lớp</th>
        <th class="px-3.5 py-3.5 text-center">Tình trạng học</th>
        <th class="px-3.5 py-3.5 text-center">Mã PIN cá nhân</th>
        <th class="px-4 py-3.5">Handles thi đấu</th>`;
      
      months.forEach(m => {
        headHtml += `<th class="px-3 py-3.5 text-center whitespace-nowrap">${m}</th>`;
      });

      headHtml += `<th class="px-3.5 py-3.5 text-center">Thao tác</th></tr>`;
      head.innerHTML = headHtml;

      // Filter students
      const search = (document.getElementById('admin-student-search')?.value || '').toLowerCase().trim();
      let list = [...(appData.students || [])];

      if (currentAdminClassFilter !== 'all') {
        list = list.filter(s => s.class === currentAdminClassFilter);
      }

      if (search) {
        list = list.filter(s => 
          s.name.toLowerCase().includes(search) || 
          (s.pin && s.pin.toLowerCase().includes(search)) ||
          (s.marisa_handle && s.marisa_handle.toLowerCase().includes(search)) ||
          (s.cf_handle && s.cf_handle.toLowerCase().includes(search)) ||
          (s.vjudge_handle && s.vjudge_handle.toLowerCase().includes(search)) ||
          (s.vnoi_handle && s.vnoi_handle.toLowerCase().includes(search)) ||
          (s.clue_handle && s.clue_handle.toLowerCase().includes(search)) ||
          (s.ctoj_handle && s.ctoj_handle.toLowerCase().includes(search))
        );
      }

      body.innerHTML = '';
      if (list.length === 0) {
        body.innerHTML = `<tr><td colspan="${7 + months.length}" class="px-4 py-8 text-center text-slate-500 italic">Không có học sinh nào phù hợp.</td></tr>`;
        return;
      }

      list.forEach((s, idx) => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-800/40 transition";

        const cBadge = s.class === 'C++' 
          ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' 
          : s.class === 'Python' 
            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' 
            : 'bg-purple-500/15 text-purple-300 border-purple-500/30';

        const status = s.status || 'Đang học';
        const statusClass = status === 'Đang học' 
          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
          : status === 'Tạm dừng' 
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' 
            : 'bg-rose-500/20 text-rose-300 border-rose-500/30';

        const pinDisplay = s.pin || 'Chưa đặt';

        let handlesList = [];
        if (s.marisa_handle) handlesList.push(`<a href="https://marisaoj.com/user/${s.marisa_handle}/submissions" target="_blank" class="text-purple-400 hover:underline">Marisa: ${s.marisa_handle}</a>`);
        if (s.cf_handle) handlesList.push(`<a href="https://codeforces.com/profile/${s.cf_handle}" target="_blank" class="text-blue-400 hover:underline">CF: ${s.cf_handle}</a>`);
        if (s.vjudge_handle) handlesList.push(`<a href="https://vjudge.net/user/${s.vjudge_handle}" target="_blank" class="text-emerald-400 hover:underline">VJ: ${s.vjudge_handle}</a>`);
        if (s.vnoi_handle) handlesList.push(`<a href="https://oj.vnoi.info/user/${s.vnoi_handle}" target="_blank" class="text-amber-400 hover:underline">VNOI: ${s.vnoi_handle}</a>`);
        if (s.clue_handle) handlesList.push(`<a href="https://oj.clue.edu.vn/user/${s.clue_handle}" target="_blank" class="text-cyan-400 hover:underline">ClueOJ: ${s.clue_handle}</a>`);
        if (s.ctoj_handle) handlesList.push(`<a href="https://oj.chuyentin.pro/user/${s.ctoj_handle}" target="_blank" class="text-teal-400 hover:underline">CTOJ: ${s.ctoj_handle}</a>`);

        const handlesHtml = handlesList.length > 0 ? handlesList.join(' • ') : '<span class="text-slate-500 italic">--</span>';

        let tuitionCellsHtml = '';
        months.forEach(m => {
          const isPaid = s.tuition && s.tuition[m];
          const btnClass = isPaid 
            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" 
            : "bg-slate-800 text-rose-300 border-slate-700";
          const label = isPaid ? "Đã đóng ✅" : "Chưa đóng ⏳";

          if (isFullAdmin) {
            tuitionCellsHtml += `
              <td class="px-2 py-3 text-center">
                <button onclick="toggleTuition(${s.stt}, '${m}')" class="px-2 py-1 rounded-lg text-[11px] font-bold border transition ${btnClass} hover:opacity-80 cursor-pointer whitespace-nowrap" title="Bấm để chuyển trạng thái đóng học phí">
                  ${label}
                </button>
              </td>
            `;
          } else {
            tuitionCellsHtml += `
              <td class="px-2 py-3 text-center">
                <span class="inline-block px-2 py-1 rounded-lg text-[11px] font-bold border ${btnClass} whitespace-nowrap">
                  ${label}
                </span>
              </td>
            `;
          }
        });

        const statusCellHtml = isFullAdmin ? `
          <select onchange="updateStudentStatus(${s.stt}, this.value)" class="bg-slate-950 border border-slate-700 text-xs rounded-lg px-2 py-1 font-semibold ${statusClass} focus:outline-none cursor-pointer">
            <option value="Đang học" ${status === 'Đang học' ? 'selected' : ''}>🟢 Đang học</option>
            <option value="Tạm dừng" ${status === 'Tạm dừng' ? 'selected' : ''}>🟡 Tạm dừng</option>
            <option value="Bảo lưu" ${status === 'Bảo lưu' ? 'selected' : ''}>🔴 Bảo lưu</option>
          </select>
        ` : `
          <span class="inline-block px-2 py-1 rounded-lg text-xs font-semibold border ${statusClass}">
            ${status === 'Đang học' ? '🟢 Đang học' : status === 'Tạm dừng' ? '🟡 Tạm dừng' : '🔴 Bảo lưu'}
          </span>
        `;

        const pinCellHtml = `
          <div class="inline-flex items-center gap-1.5 bg-slate-950 border border-emerald-500/30 px-2 py-1 rounded-lg text-xs" title="Mã PIN bảo mật qua Firebase Realtime Database">
            <span class="text-emerald-400 font-semibold text-[11px] flex items-center gap-1">🔒 Firebase</span>
          </div>
        `;

        const actionCellHtml = isFullAdmin ? `
          <div class="flex items-center justify-center gap-1.5">
            <a href="student.html?id=${s.stt}" target="_blank" class="px-2 py-1 rounded-lg text-xs font-semibold bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/30 transition" title="Xem hồ sơ">
              👤
            </a>
            <button onclick="openEditStudentModal(${s.stt})" class="px-2 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 transition cursor-pointer" title="Sửa thông tin học sinh">
              ✏️
            </button>
            <button onclick="deleteStudent(${s.stt})" class="px-2 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition cursor-pointer" title="Xóa học sinh">
              🗑️
            </button>
          </div>
        ` : `
          <div class="flex items-center justify-center gap-1.5">
            <a href="student.html?id=${s.stt}" target="_blank" class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/30 transition flex items-center gap-1" title="Xem Heatmap">
              <span>👤</span> Heatmap
            </a>
          </div>
        `;

        tr.innerHTML = `
          <td class="px-3 py-3 text-center font-mono text-slate-400 font-bold">${s.stt}</td>
          <td class="px-4 py-3 font-semibold text-white">
            <div class="flex items-center gap-2">
              <a href="student.html?id=${s.stt}" target="_blank" class="hover:text-indigo-400 font-bold text-sm transition">
                ${s.name}
              </a>
            </div>
          </td>
          <td class="px-3 py-3 text-center">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${cBadge} border">${s.class}</span>
          </td>
          <td class="px-3.5 py-3 text-center">
            ${statusCellHtml}
          </td>
          <td class="px-3.5 py-3 text-center font-mono">
            ${pinCellHtml}
          </td>
          <td class="px-4 py-3 text-xs text-slate-300 font-mono">
            ${handlesHtml}
          </td>
          ${tuitionCellsHtml}
          <td class="px-3.5 py-3 text-center whitespace-nowrap">
            ${actionCellHtml}
          </td>
        `;
        body.appendChild(tr);
      });
    }

    function togglePinReveal(stt, pinVal) {
      const el = document.getElementById(`pin-text-${stt}`);
      if (!el) return;
      if (el.textContent === '••••••') {
        el.textContent = pinVal;
        el.classList.add('text-indigo-300');
      } else {
        el.textContent = '••••••';
        el.classList.remove('text-indigo-300');
      }
    }

    function toggleTuition(stt, month) {
      const student = appData.students.find(s => s.stt === stt);
      if (!student) return;
      if (!student.tuition) student.tuition = {};
      student.tuition[month] = !student.tuition[month];
      
      saveAppDataLocally();
      renderAdminStudents();
      renderAdminDashboard();

      // Two-way sync to Google Sheets
      syncToGoogleSheets({
        action: 'update_tuition',
        name: student.name,
        month: month,
        is_paid: student.tuition[month]
      });

      // Sync to Firebase Realtime Database (Bảo mật tuyệt đối)
      if (typeof saveTuitionToFirebase === 'function' && isFirebaseConfigured()) {
        saveTuitionToFirebase(student.stt, month, student.tuition[month]);
      }
    }

    function updateStudentStatus(stt, newStatus) {
      const student = appData.students.find(s => s.stt === stt);
      if (!student) return;
      student.status = newStatus;
      saveAppDataLocally();
      renderAdminStudents();
      renderAdminDashboard();

      // Two-way sync to Google Sheets
      syncToGoogleSheets({
        action: 'update_student_status',
        name: student.name,
        status: newStatus
      });

      // Sync to Firebase Realtime Database (Bảo mật tuyệt đối)
      if (typeof saveStudentStatusToFirebase === 'function' && isFirebaseConfigured()) {
        saveStudentStatusToFirebase(student.stt, newStatus);
      }
    }

    function promptAddTuitionMonth() {
      const current = appData.tuition_months || ['Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
      const nextNum = current.length + 8; // approx
      const monthName = prompt("Nhập tên tháng học phí mới:", `Tháng ${nextNum > 12 ? nextNum - 12 : nextNum}`);
      if (!monthName || !monthName.trim()) return;

      const cleanName = monthName.trim();
      if (!appData.tuition_months) appData.tuition_months = [];
      if (!appData.tuition_months.includes(cleanName)) {
        appData.tuition_months.push(cleanName);
        appData.students.forEach(s => {
          if (!s.tuition) s.tuition = {};
          if (s.tuition[cleanName] === undefined) s.tuition[cleanName] = false;
        });
        saveAppDataLocally();
        renderAdminStudents();
      }
    }

    // STUDENT MODAL
    function openAddStudentModal() {
      document.getElementById('modal-student-title').textContent = 'Thêm Học Sinh Mới';
      document.getElementById('form-student-stt').value = '';
      document.getElementById('form-student-name').value = '';
      document.getElementById('form-student-class').value = 'C++';
      document.getElementById('form-student-pin').value = `hs_${Date.now().toString().slice(-4)}`;
      document.getElementById('form-student-status').value = 'Đang học';
      document.getElementById('form-student-marisa').value = '';
      document.getElementById('form-student-cf').value = '';
      document.getElementById('form-student-vj').value = '';
      document.getElementById('form-student-vnoi').value = '';
      document.getElementById('form-student-clue').value = '';
      document.getElementById('form-student-ctoj').value = '';
      document.getElementById('modal-student').classList.remove('hidden');
    }

    function openEditStudentModal(stt) {
      const student = appData.students.find(s => s.stt === stt);
      if (!student) return;

      document.getElementById('modal-student-title').textContent = `Chỉnh Sửa: ${student.name}`;
      document.getElementById('form-student-stt').value = student.stt;
      document.getElementById('form-student-name').value = student.name;
      document.getElementById('form-student-class').value = student.class || 'C++';
      document.getElementById('form-student-pin').value = '';
      document.getElementById('form-student-pin').placeholder = 'Nhập mã PIN mới nếu muốn đổi (lưu Firebase)...';
      document.getElementById('form-student-status').value = student.status || 'Đang học';
      document.getElementById('form-student-marisa').value = student.marisa_handle || '';
      document.getElementById('form-student-cf').value = student.cf_handle || '';
      document.getElementById('form-student-vj').value = student.vjudge_handle || '';
      document.getElementById('form-student-vnoi').value = student.vnoi_handle || '';
      document.getElementById('form-student-clue').value = student.clue_handle || '';
      document.getElementById('form-student-ctoj').value = student.ctoj_handle || '';
      document.getElementById('modal-student').classList.remove('hidden');
    }

    function closeStudentModal() {
      document.getElementById('modal-student').classList.add('hidden');
    }

    async function handleSaveStudent(e) {
      e.preventDefault();
      const sttVal = document.getElementById('form-student-stt').value;
      const name = document.getElementById('form-student-name').value.trim();
      const cls = document.getElementById('form-student-class').value;
      const pin = document.getElementById('form-student-pin').value.trim();
      const status = document.getElementById('form-student-status').value;
      const marisa = document.getElementById('form-student-marisa').value.trim();
      const cf = document.getElementById('form-student-cf').value.trim();
      const vj = document.getElementById('form-student-vj').value.trim();
      const vnoi = document.getElementById('form-student-vnoi').value.trim();
      const clue = document.getElementById('form-student-clue').value.trim();
      const ctoj = document.getElementById('form-student-ctoj').value.trim();

      if (!name) return;

      let savedStt = 1;

      if (sttVal) {
        // Edit existing
        const student = appData.students.find(s => s.stt === parseInt(sttVal));
        if (student) {
          student.name = name;
          student.class = cls;
          student.status = status;
          student.marisa_handle = marisa;
          student.cf_handle = cf;
          student.vjudge_handle = vj;
          student.vnoi_handle = vnoi;
          student.clue_handle = clue;
          student.ctoj_handle = ctoj;
          savedStt = student.stt;
        }
      } else {
        // Add new
        const newStt = appData.students.length > 0 
          ? Math.max(...appData.students.map(s => s.stt)) + 1 
          : 1;
        savedStt = newStt;
        
        const newStudent = {
          stt: newStt,
          name: name,
          class: cls,
          status: status,
          marisa_handle: marisa,
          cf_handle: cf,
          vjudge_handle: vj,
          vnoi_handle: vnoi,
          clue_handle: clue,
          ctoj_handle: ctoj,
          rating: 0,
          title: "Newbie",
          rating_change: "",
          solved: [],
          target_solved: [],
          target_solved_count: 0,
          target_class_total: 8,
          total_solved_count: 0,
          stats: { week: 0, month: 0, year: 0, total: 0 },
          activity: {},
          tuition: {}
        };
        (appData.tuition_months || ['Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12']).forEach(m => newStudent.tuition[m] = false);
        appData.students.push(newStudent);
      }

      // Sync PIN to Firebase Realtime Database (Bảo mật tuyệt đối, không lưu plain text vào data.json)
      if (pin) {
        const pinHash = await hashSHA256(pin);
        const dbUrl = getFirebaseDatabaseUrl();
        if (dbUrl && isFirebaseConfigured()) {
          try {
            await fetch(`${dbUrl}/auth_tokens/${pinHash}.json`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                role: "student",
                name: name,
                class: cls,
                stt: savedStt
              })
            });
            showLiveToast("🔥 Đã lưu mã PIN học sinh lên Firebase!", "success");
          } catch(err) {
            console.warn("Could not push PIN to Firebase directly:", err);
          }
        }
      }

      // Ensure no auth_tokens or pins stored in public client data
      delete appData.auth_tokens;

      saveAppDataLocally();
      closeStudentModal();
      renderAdminStudents();
      renderAdminDashboard();
      renderMatrix();

      // Sync students list to Firebase Realtime Database
      if (typeof saveStudentsToFirebase === 'function' && isFirebaseConfigured()) {
        saveStudentsToFirebase(appData.students);
      }

      // Two-way sync to Google Sheets (private sheet)
      syncToGoogleSheets({
        action: 'save_student',
        student: {
          name, class: cls, marisa_handle: marisa, cf_handle: cf,
          vjudge_handle: vj, vnoi_handle: vnoi, clue_handle: clue,
          pin, status
        }
      });
    }

    function deleteStudent(stt) {
      const student = appData.students.find(s => s.stt === stt);
      if (!student) return;
      if (!confirm(`Bạn có chắc chắn muốn xóa học sinh "${student.name}" không?`)) return;

      appData.students = appData.students.filter(s => s.stt !== stt);
      saveAppDataLocally();
      renderAdminStudents();
      renderAdminDashboard();
      renderMatrix();

      // Sync updated list to Firebase
      if (typeof saveStudentsToFirebase === 'function' && isFirebaseConfigured()) {
        saveStudentsToFirebase(appData.students);
      }
    }

    // 2. ADMIN CURRICULUM
    function renderAdminCurriculum() {
      const grid = document.getElementById('admin-curriculum-grid');
      if (!grid || !appData || !appData.curriculum) return;
      grid.innerHTML = '';

      appData.curriculum.forEach(c => {
        const card = document.createElement('div');
        card.className = "bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 flex flex-col justify-between";
        
        const classesBadges = (c.classes || []).map(cls => {
          let col = 'bg-purple-500/15 text-purple-300 border-purple-500/30';
          if (cls === 'Public') col = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
          else if (cls === 'C++ nâng cao' || cls === 'C++') col = 'bg-blue-500/15 text-blue-300 border-blue-500/30';
          else if (cls === 'C++ cơ bản') col = 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
          else if (cls === 'Python cơ bản' || cls === 'Python') col = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
          else if (cls === 'Python 1-1') col = 'bg-purple-500/15 text-purple-300 border-purple-500/30';
          return `<span class="px-2 py-0.5 rounded text-[10px] font-bold ${col} border">${cls}</span>`;
        }).join(' ');

        card.innerHTML = `
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-mono text-xs font-bold text-indigo-400">${c.id} • ${c.chapter}</span>
              <div class="flex gap-1">${classesBadges}</div>
            </div>
            <h4 class="text-base font-bold text-white">${c.title}</h4>
            <p class="text-xs text-slate-400 line-clamp-2">${c.summary || ''}</p>
            <div class="text-[11px] text-slate-500 truncate font-mono">Link: ${c.url}</div>
          </div>
          <div class="pt-3 border-t border-slate-800 flex items-center justify-between">
            <a href="${c.url}" target="_blank" class="text-xs text-indigo-400 hover:underline font-semibold">Xem tài liệu ↗</a>
            <div class="flex items-center gap-1.5">
              <button onclick="openEditCurriculumModal('${c.id}')" class="px-2 py-1 rounded-lg text-xs font-semibold bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/30 transition cursor-pointer">✏️ Sửa</button>
              <button onclick="deleteCurriculum('${c.id}')" class="px-2 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition cursor-pointer">🗑️ Xóa</button>
            </div>
          </div>
        `;
        grid.appendChild(card);
      });
    }

    function openAddCurriculumModal() {
      document.getElementById('modal-curriculum-title').textContent = 'Thêm Bài Giảng Mới';
      document.getElementById('form-curr-id-orig').value = '';
      document.getElementById('form-curr-id').value = `LEC-${(appData.curriculum?.length || 0) + 1}`;
      document.getElementById('form-curr-chapter').value = 'Tuần 1';
      document.getElementById('form-curr-title').value = '';
      document.getElementById('form-curr-url').value = '';
      document.getElementById('form-curr-summary').value = '';
      document.getElementById('curr-class-public').checked = true;
      document.getElementById('curr-class-cppnc').checked = false;
      document.getElementById('curr-class-cppcb').checked = false;
      document.getElementById('curr-class-pythoncb').checked = false;
      document.getElementById('curr-class-python11').checked = false;
      document.getElementById('modal-curriculum').classList.remove('hidden');
    }

    function openEditCurriculumModal(id) {
      const lec = appData.curriculum.find(c => c.id === id);
      if (!lec) return;

      document.getElementById('modal-curriculum-title').textContent = `Sửa Bài Giảng: ${lec.title}`;
      document.getElementById('form-curr-id-orig').value = lec.id;
      document.getElementById('form-curr-id').value = lec.id;
      document.getElementById('form-curr-chapter').value = lec.chapter || '';
      document.getElementById('form-curr-title').value = lec.title;
      document.getElementById('form-curr-url').value = lec.url || '';
      document.getElementById('form-curr-summary').value = lec.summary || '';
      
      const cList = lec.classes || [];
      document.getElementById('curr-class-public').checked = cList.includes('Public') || cList.includes('Tất cả') || cList.length === 0;
      document.getElementById('curr-class-cppnc').checked = cList.includes('C++ nâng cao') || cList.includes('C++');
      document.getElementById('curr-class-cppcb').checked = cList.includes('C++ cơ bản') || cList.includes('C++');
      document.getElementById('curr-class-pythoncb').checked = cList.includes('Python cơ bản') || cList.includes('Python');
      document.getElementById('curr-class-python11').checked = cList.includes('Python 1-1');

      document.getElementById('modal-curriculum').classList.remove('hidden');
    }

    function closeCurriculumModal() {
      document.getElementById('modal-curriculum').classList.add('hidden');
    }

    function handleSaveCurriculum(e) {
      e.preventDefault();
      const origId = document.getElementById('form-curr-id-orig').value;
      const id = document.getElementById('form-curr-id').value.trim();
      const chapter = document.getElementById('form-curr-chapter').value.trim();
      const title = document.getElementById('form-curr-title').value.trim();
      const url = document.getElementById('form-curr-url').value.trim();
      const summary = document.getElementById('form-curr-summary').value.trim();

      const classes = [];
      if (document.getElementById('curr-class-public').checked) classes.push('Public');
      if (document.getElementById('curr-class-cppnc').checked) classes.push('C++ nâng cao');
      if (document.getElementById('curr-class-cppcb').checked) classes.push('C++ cơ bản');
      if (document.getElementById('curr-class-pythoncb').checked) classes.push('Python cơ bản');
      if (document.getElementById('curr-class-python11').checked) classes.push('Python 1-1');
      if (classes.length === 0) classes.push('Public');

      if (!id || !title) return;
      if (!appData.curriculum) appData.curriculum = [];

      if (origId) {
        const item = appData.curriculum.find(c => c.id === origId);
        if (item) {
          item.id = id;
          item.chapter = chapter;
          item.title = title;
          item.url = url;
          item.summary = summary;
          item.classes = classes;
        }
      } else {
        appData.curriculum.push({
          id, chapter, title, url, summary, classes
        });
      }

      saveAppDataLocally();
      closeCurriculumModal();
      renderAdminCurriculum();
      renderCurriculum();
      renderAdminDashboard();

      // Two-way sync to Google Sheets
      syncToGoogleSheets({
        action: 'save_curriculum',
        lecture: { id, chapter, title, url, summary, classes }
      });
    }

    function deleteCurriculum(id) {
      if (!confirm(`Bạn có chắc chắn muốn xóa bài giảng "${id}" không?`)) return;
      appData.curriculum = appData.curriculum.filter(c => c.id !== id);
      saveAppDataLocally();
      renderAdminCurriculum();
      renderCurriculum();
      renderAdminDashboard();
    }

    // 3. ADMIN PROBLEMS
    function renderAdminProblems() {
      const body = document.getElementById('admin-problems-body');
      if (!body || !appData || !appData.problems) return;
      body.innerHTML = '';

      const query = (document.getElementById('management-problem-search')?.value || '').toLocaleLowerCase('vi');
      appData.problems.filter(p => `${p.id} ${p.name}`.toLocaleLowerCase('vi').includes(query)).forEach((p, idx) => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-800/40 transition";

        const classesBadges = (p.classes || []).map(cls => {
          let col = 'bg-purple-500/15 text-purple-300 border-purple-500/30';
          if (cls === 'Public') col = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
          else if (cls === 'C++ nâng cao' || cls === 'C++') col = 'bg-blue-500/15 text-blue-300 border-blue-500/30';
          else if (cls === 'C++ cơ bản') col = 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
          else if (cls === 'Python cơ bản' || cls === 'Python') col = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
          else if (cls === 'Python 1-1') col = 'bg-purple-500/15 text-purple-300 border-purple-500/30';
          return `<span class="px-2 py-0.5 rounded text-[10px] font-bold ${col} border">${cls}</span>`;
        }).join(' ');

        tr.innerHTML = `
          <td class="px-4 py-3 text-center text-slate-500 font-mono">${idx + 1}</td>
          <td class="px-4 py-3 font-semibold text-white">
            <div class="font-mono text-xs text-indigo-400 font-bold">${p.id}</div>
            <a href="${p.url}" target="_blank" class="hover:text-indigo-300 transition text-sm">${p.name}</a>
          </td>
          <td class="px-4 py-3">${classesBadges}</td>
          <td class="px-4 py-3 text-xs text-purple-300 font-semibold">${p.platform || 'MarisaOJ'}</td>
          <td class="px-4 py-3 text-xs text-slate-300 font-mono">${p.difficulty || ''}</td>
          <td class="px-4 py-3 text-center whitespace-nowrap">
            <div class="flex items-center justify-center gap-1.5">
              <button onclick="openEditProblemModal('${p.id}')" class="px-2 py-1 rounded-lg text-xs font-semibold bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/30 transition cursor-pointer">✏️ Sửa</button>
              <button onclick="openTestcaseManagerModal(); loadProblemIntoTestcaseManager('${p.id}')" class="management-button">Bộ test</button>
              <button onclick="deleteProblem('${p.id}')" class="px-2 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition cursor-pointer">🗑️ Xóa</button>
            </div>
          </td>
        `;
        body.appendChild(tr);
      });
    }

    function openAddProblemModal() {
      document.getElementById('modal-problem-title').textContent = 'Thêm Bài Tập Mới';
      document.getElementById('form-prob-id-orig').value = '';
      document.getElementById('form-prob-id').value = `MARISA-${(appData.problems?.length || 0) + 1}`;
      document.getElementById('form-prob-name').value = '';
      document.getElementById('form-prob-platform').value = 'MarisaOJ';
      document.getElementById('form-prob-url').value = '';
      document.getElementById('form-prob-diff').value = 'Level 1 • Brute Force';
      document.getElementById('form-prob-cat').value = 'Brute Force';
      document.getElementById('prob-class-public').checked = true;
      document.getElementById('prob-class-cppnc').checked = false;
      document.getElementById('prob-class-cppcb').checked = false;
      document.getElementById('prob-class-pythoncb').checked = false;
      document.getElementById('prob-class-python11').checked = false;
      document.getElementById('modal-problem').classList.remove('hidden');
    }

    function openEditProblemModal(id) {
      const prob = appData.problems.find(p => p.id === id);
      if (!prob) return;

      document.getElementById('modal-problem-title').textContent = `Sửa Bài Tập: ${prob.name}`;
      document.getElementById('form-prob-id-orig').value = prob.id;
      document.getElementById('form-prob-id').value = prob.id;
      document.getElementById('form-prob-name').value = prob.name;
      document.getElementById('form-prob-platform').value = prob.platform || 'MarisaOJ';
      document.getElementById('form-prob-url').value = prob.url || '';
      document.getElementById('form-prob-diff').value = prob.difficulty || '';
      document.getElementById('form-prob-cat').value = prob.category || '';
      
      const cList = prob.classes || [];
      document.getElementById('prob-class-public').checked = cList.includes('Public') || cList.includes('Tất cả') || cList.length === 0;
      document.getElementById('prob-class-cppnc').checked = cList.includes('C++ nâng cao') || cList.includes('C++');
      document.getElementById('prob-class-cppcb').checked = cList.includes('C++ cơ bản') || cList.includes('C++');
      document.getElementById('prob-class-pythoncb').checked = cList.includes('Python cơ bản') || cList.includes('Python');
      document.getElementById('prob-class-python11').checked = cList.includes('Python 1-1');

      document.getElementById('modal-problem').classList.remove('hidden');
    }

    function closeProblemModal() {
      document.getElementById('modal-problem').classList.add('hidden');
    }

    function handleSaveProblem(e) {
      e.preventDefault();
      const origId = document.getElementById('form-prob-id-orig').value;
      const id = document.getElementById('form-prob-id').value.trim();
      const name = document.getElementById('form-prob-name').value.trim();
      const platform = document.getElementById('form-prob-platform').value;
      const url = document.getElementById('form-prob-url').value.trim();
      const diff = document.getElementById('form-prob-diff').value.trim();
      const cat = document.getElementById('form-prob-cat').value.trim();

      const classes = [];
      if (document.getElementById('prob-class-public').checked) classes.push('Public');
      if (document.getElementById('prob-class-cppnc').checked) classes.push('C++ nâng cao');
      if (document.getElementById('prob-class-cppcb').checked) classes.push('C++ cơ bản');
      if (document.getElementById('prob-class-pythoncb').checked) classes.push('Python cơ bản');
      if (document.getElementById('prob-class-python11').checked) classes.push('Python 1-1');
      if (classes.length === 0) classes.push('Public');

      if (!id || !name || !url) return;
      if (!appData.problems) appData.problems = [];

      if (origId) {
        const item = appData.problems.find(p => p.id === origId);
        if (item) {
          item.id = id;
          item.name = name;
          item.platform = platform;
          item.url = url;
          item.difficulty = diff;
          item.category = cat;
          item.classes = classes;
        }
      } else {
        appData.problems.push({
          id, name, platform, url, difficulty: diff, category: cat, classes
        });
      }

      saveAppDataLocally();
      closeProblemModal();
      renderAdminProblems();
      renderProblems();
      renderAdminDashboard();

      // Two-way sync to Google Sheets
      syncToGoogleSheets({
        action: 'save_problem',
        problem: { id, name, platform, url, difficulty: diff, category: cat, classes }
      });
    }

    function deleteProblem(id) {
      if (!confirm(`Bạn có chắc chắn muốn xóa bài tập "${id}" không?`)) return;
      appData.problems = appData.problems.filter(p => p.id !== id);
      saveAppDataLocally();
      renderAdminProblems();
      renderProblems();
      renderAdminDashboard();
    }

    // 4. EXPORT TO EXCEL (.XLSX) WITH SHEETJS
    function exportToExcel() {
      if (typeof XLSX === 'undefined') {
        alert("Đang tải thư viện Excel... Vui lòng thử lại sau vài giây!");
        return;
      }

      const wb = XLSX.utils.book_new();

      // Sheet 1: Học Sinh
      const studentHeaders = ["STT", "Họ và tên", "Lớp", "Tài khoản Marisaoj", "Tài khoản Codeforces", "Tài khoản Vjudge", "Tài khoản VNOI", "ClueOJ", "Tài khoản Chuyên Tin Pro", "Mã PIN cá nhân (Đăng nhập)", "Trạng thái", "Ghi chú"];
      const studentRows = [studentHeaders];
      (appData.students || []).forEach(s => {
        studentRows.push([
          s.stt,
          s.name,
          s.class,
          s.marisa_handle || '',
          s.cf_handle || '',
          s.vjudge_handle || '',
          s.vnoi_handle || '',
          s.clue_handle || '',
          s.ctoj_handle || '',
          s.pin || '',
          s.status || 'Đang học',
          `Lớp ${s.class}`
        ]);
      });
      const wsStudents = XLSX.utils.aoa_to_sheet(studentRows);
      XLSX.utils.book_append_sheet(wb, wsStudents, "Học Sinh");

      // Sheet 2: Học Phí
      const months = appData.tuition_months || ['Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
      const feeHeaders = ["Họ và tên", "Lớp", ...months];
      const feeRows = [feeHeaders];
      (appData.students || []).forEach(s => {
        const row = [s.name, s.class];
        months.forEach(m => {
          row.push((s.tuition && s.tuition[m]) ? "x" : "");
        });
        feeRows.push(row);
      });
      const wsFee = XLSX.utils.aoa_to_sheet(feeRows);
      XLSX.utils.book_append_sheet(wb, wsFee, "Học Phí");

      // Sheet 3: Bài Tập
      const probHeaders = ["Mã bài", "Link bài tập", "Tên bài tập", "Lớp áp dụng", "Level", "Dạng bài", "Nền tảng", "Ghi chú"];
      const probRows = [probHeaders];
      (appData.problems || []).forEach(p => {
        probRows.push([
          p.id,
          p.url,
          p.name,
          (p.classes || []).join(', '),
          1,
          p.category || 'Brute Force',
          p.platform || 'MarisaOJ',
          p.difficulty || ''
        ]);
      });
      const wsProb = XLSX.utils.aoa_to_sheet(probRows);
      XLSX.utils.book_append_sheet(wb, wsProb, "Bài Tập");

      // Sheet 4: Bài Giảng
      const currHeaders = ["Mã bài giảng", "Chương / Tuần", "Tiêu đề bài giảng", "Lớp áp dụng", "Link tài liệu / bài giảng", "Tóm tắt kiến thức"];
      const currRows = [currHeaders];
      (appData.curriculum || []).forEach(c => {
        currRows.push([
          c.id,
          c.chapter || '',
          c.title,
          (c.classes || []).join(', '),
          c.url || '',
          c.summary || ''
        ]);
      });
      const wsCurr = XLSX.utils.aoa_to_sheet(currRows);
      XLSX.utils.book_append_sheet(wb, wsCurr, "Bài Giảng");

      // Sheet 5: Cấu Hình Bảo Mật (5 Roles)
      const secHeaders = ["Tên Đối Tượng / Lớp", "Cấp độ quyền", "Mã truy cập / Mật khẩu", "Mô tả phạm vi truy cập"];
      const secRows = [secHeaders];
      const wsSec = XLSX.utils.aoa_to_sheet(secRows);
      XLSX.utils.book_append_sheet(wb, wsSec, "Cấu Hình Bảo Mật");

      XLSX.writeFile(wb, "Quản lý học sinh.xlsx");
    }

    function exportDataJson() {
      const cleanData = JSON.parse(JSON.stringify(appData || {}));
      delete cleanData.auth_tokens;
      if (cleanData.students) {
        cleanData.students.forEach(s => delete s.pin);
      }
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cleanData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "data.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    }

    function saveAppDataLocally() {
      try {
        if (appData) {
          appData.last_updated = new Date().toISOString();
        }
        localStorage.setItem('cp_app_data', JSON.stringify(appData));
      } catch (e) {
        console.warn("Could not save to localStorage", e);
      }
    }

    function resetServerData() {
      if (confirm("Thao tác này sẽ xóa mọi chỉnh sửa tạm thời trên trình duyệt và tải lại dữ liệu mới nhất từ máy chủ (data.json). Bạn có muốn tiếp tục?")) {
        localStorage.removeItem('cp_app_data');
        location.reload();
      }
    }

    // ============================================================
    // 4.5. TWO-WAY SYNCHRONIZATION ENGINE (WEB <-> GOOGLE SHEETS)
    // ============================================================
    let isTwoWaySyncing = false;

    async function syncToGoogleSheets(payload, options = {}) {
      const gasUrl = localStorage.getItem('cp_gas_sync_url') || (appData && appData.gas_sync_url) || '';
      let synced = false;

      // 1. Try Google Apps Script Web App first if configured
      if (gasUrl && gasUrl.startsWith('http')) {
        try {
          const resp = await fetch(gasUrl, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
          });
          const resJson = await resp.json();
          if (resJson && resJson.status === 'success') {
            synced = true;
          }
        } catch (e) {
          console.warn("GAS sync error:", e);
        }
      }

      // 2. Try Local Judge / Backend Server (http://127.0.0.1:8080/api/...)
      if (!synced) {
        try {
          let apiEndpoint = '/api/sync_two_way';
          if (payload.action === 'update_tuition') apiEndpoint = '/api/update_tuition';
          else if (payload.action === 'update_student_status') apiEndpoint = '/api/update_student_status';
          else if (payload.action === 'save_student') apiEndpoint = '/api/save_student';
          else if (payload.action === 'save_problem') apiEndpoint = '/api/save_problem';
          else if (payload.action === 'save_curriculum') apiEndpoint = '/api/save_curriculum';
          else if (payload.action === 'submit_answer') apiEndpoint = '/api/submit_answer';
          else if (payload.action === 'grade_submission') apiEndpoint = '/api/grade_submission';

          const localResp = await fetch(`http://127.0.0.1:8080${apiEndpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (localResp.ok) {
            const localJson = await localResp.json();
            if (localJson && (localJson.status === 'success' || localJson.status === 'ok')) {
              synced = true;
            }
          }
        } catch (e) {
          // Local judge server may be offline
        }
      }

      if (synced) {
        if (!options.silent) {
          showLiveToast(`⚡ Đã đồng bộ tức thì sang Google Sheet!`, "success");
        }
      } else {
        enqueuePendingSync(payload);
        if (!options.silent) {
          showLiveToast(`💾 Đã lưu thay đổi cục bộ. Sẽ tự động đẩy lên Google Sheet!`, "info");
        }
      }
      return synced;
    }

    function enqueuePendingSync(item) {
      try {
        const queue = JSON.parse(localStorage.getItem('cp_sync_queue') || '[]');
        queue.push({ payload: item, time: Date.now() });
        localStorage.setItem('cp_sync_queue', JSON.stringify(queue));
      } catch(e) {}
    }

    async function flushPendingSync() {
      try {
        const queue = JSON.parse(localStorage.getItem('cp_sync_queue') || '[]');
        if (!queue.length) return;
        const remaining = [];
        for (const it of queue) {
          const ok = await syncToGoogleSheets(it.payload, { silent: true });
          if (!ok) remaining.push(it);
        }
        localStorage.setItem('cp_sync_queue', JSON.stringify(remaining));
      } catch(e) {}
    }

    async function triggerTwoWaySync() {
      if (isTwoWaySyncing) return;
      isTwoWaySyncing = true;
      const btn = document.getElementById('btn-two-way-sync');
      const icon = document.getElementById('sync-icon');
      if (icon) icon.className = "animate-spin inline-block";
      if (btn) btn.disabled = true;

      showLiveToast("🔄 Đang thực hiện đồng bộ 2 chiều Web ⇄ Google Sheet...", "info");

      try {
        // 1. Push any pending edits from web to sheet
        await flushPendingSync();

        // Require an actual server acknowledgement before reporting success.
        const syncResponse = await fetch('http://127.0.0.1:8080/api/sync_two_way', { method: 'POST' });
        if (!syncResponse.ok) throw new Error(`Máy chủ đồng bộ trả về HTTP ${syncResponse.status}`);
        const syncResult = await syncResponse.json();
        if (syncResult.status !== 'success' || syncResult.pull_success === false) {
          throw new Error(syncResult.message || 'Máy chủ chưa hoàn thành đồng bộ.');
        }

        // 3. Pull latest data.json
        const fetchResp = await fetch(`data.json?t=${Date.now()}`);
        if (!fetchResp.ok) throw new Error('Không tải được kho bài tập sau khi đồng bộ.');
        if (fetchResp.ok) {
          const catalog = await fetchResp.json();
          const [students, submissions] = await Promise.all([
            fetchStudentsFromFirebase(), fetchSubmissionsFromFirebase()
          ]);
          appData = {
            ...appData, ...catalog,
            students: students ?? appData.students ?? [],
            submissions: submissions ?? appData.submissions ?? []
          };
          localStorage.removeItem('cp_app_data');
          renderMatrix();
          renderProblems();
          renderCurriculum();
          renderAdminStudents();
          renderAdminCurriculum();
          renderAdminProblems();
          renderAdminDashboard();
        }

        showLiveToast("✅ Máy chủ đã hoàn thành đồng bộ 2 chiều.", "success");
      } catch (err) {
        console.error("Two-way sync error:", err);
        showLiveToast(`⚠️ Lỗi đồng bộ: ${err.message}`, "error");
      } finally {
        isTwoWaySyncing = false;
        if (icon) icon.className = "";
        if (btn) btn.disabled = false;
      }
    }

    function openSyncSettingsModal() {
      const modal = document.getElementById('modal-sync-settings');
      if (!modal) return;
      modal.classList.remove('hidden');

      const savedUrl = localStorage.getItem('cp_gas_sync_url') || (appData && appData.gas_sync_url) || '';
      const inputGas = document.getElementById('cfg-gas-url');
      if (inputGas) inputGas.value = savedUrl;

      const savedFbUrl = localStorage.getItem('cp_firebase_db_url') || (typeof FIREBASE_CONFIG !== 'undefined' ? FIREBASE_CONFIG.databaseURL : '');
      const inputFb = document.getElementById('cfg-firebase-url');
      if (inputFb) inputFb.value = savedFbUrl;

      checkSyncChannelsStatus();
    }

    function closeSyncSettingsModal() {
      const modal = document.getElementById('modal-sync-settings');
      if (modal) modal.classList.add('hidden');
    }

    function saveSyncSettings() {
      const inputGas = document.getElementById('cfg-gas-url');
      const valGas = inputGas ? inputGas.value.trim() : '';
      if (valGas) {
        localStorage.setItem('cp_gas_sync_url', valGas);
      } else {
        localStorage.removeItem('cp_gas_sync_url');
      }

      const inputFb = document.getElementById('cfg-firebase-url');
      const valFb = inputFb ? inputFb.value.trim() : '';
      if (valFb) {
        localStorage.setItem('cp_firebase_db_url', valFb);
      } else {
        localStorage.removeItem('cp_firebase_db_url');
      }

      showLiveToast("Đã lưu cấu hình Google Sheet & Firebase!", "success");
      checkSyncChannelsStatus();
    }

    async function checkSyncChannelsStatus() {
      const lblLocal = document.getElementById('sync-lbl-local');
      const lblGas = document.getElementById('sync-lbl-gas');
      const lblFb = document.getElementById('sync-lbl-firebase');
      const gasUrl = localStorage.getItem('cp_gas_sync_url') || '';
      const fbUrl = (localStorage.getItem('cp_firebase_db_url') || (typeof FIREBASE_CONFIG !== 'undefined' ? FIREBASE_CONFIG.databaseURL : '')).trim();

      if (lblLocal) lblLocal.textContent = "Đang kiểm tra...";
      if (lblGas) lblGas.textContent = gasUrl ? "Đã cấu hình URL" : "Chưa cấu hình";
      if (lblFb) lblFb.textContent = (fbUrl && !fbUrl.includes('webhoctap-default-rtdb.firebaseio.com')) ? "Đang kết nối..." : "Chưa cấu hình URL";

      // Test local server
      try {
        const resp = await fetch('http://127.0.0.1:8080/api/sheet_status', { signal: AbortSignal.timeout(3000) });
        if (resp.ok) {
          const json = await resp.json();
          if (lblLocal) {
            lblLocal.textContent = `🟢 Sẵn sàng (${json.spreadsheet_title || 'Google Sheet'})`;
            lblLocal.className = "font-mono text-emerald-400 font-bold";
          }
        } else {
          throw new Error();
        }
      } catch(e) {
        if (lblLocal) {
          lblLocal.textContent = "⚪ Chưa bật máy chủ local";
          lblLocal.className = "font-mono text-slate-500";
        }
      }

      // Test GAS
      if (gasUrl && lblGas) {
        try {
          const resp = await fetch(gasUrl, { signal: AbortSignal.timeout(4000) });
          if (resp.ok) {
            lblGas.textContent = "🟢 Hoạt động tốt (Apps Script)";
            lblGas.className = "font-mono text-emerald-400 font-bold";
          } else {
            lblGas.textContent = "🟡 Đã cài URL";
          }
        } catch(e) {
          lblGas.textContent = "🟢 Đã thiết lập Webhook";
        }
      }

      // Test Firebase
      if (fbUrl && !fbUrl.includes('webhoctap-default-rtdb.firebaseio.com') && lblFb) {
        try {
          const probeUrl = `${fbUrl.replace(/\/+$/, '')}/auth_tokens/test_probe.json`;
          const resp = await fetch(probeUrl, { signal: AbortSignal.timeout(4000) });
          if (resp.ok || resp.status === 401 || resp.status === 403) {
            lblFb.textContent = "🟢 Sẵn sàng (Bảo mật Rules)";
            lblFb.className = "font-mono text-emerald-400 font-bold";
          } else {
            lblFb.textContent = `🟡 Phản hồi HTTP ${resp.status}`;
            lblFb.className = "font-mono text-amber-400 font-semibold";
          }
        } catch(e) {
          lblFb.textContent = "🔴 Lỗi kết nối Firebase";
          lblFb.className = "font-mono text-rose-400 font-semibold";
        }
      } else if (lblFb) {
        lblFb.textContent = "⚪ Chưa cấu hình";
        lblFb.className = "font-mono text-slate-500";
      }
    }

    async function testSyncConnection() {
      showLiveToast("Đang kiểm tra kết nối tới Google Sheets & Firebase...", "info");
      await checkSyncChannelsStatus();
      showLiveToast("Kiểm tra kết nối hoàn tất!", "success");
    }

    async function pushDataToFirebaseGUI() {
      if (!isFirebaseConfigured()) {
        alert("Vui lòng nhập và lưu URL Firebase Realtime Database trước khi đẩy dữ liệu!\n(Ví dụ: https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app)");
        return;
      }
      if (!appData || !appData.students || appData.students.length === 0) {
        alert("Không có dữ liệu học sinh trong bộ nhớ để đẩy lên Firebase!");
        return;
      }
      showLiveToast("Đang đồng bộ dữ liệu lên Firebase Realtime Database...", "info");
      const ok = await pushFullDatabaseToFirebaseClient(appData);
      if (ok) {
        showLiveToast(`🔥 Đã đồng bộ thành công ${appData.students.length} học sinh lên Firebase!`, "success");
        await checkSyncChannelsStatus();
      } else {
        showLiveToast("❌ Lỗi khi đẩy dữ liệu lên Firebase. Vui lòng kiểm tra lại URL và Rules!", "error");
      }
    }

    async function uploadJsonFileToFirebase(evt) {
      const file = evt.target.files && evt.target.files[0];
      if (!file) return;
      if (!isFirebaseConfigured()) {
        alert("Vui lòng nhập và lưu URL Firebase Realtime Database trước khi đẩy dữ liệu!\n(Ví dụ: https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app)");
        evt.target.value = '';
        return;
      }
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        showLiveToast(`Đang đẩy tệp ${file.name} lên Firebase...`, "info");
        const ok = await pushFullDatabaseToFirebaseClient(parsed);
        if (ok) {
          if (parsed.students && parsed.students.length > 0) {
            appData.students = parsed.students;
            localStorage.setItem('cp_cached_students', JSON.stringify(parsed.students));
            saveAppDataLocally();
            renderAdminStudents();
            renderAdminDashboard();
            renderScoreboard();
            renderMatrix();
          }
          showLiveToast(`🔥 Đã nhập thành công ${file.name} lên Firebase!`, "success");
        } else {
          showLiveToast("❌ Không thể tải lên Firebase. Vui lòng kiểm tra lại Rules hoặc URL!", "error");
        }
      } catch (err) {
        showLiveToast(`❌ Lỗi đọc tệp JSON: ${err.message}`, "error");
      }
      evt.target.value = '';
    }

    async function pullDataFromFirebaseGUI() {
      if (!isFirebaseConfigured()) {
        alert("Vui lòng nhập và lưu URL Firebase Realtime Database trước!");
        return;
      }
      showLiveToast("Đang tải dữ liệu từ Firebase Realtime Database...", "info");
      const fbStudents = await fetchStudentsFromFirebase();
      if (fbStudents && fbStudents.length > 0) {
        appData.students = fbStudents;
        localStorage.setItem('cp_cached_students', JSON.stringify(fbStudents));
        saveAppDataLocally();
        renderAdminStudents();
        renderAdminDashboard();
        renderScoreboard();
        renderMatrix();
        showLiveToast(`✅ Đã tải về thành công ${fbStudents.length} học sinh từ Firebase!`, "success");
      } else {
        showLiveToast("⚠️ Chưa tìm thấy dữ liệu học sinh trên Firebase Realtime Database!", "warning");
      }
    }

    // Attempt to flush pending changes on startup or reconnection
    window.addEventListener('online', flushPendingSync);

    // ============================================================
    // 5. ONLINE JUDGE & TESTCASE GRADER ENGINE (DERUCKOJ)
    // ============================================================
    let currentJudgeProbId = 'CPP-EX-01';
    let currentJudgeLang = 'cpp';
    let isJudging = false;
    let localJudgeAvailable = null;
    let judgeSubmissionHistory = [];
    let currentTestcaseEditingProbId = 'CPP-EX-01';

    function getGraderProblems() {
      let list = [];
      if (appData && Array.isArray(appData.problems) && appData.problems.length > 0) {
        list = appData.problems;
      } else if (appData && Array.isArray(appData.grader_problems) && appData.grader_problems.length > 0) {
        list = appData.grader_problems;
      }
      return list;
    }

    // Math text formatting helper for DeruckOJ formulas
    function formatMathText(str) {
      if (!str) return '';
      return String(str)
        .replace(/\\le/g, '≤')
        .replace(/\\ge/g, '≥')
        .replace(/\\times/g, '×')
        .replace(/\\ne/g, '≠')
        .replace(/\\pmod\s*([a-zA-Z0-9_]+)/g, 'mod $1')
        .replace(/\\dots/g, '...')
        .replace(/\$([^\$]+)\$/g, '<code class="font-mono text-indigo-300 font-semibold px-1 py-0.5 bg-slate-950 rounded text-[11px]">$1</code>');
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

    // DeruckOJ Tabs Management
    let currentDmojTab = 'problem'; // 'problem' | 'submit' | 'history'

    function switchDmojTab(tab) {
      currentDmojTab = tab;
      updateDmojTabsUI();
      if (tab === 'history') {
        renderJudgeSubmissionHistory();
      }
    }

    function updateDmojTabsUI() {
      const btnProb = document.getElementById('dmoj-tab-problem');
      const btnSub = document.getElementById('dmoj-tab-submit');
      const btnHist = document.getElementById('dmoj-tab-history');

      const colProb = document.getElementById('dmoj-col-problem');
      const colSub = document.getElementById('dmoj-col-submit');
      const colHist = document.getElementById('dmoj-col-history');

      if (!colProb || !colSub || !colHist) return;

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

    function renderJudgeWorkspace() {
      if (isJudging) return;
      checkLocalJudgeHealth();
      const graderProbs = getGraderProblems();
      
      const countEl = document.getElementById('judge-problems-count');
      if (countEl) countEl.textContent = `${graderProbs.length} bài DeruckOJ`;

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
              const me = getActiveStudent();
              if (me && me.solved && me.solved.includes(p.id)) isSolved = true;
            }

            btn.onclick = () => selectJudgeProblem(p.id);
            btn.className = `px-3 py-1.5 rounded-xl text-xs font-mono font-semibold whitespace-nowrap flex items-center gap-1.5 transition cursor-pointer border ${
              isSelected 
                ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30' 
                : 'bg-slate-950/70 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`;
            btn.innerHTML = `
              <span>${isSolved ? '✅' : '⚡'}</span>
              <span class="font-bold">${p.id}</span>
              <span class="text-[10px] text-amber-300 font-mono">★ ${p.points || 10}p</span>
              <span class="text-[10px] opacity-75 font-sans hidden sm:inline">${p.name.length > 18 ? p.name.slice(0, 16) + '...' : p.name}</span>
            `;
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

      // Update DeruckOJ Meta & Header Details
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
      if (pointsEl) pointsEl.textContent = `★ ${prob.points || 10} Điểm`;
      if (timeEl) timeEl.textContent = `⏱️ ${prob.time_limit || '1.0s'}`;
      if (memEl) memEl.textContent = `💾 ${prob.memory_limit || '256M'}`;
      if (authorEl) authorEl.textContent = `👤 ${prob.author || 'DeruckOJ / Thầy Phùng Đức'}`;

      if (typesContainer) {
        const typesList = prob.types || [prob.category || 'Cơ bản'];
        typesContainer.innerHTML = `<span class="text-xs text-slate-400">Dạng bài:</span> ` +
          typesList.map(t => `<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">${t}</span>`).join(' ');
      }

      // Solved badge
      if (statusBadge) {
        let isSolved = false;
        if (currentAuth && currentAuth.role === 'student' && appData && appData.students) {
          const me = getActiveStudent();
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

      // DeruckOJ Sample Cases
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
            card.innerHTML = `
              <div class="flex items-center justify-between text-slate-400 text-[11px] font-sans font-bold">
                <span class="text-indigo-300 flex items-center gap-1.5"><span>🧪</span> Ví dụ #${idx + 1}</span>
                <span class="text-[10px] text-emerald-400 font-mono">Test công khai</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div class="space-y-1">
                  <div class="flex items-center justify-between text-[10px] text-slate-400">
                    <span class="font-bold text-indigo-400">Input:</span>
                    <button type="button" onclick="copyTextToClipboard(${escapeHtml(JSON.stringify(tc.input))})" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white transition text-[10px] cursor-pointer">Sao chép</button>
                  </div>
                  <pre class="bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-slate-200 overflow-x-auto whitespace-pre-wrap">${escapeHtml(tc.input)}</pre>
                </div>
                <div class="space-y-1">
                  <div class="flex items-center justify-between text-[10px] text-slate-400">
                    <span class="font-bold text-emerald-400">Output:</span>
                    <button type="button" onclick="copyTextToClipboard(${escapeHtml(JSON.stringify(tc.output))})" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 hover:text-white transition text-[10px] cursor-pointer">Sao chép</button>
                  </div>
                  <pre class="bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-emerald-300 overflow-x-auto whitespace-pre-wrap">${escapeHtml(tc.output)}</pre>
                </div>
              </div>
              ${tc.explanation ? `
                <div class="text-[11px] text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 font-sans">
                  <span class="text-amber-300 font-bold">💡 Giải thích:</span> ${formatMathText(tc.explanation)}
                </div>
              ` : ''}
            `;
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
        const savedCode = localStorage.getItem(`deruck_code_${currentJudgeProbId}_${currentJudgeLang}`);
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
        resStdout.textContent = 'Bấm "▶️ Chạy thử" để xem kết quả.';
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
      if (isJudging) { showLiveToast('Đợi lượt chấm hiện tại kết thúc trước khi đổi bài.'); return; }
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
        localStorage.setItem(`deruck_code_${currentJudgeProbId}_${currentJudgeLang}`, codeEditor.value);
      }
    }

    function setJudgeLanguage(lang) {
      if (isJudging) return;
      if (currentJudgeLang === lang) return;
      saveCurrentJudgeCodeToLocal();
      currentJudgeLang = lang;
      updateJudgeLangUI();

      const codeEditor = document.getElementById('judge-code-editor');
      if (codeEditor) {
        const savedCode = localStorage.getItem(`deruck_code_${currentJudgeProbId}_${currentJudgeLang}`);
        if (savedCode !== null) {
          codeEditor.value = savedCode;
        } else {
          codeEditor.value = getStarterTemplate(currentJudgeProbId, currentJudgeLang);
        }
      }
      showLiveToast(`Đã chuyển sang ${lang === 'cpp' ? 'C++20' : 'Python 3'}`);
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
          langInfo.textContent = "Python 3 (thời gian ×2, tối thiểu 2.5s)";
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

    async function runJudgeCode() {
      if (isJudging) return;
      const codeEditor = document.getElementById('judge-code-editor');
      const code = codeEditor ? codeEditor.value : '';
      if (!code.trim()) {
        alert("Vui lòng viết code trước khi chạy thử!");
        return;
      }

      saveCurrentJudgeCodeToLocal();

      const customInputEl = document.getElementById('judge-custom-input');
      let customInput = customInputEl ? customInputEl.value : '';

      isJudging = true;
      const btnRun = document.getElementById('btn-judge-run');
      const btnSubmit = document.getElementById('btn-judge-submit');
      if (btnRun) {
        btnRun.disabled = true;
        btnRun.innerHTML = '<span>⏳</span> Đang chạy...';
      }
      if (btnSubmit) btnSubmit.disabled = true;

      const resStdout = document.getElementById('judge-custom-run-stdout');
      const resStderr = document.getElementById('judge-custom-run-stderr');
      const resStderrBox = document.getElementById('judge-custom-run-stderr-box');
      const resMeta = document.getElementById('judge-custom-run-meta');

      if (resStdout) {
        resStdout.className = "w-full h-full min-h-[76px] bg-slate-900 border border-slate-700 rounded-xl p-2.5 font-mono text-xs text-slate-400 whitespace-pre-wrap overflow-y-auto max-h-36";
        resStdout.textContent = 'Đang thực thi mã nguồn...';
      }
      if (resStderrBox) resStderrBox.classList.add('hidden');

      try {
        const prob = getGraderProblems().find(p => p.id === currentJudgeProbId);
        const timeLimit = (prob && prob.time_limit) ? prob.time_limit : 1.0;
        const res = await executeCode(currentJudgeLang, code, customInput, timeLimit);

        if (resMeta) {
          const isOK = (res.status === 'OK');
          resMeta.className = `text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
            isOK 
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
          }`;
          const srvTag = res.server ? ` [${res.server}]` : '';
          resMeta.textContent = `${res.status} | ${res.execution_time ? (res.execution_time + 's') : '0.05s'}${srvTag}`;
        }

        if (res.status === 'CE') {
          if (resStdout) {
            resStdout.className = "w-full h-full min-h-[76px] bg-slate-900 border border-amber-500/40 rounded-xl p-2.5 font-mono text-xs text-amber-300 whitespace-pre-wrap overflow-y-auto max-h-36";
            resStdout.textContent = '(Không có đầu ra do lỗi biên dịch)';
          }
          if (resStderrBox && resStderr) {
            resStderrBox.classList.remove('hidden');
            resStderr.textContent = res.compile_error || 'Compilation Error';
          }
        } else {
          if (resStdout) {
            const isSuccess = (res.status === 'OK');
            resStdout.className = `w-full h-full min-h-[76px] bg-slate-900 border ${isSuccess ? 'border-emerald-500/40 text-emerald-300' : 'border-rose-500/40 text-rose-300'} rounded-xl p-2.5 font-mono text-xs whitespace-pre-wrap overflow-y-auto max-h-36`;
            resStdout.textContent = res.stdout ? res.stdout : '(Chương trình chạy xong nhưng không in gì ra màn hình)';
          }
          if (res.stderr && res.stderr.trim()) {
            if (resStderrBox && resStderr) {
              resStderrBox.classList.remove('hidden');
              let errMsg = res.stderr;
              if (errMsg.includes('EOFError')) {
                errMsg += '\n\n💡 MẸO GỠ LỖI: Lỗi EOFError xảy ra khi gọi int(input()) mà hết dữ liệu đầu vào. Bạn hãy nhập thêm dữ liệu vào ô "Dữ liệu vào (Input)" ở bên trái nhé!';
              } else if (errMsg.includes('ValueError: invalid literal for int()')) {
                errMsg += '\n\n💡 MẸO GỠ LỖI: Lỗi ValueError khi int(input()) thường do dữ liệu vào có nhiều số trên 1 dòng (ví dụ "2 3"). Trong Python, hãy dùng: a, b = map(int, input().split())';
              }
              resStderr.textContent = errMsg;
            }
          } else {
            if (resStderrBox) resStderrBox.classList.add('hidden');
          }
        }
      } catch (err) {
        if (resStdout) {
          resStdout.className = "w-full h-full min-h-[76px] bg-slate-900 border border-rose-500/40 rounded-xl p-2.5 font-mono text-xs text-rose-300 whitespace-pre-wrap overflow-y-auto max-h-36";
          resStdout.textContent = 'Lỗi thực thi: ' + err.message;
        }
      } finally {
        isJudging = false;
        if (btnRun) {
          btnRun.disabled = false;
          btnRun.innerHTML = '<span>▶️</span> Chạy Thử';
        }
        if (btnSubmit) btnSubmit.disabled = false;
      }
    }
    const runJudgeCustomCode = runJudgeCode;
    const runJudgeSampleOnly = runJudgeCode;

    function insertJudgeStarterTemplate() {
      const codeEditor = document.getElementById('judge-code-editor');
      if (codeEditor) {
        codeEditor.value = '';
        saveCurrentJudgeCodeToLocal();
      }
    }

    function clearJudgeCode() {
      if (confirm("Bạn có chắc chắn muốn xóa trắng code hiện tại để tự viết không?")) {
        const codeEditor = document.getElementById('judge-code-editor');
        if (codeEditor) {
          codeEditor.value = '';
          saveCurrentJudgeCodeToLocal();
          showLiveToast("Đã xóa trắng code!");
        }
      }
    }

    function normalizeOutput(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .map(line => line.trimEnd())
        .join('\n')
        .trim();
    }

    // SUBMIT STRESS JUDGE (CHẤM BÀI BẰNG CODE: GENERATOR + SOLUTION)
    async function submitJudgeByCodeStress(prob, code) {
      if (isJudging) return;
      if (!currentAuth) {
        showLiveToast('⚠️ Vui lòng đăng nhập (bằng Mã PIN hoặc chọn Học sinh) để hệ thống lưu bài nộp và tính điểm cho bạn!', 'warning');
        showAuthModal();
        return;
      }
      isJudging = true;

      const btnRun = document.getElementById('btn-judge-run');
      const btnSubmit = document.getElementById('btn-judge-submit');
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span>⏳</span> Đang chấm bài...';
      }
      if (btnRun) btnRun.disabled = true;

      const progressContainer = document.getElementById('judge-progress-container');
      const progressBar = document.getElementById('judge-progress-bar');
      const progressText = document.getElementById('judge-progress-text');
      const progressPct = document.getElementById('judge-progress-pct');
      const banner = document.getElementById('judge-verdict-banner');
      const ceBox = document.getElementById('judge-ce-container');
      const ceText = document.getElementById('judge-ce-text');
      const matrix = document.getElementById('judge-test-matrix');
      const verdictTag = document.getElementById('judge-verdict-tag');
      const detailBox = document.getElementById('judge-test-detail-box');

      if (progressContainer) progressContainer.classList.remove('hidden');
      if (banner) banner.classList.add('hidden');
      if (ceBox) ceBox.classList.add('hidden');
      if (detailBox) detailBox.classList.add('hidden');
      if (matrix) matrix.innerHTML = '';
      if (verdictTag) {
        verdictTag.className = "text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 animate-pulse";
        verdictTag.textContent = "Đang chấm...";
      }

      const totalTests = Math.min(Math.max(parseInt(prob.code_test_count || 10, 10), 1), 30);
      let acCount = 0;
      let firstFailedVerdict = null;
      let isCE = false;
      const genLang = prob.generator_lang || 'python';
      const solLang = prob.solution_lang || 'cpp';

      try {
        for (let i = 0; i < totalTests; i++) {
          const pct = Math.round(((i + 1) / totalTests) * 100);
          if (progressText) progressText.textContent = `Đang sinh & chấm test ${i + 1}/${totalTests}...`;
          if (progressPct) progressPct.textContent = `${pct}%`;
          if (progressBar) progressBar.style.width = `${pct}%`;

          // 1. Sinh dữ liệu vào từ Generator
          const genRes = await executeCode(genLang, prob.generator_code, "");
          if (genRes.status === 'CE' || genRes.status === 'RTE') {
            throw new Error(`Lỗi bộ sinh test (Generator): ${genRes.compile_error || genRes.stderr || genRes.error || 'Không sinh được test'}`);
          }
          const testIn = (genRes.stdout || '').trimEnd() + '\n';

          // 2. Chạy Lời giải chuẩn (Solution)
          const solRes = await executeCode(solLang, prob.solution_code, testIn, prob.time_limit || 1.0);
          if (solRes.status === 'CE' || solRes.status === 'RTE') {
            throw new Error(`Lỗi lời giải chuẩn (Solution): ${solRes.compile_error || solRes.stderr || solRes.error || 'Lời giải gặp lỗi'}`);
          }
          const expectedOut = solRes.stdout || '';

          // 3. Chạy mã nguồn của học sinh
          const res = await executeCode(currentJudgeLang, code, testIn, prob.time_limit || 1.0);

          if (res.status === 'CE') {
            isCE = true;
            firstFailedVerdict = 'CE';
            if (ceBox && ceText) {
              ceBox.classList.remove('hidden');
              ceText.textContent = res.compile_error || 'Compilation Error';
            }
            break;
          }

          let testVerdict = 'AC';
          if (res.status === 'TLE') {
            testVerdict = 'TLE';
          } else if (res.status === 'RTE') {
            testVerdict = 'RTE';
          } else {
            const normActual = normalizeOutput(res.stdout);
            const normExpected = normalizeOutput(expectedOut);
            if (normActual !== normExpected) {
              testVerdict = 'WA';
            }
          }

          if (testVerdict === 'AC') {
            acCount++;
          } else if (!firstFailedVerdict) {
            firstFailedVerdict = testVerdict;
          }

          const isAC = (testVerdict === 'AC');
          const cell = document.createElement('div');
          cell.className = `p-2.5 rounded-xl border text-xs font-mono flex flex-col justify-between cursor-pointer transition ${
            isAC 
              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/40' 
              : 'bg-rose-950/50 border-rose-500/40 text-rose-300 hover:bg-rose-900/40'
          }`;
          cell.innerHTML = `
            <div class="flex items-center justify-between">
              <span class="font-bold">Test #${i + 1}</span>
              <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${isAC ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}">${testVerdict}</span>
            </div>
            <div class="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
              <span>Sinh ngẫu nhiên</span>
              <div class="flex items-center gap-1 font-mono">
                ${res.server ? `<span class="opacity-75 text-[9px] font-sans px-1 py-0.2 rounded bg-slate-900 border border-slate-700/60">[${res.server}]</span>` : ''}
                <span>${res.execution_time ? (res.execution_time + 's') : ''}</span>
              </div>
            </div>
          `;
          cell.onclick = () => showJudgeTestDetail(i + 1, testIn, expectedOut, res.stdout, res.stderr, testVerdict, res.server, res.execution_time);
          matrix.appendChild(cell);
        }

        if (progressContainer) progressContainer.classList.add('hidden');

        const finalScore = isCE ? 0 : Math.round((acCount / totalTests) * 100);
        let finalVerdict = 'AC';

        if (isCE) {
          finalVerdict = 'CE';
        } else if (acCount === totalTests) {
          finalVerdict = 'AC';
        } else {
          finalVerdict = firstFailedVerdict || 'WA';
        }

        // Update Verdict Tag
        if (verdictTag) {
          if (finalVerdict === 'AC') {
            verdictTag.className = "text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40";
            verdictTag.textContent = `AC (100/100)`;
          } else if (finalVerdict === 'CE') {
            verdictTag.className = "text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40";
            verdictTag.textContent = `CE (0/100)`;
          } else {
            verdictTag.className = "text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40";
            verdictTag.textContent = `${finalVerdict} (${finalScore}/100)`;
          }
        }

        // Update Verdict Banner
        if (banner) {
          banner.classList.remove('hidden');
          if (finalVerdict === 'AC') {
            banner.className = "rounded-xl p-4 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300";
            banner.innerHTML = `
              <div class="flex items-center gap-3">
                <span class="text-2xl">🎉</span>
                <div>
                  <div class="text-sm font-bold">ACCEPTED (AC) - XUẤT SẮC!</div>
                  <div class="text-xs text-emerald-400/80 font-normal">Vượt qua toàn bộ ${totalTests}/${totalTests} test sinh ngẫu nhiên! Đạt điểm tối đa 100/100.</div>
                </div>
              </div>
              <div class="text-xl font-mono font-black text-emerald-300">100/100</div>
            `;
            handleStudentACRecorded(prob.id);
          } else if (finalVerdict === 'CE') {
            banner.className = "rounded-xl p-4 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 bg-amber-950/80 border border-amber-500/40 text-amber-300";
            banner.innerHTML = `
              <div class="flex items-center gap-3">
                <span class="text-2xl">⚠️</span>
                <div>
                  <div class="text-sm font-bold">COMPILATION ERROR (CE)</div>
                  <div class="text-xs text-amber-400/80 font-normal">Chương trình không biên dịch được. Vui lòng xem thông báo lỗi chi tiết bên dưới.</div>
                </div>
              </div>
              <div class="text-xl font-mono font-black text-amber-300">0/100</div>
            `;
          } else {
            banner.className = "rounded-xl p-4 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 bg-rose-950/80 border border-rose-500/40 text-rose-300";
            banner.innerHTML = `
              <div class="flex items-center gap-3">
                <span class="text-2xl">❌</span>
                <div>
                  <div class="text-sm font-bold">${finalVerdict === 'WA' ? 'WRONG ANSWER (WA)' : (finalVerdict === 'TLE' ? 'TIME LIMIT EXCEEDED (TLE)' : 'RUNTIME ERROR (RTE)')}</div>
                  <div class="text-xs text-rose-400/80 font-normal">Chính xác ${acCount}/${totalTests} test sinh ngẫu nhiên. Bấm vào ô test để xem đối chiếu kết quả.</div>
                </div>
              </div>
              <div class="text-xl font-mono font-black text-rose-300">${finalScore}/100</div>
            `;
          }
        }

        // Add to Submission History
        const histItem = {
          id: createJudgeSubmissionId(),
          timestamp: Date.now(),
          submitted_at: new Date().toLocaleString('vi-VN', { hour12: false }),
          probId: prob.id,
          probName: prob.name,
          lang: (currentJudgeLang === 'cpp' ? 'C++20' : 'Python 3'),
          verdict: finalVerdict,
          score: finalScore,
          acCount,
          totalCount: totalTests,
          code
        };
        saveJudgeSubmissionHistory(histItem);

        try {
          if (appData) {
            if (!appData.submissions) appData.submissions = [];
            const isGuest = !currentAuth;
            const student = (!isGuest && currentAuth.role === 'student' && appData.students) ? getActiveStudent() : null;
            const studentName = student ? student.name : ((currentAuth && currentAuth.name) || 'Khách');
            const studentClass = student ? (student.class || 'C++ nâng cao') : ((currentAuth && currentAuth.class) || 'Khách');
            const studentPin = student ? (student.pin || currentAuth.pin || '') : ((currentAuth && currentAuth.pin) || 'GUEST');
            const studentStt = student ? (student.stt || currentAuth.stt || '') : ((currentAuth && currentAuth.stt) || '');
            const subId = histItem.id;
            const subData = {
              id: subId,
              submitted_at: histItem.submitted_at,
              student_id: studentStt ? String(studentStt) : (studentPin || ''),
              student_stt: studentStt ? Number(studentStt) : '',
              student_pin: studentPin,
              student_name: studentName,
              class_name: studentClass,
              problem_id: prob.id,
              problem_name: prob.name,
              type: 'essay',
              submission_type_display: 'Code DeruckOJ (Chấm bằng code)',
              answer: `[${currentJudgeLang === 'cpp' ? 'C++20' : 'Python 3'}]\n${code}`,
              verdict: finalVerdict,
              lang: (currentJudgeLang === 'cpp' ? 'C++20' : 'Python 3'),
              status: (finalVerdict === 'AC' ? 'Chấm đạt' : 'Cần sửa'),
              score: String(Math.round((acCount / totalTests) * 10)),
              feedback: `Tự động chấm DeruckOJ: ${finalVerdict} (${acCount}/${totalTests} testcase sinh ngẫu nhiên).`
            };
            appData.submissions.unshift(subData);
            saveAppDataLocally();
            try { localStorage.setItem('cp_cached_submissions', JSON.stringify(appData.submissions)); } catch(e) {}

            // Nếu AC thì cập nhật danh sách bài đã giải của học sinh và lưu lên Firebase
            if (finalVerdict === 'AC' && student) {
              if (!student.solved) student.solved = [];
              if (!student.solved.includes(prob.id)) {
                student.solved.push(prob.id);
                saveAppDataLocally();
                if (typeof saveStudentSolvedToFirebase === 'function') {
                  saveStudentSolvedToFirebase(student, prob.id).catch(() => {});
                }
              }
            }

            if (typeof reconcileStudentSolvedState === 'function') {
              reconcileStudentSolvedState();
            }
            if (typeof renderGlobalSubmissions === 'function') renderGlobalSubmissions();
            renderProblems();
            renderMatrix();

            await syncJudgeSubmissionRecord(subData);
          }
        } catch (subErr) {
          console.warn("Could not save judge submission:", subErr);
        }

      } catch (err) {
        if (progressContainer) progressContainer.classList.add('hidden');
        showJudgeServiceError(err);
        if (verdictTag) {
          verdictTag.className = "text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40";
          verdictTag.textContent = "CHƯA CHẤM XONG";
        }
      } finally {
        isJudging = false;
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = '<span>🚀</span> Nộp bài';
        }
        if (btnRun) btnRun.disabled = false;
      }
    }

    // SUBMIT ALL TESTS & FULL JUDGING
    async function submitJudgeAllTests() {
      if (isJudging) return;
      if (!currentAuth) {
        showLiveToast('ℹ️ Bạn đang nộp bài ở Chế độ Khách. Kết quả bài nộp sẽ được lưu vào hệ thống!', 'info');
      }
      const prob = getGraderProblems().find(p => p.id === currentJudgeProbId);
      if (!prob) return;

      const codeEditor = document.getElementById('judge-code-editor');
      const code = codeEditor ? codeEditor.value : '';
      if (!code.trim()) {
        alert("Vui lòng viết code trước khi nộp bài!");
        return;
      }

      saveCurrentJudgeCodeToLocal();

      // If problem configured with code-based grading, run stress judge
      if (prob.grading_method === 'code' && prob.generator_code && prob.solution_code) {
        await submitJudgeByCodeStress(prob, code);
        return;
      }

      const tests = prob.testcases || [];
      if (tests.length === 0) {
        if (prob.grading_method === 'code') {
          alert("Bài tập này được thiết lập chấm bằng code nhưng thiếu mã nguồn sinh test hoặc lời giải chuẩn!");
        } else {
          if (confirm("Bài tập này chưa có bộ test tự động. Bạn có muốn nộp mã nguồn này để Thầy xem và chấm điểm trực tiếp không?")) {
            openSubmitModal(prob.id);
            setTimeout(() => {
              switchSubmitMode('essay');
              const essayInput = document.getElementById('submit-essay-input');
              if (essayInput) {
                essayInput.value = code;
                const charEl = document.getElementById('submit-essay-char-count');
                if (charEl) charEl.textContent = `${essayInput.value.length} ký tự`;
              }
            }, 100);
          }
        }
        return;
      }

      isJudging = true;
      const btnRun = document.getElementById('btn-judge-run');
      const btnSubmit = document.getElementById('btn-judge-submit');
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span>⏳</span> Đang chấm bài...';
      }
      if (btnRun) btnRun.disabled = true;

      const progressContainer = document.getElementById('judge-progress-container');
      const progressBar = document.getElementById('judge-progress-bar');
      const progressText = document.getElementById('judge-progress-text');
      const progressPct = document.getElementById('judge-progress-pct');
      const banner = document.getElementById('judge-verdict-banner');
      const ceBox = document.getElementById('judge-ce-container');
      const ceText = document.getElementById('judge-ce-text');
      const matrix = document.getElementById('judge-test-matrix');
      const verdictTag = document.getElementById('judge-verdict-tag');
      const detailBox = document.getElementById('judge-test-detail-box');

      if (progressContainer) progressContainer.classList.remove('hidden');
      if (banner) banner.classList.add('hidden');
      if (ceBox) ceBox.classList.add('hidden');
      if (detailBox) detailBox.classList.add('hidden');
      if (matrix) matrix.innerHTML = '';
      if (verdictTag) {
        verdictTag.className = "text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 animate-pulse";
        verdictTag.textContent = "Đang chấm...";
      }

      try {

      let acCount = 0;
      let firstFailedVerdict = null;
      let isCE = false;
      const submittedLanguage = currentJudgeLang;
      if (progressText) progressText.textContent = `Đang biên dịch và chạy ${tests.length} test...`;
      const batchResults = await executeJudgeBatch(submittedLanguage, code, tests, prob.time_limit || 1.0);

      for (let i = 0; i < tests.length; i++) {
        const tc = tests[i];
        const pct = Math.round(((i + 1) / tests.length) * 100);
        if (progressText) progressText.textContent = `Đang chấm test ${i + 1}/${tests.length}...`;
        if (progressPct) progressPct.textContent = `${pct}%`;
        if (progressBar) progressBar.style.width = `${pct}%`;

        const res = batchResults[i] || batchResults[0];

        if (res.status === 'CE') {
          isCE = true;
          firstFailedVerdict = 'CE';
          if (ceBox && ceText) {
            ceBox.classList.remove('hidden');
            ceText.textContent = res.compile_error || 'Compilation Error';
          }
          break;
        }

        let testVerdict = 'AC';
        if (res.status === 'TLE') {
          testVerdict = 'TLE';
        } else if (res.status === 'RTE' || res.status === 'OLE') {
          testVerdict = res.status;
        } else {
          const normActual = normalizeOutput(res.stdout);
          const normExpected = normalizeOutput(tc.output);
          if (normActual !== normExpected) {
            testVerdict = 'WA';
          }
        }

        if (testVerdict === 'AC') {
          acCount++;
        } else if (!firstFailedVerdict) {
          firstFailedVerdict = testVerdict;
        }

        const isAC = (testVerdict === 'AC');
        const cell = document.createElement('div');
        cell.className = `p-2.5 rounded-xl border text-xs font-mono flex flex-col justify-between cursor-pointer transition ${
          isAC 
            ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/40' 
            : 'bg-rose-950/50 border-rose-500/40 text-rose-300 hover:bg-rose-900/40'
        }`;
        cell.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="font-bold">Test #${i + 1}</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${isAC ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}">${testVerdict}</span>
          </div>
          <div class="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
            <span>${tc.sample ? 'Ví dụ' : 'Test ẩn'}</span>
            <div class="flex items-center gap-1 font-mono">
              ${res.server ? `<span class="opacity-75 text-[9px] font-sans px-1 py-0.2 rounded bg-slate-900 border border-slate-700/60">[${res.server}]</span>` : ''}
              <span>${res.execution_time ? (res.execution_time + 's') : ''}</span>
            </div>
          </div>
        `;
        cell.onclick = () => showJudgeTestDetail(i + 1, tc.input, tc.output, res.stdout, res.stderr, testVerdict, res.server, res.execution_time);
        matrix.appendChild(cell);
      }

      if (progressContainer) progressContainer.classList.add('hidden');

      const finalScore = Math.round((acCount / tests.length) * 100);
      let finalVerdict = 'AC';

      if (isCE) {
        finalVerdict = 'CE';
      } else if (acCount === tests.length) {
        finalVerdict = 'AC';
      } else {
        finalVerdict = firstFailedVerdict || 'WA';
      }

      // Update Verdict Tag
      if (verdictTag) {
        if (finalVerdict === 'AC') {
          verdictTag.className = "text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40";
          verdictTag.textContent = `AC (100/100)`;
        } else if (finalVerdict === 'CE') {
          verdictTag.className = "text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40";
          verdictTag.textContent = `CE (0/100)`;
        } else {
          verdictTag.className = "text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40";
          verdictTag.textContent = `${finalVerdict} (${finalScore}/100)`;
        }
      }

      // Update Verdict Banner
      if (banner) {
        banner.classList.remove('hidden');
        if (finalVerdict === 'AC') {
          banner.className = "rounded-xl p-4 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300";
          banner.innerHTML = `
            <div class="flex items-center gap-3">
              <span class="text-2xl">🎉</span>
              <div>
                <div class="text-sm font-bold">ACCEPTED (AC) - XUẤT SẮC!</div>
                <div class="text-xs text-emerald-400/80 font-normal">Vượt qua toàn bộ ${tests.length}/${tests.length} testcase! Đạt điểm tối đa 100/100.</div>
              </div>
            </div>
            <div class="text-xl font-mono font-black text-emerald-300">100/100</div>
          `;

          // Handle Student Progress & AC Recording
          handleStudentACRecorded(prob.id);

        } else if (finalVerdict === 'CE') {
          banner.className = "rounded-xl p-4 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 bg-amber-950/80 border border-amber-500/40 text-amber-300";
          banner.innerHTML = `
            <div class="flex items-center gap-3">
              <span class="text-2xl">⚠️</span>
              <div>
                <div class="text-sm font-bold">COMPILATION ERROR (CE)</div>
                <div class="text-xs text-amber-400/80 font-normal">Chương trình không biên dịch được. Vui lòng xem thông báo lỗi chi tiết bên dưới.</div>
              </div>
            </div>
            <div class="text-xl font-mono font-black text-amber-300">0/100</div>
          `;
        } else {
          banner.className = "rounded-xl p-4 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 bg-rose-950/80 border border-rose-500/40 text-rose-300";
          banner.innerHTML = `
            <div class="flex items-center gap-3">
              <span class="text-2xl">❌</span>
              <div>
                <div class="text-sm font-bold">${finalVerdict === 'WA' ? 'WRONG ANSWER (WA)' : (finalVerdict === 'TLE' ? 'TIME LIMIT EXCEEDED (TLE)' : 'RUNTIME ERROR (RTE)')}</div>
                <div class="text-xs text-rose-400/80 font-normal">Chính xác ${acCount}/${tests.length} testcase. Bấm vào ô test để xem sự khác biệt.</div>
              </div>
            </div>
            <div class="text-xl font-mono font-black text-rose-300">${finalScore}/100</div>
          `;
        }
      }

      // Add to Submission History
      const histItem = {
        id: createJudgeSubmissionId(),
        timestamp: Date.now(),
        submitted_at: new Date().toLocaleString('vi-VN', { hour12: false }),
        probId: prob.id,
        probName: prob.name,
        lang: (currentJudgeLang === 'cpp' ? 'C++20' : 'Python 3'),
        verdict: finalVerdict,
        score: finalScore,
        acCount,
        totalCount: tests.length,
        code
      };
      saveJudgeSubmissionHistory(histItem);

      // Also register submission in appData.submissions & sync to Google Sheet 'Bài Nộp'
      try {
        if (appData) {
          if (!appData.submissions) appData.submissions = [];
          const isGuest = !currentAuth;
          const student = (!isGuest && currentAuth.role === 'student' && appData.students) ? getActiveStudent() : null;
          const studentName = student ? student.name : ((currentAuth && currentAuth.name) || 'Khách');
          const studentClass = student ? (student.class || 'C++ nâng cao') : ((currentAuth && currentAuth.class) || 'Khách');
          const studentPin = student ? (student.pin || currentAuth.pin || '') : ((currentAuth && currentAuth.pin) || 'GUEST');
          const studentStt = student ? (student.stt || currentAuth.stt || '') : ((currentAuth && currentAuth.stt) || '');
          const subId = histItem.id;
          const subData = {
            id: subId,
            submitted_at: histItem.submitted_at,
            student_id: studentStt ? String(studentStt) : (studentPin || ''),
            student_stt: studentStt ? Number(studentStt) : '',
            student_pin: studentPin,
            student_name: studentName,
            class_name: studentClass,
            problem_id: prob.id,
            problem_name: prob.name,
            type: 'essay',
            submission_type_display: 'Code DeruckOJ',
            answer: `[${currentJudgeLang === 'cpp' ? 'C++20' : 'Python 3'}]\n${code}`,
            verdict: finalVerdict,
            lang: (currentJudgeLang === 'cpp' ? 'C++20' : 'Python 3'),
            status: (finalVerdict === 'AC' ? 'Chấm đạt' : 'Cần sửa'),
            score: String(Math.round((acCount / tests.length) * 10)),
            feedback: `Tự động chấm DeruckOJ: ${finalVerdict} (${acCount}/${tests.length} testcase).`
          };
          appData.submissions.unshift(subData);
          saveAppDataLocally();
          try {
            localStorage.setItem('cp_cached_submissions', JSON.stringify(appData.submissions));
            localStorage.setItem('cp_raw_submissions_v2', JSON.stringify(appData.submissions));
          } catch(e) {}
          if (typeof renderGlobalSubmissions === 'function') renderGlobalSubmissions();

          // Nếu AC thì cập nhật danh sách bài đã giải của học sinh và lưu lên Firebase
          if (finalVerdict === 'AC' && student) {
            if (!student.solved) student.solved = [];
            if (!student.solved.includes(prob.id)) {
              student.solved.push(prob.id);
              saveAppDataLocally();
              if (typeof saveStudentSolvedToFirebase === 'function') {
                saveStudentSolvedToFirebase(student, prob.id).catch(() => {});
              }
            }
          }

          if (typeof reconcileStudentSolvedState === 'function') {
            reconcileStudentSolvedState();
          }
          if (typeof renderGlobalSubmissions === 'function') renderGlobalSubmissions();
          renderProblems();
          renderMatrix();

          await syncJudgeSubmissionRecord(subData);
        }
      } catch (subErr) {
        console.warn("Could not save judge submission:", subErr);
      }
      } catch (err) {
        if (progressContainer) progressContainer.classList.add('hidden');
        showJudgeServiceError(err);
        if (verdictTag) {
          verdictTag.className = "text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40";
          verdictTag.textContent = "CHƯA CHẤM XONG";
        }
      } finally {
        isJudging = false;
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = '<span>🚀</span> Nộp bài';
        }
        if (btnRun) btnRun.disabled = false;
      }
    }

    function showJudgeTestDetail(testNum, input, expected, actual, stderr, verdict, server = '', execTime = '') {
      const box = document.getElementById('judge-test-detail-box');
      if (!box) return;
      box.classList.remove('hidden');

      const isAC = (verdict === 'AC');
      let displayOutput = actual || '';
      if (!displayOutput && stderr) {
        let errHint = stderr;
        if (stderr.includes('EOFError')) {
          errHint += '\n\n💡 MẸO GỠ LỖI: Lỗi EOFError xảy ra do gọi int(input()) quá số dòng dữ liệu đề bài cung cấp.';
        } else if (stderr.includes('ValueError: invalid literal for int()')) {
          errHint += '\n\n💡 MẸO GỠ LỖI: Lỗi ValueError khi int(input()) thường do dữ liệu vào có nhiều số trên 1 dòng (ví dụ: "2 3"). Trong Python, hãy dùng: a, b = map(int, input().split())';
        }
        displayOutput = `[LỖI CHƯƠNG TRÌNH - STDERR]\n${errHint}`;
      } else if (!displayOutput) {
        displayOutput = '(Không có đầu ra)';
      }

      const serverInfo = server ? `<span class="text-xs font-mono font-normal text-slate-400 ml-2 hidden sm:inline">| Máy chấm: <strong class="text-indigo-300">${escapeHtml(server)}</strong> ${execTime ? '(' + execTime + 's)' : ''}</span>` : '';

      box.innerHTML = `
        <div class="flex items-center justify-between border-b border-slate-800 pb-2">
          <div class="flex items-center">
            <span class="font-bold text-slate-200">Chi tiết Test #${testNum} (${verdict})</span>
            ${serverInfo}
          </div>
          <button onclick="document.getElementById('judge-test-detail-box').classList.add('hidden')" class="text-slate-500 hover:text-white cursor-pointer">✕ Đóng</button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          <div>
            <div class="text-[11px] text-slate-400 font-bold mb-1">Dữ liệu vào (Input):</div>
            <pre class="bg-slate-900 border border-slate-800 p-2 rounded-lg text-slate-200 max-h-32 overflow-y-auto whitespace-pre-wrap">${escapeHtml(input)}</pre>
          </div>
          <div>
            <div class="text-[11px] text-emerald-400 font-bold mb-1">Đáp án đúng (Expected Output):</div>
            <pre class="bg-slate-900 border border-slate-800 p-2 rounded-lg text-emerald-300 max-h-32 overflow-y-auto whitespace-pre-wrap">${escapeHtml(expected)}</pre>
          </div>
          <div class="md:col-span-2">
            <div class="text-[11px] font-bold mb-1 ${isAC ? 'text-emerald-400' : 'text-rose-400'}">Kết quả chạy của bạn (Your Output):</div>
            <pre class="bg-slate-900 border ${isAC ? 'border-emerald-500/30' : 'border-rose-500/30'} p-2 rounded-lg ${isAC ? 'text-emerald-200' : 'text-rose-200'} max-h-40 overflow-y-auto whitespace-pre-wrap">${escapeHtml(displayOutput)}</pre>
          </div>
        </div>
      `;
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function handleStudentACRecorded(probId) {
      if (!currentAuth) return;
      if (currentAuth.role === 'student' && appData && appData.students) {
        const student = getActiveStudent();
        if (student) {
          if (!student.solved) student.solved = [];
          if (!student.solved.includes(probId)) {
            student.solved.push(probId);
          }
          const key = (student.name || '').trim().toLowerCase();
          try {
            localStorage.setItem('deruck_solved_backup_' + key, JSON.stringify(student.solved));
            localStorage.setItem('cp_cached_students', JSON.stringify(appData.students));
          } catch(e) {}
          saveAppDataLocally();
          if (typeof saveStudentSolvedToFirebase === 'function' && isFirebaseConfigured()) {
            saveStudentSolvedToFirebase(student.stt || student.name, probId).catch(() => {});
          }
          renderProblems();
          renderMatrix();
          if (typeof renderGlobalSubmissions === 'function') renderGlobalSubmissions();
          showLiveToast(`🎉 Chúc mừng ${student.name}! Bài ${probId} đã được ghi nhận hoàn thành.`);
          
          const statusBadge = document.getElementById('judge-prob-status-badge');
          if (statusBadge) {
            statusBadge.className = "px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
            statusBadge.textContent = "✅ Đã Hoàn Thành (AC)";
          }
        }
      }
    }

    /**
     * Persistent judge history subsystem.
     *
     * Invariants:
     * - save locally before starting any remote request;
     * - reuse one submission ID across history, app cache and remote stores;
     * - deduplicate rendered local/remote records by ID;
     * - retain compatibility with the legacy localStorage key;
     * - expose `local`, `pending` and `synced` delivery states.
     *
     * See `documentation/judge-maintenance-2026-10-14.md` before changing the
     * schema or synchronization order.
     */
    const JUDGE_HISTORY_KEY = 'deruck_judge_history_v2';
    const LEGACY_JUDGE_HISTORY_KEY = 'deruck_judge_history';
    const JUDGE_HISTORY_LIMIT = 30;
    const JUDGE_HISTORY_MAX_CHARS = 1800000;

    function createJudgeSubmissionId() {
      const suffix = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
      return `SUB-${Date.now()}-${suffix}`;
    }

    /** Read, normalize and migrate the browser's judge submission history. */
    function readJudgeSubmissionHistory() {
      for (const key of [JUDGE_HISTORY_KEY, LEGACY_JUDGE_HISTORY_KEY]) {
        try {
          const parsed = JSON.parse(localStorage.getItem(key) || '[]');
          if (!Array.isArray(parsed)) continue;
          const list = parsed.filter(item => item && typeof item === 'object').map((item, index) => ({
            ...item,
            id: item.id || `LOCAL-${item.timestamp || Date.now()}-${index}`,
            timestamp: Number(item.timestamp) || Date.parse(item.submitted_at || '') || Date.now() - index,
            submitted_at: item.submitted_at || item.time || '--',
            sync_status: item.sync_status || 'local'
          }));
          if (key === LEGACY_JUDGE_HISTORY_KEY && list.length) {
            writeJudgeSubmissionHistory(list);
            localStorage.removeItem(LEGACY_JUDGE_HISTORY_KEY);
          }
          return list;
        } catch (error) {
          console.warn('Không đọc được lịch sử máy chấm:', error);
        }
      }
      return [];
    }

    /** Persist bounded history, trimming old records before localStorage fills. */
    function writeJudgeSubmissionHistory(items) {
      let list = items.slice(0, JUDGE_HISTORY_LIMIT);
      while (list.length > 1 && JSON.stringify(list).length > JUDGE_HISTORY_MAX_CHARS) list.pop();
      try {
        localStorage.setItem(JUDGE_HISTORY_KEY, JSON.stringify(list));
        return true;
      } catch (error) {
        console.warn('Không lưu được lịch sử máy chấm:', error);
        return false;
      }
    }

    function saveJudgeSubmissionHistory(item) {
      const savedItem = {
        ...item,
        id: item.id || createJudgeSubmissionId(),
        timestamp: Number(item.timestamp) || Date.now(),
        submitted_at: item.submitted_at || new Date().toLocaleString('vi-VN', { hour12: false }),
        sync_status: item.sync_status || 'local'
      };
      const list = readJudgeSubmissionHistory().filter(entry => entry.id !== savedItem.id);
      list.unshift(savedItem);
      if (!writeJudgeSubmissionHistory(list)) {
        showLiveToast('Không thể lưu lịch sử trên trình duyệt. Hãy giải phóng dung lượng trang web.', 'warning');
        return null;
      }
      renderJudgeSubmissionHistory();
      return savedItem;
    }

    function updateJudgeSubmissionHistoryStatus(id, syncStatus) {
      const list = readJudgeSubmissionHistory();
      const item = list.find(entry => entry.id === id);
      if (item) {
        item.sync_status = syncStatus;
        writeJudgeSubmissionHistory(list);
      }
      renderJudgeSubmissionHistory();
    }

    /**
     * Await all configured persistence paths and update the shared sync state.
     * The record is already present locally when this function is called.
     * @returns {Promise<'synced'|'pending'>}
     */
    async function syncJudgeSubmissionRecord(subData) {
      let firebaseSaved = false;
      if (typeof saveSubmissionToFirebase === 'function' && isFirebaseConfigured()) {
        try { firebaseSaved = await saveSubmissionToFirebase(subData); } catch (error) {}
      }
      const sheetSaved = await syncToGoogleSheets(
        { action: 'submit_answer', submission: subData },
        { silent: true }
      );
      const syncStatus = firebaseSaved || sheetSaved ? 'synced' : 'pending';
      subData.sync_status = syncStatus;
      updateJudgeSubmissionHistoryStatus(subData.id, syncStatus);
      if (typeof archiveSubmissionsLocally === 'function') {
        await archiveSubmissionsLocally([subData], { silent: true });
      }
      saveAppDataLocally();
      try {
        localStorage.setItem('cp_cached_submissions', JSON.stringify(appData.submissions || []));
        localStorage.setItem('cp_raw_submissions_v2', JSON.stringify(appData.submissions || []));
      } catch (error) {}
      return syncStatus;
    }

    /** Render the current problem's merged local/platform history without duplicates. */
    function renderJudgeSubmissionHistory() {
      const tbody = document.getElementById('judge-history-body');
      if (!tbody) return;

      try {
        const localList = readJudgeSubmissionHistory()
          .filter(sub => sub.probId === currentJudgeProbId || sub.problem_id === currentJudgeProbId);
        
        const platformSubs = (appData && Array.isArray(appData.submissions)) 
          ? appData.submissions.filter(s => s && s.problem_id === currentJudgeProbId) 
          : [];

        const isAdmin = Boolean(currentAuth && (currentAuth.role === 'admin' || currentAuth.role === 'teacher'));

        const platformIds = new Set(platformSubs.map(sub => sub.id).filter(Boolean));
        const visibleLocalList = localList.filter(sub => !platformIds.has(sub.id));

        if (platformSubs.length === 0 && visibleLocalList.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-slate-500 italic">Chưa có bài nộp nào cho bài này.</td></tr>';
          return;
        }

        tbody.innerHTML = '';

        if (platformSubs.length > 0) {
          platformSubs.slice(0, 15).forEach((sub, idx) => {
            const tr = document.createElement('tr');
            const isAC = (sub.status === 'Chấm đạt' || sub.status === 'Hoàn thành' || (sub.feedback && sub.feedback.includes('AC')) || sub.verdict === 'AC');
            const isWA = (sub.verdict === 'WA' || (sub.feedback && sub.feedback.includes('WA')) || (sub.status === 'Cần sửa' && (!sub.feedback || !sub.feedback.includes('TLE'))));
            const isTLE = (sub.verdict === 'TLE' || (sub.feedback && sub.feedback.includes('TLE')));
            const isCE = (sub.verdict === 'CE' || (sub.feedback && sub.feedback.includes('CE')));

            let vBadge = '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-300">Đã nộp</span>';
            if (isAC) vBadge = '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">✓ AC</span>';
            else if (isCE) vBadge = '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">⚠️ CE</span>';
            else if (isTLE) vBadge = '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">⏱️ TLE</span>';
            else if (isWA) vBadge = '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">✗ WA</span>';

            const isPy = (sub.answer && sub.answer.includes('[Python')) || (sub.lang && sub.lang.toLowerCase().includes('python'));
            const lBadge = isPy
              ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">🐍 Python 3</span>`
              : `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">🟦 C++20</span>`;

            const isAuthor = Boolean(currentAuth && (
              (currentAuth.name && sub.student_name && currentAuth.name.toLowerCase() === sub.student_name.toLowerCase()) ||
              (currentAuth.pin && sub.student_pin && currentAuth.pin === sub.student_pin) ||
              (currentAuth.stt && sub.student_stt && Number(currentAuth.stt) === Number(sub.student_stt))
            ));
            const canView = isAdmin || isAuthor;
            const isPendingSync = sub.sync_status === 'pending';
            const syncLabel = isPendingSync ? 'Chờ đồng bộ' : 'Đã lưu';
            const syncClass = isPendingSync ? 'text-amber-400' : 'text-emerald-500';

            const actionBtn = canView 
              ? `<button onclick="viewSubmissionCodeModal('${sub.id}')" class="text-indigo-400 hover:text-indigo-200 font-semibold cursor-pointer">👁️ Xem code</button>`
              : `<span class="text-[10px] text-slate-500 font-mono">🔒 Riêng tư</span>`;

            tr.innerHTML = `
              <td class="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                <div>${escapeHtml(sub.submitted_at || '--')}</div>
                <div class="mt-1 text-[9px] ${syncClass}">${syncLabel}</div>
              </td>
              <td class="py-2.5 px-3 font-bold text-white text-xs">${escapeHtml(sub.student_name || 'Học sinh')}</td>
              <td class="py-2.5 px-3">${lBadge}</td>
              <td class="py-2.5 px-3">${vBadge}</td>
              <td class="py-2.5 px-3 font-bold font-mono text-xs ${isAC ? 'text-emerald-400' : 'text-slate-300'}">${sub.score !== undefined ? sub.score : '--'}</td>
              <td class="py-2.5 px-3 text-right">${actionBtn}</td>
            `;
            tbody.appendChild(tr);
          });
        }

        visibleLocalList.forEach((sub) => {
            const tr = document.createElement('tr');
            const isAC = (sub.verdict === 'AC');
            const syncLabel = sub.sync_status === 'pending' ? 'Chờ đồng bộ' : 'Lưu trên máy';
            const syncClass = sub.sync_status === 'pending' ? 'text-amber-400' : 'text-slate-500';
            let vBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold ${
              isAC ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            }">${sub.verdict}</span>`;

            const isPy = (sub.lang && sub.lang.toLowerCase().includes('python'));
            const lBadge = isPy
              ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">🐍 Python 3</span>`
              : `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">🟦 C++20</span>`;

            tr.innerHTML = `
              <td class="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                <div>${escapeHtml(sub.submitted_at || sub.time || '--')}</div>
                <div class="mt-1 text-[9px] ${syncClass}">${syncLabel}</div>
              </td>
              <td class="py-2.5 px-3 font-bold text-white text-xs">${escapeHtml(sub.student_name || sub.probId || sub.problem_id || 'Bản lưu cục bộ')}</td>
              <td class="py-2.5 px-3">${lBadge}</td>
              <td class="py-2.5 px-3">${vBadge}</td>
              <td class="py-2.5 px-3 font-bold font-mono text-xs ${isAC ? 'text-emerald-400' : 'text-slate-300'}">${sub.score}/100</td>
              <td class="py-2.5 px-3 text-right">
                <button data-history-id="${escapeHtml(sub.id)}" class="judge-restore-history text-indigo-400 hover:text-indigo-300 hover:underline font-semibold cursor-pointer">Lấy code</button>
              </td>
            `;
            tr.querySelector('.judge-restore-history').onclick = () => restoreJudgeCodeFromHistory(sub.id);
            tbody.appendChild(tr);
          });
      } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="py-3 text-center text-slate-500 italic">Lỗi hiển thị lịch sử nộp bài.</td></tr>';
      }
    }

    function restoreJudgeCodeFromHistory(idOrIndex) {
      try {
        const list = readJudgeSubmissionHistory();
        const item = typeof idOrIndex === 'number' ? list[idOrIndex] : list.find(entry => entry.id === idOrIndex);
        if (item && item.code) {
          const itemLang = (item.lang && item.lang.toLowerCase().includes('python')) ? 'python' : 'cpp';
          
          if (item.probId && item.probId !== currentJudgeProbId) {
            currentJudgeProbId = item.probId;
          }

          currentJudgeLang = itemLang;
          updateJudgeLangUI();
          renderJudgeWorkspace();

          const codeEditor = document.getElementById('judge-code-editor');
          if (codeEditor) {
            codeEditor.value = item.code;
            saveCurrentJudgeCodeToLocal();
            showLiveToast(`Đã khôi phục code ${item.lang} của bài ${item.probId}!`);
          }
        }
      } catch (e) {}
    }

    function clearJudgeHistory() {
      if (confirm("Xóa các bản lưu lịch sử trên trình duyệt này? Bài đã đồng bộ lên hệ thống vẫn được giữ.")) {
        localStorage.removeItem(JUDGE_HISTORY_KEY);
        localStorage.removeItem(LEGACY_JUDGE_HISTORY_KEY);
        renderJudgeSubmissionHistory();
      }
    }

    // ============================================================
    // 6. TEACHER TESTCASE & PROBLEM MANAGER MODAL LOGIC
    // ============================================================
    function openTestcaseManagerModal() {
      const modal = document.getElementById('modal-testcase-manager');
      if (!modal) return;
      modal.classList.remove('hidden');

      // Populate problem dropdowns
      populateTestcaseProblemDropdowns();
      
      // Load current problem into manager
      loadProblemIntoTestcaseManager(currentJudgeProbId);
      switchTestcaseTab('manage');
    }

    function closeTestcaseManagerModal() {
      const modal = document.getElementById('modal-testcase-manager');
      if (modal) modal.classList.add('hidden');
    }

    function openEditTestcasesForCurrentProblem() {
      openTestcaseManagerModal();
      loadProblemIntoTestcaseManager(currentJudgeProbId);
    }

    function switchTestcaseTab(tabName) {
      const tabs = ['manage', 'create', 'auto', 'batch', 'export'];
      tabs.forEach(t => {
        const btn = document.getElementById(`tc-tab-btn-${t}`);
        const content = document.getElementById(`tc-tab-content-${t}`);
        if (t === tabName) {
          if (btn) btn.className = "px-3 py-1.5 rounded-lg font-bold bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 transition cursor-pointer whitespace-nowrap";
          if (content) content.classList.remove('hidden');
        } else {
          if (btn) btn.className = "px-3 py-1.5 rounded-lg font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer whitespace-nowrap";
          if (content) content.classList.add('hidden');
        }
      });

      if (tabName === 'auto') {
        initAutoTestcaseUI();
      }
    }

    function populateTestcaseProblemDropdowns() {
      const selectManage = document.getElementById('tc-manage-prob-select');
      const selectBatch = document.getElementById('tc-batch-prob-select');
      const selectAuto = document.getElementById('tc-auto-prob-select');
      const probs = getGraderProblems();

      const optionsHtml = probs.map(p => `<option value="${p.id}">${p.id} - ${p.name}</option>`).join('');

      if (selectManage) {
        selectManage.innerHTML = optionsHtml;
        selectManage.value = currentJudgeProbId;
      }
      if (selectBatch) {
        selectBatch.innerHTML = optionsHtml;
        selectBatch.value = currentJudgeProbId;
      }
      if (selectAuto) {
        selectAuto.innerHTML = optionsHtml;
        selectAuto.value = currentJudgeProbId;
      }
    }

    function loadProblemIntoTestcaseManager(probId) {
      currentTestcaseEditingProbId = probId;
      const selectManage = document.getElementById('tc-manage-prob-select');
      if (selectManage) selectManage.value = probId;

      const prob = getGraderProblems().find(p => p.id === probId);
      if (!prob) return;

      const infoId = document.getElementById('tc-info-id');
      const infoCount = document.getElementById('tc-info-count');
      if (infoId) infoId.textContent = prob.id;
      
      const tests = prob.testcases || [];
      if (infoCount) infoCount.textContent = tests.length;

      const container = document.getElementById('tc-tests-list-container');
      if (!container) return;
      container.innerHTML = '';

      if (tests.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-slate-500 bg-slate-950 rounded-xl border border-slate-800">Chưa có testcase nào. Bấm "Thêm Test Mới" để thêm test đầu tiên.</div>';
        return;
      }

      tests.forEach((tc, idx) => {
        appendTestcaseRowToDOM(tc.input, tc.output, tc.sample, idx + 1);
      });
    }

    function appendTestcaseRowToDOM(input = '', output = '', isSample = false, indexNum = null) {
      const container = document.getElementById('tc-tests-list-container');
      if (!container) return;

      const rowCount = container.querySelectorAll('.tc-test-row').length + 1;
      const num = indexNum || rowCount;

      const card = document.createElement('div');
      card.className = "tc-test-row bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3";
      card.innerHTML = `
        <div class="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div class="flex items-center gap-3">
            <span class="font-mono text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded">Test #${num}</span>
            <label class="flex items-center gap-1.5 text-xs text-indigo-300 font-semibold cursor-pointer">
              <input type="checkbox" class="tc-row-sample rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0" ${isSample ? 'checked' : ''}>
              <span>Là Test Ví Dụ (Công khai)</span>
            </label>
          </div>
          <button type="button" onclick="this.closest('.tc-test-row').remove(); updateTestcaseRowNumbers();" class="text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer flex items-center gap-1">
            <span>🗑️</span> Xóa test
          </button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="space-y-1">
            <label class="text-[11px] font-semibold text-slate-400">Dữ liệu vào (Input):</label>
            <textarea class="tc-row-input w-full font-mono bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 resize-y" rows="3" placeholder="Nhập input...">${escapeHtml(input)}</textarea>
          </div>
          <div class="space-y-1">
            <label class="text-[11px] font-semibold text-slate-400">Dữ liệu ra chuẩn (Output):</label>
            <textarea class="tc-row-output w-full font-mono bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-emerald-300 focus:outline-none focus:border-indigo-500 resize-y" rows="3" placeholder="Nhập output chuẩn...">${escapeHtml(output)}</textarea>
          </div>
        </div>
      `;
      container.appendChild(card);
    }

    function addNewTestcaseRow() {
      const container = document.getElementById('tc-tests-list-container');
      if (container && container.querySelector('.text-center')) {
        container.innerHTML = '';
      }
      appendTestcaseRowToDOM('', '', false);
      updateTestcaseRowNumbers();
    }

    function updateTestcaseRowNumbers() {
      const container = document.getElementById('tc-tests-list-container');
      if (!container) return;
      const rows = container.querySelectorAll('.tc-test-row');
      rows.forEach((r, idx) => {
        const badge = r.querySelector('.font-mono.font-bold');
        if (badge) badge.textContent = `Test #${idx + 1}`;
      });
      const infoCount = document.getElementById('tc-info-count');
      if (infoCount) infoCount.textContent = rows.length;
    }

    function saveTestcasesFromManager() {
      const prob = getGraderProblems().find(p => p.id === currentTestcaseEditingProbId);
      if (!prob) {
        alert("Không tìm thấy bài tập cần lưu!");
        return;
      }

      const container = document.getElementById('tc-tests-list-container');
      if (!container) return;

      const rows = container.querySelectorAll('.tc-test-row');
      const newTestcases = [];

      rows.forEach(r => {
        const inp = r.querySelector('.tc-row-input')?.value || '';
        const out = r.querySelector('.tc-row-output')?.value || '';
        const isSample = !!r.querySelector('.tc-row-sample')?.checked;
        if (inp.trim() || out.trim()) {
          newTestcases.push({
            input: inp,
            output: out,
            sample: isSample
          });
        }
      });

      prob.testcases = newTestcases;

      // Update in appData.grader_problems
      if (!appData.grader_problems) appData.grader_problems = [];
      const gIdx = appData.grader_problems.findIndex(p => p.id === prob.id);
      if (gIdx >= 0) {
        appData.grader_problems[gIdx] = prob;
      } else {
        appData.grader_problems.push(prob);
      }

      // Update in appData.problems
      if (appData.problems) {
        const pIdx = appData.problems.findIndex(p => p.id === prob.id);
        if (pIdx >= 0) {
          appData.problems[pIdx] = Object.assign({}, appData.problems[pIdx], prob);
        }
      }

      saveAppDataLocally();
      renderJudgeWorkspace();
      renderProblems();
      showLiveToast(`Đã lưu thành công ${newTestcases.length} testcase cho bài ${prob.id}!`);
    }

    // -------------------------------------------------------------
    // GRADING OPTIONS LOGIC FOR NEW PROBLEM CREATION
    // -------------------------------------------------------------
    let newProbUploadedFileTests = [];
    let newProbPreGeneratedTests = [];

    function switchNewProbGradingMethod(method) {
      const lblTest = document.getElementById('lbl-newprob-mode-test');
      const lblCode = document.getElementById('lbl-newprob-mode-code');
      const panelTest = document.getElementById('panel-newprob-test');
      const panelCode = document.getElementById('panel-newprob-code');

      if (method === 'code') {
        if (lblCode) {
          lblCode.className = "p-3 rounded-xl border-2 border-indigo-500 bg-indigo-950/40 flex items-start gap-3 cursor-pointer transition";
        }
        if (lblTest) {
          lblTest.className = "p-3 rounded-xl border border-slate-800 bg-slate-900/60 flex items-start gap-3 cursor-pointer transition hover:border-indigo-500/50";
        }
        if (panelTest) panelTest.classList.add('hidden');
        if (panelCode) panelCode.classList.remove('hidden');

        // Pre-fill templates if empty
        const genCodeEl = document.getElementById('new-gprob-gen-code');
        const solCodeEl = document.getElementById('new-gprob-sol-code');
        if (genCodeEl && !genCodeEl.value.trim()) {
          genCodeEl.value = `# Code sinh dữ liệu input ngẫu nhiên\nimport random\na = random.randint(1, 1000)\nb = random.randint(1, 1000)\nprint(f"{a} {b}")\n`;
        }
        if (solCodeEl && !solCodeEl.value.trim()) {
          solCodeEl.value = `// Code Lời giải chuẩn của Thầy\n#include <iostream>\nusing namespace std;\nint main() {\n    ios_base::sync_with_stdio(false); cin.tie(NULL);\n    long long a, b;\n    if (cin >> a >> b) {\n        cout << a + b << "\\n";\n    }\n    return 0;\n}\n`;
        }
      } else {
        if (lblTest) {
          lblTest.className = "p-3 rounded-xl border-2 border-indigo-500 bg-indigo-950/40 flex items-start gap-3 cursor-pointer transition";
        }
        if (lblCode) {
          lblCode.className = "p-3 rounded-xl border border-slate-800 bg-slate-900/60 flex items-start gap-3 cursor-pointer transition hover:border-indigo-500/50";
        }
        if (panelTest) panelTest.classList.remove('hidden');
        if (panelCode) panelCode.classList.add('hidden');
      }
    }

    function switchNewProbTestSubmode(submode) {
      const btnManual = document.getElementById('btn-newprob-sub-manual');
      const btnFile = document.getElementById('btn-newprob-sub-file');
      const panelManual = document.getElementById('panel-newprob-test-manual');
      const panelFile = document.getElementById('panel-newprob-test-file');

      if (submode === 'file') {
        if (btnFile) btnFile.className = "flex-1 py-1.5 px-3 rounded-lg font-bold bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 transition cursor-pointer flex items-center justify-center gap-1.5";
        if (btnManual) btnManual.className = "flex-1 py-1.5 px-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer flex items-center justify-center gap-1.5";
        if (panelManual) panelManual.classList.add('hidden');
        if (panelFile) panelFile.classList.remove('hidden');
      } else {
        if (btnManual) btnManual.className = "flex-1 py-1.5 px-3 rounded-lg font-bold bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 transition cursor-pointer flex items-center justify-center gap-1.5";
        if (btnFile) btnFile.className = "flex-1 py-1.5 px-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer flex items-center justify-center gap-1.5";
        if (panelManual) panelManual.classList.remove('hidden');
        if (panelFile) panelFile.classList.add('hidden');
      }
    }

    function addNewProbManualTestRow(input = '', output = '', isSample = false) {
      const container = document.getElementById('newprob-manual-tests-container');
      if (!container) return;
      const count = container.querySelectorAll('.newprob-test-row').length + 1;
      const row = document.createElement('div');
      row.className = "newprob-test-row p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2 text-xs";
      row.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="font-bold text-indigo-400 font-mono test-num-label">#${count}</span>
            <label class="flex items-center gap-1.5 text-emerald-400 cursor-pointer">
              <input type="checkbox" class="tc-is-sample rounded bg-slate-950 border-slate-700 text-emerald-500" ${isSample ? 'checked' : ''}>
              <span class="text-[11px] font-semibold">Test ví dụ (Hiện trong đề)</span>
            </label>
          </div>
          <button type="button" onclick="removeNewProbTestRow(this)" class="text-rose-400 hover:text-rose-300 text-[11px] cursor-pointer">✕ Xóa</button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label class="text-[10px] text-slate-400 font-semibold">Input:</label>
            <textarea rows="2" class="tc-input w-full font-mono bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500" placeholder="Nhập input...">${escapeHtml(input)}</textarea>
          </div>
          <div>
            <label class="text-[10px] text-slate-400 font-semibold">Output chuẩn:</label>
            <textarea rows="2" class="tc-output w-full font-mono bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500" placeholder="Nhập output...">${escapeHtml(output)}</textarea>
          </div>
        </div>
      `;
      container.appendChild(row);
      updateNewProbManualTestNumbers();
    }

    function removeNewProbTestRow(btn) {
      const container = document.getElementById('newprob-manual-tests-container');
      const rows = container?.querySelectorAll('.newprob-test-row');
      if (rows && rows.length <= 1) {
        alert("Cần giữ lại ít nhất 1 testcase!");
        return;
      }
      btn.closest('.newprob-test-row')?.remove();
      updateNewProbManualTestNumbers();
    }

    function updateNewProbManualTestNumbers() {
      const container = document.getElementById('newprob-manual-tests-container');
      const countEl = document.getElementById('lbl-newprob-manual-count');
      if (!container) return;
      const rows = container.querySelectorAll('.newprob-test-row');
      rows.forEach((r, idx) => {
        const lbl = r.querySelector('.test-num-label');
        if (lbl) lbl.textContent = `#${idx + 1}`;
      });
      if (countEl) countEl.textContent = `Danh sách bộ test (Đang có ${rows.length} test):`;
    }

    function fillNewProbBatchSample() {
      const ta = document.getElementById('newprob-batch-paste');
      if (ta) {
        ta.value = `=== TEST ===\nINPUT:\n10 20\nOUTPUT:\n30\n\n=== TEST ===\nINPUT:\n-5 15\nOUTPUT:\n10\n\n=== TEST ===\nINPUT:\n100 200\nOUTPUT:\n300\n`;
      }
    }

    // PROCESS UPLOADED TEST FILES (.zip, .txt, .json, multiple files)
    async function handleNewProbTestFiles(event) {
      const files = event.target.files;
      if (!files || files.length === 0) return;
      const statusEl = document.getElementById('newprob-file-status');
      if (statusEl) {
        statusEl.classList.remove('hidden');
        statusEl.innerHTML = '<span class="text-indigo-400">⏳ Đang giải nén & phân tích tệp test...</span>';
      }

      let parsed = [];

      try {
        // Case 1: ZIP FILE
        if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
          if (typeof JSZip === 'undefined') {
            throw new Error("Đang tải thư viện JSZip, vui lòng thử lại sau 2 giây.");
          }
          const zip = await JSZip.loadAsync(files[0]);
          const fileEntries = Object.keys(zip.files).filter(fn => !zip.files[fn].dir);
          
          const fileTexts = {};
          for (const fn of fileEntries) {
            fileTexts[fn] = await zip.files[fn].async('text');
          }

          parsed = pairTestFilesFromMap(fileTexts);
          if (parsed.length === 0) {
            throw new Error(`Không tìm thấy cặp file test (.in/.out, .inp/.out) nào trong tệp zip.`);
          }
        }
        // Case 2: JSON FILE
        else if (files.length === 1 && files[0].name.toLowerCase().endsWith('.json')) {
          const text = await files[0].text();
          const data = JSON.parse(text);
          const list = Array.isArray(data) ? data : (data.testcases || data.tests || []);
          list.forEach((t, i) => {
            if (t.input !== undefined && t.output !== undefined) {
              parsed.push({
                input: String(t.input),
                output: String(t.output),
                sample: Boolean(t.sample || i === 0)
              });
            }
          });
        }
        // Case 3: SINGLE TEXT FILE
        else if (files.length === 1 && files[0].name.toLowerCase().endsWith('.txt')) {
          const text = await files[0].text();
          parsed = parseBatchTestText(text);
        }
        // Case 4: MULTIPLE FILES (.in, .out, .inp, etc.)
        else {
          const fileTexts = {};
          for (let i = 0; i < files.length; i++) {
            fileTexts[files[i].name] = await files[i].text();
          }
          parsed = pairTestFilesFromMap(fileTexts);
        }

        if (parsed.length > 0) {
          const container = document.getElementById('newprob-manual-tests-container');
          if (container) container.innerHTML = '';
          parsed.forEach((tc, idx) => {
            addNewProbManualTestRow(tc.input, tc.output, tc.sample || idx === 0);
          });
          newProbUploadedFileTests = parsed;

          if (statusEl) {
            statusEl.innerHTML = `✅ Đã giải nén & nạp thành công ${parsed.length} testcases! (Đã đưa vào bảng sửa)`;
          }
          showLiveToast(`🎉 Đã nạp thành công ${parsed.length} testcase từ tệp!`);
          switchNewProbTestSubmode('manual');
        } else {
          throw new Error("Không tìm thấy dữ liệu testcase hợp lệ trong các tệp đã chọn.");
        }
      } catch (err) {
        if (statusEl) {
          statusEl.innerHTML = `<span class="text-rose-400">❌ ${err.message}</span>`;
        }
        alert("Lỗi đọc tệp test:\n" + err.message);
      }
      event.target.value = '';
    }

    function pairTestFilesFromMap(fileMap) {
      const names = Object.keys(fileMap);
      const inputs = {};
      const outputs = {};

      const cleanKey = (name) => {
        const base = name.split('/').pop().split('\\').pop();
        const parts = base.split('.');
        const ext = parts.pop().toLowerCase();
        const stem = parts.join('.');
        return { base, stem, ext };
      };

      for (const name of names) {
        const { stem, ext } = cleanKey(name);
        const lowerName = name.toLowerCase();

        if (ext === 'in' || ext === 'inp' || lowerName.includes('input') || lowerName.endsWith('.in') || lowerName.endsWith('.inp')) {
          const key = stem.replace(/input/i, '').replace(/in$/i, '').replace(/inp$/i, '').trim() || name.replace(/\.[^.]+$/, '');
          inputs[key] = fileMap[name];
        } else if (ext === 'out' || ext === 'ans' || ext === 'sol' || lowerName.includes('output') || lowerName.endsWith('.out') || lowerName.endsWith('.ans')) {
          const key = stem.replace(/output/i, '').replace(/ans$/i, '').replace(/out$/i, '').replace(/sol$/i, '').trim() || name.replace(/\.[^.]+$/, '');
          outputs[key] = fileMap[name];
        }
      }

      const pairs = [];
      const allKeys = Array.from(new Set([...Object.keys(inputs), ...Object.keys(outputs)]));
      allKeys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

      for (const k of allKeys) {
        if (inputs[k] !== undefined && outputs[k] !== undefined) {
          pairs.push({
            input: inputs[k],
            output: outputs[k],
            sample: false
          });
        }
      }

      if (pairs.length === 0) {
        const inVals = Object.values(inputs);
        const outVals = Object.values(outputs);
        const minLen = Math.min(inVals.length, outVals.length);
        for (let i = 0; i < minLen; i++) {
          pairs.push({
            input: inVals[i],
            output: outVals[i],
            sample: (i === 0)
          });
        }
      }

      if (pairs.length > 0) pairs[0].sample = true;
      return pairs;
    }

    function parseBatchTestText(text) {
      const tests = [];
      const blocks = text.split(/===+\s*TEST\s*===+/i);
      for (const block of blocks) {
        if (!block.trim()) continue;
        let inPart = '', outPart = '';
        if (/INPUT:/i.test(block) && /OUTPUT:/i.test(block)) {
          const parts = block.split(/OUTPUT:/i);
          inPart = parts[0].replace(/INPUT:/i, '').trim();
          outPart = parts[1] ? parts[1].trim() : '';
        } else {
          const lines = block.trim().split('\n');
          inPart = lines[0] || '';
          outPart = lines.slice(1).join('\n') || '';
        }
        if (inPart || outPart) {
          tests.push({
            input: inPart.trimEnd() + '\n',
            output: outPart.trimEnd() + '\n',
            sample: tests.length === 0
          });
        }
      }
      return tests;
    }

    async function preGenerateTestsFromNewProbCode() {
      const btn = document.getElementById('btn-pre-gen-tests');
      const statusEl = document.getElementById('new-gprob-pre-gen-status');
      const genCode = document.getElementById('new-gprob-gen-code')?.value || '';
      const genLang = document.getElementById('new-gprob-gen-lang')?.value || 'python';
      const solCode = document.getElementById('new-gprob-sol-code')?.value || '';
      const solLang = document.getElementById('new-gprob-sol-lang')?.value || 'cpp';
      const count = parseInt(document.getElementById('new-gprob-code-test-count')?.value || '10', 10);

      if (!genCode.trim() || !solCode.trim()) {
        alert("Vui lòng nhập cả Code Sinh Test (Generator) và Code Lời Giải Chuẩn (Solution)!");
        return;
      }

      if (btn) btn.disabled = true;
      if (statusEl) {
        statusEl.classList.remove('hidden');
        statusEl.innerHTML = '<span class="text-indigo-400">⏳ Đang chạy Generator và Solution để sinh bộ test...</span>';
      }

      try {
        newProbPreGeneratedTests = [];
        for (let i = 0; i < count; i++) {
          const gRes = await executeCode(genLang, genCode, "");
          if (gRes.status === 'CE' || gRes.status === 'RTE') {
            throw new Error(`Generator lỗi: ${gRes.error || gRes.compile_error}`);
          }
          const tIn = (gRes.stdout || '').trimEnd() + '\n';

          const sRes = await executeCode(solLang, solCode, tIn);
          if (sRes.status === 'CE' || sRes.status === 'RTE') {
            throw new Error(`Solution lỗi: ${sRes.error || sRes.compile_error}`);
          }
          const tOut = (sRes.stdout || '').trimEnd() + '\n';

          newProbPreGeneratedTests.push({
            input: tIn,
            output: tOut,
            sample: (i === 0)
          });
        }

        const container = document.getElementById('newprob-manual-tests-container');
        if (container) container.innerHTML = '';
        newProbPreGeneratedTests.forEach((tc, idx) => {
          addNewProbManualTestRow(tc.input, tc.output, idx === 0);
        });

        if (statusEl) {
          statusEl.innerHTML = `✅ Đã sinh thành công ${newProbPreGeneratedTests.length} test hoàn chỉnh từ code mẫu!`;
        }
        showLiveToast(`🎉 Đã sinh trước ${newProbPreGeneratedTests.length} testcase!`);
      } catch (err) {
        if (statusEl) {
          statusEl.innerHTML = `<span class="text-rose-400">❌ ${err.message}</span>`;
        }
        alert("Lỗi sinh test từ code mẫu:\n" + err.message);
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    // CREATE NEW GRADER PROBLEM WITH OPTIONS
    function handleCreateNewGraderProblem(event) {
      event.preventDefault();
      const id = document.getElementById('new-gprob-id').value.trim();
      const name = document.getElementById('new-gprob-name').value.trim();
      const diff = document.getElementById('new-gprob-diff').value.trim() || 'Level 1 • Cơ bản';
      const cat = document.getElementById('new-gprob-cat').value.trim() || 'Căn bản';
      const timeLimit = parseFloat(document.getElementById('new-gprob-timelimit').value) || 1.0;
      const desc = document.getElementById('new-gprob-desc').value.trim();
      const inputFormat = document.getElementById('new-gprob-input').value.trim();
      const outputFormat = document.getElementById('new-gprob-output').value.trim();

      if (!id || !name || !desc) {
        alert("Vui lòng điền đầy đủ Mã bài, Tên bài và Đề bài!");
        return;
      }

      // Check existing ID
      const existing = getGraderProblems().find(p => p.id.toUpperCase() === id.toUpperCase());
      if (existing) {
        alert(`Mã bài "${id}" đã tồn tại! Vui lòng chọn mã khác.`);
        return;
      }

      // Classes
      const classes = [];
      if (document.getElementById('new-gprob-class-public')?.checked) classes.push('Public');
      if (document.getElementById('new-gprob-class-cppnc')?.checked) classes.push('C++ nâng cao');
      if (document.getElementById('new-gprob-class-cppcb')?.checked) classes.push('C++ cơ bản');
      if (document.getElementById('new-gprob-class-pycb')?.checked) classes.push('Python cơ bản');
      if (document.getElementById('new-gprob-class-py11')?.checked) classes.push('Python 1-1');
      if (classes.length === 0) classes.push('Public');

      // Grading Method
      const gradingMethod = document.querySelector('input[name="new-gprob-grading-method"]:checked')?.value || 'test';

      let finalTests = [];
      let genCode = '', genLang = 'python', solCode = '', solLang = 'cpp', codeTestCount = 10;

      if (gradingMethod === 'test') {
        const rows = document.querySelectorAll('#newprob-manual-tests-container .newprob-test-row');
        rows.forEach(r => {
          const inp = r.querySelector('.tc-input')?.value || '';
          const out = r.querySelector('.tc-output')?.value || '';
          const smp = r.querySelector('.tc-is-sample')?.checked || false;
          if (inp.trim() || out.trim()) {
            finalTests.push({
              input: inp.trimEnd() + '\n',
              output: out.trimEnd() + '\n',
              sample: Boolean(smp)
            });
          }
        });

        const batchText = document.getElementById('newprob-batch-paste')?.value || '';
        if (batchText.trim()) {
          const batchTests = parseBatchTestText(batchText);
          finalTests.push(...batchTests);
        }

        if (finalTests.length === 0) {
          alert("Vui lòng nhập ít nhất 1 testcase (bằng tay hoặc qua file)!");
          return;
        }
      } else {
        // Code-based grading
        genCode = document.getElementById('new-gprob-gen-code')?.value.trim() || '';
        genLang = document.getElementById('new-gprob-gen-lang')?.value || 'python';
        solCode = document.getElementById('new-gprob-sol-code')?.value.trim() || '';
        solLang = document.getElementById('new-gprob-sol-lang')?.value || 'cpp';
        codeTestCount = parseInt(document.getElementById('new-gprob-code-test-count')?.value || '10', 10);

        if (!genCode || !solCode) {
          alert("Vui lòng nhập cả Code Sinh Test (Generator) và Code Lời Giải Chuẩn (Solution)!");
          return;
        }

        finalTests = newProbPreGeneratedTests || [];
      }

      const newProb = {
        id,
        name,
        platform: 'DeruckOJ',
        url: `#judge-${id}`,
        difficulty: diff,
        category: cat,
        classes,
        time_limit: timeLimit,
        memory_limit: 256,
        description: desc,
        input_format: inputFormat || 'Dữ liệu đầu vào chuẩn.',
        output_format: outputFormat || 'In kết quả ra màn hình chuẩn.',
        grading_method: gradingMethod,
        testcases: finalTests,
        generator_code: genCode,
        generator_lang: genLang,
        solution_code: solCode,
        solution_lang: solLang,
        code_test_count: codeTestCount
      };

      if (!appData.grader_problems) appData.grader_problems = [];
      appData.grader_problems.push(newProb);

      if (!appData.problems) appData.problems = [];
      appData.problems.push(newProb);

      saveAppDataLocally();
      populateTestcaseProblemDropdowns();
      currentJudgeProbId = id;
      renderJudgeWorkspace();
      renderProblems();

      // Reset form
      document.getElementById('new-gprob-id').value = '';
      document.getElementById('new-gprob-name').value = '';
      document.getElementById('new-gprob-desc').value = '';
      newProbUploadedFileTests = [];
      newProbPreGeneratedTests = [];

      closeTestcaseManagerModal();
      toggleProblemViewMode('judge');
      showLiveToast(`🎉 Đã tạo bài tập mới ${id} (${gradingMethod === 'code' ? 'Chấm bằng code' : `${finalTests.length} testcase`}) thành công!`);
    }

    // BATCH IMPORT TESTCASES
    function insertBatchTestSampleTemplate() {
      const ta = document.getElementById('tc-batch-text');
      if (ta) {
        ta.value = `=== TEST ===
INPUT:
10 20
OUTPUT:
30

=== TEST ===
INPUT:
-5 15
OUTPUT:
10

=== TEST ===
INPUT:
1000000000 2000000000
OUTPUT:
3000000000`;
      }
    }

    function handleBatchImportTests() {
      const selectBatch = document.getElementById('tc-batch-prob-select');
      const probId = selectBatch ? selectBatch.value : currentJudgeProbId;
      const prob = getGraderProblems().find(p => p.id === probId);
      if (!prob) {
        alert("Vui lòng chọn bài tập để nạp test!");
        return;
      }

      const batchText = document.getElementById('tc-batch-text')?.value || '';
      if (!batchText.trim()) {
        alert("Vui lòng dán nội dung bộ test!");
        return;
      }

      const appendMode = !!document.getElementById('tc-batch-append')?.checked;

      // Split by test separators: === TEST === or --- TEST --- or [TEST]
      const rawBlocks = batchText.split(/(?:={3,}|-{3,}|\*{3,})\s*(?:TEST\s*\d*|BỘ TEST\s*\d*)?\s*(?:={3,}|-{3,}|\*{3,})/i)
        .map(b => b.trim())
        .filter(b => b.length > 0);

      const parsedTests = [];

      rawBlocks.forEach(block => {
        let inputPart = '';
        let outputPart = '';

        if (/INPUT:/i.test(block) && /OUTPUT:/i.test(block)) {
          const parts = block.split(/OUTPUT:/i);
          const inHalf = parts[0].replace(/INPUT:/i, '').trim();
          const outHalf = (parts[1] || '').trim();
          inputPart = inHalf;
          outputPart = outHalf;
        } else {
          // If no labels, check for empty line delimiter
          const lines = block.split('\n');
          const mid = Math.floor(lines.length / 2);
          inputPart = lines.slice(0, mid).join('\n').trim();
          outputPart = lines.slice(mid).join('\n').trim();
        }

        if (inputPart || outputPart) {
          parsedTests.push({
            input: inputPart,
            output: outputPart,
            sample: false
          });
        }
      });

      if (parsedTests.length === 0) {
        alert("Không thể phân tích cú pháp bộ test. Vui lòng kiểm tra định dạng nhãn INPUT: và OUTPUT:!");
        return;
      }

      if (!prob.testcases || !appendMode) {
        prob.testcases = parsedTests;
      } else {
        prob.testcases.push(...parsedTests);
      }

      // Update in appData
      if (!appData.grader_problems) appData.grader_problems = [];
      const gIdx = appData.grader_problems.findIndex(p => p.id === prob.id);
      if (gIdx >= 0) appData.grader_problems[gIdx] = prob;
      else appData.grader_problems.push(prob);

      if (appData.problems) {
        const pIdx = appData.problems.findIndex(p => p.id === prob.id);
        if (pIdx >= 0) appData.problems[pIdx] = Object.assign({}, appData.problems[pIdx], prob);
      }

      saveAppDataLocally();
      renderJudgeWorkspace();
      switchTestcaseTab('manage');
      loadProblemIntoTestcaseManager(prob.id);
      showLiveToast(`✅ Đã nạp thành công ${parsedTests.length} testcase vào bài ${prob.id}!`);
    }

    // EXPORT & IMPORT JSON
    function downloadGraderProblemsJSON() {
      const graderProbs = getGraderProblems();
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(graderProbs, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "grader_problems.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showLiveToast("Đã tải xuống file grader_problems.json!");
    }

    function handleImportGraderProblemsJSON() {
      const fileInput = document.getElementById('tc-file-import-input');
      if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        alert("Vui lòng chọn file JSON để nạp!");
        return;
      }

      const file = fileInput.files[0];
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const imported = JSON.parse(e.target.result);
          if (!Array.isArray(imported)) {
            alert("File JSON không hợp lệ! Dữ liệu phải là một mảng các bài tập.");
            return;
          }

          appData.grader_problems = imported;
          
          // Merge into appData.problems
          imported.forEach(p => {
            const idx = appData.problems.findIndex(item => item.id === p.id);
            if (idx >= 0) {
              appData.problems[idx] = Object.assign({}, appData.problems[idx], p);
            } else {
              appData.problems.push(p);
            }
          });

          saveAppDataLocally();
          populateTestcaseProblemDropdowns();
          renderJudgeWorkspace();
          renderProblems();
          closeTestcaseManagerModal();
          showLiveToast(`Đã nạp thành công ${imported.length} bài tập từ file JSON!`);
        } catch (err) {
          alert("Lỗi khi đọc file JSON: " + err.message);
        }
      };
      reader.readAsText(file);
    }

    // ============================================================
    // 7. AUTO TEST GENERATOR & STRESS TESTING / CODE CHECKER
    // ============================================================
    const GENERATOR_PRESETS = {
      two_int: {
        python: `# Sinh 2 số nguyên A, B ngẫu nhiên trong khoảng [1, 1000]\nimport random\na = random.randint(1, 1000)\nb = random.randint(1, 1000)\nprint(f"{a} {b}")\n`,
        cpp: `#include <iostream>\n#include <random>\nusing namespace std;\n\nint main() {\n    random_device rd;\n    mt19937 gen(rd());\n    uniform_int_distribution<int> dis(1, 1000);\n    cout << dis(gen) << " " << dis(gen) << "\\n";\n    return 0;\n}\n`
      },
      array_n: {
        python: `# Sinh mảng N số nguyên\nimport random\nn = random.randint(5, 15)\narr = [random.randint(1, 100) for _ in range(n)]\nprint(n)\nprint(*arr)\n`,
        cpp: `#include <iostream>\n#include <vector>\n#include <random>\nusing namespace std;\n\nint main() {\n    random_device rd;\n    mt19937 gen(rd());\n    int n = uniform_int_distribution<int>(5, 15)(gen);\n    cout << n << "\\n";\n    for (int i = 0; i < n; ++i) {\n        cout << uniform_int_distribution<int>(1, 100)(gen) << (i == n - 1 ? "" : " ");\n    }\n    cout << "\\n";\n    return 0;\n}\n`
      },
      array_large: {
        python: `# Sinh mảng số lớn tới 10^9\nimport random\nn = random.randint(10, 20)\narr = [random.randint(1, 10**9) for _ in range(n)]\nprint(n)\nprint(*arr)\n`,
        cpp: `#include <iostream>\n#include <random>\nusing namespace std;\n\nint main() {\n    random_device rd;\n    mt19937_64 gen(rd());\n    int n = uniform_int_distribution<int>(10, 20)(gen);\n    cout << n << "\\n";\n    for (int i = 0; i < n; ++i) {\n        cout << uniform_int_distribution<long long>(1, 1000000000LL)(gen) << " ";\n    }\n    cout << "\\n";\n    return 0;\n}\n`
      },
      string: {
        python: `# Sinh xâu ký tự ngẫu nhiên độ dài N\nimport random, string\nn = random.randint(5, 15)\ns = ''.join(random.choices(string.ascii_lowercase, k=n))\nprint(s)\n`,
        cpp: `#include <iostream>\n#include <string>\n#include <random>\nusing namespace std;\n\nint main() {\n    random_device rd;\n    mt19937 gen(rd());\n    int n = uniform_int_distribution<int>(5, 15)(gen);\n    string s = "";\n    for (int i = 0; i < n; ++i) s += (char)('a' + uniform_int_distribution<int>(0, 25)(gen));\n    cout << s << "\\n";\n    return 0;\n}\n`
      },
      matrix: {
        python: `# Sinh ma trận kích thước N x M\nimport random\nn, m = random.randint(2, 4), random.randint(2, 4)\nprint(f"{n} {m}")\nfor _ in range(n):\n    print(*(random.randint(1, 50) for _ in range(m)))\n`,
        cpp: `#include <iostream>\n#include <random>\nusing namespace std;\n\nint main() {\n    random_device rd;\n    mt19937 gen(rd());\n    int n = uniform_int_distribution<int>(2, 4)(gen);\n    int m = uniform_int_distribution<int>(2, 4)(gen);\n    cout << n << " " << m << "\\n";\n    for (int i = 0; i < n; ++i) {\n        for (int j = 0; j < m; ++j) cout << uniform_int_distribution<int>(1, 50)(gen) << " ";\n        cout << "\\n";\n    }\n    return 0;\n}\n`
      }
    };

    let generatedTestsCache = [];
    let lastStressFailedTest = null;

    function initAutoTestcaseUI() {
      const genCodeEl = document.getElementById('tc-auto-gen-code');
      const solCodeEl = document.getElementById('tc-auto-sol-code');
      const stressGenCodeEl = document.getElementById('tc-stress-gen-code');

      if (genCodeEl && !genCodeEl.value.trim()) {
        applyGenPreset('two_int');
      }
      if (solCodeEl && !solCodeEl.value.trim()) {
        solCodeEl.value = `# Lời giải chuẩn của Thầy (AC Solution)\na, b = map(int, input().split())\nprint(a + b)\n`;
      }
      if (stressGenCodeEl && !stressGenCodeEl.value.trim()) {
        applyStressGenPreset('two_int');
      }
    }

    function switchAutoSubMode(mode) {
      const genBtn = document.getElementById('tc-auto-mode-gen-btn');
      const stressBtn = document.getElementById('tc-auto-mode-stress-btn');
      const genView = document.getElementById('tc-auto-submode-gen');
      const stressView = document.getElementById('tc-auto-submode-stress');

      if (mode === 'gen') {
        if (genBtn) genBtn.className = "flex-1 py-1.5 px-3 rounded-lg font-bold bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 transition cursor-pointer";
        if (stressBtn) stressBtn.className = "flex-1 py-1.5 px-3 rounded-lg font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer";
        if (genView) genView.classList.remove('hidden');
        if (stressView) stressView.classList.add('hidden');
      } else {
        if (genBtn) genBtn.className = "flex-1 py-1.5 px-3 rounded-lg font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer";
        if (stressBtn) stressBtn.className = "flex-1 py-1.5 px-3 rounded-lg font-bold bg-amber-600/30 text-amber-300 border border-amber-500/40 transition cursor-pointer";
        if (genView) genView.classList.add('hidden');
        if (stressView) stressView.classList.remove('hidden');
      }
    }

    function applyGenPreset(presetKey) {
      const langEl = document.getElementById('tc-auto-gen-lang');
      const lang = langEl ? langEl.value : 'python';
      const codeEl = document.getElementById('tc-auto-gen-code');
      if (codeEl && GENERATOR_PRESETS[presetKey]) {
        codeEl.value = GENERATOR_PRESETS[presetKey][lang] || GENERATOR_PRESETS[presetKey]['python'];
      }
    }

    function updateGenCodeTemplate() {
      const presetEl = document.getElementById('tc-auto-gen-preset');
      const presetKey = presetEl ? presetEl.value : 'two_int';
      applyGenPreset(presetKey);
    }

    function applyStressGenPreset(presetKey) {
      const codeEl = document.getElementById('tc-stress-gen-code');
      if (codeEl && GENERATOR_PRESETS[presetKey]) {
        codeEl.value = GENERATOR_PRESETS[presetKey]['python'];
      }
    }

    async function runAutoTestGenerator() {
      const btn = document.getElementById('tc-btn-run-auto-gen');
      const statusEl = document.getElementById('tc-auto-gen-status');
      const probSelect = document.getElementById('tc-auto-prob-select');
      const countEl = document.getElementById('tc-auto-gen-count');
      const sampleCheck = document.getElementById('tc-auto-gen-sample');
      const genCode = document.getElementById('tc-auto-gen-code')?.value || '';
      const genLang = document.getElementById('tc-auto-gen-lang')?.value || 'python';
      const solCode = document.getElementById('tc-auto-sol-code')?.value || '';
      const solLang = document.getElementById('tc-auto-sol-lang')?.value || 'python';

      if (!genCode.trim()) {
        alert("Vui lòng nhập mã sinh test (Generator)!");
        return;
      }
      if (!solCode.trim()) {
        alert("Vui lòng nhập mã lời giải chuẩn (AC Solution) của Thầy!");
        return;
      }

      const totalTests = parseInt(countEl?.value || '5', 10);
      const isSample = !!sampleCheck?.checked;

      btn.disabled = true;
      btn.innerHTML = `<span class="animate-spin">⏳</span> Đang sinh test...`;
      generatedTestsCache = [];

      try {
        for (let i = 0; i < totalTests; i++) {
          statusEl.textContent = `Đang chạy Generator sinh input test ${i + 1}/${totalTests}...`;
          
          // 1. Run Generator to get stdin
          const genRes = await executeCode(genLang, genCode, "");
          if (genRes.status === 'CE') {
            throw new Error(`Lỗi biên dịch Generator: ${genRes.compile_error || genRes.error}`);
          }
          if (genRes.status === 'RTE') {
            throw new Error(`Lỗi chạy Generator (Runtime Error): ${genRes.error || genRes.stderr}`);
          }
          const generatedInput = (genRes.stdout || '').trimEnd() + '\n';

          // 2. Run Solution on generatedInput to get expected stdout
          statusEl.textContent = `Đang chạy Solution tính output chuẩn cho test ${i + 1}/${totalTests}...`;
          const solRes = await executeCode(solLang, solCode, generatedInput);
          if (solRes.status === 'CE') {
            throw new Error(`Lỗi biên dịch Solution của Thầy: ${solRes.compile_error || solRes.error}`);
          }
          if (solRes.status === 'RTE') {
            throw new Error(`Lỗi chạy Solution (Runtime Error): ${solRes.error || solRes.stderr}`);
          }
          const expectedOutput = (solRes.stdout || '').trimEnd() + '\n';

          generatedTestsCache.push({
            input: generatedInput,
            output: expectedOutput,
            sample: (i === 0 && isSample)
          });
        }

        statusEl.innerHTML = `<span class="text-emerald-400 font-bold">✅ Đã sinh thành công ${generatedTestsCache.length} testcase hoàn chỉnh!</span>`;
        renderGeneratedTestsList();

      } catch (err) {
        statusEl.innerHTML = `<span class="text-rose-400 font-bold">❌ ${err.message}</span>`;
        alert("Quá trình sinh test gặp lỗi:\n" + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<span>🚀</span> Chạy Sinh Test Tự Động`;
      }
    }

    function renderGeneratedTestsList() {
      const card = document.getElementById('tc-auto-gen-results-card');
      const listEl = document.getElementById('tc-auto-gen-tests-list');
      const badgeEl = document.getElementById('tc-auto-gen-count-badge');
      if (!card || !listEl) return;

      if (generatedTestsCache.length === 0) {
        card.classList.add('hidden');
        return;
      }

      card.classList.remove('hidden');
      if (badgeEl) badgeEl.textContent = `${generatedTestsCache.length} test`;
      listEl.innerHTML = '';

      generatedTestsCache.forEach((tc, idx) => {
        const item = document.createElement('div');
        item.className = "p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2";
        item.innerHTML = `
          <div class="flex items-center justify-between text-xs text-slate-300 font-bold">
            <span class="flex items-center gap-1.5">
              <span class="text-indigo-400 font-mono">#${idx + 1}</span>
              ${tc.sample ? '<span class="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Ví dụ</span>' : ''}
            </span>
            <button type="button" onclick="removeGeneratedTest(${idx})" class="text-rose-400 hover:text-rose-300 text-[11px] cursor-pointer">Xóa test này</button>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div>
              <div class="text-[10px] text-slate-400 font-sans pb-1 font-semibold">Input:</div>
              <textarea onchange="updateGeneratedTestInput(${idx}, this.value)" rows="3" class="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500">${escapeHtml(tc.input)}</textarea>
            </div>
            <div>
              <div class="text-[10px] text-slate-400 font-sans pb-1 font-semibold">Output chuẩn:</div>
              <textarea onchange="updateGeneratedTestOutput(${idx}, this.value)" rows="3" class="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-xs text-emerald-300 focus:outline-none focus:border-emerald-500">${escapeHtml(tc.output)}</textarea>
            </div>
          </div>
        `;
        listEl.appendChild(item);
      });
    }

    function removeGeneratedTest(idx) {
      generatedTestsCache.splice(idx, 1);
      renderGeneratedTestsList();
    }

    function updateGeneratedTestInput(idx, val) {
      if (generatedTestsCache[idx]) generatedTestsCache[idx].input = val;
    }

    function updateGeneratedTestOutput(idx, val) {
      if (generatedTestsCache[idx]) generatedTestsCache[idx].output = val;
    }

    function applyGeneratedTests(action = 'append') {
      const probSelect = document.getElementById('tc-auto-prob-select');
      const targetProbId = probSelect?.value || currentJudgeProbId;
      const prob = getGraderProblems().find(p => p.id === targetProbId);

      if (!prob) {
        alert("Không tìm thấy bài tập đích!");
        return;
      }
      if (generatedTestsCache.length === 0) {
        alert("Chưa có testcase nào được sinh ra!");
        return;
      }

      if (!prob.testcases) prob.testcases = [];

      if (action === 'overwrite') {
        prob.testcases = [...generatedTestsCache];
      } else {
        prob.testcases = prob.testcases.concat(generatedTestsCache);
      }

      // Update in appData.grader_problems
      if (!appData.grader_problems) appData.grader_problems = [];
      const gIdx = appData.grader_problems.findIndex(p => p.id === prob.id);
      if (gIdx >= 0) appData.grader_problems[gIdx] = prob;
      else appData.grader_problems.push(prob);

      // Update in appData.problems
      if (appData.problems) {
        const pIdx = appData.problems.findIndex(p => p.id === prob.id);
        if (pIdx >= 0) appData.problems[pIdx] = Object.assign({}, appData.problems[pIdx], prob);
      }

      saveAppDataLocally();
      loadProblemIntoTestcaseManager(prob.id);
      renderJudgeWorkspace();
      renderProblems();

      showLiveToast(`Đã lưu thành công ${prob.testcases.length} testcase cho bài ${prob.id}!`);
      switchTestcaseTab('manage');
    }

    // STRESS TESTING / DUAL CODE CHECKER
    async function runStressTesting() {
      const btn = document.getElementById('tc-btn-run-stress');
      const statusEl = document.getElementById('tc-stress-status');
      const resultCard = document.getElementById('tc-stress-result-card');

      const studCode = document.getElementById('tc-stress-stud-code')?.value || '';
      const studLang = document.getElementById('tc-stress-stud-lang')?.value || 'python';
      const teachCode = document.getElementById('tc-stress-teach-code')?.value || '';
      const teachLang = document.getElementById('tc-stress-teach-lang')?.value || 'python';
      const genCode = document.getElementById('tc-stress-gen-code')?.value || '';
      const genCount = parseInt(document.getElementById('tc-stress-count')?.value || '5', 10);

      if (!studCode.trim()) {
        alert("Vui lòng nhập code của học sinh cần chấm!");
        return;
      }
      if (!teachCode.trim()) {
        alert("Vui lòng nhập code mẫu chuẩn của Thầy!");
        return;
      }
      if (!genCode.trim()) {
        alert("Vui lòng nhập code sinh test (Generator)!");
        return;
      }

      btn.disabled = true;
      btn.innerHTML = `<span class="animate-spin">⏳</span> Đang chấm đối chiếu...`;
      resultCard.classList.add('hidden');
      lastStressFailedTest = null;

      try {
        let passedCount = 0;

        for (let i = 0; i < genCount; i++) {
          statusEl.textContent = `Đang sinh và chấm đối chiếu test ${i + 1}/${genCount}...`;

          // 1. Generate Input
          const genRes = await executeCode('python', genCode, "");
          if (genRes.status === 'CE' || genRes.status === 'RTE') {
            throw new Error(`Generator gặp lỗi: ${genRes.error || genRes.compile_error}`);
          }
          const testIn = (genRes.stdout || '').trimEnd() + '\n';

          // 2. Run Teacher's Reference AC code
          const tRes = await executeCode(teachLang, teachCode, testIn);
          if (tRes.status === 'CE') {
            throw new Error(`Code của Thầy bị lỗi biên dịch: ${tRes.compile_error || tRes.error}`);
          }
          if (tRes.status === 'RTE') {
            throw new Error(`Code của Thầy bị lỗi chạy (RTE): ${tRes.error}`);
          }
          const tOut = normalizeOutput(tRes.stdout || '');

          // 3. Run Student's Candidate code
          const sRes = await executeCode(studLang, studCode, testIn);
          if (sRes.status === 'CE') {
            throw new Error(`Code học sinh bị lỗi biên dịch (CE): ${sRes.compile_error || sRes.error}`);
          }
          if (sRes.status === 'RTE') {
            lastStressFailedTest = {
              input: testIn,
              studentOut: `[Runtime Error]: ${sRes.error || sRes.stderr}`,
              expectedOut: tOut,
              verdict: 'RTE',
              testIndex: i + 1
            };
            displayStressResult(false, i, genCount);
            return;
          }

          const sOut = normalizeOutput(sRes.stdout || '');

          // 4. Compare outputs
          if (sOut !== tOut) {
            lastStressFailedTest = {
              input: testIn,
              studentOut: sOut,
              expectedOut: tOut,
              verdict: 'WA',
              testIndex: i + 1
            };
            displayStressResult(false, i, genCount);
            return;
          }

          passedCount++;
        }

        // All tests passed!
        displayStressResult(true, passedCount, genCount);

      } catch (err) {
        statusEl.innerHTML = `<span class="text-rose-400 font-bold">❌ ${err.message}</span>`;
        alert("Lỗi trong quá trình chấm stress test:\n" + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<span>⚖️</span> Bắt Đầu Chấm Điểm Bằng Code`;
      }
    }

    function displayStressResult(allPassed, passedCount, totalCount) {
      const card = document.getElementById('tc-stress-result-card');
      const statusEl = document.getElementById('tc-stress-status');
      if (!card) return;

      card.classList.remove('hidden');

      if (allPassed) {
        statusEl.innerHTML = `<span class="text-emerald-400 font-bold">✅ Đã hoàn tất chấm điểm: 100/100 Điểm!</span>`;
        card.innerHTML = `
          <div class="p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-xl space-y-2 text-xs">
            <div class="flex items-center justify-between">
              <span class="text-sm font-bold text-emerald-300 flex items-center gap-2">
                <span>🎉</span> CHẤM ĐIỂM: 100/100 ĐIỂM (CHÍNH XÁC TUYỆT ĐỐI)
              </span>
              <span class="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 font-bold font-mono">AC • ${totalCount}/${totalCount} tests</span>
            </div>
            <p class="text-slate-300 leading-relaxed">
              Code của học sinh đã vượt qua toàn bộ <strong>${totalCount} bộ test ngẫu nhiên</strong> do Generator sinh ra, cho kết quả hoàn toàn trùng khớp với Lời giải chuẩn của Thầy!
            </p>
          </div>
        `;
      } else {
        const failed = lastStressFailedTest;
        const score = Math.round((passedCount / totalCount) * 100);
        statusEl.innerHTML = `<span class="text-rose-400 font-bold">❌ Phát hiện sai lệch ở test #${failed.testIndex}</span>`;

        card.innerHTML = `
          <div class="p-4 bg-rose-950/60 border border-rose-500/40 rounded-xl space-y-3 text-xs">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <span class="text-sm font-bold text-rose-300 flex items-center gap-2">
                <span>❌</span> PHÁT HIỆN SAI LỆCH Ở TEST #${failed.testIndex}
              </span>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold font-mono">Điểm: ${score}/100</span>
                <button type="button" onclick="addStressFailedTestToProblem()" class="px-3 py-1 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition cursor-pointer flex items-center gap-1 shadow">
                  <span>➕</span> Bổ Sung Test Này Vào Bài Tập
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono">
              <div class="space-y-1">
                <div class="text-[11px] text-slate-400 font-sans font-semibold">📥 Input gây lỗi:</div>
                <pre class="p-2.5 bg-slate-950 rounded-lg text-slate-200 border border-slate-800 overflow-x-auto whitespace-pre-wrap">${escapeHtml(failed.input)}</pre>
              </div>
              <div class="space-y-1">
                <div class="text-[11px] text-rose-400 font-sans font-semibold">🔴 Kết quả của học sinh:</div>
                <pre class="p-2.5 bg-slate-950 rounded-lg text-rose-300 border border-rose-900/50 overflow-x-auto whitespace-pre-wrap">${escapeHtml(failed.studentOut)}</pre>
              </div>
              <div class="space-y-1">
                <div class="text-[11px] text-emerald-400 font-sans font-semibold">🟢 Đáp án chuẩn của Thầy:</div>
                <pre class="p-2.5 bg-slate-950 rounded-lg text-emerald-300 border border-emerald-900/50 overflow-x-auto whitespace-pre-wrap">${escapeHtml(failed.expectedOut)}</pre>
              </div>
            </div>
          </div>
        `;
      }
    }

    function addStressFailedTestToProblem() {
      if (!lastStressFailedTest) return;
      const probSelect = document.getElementById('tc-auto-prob-select');
      const targetProbId = probSelect?.value || currentJudgeProbId;
      const prob = getGraderProblems().find(p => p.id === targetProbId);

      if (!prob) {
        alert("Không tìm thấy bài tập!");
        return;
      }

      if (!prob.testcases) prob.testcases = [];
      prob.testcases.push({
        input: lastStressFailedTest.input,
        output: lastStressFailedTest.expectedOut + '\n',
        sample: false
      });

      // Update in appData.grader_problems
      if (!appData.grader_problems) appData.grader_problems = [];
      const gIdx = appData.grader_problems.findIndex(p => p.id === prob.id);
      if (gIdx >= 0) appData.grader_problems[gIdx] = prob;
      else appData.grader_problems.push(prob);

      // Update in appData.problems
      if (appData.problems) {
        const pIdx = appData.problems.findIndex(p => p.id === prob.id);
        if (pIdx >= 0) appData.problems[pIdx] = Object.assign({}, appData.problems[pIdx], prob);
      }

      saveAppDataLocally();
      loadProblemIntoTestcaseManager(prob.id);
      renderJudgeWorkspace();
      renderProblems();

      showLiveToast(`Đã bổ sung test lỗi vào bộ test của bài ${prob.id}! (Hiện có ${prob.testcases.length} test)`);
      switchTestcaseTab('manage');
    }

    function openStressTestFromJudge() {
      openTestcaseManagerModal();
      switchTestcaseTab('auto');
      switchAutoSubMode('stress');

      // Preload student code from current judge editor
      const editorCode = document.getElementById('judge-code-editor')?.value || '';
      const studCodeEl = document.getElementById('tc-stress-stud-code');
      const studLangEl = document.getElementById('tc-stress-stud-lang');

      if (studCodeEl && editorCode) {
        studCodeEl.value = editorCode;
      }
      if (studLangEl) {
        studLangEl.value = judgeSelectedLang || 'cpp';
      }
    }

    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // ============================================================
    // 12. BÀI TẬP NỘP & CHẤM ĐIỂM (ĐIỀN ĐÁP ÁN HOẶC TỰ LUẬN)
    // ============================================================
    let currentSubmitProbId = null;
    let currentSubmitMode = 'short'; // 'short' | 'essay'
    let currentGradeSubId = null;

    function openSubmitModal(probId) {
      if (!currentAuth) {
        showAuthModal();
        return;
      }
      currentSubmitProbId = probId;
      const prob = (appData.problems || []).find(p => p.id === probId) || (getGraderProblems()).find(p => p.id === probId);
      if (!prob) {
        alert("Không tìm thấy thông tin bài tập này!");
        return;
      }
      if (!canViewItem(prob)) {
        alert("Bài tập này không thuộc lớp của bạn!");
        return;
      }

      // Title & Prob Info
      const titleEl = document.getElementById('submit-modal-title');
      const subEl = document.getElementById('submit-modal-sub');
      const probIdEl = document.getElementById('submit-prob-id');
      const probNameEl = document.getElementById('submit-prob-name');
      const probMetaEl = document.getElementById('submit-prob-meta');
      const ojBtn = document.getElementById('submit-prob-view-oj-btn');

      if (titleEl) titleEl.textContent = `Nộp Bài Tập: ${prob.name}`;
      if (subEl) subEl.textContent = `Hình thức: Điền đáp án kết quả hoặc nộp lời giải tự luận / mã nguồn`;
      if (probIdEl) probIdEl.textContent = prob.id;
      if (probNameEl) probNameEl.textContent = prob.name;
      if (probMetaEl) probMetaEl.textContent = `Dạng bài: ${prob.category || 'Cơ bản'} • Độ khó: ${prob.difficulty || 'Mặc định'}`;
      if (ojBtn) {
        const hasOJ = prob.platform === 'DeruckOJ' || (prob.testcases && prob.testcases.length > 0) || (prob.url && prob.url.startsWith('#judge'));
        if (hasOJ) ojBtn.classList.remove('hidden');
        else ojBtn.classList.add('hidden');
      }

      // Setup Student Display & Teacher Select
      const isStudent = (currentAuth.role === 'student');
      const dispBox = document.getElementById('submit-student-display-box');
      const teachBox = document.getElementById('submit-teacher-select-box');
      const nameEl = document.getElementById('submit-student-name');
      const classEl = document.getElementById('submit-student-class');
      const roleBadge = document.getElementById('submit-student-role-badge');
      const studentSelect = document.getElementById('submit-student-select');

      if (isStudent) {
        if (dispBox) dispBox.classList.remove('hidden');
        if (teachBox) teachBox.classList.add('hidden');
        if (nameEl) nameEl.textContent = currentAuth.name;
        if (classEl) classEl.textContent = currentAuth.class || 'Lớp học';
        if (roleBadge) {
          roleBadge.textContent = 'Học sinh';
          roleBadge.className = "text-[10px] font-mono text-emerald-400";
        }
      } else {
        // Teacher / Admin
        if (dispBox) dispBox.classList.add('hidden');
        if (teachBox) teachBox.classList.remove('hidden');
        if (roleBadge) {
          roleBadge.textContent = (currentAuth.role === 'admin' ? 'Quản trị viên' : 'Giảng viên');
          roleBadge.className = "text-[10px] font-mono text-indigo-400";
        }
        if (studentSelect) {
          studentSelect.innerHTML = '';
          (appData.students || []).forEach(st => {
            const opt = document.createElement('option');
            opt.value = st.name;
            opt.dataset.pin = st.pin || '';
            opt.dataset.className = st.class || '';
            opt.textContent = `${st.name} (${st.class || 'Chưa xếp lớp'})`;
            studentSelect.appendChild(opt);
          });
        }
      }

      // Reset inputs & switch mode
      switchSubmitMode('short');
      const ansInput = document.getElementById('submit-answer-input');
      const essayInput = document.getElementById('submit-essay-input');
      if (ansInput) ansInput.value = '';
      if (essayInput) essayInput.value = '';

      // Check Previous Submission
      checkAndRenderPreviousSubmission(prob.id);

      const modal = document.getElementById('modal-submit-problem');
      if (modal) modal.classList.remove('hidden');
    }

    function closeSubmitModal() {
      const modal = document.getElementById('modal-submit-problem');
      if (modal) modal.classList.add('hidden');
      currentSubmitProbId = null;
    }

    function openJudgeFromSubmitModal() {
      if (!currentSubmitProbId) return;
      const pid = currentSubmitProbId;
      closeSubmitModal();
      openJudgeWithProblem(pid);
    }

    function switchSubmitMode(mode) {
      currentSubmitMode = mode;
      const btnShort = document.getElementById('btn-submit-tab-short');
      const btnEssay = document.getElementById('btn-submit-tab-essay');
      const boxShort = document.getElementById('submit-mode-short-box');
      const boxEssay = document.getElementById('submit-mode-essay-box');

      if (mode === 'short') {
        if (btnShort) {
          btnShort.className = "py-2 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer bg-indigo-600 text-white shadow";
        }
        if (btnEssay) {
          btnEssay.className = "py-2 rounded-lg font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer text-slate-400 hover:text-white";
        }
        if (boxShort) boxShort.classList.remove('hidden');
        if (boxEssay) boxEssay.classList.add('hidden');
        setTimeout(() => document.getElementById('submit-answer-input')?.focus(), 50);
      } else {
        if (btnShort) {
          btnShort.className = "py-2 rounded-lg font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer text-slate-400 hover:text-white";
        }
        if (btnEssay) {
          btnEssay.className = "py-2 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer bg-indigo-600 text-white shadow";
        }
        if (boxShort) boxShort.classList.add('hidden');
        if (boxEssay) boxEssay.classList.remove('hidden');
        setTimeout(() => document.getElementById('submit-essay-input')?.focus(), 50);
      }
    }

    function insertEssayTemplate(type) {
      const ta = document.getElementById('submit-essay-input');
      if (!ta) return;
      ta.value = '';
      const charCountEl = document.getElementById('submit-essay-char-count');
      if (charCountEl) charCountEl.textContent = `0 ký tự`;
      ta.focus();
    }

    function onAdminSubmitStudentChange() {
      if (currentSubmitProbId) {
        checkAndRenderPreviousSubmission(currentSubmitProbId);
      }
    }

    function getCurrentlySubmittingStudent() {
      if (!currentAuth) {
        return { name: 'Khách', class: 'Khách', pin: 'GUEST', stt: 'GUEST' };
      }
      if (currentAuth.role === 'student') {
        const st = (appData.students || []).find(s => s.name === currentAuth.name);
        return {
          name: currentAuth.name,
          class: (st && st.class) || currentAuth.class || 'C++ nâng cao',
          pin: (st && st.pin) || currentAuth.pin || '',
          stt: (st && st.stt) || currentAuth.stt || ''
        };
      } else {
        const studentSelect = document.getElementById('submit-student-select');
        if (studentSelect && studentSelect.selectedIndex >= 0) {
          const opt = studentSelect.options[studentSelect.selectedIndex];
          const st = (appData.students || []).find(s => s.name === opt.value);
          return {
            name: opt.value,
            class: opt.dataset.className || (st && st.class) || 'C++ nâng cao',
            pin: opt.dataset.pin || (st && st.pin) || '',
            stt: (st && st.stt) || ''
          };
        }
        return { name: (currentAuth && currentAuth.name) || 'Khách', class: (currentAuth && currentAuth.class) || 'Chung', pin: (currentAuth && currentAuth.pin) || '', stt: (currentAuth && currentAuth.stt) || '' };
      }
    }

    function checkAndRenderPreviousSubmission(probId) {
      const prevBox = document.getElementById('submit-previous-box');
      if (!prevBox || !appData || !appData.submissions) return;

      const student = getCurrentlySubmittingStudent();
      const mySub = (typeof findStudentSubmission === 'function')
        ? findStudentSubmission(appData.submissions, probId, student)
        : appData.submissions.find(s => s.problem_id === probId && (s.student_id === student.pin || s.student_name === student.name));

      if (mySub) {
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
            badge.className = "px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30";
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
          const ansInput = document.getElementById('submit-answer-input');
          if (ansInput && !ansInput.value) ansInput.value = mySub.answer || '';
        } else {
          const essayInput = document.getElementById('submit-essay-input');
          if (essayInput && !essayInput.value) essayInput.value = mySub.answer || '';
        }
      } else {
        prevBox.classList.add('hidden');
      }
    }

    async function handleConfirmSubmitProblem() {
      if (!currentSubmitProbId) return;
      const prob = (appData.problems || []).find(p => p.id === currentSubmitProbId) || (getGraderProblems()).find(p => p.id === currentSubmitProbId);
      if (!prob) return;

      const student = getCurrentlySubmittingStudent();
      let answerContent = '';

      if (currentSubmitMode === 'short') {
        const input = document.getElementById('submit-answer-input');
        answerContent = input ? input.value.trim() : '';
        if (!answerContent) {
          alert("Vui lòng nhập đáp án của bạn trước khi bấm nộp bài!");
          input?.focus();
          return;
        }
      } else {
        const input = document.getElementById('submit-essay-input');
        answerContent = input ? input.value.trim() : '';
        if (!answerContent) {
          alert("Vui lòng viết lời giải hoặc dán mã nguồn bài làm trước khi nộp!");
          input?.focus();
          return;
        }
      }

      const btnSubmit = document.getElementById('btn-confirm-submit');
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
        student_id: student.stt ? String(student.stt) : (student.pin || ''),
        student_stt: student.stt ? Number(student.stt) : '',
        student_pin: student.pin || '',
        student_name: student.name,
        class_name: student.class,
        problem_id: prob.id,
        problem_name: prob.name,
        type: currentSubmitMode,
        submission_type_display: (currentSubmitMode === 'essay' ? (detectedLang !== 'Khác' ? 'Code DeruckOJ' : 'Tự luận') : 'Điền đáp án'),
        answer: (currentSubmitMode === 'essay' && detectedLang !== 'Khác' && !answerContent.startsWith('[')) 
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
      saveAppDataLocally();
      try { localStorage.setItem('cp_cached_submissions', JSON.stringify(appData.submissions)); } catch(e) {}

      let savedToFirebase = false;
      // Save remotely before reporting successful delivery.
      if (typeof saveSubmissionToFirebase === 'function' && isFirebaseConfigured()) {
        try {
          savedToFirebase = await saveSubmissionToFirebase(subData);
        } catch(e) {}
      }

      // Sync to Google Sheet 'Bài Nộp'
      const synced = await syncToGoogleSheets({ action: 'submit_answer', submission: subData }, { silent: true });

      showLiveToast(savedToFirebase || synced
        ? '🎉 Đã nộp bài thành công! Thầy sẽ sớm xem và nhận xét bài của bạn.'
        : '⚠️ Bài mới được lưu trên máy này, chưa gửi tới thầy. Hãy kiểm tra kết nối và nộp lại.');
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<span>🚀</span> Xác Nhận Nộp Bài';
      }

      closeSubmitModal();
      renderProblems();
      if (typeof renderGlobalSubmissions === 'function') renderGlobalSubmissions();
    }

    // ============================================================
    // 13. QUẢN LÝ BÀI NỘP HỌC SINH (TEACHER SUBMISSIONS MANAGER)
    // ============================================================
    function openSubmissionsManagerModal() {
      const isAdmin = Boolean(currentAuth && (currentAuth.role === 'admin' || currentAuth.role === 'teacher'));
      if (!isAdmin) {
        showLiveToast('⚠️ Quyền truy cập bị từ chối: Chỉ Quản trị viên / Giáo viên mới có quyền mở Danh sách Quản lý Bài nộp!', 'warning');
        return;
      }
      const modal = document.getElementById('modal-submissions-manager');
      if (!modal) return;
      modal.classList.remove('hidden');
      renderSubmissionsManagerList();
    }

    function closeSubmissionsManagerModal() {
      const modal = document.getElementById('modal-submissions-manager');
      if (modal) modal.classList.add('hidden');
    }

    function renderSubmissionsManagerList() {
      const container = document.getElementById('sub-manager-list');
      const countBadge = document.getElementById('sub-manager-count-badge');
      if (!container || !appData) return;

      const isAdmin = Boolean(currentAuth && (currentAuth.role === 'admin' || currentAuth.role === 'teacher'));
      const submissions = appData.submissions || [];
      const filterClass = document.getElementById('sub-filter-class')?.value || 'all';
      const filterStatus = document.getElementById('sub-filter-status')?.value || 'all';
      const filterType = document.getElementById('sub-filter-type')?.value || 'all';
      const searchKey = (document.getElementById('sub-filter-search')?.value || '').toLowerCase().trim();

      const filtered = submissions.filter(s => {
        if (filterClass !== 'all' && s.class_name !== filterClass) return false;
        if (filterStatus !== 'all' && s.status !== filterStatus) return false;
        if (filterType !== 'all') {
          if (filterType === 'short' && s.type !== 'short' && s.submission_type_display !== 'Điền đáp án') return false;
          if (filterType === 'essay' && s.type !== 'essay' && s.submission_type_display !== 'Tự luận' && s.submission_type_display !== 'Code DeruckOJ') return false;
        }
        if (searchKey) {
          const matchName = (s.student_name && s.student_name.toLowerCase().includes(searchKey));
          const matchProb = (s.problem_id && s.problem_id.toLowerCase().includes(searchKey)) || (s.problem_name && s.problem_name.toLowerCase().includes(searchKey));
          const matchAns = (s.answer && s.answer.toLowerCase().includes(searchKey));
          if (!matchName && !matchProb && !matchAns) return false;
        }
        return true;
      });

      if (countBadge) countBadge.textContent = `${filtered.length} / ${submissions.length} bài nộp`;

      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="p-12 text-center text-slate-500 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2">
            <div class="text-3xl">📭</div>
            <div class="text-sm font-bold text-slate-400">Chưa có bài nộp nào phù hợp bộ lọc</div>
            <p class="text-xs text-slate-500">Học sinh khi nộp bài qua hình thức Điền đáp án hoặc Tự luận sẽ hiển thị danh sách tại đây.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = '';
      filtered.forEach(sub => {
        const card = document.createElement('div');
        card.className = "p-4 bg-slate-950/90 border border-slate-800 hover:border-slate-700 rounded-xl space-y-2.5 transition";

        let statusClass = "bg-amber-500/20 text-amber-300 border-amber-500/30";
        if (sub.status === 'Chấm đạt' || sub.status === 'Hoàn thành') {
          statusClass = "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
        } else if (sub.status === 'Cần sửa') {
          statusClass = "bg-rose-500/20 text-rose-300 border-rose-500/30";
        }

        const typeDisplay = sub.submission_type_display || (sub.type === 'essay' ? 'Tự luận' : 'Điền đáp án');
        const isEssay = (sub.type === 'essay' || typeDisplay === 'Tự luận' || typeDisplay === 'Code DeruckOJ');

        const canView = isSubmissionAuthorOrAdmin(sub);

        card.innerHTML = `
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-bold text-white text-sm">${escapeHtml(sub.student_name)}</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">${escapeHtml(sub.class_name || 'Lớp học')}</span>
              <span class="text-xs text-slate-400 font-mono">Bài: <strong class="text-slate-200">${escapeHtml(sub.problem_id)}</strong> - ${escapeHtml(sub.problem_name || '')}</span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isEssay ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}">
                ${isEssay ? '✍️ Tự luận' : '🔢 Điền đáp án'}
              </span>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${statusClass}">
                ${escapeHtml(sub.status || 'Đã nộp')}
              </span>
              ${sub.score !== undefined && sub.score !== '' ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">💯 ${sub.score}/10</span>` : ''}
            </div>
          </div>

          <!-- Answer Preview -->
          <div class="space-y-1 text-xs">
            <div class="text-[11px] text-slate-400 flex items-center justify-between">
              <span>Nội dung bài làm:</span>
              <span class="font-mono text-slate-500 text-[10px]">${sub.submitted_at || ''}</span>
            </div>
            ${canView ? `
              <div class="p-2.5 bg-slate-900 border border-slate-800 rounded-lg font-mono text-xs text-slate-200 whitespace-pre-wrap max-h-24 overflow-y-auto leading-relaxed select-text">${escapeHtml(sub.answer || '(Trống)')}</div>
            ` : `
              <div class="p-2.5 bg-slate-950/80 border border-amber-500/30 rounded-lg font-mono text-xs text-amber-400/90 leading-relaxed select-none">
                🔒 Mã nguồn bài làm được bảo mật — Chỉ Quản trị viên / Giáo viên mới có quyền xem.
              </div>
            `}
          </div>

          <!-- Feedback & Actions -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
            <div class="text-xs text-indigo-300 flex-1 truncate">
              ${sub.feedback ? `💬 <strong>Nhận xét:</strong> ${escapeHtml(sub.feedback)}` : '<span class="text-slate-500 italic text-[11px]">Chưa có nhận xét của giáo viên.</span>'}
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button onclick="openGradeModal('${sub.id}')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1 cursor-pointer shadow">
                <span>✏️</span> Chấm Điểm
              </button>
              ${isAdmin ? `
                <button onclick="deleteSubmission('${sub.id}')" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition cursor-pointer">
                  🗑️
                </button>
              ` : ''}
            </div>
          </div>
        `;
        container.appendChild(card);
      });
    }

    async function deleteSubmission(subId) {
      const isAdmin = Boolean(currentAuth && (currentAuth.role === 'admin' || currentAuth.role === 'teacher'));
      if (!isAdmin) {
        alert("Chỉ Quản trị viên / Giáo viên mới có quyền xóa bài nộp!");
        return;
      }
      if (!confirm("Bạn có chắc chắn muốn xóa bài nộp này không?")) return;
      if (appData && appData.submissions) {
        appData.submissions = appData.submissions.filter(s => s.id !== subId);
        saveAppDataLocally();
        try { localStorage.setItem('cp_cached_submissions', JSON.stringify(appData.submissions)); } catch(e) {}

        if (typeof deleteSubmissionFromFirebase === 'function' && isFirebaseConfigured()) {
          try {
            await deleteSubmissionFromFirebase(subId);
          } catch(e) {}
        }
        if (typeof deleteArchivedSubmission === 'function') {
          await deleteArchivedSubmission(subId);
        }

        renderSubmissionsManagerList();
        renderProblems();
        showLiveToast("Đã xóa bài nộp.");
      }
    }

    // ============================================================
    // DeruckOJ GLOBAL SUBMISSIONS STREAM & RECONCILIATION ENGINE
    // ============================================================
    let currentSubmissionsDisplayLimit = 50;

    function loadMoreSubmissions() {
      currentSubmissionsDisplayLimit += 50;
      renderGlobalSubmissions();
    }

    // SAO CHÉP MÃ NGUỒN TỪ MODAL XEM BÀI (ADMIN, GIÁO VIÊN HOẶC CHÍNH TÁC GIẢ)
    function copyGradeAnswerContent() {
      const sub = (currentGradeSubId && appData && appData.submissions) ? appData.submissions.find(s => s.id === currentGradeSubId) : null;
      const isAllowed = isSubmissionAuthorOrAdmin(sub);
      if (!isAllowed) {
        alert("🔒 Không thể sao chép mã nguồn bài làm được bảo mật! Chỉ Quản trị viên (Admin), Giáo viên hoặc chính tác giả mới có quyền truy cập.");
        return;
      }
      const el = document.getElementById('grade-sub-answer-content');
      if (!el) return;
      const text = el.textContent || '';
      if (!text || text.includes('Mã nguồn bài nộp đã được bảo mật') || text.includes('Mã nguồn bài làm được bảo mật')) {
        alert("Không thể sao chép mã nguồn được bảo mật!");
        return;
      }
      navigator.clipboard.writeText(text).then(() => {
        showLiveToast('📋 Đã sao chép mã nguồn bài làm vào clipboard!');
      }).catch(() => {
        alert("Đã sao chép: " + text.slice(0, 50) + "...");
      });
    }

    // BẢO VỆ VÀ PHỤC HỒI TOÀN BỘ TRẠNG THÁI AC & BÀI NỘP HỌC SINH (CHỐNG MẤT KHI RELOAD CACHE)
    function reconcileStudentSolvedState() {
      if (!appData || !Array.isArray(appData.students)) return;
      if (!Array.isArray(appData.submissions)) appData.submissions = [];
      const allSubs = appData.submissions;

      const solvedMap = {};
      appData.students.forEach(s => {
        if (!s || !s.name) return;
        const key = s.name.trim().toLowerCase();
        if (!solvedMap[key]) solvedMap[key] = new Set(s.solved || []);

        // Phục hồi từ bộ nhớ đệm cục bộ bền vững
        try {
          const backup = localStorage.getItem('deruck_solved_backup_' + key);
          if (backup) {
            const list = JSON.parse(backup);
            if (Array.isArray(list)) list.forEach(p => solvedMap[key].add(p));
          }
        } catch(e) {}
      });

      // 1. Quét toàn bộ bài nộp: Nếu đạt AC, Chấm đạt hoặc điểm tối đa -> tự động khôi phục AC cho học sinh
      allSubs.forEach(sub => {
        if (!sub || !sub.problem_id) return;
        const isAC = (sub.status === 'Chấm đạt' || sub.status === 'Hoàn thành' || 
                      (sub.score && (Number(sub.score) >= 10 || String(sub.score).includes('100'))) || 
                      (sub.feedback && sub.feedback.includes('AC')));
        if (!isAC) return;

        const sName = (sub.student_name || '').trim().toLowerCase();
        let targetKey = null;
        if (sName && solvedMap[sName]) {
          targetKey = sName;
        } else {
          const matchStudent = appData.students.find(s => 
            (s.name && s.name.trim().toLowerCase() === sName) ||
            (sub.student_stt && s.stt && Number(s.stt) === Number(sub.student_stt)) ||
            (sub.student_pin && s.pin && s.pin === sub.student_pin)
          );
          if (matchStudent) targetKey = (matchStudent.name || '').trim().toLowerCase();
        }

        if (targetKey && solvedMap[targetKey]) {
          solvedMap[targetKey].add(sub.problem_id);
        }
      });

      // 2. Lưu lại danh sách solved đã chuẩn hóa cho từng học sinh
      appData.students.forEach(s => {
        if (!s || !s.name) return;
        const key = s.name.trim().toLowerCase();
        if (solvedMap[key]) {
          s.solved = Array.from(solvedMap[key]);
          try {
            localStorage.setItem('deruck_solved_backup_' + key, JSON.stringify(s.solved));
          } catch(e) {}
        }
      });

      // 3. Lọc sạch toàn bộ bài nộp trong bộ nhớ: Chỉ lưu bài nộp của WEB DeruckOJ
      if (typeof isDeruckSubmission === 'function') {
        appData.submissions = allSubs.filter(isDeruckSubmission);
      } else {
        appData.submissions = allSubs;
      }

      try {
        localStorage.setItem('cp_cached_students', JSON.stringify(appData.students));
        localStorage.setItem('cp_cached_submissions', JSON.stringify(appData.submissions));
      } catch(e) {}
    }

    function parseSubmissionTimestamp(sub) {
      if (!sub) return 0;
      if (sub.id) {
        const m = String(sub.id).match(/^SUB-(\d{12,13})/);
        if (m) {
          const ts = parseInt(m[1], 10);
          if (!isNaN(ts) && ts > 1000000000000) return ts;
        }
      }
      const s = String(sub.submitted_at || '').trim();
      if (!s) return 0;

      // 1. Định dạng chuẩn Việt Nam: DD/MM/YYYY[, ] HH:mm:ss
      const mDateTime = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[,\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
      if (mDateTime) {
        const [, day, mon, yr, h, min, sec] = mDateTime;
        return new Date(parseInt(yr, 10), parseInt(mon, 10) - 1, parseInt(day, 10), parseInt(h, 10), parseInt(min, 10), parseInt(sec || 0, 10)).getTime();
      }

      // 2. Định dạng: HH:mm:ss DD/MM/YYYY
      const mTimeDate = s.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (mTimeDate) {
        const [, h, min, sec, day, mon, yr] = mTimeDate;
        return new Date(parseInt(yr, 10), parseInt(mon, 10) - 1, parseInt(day, 10), parseInt(h, 10), parseInt(min, 10), parseInt(sec || 0, 10)).getTime();
      }

      // 3. Dự phòng cho chuỗi ISO hoặc định dạng chuẩn quốc tế
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d.getTime();

      return 0;
    }

    // BẢNG CHẤM BÀI TOÀN HỆ THỐNG (DERUCKOJ SUBMISSIONS STREAM)
    function renderGlobalSubmissions() {
      const tbody = document.getElementById('submissions-table-body');
      const countBadge = document.getElementById('submissions-count-badge');
      const loadMoreContainer = document.getElementById('submissions-loadmore-container');
      if (!tbody) return;

      const rawSubs = (appData && Array.isArray(appData.submissions)) ? appData.submissions : [];
      const allSubs = (typeof isDeruckSubmission === 'function') ? rawSubs.filter(isDeruckSubmission) : rawSubs;

      // Sắp xếp bài nộp theo thời gian mới nhất lên đầu
      allSubs.sort((a, b) => {
        const ta = parseSubmissionTimestamp(a);
        const tb = parseSubmissionTimestamp(b);
        if (tb !== ta) return tb - ta;
        const sa = String((a && a.id) || '');
        const sb = String((b && b.id) || '');
        return sb.localeCompare(sa);
      });

      if (countBadge) countBadge.textContent = `${allSubs.length} bài nộp`;

      // Cập nhật thống kê nhanh (Live Stats Strip)
      const statTotalEl = document.getElementById('subs-stat-total');
      const statAcEl = document.getElementById('subs-stat-ac');
      const statFailedEl = document.getElementById('subs-stat-failed');
      const statStudentsEl = document.getElementById('subs-stat-students');

      let acTotalCount = 0;
      let failedTotalCount = 0;
      const studentNamesSet = new Set();

      allSubs.forEach(s => {
        if (!s) return;
        if (s.student_name && String(s.student_name).trim()) {
          studentNamesSet.add(String(s.student_name).trim());
        }
        const isAC = (s.status === 'Chấm đạt' || s.status === 'Hoàn thành' || (s.feedback && s.feedback.includes('AC')) || s.verdict === 'AC');
        const isFailed = (s.verdict === 'WA' || s.verdict === 'TLE' || s.verdict === 'CE' || s.verdict === 'RTE' ||
          (s.feedback && (s.feedback.includes('WA') || s.feedback.includes('TLE') || s.feedback.includes('CE') || s.feedback.includes('RTE'))) ||
          (s.status === 'Cần sửa' || s.status === 'Chưa đạt'));
        if (isAC) acTotalCount++;
        else if (isFailed) failedTotalCount++;
      });

      if (statTotalEl) statTotalEl.textContent = allSubs.length;
      if (statAcEl) statAcEl.textContent = acTotalCount;
      if (statFailedEl) statFailedEl.textContent = failedTotalCount;
      if (statStudentsEl) statStudentsEl.textContent = studentNamesSet.size;

      // Tự động tải từ Firebase nếu danh sách bài nộp rỗng
      if (allSubs.length === 0 && typeof fetchSubmissionsFromFirebase === 'function' && isFirebaseConfigured() && !window._fbSubsFetching) {
        window._fbSubsFetching = true;
        fetchSubmissionsFromFirebase().then(fbSubs => {
          window._fbSubsFetching = false;
          if (fbSubs && fbSubs.length > 0) {
            appData.submissions = typeof mergeSubmissionCollections === 'function'
              ? mergeSubmissionCollections(appData.submissions || [], fbSubs)
              : fbSubs;
            if (typeof archiveSubmissionsLocally === 'function') {
              archiveSubmissionsLocally(appData.submissions, { silent: true });
            }
            try { localStorage.setItem('cp_cached_submissions', JSON.stringify(appData.submissions)); } catch(e) {}
            renderGlobalSubmissions();
          }
        }).catch(() => { window._fbSubsFetching = false; });
      }

      const searchInput = document.getElementById('subs-search-input');
      const classFilter = document.getElementById('subs-class-filter')?.value || 'all';
      const verdictFilter = document.getElementById('subs-verdict-filter')?.value || 'all';
      const langFilter = document.getElementById('subs-lang-filter')?.value || 'all';
      const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

      const filtered = allSubs.filter(sub => {
        if (!sub) return false;
        
        if (query) {
          const match = (sub.student_name && sub.student_name.toLowerCase().includes(query)) ||
            (sub.problem_id && sub.problem_id.toLowerCase().includes(query)) ||
            (sub.problem_name && sub.problem_name.toLowerCase().includes(query)) ||
            (sub.id && sub.id.toLowerCase().includes(query));
          if (!match) return false;
        }

        if (classFilter !== 'all') {
          if (!sub.class_name || !sub.class_name.toLowerCase().includes(classFilter.toLowerCase())) {
            return false;
          }
        }

        if (verdictFilter !== 'all') {
          const isAC = (sub.status === 'Chấm đạt' || sub.status === 'Hoàn thành' || (sub.feedback && sub.feedback.includes('AC')) || sub.verdict === 'AC');
          const isWA = (sub.verdict === 'WA' || (sub.feedback && sub.feedback.includes('WA')) || (sub.status === 'Cần sửa' && (!sub.feedback || !sub.feedback.includes('TLE'))));
          const isTLE = (sub.verdict === 'TLE' || (sub.feedback && sub.feedback.includes('TLE')));
          const isCE = (sub.verdict === 'CE' || (sub.feedback && sub.feedback.includes('CE')));
          const isRTE = (sub.verdict === 'RTE' || (sub.feedback && sub.feedback.includes('RTE')));

          if (verdictFilter === 'AC' && !isAC) return false;
          if (verdictFilter === 'WA' && !isWA) return false;
          if (verdictFilter === 'TLE' && !isTLE) return false;
          if (verdictFilter === 'CE' && !isCE) return false;
          if (verdictFilter === 'RTE' && !isRTE) return false;
        }

        if (langFilter !== 'all') {
          const isCpp = (sub.answer && sub.answer.includes('[C++')) || (sub.lang && sub.lang.includes('C++'));
          const isPython = (sub.answer && sub.answer.includes('[Python')) || (sub.lang && sub.lang.includes('Python'));
          if (langFilter === 'cpp' && !isCpp) return false;
          if (langFilter === 'python' && !isPython) return false;
          if (langFilter === 'other' && (isCpp || isPython)) return false;
        }

        return true;
      });

      tbody.innerHTML = '';
      if (loadMoreContainer) loadMoreContainer.innerHTML = '';

      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" class="p-10 text-center text-slate-500">
              <div class="text-3xl mb-1">📜</div>
              <div class="text-xs font-bold text-slate-300">Chưa có bài nộp nào phù hợp bộ lọc</div>
              <p class="text-[11px] text-slate-400 mt-0.5">Các bài nộp từ học sinh sẽ xuất hiện tại đây theo thời gian thực.</p>
            </td>
          </tr>
        `;
        return;
      }

      const items = filtered.slice(0, currentSubmissionsDisplayLimit);
      items.forEach((sub, idx) => {
        try {
          const tr = document.createElement('tr');
          tr.className = "hover:bg-slate-800/40 transition border-b border-slate-800/60";

          const subIdShort = sub.id ? (sub.id.replace('SUB-', '').slice(-6) || sub.id) : (idx + 1);
          const isAC = (sub.status === 'Chấm đạt' || sub.status === 'Hoàn thành' || (sub.feedback && sub.feedback.includes('AC')) || sub.verdict === 'AC');
          const isWA = (sub.verdict === 'WA' || (sub.feedback && sub.feedback.includes('WA')) || (sub.status === 'Cần sửa' && (!sub.feedback || !sub.feedback.includes('TLE'))));
          const isTLE = (sub.verdict === 'TLE' || (sub.feedback && sub.feedback.includes('TLE')));
          const isCE = (sub.verdict === 'CE' || (sub.feedback && sub.feedback.includes('CE')));
          const isRTE = (sub.verdict === 'RTE' || (sub.feedback && sub.feedback.includes('RTE')));

          let verdictBadge = '';
          if (isAC) {
            verdictBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">✓ AC</span>';
          } else if (isCE) {
            verdictBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">⚠️ CE</span>';
          } else if (isTLE) {
            verdictBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">⏱️ TLE</span>';
          } else if (isRTE) {
            verdictBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold font-mono bg-pink-500/20 text-pink-300 border border-pink-500/30">💥 RTE</span>';
          } else if (isWA) {
            verdictBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">✗ WA</span>';
          } else {
            verdictBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium font-mono bg-slate-800 text-slate-300 border border-slate-700">${escapeHtml(sub.status || 'Đã nộp')}</span>`;
          }

          const isCpp = (sub.answer && sub.answer.includes('[C++')) || (sub.lang && sub.lang.includes('C++'));
          const isPython = (sub.answer && sub.answer.includes('[Python')) || (sub.lang && sub.lang.includes('Python'));
          let langBadge = '<span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700">Tự luận</span>';
          if (isCpp) {
            langBadge = '<span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-500/15 text-blue-300 border border-blue-500/25">C++20</span>';
          } else if (isPython) {
            langBadge = '<span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/25">Python 3</span>';
          }

          // Quyền xem mã nguồn: Admin, Giáo viên hoặc chính tác giả bài nộp
          const canViewCode = isSubmissionAuthorOrAdmin(sub);

          const actionHtml = canViewCode ? `
            <button onclick="viewSubmissionCodeModal('${sub.id}')" class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 transition cursor-pointer flex items-center gap-1 ml-auto">
              <span>👁️</span><span>Xem code</span>
            </button>
          ` : `
            <span class="px-2 py-0.5 rounded text-[10px] font-mono text-slate-500 bg-slate-950 border border-slate-800 select-none block text-right" title="Mã nguồn được bảo mật — Chỉ Quản trị viên hoặc chính tác giả mới có quyền xem">🔒 Riêng tư</span>
          `;

          let timeMem = '--';
          if (sub.feedback && sub.feedback.includes('testcase')) {
            timeMem = '0.02s • 1.2M';
          }

          const sName = (sub.student_name && String(sub.student_name).trim()) || 'Học sinh';
          const initialChar = sName.charAt(0).toUpperCase() || 'U';

          tr.innerHTML = `
            <td class="py-2.5 px-3 text-center font-mono text-xs text-slate-400">#${subIdShort}</td>
            <td class="py-2.5 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">${sub.submitted_at || '--'}</td>
            <td class="py-2.5 px-3">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[10px] text-indigo-300 border border-slate-700 shrink-0">
                  ${initialChar}
                </div>
                <div class="leading-tight">
                  <span class="font-bold text-white text-xs">${escapeHtml(sName)}</span>
                  ${sub.class_name ? `<div class="text-[10px] text-slate-400 font-mono">${escapeHtml(sub.class_name)}</div>` : ''}
                </div>
              </div>
            </td>
            <td class="py-2.5 px-3">
              <div class="leading-tight">
                <a href="javascript:void(0)" onclick="openJudgeWithProblem('${sub.problem_id}')" class="font-bold text-indigo-300 hover:text-white transition text-xs cursor-pointer block">
                  [${sub.problem_id}] ${escapeHtml(sub.problem_name || sub.problem_id)}
                </a>
              </div>
            </td>
            <td class="py-2.5 px-3 text-center">${langBadge}</td>
            <td class="py-2.5 px-3 text-center">${verdictBadge}</td>
            <td class="py-2.5 px-3 text-center font-mono font-bold text-xs ${isAC ? 'text-emerald-400' : 'text-slate-300'}">
              ${sub.score !== undefined ? (String(sub.score).includes('/') ? sub.score : sub.score + '/10') : '--'}
            </td>
            <td class="py-2.5 px-3 text-center hidden md:table-cell font-mono text-[11px] text-slate-400">${timeMem}</td>
            <td class="py-2.5 px-3 text-right">${actionHtml}</td>
          `;
          tbody.appendChild(tr);
        } catch (rowErr) {
          console.error("Lỗi khi render hàng bài nộp:", rowErr, sub);
        }
      });

      if (filtered.length > currentSubmissionsDisplayLimit && loadMoreContainer) {
        loadMoreContainer.innerHTML = `
          <button onclick="loadMoreSubmissions()" class="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold transition shadow cursor-pointer">
            ⬇️ Hiển thị thêm bài nộp (Đang xem ${currentSubmissionsDisplayLimit} / ${filtered.length})
          </button>
        `;
      }
    }

    // XEM MÃ NGUỒN VÀ BẢO MẬT BÀI NỘP (ADMIN, GIÁO VIÊN HOẶC CHÍNH TÁC GIẢ)
    async function viewSubmissionCodeModal(subId) {
      if (!appData || !appData.submissions) return;
      let sub = appData.submissions.find(s => s.id === subId);

      // Tra cứu từ kho lưu trữ raw submissions nếu có
      try {
        const rawSaved = localStorage.getItem('cp_raw_submissions_v2');
        if (rawSaved) {
          const rawList = JSON.parse(rawSaved);
          const foundRaw = rawList.find(s => s.id === subId);
          if (foundRaw && foundRaw.answer && !foundRaw.answer.includes('Mã nguồn bài nộp đã được bảo mật')) {
            sub = foundRaw;
          }
        }
      } catch(e) {}

      if (!sub) return;

      if (!isSubmissionAuthorOrAdmin(sub)) {
        alert("🔒 Mã nguồn bài nộp được bảo mật! Chỉ Quản trị viên (Admin), Giáo viên hoặc chính tác giả bài nộp mới có quyền xem.");
        return;
      }

      const isAdmin = Boolean(currentAuth && (currentAuth.role === 'admin' || currentAuth.role === 'teacher'));

      currentGradeSubId = sub.id;
      const idEl = document.getElementById('grade-sub-id');
      const subTitleEl = document.getElementById('grade-modal-sub');
      const stNameEl = document.getElementById('grade-sub-student');
      const stClassEl = document.getElementById('grade-sub-class');
      const probEl = document.getElementById('grade-sub-problem');
      const timeEl = document.getElementById('grade-sub-time');
      const ansEl = document.getElementById('grade-sub-answer-content');

      if (idEl) idEl.value = sub.id;
      if (subTitleEl) subTitleEl.textContent = `Mã bài nộp: ${sub.id}`;
      if (stNameEl) stNameEl.textContent = sub.student_name || 'Học sinh';
      if (stClassEl) stClassEl.textContent = sub.class_name || 'Lớp học';
      if (probEl) probEl.textContent = `${sub.problem_id} - ${sub.problem_name || ''}`;
      if (timeEl) timeEl.textContent = sub.submitted_at || '--';

      const typeBadge = document.getElementById('grade-sub-type-badge');
      if (typeBadge) {
        const isCpp = (sub.answer && sub.answer.includes('[C++')) || (sub.lang && sub.lang.includes('C++'));
        const isPython = (sub.answer && sub.answer.includes('[Python')) || (sub.lang && sub.lang.includes('Python'));
        if (isCpp) {
          typeBadge.textContent = '💻 Code C++20';
          typeBadge.className = "px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30";
        } else if (isPython) {
          typeBadge.textContent = '🐍 Code Python 3';
          typeBadge.className = "px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30";
        } else if (sub.type === 'essay' || sub.submission_type_display === 'Tự luận') {
          typeBadge.textContent = '✍️ Tự luận';
          typeBadge.className = "px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30";
        } else {
          typeBadge.textContent = '🔢 Điền đáp án';
          typeBadge.className = "px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
        }
      }

      if (ansEl) ansEl.textContent = sub.answer || '(Trống)';

      const statusEl = document.getElementById('grade-form-status');
      const scoreEl = document.getElementById('grade-form-score');
      const fbEl = document.getElementById('grade-form-feedback');
      if (statusEl) statusEl.value = sub.status || 'Chấm đạt';
      if (scoreEl) scoreEl.value = (sub.score !== undefined && sub.score !== '') ? sub.score : '10';
      if (fbEl) fbEl.value = sub.feedback || '';

      // Chỉ hiển thị controls chấm điểm nếu là Admin/Teacher
      const adminControls = document.getElementById('grade-modal-admin-controls');
      const btnSave = document.getElementById('btn-save-grade');
      if (adminControls) adminControls.classList.toggle('hidden', !isAdmin);
      if (btnSave) btnSave.classList.toggle('hidden', !isAdmin);

      const modal = document.getElementById('modal-grade-submission');
      if (modal) modal.classList.remove('hidden');

      // Nếu bài nộp chứa placeholder bảo mật hoặc trống, tự động kéo mã nguồn thật từ Firebase
      if ((!sub.answer || sub.answer.includes('Mã nguồn bài nộp đã được bảo mật')) && typeof fetchSingleSubmissionFromFirebase === 'function') {
        if (ansEl) ansEl.innerHTML = '<span class="text-indigo-400 font-semibold animate-pulse">⏳ Đang tải mã nguồn bài nộp gốc từ Firebase...</span>';
        try {
          const fbData = await fetchSingleSubmissionFromFirebase(sub.id);
          if (fbData && fbData.answer && !fbData.answer.includes('Mã nguồn bài nộp đã được bảo mật')) {
            sub.answer = fbData.answer;
            if (fbData.score !== undefined && fbData.score !== '') sub.score = fbData.score;
            if (fbData.feedback) sub.feedback = fbData.feedback;
            if (ansEl) ansEl.textContent = sub.answer;
            const targetSub = appData.submissions.find(s => s.id === sub.id);
            if (targetSub) {
              targetSub.answer = fbData.answer;
              if (fbData.score !== undefined) targetSub.score = fbData.score;
              if (fbData.feedback) targetSub.feedback = fbData.feedback;
            }
            try { localStorage.setItem('cp_cached_submissions', JSON.stringify(appData.submissions)); } catch(e) {}
          } else {
            if (ansEl) ansEl.textContent = sub.answer || '(Không tìm thấy mã nguồn chi tiết trên đám mây)';
          }
        } catch (e) {
          console.warn("Lỗi tải mã nguồn chi tiết:", e);
          if (ansEl) ansEl.textContent = sub.answer || '(Lỗi khi tải mã nguồn)';
        }
      }
    }

    // MỞ MÃ NGUỒN BÀI NỘP ĐANG XEM TRONG TRÌNH CHẤM DERUCKOJ IDE
    function openJudgeWithCurrentGradeSubmission() {
      if (!currentGradeSubId || !appData || !appData.submissions) return;
      const sub = appData.submissions.find(s => s.id === currentGradeSubId);
      if (!sub) return;
      const el = document.getElementById('grade-sub-answer-content');
      let code = el ? el.textContent : (sub.answer || '');
      if (!code || code.includes('Mã nguồn bài nộp đã được bảo mật') || code.includes('Đang tải mã nguồn')) {
        alert("Chưa có mã nguồn hợp lệ để mở trong IDE!");
        return;
      }
      let detectedLang = 'cpp';
      if (code.startsWith('[Python 3]') || code.includes('import sys') || code.includes('def ')) {
        detectedLang = 'python';
      } else if (code.startsWith('[C++20]') || code.startsWith('[C++]') || code.includes('#include')) {
        detectedLang = 'cpp';
      }
      const cleanCode = code.replace(/^\[(C\+\+20|Python 3|C\+\+)\]\r?\n/, '');

      closeGradeModal();
      openJudgeWithProblem(sub.problem_id);
      setTimeout(() => {
        switchJudgeLang(detectedLang);
        const codeEditor = document.getElementById('judge-code-editor');
        if (codeEditor) {
          codeEditor.value = cleanCode;
          saveCurrentJudgeCodeToLocal();
        }
      }, 150);
    }

    // TẢI FILE CODE (.cpp, .py) VÀO KHUNG NỘP BÀI TẬP
    function handleSubmissionFileUpload(evt) {
      const file = evt.target.files && evt.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        const text = e.target.result;
        switchSubmitMode('essay');
        const essayInput = document.getElementById('submit-essay-input');
        if (essayInput) {
          essayInput.value = text;
          const charEl = document.getElementById('submit-essay-char-count');
          if (charEl) charEl.textContent = `${text.length} ký tự`;
          showLiveToast(`📁 Đã tải nội dung file "${file.name}" vào khung bài làm!`);
        }
      };
      reader.onerror = function() {
        alert("Không thể đọc file đã chọn. Vui lòng thử lại!");
      };
      reader.readAsText(file);
    }

    // LÀM MỚI BÀI NỘP TỪ FIREBASE ĐÁM MÂY (CHỐNG LỆCH DỮ LIỆU)
    async function refreshSubmissionsFromCloud() {
      const btn = document.getElementById('btn-refresh-subs');
      const icon = document.getElementById('refresh-subs-icon');
      if (btn) btn.disabled = true;
      if (icon) icon.classList.add('animate-spin');

      try {
        if (typeof fetchSubmissionsFromFirebase === 'function' && isFirebaseConfigured()) {
          showLiveToast('🔄 Đang đồng bộ danh sách bài nộp từ Firebase Realtime Database...', 'info');
          const fbSubs = await fetchSubmissionsFromFirebase();
          if (fbSubs && fbSubs.length > 0) {
            if (!appData) appData = {};
            appData.submissions = typeof mergeSubmissionCollections === 'function'
              ? mergeSubmissionCollections(appData.submissions || [], fbSubs)
              : fbSubs;
            if (typeof archiveSubmissionsLocally === 'function') {
              await archiveSubmissionsLocally(appData.submissions, { silent: true });
            }
            try { localStorage.setItem('cp_cached_submissions', JSON.stringify(appData.submissions)); } catch(e) {}
            if (typeof reconcileStudentSolvedState === 'function') {
              reconcileStudentSolvedState();
            }
            showLiveToast(`✅ Đã tải về ${fbSubs.length} bài nộp mới nhất từ đám mây!`);
          } else {
            showLiveToast('Đã kiểm tra: Chưa có thêm bài nộp mới trên Firebase.');
          }
        } else {
          showLiveToast('Firebase chưa được cấu hình. Đang tải từ cache...');
        }
        renderGlobalSubmissions();
        if (document.getElementById('modal-submissions-manager') && !document.getElementById('modal-submissions-manager').classList.contains('hidden')) {
          renderSubmissionsManagerList();
        }
      } catch (err) {
        console.error("Lỗi khi làm mới bài nộp:", err);
        showLiveToast('⚠️ Không thể kết nối tới Firebase: ' + err.message, 'warning');
      } finally {
        if (btn) btn.disabled = false;
        if (icon) icon.classList.remove('animate-spin');
      }
    }

    // ============================================================
    // 14. CHẤM ĐIỂM & NHẬN XÉT (GRADING)
    // ============================================================
    function openGradeModal(subId) {
      const isAdmin = Boolean(currentAuth && (currentAuth.role === 'admin' || currentAuth.role === 'teacher'));
      if (!isAdmin) {
        alert("Chỉ Quản trị viên / Giáo viên mới có quyền chấm điểm bài nộp!");
        return;
      }
      if (!appData || !appData.submissions) return;
      const sub = appData.submissions.find(s => s.id === subId);
      if (!sub) {
        alert("Không tìm thấy bài nộp có mã này!");
        return;
      }
      currentGradeSubId = subId;

      document.getElementById('grade-sub-id').value = sub.id;
      document.getElementById('grade-modal-sub').textContent = `Mã bài nộp: ${sub.id}`;
      document.getElementById('grade-sub-student').textContent = sub.student_name;
      document.getElementById('grade-sub-class').textContent = sub.class_name || 'Lớp học';
      document.getElementById('grade-sub-problem').textContent = `${sub.problem_id} - ${sub.problem_name || ''}`;
      document.getElementById('grade-sub-time').textContent = sub.submitted_at || '--';

      const typeBadge = document.getElementById('grade-sub-type-badge');
      if (typeBadge) {
        const isEssay = (sub.type === 'essay' || sub.submission_type_display === 'Tự luận' || sub.submission_type_display === 'Code DeruckOJ');
        typeBadge.textContent = isEssay ? '✍️ Tự luận' : '🔢 Điền đáp án';
        typeBadge.className = isEssay ? "px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30" : "px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30";
      }

      document.getElementById('grade-sub-answer-content').textContent = sub.answer || '(Trống)';
      document.getElementById('grade-form-status').value = sub.status || 'Chấm đạt';
      document.getElementById('grade-form-score').value = (sub.score !== undefined && sub.score !== '') ? sub.score : '10';
      document.getElementById('grade-form-feedback').value = sub.feedback || '';

      const modal = document.getElementById('modal-grade-submission');
      if (modal) modal.classList.remove('hidden');
    }

    function closeGradeModal() {
      const modal = document.getElementById('modal-grade-submission');
      if (modal) modal.classList.add('hidden');
      currentGradeSubId = null;
    }

    function setQuickGrade(score, status, feedback) {
      const scoreInput = document.getElementById('grade-form-score');
      const statusSelect = document.getElementById('grade-form-status');
      const fbInput = document.getElementById('grade-form-feedback');
      if (scoreInput) scoreInput.value = score;
      if (statusSelect) statusSelect.value = status;
      if (fbInput && feedback) fbInput.value = feedback;
    }

    function appendFeedback(text) {
      const fbInput = document.getElementById('grade-form-feedback');
      if (!fbInput) return;
      if (fbInput.value.trim()) {
        fbInput.value += ' ' + text;
      } else {
        fbInput.value = text;
      }
      fbInput.focus();
    }

    async function saveGradeSubmission() {
      if (!currentGradeSubId || !appData || !appData.submissions) return;
      const sub = appData.submissions.find(s => s.id === currentGradeSubId);
      if (!sub) return;

      const newStatus = document.getElementById('grade-form-status')?.value || 'Chấm đạt';
      const newScore = document.getElementById('grade-form-score')?.value || '';
      const newFeedback = document.getElementById('grade-form-feedback')?.value.trim() || '';

      const btnSave = document.getElementById('btn-save-grade');
      if (btnSave) {
        btnSave.disabled = true;
        btnSave.innerHTML = '<span>⏳</span> Đang lưu...';
      }

      sub.status = newStatus;
      sub.score = newScore;
      sub.feedback = newFeedback;

      saveAppDataLocally();
      try { localStorage.setItem('cp_cached_submissions', JSON.stringify(appData.submissions)); } catch(e) {}

      // Cập nhật ngay lập tức lên Firebase Realtime Database để bảo tồn trạng thái vĩnh viễn
      if (typeof updateSubmissionInFirebase === 'function' && isFirebaseConfigured()) {
        try {
          await updateSubmissionInFirebase(sub.id, {
            status: newStatus,
            score: newScore,
            feedback: newFeedback
          });
        } catch(e) {
          console.warn("Could not update submission on Firebase:", e);
        }
      }

      // If status is 'Chấm đạt' or 'Hoàn thành', also mark student as solved if problem exists
      if (newStatus === 'Chấm đạt' || newStatus === 'Hoàn thành') {
        const student = (appData.students || []).find(s => s.name === sub.student_name || (sub.student_stt && s.stt == sub.student_stt) || (sub.student_id && s.stt == sub.student_id));
        if (student) {
          if (!student.solved) student.solved = [];
          if (!student.solved.includes(sub.problem_id)) {
            student.solved.push(sub.problem_id);
            saveAppDataLocally();
            if (typeof saveStudentsToFirebase === 'function' && isFirebaseConfigured()) {
              try {
                await saveStudentsToFirebase(appData.students);
              } catch(e) {}
            }
          }
        }
      }

      // Sync to Google Sheet 'Bài Nộp'
      await syncToGoogleSheets({
        action: 'grade_submission',
        id: sub.id,
        status: newStatus,
        score: newScore,
        feedback: newFeedback
      });

      showLiveToast(`💯 Đã chấm điểm và gửi nhận xét cho bài làm của ${sub.student_name}!`);
      if (btnSave) {
        btnSave.disabled = false;
        btnSave.innerHTML = '<span>💾</span> Lưu Điểm & Gửi Nhận Xét';
      }

      closeGradeModal();
      renderSubmissionsManagerList();
      renderProblems();
      renderMatrix();
    }
