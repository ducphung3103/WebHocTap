const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'docs', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// 1. UPDATE HERO BANNER & COURSES & FEATURES
const heroStartMarker = '<!-- HERO BANNER -->';
const instructorMarker = '<!-- INSTRUCTOR & CONTACT SECTION -->';

const heroStartIndex = html.indexOf(heroStartMarker);
const instructorIndex = html.indexOf(instructorMarker);

if (heroStartIndex === -1 || instructorIndex === -1) {
  console.error("Could not find hero or instructor markers in index.html");
  process.exit(1);
}

const newHeroAndCoursesHtml = `<!-- HERO BANNER -->
      <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950/90 via-slate-900 to-slate-950 border border-indigo-500/30 p-6 sm:p-8 md:p-10 shadow-2xl">
        <div class="absolute -right-20 -top-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -left-20 -bottom-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div class="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <!-- Left Text & Actions -->
          <div class="lg:col-span-7 space-y-4">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shadow-sm">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>CỔNG LUYỆN LẬP TRÌNH THI ĐẤU CHUẨN DMOJ</span>
            </div>

            <h1 class="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Deruck's Competitive Programming
            </h1>

            <p class="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-xl">
              Hệ thống bồi dưỡng thuật toán, cấu trúc dữ liệu và luyện thi HSG, Chuyên Tin & Olympic. Chấm bài tự động đa máy chủ với chuẩn đặc tả bài tập DMOJ.
            </p>

            <!-- Quick Action: 1 Primary Button -->
            <div class="flex flex-wrap items-center gap-3 pt-2">
              <button onclick="showAuthModal()" class="px-6 py-3 rounded-2xl text-xs sm:text-sm font-extrabold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition shadow-xl shadow-indigo-600/30 flex items-center gap-2.5 cursor-pointer active:scale-95">
                <span>🔑</span>
                <span>Vào Học Bằng Mã PIN</span>
                <span>→</span>
              </button>
              <button onclick="document.getElementById('courses-section')?.scrollIntoView({behavior: 'smooth'})" class="px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition flex items-center gap-1.5 cursor-pointer">
                <span>🎯</span>
                <span>Khám phá 4 Lộ Trình</span>
              </button>
            </div>

            <!-- 4 Visual Compact Metrics -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4">
              <div class="bg-slate-900/80 border border-indigo-500/20 rounded-xl p-2.5 text-center">
                <div class="text-base sm:text-lg font-black text-indigo-400">47+</div>
                <div class="text-[11px] text-slate-400 font-medium">Bài tập DMOJ</div>
              </div>
              <div class="bg-slate-900/80 border border-emerald-500/20 rounded-xl p-2.5 text-center">
                <div class="text-base sm:text-lg font-black text-emerald-400">100%</div>
                <div class="text-[11px] text-slate-400 font-medium">Chấm tự động</div>
              </div>
              <div class="bg-slate-900/80 border border-blue-500/20 rounded-xl p-2.5 text-center">
                <div class="text-base sm:text-lg font-black text-blue-400">4</div>
                <div class="text-[11px] text-slate-400 font-medium">Lớp trọng điểm</div>
              </div>
              <div class="bg-slate-900/80 border border-purple-500/20 rounded-xl p-2.5 text-center">
                <div class="text-base sm:text-lg font-black text-purple-400">365d</div>
                <div class="text-[11px] text-slate-400 font-medium">Heatmap theo dõi</div>
              </div>
            </div>
          </div>

          <!-- Right: Visual Competitive Programming Illustration -->
          <div class="lg:col-span-5 flex justify-center">
            <div class="relative w-full max-w-sm">
              <div class="rounded-2xl bg-slate-950/90 border border-indigo-500/30 p-4 shadow-2xl backdrop-blur space-y-3">
                <!-- Window Header -->
                <div class="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div class="flex items-center gap-1.5">
                    <span class="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
                    <span class="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
                  </div>
                  <span class="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                    <span>⚡</span> deruck_judge.cpp
                  </span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    AC 100%
                  </span>
                </div>

                <!-- Code Mockup -->
                <div class="font-mono text-[11px] space-y-1 text-slate-300 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                  <div><span class="text-purple-400">#include</span> <span class="text-emerald-300">&lt;bits/stdc++.h&gt;</span></div>
                  <div><span class="text-blue-400">using namespace</span> std;</div>
                  <div class="text-slate-500">// DMOJ Fast I/O &amp; Segment Tree</div>
                  <div><span class="text-cyan-400">int</span> <span class="text-amber-300">main</span>() {</div>
                  <div class="pl-3 text-slate-400">cin.tie(<span class="text-indigo-300">0</span>)-&gt;sync_with_stdio(<span class="text-rose-300">false</span>);</div>
                  <div class="pl-3 text-emerald-400">cout &lt;&lt; <span class="text-amber-200">"ACCEPTED"</span> &lt;&lt; <span class="text-amber-200">'\n'</span>;</div>
                  <div>}</div>
                </div>

                <!-- Live Testcases Visual Bar -->
                <div class="grid grid-cols-4 gap-1.5 pt-1">
                  <div class="bg-emerald-500/15 border border-emerald-500/30 rounded-lg p-1.5 text-center">
                    <div class="text-[10px] text-emerald-400 font-bold">#1 AC</div>
                    <div class="text-[9px] text-slate-500 font-mono">0.02s</div>
                  </div>
                  <div class="bg-emerald-500/15 border border-emerald-500/30 rounded-lg p-1.5 text-center">
                    <div class="text-[10px] text-emerald-400 font-bold">#2 AC</div>
                    <div class="text-[9px] text-slate-500 font-mono">0.03s</div>
                  </div>
                  <div class="bg-emerald-500/15 border border-emerald-500/30 rounded-lg p-1.5 text-center">
                    <div class="text-[10px] text-emerald-400 font-bold">#3 AC</div>
                    <div class="text-[9px] text-slate-500 font-mono">0.05s</div>
                  </div>
                  <div class="bg-emerald-500/15 border border-emerald-500/30 rounded-lg p-1.5 text-center">
                    <div class="text-[10px] text-emerald-400 font-bold">#4 AC</div>
                    <div class="text-[9px] text-slate-500 font-mono">0.04s</div>
                  </div>
                </div>

                <!-- Language Tags -->
                <div class="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                  <span class="flex items-center gap-1"><span>🌐</span> Sàn: Codeforces, DMOJ, Marisa</span>
                  <span class="font-bold text-indigo-300">⚡ C++20 • Python 3</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- SECURITY NOTICE CALLOUT -->
      <div class="rounded-2xl bg-slate-900/90 border border-amber-500/30 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-lg shrink-0 text-amber-300">
            🔒
          </div>
          <div>
            <h3 class="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
              Khu Vực Nội Bộ Dành Cho Học Viên &amp; Phụ Huynh
              <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">Bảo mật</span>
            </h3>
            <p class="text-[11px] text-slate-400">Bảng xếp hạng, bài tập về nhà và bài giải được bảo vệ an toàn bằng Mã PIN.</p>
          </div>
        </div>
        <button onclick="showAuthModal()" class="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 transition shrink-0 self-start sm:self-auto cursor-pointer">
          Đăng Nhập Ngay →
        </button>
      </div>

      <!-- COURSES SECTION: VISUAL CARDS & 1 ACTION BUTTON -->
      <div id="courses-section" class="space-y-4 pt-2">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold text-white flex items-center gap-2">
              <span>🎯</span> 4 Chương Trình Đào Tạo Trọng Điểm
            </h2>
            <p class="text-xs text-slate-400">Lộ trình bài bản từ nền tảng đến chuyên sâu bám sát đề thi HSG &amp; Olympic</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Class C++ Nâng Cao -->
          <div class="group rounded-2xl bg-slate-900 border border-blue-500/30 overflow-hidden hover:border-blue-500/60 transition shadow-lg flex flex-col justify-between">
            <!-- Visual SVG Banner -->
            <div class="h-28 bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 p-4 relative flex items-center justify-between border-b border-blue-500/20 overflow-hidden">
              <div class="relative z-10 space-y-1">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/25 text-blue-300 border border-blue-500/40 uppercase">Nâng Cao</span>
                <div class="text-sm font-black text-white">C++ Nâng Cao</div>
                <div class="text-[10px] text-blue-300/80">Competitive &amp; HSG</div>
              </div>
              <div class="w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-2xl shadow-inner text-blue-300 group-hover:scale-110 transition">
                🏆
              </div>
            </div>
            <!-- Body -->
            <div class="p-4 space-y-3 flex-1 flex flex-col justify-between">
              <p class="text-xs text-slate-300 leading-relaxed">
                Segment Tree, Fenwick, DP quy hoạch động, Đồ thị (DSU, Dijkstra) &amp; Lý thuyết số chuyên sâu.
              </p>
              <div class="flex flex-wrap gap-1">
                <span class="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/20">Segment Tree</span>
                <span class="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/20">Graph</span>
                <span class="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/20">DP</span>
              </div>
              <button onclick="showAuthModal()" class="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition text-center shadow-lg shadow-blue-600/25 cursor-pointer mt-2">
                Vào Học Lớp C++ Nâng Cao →
              </button>
            </div>
          </div>

          <!-- Class C++ Cơ Bản -->
          <div class="group rounded-2xl bg-slate-900 border border-cyan-500/30 overflow-hidden hover:border-cyan-500/60 transition shadow-lg flex flex-col justify-between">
            <!-- Visual SVG Banner -->
            <div class="h-28 bg-gradient-to-br from-cyan-950 via-slate-900 to-slate-950 p-4 relative flex items-center justify-between border-b border-cyan-500/20 overflow-hidden">
              <div class="relative z-10 space-y-1">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 uppercase">Nền Tảng</span>
                <div class="text-sm font-black text-white">C++ Cơ Bản</div>
                <div class="text-[10px] text-cyan-300/80">Cú Pháp &amp; STL</div>
              </div>
              <div class="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-2xl shadow-inner text-cyan-300 group-hover:scale-110 transition">
                🚀
              </div>
            </div>
            <!-- Body -->
            <div class="p-4 space-y-3 flex-1 flex flex-col justify-between">
              <p class="text-xs text-slate-300 leading-relaxed">
                Cú pháp C++ chuẩn, cấu trúc dữ liệu STL (vector, map, set), kỹ thuật mảng xâu và tìm kiếm nhị phân.
              </p>
              <div class="flex flex-wrap gap-1">
                <span class="px-2 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">C++20</span>
                <span class="px-2 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">STL</span>
                <span class="px-2 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">Binary Search</span>
              </div>
              <button onclick="showAuthModal()" class="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 transition text-center shadow-lg shadow-cyan-600/25 cursor-pointer mt-2">
                Vào Học Lớp C++ Cơ Bản →
              </button>
            </div>
          </div>

          <!-- Class Python Cơ Bản -->
          <div class="group rounded-2xl bg-slate-900 border border-emerald-500/30 overflow-hidden hover:border-emerald-500/60 transition shadow-lg flex flex-col justify-between">
            <!-- Visual SVG Banner -->
            <div class="h-28 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 p-4 relative flex items-center justify-between border-b border-emerald-500/20 overflow-hidden">
              <div class="relative z-10 space-y-1">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 uppercase">Thuật Toán</span>
                <div class="text-sm font-black text-white">Python Cơ Bản</div>
                <div class="text-[10px] text-emerald-300/80">Tư Duy &amp; Tin Học Trẻ</div>
              </div>
              <div class="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-2xl shadow-inner text-emerald-300 group-hover:scale-110 transition">
                🐍
              </div>
            </div>
            <!-- Body -->
            <div class="p-4 space-y-3 flex-1 flex flex-col justify-between">
              <p class="text-xs text-slate-300 leading-relaxed">
                Tư duy thuật toán, đệ quy, vét cạn toàn bộ, thuật toán tham lam (Greedy) và kỹ thuật xử lý mảng/xâu.
              </p>
              <div class="flex flex-wrap gap-1">
                <span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">Python 3</span>
                <span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">Đệ Quy</span>
                <span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">Greedy</span>
              </div>
              <button onclick="showAuthModal()" class="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition text-center shadow-lg shadow-emerald-600/25 cursor-pointer mt-2">
                Vào Học Lớp Python Cơ Bản →
              </button>
            </div>
          </div>

          <!-- Class Python 1-1 -->
          <div class="group rounded-2xl bg-slate-900 border border-purple-500/30 overflow-hidden hover:border-purple-500/60 transition shadow-lg flex flex-col justify-between">
            <!-- Visual SVG Banner -->
            <div class="h-28 bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 p-4 relative flex items-center justify-between border-b border-purple-500/20 overflow-hidden">
              <div class="relative z-10 space-y-1">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/25 text-purple-300 border border-purple-500/40 uppercase">Cá Nhân Hóa</span>
                <div class="text-sm font-black text-white">Python Kèm 1-1</div>
                <div class="text-[10px] text-purple-300/80">Lộ Trình Tăng Tốc</div>
              </div>
              <div class="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-2xl shadow-inner text-purple-300 group-hover:scale-110 transition">
                🎯
              </div>
            </div>
            <!-- Body -->
            <div class="p-4 space-y-3 flex-1 flex flex-col justify-between">
              <p class="text-xs text-slate-300 leading-relaxed">
                Kèm riêng 1-1 bám sát mục tiêu thi học sinh giỏi, chuyển cấp Chuyên Tin và chuẩn hóa tư duy giải thuật.
              </p>
              <div class="flex flex-wrap gap-1">
                <span class="px-2 py-0.5 rounded text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/20">Kèm 1-1</span>
                <span class="px-2 py-0.5 rounded text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/20">Chuyên Tin</span>
                <span class="px-2 py-0.5 rounded text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/20">Sửa Code</span>
              </div>
              <button onclick="showAuthModal()" class="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 transition text-center shadow-lg shadow-purple-600/25 cursor-pointer mt-2">
                Vào Học Lớp Kèm 1-1 →
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- FEATURES & ECOSYSTEM (CLEAN & VISUAL) -->
      <div class="rounded-3xl bg-slate-900/60 border border-slate-800 p-6 sm:p-8 space-y-5">
        <div>
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <span>✨</span> Công Nghệ &amp; Tiện Ích Đào Tạo
          </h2>
          <p class="text-xs text-slate-400">Tự động hóa hoàn toàn quy trình luyện tập và chấm điểm</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2 hover:border-indigo-500/40 transition">
            <div class="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-xl text-indigo-400">🔄</div>
            <h4 class="text-sm font-bold text-white">Auto-Sync Đa Nền Tảng</h4>
            <p class="text-xs text-slate-400 leading-relaxed">
              Tự động đồng bộ bài giải từ Codeforces, MarisaOJ, VNOI, VJudge mỗi 5s.
            </p>
          </div>

          <div class="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2 hover:border-emerald-500/40 transition">
            <div class="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-xl text-emerald-400">📈</div>
            <h4 class="text-sm font-bold text-white">Heatmap Hoạt Động</h4>
            <p class="text-xs text-slate-400 leading-relaxed">
              Biểu đồ trực quan hóa số lượng bài nộp 365 ngày rèn thói quen code bền bỉ.
            </p>
          </div>

          <div class="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2 hover:border-amber-500/40 transition">
            <div class="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-xl text-amber-400">🛡️</div>
            <h4 class="text-sm font-bold text-white">Bảo Mật Quyền Riêng Tư</h4>
            <p class="text-xs text-slate-400 leading-relaxed">
              Mã PIN bảo mật, giữ trọn vẹn lịch sử nộp bài và chỉ Admin mới xem được code.
            </p>
          </div>

          <div class="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2 hover:border-purple-500/40 transition">
            <div class="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-xl text-purple-400">⚔️</div>
            <h4 class="text-sm font-bold text-white">Contest Rating ELO</h4>
            <p class="text-xs text-slate-400 leading-relaxed">
              Thi đấu trực tiếp tính điểm Rating thực chiến, rèn bản lĩnh làm bài thi thật.
            </p>
          </div>
        </div>
      </div>
      
      `;

