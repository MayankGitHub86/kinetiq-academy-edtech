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

  // Global control hooks
  let updatePlayUI = function (isPlaying) {};
  let updateVolumeUI = function () {};

  function unmuteVideo() {
    const videoEl = document.getElementById('main-video-player');
    if (videoEl) {
      videoEl.muted = false;
      videoEl.volume = 1;
      updateVolumeUI();
      document.getElementById('video-muted-autoplay-badge')?.remove();
    }
  }

  function showMutedAutoplayBadge() {
    const wrapper = document.getElementById('video-player-wrapper');
    if (!wrapper || document.getElementById('video-muted-autoplay-badge')) return;

    const badge = document.createElement('button');
    badge.id = 'video-muted-autoplay-badge';
    badge.type = 'button';
    badge.className = 'absolute top-4 left-4 z-30 px-3.5 py-1.5 rounded-full bg-primary/95 text-on-primary shadow-2xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all hover:scale-105 border border-primary-fixed';
    badge.innerHTML = `
      <span class="material-symbols-outlined text-[18px]">volume_off</span>
      <span>Video Running (Muted) — Click to Unmute</span>
    `;
    badge.onclick = (e) => {
      e.stopPropagation();
      unmuteVideo();
    };
    wrapper.appendChild(badge);

    setTimeout(() => {
      badge?.remove();
    }, 12000);
  }

  function attemptAutoPlay(videoEl) {
    if (!videoEl || !videoEl.src) return;

    // Check if autoplay was explicitly suppressed
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('autoplay') === 'false' || urlParams.get('autoplay') === '0') {
      return;
    }

    // Try direct audio playback first
    const playPromise = videoEl.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        updatePlayUI(true);
      }).catch(err => {
        console.log('Unmuted autoplay restricted by browser policy. Falling back to smooth muted running autoplay...', err);
        // Browser requires muted for ungestured autoplay: mute and start running immediately!
        videoEl.muted = true;
        updateVolumeUI();
        showMutedAutoplayBadge();
        videoEl.play().then(() => {
          updatePlayUI(true);
        }).catch(e => {
          console.warn('Playback error:', e);
          updatePlayUI(false);
        });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initClassroomPlayer(); });
  } else {
    initClassroomPlayer();
  }

  async function initClassroomPlayer() {
    initVideoPlayerControls();

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
      const courseBreadcrumb = document.getElementById('course-breadcrumb-course');
      if (courseBreadcrumb) courseBreadcrumb.textContent = currentCourse.title;
      const lessonBreadcrumb = document.getElementById('course-breadcrumb-title');
      if (lessonBreadcrumb) lessonBreadcrumb.textContent = currentCourse.title;

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
      const titleEl = document.getElementById('current-lesson-title');
      if (titleEl) titleEl.textContent = currentLesson.title;
      const descEl = document.getElementById('current-lesson-desc');
      if (descEl) descEl.textContent = currentLesson.description || '';
      const breadcrumbLesson = document.getElementById('course-breadcrumb-title');
      if (breadcrumbLesson) breadcrumbLesson.textContent = currentLesson.title;

      // Find module title for breadcrumbs
      const parentSection = (currentCourse?.sections || []).find(s => (s.lessons || []).some(l => l.id === lessonId));
      if (parentSection) {
        const modEl = document.getElementById('course-breadcrumb-module');
        if (modEl) modEl.textContent = parentSection.title;
      }

      // Load Video Player
      const videoEl = document.getElementById('main-video-player');
      const noVideoMsg = document.getElementById('no-video-placeholder');

      // Resolve video URL with course-level fallback so all lessons stay playable
      let videoUrl = currentLesson.videoUrl || currentVideoAsset?.videoUrl;
      if (!videoUrl && currentCourse?.sections) {
        for (const sec of currentCourse.sections) {
          const lWithVid = (sec.lessons || []).find(l => l.videoUrl);
          if (lWithVid && lWithVid.videoUrl) {
            videoUrl = lWithVid.videoUrl;
            break;
          }
        }
      }

      if (videoUrl && videoEl) {
        const fullUrl = videoUrl.startsWith('http') ? videoUrl : `http://localhost:4000${videoUrl}`;
        videoEl.crossOrigin = 'anonymous';
        if (videoEl.src !== fullUrl) {
          videoEl.src = fullUrl;
          videoEl.load();
        }
        videoEl.classList.remove('hidden');
        if (noVideoMsg) noVideoMsg.classList.add('hidden');

        // Setup subtitles if present
        const captionsUrl = currentVideoAsset?.captionsVttUrl || (videoUrl ? videoUrl.replace(/\.mp4$/i, '.vtt') : null);
        const track = document.getElementById('main-video-track') || videoEl.querySelector('track');
        if (track && captionsUrl) {
          track.src = captionsUrl.startsWith('http') ? captionsUrl : `http://localhost:4000${captionsUrl}`;
          try {
            if (track.track) track.track.mode = 'showing';
          } catch {}
        }

        // Reset UI indicators
        resetVideoUI();

        // Auto-run video: Attempt smooth autoplay with browser-safe muted fallback
        attemptAutoPlay(videoEl);
      } else if (videoEl) {
        videoEl.classList.add('hidden');
        if (noVideoMsg) noVideoMsg.classList.remove('hidden');
      }

      // Populate Overview / Content Tab — use shared markdown renderer if available
      const overviewContainer = document.getElementById('lesson-markdown-body');
      if (overviewContainer) {
        const renderFn = window.KinetiqMarkdown?.render || formatLessonMarkdown;
        overviewContainer.innerHTML = renderFn(currentLesson.content || currentLesson.explanation || 'Lesson content is loading...');
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
      videoEl.addEventListener('timeupdate', () => {
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
      });
    }
  }

  // ─── INTERACTIVE VIDEO CONTROLS & EVENT ENGINE ────────────────────────────

  let videoControlsInitialized = false;

  function initVideoPlayerControls() {
    if (videoControlsInitialized) return;
    videoControlsInitialized = true;

    const videoEl = document.getElementById('main-video-player');
    const wrapper = document.getElementById('video-player-wrapper');
    const btnPlay = document.getElementById('video-btn-play');
    const iconPlay = document.getElementById('video-icon-play');
    const centerOverlay = document.getElementById('center-play-overlay');
    const centerIcon = document.getElementById('center-play-icon');
    const btnRewind = document.getElementById('video-btn-rewind');
    const btnForward = document.getElementById('video-btn-forward');
    const scrubberContainer = document.getElementById('video-scrubber-container');
    const progressBar = document.getElementById('video-progress-bar');
    const bufferBar = document.getElementById('video-buffer-bar');
    const scrubberThumb = document.getElementById('video-scrubber-thumb');
    const timeCurrent = document.getElementById('video-time-current');
    const timeDuration = document.getElementById('video-time-duration');
    const btnVolume = document.getElementById('video-btn-volume');
    const iconVolume = document.getElementById('video-icon-volume');
    const volumeTrack = document.getElementById('video-volume-track');
    const volumeBar = document.getElementById('video-volume-bar');
    const btnSpeed = document.getElementById('video-btn-speed');
    const speedLabel = document.getElementById('video-speed-label');
    const btnCaptions = document.getElementById('video-btn-captions');
    const btnFullscreen = document.getElementById('video-btn-fullscreen');
    const iconFullscreen = document.getElementById('video-icon-fullscreen');
    const spinner = document.getElementById('video-loading-spinner');
    const errorOverlay = document.getElementById('video-error-overlay');
    const btnRetry = document.getElementById('video-btn-retry');

    if (!videoEl) return;

    function togglePlay() {
      if (!videoEl.src) return;
      if (videoEl.paused || videoEl.ended) {
        videoEl.play().catch(err => {
          console.warn('Play prevented / gesture required:', err);
          updatePlayUI(false);
        });
      } else {
        videoEl.pause();
      }
    }

    updatePlayUI = function (isPlaying) {
      if (iconPlay) iconPlay.textContent = isPlaying ? 'pause' : 'play_arrow';
      if (centerIcon) centerIcon.textContent = isPlaying ? 'pause' : 'play_arrow';
      if (centerOverlay) {
        if (isPlaying) {
          centerOverlay.classList.add('opacity-0', 'pointer-events-none');
        } else {
          centerOverlay.classList.remove('opacity-0', 'pointer-events-none');
        }
      }
    };

    // Play / pause triggers
    btnPlay?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (videoEl.muted && document.getElementById('video-muted-autoplay-badge')) unmuteVideo();
      togglePlay();
    });
    centerOverlay?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (videoEl.muted && document.getElementById('video-muted-autoplay-badge')) unmuteVideo();
      togglePlay();
    });
    videoEl.addEventListener('click', () => {
      if (videoEl.muted && document.getElementById('video-muted-autoplay-badge')) unmuteVideo();
      togglePlay();
    });

    // Skip controls
    btnRewind?.addEventListener('click', (e) => {
      e.stopPropagation();
      videoEl.currentTime = Math.max(0, videoEl.currentTime - 10);
    });
    btnForward?.addEventListener('click', (e) => {
      e.stopPropagation();
      videoEl.currentTime = Math.min(videoEl.duration || 0, videoEl.currentTime + 10);
    });

    // Scrubber click & drag
    let isScrubbing = false;
    function seekFromScrubber(e) {
      if (!scrubberContainer || !videoEl.duration) return;
      const rect = scrubberContainer.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      videoEl.currentTime = pos * videoEl.duration;
    }

    scrubberContainer?.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      isScrubbing = true;
      seekFromScrubber(e);
    });
    window.addEventListener('mousemove', (e) => {
      if (isScrubbing) seekFromScrubber(e);
    });
    window.addEventListener('mouseup', () => {
      isScrubbing = false;
    });

    // Time & Progress Synchronization
    videoEl.addEventListener('timeupdate', () => {
      const current = videoEl.currentTime || 0;
      const duration = videoEl.duration || 0;
      if (timeCurrent) timeCurrent.textContent = formatTime(current);
      if (timeDuration && duration) timeDuration.textContent = formatTime(duration);

      const percent = duration > 0 ? (current / duration) * 100 : 0;
      if (progressBar) progressBar.style.width = `${percent}%`;
      if (scrubberThumb) scrubberThumb.style.left = `${percent}%`;

      if (videoEl.buffered.length > 0 && duration > 0) {
        try {
          const bufferedEnd = videoEl.buffered.end(videoEl.buffered.length - 1);
          if (bufferBar) bufferBar.style.width = `${Math.min(100, (bufferedEnd / duration) * 100)}%`;
        } catch {}
      }
    });

    videoEl.addEventListener('loadedmetadata', () => {
      if (timeDuration && videoEl.duration) {
        timeDuration.textContent = formatTime(videoEl.duration);
      }
      spinner?.classList.add('hidden');
      errorOverlay?.classList.add('hidden');
    });

    // State changes
    videoEl.addEventListener('play', () => updatePlayUI(true));
    videoEl.addEventListener('playing', () => {
      updatePlayUI(true);
      spinner?.classList.add('hidden');
      errorOverlay?.classList.add('hidden');
    });
    videoEl.addEventListener('pause', () => updatePlayUI(false));
    videoEl.addEventListener('ended', () => {
      updatePlayUI(false);
      if (progressBar) progressBar.style.width = '100%';
    });
    videoEl.addEventListener('waiting', () => spinner?.classList.remove('hidden'));
    videoEl.addEventListener('canplay', () => {
      spinner?.classList.add('hidden');
      errorOverlay?.classList.add('hidden');
    });

    // Error handling & recovery
    videoEl.addEventListener('error', () => {
      spinner?.classList.add('hidden');
      errorOverlay?.classList.remove('hidden');
      const err = videoEl.error;
      const msg = err ? `Error code ${err.code}: ${err.message || 'Stream decode failure'}` : 'Failed to load video stream';
      const descEl = document.getElementById('video-error-desc');
      if (descEl) descEl.textContent = msg;
    });

    btnRetry?.addEventListener('click', (e) => {
      e.stopPropagation();
      errorOverlay?.classList.add('hidden');
      spinner?.classList.remove('hidden');
      const currentSrc = videoEl.src;
      videoEl.src = '';
      setTimeout(() => {
        videoEl.src = currentSrc;
        videoEl.load();
        videoEl.play().catch(() => {});
      }, 200);
    });

    // Volume & Mute
    let lastVolume = 1;
    updateVolumeUI = function () {
      const isMuted = videoEl.muted || videoEl.volume === 0;
      const curVol = isMuted ? 0 : videoEl.volume;
      if (volumeBar) volumeBar.style.width = `${curVol * 100}%`;
      if (iconVolume) {
        if (isMuted) iconVolume.textContent = 'volume_off';
        else if (curVol < 0.5) iconVolume.textContent = 'volume_down';
        else iconVolume.textContent = 'volume_up';
      }
    };

    btnVolume?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (videoEl.muted || videoEl.volume === 0) {
        videoEl.muted = false;
        videoEl.volume = lastVolume || 1;
      } else {
        lastVolume = videoEl.volume;
        videoEl.muted = true;
      }
      updateVolumeUI();
    });

    volumeTrack?.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = volumeTrack.getBoundingClientRect();
      const vol = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      videoEl.muted = false;
      videoEl.volume = vol;
      lastVolume = vol;
      updateVolumeUI();
    });

    // Speed cycling (1.0x, 1.25x, 1.5x, 2.0x, 0.75x)
    const speeds = [1.0, 1.25, 1.5, 2.0, 0.75];
    let speedIdx = 0;
    btnSpeed?.addEventListener('click', (e) => {
      e.stopPropagation();
      speedIdx = (speedIdx + 1) % speeds.length;
      const rate = speeds[speedIdx];
      videoEl.playbackRate = rate;
      if (speedLabel) speedLabel.textContent = `${rate}x`;
    });

    // Captions toggle
    btnCaptions?.addEventListener('click', (e) => {
      e.stopPropagation();
      const track = videoEl.textTracks?.[0];
      if (track) {
        const isShowing = track.mode === 'showing';
        track.mode = isShowing ? 'hidden' : 'showing';
        btnCaptions.classList.toggle('text-primary', !isShowing);
        btnCaptions.classList.toggle('text-outline', isShowing);
      }
    });

    // Fullscreen toggle
    btnFullscreen?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!document.fullscreenElement) {
        wrapper?.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    document.addEventListener('fullscreenchange', () => {
      if (iconFullscreen) {
        iconFullscreen.textContent = document.fullscreenElement ? 'fullscreen_exit' : 'fullscreen';
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.code === 'Space' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        videoEl.currentTime = Math.max(0, videoEl.currentTime - 10);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        videoEl.currentTime = Math.min(videoEl.duration || 0, videoEl.currentTime + 10);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        videoEl.muted = !videoEl.muted;
        updateVolumeUI();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (!document.fullscreenElement) wrapper?.requestFullscreen().catch(() => {});
        else document.exitFullscreen().catch(() => {});
      }
    });

    // Auto-hide controls bar during active playback
    let hideTimer = null;
    wrapper?.addEventListener('mousemove', () => {
      const bar = document.getElementById('custom-video-controls');
      if (bar) bar.style.opacity = '1';
      clearTimeout(hideTimer);
      if (!videoEl.paused) {
        hideTimer = setTimeout(() => {
          if (bar && !videoEl.paused) bar.style.opacity = '0';
        }, 3000);
      }
    });
    wrapper?.addEventListener('mouseleave', () => {
      const bar = document.getElementById('custom-video-controls');
      if (bar && !videoEl.paused) bar.style.opacity = '0';
    });
  }

  function resetVideoUI() {
    const progressBar = document.getElementById('video-progress-bar');
    const bufferBar = document.getElementById('video-buffer-bar');
    const scrubberThumb = document.getElementById('video-scrubber-thumb');
    const timeCurrent = document.getElementById('video-time-current');
    const centerOverlay = document.getElementById('center-play-overlay');
    const iconPlay = document.getElementById('video-icon-play');
    const centerIcon = document.getElementById('center-play-icon');
    const errorOverlay = document.getElementById('video-error-overlay');
    const spinner = document.getElementById('video-loading-spinner');

    if (progressBar) progressBar.style.width = '0%';
    if (bufferBar) bufferBar.style.width = '0%';
    if (scrubberThumb) scrubberThumb.style.left = '0%';
    if (timeCurrent) timeCurrent.textContent = '00:00';
    if (iconPlay) iconPlay.textContent = 'play_arrow';
    if (centerIcon) centerIcon.textContent = 'play_arrow';
    if (centerOverlay) centerOverlay.classList.remove('opacity-0', 'pointer-events-none');
    if (errorOverlay) errorOverlay.classList.add('hidden');
    if (spinner) spinner.classList.add('hidden');
  }

  window.seekVideo = function (seconds) {
    const videoEl = document.getElementById('main-video-player');
    if (videoEl) {
      videoEl.currentTime = seconds;
      videoEl.play().catch(() => {});
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

  function formatLessonMarkdown(md) {
    if (!md) return '';

    // Handle code blocks first to protect them from inner regexes
    const codeBlocks = [];
    let processed = md.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push({ lang: lang || 'code', code });
      return `@@CODE_BLOCK_${idx}@@`;
    });

    // Escape basic html in text
    processed = processed
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Headings
    processed = processed
      .replace(/^### (.*$)/gim, '<h3 class="text-base font-bold text-on-surface mt-6 mb-2 flex items-center gap-2"><span class="w-1.5 h-4 rounded-full bg-secondary"></span>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-primary mt-8 mb-3 pb-1 border-b border-outline-variant/30 flex items-center gap-2"><span class="w-2 h-5 rounded-full bg-primary"></span>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-on-surface mt-8 mb-4 tracking-tight">$1</h1>');

    // Bold & italic
    processed = processed
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-on-surface font-bold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="text-on-surface-variant italic">$1</em>');

    // Inline code
    processed = processed.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-surface-container-high text-primary font-mono text-xs border border-outline-variant/30">$1</code>');

    // Blockquotes
    processed = processed.replace(/^\&gt;\s?(.*$)/gim, '<blockquote class="p-3 my-3 rounded-xl bg-surface-container border-l-4 border-secondary text-on-surface-variant italic">$1</blockquote>');

    // Lists
    processed = processed.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="ml-4 list-disc text-on-surface-variant text-xs leading-relaxed my-1">$1</li>');
    processed = processed.replace(/^\s*(\d+)\.\s+(.*$)/gim, '<li class="ml-4 list-decimal text-on-surface-variant text-xs leading-relaxed my-1"><strong class="text-on-surface">$1.</strong> $2</li>');

    // Paragraph line breaks
    processed = processed.replace(/\n\n/g, '<div class="my-3"></div>');

    // Restore code blocks
    codeBlocks.forEach((cb, idx) => {
      const escapedCode = cb.code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const htmlBlock = `
        <div class="my-4 rounded-xl overflow-hidden border border-outline-variant/40 bg-surface-container-lowest shadow-lg">
          <div class="px-4 py-2 bg-surface-container flex items-center justify-between border-b border-outline-variant/30 text-[11px] font-mono text-outline">
            <span class="uppercase font-bold text-primary">${cb.lang}</span>
            <span>Production Implementation</span>
          </div>
          <pre class="p-4 text-xs font-mono leading-relaxed text-secondary overflow-x-auto whitespace-pre"><code>${escapedCode}</code></pre>
        </div>
      `;
      processed = processed.replace(`@@CODE_BLOCK_${idx}@@`, htmlBlock);
    });

    return processed;
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
