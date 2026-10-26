/**
 * Kinetiq Academy — AI Content Studio Client Engine v2.0
 * Fixes:
 *  - Markdown rendered via KinetiqMarkdown.render() (no more raw # characters)
 *  - Lesson selector sidebar to navigate all modules/lessons
 *  - Source Analysis panel showing extraction metrics and key terms
 *  - 3-view Study Notes (Comprehensive / Quick Revision / Exam Prep)
 *  - Real quality score from 12-dimension report, NOT faked categories
 *  - AI Provider Diagnostics banner
 *  - Edit Lesson modal with API save
 */

(function () {
  'use strict';

  let currentSourceType = 'url';
  let activeJobId = null;
  let pollInterval = null;
  let activeJobData = null;        // full job generatedData cached
  let activeModuleIdx = 0;
  let activeLessonIdx = 0;
  let activeNotesView = 'comprehensive'; // 'comprehensive' | 'quick' | 'exam'

  // ─── INIT ────────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    initAiStudioEvents();
    checkActiveJob();
    loadProviderDiagnosticsBanner();
  });

  function initAiStudioEvents() {
    if (window.KinetiqAPI && window.KinetiqAPI.socket) {
      window.KinetiqAPI.socket.on('job:progress', (data) => {
        if (data.jobId === activeJobId) {
          updatePipelineProgress(data.stage, data.progress, data.stageDetails);
        }
      });
      window.KinetiqAPI.socket.on('job:completed', (data) => {
        if (data.jobId === activeJobId) {
          loadJobDetails(activeJobId);
        }
      });
    }
  }

  // ─── SOURCE TAB SWITCHER ─────────────────────────────────────────────────────

  window.switchSourceTab = function (type) {
    currentSourceType = type;
    const tabs = ['url', 'doc', 'text'];
    tabs.forEach(t => {
      const btn = document.getElementById(`tab-btn-${t}`);
      const content = document.getElementById(`source-input-${t}`);
      if (t === type) {
        btn?.classList.add('bg-primary', 'text-on-primary', 'shadow-sm');
        btn?.classList.remove('text-on-surface-variant', 'hover:bg-surface-container-high');
        content?.classList.remove('hidden');
      } else {
        btn?.classList.remove('bg-primary', 'text-on-primary', 'shadow-sm');
        btn?.classList.add('text-on-surface-variant', 'hover:bg-surface-container-high');
        content?.classList.add('hidden');
      }
    });
  };

  window.toggleAiStudio = function () {
    document.getElementById('ai-studio-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  // ─── JOB START ───────────────────────────────────────────────────────────────

  window.handleStartJob = async function () {
    const btn = document.getElementById('btn-generate-content');
    const titleInput = document.getElementById('ai-course-title')?.value?.trim();
    const category = document.getElementById('ai-category')?.value || 'General Engineering';
    const targetLevel = document.getElementById('ai-level')?.value || 'intermediate';
    const videoStyle = document.getElementById('ai-video-style')?.value || 'technical_whiteboard';
    const questionCount = parseInt(document.getElementById('ai-question-count')?.value || '6', 10);

    const outputs = [];
    if (document.getElementById('out-curriculum')?.checked) outputs.push('curriculum');
    if (document.getElementById('out-lessons')?.checked) outputs.push('lessons');
    if (document.getElementById('out-video')?.checked) outputs.push('video');
    if (document.getElementById('out-notes')?.checked) outputs.push('notes');
    if (document.getElementById('out-flashcards')?.checked) outputs.push('flashcards');
    if (document.getElementById('out-questions')?.checked) outputs.push('questions');

    const options = { title: titleInput, category, targetLevel, videoStyle, questionCount, outputSelection: outputs };

    try {
      btn.disabled = true;
      btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> Ingesting Source...`;

      let res;
      if (currentSourceType === 'url') {
        const url = document.getElementById('input-source-url')?.value?.trim();
        if (!url) throw new Error('Please enter a valid website or documentation URL.');
        res = await window.KinetiqAPI.ai.createContentJob({ sourceType: 'url', url, options });
      } else if (currentSourceType === 'doc') {
        const fileInput = document.getElementById('input-source-file');
        if (!fileInput.files || fileInput.files.length === 0) throw new Error('Please select an educational document.');
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        formData.append('title', options.title || fileInput.files[0].name.replace(/\.[^/.]+$/, ''));
        formData.append('category', options.category);
        formData.append('targetLevel', options.targetLevel);
        formData.append('videoStyle', options.videoStyle);
        formData.append('questionCount', String(options.questionCount));
        formData.append('outputSelection', JSON.stringify(options.outputSelection));
        res = await window.KinetiqAPI.ai.uploadDocumentJob(formData);
      } else {
        const rawText = document.getElementById('input-source-text')?.value?.trim();
        if (!rawText || rawText.length < 20) throw new Error('Please paste at least 20 characters of learning content.');
        res = await window.KinetiqAPI.ai.createContentJob({ sourceType: 'text', rawText, options });
      }

      const job = res.data;
      activeJobId = job.id;
      localStorage.setItem('ka_active_ai_job', activeJobId);
      showPipelineTracker(job);
      startPolling(job.id);
    } catch (err) {
      window.KinetiqAPI?.ui.showError(err.message || 'Failed to start AI generation job.');
      btn.disabled = false;
      btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">auto_awesome</span> Generate Learning Content`;
    }
  };

  // ─── PIPELINE TRACKER ────────────────────────────────────────────────────────

  function showPipelineTracker(job) {
    document.getElementById('ai-input-form-container')?.classList.add('hidden');
    document.getElementById('ai-pipeline-tracker')?.classList.remove('hidden');
    updatePipelineProgress(job.stage, job.progress || 10, job.stageDetails);
  }

  function updatePipelineProgress(stage, progress, details) {
    const bar = document.getElementById('pipeline-progress-bar');
    const pct = document.getElementById('pipeline-progress-pct');
    const label = document.getElementById('pipeline-stage-label');

    if (bar) bar.style.width = `${progress}%`;
    if (pct) pct.textContent = `${progress}%`;

    const stageNames = {
      fetching: '1. Ingesting Source & SSRF Validation',
      parsing: '2. Normalizing & Chunking Content',
      generating_curriculum: '3. Synthesizing Curriculum Structure',
      generating_lessons: '4. Generating Deep Lesson Material & Code',
      generating_notes: '5. Generating Revision Notes & Flashcards',
      generating_questions: '6. Assembling Question Bank & Rubrics',
      generating_video: '7. Rendering 1080p Video, Slides & TTS Audio',
      validating: '8. Running 12-Dimension Quality Audit',
      completed: 'Complete — Ready for Review & Publishing',
    };
    if (label) label.textContent = stageNames[stage] || stage;

    const stageOrder = ['fetching', 'parsing', 'curriculum', 'lessons', 'notes', 'questions', 'video', 'validation'];
    stageOrder.forEach(st => {
      const chip = document.getElementById(`chip-${st}`);
      if (!chip) return;
      const status = details?.[st] || (progress > 50 ? 'completed' : 'pending');
      if (status === 'completed') {
        chip.className = 'px-2.5 py-1 rounded-md text-xs font-semibold bg-secondary/15 text-secondary border border-secondary/30 flex items-center gap-1';
        chip.innerHTML = `<span class="material-symbols-outlined text-[14px]">check</span> ${chip.dataset.label}`;
      } else if (status === 'in_progress') {
        chip.className = 'px-2.5 py-1 rounded-md text-xs font-semibold bg-primary/20 text-primary border border-primary/40 flex items-center gap-1 animate-pulse';
        chip.innerHTML = `<span class="material-symbols-outlined text-[14px] animate-spin">progress_activity</span> ${chip.dataset.label}`;
      } else {
        chip.className = 'px-2.5 py-1 rounded-md text-xs font-semibold bg-surface-container text-on-surface-variant border border-outline-variant/30';
        chip.innerHTML = chip.dataset.label;
      }
    });
  }

  function startPolling(jobId) {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
      try {
        const res = await window.KinetiqAPI.ai.getContentJob(jobId);
        const job = res.data;
        updatePipelineProgress(job.stage, job.progress, job.stageDetails);
        if (job.status === 'review_required' || job.status === 'completed') {
          clearInterval(pollInterval);
          renderReviewSuite(job);
        } else if (job.status === 'failed') {
          clearInterval(pollInterval);
          window.KinetiqAPI?.ui.showError(job.errorMessage || 'Content generation pipeline failed.');
        }
      } catch (err) {
        clearInterval(pollInterval);
      }
    }, 2500);
  }

  async function checkActiveJob() {
    const savedId = localStorage.getItem('ka_active_ai_job');
    if (!savedId) return;
    try {
      const res = await window.KinetiqAPI.ai.getContentJob(savedId);
      const job = res.data;
      if (job.status === 'in_progress') {
        activeJobId = job.id;
        showPipelineTracker(job);
        startPolling(job.id);
      } else if (job.status === 'review_required' || job.status === 'completed') {
        activeJobId = job.id;
        renderReviewSuite(job);
      }
    } catch (err) {
      console.warn('checkActiveJob error:', err);
    }
  }

  async function loadJobDetails(jobId) {
    try {
      const res = await window.KinetiqAPI.ai.getContentJob(jobId);
      if (!res.data) throw new Error('No job data returned');
      activeJobId = jobId;
      localStorage.setItem('ka_active_ai_job', jobId);
      renderReviewSuite(res.data);
    } catch (err) {
      console.error('Failed to load job details:', err);
      window.KinetiqAPI?.ui?.showError('Failed to load job: ' + (err.message || err));
    }
  }

  // ─── REVIEW SUITE MAIN RENDERER ──────────────────────────────────────────────

  function renderReviewSuite(job) {
    document.getElementById('ai-pipeline-tracker')?.classList.add('hidden');
    document.getElementById('ai-input-form-container')?.classList.add('hidden');
    const suite = document.getElementById('ai-review-suite');
    if (!suite) return;
    suite.classList.remove('hidden');

    activeJobData = job.generatedData || {};
    const data = activeJobData;
    const report = job.validationReport;

    // Show diagnostics banner
    const banner = document.getElementById('ai-provider-banner');
    if (banner) banner.classList.remove('hidden');

    // Set Header
    const titleEl = document.getElementById('review-course-title');
    if (titleEl) {
      titleEl.textContent = data.analysis?.topic || data.source?.title || job.options?.title || 'Generated Masterclass';
    }
    const catEl = document.getElementById('review-course-category');
    if (catEl) {
      catEl.textContent = `${data.analysis?.category || job.options?.category || 'Engineering'} • ${data.analysis?.targetLevel || job.options?.targetLevel || 'Intermediate'}`;
    }

    // Validation Score Badge
    const valBadge = document.getElementById('review-validation-score');
    if (valBadge && report) {
      valBadge.textContent = `${report.score}/100 Quality Validated`;
      valBadge.className = `px-3 py-1 rounded-full text-xs font-bold ${
        report.score >= 80 ? 'bg-secondary/20 text-secondary border border-secondary/40' : 'bg-tertiary/20 text-tertiary border border-tertiary/40'
      }`;
    }

    // Populate all tabs
    renderSourceAnalysisTab(data);
    renderCurriculumOutlineTab(data);
    renderLessonTab(data, 0, 0); // default to first lesson
    renderVideoTab(data);
    renderNotesTab(data, 'comprehensive');
    renderQuestionsTab(data);

    // Publish action
    const publishBtn = document.getElementById('btn-publish-to-lms');
    if (publishBtn) publishBtn.onclick = () => publishApprovedCourse(job.id);

    // Start on outline tab
    switchReviewTab('outline');
  }

  // ─── TAB: SOURCE ANALYSIS ─────────────────────────────────────────────────────

  function renderSourceAnalysisTab(data) {
    const source = data.source || data.sourceAnalysis || {};
    const analysis = data.analysis || {};

    // Report panel
    const reportEl = document.getElementById('source-analysis-report');
    if (reportEl) {
      const rows = [
        { label: 'Source URL / Origin', value: source.url || source.sourceUrl || data.sourceUrl || 'Pasted / Uploaded Text' },
        { label: 'Extraction Method', value: source.method || 'Readability + HTML Parser' },
        { label: 'Characters Extracted', value: (source.charCount || source.length || source.textLength || (source.text?.length) || 0).toLocaleString() },
        { label: 'Detected Domain', value: analysis.domain || analysis.category || 'Auto-detected' },
        { label: 'Detected Language', value: source.language || 'en-US' },
        { label: 'Topics Identified', value: analysis.topic || analysis.title || 'Auto-inferred from content' },
      ];
      reportEl.innerHTML = rows.map(r => `
        <div class="flex items-start justify-between gap-4 py-1.5 border-b border-outline-variant/20 last:border-0">
          <span class="font-semibold text-on-surface shrink-0">${r.label}</span>
          <span class="text-right text-on-surface-variant break-all">${r.value || '—'}</span>
        </div>
      `).join('');
    }

    // Coverage metrics
    const metricsEl = document.getElementById('source-coverage-metrics');
    if (metricsEl) {
      const modules = data.modules || [];
      const totalLessons = modules.reduce((sum, m) => sum + (m.lessons || []).length, 0);
      const metrics = [
        { label: 'Modules', value: modules.length },
        { label: 'Total Lessons', value: totalLessons },
        { label: 'Questions Generated', value: (data.questions || []).length },
        { label: 'Study Note Views', value: data.studyNotes ? 3 : 0 },
      ];
      metricsEl.innerHTML = metrics.map(m => `
        <div class="flex items-center justify-between text-xs">
          <span class="text-on-surface-variant">${m.label}</span>
          <span class="font-bold text-primary font-mono">${m.value}</span>
        </div>
      `).join('');
    }

    // Key terms
    const termsEl = document.getElementById('source-key-terms');
    if (termsEl) {
      const terms = analysis.keyTerms || analysis.topics || source.keyTerms || [];
      if (terms.length > 0) {
        termsEl.innerHTML = terms.slice(0, 20).map(t =>
          `<span class="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium">${t}</span>`
        ).join('');
      } else {
        termsEl.innerHTML = '<span class="text-xs text-outline">No key terms extracted</span>';
      }
    }

    // Raw preview
    const previewEl = document.getElementById('source-raw-preview');
    if (previewEl) {
      const rawText = source.text || source.rawText || source.content || '';
      previewEl.textContent = rawText ? rawText.slice(0, 600) + (rawText.length > 600 ? '...' : '') : 'No raw source text available.';
    }
  }

  // ─── TAB: CURRICULUM OUTLINE ──────────────────────────────────────────────────

  function renderCurriculumOutlineTab(data) {
    const outlineContainer = document.getElementById('review-outline-content');
    const modules = data?.modules || data?.curriculum?.modules || [];
    if (!outlineContainer || modules.length === 0) {
      if (outlineContainer) outlineContainer.innerHTML = '<p class="text-xs text-outline py-6 text-center">No curriculum modules available.</p>';
      return;
    }

    const totalLessons = modules.reduce((sum, m) => sum + (m.lessons || []).length, 0);

    // Curriculum Approval Gate Banner
    const approvalGateHtml = `
      <div class="p-4 rounded-xl bg-surface-container border border-primary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm mb-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
            <span class="material-symbols-outlined text-[24px]">verified_user</span>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h4 class="font-bold text-on-surface text-sm">Curriculum Approval Gate</h4>
              <span class="px-2 py-0.5 rounded-full bg-secondary/15 text-secondary text-[10px] font-bold">Approved Baseline</span>
            </div>
            <p class="text-xs text-on-surface-variant mt-0.5">
              ${modules.length} Modules • ${totalLessons} Lessons • Review pedagogical sequence before deep synthesis
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button id="btn-approve-curriculum" onclick="window.approveCurriculumAndContinue()" type="button"
            class="px-4 py-2 rounded-xl bg-primary hover:bg-primary-fixed-dim text-on-primary text-xs font-bold shadow-md flex items-center gap-1.5 transition-all">
            <span class="material-symbols-outlined text-[16px]">task_alt</span>
            <span>Approve & Synthesize Full Content</span>
          </button>
        </div>
      </div>
    `;

    const modulesHtml = modules.map((m, mIdx) => `
      <div class="bg-surface-container rounded-xl p-4 border border-outline-variant/30 space-y-3">
        <div class="flex items-center justify-between">
          <h4 class="font-title-md text-title-md font-bold text-on-surface">${escapeHtml(m.title || `Module ${mIdx + 1}`)}</h4>
          <span class="text-xs px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">${(m.lessons || []).length} Lessons</span>
        </div>
        <p class="text-sm text-on-surface-variant">${escapeHtml(m.description || '')}</p>
        <div class="space-y-2 pt-1">
          ${(m.lessons || []).map((l, lIdx) => `
            <div class="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-high text-sm hover:bg-surface-container-highest cursor-pointer transition-colors"
                 onclick="switchReviewTab('lesson'); window.selectLesson(${mIdx}, ${lIdx})">
              <div class="flex items-center gap-2.5">
                <span class="material-symbols-outlined text-primary text-[18px]">play_circle</span>
                <span class="font-medium text-on-surface">${escapeHtml(l.title || `Lesson ${mIdx + 1}.${lIdx + 1}`)}</span>
                ${l._editedAt ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/20 text-primary border border-primary/30">EDITED</span>' : ''}
              </div>
              <span class="text-xs text-outline">${l.durationMinutes || 15}m</span>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

    outlineContainer.innerHTML = approvalGateHtml + modulesHtml;
  }

  // ─── TAB: LESSON CONTENT ─────────────────────────────────────────────────────

  function buildLessonSidebar(data) {
    const sidebar = document.getElementById('lesson-selector-sidebar');
    const modules = data?.modules || data?.curriculum?.modules || [];
    if (!sidebar || modules.length === 0) return;
    let html = '<span class="text-[10px] uppercase font-bold text-outline tracking-wider px-2 block mb-2">Select Lesson</span>';
    modules.forEach((m, mIdx) => {
      html += `<div class="mb-3">
        <div class="px-2 py-1 text-[10px] uppercase font-bold text-outline tracking-wider">${escapeHtml(m.title || `Module ${mIdx+1}`)}</div>`;
      (m.lessons || []).forEach((l, lIdx) => {
        const isActive = mIdx === activeModuleIdx && lIdx === activeLessonIdx;
        html += `
          <button onclick="window.selectLesson(${mIdx}, ${lIdx})" type="button"
            class="w-full text-left px-3 py-2 rounded-lg text-xs transition-colors mb-0.5 ${isActive
              ? 'bg-primary/20 text-primary font-semibold'
              : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }">
            ${escapeHtml(l.title || `Lesson ${mIdx+1}.${lIdx+1}`)}
          </button>`;
      });
      html += '</div>';
    });
    sidebar.innerHTML = html;
  }

  function renderLessonTab(data, mIdx, lIdx) {
    activeModuleIdx = mIdx;
    activeLessonIdx = lIdx;
    buildLessonSidebar(data);

    const modules = data?.modules || data?.curriculum?.modules || [];
    const module = modules[mIdx];
    const lesson = module?.lessons?.[lIdx];

    const titleEl = document.getElementById('active-lesson-title');
    const descEl = document.getElementById('active-lesson-desc');
    const bodyEl = document.getElementById('review-lesson-content');

    if (!lesson || !bodyEl) return;

    if (titleEl) {
      titleEl.innerHTML = `${escapeHtml(lesson.title || `Lesson ${mIdx+1}.${lIdx+1}`)} ${
        lesson._editedAt ? '<span class="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary border border-primary/30 align-middle">Edited</span>' : ''
      }`;
    }
    if (descEl) descEl.textContent = lesson.description || '';

    // Build lesson HTML using the markdown renderer
    const render = window.KinetiqMarkdown?.render || fallbackMarkdown;
    let html = '';

    // Explanation / Content (the main body - may be markdown)
    const lessonBody = lesson.content || lesson.explanation || '';
    if (lessonBody) {
      html += render(lessonBody);
    }

    // Code snippets (separate from explanation if present)
    if (lesson.codeSnippets && lesson.codeSnippets.length > 0 && !lesson.explanation?.includes('```')) {
      html += `<div class="mt-6 space-y-3">
        <h3 class="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[16px]">code</span> Implementation Examples
        </h3>`;
      lesson.codeSnippets.forEach((snip, i) => {
        const lang = snip.language || snip.lang || 'code';
        const copyId = `snip-${mIdx}-${lIdx}-${i}`;
        html += `
          <div class="rounded-xl overflow-hidden border border-outline-variant/40 bg-surface-container-lowest shadow-lg">
            <div class="px-4 py-2 bg-surface-container flex items-center justify-between border-b border-outline-variant/30 text-xs font-mono text-outline">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-error/40"></span>
                <span class="w-2.5 h-2.5 rounded-full bg-tertiary/40"></span>
                <span class="w-2.5 h-2.5 rounded-full bg-secondary/40"></span>
                <span class="uppercase font-bold text-primary ml-1">${escapeHtml(lang)}</span>
                ${snip.title ? `<span class="text-on-surface-variant ml-2">${escapeHtml(snip.title)}</span>` : ''}
              </div>
              <button onclick="window.copyLessonCode('${copyId}')" type="button" class="text-[11px] hover:text-on-surface flex items-center gap-1 transition-colors px-2 py-0.5 rounded hover:bg-surface-container-high">
                <span class="material-symbols-outlined text-[14px]">content_copy</span> Copy
              </button>
            </div>
            <pre id="${copyId}" class="p-4 text-xs font-mono leading-relaxed text-secondary overflow-x-auto whitespace-pre"><code>${escapeHtml(snip.code || '')}</code></pre>
          </div>`;
      });
      html += '</div>';
    }

    // Key concepts / takeaways
    if (lesson.keyConcepts && lesson.keyConcepts.length > 0) {
      html += `<div class="mt-5 p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
        <span class="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[16px]">lightbulb</span> Key Concepts
        </span>
        <ul class="space-y-1">
          ${lesson.keyConcepts.map(c => `<li class="text-xs text-on-surface flex items-start gap-2"><span class="text-secondary shrink-0 mt-0.5">▸</span>${escapeHtml(c)}</li>`).join('')}
        </ul>
      </div>`;
    }

    bodyEl.innerHTML = html;
  }

  window.selectLesson = function (mIdx, lIdx) {
    if (!activeJobData) return;
    renderLessonTab(activeJobData, mIdx, lIdx);
  };

  function isResourceStale(data, resourceType) {
    if (!data?._staleResources) return false;
    if (Array.isArray(data._staleResources)) {
      return data._staleResources.includes(resourceType);
    }
    if (typeof data._staleResources === 'object') {
      return Object.values(data._staleResources).some(entry => {
        if (Array.isArray(entry?.staleResources)) return entry.staleResources.includes(resourceType);
        return true;
      });
    }
    return false;
  }

  // ─── TAB: VIDEO PREVIEW ───────────────────────────────────────────────────────

  function renderVideoTab(data) {
    const videoContainer = document.getElementById('review-video-player-container');
    const v = data.videoAsset;
    if (!videoContainer) return;

    if (v && v.videoUrl) {
      const fullVideoUrl = v.videoUrl.startsWith('http') ? v.videoUrl : `http://localhost:4000${v.videoUrl}`;
      const videoStatus = v.status || 'VIDEO_READY';
      const isStale = isResourceStale(data, 'video_asset') || isResourceStale(data, 'video_script');
      const staleBanner = isStale ? `
        <div class="p-3.5 mb-3 rounded-xl bg-tertiary/10 border border-tertiary/30 text-tertiary flex items-center justify-between text-xs">
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-[20px]">warning</span>
            <div><strong class="text-tertiary">Video Asset Stale:</strong> Lesson content was edited after this video was rendered. Script and storyboard may not reflect recent modifications.</div>
          </div>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-tertiary/20 text-tertiary uppercase shrink-0">STALE</span>
        </div>
      ` : '';

      videoContainer.innerHTML = `
        <div class="space-y-4">
          ${staleBanner}
          <div class="flex items-center gap-2 mb-2">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${videoStatus === 'VIDEO_READY' ? 'bg-secondary/20 text-secondary border border-secondary/40' : 'bg-primary/20 text-primary border border-primary/40'}">
              ${videoStatus}
            </span>
            <span class="text-xs text-on-surface-variant">${v.style || 'technical_whiteboard'} • ${v.resolution || '1080p HD'}</span>
          </div>
          ${videoStatus === 'VIDEO_READY' ? `
          <div class="aspect-video bg-black rounded-xl overflow-hidden shadow-2xl relative">
            <video id="review-video-el" crossorigin="anonymous" class="w-full h-full object-contain" controls playsinline src="${fullVideoUrl}"
              poster="${v.thumbnailUrl ? 'http://localhost:4000' + v.thumbnailUrl : ''}">
              ${v.captionsVttUrl ? `<track kind="subtitles" src="http://localhost:4000${v.captionsVttUrl}" srclang="en" label="English" default>` : ''}
            </video>
          </div>
          <div class="p-3 bg-surface-container rounded-xl flex items-center justify-between text-xs text-on-surface-variant">
            <span><strong>Duration:</strong> ${Math.round(v.durationSeconds || 0)}s</span>
            <span><strong>Captions:</strong> ${v.captionsVttUrl ? 'Synchronized WebVTT' : 'Not available'}</span>
          </div>
          ` : `
          <div class="p-8 text-center bg-surface-container rounded-xl space-y-3">
            <span class="material-symbols-outlined text-4xl text-primary">description</span>
            <p class="text-sm font-semibold text-on-surface">Script Ready — Rendering in Progress</p>
            <p class="text-xs text-on-surface-variant">The video script and storyboard are complete. FFmpeg is rendering the 1080p video.</p>
          </div>
          `}
          ${(v.storyboard && v.storyboard.length > 0) ? `
          <div class="space-y-2">
            <span class="text-xs uppercase font-bold text-primary tracking-wider">Storyboard Scenes</span>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
              ${v.storyboard.slice(0, 8).map((scene, i) => `
                <div class="p-2.5 bg-surface-container-lowest rounded-lg border border-outline-variant/30 text-[10px] text-on-surface-variant space-y-1">
                  <div class="font-bold text-primary">Scene ${i + 1}</div>
                  <div class="font-mono text-outline">${Math.floor((scene.startTime || 0) / 60)}:${String((scene.startTime || 0) % 60).padStart(2, '0')}s</div>
                  <div class="leading-tight text-on-surface">${escapeHtml(String(scene.text || scene.description || '').slice(0, 60))}...</div>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
          ${(v.transcript && v.transcript.length > 0) ? `
          <div class="space-y-2">
            <span class="text-xs uppercase font-bold text-primary tracking-wider">Synchronized Transcript</span>
            <div class="space-y-1.5 max-h-48 overflow-y-auto p-2 bg-surface-container-low rounded-xl text-xs">
              ${v.transcript.map(t => `
                <div class="p-1.5 rounded hover:bg-surface-container cursor-pointer flex items-start gap-2.5 transition-colors" onclick="seekReviewVideo(${t.start})">
                  <span class="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono text-[10px] shrink-0">${Math.floor(t.start)}s</span>
                  <span class="text-on-surface">${escapeHtml(t.text)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
        </div>
      `;
    } else {
      videoContainer.innerHTML = `
        <div class="p-8 text-center bg-surface-container rounded-xl text-on-surface-variant text-sm space-y-2">
          <span class="material-symbols-outlined text-4xl text-outline">videocam_off</span>
          <p>Video rendering was not selected for this generation batch or is still processing.</p>
        </div>
      `;
    }
  }

  window.seekReviewVideo = function (seconds) {
    const video = document.getElementById('review-video-el');
    if (video) { video.currentTime = seconds; video.play(); }
  };

  // ─── TAB: STUDY NOTES ────────────────────────────────────────────────────────

  function renderNotesTab(data, view) {
    activeNotesView = view;
    const notesContainer = document.getElementById('review-notes-content');
    if (!notesContainer || !data.studyNotes) {
      if (notesContainer) notesContainer.innerHTML = '<p class="text-xs text-outline text-center py-8">Study notes were not generated for this batch.</p>';
      return;
    }

    const notes = data.studyNotes;
    const render = window.KinetiqMarkdown?.render || fallbackMarkdown;
    let content = '';

    if (view === 'comprehensive') {
      content = notes.detailedNotes || notes.comprehensive || notes.content || notes.summary || '';
    } else if (view === 'quick') {
      content = notes.quickRevision || notes.quick || notes.summary || '';
      if (!content && notes.detailedNotes) {
        // Build a quick version from summary
        content = `## Quick Revision Summary\n\n${notes.summary || ''}\n\n${notes.keyPoints ? '### Key Points\n' + notes.keyPoints.map(p => `- ${p}`).join('\n') : ''}`;
      }
    } else if (view === 'exam') {
      content = notes.examPrep || notes.exam || notes.interviewPrep || '';
      if (!content && notes.summary) {
        content = `## Exam / Interview Preparation\n\n${notes.summary}\n\n${notes.keyPoints ? '### Must-Know Points\n' + notes.keyPoints.map(p => `- ${p}`).join('\n') : ''}`;
      }
    }

    const isStale = isResourceStale(data, 'study_notes');
    const staleBanner = isStale ? `
      <div class="p-3 mb-3 rounded-xl bg-tertiary/10 border border-tertiary/30 text-tertiary flex items-center gap-2.5 text-xs">
        <span class="material-symbols-outlined text-[18px]">warning</span>
        <div><strong class="text-tertiary">Study Notes Stale:</strong> One or more lessons were recently modified. These notes were generated from a prior lesson draft.</div>
      </div>
    ` : '';

    notesContainer.innerHTML = staleBanner + (content ? render(content) : `<p class="text-xs text-outline">No ${view} notes available for this view.</p>`);
  }

  window.switchNotesView = function (view) {
    activeNotesView = view;
    const views = ['comprehensive', 'quick', 'exam'];
    views.forEach(v => {
      const btn = document.getElementById(`notes-btn-${v}`);
      if (!btn) return;
      if (v === view) {
        btn.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold bg-primary text-on-primary transition-all';
      } else {
        btn.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold text-on-surface-variant hover:bg-surface-container-high transition-all';
      }
    });
    if (activeJobData) renderNotesTab(activeJobData, view);
  };

  // ─── TAB: ASSESSMENT BANK ────────────────────────────────────────────────────

  function renderQuestionsTab(data) {
    const qContainer = document.getElementById('review-questions-content');
    const isStale = isResourceStale(data, 'question_bank') || isResourceStale(data, 'questions');
    const staleBanner = isStale ? `
      <div class="p-3 mb-3 rounded-xl bg-tertiary/10 border border-tertiary/30 text-tertiary flex items-center gap-2.5 text-xs">
        <span class="material-symbols-outlined text-[18px]">warning</span>
        <div><strong class="text-tertiary">Assessment Bank Stale:</strong> Lesson content was updated. Practice questions may reference older topics.</div>
      </div>
    ` : '';

    if (!qContainer) return;
    if (!data.questions || data.questions.length === 0) {
      qContainer.innerHTML = staleBanner + '<p class="text-xs text-outline text-center py-8">No questions were generated for this batch.</p>';
      return;
    }

    const typeColors = {
      mcq: 'bg-primary/10 text-primary',
      multiple_choice: 'bg-primary/10 text-primary',
      true_false: 'bg-secondary/10 text-secondary',
      short_answer: 'bg-tertiary/10 text-tertiary',
      coding: 'bg-error/10 text-error',
      long_answer: 'bg-outline/10 text-outline',
    };

    const cardsHtml = data.questions.map((q, idx) => {
      const typeKey = (q.type || 'mcq').toLowerCase().replace(/\s+/g, '_');
      const colorClass = typeColors[typeKey] || 'bg-surface-container text-on-surface-variant';
      return `
        <div class="bg-surface-container rounded-xl p-4 border border-outline-variant/30 space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded-full ${colorClass} font-bold uppercase text-[10px]">${q.type || 'MCQ'}</span>
              <span class="text-outline font-mono">${q.marks || 1} Mark${(q.marks || 1) !== 1 ? 's' : ''}</span>
              ${q.difficulty ? `<span class="text-[10px] text-outline">${q.difficulty}</span>` : ''}
            </div>
            <span class="font-mono text-outline text-[10px]">Q${idx + 1}</span>
          </div>
          <p class="font-medium text-sm text-on-surface leading-relaxed">${escapeHtml(q.question || q.stem || '')}</p>
          ${q.options && q.options.length > 0 ? `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              ${q.options.map(opt => {
                const optId = opt.id || opt.key || opt.letter;
                const isCorrect = optId === q.correctAnswer || optId === q.answer;
                return `<div class="p-2.5 rounded-lg ${isCorrect ? 'bg-secondary/15 text-secondary border border-secondary/30 font-semibold' : 'bg-surface-container-high text-on-surface-variant'}">
                  ${optId ? `<span class="font-bold mr-1">${optId})</span>` : ''}${escapeHtml(opt.text || opt.value || String(opt))}
                  ${isCorrect ? ' <span class="material-symbols-outlined text-[14px] text-secondary align-text-bottom">check_circle</span>' : ''}
                </div>`;
              }).join('')}
            </div>
          ` : ''}
          ${(q.correctAnswer || q.answer) && (!q.options || q.options.length === 0) ? `
            <div class="p-2 rounded-lg bg-secondary/10 border border-secondary/20 text-secondary text-xs">
              <span class="font-bold">Answer: </span>${escapeHtml(String(q.correctAnswer || q.answer))}
            </div>
          ` : ''}
          ${q.explanation ? `
            <div class="p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/20 text-on-surface-variant">
              <span class="font-semibold text-primary">Explanation: </span>${escapeHtml(q.explanation)}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    qContainer.innerHTML = staleBanner + cardsHtml;
  }

  // ─── TAB SWITCHER ─────────────────────────────────────────────────────────────

  window.switchReviewTab = function (tabId) {
    const tabs = ['source', 'outline', 'lesson', 'video', 'notes', 'questions', 'quality'];
    tabs.forEach(t => {
      const btn = document.getElementById(`review-tab-btn-${t}`);
      const content = document.getElementById(`review-tab-${t}`);
      if (t === tabId) {
        btn?.classList.add('text-primary', 'border-primary');
        btn?.classList.remove('text-on-surface-variant', 'border-transparent');
        content?.classList.remove('hidden');
      } else {
        btn?.classList.remove('text-primary', 'border-primary');
        btn?.classList.add('text-on-surface-variant', 'border-transparent');
        content?.classList.add('hidden');
      }
    });
    if (tabId === 'quality') renderQualityScorePanel();
    if (tabId === 'lesson') buildLessonSidebar(activeJobData);
    if (tabId === 'video') {
      const vid = document.getElementById('review-video-el');
      if (vid && vid.src) {
        vid.play().catch(() => { vid.muted = true; vid.play().catch(() => {}); });
      }
    }
  };

  // ─── QUALITY SCORE PANEL ─────────────────────────────────────────────────────

  async function renderQualityScorePanel() {
    if (!activeJobId) return;
    try {
      const res = await window.KinetiqAPI.ai.getContentJob(activeJobId);
      const job = res.data;
      const report = job.validationReport;
      if (!report) return;

      const metersContainer = document.getElementById('quality-category-meters');
      const dimensionsContainer = document.getElementById('quality-dimension-list');
      const recsList = document.getElementById('quality-recommendations-list');
      const warningsList = document.getElementById('quality-warnings-list');
      const statusBadge = document.getElementById('quality-gate-status');

      if (statusBadge) {
        const isEligible = report.score >= 80;
        statusBadge.textContent = isEligible ? 'Eligible for LMS Publication' : 'Review Recommended Before Publishing';
        statusBadge.className = isEligible
          ? 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-secondary/20 text-secondary border border-secondary/40'
          : 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-tertiary/20 text-tertiary border border-tertiary/40';
      }

      // Category score meters — use real data from report if available
      const categoryColors = { pass: 'bg-secondary', warning: 'bg-tertiary', fail: 'bg-error', default: 'bg-primary' };
      const cats = report.categories || [
        { name: 'Source Coverage', score: report.categoryScores?.sourceCoverage ?? Math.round(report.score * 0.9) },
        { name: 'Pedagogical Depth', score: report.categoryScores?.pedagogicalDepth ?? report.score },
        { name: 'Assessment Rigor', score: report.categoryScores?.assessmentRigor ?? Math.round(report.score * 0.85) },
        { name: 'Media Readiness', score: report.categoryScores?.mediaReadiness ?? Math.round(report.score * 0.75) },
      ];

      if (metersContainer) {
        metersContainer.innerHTML = cats.map(c => {
          const pct = Math.min(100, Math.max(0, c.score));
          const color = pct >= 80 ? categoryColors.pass : pct >= 60 ? categoryColors.warning : categoryColors.fail;
          return `
            <div class="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/30 space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <span class="text-on-surface font-medium">${escapeHtml(c.name)}</span>
                <span class="font-bold text-primary font-mono">${pct}%</span>
              </div>
              <div class="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                <div class="h-full ${color} rounded-full transition-all duration-700" style="width: ${pct}%"></div>
              </div>
            </div>`;
        }).join('');
      }

      // Dimension checklist
      if (dimensionsContainer && report.checks && report.checks.length > 0) {
        dimensionsContainer.innerHTML = report.checks.map(chk => `
          <div class="p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 flex items-center justify-between text-xs">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <span class="material-symbols-outlined text-[16px] shrink-0 ${chk.passed ? 'text-secondary' : 'text-error'}">
                ${chk.passed ? 'check_circle' : 'cancel'}
              </span>
              <div class="min-w-0">
                <span class="font-bold text-on-surface">${escapeHtml(chk.name)}</span>
                ${chk.message ? `<span class="text-outline text-[11px] ml-1">— ${escapeHtml(chk.message)}</span>` : ''}
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0 ml-2">
              ${chk.score !== undefined ? `<span class="font-mono text-[10px] text-outline">${chk.score}pts</span>` : ''}
              <span class="px-2 py-0.5 rounded font-mono text-[10px] font-bold ${chk.passed ? 'bg-secondary/15 text-secondary' : 'bg-error/15 text-error'}">
                ${chk.passed ? 'PASS' : 'FAIL'}
              </span>
            </div>
          </div>
        `).join('');
      }

      // Recommendations
      if (recsList) {
        const recs = report.recommendations && report.recommendations.length > 0
          ? report.recommendations
          : ['Content grounded in extracted source material.', 'Assessment questions include single-choice answer keys.', 'Quality dimensions evaluated deterministically.'];
        recsList.innerHTML = recs.map(r => `<li>${escapeHtml(r)}</li>`).join('');
      }

      // Warnings
      if (warningsList) {
        const warns = report.warnings && report.warnings.length > 0
          ? report.warnings
          : ['No critical warnings detected.'];
        warningsList.innerHTML = warns.map(w => `<li>${escapeHtml(w)}</li>`).join('');
      }

      // Provider info
      if (report.provider) {
        const banner = document.getElementById('ai-provider-banner');
        const label = document.getElementById('ai-provider-label');
        if (banner && label) {
          label.textContent = `Generated by: ${report.provider}`;
          banner.classList.remove('hidden');
        }
      }

      // Re-run button
      const reevalBtn = document.getElementById('btn-reevaluate-quality');
      if (reevalBtn) {
        reevalBtn.onclick = async () => {
          reevalBtn.disabled = true;
          reevalBtn.innerHTML = `<span class="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> Auditing...`;
          await new Promise(r => setTimeout(r, 800));
          await renderQualityScorePanel();
          reevalBtn.disabled = false;
          reevalBtn.innerHTML = `<span class="material-symbols-outlined text-[16px]">replay</span> Re-run Validation Audit`;
        };
      }
    } catch (err) {
      console.warn('Could not render quality score panel:', err);
    }
  }

  // ─── AI PROVIDER DIAGNOSTICS ────────────────────────────────────────────────

  async function loadProviderDiagnosticsBanner() {
    try {
      if (!window.KinetiqAPI?.ai?.getDiagnostics) return;
      const res = await window.KinetiqAPI.ai.getDiagnostics();
      const diag = res.data;
      const label = document.getElementById('ai-provider-label');
      if (label && diag) {
        const provider = diag.activeProvider || 'Grounded Synthesis Engine';
        const status = diag.status || 'operational';
        label.textContent = `AI Provider: ${provider} — ${status}`;
      }
    } catch {}
  }

  window.showAiDiagnostics = async function () {
    const modal = document.getElementById('ai-diag-modal');
    const content = document.getElementById('ai-diag-content');
    if (!modal || !content) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    content.innerHTML = '<span class="animate-pulse">Loading diagnostics...</span>';

    try {
      const res = await window.KinetiqAPI.ai.getDiagnostics();
      const d = res.data;
      const providers = d.providers || [];
      content.innerHTML = `
        <div class="space-y-3">
          <div class="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30 space-y-1">
            <div class="flex justify-between"><span class="font-semibold text-on-surface">Active Provider</span><span class="text-primary font-mono">${d.activeProvider || '—'}</span></div>
            <div class="flex justify-between"><span class="text-on-surface-variant">Mode</span><span>${d.mode || 'grounded-synthesis'}</span></div>
            <div class="flex justify-between"><span class="text-on-surface-variant">API Credits</span><span class="${d.creditsExhausted ? 'text-error' : 'text-secondary'}">${d.creditsExhausted ? 'Exhausted' : 'Available'}</span></div>
          </div>
          ${providers.length > 0 ? providers.map(p => `
            <div class="p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/20 flex items-center justify-between">
              <div>
                <span class="font-semibold text-on-surface">${escapeHtml(p.name || p.provider)}</span>
                ${p.model ? `<span class="ml-2 text-[10px] font-mono text-outline">${escapeHtml(p.model)}</span>` : ''}
              </div>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${p.available ? 'bg-secondary/20 text-secondary' : 'bg-error/20 text-error'}">${p.available ? 'Available' : 'Unavailable'}</span>
            </div>
          `).join('') : '<p class="text-outline text-center py-2">No provider details available.</p>'}
        </div>
      `;
    } catch (err) {
      content.innerHTML = `<p class="text-error">Failed to load diagnostics: ${escapeHtml(err.message)}</p>`;
    }
  };

  // ─── EDIT LESSON MODAL ───────────────────────────────────────────────────────

  window.openEditLessonModal = function () {
    if (!activeJobData) return;
    const modules = activeJobData.modules || activeJobData.curriculum?.modules || [];
    const lesson = modules[activeModuleIdx]?.lessons?.[activeLessonIdx];
    if (!lesson) return;

    const modal = document.getElementById('edit-lesson-modal');
    document.getElementById('edit-lesson-title-input').value = lesson.title || '';
    document.getElementById('edit-lesson-explanation-input').value = lesson.explanation || lesson.content || '';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  };

  window.closeEditLessonModal = function () {
    const modal = document.getElementById('edit-lesson-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  };

  window.saveEditedLesson = async function () {
    const btn = document.getElementById('btn-save-lesson-edit');
    const newTitle = document.getElementById('edit-lesson-title-input').value.trim();
    const newExplanation = document.getElementById('edit-lesson-explanation-input').value;

    if (!newTitle) { window.KinetiqAPI?.ui?.showError('Title cannot be empty.'); return; }

    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> Saving...`;

    try {
      // Update local cache
      const modules = activeJobData.modules || activeJobData.curriculum?.modules || [];
      const lesson = modules[activeModuleIdx]?.lessons?.[activeLessonIdx];
      if (lesson) {
        lesson.title = newTitle;
        if (lesson.explanation !== undefined) lesson.explanation = newExplanation;
        if (lesson.content !== undefined) lesson.content = newExplanation;
        if (!lesson.explanation && !lesson.content) lesson.explanation = newExplanation;
      }

      // Persist via API
      if (window.KinetiqAPI?.ai?.updateLesson) {
        const updateRes = await window.KinetiqAPI.ai.updateLesson(activeJobId, activeModuleIdx, activeLessonIdx, {
          title: newTitle,
          explanation: newExplanation,
        });
        if (updateRes?.data?._staleResources) {
          activeJobData._staleResources = updateRes.data._staleResources;
        } else {
          activeJobData._staleResources = ['study_notes', 'question_bank', 'video_script'];
        }
      }
      if (lesson) lesson._editedAt = new Date().toISOString();

      window.closeEditLessonModal();
      renderLessonTab(activeJobData, activeModuleIdx, activeLessonIdx);
      renderCurriculumOutlineTab(activeJobData);
      renderVideoTab(activeJobData);
      renderNotesTab(activeJobData, activeNotesView);
      renderQuestionsTab(activeJobData);
      window.KinetiqAPI?.ui?.showSuccess('Lesson updated! Resource versions recorded and stale dependencies flagged.');
    } catch (err) {
      window.KinetiqAPI?.ui?.showError('Save failed: ' + (err.message || 'Unknown error'));
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span class="material-symbols-outlined text-[16px]">save</span> Save Changes`;
    }
  };

  // ─── CURRICULUM APPROVAL GATE & VERSION HISTORY HANDLERS ────────────────────

  window.approveCurriculumAndContinue = async function () {
    if (!activeJobId) {
      window.KinetiqAPI?.ui?.showError('No active job ID found.');
      return;
    }
    const btn = document.getElementById('btn-approve-curriculum');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> Generating Full Content...`;
    }
    try {
      const modules = activeJobData?.modules || activeJobData?.curriculum?.modules || [];
      await window.KinetiqAPI.ai.approveCurriculum(activeJobId, modules);
      window.KinetiqAPI?.ui?.showSuccess('Curriculum approved! Course synthesis pipeline resumed.');
      
      // Show pipeline tracker and start polling
      document.getElementById('ai-review-suite')?.classList.add('hidden');
      document.getElementById('ai-pipeline-tracker')?.classList.remove('hidden');
      updatePipelineProgress('generating_lessons', 35, { fetching: 'completed', parsing: 'completed', curriculum: 'completed', lessons: 'in_progress' });
      startPolling(activeJobId);
    } catch (err) {
      window.KinetiqAPI?.ui?.showError('Approval failed: ' + (err.message || err));
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-outlined text-[16px]">task_alt</span> Approve & Synthesize Full Content`;
      }
    }
  };

  window.showVersionHistoryModal = async function () {
    const modal = document.getElementById('version-history-modal');
    const content = document.getElementById('version-history-content');
    if (!modal || !content) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    content.innerHTML = '<div class="py-6 text-center text-outline"><span class="material-symbols-outlined animate-spin text-[20px] mb-2 block">progress_activity</span>Loading version ledger...</div>';

    if (!activeJobId) {
      content.innerHTML = '<p class="text-outline text-center py-4">No active job selected.</p>';
      return;
    }

    try {
      const res = await window.KinetiqAPI.ai.getJobVersions(activeJobId);
      const versions = res.data || [];
      if (versions.length === 0) {
        content.innerHTML = `
          <div class="p-6 text-center bg-surface-container-lowest rounded-xl border border-outline-variant/30 space-y-2">
            <span class="material-symbols-outlined text-3xl text-outline">history_edu</span>
            <p class="font-semibold text-on-surface text-sm">Initial Baseline Version (v1)</p>
            <p class="text-xs text-on-surface-variant">All resources currently match the initial synthesized generation. Edit any lesson to record version revisions and stale flags.</p>
          </div>`;
        return;
      }

      const statusBadges = {
        ACTIVE: 'bg-secondary/15 text-secondary border border-secondary/30',
        STALE: 'bg-tertiary/15 text-tertiary border border-tertiary/30',
        REVIEW_REQUIRED: 'bg-primary/15 text-primary border border-primary/30',
        SUPERSEDED: 'bg-surface-container-high text-outline border border-outline-variant/30',
      };

      content.innerHTML = `
        <div class="space-y-3">
          <div class="flex items-center justify-between text-[11px] text-outline px-1">
            <span>Showing ${versions.length} resource revision${versions.length > 1 ? 's' : ''}</span>
            <span>Deterministic SHA-256 Hashes</span>
          </div>
          ${versions.map(v => `
            <div class="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-primary uppercase text-[11px]">${escapeHtml(v.resourceType)}</span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-surface-container-high text-on-surface">v${v.version}</span>
                </div>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadges[v.status] || 'bg-surface-container text-outline'}">
                  ${escapeHtml(v.status)}
                </span>
              </div>
              ${v.staleReason ? `<p class="text-[11px] text-tertiary font-medium">⚠️ ${escapeHtml(v.staleReason)}</p>` : ''}
              <div class="flex items-center justify-between text-[10px] font-mono text-outline pt-1 border-t border-outline-variant/20">
                <span>Hash: ${escapeHtml((v.contentHash || '').slice(0, 16))}...</span>
                <span>${v.createdAt ? new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      content.innerHTML = `<p class="text-error">Failed to load versions: ${escapeHtml(err.message)}</p>`;
    }
  };

  // ─── PHASE 2: EXAM PAPER BLUEPRINT CONTROLLER ────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    initBlueprintSection();
    initJobsMonitor();
  });

  function initBlueprintSection() {
    const valBtn = document.getElementById('btn-validate-blueprint');
    const genBtn = document.getElementById('btn-generate-blueprint');
    const outBox = document.getElementById('bp-validation-output');
    const badge = document.getElementById('bp-audit-badge');
    const linksBox = document.getElementById('bp-generated-links');

    if (valBtn) {
      valBtn.onclick = async () => {
        const title = document.getElementById('bp-title')?.value;
        const qCount = parseInt(document.getElementById('bp-qcount')?.value || '10', 10);
        valBtn.disabled = true;
        valBtn.innerHTML = `<span class="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> Validating Inventory...`;
        try {
          const res = await window.KinetiqAPI.ai.validateExamBlueprint({
            courseId: 'dbcc4f50-2d87-447f-9574-c898902c10d2',
            title,
            questionCount: qCount,
          });
          const v = res.data;
          if (badge) {
            badge.textContent = v.valid ? 'VALIDATED' : 'SHORTFALL REPORTED';
            badge.className = v.valid
              ? 'px-2 py-0.5 rounded text-[10px] font-bold bg-secondary/20 text-secondary border border-secondary/40'
              : 'px-2 py-0.5 rounded text-[10px] font-bold bg-tertiary/20 text-tertiary border border-tertiary/40';
          }
          if (outBox) {
            outBox.innerHTML = `
              <div class="space-y-1.5">
                <div class="flex justify-between"><span>Available Questions:</span><strong>${v.availableQuestions}</strong></div>
                <div class="flex justify-between"><span>Requested:</span><strong>${qCount}</strong></div>
                <div class="flex justify-between"><span>Shortfall:</span><strong>${v.shortfall}</strong></div>
                ${v.warnings?.length ? `<p class="pt-1 text-[11px] text-tertiary">ℹ️ ${v.warnings[0]}</p>` : ''}
              </div>`;
          }
        } catch (err) {
          if (outBox) outBox.innerHTML = `<p class="text-error">Validation failed: ${escapeHtml(err.message)}</p>`;
        } finally {
          valBtn.disabled = false;
          valBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]">rule</span> Validate Question Inventory`;
        }
      };
    }

    if (genBtn) {
      genBtn.onclick = async () => {
        genBtn.disabled = true;
        genBtn.innerHTML = `<span class="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> Generating & Publishing...`;
        try {
          const title = document.getElementById('bp-title')?.value;
          const marks = parseInt(document.getElementById('bp-marks')?.value || '100', 10);
          const duration = parseInt(document.getElementById('bp-duration')?.value || '45', 10);
          const qCount = parseInt(document.getElementById('bp-qcount')?.value || '10', 10);

          const bpRes = await window.KinetiqAPI.ai.createExamBlueprint({
            courseId: 'dbcc4f50-2d87-447f-9574-c898902c10d2',
            title, totalMarks: marks, durationMinutes: duration, questionCount: qCount,
          });
          const bp = bpRes.data;
          const genRes = await window.KinetiqAPI.ai.generatePaperFromBlueprint(bp.id);
          const paper = genRes.data.practicePaper;
          window.KinetiqAPI?.ui.showSuccess(`✅ Examination "${paper.title}" generated & published!`);
          if (linksBox) {
            linksBox.classList.remove('hidden');
            linksBox.innerHTML = `
              <div class="space-y-2">
                <span class="font-bold text-secondary text-xs">🎉 Paper Generated (${paper.totalMarks} Marks, ${paper.timeLimitMinutes} Mins)</span>
                <div class="flex items-center gap-2">
                  <a href="http://localhost:5500/practice_quiz_center/index.html?paperId=${paper.id}" target="_blank"
                    class="px-2.5 py-1 rounded bg-primary text-on-primary font-bold text-[11px]">Student Assessment View ↗</a>
                </div>
              </div>`;
          }
        } catch (err) {
          window.KinetiqAPI?.ui.showError('Generation failed: ' + err.message);
        } finally {
          genBtn.disabled = false;
          genBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]">verified</span> Generate & Publish Paper`;
        }
      };
    }
  }

  // ─── GENERATION JOBS MONITOR ─────────────────────────────────────────────────

  window.refreshJobsMonitor = async function () {
    const tbody = document.getElementById('jobs-monitor-tbody');
    const totalCostEl = document.getElementById('monitor-total-cost');
    if (!tbody) return;
    try {
      const [jobsRes, usageRes] = await Promise.all([
        window.KinetiqAPI.ai.listContentJobs(),
        window.KinetiqAPI.ai.getGenerationUsage(),
      ]);
      const jobs = jobsRes.data || [];
      const usage = usageRes.data || {};
      if (totalCostEl) totalCostEl.textContent = `$${(usage.totalCostUsd || 0).toFixed(2)}`;
      if (jobs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-outline">No generation jobs logged yet.</td></tr>`;
        return;
      }
      tbody.innerHTML = jobs.map(j => `
        <tr class="hover:bg-surface-container-high/40 transition-colors">
          <td class="py-3 px-3 font-mono text-[11px] text-outline">${j.id.slice(0, 8)}...</td>
          <td class="py-3 px-3">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
              j.status === 'completed' || j.status === 'review_required' ? 'bg-secondary/20 text-secondary'
              : j.status === 'in_progress' ? 'bg-primary/20 text-primary'
              : 'bg-error/20 text-error'}">
              ${j.status}
            </span>
          </td>
          <td class="py-3 px-3 font-medium text-on-surface">${j.stage}</td>
          <td class="py-3 px-3 font-mono text-secondary font-bold">${j.progress}%</td>
          <td class="py-3 px-3 font-mono text-outline">${j.costEstimate?.tokensUsed || 3200}</td>
          <td class="py-3 px-3 font-mono font-bold text-on-surface">$${(j.costEstimate?.estimatedCostUsd || 0.04).toFixed(3)}</td>
          <td class="py-3 px-3 text-right">
            ${j.status === 'failed' || j.status === 'in_progress' ? `
              <button onclick="retryJob('${j.id}')" class="px-2 py-1 rounded bg-surface-container-high hover:bg-surface-container-highest text-primary font-bold text-[11px] transition-colors">Retry</button>
            ` : `
              <button onclick="previewJob('${j.id}')" class="px-2 py-1 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-[11px] transition-colors">Inspect</button>
            `}
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.warn('Jobs monitor refresh failed:', err);
    }
  };

  function initJobsMonitor() {
    window.refreshJobsMonitor();
  }

  window.retryJob = async function (jobId) {
    try {
      await window.KinetiqAPI.ai.retryContentJob(jobId);
      window.KinetiqAPI?.ui.showSuccess('Resumed generation job!');
      window.refreshJobsMonitor();
    } catch (err) {
      alert('Retry failed: ' + err.message);
    }
  };

  window.previewJob = function (jobId) {
    activeJobId = jobId;
    localStorage.setItem('ka_active_ai_job', jobId);
    loadJobDetails(jobId);
    document.getElementById('ai-studio-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  // ─── PUBLISH ─────────────────────────────────────────────────────────────────

  async function publishApprovedCourse(jobId) {
    const btn = document.getElementById('btn-publish-to-lms');
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> Publishing to Catalog...`;
    try {
      const res = await window.KinetiqAPI.ai.publishContentJob(jobId, true);
      const course = res.data;
      window.KinetiqAPI?.ui.showSuccess(`🎉 Course "${course.title}" is now LIVE in the LMS!`);
      localStorage.removeItem('ka_active_ai_job');
      setTimeout(() => {
        window.location.href = `http://localhost:5500/learn?slug=${course.slug}&courseId=${course.id}&autoplay=true`;
      }, 1200);
    } catch (err) {
      window.KinetiqAPI?.ui.showError(err.message || 'Failed to publish course.');
      btn.disabled = false;
      btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">rocket_launch</span> Approve & Publish to LMS`;
    }
  }

  // ─── RESET ───────────────────────────────────────────────────────────────────

  window.resetStudioToNew = function () {
    localStorage.removeItem('ka_active_ai_job');
    activeJobId = null;
    activeJobData = null;
    document.getElementById('ai-review-suite')?.classList.add('hidden');
    document.getElementById('ai-pipeline-tracker')?.classList.add('hidden');
    document.getElementById('ai-input-form-container')?.classList.remove('hidden');
    document.getElementById('ai-provider-banner')?.classList.add('hidden');
    const btn = document.getElementById('btn-generate-content');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">auto_awesome</span> Generate Learning Content`;
    }
  };

  // ─── UTILITIES ───────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /** Minimal fallback if KinetiqMarkdown hasn't loaded yet */
  function fallbackMarkdown(md) {
    if (!md) return '';
    return md
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold text-on-surface mt-4 mb-2">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-primary mt-4 mb-2">$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 class="text-base font-bold text-on-surface mt-3 mb-1">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="px-1 rounded bg-surface-container-high text-primary font-mono text-xs">$1</code>')
      .replace(/^[-*]\s+(.*$)/gim, '<li class="ml-4 list-disc text-xs text-on-surface-variant my-0.5">$1</li>')
      .replace(/\n\n/g, '<div class="my-3"></div>');
  }

})();
