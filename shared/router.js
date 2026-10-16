/**
 * Kinetiq Academy Universal Router & Navigation Engine
 * Connects all platform experiences: Marketing, Auth, Onboarding,
 * Student Learning Platform, and Admin/Instructor Portal.
 */

(function () {
  'use strict';

  // Canonical Route Mapping
  const ROUTE_DEFINITIONS = {
    // 1. Public Marketing Website
    'home': 'index.html',
    'explore-courses': 'explore_courses_kinetiq_academy_1/index.html',
    'courses': 'explore_courses_kinetiq_academy_1/index.html',
    'course-details': 'course_details_fullstack_next.js_distributed_systems_1/index.html',
    'course-details-public': 'course_details_fullstack_next.js_distributed_systems_1/index.html',
    'course-syllabus': 'course_details_fullstack_next.js_distributed_systems_1/index.html',
    'ai-learning': 'ai_learning_kinetiq_academy/index.html',
    'ai-studio': 'ai_learning_kinetiq_academy/index.html',
    'learning-studio': 'ai_learning_kinetiq_academy/index.html',
    'ai-companion': 'ai_learning_kinetiq_academy/index.html',
    'ai-instructor-companion': 'ai_learning_kinetiq_academy/index.html',
    'pricing': 'pricing_plans_kinetiq_academy/index.html',
    'about': 'about_us_kinetiq_academy/index.html',
    'about-us': 'about_us_kinetiq_academy/index.html',
    'resources': 'resources_blog_kinetiq_academy/index.html',
    'blog': 'resources_blog_kinetiq_academy/index.html',
    'contact': 'contact_support_kinetiq_academy/index.html',
    'help': 'contact_support_kinetiq_academy/index.html',

    // 2. Authentication & Onboarding
    'login': 'sign_in_register_kinetiq_academy/index.html?tab=signin',
    'sign-in': 'sign_in_register_kinetiq_academy/index.html?tab=signin',
    'signup': 'sign_in_register_kinetiq_academy/index.html?tab=signup',
    'sign-up': 'sign_in_register_kinetiq_academy/index.html?tab=signup',
    'register': 'sign_in_register_kinetiq_academy/index.html?tab=signup',
    'forgot-password': 'sign_in_register_kinetiq_academy/index.html?tab=forgot',
    'onboarding': 'student_onboarding_personalize_your_curriculum/index.html',

    // 3. Student Platform
    'dashboard': 'student_dashboard/index.html',
    'student-dashboard': 'student_dashboard/index.html',
    'my-learning': 'student_portal_dashboard_kinetiq_academy/index.html',
    'learn': 'course_lms_player/index.html',
    'course-lms-player': 'course_lms_player/index.html',
    'lms-player': 'course_lms_player/index.html',
    'practice': 'practice_quiz_center/index.html',
    'practice-center': 'practice_quiz_center/index.html',
    'quiz': 'practice_quiz_center/index.html',
    'ai': 'ai_learning_kinetiq_academy/index.html',
    'live-classes': 'student_dashboard/index.html#live-classes',
    'certificates': 'student_portal_dashboard_kinetiq_academy/index.html#certificates',
    'analytics': 'student_dashboard/index.html#analytics',
    'notifications': 'student_portal_dashboard_kinetiq_academy/index.html#notifications',
    'settings': 'student_portal_dashboard_kinetiq_academy/index.html#settings',

    // 4. Admin & Instructor Platform
    'admin': 'admin_instructor_dashboard/index.html',
    'admin-dashboard': 'admin_instructor_dashboard/index.html',
    'admin-courses': 'admin_instructor_dashboard/index.html#courses',
    'course-management': 'admin_instructor_dashboard/index.html#courses',
    'curriculum-builder': 'admin_instructor_dashboard/index.html#curriculum',
    'lesson-cms': 'admin_instructor_dashboard/index.html#lessons',
    'live-class-admin': 'admin_instructor_dashboard/index.html#live-classes',
    'ai-class-generator': 'ai_learning_kinetiq_academy/index.html',
    'quiz-builder': 'admin_instructor_dashboard/index.html#quizzes',
    'student-management': 'admin_instructor_dashboard/index.html#students',
    'platform-analytics': 'admin_instructor_dashboard/index.html#analytics',
    'admin-settings': 'admin_instructor_dashboard/index.html#settings'
  };

  function resolveUrl(targetKey) {
    if (!targetKey) return '/';
    if (targetKey.startsWith('http://') || targetKey.startsWith('https://') || targetKey.startsWith('mailto:') || targetKey.startsWith('#')) {
      return targetKey;
    }

    let targetFile = ROUTE_DEFINITIONS[targetKey];
    if (!targetFile) {
      // Direct file fallback
      targetFile = targetKey.endsWith('.html') ? targetKey : 'index.html';
    }

    const [pathPart, queryPart] = targetFile.split('?');
    const queryString = queryPart ? '?' + queryPart : '';
    return '/' + pathPart + queryString;
  }

  // Update all [data-path] links on page
  function updateAllLinks() {
    document.querySelectorAll('[data-path]').forEach(el => {
      const rawKey = el.getAttribute('data-path');
      if (rawKey) {
        const dest = resolveUrl(rawKey);
        if (el.tagName === 'A') {
          el.setAttribute('href', dest);
        } else {
          el.onclick = (e) => {
            e.preventDefault();
            window.location.href = dest;
          };
        }
      }
    });

    // Auto-wire buttons by text
    document.querySelectorAll('a, button').forEach(el => {
      const txt = (el.textContent || '').trim().toLowerCase();
      if (!el.getAttribute('data-path') && !el.getAttribute('onclick')) {
        if (txt === 'get started free' || txt === 'sign up' || txt === 'register') {
          el.setAttribute('data-path', 'signup');
          if (el.tagName === 'A') el.setAttribute('href', resolveUrl('signup'));
        } else if (txt === 'log in' || txt === 'sign in') {
          el.setAttribute('data-path', 'login');
          if (el.tagName === 'A') el.setAttribute('href', resolveUrl('login'));
        } else if (txt === 'explore courses' || txt === 'courses' || txt === 'catalog' || txt === 'explore') {
          el.setAttribute('data-path', 'explore-courses');
          if (el.tagName === 'A') el.setAttribute('href', resolveUrl('explore-courses'));
        } else if (txt.includes('enroll now') || txt.includes('resume') || txt.includes('continue learning') || txt.includes('start learning')) {
          el.setAttribute('data-path', 'learn');
          if (el.tagName === 'A') el.setAttribute('href', resolveUrl('learn'));
          else el.onclick = () => window.location.href = resolveUrl('learn');
        } else if (txt.includes('preview syllabus') || txt.includes('syllabus')) {
          el.setAttribute('data-path', 'course-details');
          if (el.tagName === 'A') el.setAttribute('href', resolveUrl('course-details'));
          else el.onclick = () => window.location.href = resolveUrl('course-details');
        } else if (txt.includes('practice') || txt.includes('quiz') || txt.includes('daily challenge') || txt.includes('recovery drill')) {
          el.setAttribute('data-path', 'practice');
          if (el.tagName === 'A') el.setAttribute('href', resolveUrl('practice'));
          else el.onclick = () => window.location.href = resolveUrl('practice');
        } else if (txt === 'ai learning' || txt === 'try ai learning' || txt === 'ai instructor' || txt === 'ask ai') {
          el.setAttribute('data-path', 'ai-learning');
          if (el.tagName === 'A') el.setAttribute('href', resolveUrl('ai-learning'));
          else el.onclick = () => window.location.href = resolveUrl('ai-learning');
        } else if (txt === 'my learning') {
          el.setAttribute('data-path', 'my-learning');
          if (el.tagName === 'A') el.setAttribute('href', resolveUrl('my-learning'));
          else el.onclick = () => window.location.href = resolveUrl('my-learning');
        } else if (txt.includes('live class') || txt.includes('live stream') || txt.includes('launch studio')) {
          el.setAttribute('data-path', 'live-classes');
          if (el.tagName === 'A') el.setAttribute('href', resolveUrl('live-classes'));
          else el.onclick = () => window.location.href = resolveUrl('live-classes');
        } else if (txt.includes('certificate')) {
          el.setAttribute('data-path', 'certificates');
          if (el.tagName === 'A') el.setAttribute('href', resolveUrl('certificates'));
          else el.onclick = () => window.location.href = resolveUrl('certificates');
        } else if (txt.includes('analytic')) {
          el.setAttribute('data-path', 'analytics');
          if (el.tagName === 'A') el.setAttribute('href', resolveUrl('analytics'));
          else el.onclick = () => window.location.href = resolveUrl('analytics');
        } else if (txt === 'pricing' || txt === 'view pricing') {
          el.setAttribute('data-path', 'pricing');
          if (el.tagName === 'A') el.setAttribute('href', resolveUrl('pricing'));
        } else if (txt === 'about' || txt === 'about us') {
          el.setAttribute('data-path', 'about');
          if (el.tagName === 'A') el.setAttribute('href', resolveUrl('about'));
        } else if (txt === 'resources' || txt === 'blog') {
          el.setAttribute('data-path', 'resources');
          if (el.tagName === 'A') el.setAttribute('href', resolveUrl('resources'));
        } else if (txt === 'contact' || txt === 'support' || txt === 'help center') {
          el.setAttribute('data-path', 'contact');
          if (el.tagName === 'A') el.setAttribute('href', resolveUrl('contact'));
        } else if (txt === 'dashboard' || txt === 'student app' || txt === 'learner mode') {
          el.setAttribute('data-path', 'dashboard');
          if (el.tagName === 'A') el.setAttribute('href', resolveUrl('dashboard'));
        } else if (txt === 'admin dashboard' || txt === 'admin app' || txt === 'instructor mode' || txt === 'admin') {
          el.setAttribute('data-path', 'admin-dashboard');
          if (el.tagName === 'A') el.setAttribute('href', resolveUrl('admin-dashboard'));
        } else if (txt === 'public web' || txt === 'exit to web' || txt === 'home') {
          el.setAttribute('data-path', 'home');
          if (el.tagName === 'A') el.setAttribute('href', resolveUrl('home'));
        }
      }
    });
  }

  // Toast Notification
  function showToast(message, type = 'success') {
    let toast = document.getElementById('kinetiq-global-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'kinetiq-global-toast';
      toast.className = 'fixed top-5 right-5 z-[99999] px-4 py-2.5 rounded-xl bg-[#171f33] text-white text-xs font-sans shadow-2xl border border-white/10 flex items-center gap-2.5 transition-all duration-300 translate-y-[-20px] opacity-0 pointer-events-none';
      document.body.appendChild(toast);
    }
    const icon = type === 'error' ? 'error' : (type === 'info' ? 'info' : 'check_circle');
    const color = type === 'error' ? 'text-red-400' : 'text-[#10B981]';
    toast.innerHTML = `<span class="material-symbols-outlined ${color} text-base">${icon}</span><span>${message}</span>`;
    toast.classList.remove('translate-y-[-20px]', 'opacity-0', 'pointer-events-none');
    toast.classList.add('translate-y-0', 'opacity-100');

    setTimeout(() => {
      toast.classList.add('translate-y-[-20px]', 'opacity-0', 'pointer-events-none');
      toast.classList.remove('translate-y-0', 'opacity-100');
    }, 3000);
  }

  // Command Palette (Cmd+K / Ctrl+K)
  function initCommandPalette() {
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
      }
    });
  }

  function toggleCommandPalette() {
    let palette = document.getElementById('kinetiq-cmd-palette');
    if (!palette) {
      palette = document.createElement('div');
      palette.id = 'kinetiq-cmd-palette';
      palette.className = 'fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-24 px-4';
      palette.innerHTML = `
        <div class="w-full max-w-xl rounded-2xl bg-[#0e1628] border border-white/10 shadow-2xl overflow-hidden font-sans">
          <div class="flex items-center gap-3 px-4 py-3.5 border-b border-white/10">
            <span class="material-symbols-outlined text-slate-400">search</span>
            <input id="cmd-input" placeholder="Type a command or jump to page (e.g. Dashboard, AI, LMS, Admin)..." class="w-full bg-transparent text-sm text-white placeholder-slate-400 outline-none" />
            <kbd class="px-2 py-0.5 rounded bg-white/10 text-[10px] text-slate-300 font-mono">ESC</kbd>
          </div>
          <div id="cmd-results" class="max-h-80 overflow-y-auto p-2 space-y-1 text-xs">
            <a href="/index.html" class="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/10 text-slate-200">
              <span class="material-symbols-outlined text-sm text-indigo-400">home</span>
              <span>Home (Marketing)</span>
            </a>
            <a href="/explore_courses_kinetiq_academy_1/index.html" class="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/10 text-slate-200">
              <span class="material-symbols-outlined text-sm text-emerald-400">explore</span>
              <span>Explore Courses</span>
            </a>
            <a href="/student_dashboard/index.html" class="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/10 text-slate-200">
              <span class="material-symbols-outlined text-sm text-amber-400">grid_view</span>
              <span>Student Dashboard</span>
            </a>
            <a href="/course_lms_player/index.html" class="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/10 text-slate-200">
              <span class="material-symbols-outlined text-sm text-indigo-400">play_circle</span>
              <span>Course LMS Player</span>
            </a>
            <a href="/practice_quiz_center/index.html" class="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/10 text-slate-200">
              <span class="material-symbols-outlined text-sm text-emerald-400">terminal</span>
              <span>Adaptive Practice Center</span>
            </a>
            <a href="/ai_learning_kinetiq_academy/index.html" class="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/10 text-slate-200">
              <span class="material-symbols-outlined text-sm text-purple-400">smart_toy</span>
              <span>AI Learning Companion</span>
            </a>
            <a href="/admin_instructor_dashboard/index.html" class="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/10 text-slate-200">
              <span class="material-symbols-outlined text-sm text-rose-400">dashboard_customize</span>
              <span>Admin & Instructor Portal</span>
            </a>
          </div>
        </div>
      `;
      document.body.appendChild(palette);
      palette.addEventListener('click', (e) => {
        if (e.target === palette) palette.remove();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.getElementById('kinetiq-cmd-palette')) {
          document.getElementById('kinetiq-cmd-palette').remove();
        }
      });
      const input = palette.querySelector('#cmd-input');
      input.focus();
      input.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        palette.querySelectorAll('#cmd-results a').forEach(a => {
          a.style.display = a.textContent.toLowerCase().includes(q) ? 'flex' : 'none';
        });
      });
    } else {
      palette.remove();
    }
  }

  window.KinetiqRouter = {
    resolveUrl: resolveUrl,
    navigate: function (key) { window.location.href = resolveUrl(key); },
    showToast: showToast,
    toggleCommandPalette: toggleCommandPalette
  };

  // Run on DOM load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      updateAllLinks();
      initCommandPalette();
    });
  } else {
    updateAllLinks();
    initCommandPalette();
  }

})();