html = html.slice(0, heroStartIndex) + newHeroAndCoursesHtml + html.slice(instructorIndex);

// 2. UPDATE PROBLEM CATALOG HEADER & FILTERS (Lines ~700 to 772)
const probListStartMarker = '<div id="problems-view-list" class="space-y-4">';
const probGridMarker = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="problems-grid">';

const probListStartIndex = html.indexOf(probListStartMarker);
const probGridIndex = html.indexOf(probGridMarker);

if (probListStartIndex === -1 || probGridIndex === -1) {
  console.error("Could not find problems-view-list or problems-grid in index.html");
  process.exit(1);
}

const newFiltersHtml = `<div id="problems-view-list" class="space-y-4">
        <!-- Compact DMOJ Filter Bar -->
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl shadow-lg">
          <!-- Class Selector Pills -->
          <div class="flex items-center gap-1.5 flex-wrap text-xs" id="prob-class-filter-container">
            <span class="text-slate-400 font-bold mr-1 flex items-center gap-1"><span>👥</span> Lớp:</span>
            <button onclick="filterProblemClass('all')" id="prob-class-filter-all" class="prob-class-btn px-3 py-1.5 rounded-xl bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/40 transition cursor-pointer">Tất cả bài</button>
            <button onclick="filterProblemClass('Public')" id="prob-class-filter-Public" class="prob-class-btn px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition cursor-pointer">🌐 Public</button>
            <button onclick="filterProblemClass('C++ nâng cao')" id="prob-class-filter-cppnc" class="prob-class-btn px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-blue-300 hover:bg-slate-800 transition cursor-pointer">🟦 C++ nâng cao</button>
            <button onclick="filterProblemClass('C++ cơ bản')" id="prob-class-filter-cppcb" class="prob-class-btn px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition cursor-pointer">🔷 C++ cơ bản</button>
            <button onclick="filterProblemClass('Python cơ bản')" id="prob-class-filter-pythoncb" class="prob-class-btn px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition cursor-pointer">🟩 Python cơ bản</button>
            <button onclick="filterProblemClass('Python 1-1')" id="prob-class-filter-python11" class="prob-class-btn px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-purple-300 hover:bg-slate-800 transition cursor-pointer">🟪 Python 1-1</button>
          </div>

          <!-- Problem Search Bar -->
          <div class="relative w-full lg:w-72">
            <input type="text" id="prob-search-input" onkeyup="onProblemSearchChange()" placeholder="Tìm tên bài, mã DMOJ, dạng bài..."
              class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
            <span class="absolute right-3 top-2.5 text-slate-500 text-xs">🔍</span>
          </div>
        </div>

        <!-- Platform Chips with Visual Brand Badges & Count -->
        <div class="flex items-center justify-between gap-2 flex-wrap bg-slate-950/60 border border-slate-800/80 p-2.5 rounded-2xl">
          <div class="flex items-center gap-1.5 flex-wrap text-xs">
            <span class="text-slate-400 font-bold mr-1 text-[11px] hidden sm:inline">Nền tảng:</span>
            <button onclick="filterProblemPlatform('all')" id="prob-filter-all" class="px-3 py-1 rounded-lg bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/40 transition cursor-pointer">Tất cả</button>
            <button onclick="filterProblemPlatform('DeruckOJ')" id="prob-filter-DeruckOJ" class="px-2.5 py-1 rounded-lg text-emerald-400 hover:bg-emerald-500/10 font-bold border border-transparent transition cursor-pointer flex items-center gap-1">
              <span>⚡</span> DeruckOJ
            </button>
            <button onclick="filterProblemPlatform('Codeforces')" id="prob-filter-Codeforces" class="px-2.5 py-1 rounded-lg text-slate-400 hover:text-blue-300 transition cursor-pointer flex items-center gap-1">
              <span>🔵</span> Codeforces
            </button>
            <button onclick="filterProblemPlatform('MarisaOJ')" id="prob-filter-MarisaOJ" class="px-2.5 py-1 rounded-lg text-slate-400 hover:text-purple-300 transition cursor-pointer flex items-center gap-1">
              <span>🟣</span> MarisaOJ
            </button>
            <button onclick="filterProblemPlatform('VJudge')" id="prob-filter-VJudge" class="px-2.5 py-1 rounded-lg text-slate-400 hover:text-emerald-300 transition cursor-pointer flex items-center gap-1">
              <span>🟢</span> VJudge
            </button>
            <button onclick="filterProblemPlatform('ChuyenTinPro')" id="prob-filter-ChuyenTinPro" class="px-2.5 py-1 rounded-lg text-slate-400 hover:text-teal-300 transition cursor-pointer flex items-center gap-1">
              <span>🌐</span> Chuyên Tin
            </button>
            <button onclick="filterProblemPlatform('ClueOJ')" id="prob-filter-ClueOJ" class="px-2.5 py-1 rounded-lg text-slate-400 hover:text-cyan-300 transition cursor-pointer flex items-center gap-1">
              <span>🧩</span> ClueOJ
            </button>
          </div>
          <div id="prob-count-badge" class="text-xs text-slate-400 font-mono font-medium px-2 py-0.5"></div>
        </div>

        `;

