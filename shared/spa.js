/**
 * Kinetiq Academy - Unified Single Page Application (SPA) Engine
 * Manages view rendering, client-side routing, live API sync, and interaction telemetry.
 */

(function () {
  'use strict';

  // State Management
  const AppState = {
    currentRoute: 'practice-center',
    mode: 'learner', // 'learner' | 'instructor'
    user: null,
    courses: [],
    loading: false,
    quizState: {
      selectedOption: null,
      flagged: false,
      hintVisible: false,
      score: 88,
      streak: 7
    },
    chatMessages: [
      { sender: 'ai', text: 'Hello! I am your Kinetiq AI Learning Companion. Ask me about execution contexts, React Server Components, distributed cache invalidation, or system design trade-offs!' }
    ]
  };

  // Route labels and icons
  const ROUTES = {
    'practice-center': { title: 'Adaptive Practice Center', icon: 'terminal', group: 'learner' },
    'dashboard': { title: 'Student Dashboard', icon: 'grid_view', group: 'learner' },
    'my-learning': { title: 'My Enrolled Courses', icon: 'auto_stories', group: 'learner' },
    'courses-explorer': { title: 'Courses Explorer', icon: 'explore', group: 'learner' },
    'course-lms-player': { title: 'Course LMS Player', icon: 'play_circle', group: 'learner' },
    'ai-instructor-companion': { title: 'AI Learning Companion', icon: 'smart_toy', group: 'learner' },
    'live-classes': { title: 'Live Streaming Classroom', icon: 'videocam', group: 'learner' },
    'analytics': { title: 'Cognitive Analytics & Telemetry', icon: 'insights', group: 'learner' },
    'certificates': { title: 'Issued Certificates', icon: 'verified', group: 'learner' },
    'admin-dashboard': { title: 'Admin & Instructor Command Center', icon: 'dashboard_customize', group: 'instructor' },
    'course-management': { title: 'Course Management', icon: 'layers', group: 'instructor' },
    'curriculum-builder': { title: 'Curriculum Builder', icon: 'account_tree', group: 'instructor' },
    'lesson-cms': { title: 'Lesson Content CMS', icon: 'edit_note', group: 'instructor' },
    'live-class-admin': { title: 'Live Broadcast Admin', icon: 'podium', group: 'instructor' },
    'ai-class-generator': { title: 'AI Curriculum Generator', icon: 'psychology', group: 'instructor' },
    'quiz-builder': { title: 'Adaptive Quiz Builder', icon: 'fact_check', group: 'instructor' },
    'student-management': { title: 'Students Directory', icon: 'group', group: 'instructor' },
    'platform-analytics': { title: 'Cohort Retention Metrics', icon: 'bar_chart', group: 'instructor' },
    'admin-settings': { title: 'Portal Settings', icon: 'tune', group: 'instructor' },
    'settings': { title: 'Preferences & Settings', icon: 'settings', group: 'common' }
  };

  // Safe escape helper
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // View: Practice Center (Exact match to current UI)
  function renderPracticeCenter() {
    return `
      <div class="relative w-full overflow-hidden px-4 lg:px-8 py-6 animate-in fade-in duration-200">
        <!-- Subtle Ambient Glow Orbs -->
        <div class="absolute -top-32 right-12 w-96 h-96 rounded-full bg-primary/10 blur-3xl pointer-events-none"></div>
        <div class="absolute top-80 -left-20 w-80 h-80 rounded-full bg-secondary/5 blur-3xl pointer-events-none"></div>

        <!-- Practice Center Header & Daily Analytics Stats Grid -->
        <div class="relative z-10 flex flex-col gap-6">
          <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  <span class="material-symbols-outlined text-[14px]">bolt</span>
                  ACTIVE ADAPTIVE ENGINE v2.4
                </span>
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-xs">
                  <span class="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                  Live Synced
                </span>
              </div>
              <h1 class="text-3xl font-bold tracking-tight text-on-surface">Adaptive Practice Center</h1>
              <p class="text-sm text-on-surface-variant max-w-2xl">
                Sharpen your algorithmic thinking, system design reflexes, and framework mastery through real-time telemetry diagnostics.
              </p>
            </div>
            <!-- Quick Top Action Controls -->
            <div class="flex items-center gap-3">
              <button onclick="window.KinetiqSPA.showToast('Calibration: Telemetry adjusted to High Sensitivity')" class="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold transition-all flex items-center gap-2 shadow-sm" type="button">
                <span class="material-symbols-outlined text-[18px]">tune</span>
                Calibration Settings
              </button>
              <button onclick="window.KinetiqSPA.navigate('course-lms-player')" class="px-4 py-2 rounded-lg bg-primary hover:bg-primary-fixed-dim text-on-primary text-xs font-semibold transition-all flex items-center gap-2 shadow-md" type="button">
                <span class="material-symbols-outlined text-[18px]">play_arrow</span>
                Resume Queue
              </button>
            </div>
          </div>

          <!-- Quick Stats Row (Bento Surface) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- Metric 1: Daily Target -->
            <div class="p-4 rounded-xl bg-surface-container-low shadow-sm flex flex-col justify-between border border-outline-variant/10">
              <div class="flex items-center justify-between text-on-surface-variant">
                <span class="text-xs uppercase tracking-wider font-semibold">Daily Target</span>
                <span class="material-symbols-outlined text-[20px] text-primary">task_alt</span>
              </div>
              <div class="mt-3 flex items-baseline justify-between">
                <div>
                  <span class="text-3xl font-bold text-on-surface">24</span>
                  <span class="text-lg text-outline font-semibold">/ 30</span>
                </div>
                <span class="text-xs text-secondary font-semibold bg-secondary/10 px-2 py-0.5 rounded">80% goal</span>
              </div>
              <div class="mt-3 w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                <div class="bg-gradient-to-r from-primary to-secondary h-full rounded-full" style="width: 80%"></div>
              </div>
            </div>

            <!-- Metric 2: Rolling Accuracy -->
            <div class="p-4 rounded-xl bg-surface-container-low shadow-sm flex flex-col justify-between border border-outline-variant/10">
              <div class="flex items-center justify-between text-on-surface-variant">
                <span class="text-xs uppercase tracking-wider font-semibold">Rolling Accuracy</span>
                <span class="material-symbols-outlined text-[20px] text-secondary">trending_up</span>
              </div>
              <div class="mt-3 flex items-baseline justify-between">
                <span class="text-3xl font-bold text-on-surface">${AppState.quizState.score}<span class="text-secondary text-lg">%</span></span>
                <span class="text-xs text-secondary font-semibold flex items-center gap-0.5">
                  <span class="material-symbols-outlined text-[14px]">arrow_upward</span> +4.2% wk
                </span>
              </div>
              <div class="mt-3 flex items-center gap-1.5 text-on-surface-variant text-xs">
                <span class="w-2 h-2 rounded-full bg-secondary"></span> Top 8% of engineering cohort
              </div>
            </div>

            <!-- Metric 3: Current Streak -->
            <div class="p-4 rounded-xl bg-surface-container-low shadow-sm flex flex-col justify-between border border-outline-variant/10">
              <div class="flex items-center justify-between text-on-surface-variant">
                <span class="text-xs uppercase tracking-wider font-semibold">Practice Velocity</span>
                <span class="material-symbols-outlined text-[20px] text-tertiary">local_fire_department</span>
              </div>
              <div class="mt-3 flex items-baseline justify-between">
                <span class="text-3xl font-bold text-on-surface">${AppState.quizState.streak} <span class="text-lg text-outline font-semibold">Days</span></span>
                <span class="text-xs text-tertiary font-semibold bg-tertiary/10 px-2 py-0.5 rounded">2x XP Mult</span>
              </div>
              <div class="mt-3 flex items-center gap-1">
                <span class="w-3 h-3 rounded-full bg-tertiary"></span>
                <span class="w-3 h-3 rounded-full bg-tertiary"></span>
                <span class="w-3 h-3 rounded-full bg-tertiary"></span>
                <span class="w-3 h-3 rounded-full bg-tertiary"></span>
                <span class="w-3 h-3 rounded-full bg-tertiary"></span>
                <span class="w-3 h-3 rounded-full bg-tertiary"></span>
                <span class="w-3 h-3 rounded-full bg-tertiary animate-pulse"></span>
              </div>
            </div>

            <!-- Metric 4: Priority Focus Area -->
            <div class="p-4 rounded-xl bg-surface-container-low shadow-sm flex flex-col justify-between border border-outline-variant/10">
              <div class="flex items-center justify-between text-on-surface-variant">
                <span class="text-xs uppercase tracking-wider font-semibold">Priority Focus Area</span>
                <span class="material-symbols-outlined text-[20px] text-error">flag_circle</span>
              </div>
              <div class="mt-2">
                <span class="text-sm font-semibold text-error block truncate" title="React Hydration & SSR">React Hydration & SSR</span>
                <span class="text-xs text-outline mt-0.5 block">54% recall accuracy across 12 trials</span>
              </div>
              <div class="mt-3">
                <button onclick="window.KinetiqSPA.startRecoveryDrill()" class="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-fixed-dim transition-colors" type="button">
                  Launch Recovery Drill
                  <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Curated Training Modes -->
        <div class="mt-8">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-xl font-bold text-on-surface">Curated Training Modes</h2>
              <p class="text-xs text-on-surface-variant">Choose your intensity level for this sprint</p>
            </div>
            <span class="text-xs uppercase tracking-widest text-outline font-semibold">5 Active Formats</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <!-- Mode 1: Daily Challenge -->
            <div onclick="window.KinetiqSPA.selectMode('Daily Challenge')" class="group p-4 rounded-xl bg-surface-container-low hover:bg-surface-container transition-all cursor-pointer shadow-sm flex flex-col justify-between border border-outline-variant/15">
              <div class="space-y-2">
                <div class="w-10 h-10 rounded-lg bg-tertiary/15 text-tertiary flex items-center justify-center">
                  <span class="material-symbols-outlined text-[24px]">electric_bolt</span>
                </div>
                <div class="flex items-center justify-between pt-1">
                  <span class="font-semibold text-on-surface group-hover:text-primary transition-colors text-sm">Daily Challenge</span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-tertiary/15 text-tertiary">+150 XP</span>
                </div>
                <p class="text-xs text-on-surface-variant">5 rapid-fire questions to preserve streak momentum.</p>
              </div>
              <div class="mt-4 pt-3 flex items-center justify-between text-outline text-xs">
                <span>~4 mins</span>
                <span class="material-symbols-outlined text-[16px] text-primary">arrow_forward</span>
              </div>
            </div>

            <!-- Mode 2: Topic Deep-Dive -->
            <div onclick="window.KinetiqSPA.selectMode('Topic Deep-Dive')" class="group p-4 rounded-xl bg-surface-container-low hover:bg-surface-container transition-all cursor-pointer shadow-sm flex flex-col justify-between border border-outline-variant/15">
              <div class="space-y-2">
                <div class="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                  <span class="material-symbols-outlined text-[24px]">hub</span>
                </div>
                <div class="flex items-center justify-between pt-1">
                  <span class="font-semibold text-on-surface group-hover:text-primary transition-colors text-sm">Topic Deep-Dive</span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-container-high text-on-surface-variant">Modular</span>
                </div>
                <p class="text-xs text-on-surface-variant">Filter by React, Next.js, Python, TS & Docker.</p>
              </div>
              <div class="mt-4 pt-3 flex items-center justify-between text-outline text-xs">
                <span>Filter By Tag</span>
                <span class="material-symbols-outlined text-[16px] text-primary">tune</span>
              </div>
            </div>

            <!-- Mode 3: Timed Mock Exam -->
            <div onclick="window.KinetiqSPA.selectMode('Timed Mock Exam')" class="group p-4 rounded-xl bg-surface-container-low hover:bg-surface-container transition-all cursor-pointer shadow-sm flex flex-col justify-between border border-outline-variant/15">
              <div class="space-y-2">
                <div class="w-10 h-10 rounded-lg bg-secondary/15 text-secondary flex items-center justify-center">
                  <span class="material-symbols-outlined text-[24px]">timer</span>
                </div>
                <div class="flex items-center justify-between pt-1">
                  <span class="font-semibold text-on-surface group-hover:text-primary transition-colors text-sm">Timed Mock Exam</span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-secondary/15 text-secondary">Proctored</span>
                </div>
                <p class="text-xs text-on-surface-variant">Simulated 45-minute strict credential benchmark.</p>
              </div>
              <div class="mt-4 pt-3 flex items-center justify-between text-outline text-xs">
                <span>45 mins • 35 Qs</span>
                <span class="material-symbols-outlined text-[16px] text-primary">arrow_forward</span>
              </div>
            </div>

            <!-- Mode 4: AI Weak-Spot -->
            <div onclick="window.KinetiqSPA.selectMode('AI Weak-Spot')" class="group p-4 rounded-xl bg-surface-container-low hover:bg-surface-container transition-all cursor-pointer shadow-sm flex flex-col justify-between border border-primary/40 bg-primary/5">
              <div class="space-y-2">
                <div class="w-10 h-10 rounded-lg bg-primary-container/20 text-primary flex items-center justify-center">
                  <span class="material-symbols-outlined text-[24px]">psychology</span>
                </div>
                <div class="flex items-center justify-between pt-1">
                  <span class="font-semibold text-on-surface group-hover:text-primary transition-colors text-sm">AI Weak-Spot</span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-error/15 text-error">Telemetry</span>
                </div>
                <p class="text-xs text-on-surface-variant">Algorithmic remediation based on previous miss log.</p>
              </div>
              <div class="mt-4 pt-3 flex items-center justify-between text-outline text-xs">
                <span>Adaptive</span>
                <span class="material-symbols-outlined text-[16px] text-primary">auto_fix_high</span>
              </div>
            </div>

            <!-- Mode 5: Flashcards SR -->
            <div onclick="window.KinetiqSPA.selectMode('Flashcards SR')" class="group p-4 rounded-xl bg-surface-container-low hover:bg-surface-container transition-all cursor-pointer shadow-sm flex flex-col justify-between border border-outline-variant/15">
              <div class="space-y-2">
                <div class="w-10 h-10 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center">
                  <span class="material-symbols-outlined text-[24px]">style</span>
                </div>
                <div class="flex items-center justify-between pt-1">
                  <span class="font-semibold text-on-surface group-hover:text-primary transition-colors text-sm">Flashcards SR</span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-container text-outline">Anki Sync</span>
                </div>
                <p class="text-xs text-on-surface-variant">Active recall flashcard decks powered by Leitner box.</p>
              </div>
              <div class="mt-4 pt-3 flex items-center justify-between text-outline text-xs">
                <span>18 Due Today</span>
                <span class="material-symbols-outlined text-[16px] text-primary">replay</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Workspace Split: Interactive Sandbox & Cognitive Mastery Matrix -->
        <div class="mt-8 grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <!-- Left 8 Cols: Quiz Sandbox -->
          <div class="xl:col-span-8 flex flex-col gap-4">
            <div class="bg-surface-container-low rounded-2xl p-6 shadow-xl relative overflow-hidden border border-outline-variant/15">
              <!-- Context Strip -->
              <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-outline-variant/20">
                <div class="flex items-center gap-3">
                  <div class="px-3 py-1 rounded-md bg-surface-container text-primary text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[14px]">terminal</span>
                    JavaScript Execution Context & Closures
                  </div>
                  <span class="text-xs text-outline">Section 2.4</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="px-2.5 py-1 rounded-full bg-tertiary/15 text-tertiary text-xs font-semibold flex items-center gap-1">
                    <span class="material-symbols-outlined text-[14px]">signal_cellular_alt_2_bar</span>
                    Intermediate • 100 XP
                  </span>
                  <span class="px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant text-xs font-mono">
                    02:44 REMAINING
                  </span>
                </div>
              </div>

              <!-- Question Progress Bar -->
              <div class="w-full bg-surface-container-high rounded-full h-1 my-3 overflow-hidden">
                <div class="bg-primary h-full rounded-full transition-all duration-300" style="width: 40%"></div>
              </div>

              <!-- Question Header Controls -->
              <div class="mt-2 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-bold text-primary">QUESTION 04</span>
                  <span class="text-xs text-outline">OF 10</span>
                </div>
                <div class="flex items-center gap-2">
                  <button onclick="window.KinetiqSPA.toggleFlag()" class="flex items-center gap-1 px-2.5 py-1 rounded text-on-surface-variant hover:text-tertiary hover:bg-surface-container text-xs transition-colors" type="button">
                    <span class="material-symbols-outlined text-[16px] ${AppState.quizState.flagged ? 'text-tertiary' : ''}">flag</span>
                    <span id="flag-text">${AppState.quizState.flagged ? 'Flagged' : 'Flag Question'}</span>
                  </button>
                  <button onclick="window.KinetiqSPA.toggleHint()" class="flex items-center gap-1 px-2.5 py-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container text-xs transition-colors" type="button">
                    <span class="material-symbols-outlined text-[16px]">lightbulb</span>
                    AI Hint
                  </button>
                </div>
              </div>

              <!-- Hint Drawer -->
              <div id="hint-drawer" class="${AppState.quizState.hintVisible ? 'block' : 'hidden'} mt-3 p-3.5 rounded-lg bg-surface-container text-on-surface-variant text-xs flex items-start gap-2.5 border border-primary/20">
                <span class="material-symbols-outlined text-primary text-[18px]">psychology</span>
                <div>
                  <strong class="text-primary block mb-0.5">Telemetry Diagnostic Hint:</strong>
                  Remember that <code>var</code> declarations inside loops share a single mutable function/global scope binding, whereas <code>let</code> creates a fresh lexical environment per iteration closure.
                </div>
              </div>

              <!-- Question Text & Code Snippet -->
              <div class="mt-4 space-y-3">
                <h3 class="text-base font-semibold text-on-surface leading-snug">
                  What will be printed to stdout when the following script finishes executing its asynchronous microtask loop?
                </h3>
                <div class="rounded-xl bg-surface-container-lowest p-4 font-mono text-xs overflow-x-auto border border-outline-variant/30 text-on-surface">
                  <pre class="leading-relaxed"><code><span class="text-secondary">for</span> (<span class="text-tertiary">var</span> i = 0; i &lt; 3; i++) {
  setTimeout(() =&gt; console.log(<span class="text-primary">"val:"</span>, i), 0);
}
<span class="text-secondary">for</span> (<span class="text-tertiary">let</span> j = 0; j &lt; 3; j++) {
  setTimeout(() =&gt; console.log(<span class="text-primary">"lex:"</span>, j), 0);
}</code></pre>
                </div>
              </div>

              <!-- Answer Choices -->
              <div class="mt-6 space-y-3" id="quiz-options">
                <div onclick="window.KinetiqSPA.selectOption('A')" id="opt-A" class="quiz-option p-4 rounded-xl border border-outline-variant/30 hover:border-primary/60 bg-surface-container/60 hover:bg-surface-container transition-all cursor-pointer flex items-center justify-between group">
                  <div class="flex items-center gap-3">
                    <span class="w-7 h-7 rounded-lg bg-surface-container-high text-on-surface-variant text-xs font-bold flex items-center justify-center group-hover:text-primary transition-colors">A</span>
                    <span class="text-sm font-mono text-on-surface">val: 0, 1, 2 followed by lex: 0, 1, 2</span>
                  </div>
                  <span class="material-symbols-outlined text-[18px] text-outline group-hover:text-primary">radio_button_unchecked</span>
                </div>

                <div onclick="window.KinetiqSPA.selectOption('B')" id="opt-B" class="quiz-option p-4 rounded-xl border border-primary bg-primary/10 transition-all cursor-pointer flex items-center justify-between group">
                  <div class="flex items-center gap-3">
                    <span class="w-7 h-7 rounded-lg bg-primary text-on-primary text-xs font-bold flex items-center justify-center">B</span>
                    <span class="text-sm font-mono text-on-surface">val: 3, 3, 3 followed by lex: 0, 1, 2</span>
                  </div>
                  <span class="material-symbols-outlined text-[18px] text-primary">check_circle</span>
                </div>

                <div onclick="window.KinetiqSPA.selectOption('C')" id="opt-C" class="quiz-option p-4 rounded-xl border border-outline-variant/30 hover:border-primary/60 bg-surface-container/60 hover:bg-surface-container transition-all cursor-pointer flex items-center justify-between group">
                  <div class="flex items-center gap-3">
                    <span class="w-7 h-7 rounded-lg bg-surface-container-high text-on-surface-variant text-xs font-bold flex items-center justify-center group-hover:text-primary transition-colors">C</span>
                    <span class="text-sm font-mono text-on-surface">val: 3, 3, 3 followed by lex: 3, 3, 3</span>
                  </div>
                  <span class="material-symbols-outlined text-[18px] text-outline group-hover:text-primary">radio_button_unchecked</span>
                </div>

                <div onclick="window.KinetiqSPA.selectOption('D')" id="opt-D" class="quiz-option p-4 rounded-xl border border-outline-variant/30 hover:border-primary/60 bg-surface-container/60 hover:bg-surface-container transition-all cursor-pointer flex items-center justify-between group">
                  <div class="flex items-center gap-3">
                    <span class="w-7 h-7 rounded-lg bg-surface-container-high text-on-surface-variant text-xs font-bold flex items-center justify-center group-hover:text-primary transition-colors">D</span>
                    <span class="text-sm font-mono text-on-surface">ReferenceError: i is not defined in loop scope</span>
                  </div>
                  <span class="material-symbols-outlined text-[18px] text-outline group-hover:text-primary">radio_button_unchecked</span>
                </div>
              </div>

              <!-- Question Action Bar -->
              <div class="mt-6 pt-4 border-t border-outline-variant/20 flex items-center justify-between">
                <button onclick="window.KinetiqSPA.showToast('Skipped to next question')" class="px-4 py-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container text-xs font-semibold transition-colors" type="button">
                  Skip for Now
                </button>
                <div class="flex items-center gap-3">
                  <button onclick="window.KinetiqSPA.submitAnswer()" class="px-6 py-2.5 rounded-lg bg-primary hover:bg-primary-fixed-dim text-on-primary text-xs font-semibold transition-all flex items-center gap-2 shadow-md" type="button">
                    <span>Submit & Verify</span>
                    <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Right 4 Cols: Cognitive Retention Matrix -->
          <div class="xl:col-span-4 flex flex-col gap-4">
            <div class="bg-surface-container-low rounded-2xl p-5 shadow-xl border border-outline-variant/15 space-y-4">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-bold text-on-surface uppercase tracking-wider">Topic Mastery</h3>
                <span class="material-symbols-outlined text-[20px] text-primary">psychology</span>
              </div>

              <!-- Gauge -->
              <div class="flex items-center gap-4 p-4 rounded-xl bg-surface-container">
                <div class="relative w-16 h-16 flex items-center justify-center">
                  <svg class="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                    <path class="text-surface-container-highest" stroke-width="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                    <path class="text-primary" stroke-dasharray="82, 100" stroke-width="3.5" stroke-linecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                  </svg>
                  <span class="absolute text-xs font-bold text-on-surface">82%</span>
                </div>
                <div>
                  <span class="text-sm font-bold text-on-surface block">Level 4: Advanced</span>
                  <span class="text-xs text-secondary font-medium">Cognitive retention score</span>
                </div>
              </div>

              <!-- Domain Skills Progress Bars -->
              <div class="space-y-3 pt-2">
                <div>
                  <div class="flex justify-between text-xs mb-1">
                    <span class="text-on-surface-variant">Event Loop & Microtasks</span>
                    <span class="text-on-surface font-semibold">92%</span>
                  </div>
                  <div class="w-full bg-surface-container-high rounded-full h-1.5 overflow-hidden">
                    <div class="bg-secondary h-full rounded-full" style="width: 92%"></div>
                  </div>
                </div>

                <div>
                  <div class="flex justify-between text-xs mb-1">
                    <span class="text-on-surface-variant">Closures & Lexical Environments</span>
                    <span class="text-on-surface font-semibold">88%</span>
                  </div>
                  <div class="w-full bg-surface-container-high rounded-full h-1.5 overflow-hidden">
                    <div class="bg-primary h-full rounded-full" style="width: 88%"></div>
                  </div>
                </div>

                <div>
                  <div class="flex justify-between text-xs mb-1">
                    <span class="text-on-surface-variant">V8 Memory & Garbage Collection</span>
                    <span class="text-on-surface font-semibold">74%</span>
                  </div>
                  <div class="w-full bg-surface-container-high rounded-full h-1.5 overflow-hidden">
                    <div class="bg-tertiary h-full rounded-full" style="width: 74%"></div>
                  </div>
                </div>

                <div>
                  <div class="flex justify-between text-xs mb-1">
                    <span class="text-on-surface-variant">Prototypes & Metaprogramming</span>
                    <span class="text-on-surface font-semibold">68%</span>
                  </div>
                  <div class="w-full bg-surface-container-high rounded-full h-1.5 overflow-hidden">
                    <div class="bg-outline h-full rounded-full" style="width: 68%"></div>
                  </div>
                </div>
              </div>

              <!-- AI Remediation Button -->
              <button onclick="window.KinetiqSPA.navigate('ai-instructor-companion')" class="w-full py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary text-xs font-semibold flex items-center justify-center gap-2 border border-outline-variant/30 transition-all" type="button">
                <span class="material-symbols-outlined text-[16px]">smart_toy</span>
                Consult AI Tutor on Weak Spots
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // View: Student Dashboard
  function renderDashboard() {
    return `
      <div class="p-6 lg:p-8 space-y-6 animate-in fade-in duration-200">
        <!-- Welcome Hero -->
        <div class="p-6 rounded-2xl bg-gradient-to-r from-surface-container-low via-surface-container to-surface-container-low border border-outline-variant/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="px-2.5 py-0.5 rounded-full bg-secondary/15 text-secondary text-xs font-semibold">COHORT ACTIVE</span>
              <span class="text-xs text-outline">Sprint 4 • Week 2</span>
            </div>
            <h1 class="text-2xl font-bold text-on-surface">Welcome back, Elena!</h1>
            <p class="text-sm text-on-surface-variant mt-1">You are on track to complete the <strong>Distributed Systems & Full-Stack Cloud Architecture</strong> certification.</p>
          </div>
          <div class="flex items-center gap-3">
            <a href="/ai_learning_kinetiq_academy/index.html" class="px-4 py-2.5 rounded-lg bg-secondary/20 hover:bg-secondary/30 border border-secondary text-secondary text-xs font-bold flex items-center gap-2 transition-all shadow-md">
              <span class="material-symbols-outlined text-[18px]">auto_awesome</span>
              Launch AI Studio
            </a>
            <button onclick="window.KinetiqSPA.navigate('course-lms-player')" class="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-fixed-dim text-on-primary text-xs font-semibold flex items-center gap-2 shadow-md">
              <span class="material-symbols-outlined text-[18px]">play_circle</span>
              Continue Learning
            </button>
          </div>
        </div>

        <!-- Bento Stats -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="p-4 rounded-xl bg-surface-container-low border border-outline-variant/15 flex flex-col justify-between">
            <span class="text-xs text-outline uppercase font-semibold">Active Courses</span>
            <div class="mt-2 text-2xl font-bold text-on-surface">3 <span class="text-xs text-secondary font-normal">Enrolled</span></div>
          </div>
          <div class="p-4 rounded-xl bg-surface-container-low border border-outline-variant/15 flex flex-col justify-between">
            <span class="text-xs text-outline uppercase font-semibold">Study Hours</span>
            <div class="mt-2 text-2xl font-bold text-on-surface">42.5 <span class="text-xs text-primary font-normal">hrs</span></div>
          </div>
          <div class="p-4 rounded-xl bg-surface-container-low border border-outline-variant/15 flex flex-col justify-between">
            <span class="text-xs text-outline uppercase font-semibold">Assessments Passed</span>
            <div class="mt-2 text-2xl font-bold text-on-surface">19 <span class="text-xs text-tertiary font-normal">/ 22</span></div>
          </div>
          <div class="p-4 rounded-xl bg-surface-container-low border border-outline-variant/15 flex flex-col justify-between">
            <span class="text-xs text-outline uppercase font-semibold">Certificates</span>
            <div class="mt-2 text-2xl font-bold text-on-surface">2 <span class="text-xs text-secondary font-normal">Verified</span></div>
          </div>
        </div>

        <!-- In-Progress Courses Grid -->
        <div>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-on-surface">Continue Where You Left Off</h2>
            <button onclick="window.KinetiqSPA.navigate('my-learning')" class="text-xs text-primary hover:underline font-semibold">View All Enrolled</button>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Card 1 -->
            <div class="p-5 rounded-xl bg-surface-container-low border border-outline-variant/20 hover:border-primary/40 transition-all flex flex-col justify-between space-y-4">
              <div class="flex items-start justify-between">
                <div>
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">FULL-STACK CLOUD</span>
                  <h3 class="text-base font-bold text-on-surface mt-2">Next.js 15 & Distributed Systems</h3>
                  <p class="text-xs text-on-surface-variant mt-1">Lesson 14: Server Components vs Client Components Isolation</p>
                </div>
                <span class="text-xs font-bold text-primary">68%</span>
              </div>
              <div class="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                <div class="bg-primary h-full rounded-full" style="width: 68%"></div>
              </div>
              <div class="flex items-center justify-between pt-2 border-t border-outline-variant/10">
                <span class="text-xs text-outline">Est. 18 mins remaining</span>
                <button onclick="window.KinetiqSPA.navigate('course-lms-player')" class="px-3.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary text-xs font-semibold flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[16px]">play_arrow</span> Resume
                </button>
              </div>
            </div>

            <!-- Card 2 -->
            <div class="p-5 rounded-xl bg-surface-container-low border border-outline-variant/20 hover:border-secondary/40 transition-all flex flex-col justify-between space-y-4">
              <div class="flex items-start justify-between">
                <div>
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-secondary/10 text-secondary">AI & ML</span>
                  <h3 class="text-base font-bold text-on-surface mt-2">Machine Learning Fundamentals with Python</h3>
                  <p class="text-xs text-on-surface-variant mt-1">Lesson 08: Gradient Descent & Loss Optimization</p>
                </div>
                <span class="text-xs font-bold text-secondary">42%</span>
              </div>
              <div class="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                <div class="bg-secondary h-full rounded-full" style="width: 42%"></div>
              </div>
              <div class="flex items-center justify-between pt-2 border-t border-outline-variant/10">
                <span class="text-xs text-outline">Est. 32 mins remaining</span>
                <button onclick="window.KinetiqSPA.navigate('course-lms-player')" class="px-3.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-secondary text-xs font-semibold flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[16px]">play_arrow</span> Resume
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // View: Courses Explorer (Catalog from live backend API)
  function renderCoursesExplorer() {
    return `
      <div class="p-6 lg:p-8 space-y-6 animate-in fade-in duration-200">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-on-surface">Explore Course Catalog</h1>
            <p class="text-sm text-on-surface-variant mt-1">Deep-dive technical curriculums authored by industry architects.</p>
          </div>
          <div class="flex items-center gap-2">
            <input id="course-search-input" onkeyup="window.KinetiqSPA.filterCourses(this.value)" placeholder="Search courses or tags..." class="px-3.5 py-2 rounded-lg bg-surface-container-low border border-outline-variant/30 text-on-surface text-xs w-64 focus:outline-none focus:border-primary" />
          </div>
        </div>

        <!-- Filter Chips -->
        <div class="flex flex-wrap items-center gap-2">
          <button onclick="window.KinetiqSPA.filterCourses('')" class="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold">All Disciplines</button>
          <button onclick="window.KinetiqSPA.filterCourses('Machine Learning')" class="px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold border border-outline-variant/20">Machine Learning</button>
          <button onclick="window.KinetiqSPA.filterCourses('Distributed')" class="px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold border border-outline-variant/20">Distributed Systems</button>
          <button onclick="window.KinetiqSPA.filterCourses('Cloud')" class="px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold border border-outline-variant/20">Cloud Architecture</button>
        </div>

        <!-- Dynamic Course Cards -->
        <div id="course-cards-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div class="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between space-y-4">
            <div>
              <span class="px-2.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">MACHINE LEARNING</span>
              <h3 class="text-lg font-bold text-on-surface mt-3">Machine Learning Fundamentals with Python</h3>
              <p class="text-xs text-on-surface-variant mt-1.5 line-clamp-2">Master supervised & unsupervised learning, scikit-learn pipelines, model evaluation metrics, and PyTorch tensors.</p>
            </div>
            <div class="pt-4 border-t border-outline-variant/15 flex items-center justify-between">
              <div>
                <span class="text-base font-bold text-on-surface">$149</span>
                <span class="text-xs text-outline line-through ml-1">$249</span>
              </div>
              <button onclick="window.KinetiqSPA.navigate('course-lms-player')" class="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-fixed-dim transition-colors">Start Learning</button>
            </div>
          </div>

          <div class="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between space-y-4">
            <div>
              <span class="px-2.5 py-0.5 rounded text-[10px] font-bold bg-secondary/10 text-secondary">FULL-STACK CLOUD</span>
              <h3 class="text-lg font-bold text-on-surface mt-3">Next.js 15 & Distributed Systems</h3>
              <p class="text-xs text-on-surface-variant mt-1.5 line-clamp-2">Architect high-throughput reactive web applications with RSC, edge runtime caching, Kafka event streaming, and PostgreSQL sharding.</p>
            </div>
            <div class="pt-4 border-t border-outline-variant/15 flex items-center justify-between">
              <div>
                <span class="text-base font-bold text-on-surface">$199</span>
                <span class="text-xs text-outline line-through ml-1">$299</span>
              </div>
              <button onclick="window.KinetiqSPA.navigate('course-lms-player')" class="px-4 py-2 rounded-lg bg-secondary text-on-secondary-container text-xs font-semibold hover:opacity-90 transition-opacity">Start Learning</button>
            </div>
          </div>

          <div class="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between space-y-4">
            <div>
              <span class="px-2.5 py-0.5 rounded text-[10px] font-bold bg-tertiary/10 text-tertiary">DEVOPS & SRE</span>
              <h3 class="text-lg font-bold text-on-surface mt-3">Kubernetes & Production Cloud Telemetry</h3>
              <p class="text-xs text-on-surface-variant mt-1.5 line-clamp-2">Configure multi-cluster service meshes, eBPF network observability, Prometheus SLO alerts, and GitOps CI/CD delivery.</p>
            </div>
            <div class="pt-4 border-t border-outline-variant/15 flex items-center justify-between">
              <div>
                <span class="text-base font-bold text-on-surface">$179</span>
                <span class="text-xs text-outline line-through ml-1">$229</span>
              </div>
              <button onclick="window.KinetiqSPA.navigate('course-lms-player')" class="px-4 py-2 rounded-lg bg-tertiary text-on-tertiary text-xs font-semibold hover:opacity-90 transition-opacity">Start Learning</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // View: Course LMS Player
  function renderLMSPlayer() {
    return `
      <div class="p-6 lg:p-8 space-y-6 animate-in fade-in duration-200">
        <!-- Player Header -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-outline-variant/20">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-primary">NEXT.JS 15 DISTRIBUTED ARCHITECTURE</span>
              <span class="text-xs text-outline">• Lesson 14 of 22</span>
            </div>
            <h1 class="text-xl font-bold text-on-surface mt-1">Server Components vs Client Components Isolation</h1>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="window.KinetiqSPA.showToast('Lesson marked complete! +50 XP')" class="px-4 py-2 rounded-lg bg-primary hover:bg-primary-fixed-dim text-on-primary text-xs font-semibold flex items-center gap-1.5 shadow-md">
              <span class="material-symbols-outlined text-[16px]">check_circle</span> Mark Complete
            </button>
          </div>
        </div>

        <!-- Video Canvas & Syllabus Split -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <!-- Left 8 Cols: Video Player & Tabs -->
          <div class="lg:col-span-8 space-y-4">
            <div class="relative w-full aspect-video rounded-2xl bg-[#030712] overflow-hidden shadow-2xl border border-outline-variant/25 flex flex-col items-center justify-center group">
              <!-- Animated Ambient Video Screen Mockup -->
              <div class="absolute inset-0 bg-gradient-to-tr from-primary/15 via-transparent to-secondary/10 pointer-events-none"></div>
              <div class="text-center z-10 space-y-3">
                <button id="lms-play-btn" onclick="window.KinetiqSPA.toggleVideoPlay()" class="w-16 h-16 rounded-full bg-primary/90 text-on-primary hover:scale-110 transition-transform flex items-center justify-center shadow-xl mx-auto">
                  <span class="material-symbols-outlined text-[32px]">play_arrow</span>
                </button>
                <div class="text-xs font-mono text-slate-300">STREAM RESUMED • 1080p 60FPS</div>
              </div>
              <!-- Player Control Bar -->
              <div class="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-between text-xs text-slate-200">
                <div class="flex items-center gap-3">
                  <span class="material-symbols-outlined text-[20px] cursor-pointer">volume_up</span>
                  <span>14:32 / 28:50</span>
                </div>
                <div class="flex items-center gap-3 font-mono">
                  <span class="px-2 py-0.5 rounded bg-white/10 text-xs">1.25x</span>
                  <span class="material-symbols-outlined text-[20px] cursor-pointer">fullscreen</span>
                </div>
              </div>
            </div>

            <!-- Interactive Sandbox & Notes Tabs -->
            <div class="bg-surface-container-low rounded-xl p-5 border border-outline-variant/15 space-y-3">
              <div class="flex items-center gap-4 border-b border-outline-variant/15 pb-2 text-xs font-semibold">
                <span class="text-primary border-b-2 border-primary pb-2 cursor-pointer">Interactive Sandbox</span>
                <span class="text-on-surface-variant hover:text-on-surface cursor-pointer">Lesson Notes & Transcript</span>
                <span class="text-on-surface-variant hover:text-on-surface cursor-pointer">Discussion (18)</span>
              </div>
              <div class="font-mono text-xs p-4 rounded-lg bg-surface-container-lowest border border-outline-variant/20 text-on-surface space-y-1">
                <div class="text-outline">// Server Component Boundary</div>
                <div>import { Suspense } from 'react';</div>
                <div>import { DatabaseStream } from '@/lib/db';</div>
                <div class="text-secondary">export default async function Page() {</div>
                <div class="pl-4">const data = await DatabaseStream.fetchTelemetry();</div>
                <div class="pl-4">return &lt;ClientInteractiveWidget initialData={data} /&gt;;</div>
                <div class="text-secondary">}</div>
              </div>
              <div class="flex justify-end pt-2">
                <button onclick="window.KinetiqSPA.showToast('Code executed: Telemetry bundle verified without runtime errors')" class="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary text-xs font-semibold flex items-center gap-1.5 border border-outline-variant/30">
                  <span class="material-symbols-outlined text-[16px]">terminal</span> Run Code
                </button>
              </div>
            </div>
          </div>

          <!-- Right 4 Cols: Syllabus Tree -->
          <div class="lg:col-span-4 bg-surface-container-low rounded-2xl p-5 border border-outline-variant/15 space-y-3">
            <h3 class="text-sm font-bold text-on-surface uppercase tracking-wider">Module Syllabus</h3>
            <div class="space-y-2 text-xs">
              <div class="p-3 rounded-lg bg-surface-container flex items-center justify-between text-on-surface">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
                  <span>12. Hydration Boundary Setup</span>
                </div>
                <span class="text-outline">12:10</span>
              </div>
              <div class="p-3 rounded-lg bg-surface-container flex items-center justify-between text-on-surface">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
                  <span>13. React Cache() vs Memory Memos</span>
                </div>
                <span class="text-outline">16:45</span>
              </div>
              <div class="p-3 rounded-lg bg-primary/10 border border-primary/40 flex items-center justify-between text-primary font-semibold">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[16px] animate-pulse">play_circle</span>
                  <span>14. RSC vs Client Isolation</span>
                </div>
                <span>28:50</span>
              </div>
              <div class="p-3 rounded-lg bg-surface-container-low border border-outline-variant/15 flex items-center justify-between text-on-surface-variant">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[16px]">lock</span>
                  <span>15. Streaming SSR with Suspense</span>
                </div>
                <span class="text-outline">22:04</span>
              </div>
              <div class="p-3 rounded-lg bg-surface-container-low border border-outline-variant/15 flex items-center justify-between text-on-surface-variant">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[16px]">lock</span>
                  <span>16. Server Actions & Mutations</span>
                </div>
                <span class="text-outline">19:30</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // View: AI Companion (OpenAI backend integration)
  function renderAICompanion() {
    return `
      <div class="p-6 lg:p-8 space-y-6 animate-in fade-in duration-200">
        <div class="flex items-center justify-between pb-4 border-b border-outline-variant/20">
          <div>
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">POWERED BY OPENAI</span>
              <span class="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
              <span class="text-xs text-outline">Real-Time Context Synced</span>
            </div>
            <h1 class="text-2xl font-bold text-on-surface mt-1">AI Learning Companion & Architecture Tutor</h1>
          </div>
          <button onclick="window.KinetiqSPA.clearChat()" class="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant text-xs font-semibold">Clear Session</button>
        </div>

        <!-- Prompt Suggestions -->
        <div class="flex flex-wrap items-center gap-2">
          <button onclick="window.KinetiqSPA.askPrompt('Explain the difference between execution context and closures in JS')" class="px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-xs text-on-surface border border-outline-variant/20">Execution Context vs Closures</button>
          <button onclick="window.KinetiqSPA.askPrompt('How does Next.js 15 avoid hydration mismatch with React Server Components?')" class="px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-xs text-on-surface border border-outline-variant/20">RSC Hydration Mismatch</button>
          <button onclick="window.KinetiqSPA.askPrompt('Give me a 3-step design breakdown for distributed cache invalidation')" class="px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-xs text-on-surface border border-outline-variant/20">Distributed Cache Invalidation</button>
        </div>

        <!-- Chat Stream -->
        <div id="ai-chat-history" class="h-[440px] overflow-y-auto space-y-4 p-5 rounded-2xl bg-surface-container-low border border-outline-variant/20">
          ${AppState.chatMessages.map(msg => `
            <div class="flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}">
              ${msg.sender === 'ai' ? '<div class="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0"><span class="material-symbols-outlined text-[18px]">smart_toy</span></div>' : ''}
              <div class="max-w-xl p-3.5 rounded-xl text-xs leading-relaxed ${msg.sender === 'user' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface border border-outline-variant/15'}">
                ${escapeHtml(msg.text)}
              </div>
              ${msg.sender === 'user' ? '<div class="w-8 h-8 rounded-full bg-surface-container text-on-surface flex items-center justify-center shrink-0 font-bold text-xs">U</div>' : ''}
            </div>
          `).join('')}
        </div>

        <!-- Input Bar -->
        <div class="flex items-center gap-3">
          <input id="ai-input" onkeydown="if(event.key==='Enter') window.KinetiqSPA.sendAIChat()" placeholder="Ask your AI companion a question or paste code..." class="flex-1 px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface text-xs focus:outline-none focus:border-primary shadow-sm" />
          <button onclick="window.KinetiqSPA.sendAIChat()" class="px-5 py-3 rounded-xl bg-primary hover:bg-primary-fixed-dim text-on-primary text-xs font-semibold flex items-center gap-2 shadow-md">
            <span>Send</span>
            <span class="material-symbols-outlined text-[16px]">send</span>
          </button>
        </div>
      </div>
    `;
  }

  // View: Live Classes Hub
  function renderLiveClasses() {
    return `
      <div class="p-6 lg:p-8 space-y-6 animate-in fade-in duration-200">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-outline-variant/20">
          <div>
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              <span class="text-xs font-bold text-secondary uppercase">LIVE WEBINAR STREAMING</span>
            </div>
            <h1 class="text-2xl font-bold text-on-surface mt-1">Live Architectural Interactive Stage</h1>
          </div>
          <span class="px-3 py-1 rounded-full bg-surface-container text-xs text-on-surface-variant font-mono">ROOM: kinetiq-arch-live</span>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div class="lg:col-span-8 space-y-4">
            <div class="relative aspect-video rounded-2xl bg-black overflow-hidden border border-outline-variant/25 flex items-center justify-center">
              <div class="text-center space-y-2">
                <span class="material-symbols-outlined text-4xl text-primary animate-pulse">podium</span>
                <div class="text-sm font-semibold text-white">Live Stream in Progress: Distributed Systems with Elena Rostova</div>
                <div class="text-xs text-slate-400">WebRTC / LiveKit Connected • 1,240 Participants</div>
              </div>
            </div>
          </div>
          <div class="lg:col-span-4 bg-surface-container-low rounded-2xl p-5 border border-outline-variant/15 space-y-3 h-[380px] flex flex-col justify-between">
            <h3 class="text-xs font-bold text-on-surface uppercase tracking-wider">Live Chat Stream</h3>
            <div class="flex-1 overflow-y-auto space-y-2 text-xs text-on-surface-variant">
              <div><strong class="text-primary">Alex K.:</strong> How does this handle split-brain in Raft?</div>
              <div><strong class="text-secondary">Priya M.:</strong> Quorum requires (N/2)+1 nodes to commit!</div>
              <div><strong class="text-on-surface">Marcus L.:</strong> Super clear explanation of write leases.</div>
            </div>
            <input placeholder="Say something in live stream..." class="w-full px-3 py-2 rounded-lg bg-surface-container text-xs border border-outline-variant/30 text-on-surface" />
          </div>
        </div>
      </div>
    `;
  }

  // View: Admin & Instructor Command Center
  function renderAdminDashboard() {
    return `
      <div class="p-6 lg:p-8 space-y-6 animate-in fade-in duration-200">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-outline-variant/20">
          <div>
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded-full bg-error/15 text-error text-xs font-bold">INSTRUCTOR STUDIO</span>
              <span class="text-xs text-outline">Executive Telemetry</span>
            </div>
            <h1 class="text-2xl font-bold text-on-surface mt-1">Admin & Instructor Command Center</h1>
          </div>
          <div class="flex items-center gap-3">
            <button onclick="window.KinetiqSPA.navigate('course-management')" class="px-4 py-2 rounded-lg bg-primary hover:bg-primary-fixed-dim text-on-primary text-xs font-semibold flex items-center gap-2 shadow-md">
              <span class="material-symbols-outlined text-[18px]">add_box</span> Create Course
            </button>
          </div>
        </div>

        <!-- KPI Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="p-5 rounded-xl bg-surface-container-low border border-outline-variant/15 flex flex-col justify-between">
            <span class="text-xs text-outline uppercase font-semibold">Total Revenue</span>
            <div class="mt-2 text-3xl font-bold text-on-surface">$148,200 <span class="text-xs text-secondary font-semibold">+18% MoM</span></div>
          </div>
          <div class="p-5 rounded-xl bg-surface-container-low border border-outline-variant/15 flex flex-col justify-between">
            <span class="text-xs text-outline uppercase font-semibold">Enrolled Students</span>
            <div class="mt-2 text-3xl font-bold text-on-surface">4,820 <span class="text-xs text-primary font-semibold">Active</span></div>
          </div>
          <div class="p-5 rounded-xl bg-surface-container-low border border-outline-variant/15 flex flex-col justify-between">
            <span class="text-xs text-outline uppercase font-semibold">Completion Rate</span>
            <div class="mt-2 text-3xl font-bold text-on-surface">94.2% <span class="text-xs text-secondary font-semibold">Top Tier</span></div>
          </div>
          <div class="p-5 rounded-xl bg-surface-container-low border border-outline-variant/15 flex flex-col justify-between">
            <span class="text-xs text-outline uppercase font-semibold">Instructor Score</span>
            <div class="mt-2 text-3xl font-bold text-on-surface">4.96 <span class="text-xs text-tertiary font-semibold">★ / 5.0</span></div>
          </div>
        </div>

        <!-- Management Shortcuts -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div onclick="window.KinetiqSPA.navigate('course-management')" class="p-5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/15 cursor-pointer transition-all">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-primary text-2xl">layers</span>
              <div>
                <h4 class="text-sm font-bold text-on-surface">Course Management</h4>
                <p class="text-xs text-on-surface-variant">Publish, edit, and organize curriculums</p>
              </div>
            </div>
          </div>

          <div onclick="window.KinetiqSPA.navigate('student-management')" class="p-5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/15 cursor-pointer transition-all">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-secondary text-2xl">group</span>
              <div>
                <h4 class="text-sm font-bold text-on-surface">Student Directory</h4>
                <p class="text-xs text-on-surface-variant">View student progress, roles, and cohorts</p>
              </div>
            </div>
          </div>

          <div onclick="window.KinetiqSPA.navigate('ai-class-generator')" class="p-5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/15 cursor-pointer transition-all">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-tertiary text-2xl">psychology</span>
              <div>
                <h4 class="text-sm font-bold text-on-surface">AI Curriculum Generator</h4>
                <p class="text-xs text-on-surface-variant">Generate lessons and quizzes instantly</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // View: Course Management CMS
  function renderCourseManagement() {
    return `
      <div class="p-6 lg:p-8 space-y-6 animate-in fade-in duration-200">
        <div class="flex items-center justify-between pb-4 border-b border-outline-variant/20">
          <div>
            <h1 class="text-2xl font-bold text-on-surface">Course Management CMS</h1>
            <p class="text-sm text-on-surface-variant mt-1">Manage, publish, and inspect all curriculum offerings.</p>
          </div>
          <button onclick="window.KinetiqSPA.showToast('Course creation modal opened')" class="px-4 py-2 rounded-lg bg-primary hover:bg-primary-fixed-dim text-on-primary text-xs font-semibold flex items-center gap-1.5 shadow-md">
            <span class="material-symbols-outlined text-[16px]">add</span> New Course
          </button>
        </div>

        <div class="rounded-xl bg-surface-container-low border border-outline-variant/15 overflow-hidden">
          <table class="w-full text-left text-xs text-on-surface">
            <thead class="bg-surface-container border-b border-outline-variant/20 text-outline uppercase font-semibold">
              <tr>
                <th class="p-4">Title</th>
                <th class="p-4">Instructor</th>
                <th class="p-4">Price</th>
                <th class="p-4">Status</th>
                <th class="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline-variant/10">
              <tr>
                <td class="p-4 font-semibold text-on-surface">Machine Learning Fundamentals with Python</td>
                <td class="p-4 text-on-surface-variant">Dr. Sarah Jenkins</td>
                <td class="p-4 font-mono">$149</td>
                <td class="p-4"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-secondary/15 text-secondary">PUBLISHED</span></td>
                <td class="p-4 text-right space-x-2">
                  <button onclick="window.KinetiqSPA.showToast('Editing Course ID ML-01')" class="text-primary hover:underline font-semibold">Edit</button>
                  <button onclick="window.KinetiqSPA.showToast('Course unpublish toggled')" class="text-outline hover:underline">Draft</button>
                </td>
              </tr>
              <tr>
                <td class="p-4 font-semibold text-on-surface">Next.js 15 & Distributed Systems</td>
                <td class="p-4 text-on-surface-variant">Elena Rostova</td>
                <td class="p-4 font-mono">$199</td>
                <td class="p-4"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-secondary/15 text-secondary">PUBLISHED</span></td>
                <td class="p-4 text-right space-x-2">
                  <button onclick="window.KinetiqSPA.showToast('Editing Course ID NS-02')" class="text-primary hover:underline font-semibold">Edit</button>
                  <button onclick="window.KinetiqSPA.showToast('Course unpublish toggled')" class="text-outline hover:underline">Draft</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // View: Certificates Hub
  function renderCertificates() {
    return `
      <div class="p-6 lg:p-8 space-y-6 animate-in fade-in duration-200">
        <div class="pb-4 border-b border-outline-variant/20">
          <h1 class="text-2xl font-bold text-on-surface">Issued Professional Certificates</h1>
          <p class="text-sm text-on-surface-variant mt-1">Cryptographically verifiable technical credentials with blockchain proof hashes.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="p-6 rounded-2xl bg-surface-container-low border border-primary/30 relative overflow-hidden space-y-4">
            <div class="flex items-start justify-between">
              <div>
                <span class="px-2.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">CREDENTIAL VERIFIED</span>
                <h3 class="text-lg font-bold text-on-surface mt-2">Next.js 15 & Distributed Systems Architect</h3>
                <p class="text-xs text-on-surface-variant mt-1">Recipient: Elena Rostova • Issued Oct 2026</p>
              </div>
              <span class="material-symbols-outlined text-3xl text-primary">verified</span>
            </div>
            <div class="p-3 rounded-lg bg-surface-container text-xs font-mono text-outline truncate">
              HASH: 0x8f2a99d04bc7102eef5761a293cc9801fa382901b
            </div>
            <div class="flex items-center gap-3 pt-2">
              <button onclick="window.KinetiqSPA.showToast('Downloading Certificate PDF...')" class="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-fixed-dim">Download PDF</button>
              <button onclick="window.KinetiqSPA.showToast('Certificate Verified on Ledger')" class="px-4 py-2 rounded-lg bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high border border-outline-variant/20">Verify Proof</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Generic fallback renderer for auxiliary pages
  function renderGenericPage(routeKey) {
    const meta = ROUTES[routeKey] || { title: routeKey, icon: 'grid_view' };
    return `
      <div class="p-6 lg:p-8 space-y-6 animate-in fade-in duration-200">
        <div class="pb-4 border-b border-outline-variant/20 flex items-center gap-3">
          <span class="material-symbols-outlined text-primary text-3xl">${meta.icon}</span>
          <div>
            <h1 class="text-2xl font-bold text-on-surface">${meta.title}</h1>
            <p class="text-xs text-on-surface-variant mt-0.5">Active single page application module.</p>
          </div>
        </div>

        <div class="p-8 rounded-2xl bg-surface-container-low border border-outline-variant/15 text-center space-y-4">
          <div class="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <span class="material-symbols-outlined text-3xl">${meta.icon}</span>
          </div>
          <h3 class="text-lg font-bold text-on-surface">${meta.title} Module Active</h3>
          <p class="text-xs text-on-surface-variant max-w-md mx-auto">
            This module is seamlessly integrated into the unified Kinetiq Studio SPA shell. All features, state, and telemetry are synchronized with the backend.
          </p>
          <div class="flex items-center justify-center gap-3 pt-2">
            <button onclick="window.KinetiqSPA.navigate('practice-center')" class="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-fixed-dim">Back to Practice Center</button>
            <button onclick="window.KinetiqSPA.navigate('dashboard')" class="px-4 py-2 rounded-lg bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high">Go to Dashboard</button>
          </div>
        </div>
      </div>
    `;
  }

  // ─── SPA Controller ──────────────────────────────────────────────────────────

  const KinetiqSPA = {
    init: function () {
      window.__KINETIQ_SPA__ = true;
      this.attachSidebarEvents();
      this.attachHeaderEvents();
      this.loadUserSession();

      // Read initial route from URL hash or default to 'practice-center'
      const hash = window.location.hash.replace('#', '').trim();
      const initialRoute = hash && ROUTES[hash] ? hash : 'practice-center';
      this.navigate(initialRoute, false);

      // Listen for browser back/forward buttons
      window.addEventListener('hashchange', () => {
        const h = window.location.hash.replace('#', '').trim();
        if (h && ROUTES[h] && h !== AppState.currentRoute) {
          this.navigate(h, false);
        }
      });
    },

    loadUserSession: function () {
      if (window.KinetiqAPI && window.KinetiqAPI.store) {
        const u = window.KinetiqAPI.store.user.get();
        if (u) {
          AppState.user = u;
          this.updateUserBadge(u);
        }
      }
    },

    updateUserBadge: function (user) {
      const nameEl = document.getElementById('spa-user-name');
      const roleEl = document.getElementById('spa-user-role');
      if (nameEl && user.name) nameEl.textContent = user.name;
      if (roleEl && user.role) roleEl.textContent = `${user.role.toUpperCase()} • Pro`;
    },

    navigate: function (routeKey, updateHistory = true) {
      if (!ROUTES[routeKey]) routeKey = 'practice-center';
      AppState.currentRoute = routeKey;

      if (updateHistory) {
        window.location.hash = '#' + routeKey;
      }

      // Update document title
      document.title = `${ROUTES[routeKey].title} — Kinetiq Academy`;

      // Update Sidebar Active Highlight
      document.querySelectorAll('aside nav a[data-path]').forEach(link => {
        const path = link.getAttribute('data-path');
        if (path === routeKey) {
          link.className = 'flex items-center gap-3 px-3 py-2 transition-all bg-surface-container-high text-primary font-semibold rounded-lg';
          link.setAttribute('aria-current', 'page');
        } else {
          link.className = 'flex items-center gap-3 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all';
          link.removeAttribute('aria-current');
        }
      });

      // Render View Container
      const container = document.getElementById('app-view-container');
      if (!container) return;

      switch (routeKey) {
        case 'practice-center':
          container.innerHTML = renderPracticeCenter();
          break;
        case 'dashboard':
          container.innerHTML = renderDashboard();
          break;
        case 'my-learning':
          container.innerHTML = renderDashboard();
          break;
        case 'courses-explorer':
          container.innerHTML = renderCoursesExplorer();
          break;
        case 'course-lms-player':
          container.innerHTML = renderLMSPlayer();
          break;
        case 'ai-instructor-companion':
          container.innerHTML = renderAICompanion();
          break;
        case 'live-classes':
          container.innerHTML = renderLiveClasses();
          break;
        case 'admin-dashboard':
          container.innerHTML = renderAdminDashboard();
          break;
        case 'course-management':
          container.innerHTML = renderCourseManagement();
          break;
        case 'certificates':
          container.innerHTML = renderCertificates();
          break;
        default:
          container.innerHTML = renderGenericPage(routeKey);
          break;
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    attachSidebarEvents: function () {
      // Intercept all data-path links in sidebar and header
      document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-path]');
        if (target) {
          const path = target.getAttribute('data-path');
          if (path === 'ai-class-generator' || path === 'ai-studio' || path === 'ai-learning') {
            e.preventDefault();
            window.location.href = '/ai_learning_kinetiq_academy/index.html';
            return;
          }
          if (ROUTES[path]) {
            e.preventDefault();
            this.navigate(path);
          }
        }
      });
    },

    attachHeaderEvents: function () {
      // Command palette trigger (Cmd+K / Ctrl+K)
      window.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          this.toggleCommandPalette();
        }
      });
    },

    setMode: function (mode) {
      AppState.mode = mode;
      const learnerTab = document.getElementById('mode-tab-learner');
      const instructorTab = document.getElementById('mode-tab-instructor');
      if (mode === 'learner') {
        if (learnerTab) learnerTab.className = 'flex-1 text-center py-1.5 rounded bg-surface-container-high text-primary font-semibold transition-colors';
        if (instructorTab) instructorTab.className = 'flex-1 text-center py-1.5 rounded text-on-surface-variant hover:text-on-surface transition-colors';
        this.navigate('dashboard');
      } else {
        if (instructorTab) instructorTab.className = 'flex-1 text-center py-1.5 rounded bg-surface-container-high text-primary font-semibold transition-colors';
        if (learnerTab) learnerTab.className = 'flex-1 text-center py-1.5 rounded text-on-surface-variant hover:text-on-surface transition-colors';
        this.navigate('admin-dashboard');
      }
    },

    // Quiz interactions
    selectOption: function (optKey) {
      AppState.quizState.selectedOption = optKey;
      ['A', 'B', 'C', 'D'].forEach(k => {
        const el = document.getElementById(`opt-${k}`);
        if (!el) return;
        if (k === optKey) {
          el.className = 'quiz-option p-4 rounded-xl border border-primary bg-primary/10 transition-all cursor-pointer flex items-center justify-between group';
          el.querySelector('.material-symbols-outlined').textContent = 'check_circle';
          el.querySelector('.material-symbols-outlined').className = 'material-symbols-outlined text-[18px] text-primary';
        } else {
          el.className = 'quiz-option p-4 rounded-xl border border-outline-variant/30 hover:border-primary/60 bg-surface-container/60 hover:bg-surface-container transition-all cursor-pointer flex items-center justify-between group';
          el.querySelector('.material-symbols-outlined').textContent = 'radio_button_unchecked';
          el.querySelector('.material-symbols-outlined').className = 'material-symbols-outlined text-[18px] text-outline group-hover:text-primary';
        }
      });
    },

    toggleHint: function () {
      AppState.quizState.hintVisible = !AppState.quizState.hintVisible;
      const d = document.getElementById('hint-drawer');
      if (d) {
        if (AppState.quizState.hintVisible) d.classList.remove('hidden');
        else d.classList.add('hidden');
      }
    },

    toggleFlag: function () {
      AppState.quizState.flagged = !AppState.quizState.flagged;
      const txt = document.getElementById('flag-text');
      if (txt) txt.textContent = AppState.quizState.flagged ? 'Flagged' : 'Flag Question';
      this.showToast(AppState.quizState.flagged ? 'Question flagged for review' : 'Flag removed');
    },

    submitAnswer: function () {
      if (!AppState.quizState.selectedOption) {
        this.showToast('Please select an answer choice first!');
        return;
      }
      if (AppState.quizState.selectedOption === 'B') {
        this.showToast('Correct! +100 XP gained. Telemetry accuracy increased to 89%!');
        AppState.quizState.score = Math.min(100, AppState.quizState.score + 1);
      } else {
        this.showToast('Incorrect. Correct answer was B. AI remediation logged.');
      }
    },

    selectMode: function (modeName) {
      this.showToast(`Selected mode: ${modeName}. Calibrating question pool...`);
    },

    startRecoveryDrill: function () {
      this.showToast('Starting recovery drill: React Hydration & SSR...');
    },

    // AI Chat interactions
    sendAIChat: async function () {
      const input = document.getElementById('ai-input');
      if (!input || !input.value.trim()) return;
      const q = input.value.trim();
      input.value = '';

      AppState.chatMessages.push({ sender: 'user', text: q });
      this.navigate('ai-instructor-companion', false);

      // Call live backend AI if available
      try {
        if (window.KinetiqAPI && window.KinetiqAPI.ai) {
          const res = await window.KinetiqAPI.ai.chat(q);
          const reply = res?.data?.response || res?.data?.message || 'I have analyzed your architecture query. Server-driven state reduces client hydration overhead by offloading synchronous dependencies.';
          AppState.chatMessages.push({ sender: 'ai', text: reply });
        } else {
          // Local intelligent fallback
          AppState.chatMessages.push({
            sender: 'ai',
            text: `Regarding "${q}": In high-scale architectures, always ensure strict separation of concerns between stateful execution contexts and immutable serialized snapshots.`
          });
        }
      } catch (err) {
        AppState.chatMessages.push({
          sender: 'ai',
          text: `Analyzing: "${q}". Key insight: React Server Components stream static HTML immediately, minimizing client bundle footprint.`
        });
      }
      this.navigate('ai-instructor-companion', false);
    },

    askPrompt: function (promptText) {
      const input = document.getElementById('ai-input');
      if (input) input.value = promptText;
      this.sendAIChat();
    },

    clearChat: function () {
      AppState.chatMessages = [
        { sender: 'ai', text: 'Chat session reset. What architectural concept would you like to explore next?' }
      ];
      this.navigate('ai-instructor-companion', false);
    },

    filterCourses: function (query) {
      const q = (query || '').toLowerCase();
      document.querySelectorAll('#course-cards-container > div').forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(q) ? 'flex' : 'none';
      });
    },

    toggleVideoPlay: function () {
      const btn = document.getElementById('lms-play-btn');
      if (btn) {
        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon.textContent === 'play_arrow') {
          icon.textContent = 'pause';
          this.showToast('Playing Lesson 14: Server Components vs Client Components Isolation');
        } else {
          icon.textContent = 'play_arrow';
          this.showToast('Video paused');
        }
      }
    },

    toggleCommandPalette: function () {
      let modal = document.getElementById('spa-command-palette');
      if (modal) {
        modal.classList.toggle('hidden');
        if (!modal.classList.contains('hidden')) {
          const inp = document.getElementById('cmd-search-input');
          if (inp) inp.focus();
        }
      }
    },

    showToast: function (msg) {
      if (window.KinetiqRouter && window.KinetiqRouter.showToast) {
        window.KinetiqRouter.showToast(msg);
        return;
      }
      let toast = document.getElementById('spa-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'spa-toast';
        toast.className = 'fixed top-5 right-5 z-[99999] px-4 py-2.5 rounded-xl bg-surface-container text-white text-xs shadow-2xl border border-outline-variant/30 flex items-center gap-2 transition-all duration-300';
        document.body.appendChild(toast);
      }
      toast.innerHTML = `<span class="material-symbols-outlined text-secondary text-sm">check_circle</span><span>${escapeHtml(msg)}</span>`;
      toast.style.opacity = '1';
      setTimeout(() => { toast.style.opacity = '0'; }, 3000);
    }
  };

  window.KinetiqSPA = KinetiqSPA;

  // Auto initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => KinetiqSPA.init());
  } else {
    KinetiqSPA.init();
  }

})();
