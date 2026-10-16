/**
 * Kinetiq Academy — Interactive LMS Classroom Player Engine
 * Phase 2: Synchronizes real video playback, clickable transcripts,
 * video chapters, interactive knowledge checkpoints, timestamped notes/bookmarks,
 * context-grounded AI Tutor companion, and continuous watch progress.
 */

(function () {
  'use strict';

  let currentCourse = null;
  let currentLesson = null;
  let currentVideoAsset = null;
  let activeCourseId = null;
  let activeLessonId = null;

  // Phase 2 Interactive Video State
  let activeChapters = [];
  let activeCheckpoints = [];
  let activeNotes = [];
  let activeBookmarks = [];
  let triggeredCheckpoints = new Set();
  let currentCheckpoint = null;
  let lastTrackedTime = 0;

  document.addEventListener('DOMContentLoaded', async () => {
    await initClassroomPlayer();
  });

  async function initClassroomPlayer() {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug') || 'distributed-consensus-with-raft';
    const courseId = params.get('course') || params.get('courseId');
    const lessonId = params.get('lesson') || params.get('lessonId');

    try {
      let courseData;
      if (courseId) {
        const res = await window.KinetiqAPI.courses.getById(courseId);
        courseData = res.data?.course || res.data;
      } else {
        const res = await window.KinetiqAPI.courses.getBySlug(slug);
        courseData = res.data?.course || res.data;
      }

      currentCourse = courseData;
      activeCourseId = currentCourse.id;

      // Update Header Breadcrumbs & Title
      document.getElementById('course-breadcrumb-title')?.replaceChildren(document.createTextNode(currentCourse.title));

      // Build Sidebar Curriculum
      renderCurriculumSidebar(currentCourse.sections || []);

      // Select initial lesson
      let targetLesson = null;
      if (lessonId) {
        (currentCourse.sections || []).forEach(sec => {
          const found = (sec.lessons || []).find(l => l.id === lessonId);
          if (found) targetLesson = found;
        });
      }

      if (!targetLesson && currentCourse.sections?.[0]?.lessons?.[0]) {
        targetLesson = currentCourse.sections[0].lessons[0];
      }

      if (targetLesson) {
        await loadLesson(targetLesson.id);
      }
    } catch (err) {
      console.warn('Could not load course by slug/id:', err);
    }

    initTutorChat();
    initInteractiveVideoHooks();
  }

  function renderCurriculumSidebar(sections) {
    const container = document.getElementById('curriculum-sections-container');
    if (!container) return;

    if (!sections || sections.length === 0) {
      container.innerHTML = `<div class="p-4 text-xs text-on-surface-variant">No curriculum modules found.</div>`;
      return;
    }

    container.innerHTML = sections.map((sec, sIdx) => `
      <div class="border-b border-surface-container-high/40 pb-2">
        <button onclick="toggleSidebarModule('mod-${sec.id}')" type="button" class="w-full flex items-center justify-between p-3 rounded-lg hover:bg-surface-container-high text-left transition-colors">
          <div>
            <span class="text-[10px] uppercase font-bold text-primary tracking-wider">Module ${sIdx + 1}</span>
            <h4 class="text-xs font-bold text-on-surface line-clamp-1">${sec.title}</h4>
          </div>
          <span class="material-symbols-outlined text-[18px] text-outline">expand_more</span>
        </button>
        <div id="mod-${sec.id}" class="space-y-1 pl-2 pr-1 pt-1">
          ${(sec.lessons || []).map(les => `
            <button onclick="selectLesson('${les.id}')" type="button" id="sidebar-lesson-${les.id}" class="sidebar-lesson-item w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors hover:bg-surface-container-high ${les.id === activeLessonId ? 'bg-primary/15 text-primary font-semibold' : 'text-on-surface-variant'}">
              <div class="flex items-center gap-2 truncate">
                <span class="material-symbols-outlined text-[16px] shrink-0">${les.videoUrl ? 'play_circle' : 'article'}</span>
                <span class="truncate">${les.title}</span>
              </div>
              <span class="text-[10px] text-outline shrink-0 ml-2">${les.durationMinutes || 15}m</span>
            </button>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  window.toggleSidebarModule = function (id) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden');
  };

  window.selectLesson = async function (lessonId) {
    await loadLesson(lessonId);
  };

  async function loadLesson(lessonId) {
    activeLessonId = lessonId;
    triggeredCheckpoints.clear();

    // Update active highlight in sidebar
    document.querySelectorAll('.sidebar-lesson-item').forEach(el => {
      el.classList.remove('bg-primary/15', 'text-primary', 'font-semibold');
      el.classList.add('text-on-surface-variant');
    });
    document.getElementById(`sidebar-lesson-${lessonId}`)?.classList.add('bg-primary/15', 'text-primary', 'font-semibold');

    try {
      const res = await window.KinetiqAPI.courses.getLesson(activeCourseId, lessonId);
      currentLesson = res.data;
      currentVideoAsset = currentLesson.videoAsset;

      // Update Header & Lesson Titles
      document.getElementById('current-lesson-title').textContent = currentLesson.title;
      document.getElementById('current-lesson-desc').textContent = currentLesson.description || '';

      // Load Video Player
      const videoEl = document.getElementById('main-video-player');
      const noVideoMsg = document.getElementById('no-video-placeholder');

      const videoUrl = currentLesson.videoUrl || currentVideoAsset?.videoUrl;
      if (videoUrl && videoEl) {
        const fullUrl = videoUrl.startsWith('http') ? videoUrl : `http://localhost:4000${videoUrl}`;
        videoEl.src = fullUrl;
        videoEl.classList.remove('hidden');
        if (noVideoMsg) noVideoMsg.classList.add('hidden');

        // Setup subtitles if present
        if (currentVideoAsset?.captionsVtt) {
          const track = videoEl.querySelector('track');
          if (track) {
            track.src = `http://localhost:4000/uploads/videos/${currentVideoAsset.id}.vtt`;
          }
        }
      } else if (videoEl) {
        videoEl.classList.add('hidden');
        if (noVideoMsg) noVideoMsg.classList.remove('hidden');
      }

      // Populate Overview / Content Tab
      const overviewContainer = document.getElementById('lesson-markdown-body');
      if (overviewContainer) {
        overviewContainer.textContent = currentLesson.content || 'Comprehensive architectural explanation and diagrams for this lesson are loading...';
      }

      // Populate Interactive Transcript Tab
      renderTranscriptPane(currentVideoAsset?.transcript || []);

      // Phase 2: Load Chapters, Checkpoints, and Notes
      await loadVideoChapters(lessonId, activeCourseId);
      await loadVideoCheckpoints(lessonId, activeCourseId);
      await loadVideoNotes(lessonId);

      // Update URL query state without full reload
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('course', activeCourseId);
      newUrl.searchParams.set('lesson', activeLessonId);
      window.history.replaceState({}, '', newUrl.toString());

      // Track progress event
      window.KinetiqAPI?.ai.trackEvent('lesson_viewed', { courseId: activeCourseId, lessonId }).catch(() => {});
    } catch (err) {
      console.error('Failed to load lesson:', err);
    }
  }

  // ─── TRANSCRIPT SYNCHRONIZATION ──────────────────────────────────────────

  function renderTranscriptPane(transcript) {
    const container = document.getElementById('transcript-list-container');
    if (!container) return;

    if (!transcript || transcript.length === 0) {
      container.innerHTML = `<div class="p-6 text-center text-xs text-on-surface-variant">No synchronized video transcript available for this lesson.</div>`;
      return;
    }

    container.innerHTML = transcript.map((item, idx) => `
      <div id="transcript-row-${idx}" onclick="seekVideo(${item.start})" class="transcript-row p-3 rounded-xl hover:bg-surface-container cursor-pointer transition-colors flex items-start gap-3 text-xs border border-transparent hover:border-outline-variant/30">
        <span class="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono font-bold text-[10px] shrink-0">${formatTime(item.start)}</span>
        <span class="text-on-surface font-medium leading-relaxed">${item.text}</span>
      </div>
    `).join('');

    const videoEl = document.getElementById('main-video-player');
    if (videoEl) {
      videoEl.ontimeupdate = () => {
        const currentTime = videoEl.currentTime;

        // Transcript sync highlighting
        transcript.forEach((item, idx) => {
          const row = document.getElementById(`transcript-row-${idx}`);
          if (row) {
            if (currentTime >= item.start && currentTime <= item.end) {
              row.classList.add('bg-primary/20', 'border-primary/40');
            } else {
              row.classList.remove('bg-primary/20', 'border-primary/40');
            }
          }
        });

        // Check for Interactive Checkpoints
        checkCheckpoints(currentTime);

        // Continuous progress tracking every 15s
        if (Math.abs(currentTime - lastTrackedTime) >= 15 && videoEl.duration) {
          lastTrackedTime = currentTime;
          window.KinetiqAPI?.ai.trackVideoProgress(activeCourseId, activeLessonId, currentTime, videoEl.duration).catch(() => {});
        }
      };
    }
  }

  window.seekVideo = function (seconds) {
    const videoEl = document.getElementById('main-video-player');
    if (videoEl) {
      videoEl.currentTime = seconds;
      videoEl.play();
    }
  };

  function formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  // ─── PHASE 2: VIDEO CHAPTERS ─────────────────────────────────────────────

  async function loadVideoChapters(lessonId, courseId) {
    const container = document.getElementById('video-chapters-container');
    if (!container) return;

    try {
      const res = await window.KinetiqAPI.ai.getVideoChapters(lessonId, courseId);
      activeChapters = res.data || [];

      if (activeChapters.length === 0) {
        container.innerHTML = `<div class="p-4 text-xs text-on-surface-variant">No chapter breakdown available for this video.</div>`;
        return;
      }

      container.innerHTML = activeChapters.map((ch, idx) => `
        <div onclick="seekVideo(${ch.startSeconds})" class="p-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 cursor-pointer transition-colors flex items-center justify-between text-xs">
          <div class="space-y-0.5">
            <span class="font-bold text-on-surface flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px] text-primary">play_arrow</span>
              ${ch.title}
            </span>
            <span class="text-[10px] text-on-surface-variant block">${ch.learningObjective || ''}</span>
          </div>
          <span class="px-2 py-0.5 rounded bg-surface-container-high font-mono text-[10px] text-outline font-bold">
            ${formatTime(ch.startSeconds)}
          </span>
        </div>
      `).join('');
    } catch (err) {
      console.warn('Failed to load chapters:', err);
    }
  }

  // ─── PHASE 2: INTERACTIVE CHECKPOINTS ─────────────────────────────────────

  async function loadVideoCheckpoints(lessonId, courseId) {
    try {
      const res = await window.KinetiqAPI.ai.getVideoCheckpoints(lessonId, courseId);
      activeCheckpoints = res.data || [];
    } catch (err) {
      console.warn('Failed to load checkpoints:', err);
    }
  }

  function checkCheckpoints(currentTime) {
    if (!activeCheckpoints || activeCheckpoints.length === 0) return;

    for (const cp of activeCheckpoints) {
      if (Math.abs(currentTime - cp.timestampSeconds) < 1.0 && !triggeredCheckpoints.has(cp.id)) {
        triggeredCheckpoints.add(cp.id);
        triggerCheckpoint(cp);
        break;
      }
    }
  }

  function triggerCheckpoint(cp) {
    currentCheckpoint = cp;
    const videoEl = document.getElementById('main-video-player');
    if (videoEl) videoEl.pause();

    const overlay = document.getElementById('video-checkpoint-overlay');
    if (!overlay) return;

    document.getElementById('checkpoint-time-badge').textContent = formatTime(cp.timestampSeconds);
    document.getElementById('checkpoint-prompt').textContent = cp.prompt;

    const optionsContainer = document.getElementById('checkpoint-options');
    optionsContainer.innerHTML = (cp.options || []).map(opt => `
      <label class="flex items-center gap-2 p-3 rounded-xl bg-surface-container-high hover:bg-surface-container cursor-pointer transition-colors border border-outline-variant/30 text-xs text-on-surface">
        <input type="radio" name="checkpoint_answer" value="${opt.id}" class="accent-primary"/>
        <span class="font-bold text-primary mr-1">${opt.id}.</span>
        <span>${opt.text}</span>
      </label>
    `).join('');

    const feedbackEl = document.getElementById('checkpoint-feedback');
    feedbackEl.classList.add('hidden');
    document.getElementById('checkpoint-submit-btn').classList.remove('hidden');
    document.getElementById('checkpoint-resume-btn').classList.add('hidden');

    overlay.classList.remove('hidden');
  }

  function initInteractiveVideoHooks() {
    // Checkpoint submit button
    const submitBtn = document.getElementById('checkpoint-submit-btn');
    if (submitBtn) {
      submitBtn.onclick = async () => {
        if (!currentCheckpoint) return;
        const selected = document.querySelector('input[name="checkpoint_answer"]:checked')?.value;
        if (!selected) {
          alert('Please select an answer option.');
          return;
        }

        try {
          const res = await window.KinetiqAPI.ai.submitCheckpoint(currentCheckpoint.id, selected);
          const feedback = res.data;

          const feedbackEl = document.getElementById('checkpoint-feedback');
          feedbackEl.classList.remove('hidden');
          feedbackEl.className = feedback.isCorrect
            ? 'p-3 rounded-xl bg-secondary-container/20 border border-secondary text-secondary text-xs'
            : 'p-3 rounded-xl bg-error-container/20 border border-error text-error text-xs';
          feedbackEl.innerHTML = `
            <strong>${feedback.isCorrect ? '✅ Correct!' : '❌ Not quite correct.'}</strong>
            <p class="mt-1">${feedback.explanation || ''}</p>
          `;

          submitBtn.classList.add('hidden');
          document.getElementById('checkpoint-resume-btn').classList.remove('hidden');
        } catch (err) {
          console.error('Checkpoint submission error:', err);
        }
      };
    }

    // Checkpoint resume button
    const resumeBtn = document.getElementById('checkpoint-resume-btn');
    if (resumeBtn) {
      resumeBtn.onclick = () => {
        document.getElementById('video-checkpoint-overlay')?.classList.add('hidden');
        const videoEl = document.getElementById('main-video-player');
        if (videoEl) videoEl.play();
      };
    }

    // Explain this moment button
    const explainMomentBtn = document.getElementById('btn-explain-moment');
    if (explainMomentBtn) {
      explainMomentBtn.onclick = async () => {
        const videoEl = document.getElementById('main-video-player');
        const currentTime = videoEl ? videoEl.currentTime : 0;

        appendTutorMessage('user', `Explain what is happening in the lesson right now at ${formatTime(currentTime)}.`);
        switchTab('tab-tutor');

        const loadingId = 'tutor-moment-loading';
        const messages = document.getElementById('ai-tutor-messages');
        messages?.insertAdjacentHTML('beforeend', `
          <div id="${loadingId}" class="flex items-start gap-3 p-3.5 rounded-xl bg-surface-container text-xs text-on-surface animate-pulse">
            <span class="material-symbols-outlined text-primary text-[18px] animate-spin">smart_toy</span>
            <span>Synthesizing architectural explanation for timestamp ${formatTime(currentTime)}...</span>
          </div>
        `);
        messages && (messages.scrollTop = messages.scrollHeight);

        try {
          const res = await window.KinetiqAPI.ai.explainMoment(activeCourseId, activeLessonId, currentTime);
          document.getElementById(loadingId)?.remove();
          appendTutorMessage('assistant', res.data.explanation, res.data.sources, res.data.suggestedFollowUps);
        } catch (err) {
          document.getElementById(loadingId)?.remove();
          appendTutorMessage('assistant', 'Unable to explain moment at this time. Please try again.');
        }
      };
    }

    // New Note Form
    const noteForm = document.getElementById('add-video-note-form');
    if (noteForm) {
      noteForm.onsubmit = async (e) => {
        e.preventDefault();
        const input = document.getElementById('video-note-input');
        const text = input?.value?.trim();
        if (!text) return;

        const videoEl = document.getElementById('main-video-player');
        const currentTime = videoEl ? videoEl.currentTime : 0;

        try {
          await window.KinetiqAPI.ai.addVideoNote(activeCourseId, activeLessonId, currentTime, text);
          input.value = '';
          await loadVideoNotes(activeLessonId);
        } catch (err) {
          alert('Failed to save note: ' + err.message);
        }
      };
    }

    // Add Bookmark Button
    const bookmarkBtn = document.getElementById('btn-add-bookmark');
    if (bookmarkBtn) {
      bookmarkBtn.onclick = async () => {
        const videoEl = document.getElementById('main-video-player');
        const currentTime = videoEl ? videoEl.currentTime : 0;
        const label = prompt('Enter bookmark title:', `Key Moment @ ${formatTime(currentTime)}`);
        if (!label) return;

        try {
          await window.KinetiqAPI.ai.addVideoBookmark(activeCourseId, activeLessonId, currentTime, label);
          await loadVideoNotes(activeLessonId);
        } catch (err) {
          alert('Failed to save bookmark: ' + err.message);
        }
      };
    }
  }

  // ─── PHASE 2: NOTES & BOOKMARKS ──────────────────────────────────────────

  async function loadVideoNotes(lessonId) {
    const container = document.getElementById('video-notes-list');
    if (!container) return;

    try {
      const [notesRes, bookmarksRes] = await Promise.all([
        window.KinetiqAPI.ai.getVideoNotes(lessonId),
        window.KinetiqAPI.ai.getVideoBookmarks(lessonId),
      ]);

      activeNotes = notesRes.data || [];
      activeBookmarks = bookmarksRes.data || [];

      if (activeNotes.length === 0 && activeBookmarks.length === 0) {
        container.innerHTML = `<div class="p-6 text-center text-xs text-on-surface-variant">No notes or bookmarks saved yet for this lesson.</div>`;
        return;
      }

      container.innerHTML = `
        ${activeBookmarks.map(bm => `
          <div class="p-3 rounded-xl bg-surface-container border border-primary/20 flex items-center justify-between text-xs">
            <div onclick="seekVideo(${bm.timestampSeconds})" class="cursor-pointer flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-[18px]">bookmark</span>
              <span class="font-bold text-on-surface">${bm.label}</span>
              <span class="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-[10px]">${formatTime(bm.timestampSeconds)}</span>
            </div>
            <button onclick="deleteBookmark('${bm.id}')" class="p-1 hover:text-error text-outline transition-colors" title="Delete">
              <span class="material-symbols-outlined text-[16px]">delete</span>
            </button>
          </div>
        `).join('')}

        ${activeNotes.map(nt => `
          <div class="p-3 rounded-xl bg-surface-container border border-outline-variant/30 flex items-start justify-between text-xs space-y-1">
            <div onclick="seekVideo(${nt.timestampSeconds})" class="cursor-pointer space-y-1 flex-1 pr-2">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded bg-surface-container-high text-primary font-mono text-[10px] font-bold">${formatTime(nt.timestampSeconds)}</span>
                <span class="text-[10px] text-outline">${new Date(nt.createdAt).toLocaleTimeString()}</span>
              </div>
              <p class="text-on-surface leading-relaxed">${nt.noteText}</p>
            </div>
            <button onclick="deleteNote('${nt.id}')" class="p-1 hover:text-error text-outline transition-colors" title="Delete">
              <span class="material-symbols-outlined text-[16px]">delete</span>
            </button>
          </div>
        `).join('')}
      `;
    } catch (err) {
      console.warn('Failed to load notes/bookmarks:', err);
    }
  }

  window.deleteNote = async function (noteId) {
    if (!confirm('Delete this note?')) return;
    try {
      await window.KinetiqAPI.ai.deleteVideoNote(noteId);
      await loadVideoNotes(activeLessonId);
    } catch (err) {
      alert(err.message);
    }
  };

  window.deleteBookmark = async function (bookmarkId) {
    if (!confirm('Delete this bookmark?')) return;
    try {
      await window.KinetiqAPI.ai.deleteVideoBookmark(bookmarkId);
      await loadVideoNotes(activeLessonId);
    } catch (err) {
      alert(err.message);
    }
  };

  // ─── AI TUTOR CHAT COMPANION ─────────────────────────────────────────────

  function initTutorChat() {
    const form = document.getElementById('ai-tutor-form');
    const input = document.getElementById('ai-tutor-input');
    const messages = document.getElementById('ai-tutor-messages');
    if (!form || !input || !messages) return;

    form.onsubmit = async (e) => {
      e.preventDefault();
      const query = input.value.trim();
      if (!query) return;

      input.value = '';
      appendTutorMessage('user', query);

      // Loading bubble
      const loadingId = 'tutor-loading-' + Date.now();
      messages.insertAdjacentHTML('beforeend', `
        <div id="${loadingId}" class="flex items-start gap-3 p-3.5 rounded-xl bg-surface-container text-xs text-on-surface animate-pulse">
          <span class="material-symbols-outlined text-primary text-[18px] animate-spin">smart_toy</span>
          <span>Consulting architectural curriculum knowledge...</span>
        </div>
      `);
      messages.scrollTop = messages.scrollHeight;

      try {
        const videoEl = document.getElementById('main-video-player');
        const timestamp = videoEl ? videoEl.currentTime : undefined;

        const res = await window.KinetiqAPI.ai.askTutor(activeCourseId, query, activeLessonId, timestamp);
        document.getElementById(loadingId)?.remove();

        const data = res.data;
        appendTutorMessage('assistant', data.answer, data.sources, data.suggestedFollowUps);
      } catch (err) {
        document.getElementById(loadingId)?.remove();
        appendTutorMessage('assistant', 'I apologize, but I encountered an issue connecting to the AI Tutor service. Please try again in a moment.');
      }
    };
  }

  function appendTutorMessage(role, text, sources = [], followUps = []) {
    const messages = document.getElementById('ai-tutor-messages');
    if (!messages) return;

    const isUser = role === 'user';
    const bubble = `
      <div class="flex items-start gap-3 p-4 rounded-xl ${isUser ? 'bg-primary/10 border border-primary/20 text-on-surface ml-8' : 'bg-surface-container border border-outline-variant/30 mr-8'} text-xs space-y-2">
        <div class="shrink-0 w-7 h-7 rounded-lg ${isUser ? 'bg-primary text-on-primary' : 'bg-secondary/20 text-secondary'} flex items-center justify-center font-bold">
          <span class="material-symbols-outlined text-[16px]">${isUser ? 'person' : 'smart_toy'}</span>
        </div>
        <div class="flex-1 space-y-2">
          <div class="prose prose-invert max-w-none leading-relaxed whitespace-pre-wrap">${text}</div>
          ${sources && sources.length ? `
            <div class="pt-1 flex items-center gap-2 flex-wrap border-t border-outline-variant/20 text-[10px] text-outline">
              <span class="font-bold uppercase">Sources:</span>
              ${sources.map(s => `<span class="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-medium">${s.title}</span>`).join('')}
            </div>
          ` : ''}
          ${followUps && followUps.length ? `
            <div class="pt-2 flex items-center gap-1.5 flex-wrap">
              ${followUps.map(fu => `
                <button onclick="askQuickPrompt('${fu.replace(/'/g, "\\'")}')" type="button" class="px-2 py-1 rounded bg-surface-container-high hover:bg-surface-container-highest text-primary font-medium text-[11px] transition-colors text-left">
                  ${fu}
                </button>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;

    messages.insertAdjacentHTML('beforeend', bubble);
    messages.scrollTop = messages.scrollHeight;
  }

  window.askQuickPrompt = function (promptText) {
    const input = document.getElementById('ai-tutor-input');
    const form = document.getElementById('ai-tutor-form');
    if (input && form) {
      input.value = promptText;
      form.dispatchEvent(new Event('submit'));
    }
  };
})();