html = html.slice(0, probListStartIndex) + newFiltersHtml + html.slice(probGridIndex);

// 3. UPDATE DMOJ WORKSPACE (problems-view-judge)
const judgeViewStartMarker = '<div id="problems-view-judge" class="space-y-6 hidden">';
const curriculumMarker = '<!-- TAB 4: BÀI GIẢNG & LÝ THUYẾT (LMS) -->';

const judgeViewStartIndex = html.indexOf(judgeViewStartMarker);
const curriculumIndex = html.indexOf(curriculumMarker);

if (judgeViewStartIndex === -1 || curriculumIndex === -1) {
  console.error("Could not find problems-view-judge or curriculum marker in index.html");
  process.exit(1);
}

const newJudgeWorkspaceHtml = `<div id="problems-view-judge" class="space-y-5 hidden">
        <!-- Top Toolbar: Return & Server Engine -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl shadow-lg">
          <button onclick="toggleProblemViewMode('list')" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition flex items-center gap-2 cursor-pointer w-fit shadow">
            <span>←</span> Quay lại danh sách bài tập
          </button>
          
          <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <span class="text-xs text-slate-400 font-medium hidden sm:inline">Máy chủ chấm:</span>
            <select id="judge-server-select" onchange="handleJudgeServerChange(this.value)" class="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-2.5 py-1.5 font-mono cursor-pointer focus:ring-1 focus:ring-indigo-500 outline-none">
              <option value="auto">🔄 Luân Phiên (Tự động tải)</option>
              <option value="judge0">🚀 26TinyLove Judge0</option>
              <option value="wandbox">🌐 Wandbox API</option>
              <option value="local" id="opt-local-judge" class="hidden">⚡ Local Judge (127.0.0.1)</option>
            </select>
            <div id="judge-engine-pill" title="Hệ thống tự động phân bổ tải luân phiên giữa các máy chủ chấm (26TinyLove, Wandbox, Local)" class="px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-2 shadow-inner cursor-help">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span id="judge-engine-text">Luân Phiên</span>
            </div>
          </div>
        </div>

        <!-- Problem Selector Carousel with Points -->
        <div class="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl space-y-2">
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-400 font-bold flex items-center gap-1.5">
              <span>⭐</span> Danh sách bài tập chấm trực tiếp (DMOJ):
            </span>
            <span class="text-slate-500 font-mono" id="judge-problems-count">47 bài DMOJ</span>
          </div>
          <div class="flex items-center gap-2 overflow-x-auto pb-1" id="judge-problem-selector">
            <!-- Populated dynamically with problem pills -->
          </div>
        </div>

        <!-- DMOJ TABS NAVIGATION BAR -->
        <div class="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
          <div class="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold shadow-inner">
            <button type="button" onclick="switchDmojTab('problem')" id="dmoj-tab-problem" class="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold transition flex items-center gap-1.5 shadow">
              <span>📄</span> Đề Bài (Problem)
            </button>
            <button type="button" onclick="switchDmojTab('submit')" id="dmoj-tab-submit" class="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition flex items-center gap-1.5">
              <span>💻</span> Nộp Bài &amp; Chấm
            </button>
            <button type="button" onclick="switchDmojTab('history')" id="dmoj-tab-history" class="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition flex items-center gap-1.5">
              <span>📜</span> Lịch Sử Nộp
            </button>
          </div>

          <div class="flex items-center gap-2">
            <button type="button" onclick="toggleDmojSplitView()" id="dmoj-btn-split" class="hidden lg:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition cursor-pointer" title="Bật/Tắt chế độ xem song song Đề bài và Code">
              <span>🔀</span> <span id="dmoj-split-text">Xem Song Song (IDE)</span>
            </button>
          </div>
        </div>

        <!-- WORKSPACE CONTAINERS -->
        <div id="dmoj-workspace-grid" class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          <!-- TAB 1: DMOJ PROBLEM SPECIFICATION -->
          <div id="dmoj-col-problem" class="lg:col-span-12 space-y-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <!-- Problem Header & Meta -->
            <div class="space-y-3 border-b border-slate-800 pb-5">
              <div class="flex items-center justify-between gap-3 flex-wrap">
                <div class="flex items-center gap-2 flex-wrap">
                  <span id="judge-prob-id" class="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">CPP-EX-01</span>
                  <span id="judge-prob-points-badge" class="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">★ 10 Điểm</span>
                  <span id="judge-prob-status-badge" class="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">Chưa nộp</span>
                </div>
                <div class="flex items-center gap-2 flex-wrap text-xs font-mono">
                  <span id="judge-prob-time" class="text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">⏱️ 1.0s</span>
                  <span id="judge-prob-mem" class="text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-lg">💾 256MB</span>
                  <span id="judge-prob-author" class="text-slate-400 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg">👤 DMOJ / Thầy Đức</span>
                </div>
              </div>

              <h2 id="judge-prob-name" class="text-xl sm:text-2xl font-black text-white tracking-tight">Tính tổng hai số nguyên A + B</h2>

              <!-- Types / Categories Badges -->
              <div class="flex items-center gap-2 flex-wrap" id="judge-prob-types-container">
                <span class="text-xs text-slate-400">Dạng bài:</span>
                <span class="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">Cơ bản</span>
              </div>
            </div>

            <!-- DMOJ Specification Sections -->
            <div class="space-y-5 text-xs sm:text-sm text-slate-300 leading-relaxed">
              <!-- 1. Statement -->
              <div class="space-y-1.5">
                <h3 class="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <span>📖</span> Đề Bài (Problem Statement):
                </h3>
                <div id="judge-prob-desc" class="text-slate-200 whitespace-pre-line bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 leading-relaxed font-sans text-sm"></div>
              </div>

              <!-- 2. Input Spec -->
              <div class="space-y-1.5">
                <h3 class="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  <span>📥</span> Quy Cách Đầu Vào (Input Specification):
                </h3>
                <div id="judge-prob-input" class="text-slate-300 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 font-mono text-xs leading-relaxed"></div>
              </div>

              <!-- 3. Output Spec -->
              <div class="space-y-1.5">
                <h3 class="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <span>📤</span> Quy Cách Đầu Ra (Output Specification):
                </h3>
                <div id="judge-prob-output" class="text-slate-300 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 font-mono text-xs leading-relaxed"></div>
              </div>

              <!-- 4. Constraints -->
              <div class="space-y-1.5" id="judge-constraints-wrapper">
                <h3 class="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <span>⚖️</span> Ràng Buộc &amp; Giới Hạn (Constraints):
                </h3>
                <div id="judge-prob-constraints" class="text-amber-200/90 bg-amber-950/20 border border-amber-500/25 p-3 rounded-xl font-mono text-xs leading-relaxed"></div>
              </div>

              <!-- 5. Sample Cases -->
              <div class="space-y-3 pt-2 border-t border-slate-800">
                <h3 class="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center justify-between">
                  <span>🧪 Ví Dụ Mẫu (Sample Cases):</span>
                  <span class="text-[10px] text-slate-500 font-normal">Bấm "Copy" để sao chép test</span>
                </h3>
                <div id="judge-sample-tests-container" class="space-y-4">
                  <!-- Populated dynamically with DMOJ samples -->
                </div>
              </div>
            </div>

            <!-- Big Action Banner to jump to Code Editor -->
            <div class="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="text-xs text-slate-400">
                Đã hiểu yêu cầu bài toán? Bấm nút để viết code và chấm điểm ngay.
              </div>
              <button type="button" onclick="switchDmojTab('submit')" class="px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition shadow-lg shadow-emerald-600/25 flex items-center gap-2 cursor-pointer active:scale-95">
                <span>💻</span> Viết Code &amp; Nộp Bài →
              </button>
            </div>

            <!-- Teacher Quick Box -->
            <div id="judge-teacher-quickbox" class="hidden bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-3 text-xs space-y-1">
              <div class="font-bold text-indigo-300 flex items-center justify-between">
                <span>👑 Quyền Giảng Viên:</span>
                <button onclick="openEditTestcasesForCurrentProblem()" class="underline hover:text-white cursor-pointer">Sửa bộ test bài này ↗</button>
              </div>
              <p class="text-[11px] text-slate-400">Thầy có thể cập nhật testcase hoặc xem trực tiếp lời giải chuẩn.</p>
            </div>
          </div>

          <!-- TAB 2: CODE EDITOR & LIVE GRADER -->
          <div id="dmoj-col-submit" class="lg:col-span-12 space-y-5 hidden">
            <!-- Code Editor Card -->
            <div class="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col">
              <!-- Editor Toolbar -->
              <div class="bg-slate-950 px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center flex-wrap gap-2.5">
                  <span class="text-xs font-bold text-slate-400">Ngôn ngữ:</span>
                  <div class="inline-flex rounded-xl bg-slate-900 p-1 border border-slate-800 gap-1 shadow-inner">
                    <button type="button" id="btn-lang-cpp" onclick="setJudgeLanguage('cpp')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer bg-blue-600 text-white shadow-md shadow-blue-500/25 border border-blue-400/40">
                      <span>🟦</span> C++20
                    </button>
                    <button type="button" id="btn-lang-python" onclick="setJudgeLanguage('python')" class="px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer bg-slate-900 text-slate-400 hover:text-slate-200 border border-transparent">
                      <span>🐍</span> Python 3
                    </button>
                  </div>
                  <span id="judge-lang-info" class="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                    g++ 13 / C++20 (O2)
                  </span>
                </div>

                <div class="flex items-center gap-2">
                  <button type="button" onclick="clearJudgeCode()" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-300 border border-slate-700 transition flex items-center gap-1 cursor-pointer" title="Xóa trắng để tự viết code">
                    <span>🗑️</span> Xóa trắng
                  </button>
                </div>
              </div>

              <!-- Code Textarea -->
              <div class="relative bg-slate-950 flex font-mono text-xs sm:text-sm">
                <textarea 
                  id="judge-code-editor" 
                  rows="16" 
                  spellcheck="false" 
                  placeholder="// Viết code C++ hoặc Python tại đây..."
                  class="w-full bg-slate-950 text-slate-100 font-mono text-xs sm:text-sm leading-relaxed p-4 resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500/50 selection:bg-indigo-600/40 tab-size-4"
                ></textarea>
              </div>

              <!-- Input & Output Section (Run Test) -->
              <div class="border-t border-slate-800 bg-slate-950/90 p-4 space-y-3">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <!-- Input Box -->
                  <div class="space-y-1.5 flex flex-col">
                    <div class="flex items-center justify-between text-xs font-bold text-slate-400">
                      <span class="flex items-center gap-1.5 text-indigo-300">
                        <span>⌨️</span> Dữ liệu vào (Input test):
                      </span>
                      <button type="button" onclick="resetInputToSample()" class="text-[11px] text-slate-400 hover:text-indigo-300 font-normal cursor-pointer transition">Lấy test ví dụ</button>
                    </div>
                    <textarea 
                      id="judge-custom-input" 
                      rows="3" 
                      placeholder="Nhập dữ liệu đầu vào..."
                      class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500 resize-y"
                    ></textarea>
                  </div>

                  <!-- Output Box -->
                  <div class="space-y-1.5 flex flex-col">
                    <div class="flex items-center justify-between text-xs font-bold text-slate-400">
                      <span class="flex items-center gap-1.5 text-emerald-400">
                        <span>🖥️</span> Kết quả xuất (Output test):
                      </span>
                      <span id="judge-custom-run-meta" class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        Chưa chạy
                      </span>
                    </div>
                    <div class="relative flex-1 min-h-[76px]">
                      <pre id="judge-custom-run-stdout" class="w-full h-full min-h-[76px] bg-slate-900 border border-slate-700 rounded-xl p-2.5 font-mono text-xs text-slate-400 whitespace-pre-wrap overflow-y-auto max-h-36 selection:bg-emerald-600/30">Bấm "▶️ Chạy Thử" để xem kết quả xuất ra màn hình tại đây.</pre>
                    </div>
                  </div>
                </div>

                <!-- STDERR Warning/Error Box -->
                <div id="judge-custom-run-stderr-box" class="space-y-1 hidden">
                  <div class="text-[11px] text-rose-400 font-semibold flex items-center justify-between">
                    <span>Thông báo lỗi / cảnh báo (STDERR):</span>
                    <button type="button" onclick="document.getElementById('judge-custom-run-stderr-box').classList.add('hidden')" class="text-slate-500 hover:text-slate-300 text-[10px] cursor-pointer">✕ Đóng</button>
                  </div>
                  <pre id="judge-custom-run-stderr" class="bg-rose-950/40 border border-rose-500/30 p-2.5 rounded-xl text-rose-200 whitespace-pre-wrap max-h-32 overflow-y-auto font-mono text-xs"></pre>
                </div>
              </div>

              <!-- Actions Bar: Only 2 Buttons (Chạy Thử & Chấm Bài) -->
              <div class="bg-slate-950 px-4 py-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div class="text-xs text-slate-500 flex items-center gap-2">
                  <span id="judge-editor-status">Sẵn sàng chạy</span>
                </div>

                <div class="flex items-center gap-3">
                  <button type="button" onclick="runJudgeCode()" id="btn-judge-run" class="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition flex items-center gap-1.5 cursor-pointer active:scale-95">
                    <span>▶️</span> Chạy Thử (Sample)
                  </button>
                  <button type="button" onclick="submitJudgeAllTests()" id="btn-judge-submit" class="px-6 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/25 transition flex items-center gap-1.5 cursor-pointer active:scale-95" title="Nộp code và chấm bài tự động">
                    <span>🚀</span> Chấm Bài
                  </button>
                </div>
              </div>
            </div>

            <!-- Live Grading Result Console -->
            <div id="judge-console-card" class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div class="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <h4 class="text-sm font-bold text-white flex items-center gap-2">
                  <span>📊</span> Bảng Kết Quả Chấm Bài (Live Grader)
                </h4>
                <span id="judge-verdict-tag" class="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 border border-slate-700">
                  Chưa có kết quả
                </span>
              </div>

              <!-- Progress Bar while judging -->
              <div id="judge-progress-container" class="space-y-1.5 hidden">
                <div class="flex items-center justify-between text-xs font-mono">
                  <span id="judge-progress-text" class="text-indigo-400 font-semibold">Đang chấm...</span>
                  <span id="judge-progress-pct" class="text-slate-400">0%</span>
                </div>
                <div class="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div id="judge-progress-bar" class="bg-gradient-to-r from-indigo-500 to-emerald-400 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
                </div>
              </div>

              <!-- Overall Banner -->
              <div id="judge-verdict-banner" class="hidden rounded-xl p-4 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3">
                <!-- Dynamically populated verdict banner -->
              </div>

              <!-- Compiler Error Message -->
              <div id="judge-ce-box" class="hidden space-y-1">
                <div class="text-xs text-rose-400 font-bold">Lỗi biên dịch (Compile Error):</div>
                <pre id="judge-ce-text" class="bg-rose-950/40 border border-rose-500/30 p-3 rounded-xl text-rose-200 whitespace-pre-wrap max-h-48 overflow-y-auto font-mono text-xs"></pre>
              </div>

              <!-- Individual Test Case Badges Grid -->
              <div id="judge-tests-grid" class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                <!-- Populated per test -->
              </div>

              <!-- Test Detail Expansion Box -->
              <div id="judge-test-detail-box" class="hidden bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs space-y-2 font-mono">
                <!-- Populated when user clicks on a test -->
              </div>
            </div>
          </div>

          <!-- TAB 3: SUBMISSION HISTORY -->
          <div id="dmoj-col-history" class="lg:col-span-12 space-y-4 hidden">
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div class="flex items-center justify-between text-xs font-bold text-slate-400 border-b border-slate-800 pb-3">
                <span class="flex items-center gap-1.5 text-sm text-white"><span>📜</span> Lịch Sử Bài Nộp (DMOJ Submissions)</span>
                <button type="button" onclick="clearJudgeHistory()" class="text-slate-500 hover:text-rose-400 transition cursor-pointer">Xóa lịch sử cục bộ</button>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs text-slate-300">
                  <thead class="text-[11px] text-slate-500 uppercase border-b border-slate-800">
                    <tr>
                      <th class="py-2.5 px-3">Thời gian</th>
                      <th class="py-2.5 px-3">Mã bài</th>
                      <th class="py-2.5 px-3">Ngôn ngữ</th>
                      <th class="py-2.5 px-3">Kết quả</th>
                      <th class="py-2.5 px-3">Điểm số</th>
                      <th class="py-2.5 px-3 text-right">Xem lại</th>
                    </tr>
                  </thead>
                  <tbody id="judge-history-body" class="divide-y divide-slate-800/60 font-mono">
                    <tr><td colspan="6" class="py-4 text-center text-slate-500 italic">Chưa có bài nộp nào cho bài này.</td></tr>
                  </tbody>
                </table>
              </div>
              <p class="text-[11px] text-slate-500 italic">🔒 Quyền riêng tư: Chỉ Admin/Giáo viên mới có thể xem mã nguồn bài nộp của học sinh.</p>
            </div>
          </div>

        </div>
      </div>
    </section>

    `;

html = html.slice(0, judgeViewStartIndex) + newJudgeWorkspaceHtml + html.slice(curriculumIndex);

fs.writeFileSync(indexPath, html, 'utf8');
console.log("Successfully replaced Hero, Courses, Features, Filter Bar, and DMOJ Workspace HTML!");
