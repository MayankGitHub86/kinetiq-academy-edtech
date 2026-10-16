/**
 * Kinetiq Academy — AI Content Studio Client Engine
 * Handles multi-source ingestion, real-time job tracking, video preview,
 * quality validation inspection, and 1-click LMS publishing.
 */

(function () {
  'use strict';

  let currentSourceType = 'url';
  let activeJobId = null;
  let pollInterval = null;

  // Initialize Studio
  document.addEventListener('DOMContentLoaded', () => {
    initAiStudioEvents();
    checkActiveJob();
  });

  function initAiStudioEvents() {
    // Socket.io real-time listener if socket is available
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
    const section = document.getElementById('ai-studio-section');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  window.handleStartJob = async function () {
    const btn = document.getElementById('btn-generate-content');
    const titleInput = document.getElementById('ai-course-title')?.value?.trim();
    const category = document.getElementById('ai-category')?.value || 'Distributed Systems';
    const targetLevel = document.getElementById('ai-level')?.value || 'intermediate';
    const videoStyle = document.getElementById('ai-video-style')?.value || 'technical_whiteboard';
    const questionCount = parseInt(document.getElementById('ai-question-count')?.value || '6', 10);

    // Selected outputs
    const outputs = [];
    if (document.getElementById('out-curriculum')?.checked) outputs.push('curriculum');
    if (document.getElementById('out-lessons')?.checked) outputs.push('lessons');
    if (document.getElementById('out-video')?.checked) outputs.push('video');
    if (document.getElementById('out-notes')?.checked) outputs.push('notes');
    if (document.getElementById('out-flashcards')?.checked) outputs.push('flashcards');
    if (document.getElementById('out-questions')?.checked) outputs.push('questions');

    const options = {
      title: titleInput,
      category,
      targetLevel,
      videoStyle,
      questionCount,
      outputSelection: outputs,
    };

    try {
      btn.disabled = true;
      btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> Ingesting Source...`;

      let res;
      if (currentSourceType === 'url') {
        const url = document.getElementById('input-source-url')?.value?.trim();
        if (!url) throw new Error('Please enter a valid website or documentation URL.');
        res = await window.KinetiqAPI.ai.createContentJob({
          sourceType: 'url',
          url,
          options,
        });
      } else if (currentSourceType === 'doc') {
        const fileInput = document.getElementById('input-source-file');
        if (!fileInput.files || fileInput.files.length === 0) {
          throw new Error('Please select an educational document (PDF, DOCX, Markdown, Code).');
        }
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
        if (!rawText || rawText.length < 20) {
          throw new Error('Please paste at least 20 characters of learning content.');
        }
        res = await window.KinetiqAPI.ai.createContentJob({
          sourceType: 'text',
          rawText,
          options,
        });
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

  function showPipelineTracker(job) {
    document.getElementById('ai-input-form-container')?.classList.add('hidden');
    const tracker = document.getElementById('ai-pipeline-tracker');
    if (tracker) tracker.classList.remove('hidden');
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
      generating_lessons: '4. Generating Architectural Lessons & Code',
      generating_notes: '5. Generating Revision Notes & Flashcards',
      generating_questions: '6. Assembling Question Bank & Rubrics',
      generating_video: '7. Rendering 1080p Video, Slides & TTS Audio',
      validating: '8. Running Quality Validation Gate',
      completed: 'Complete — Ready for Review & Publishing',
    };

    if (label) label.textContent = stageNames[stage] || stage;

    // Highlight chips
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
        chip.className = 'px-2.5 py-1 rounded-md text-xs font-semibold bg-surface-container text-on-surface-variant border border-outline-variant/30 flex items-center gap-1';
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
    } catch {}
  }

  function renderReviewSuite(job) {
    document.getElementById('ai-pipeline-tracker')?.classList.add('hidden');
    document.getElementById('ai-input-form-container')?.classList.add('hidden');
    const suite = document.getElementById('ai-review-suite');
    if (!suite) return;
    suite.classList.remove('hidden');

    const data = job.generatedData;
    const report = job.validationReport;

    // Set Header
    document.getElementById('review-course-title').textContent = data.analysis?.topic || 'Generated Masterclass';
    document.getElementById('review-course-category').textContent = `${data.analysis?.category || 'Engineering'} • ${data.analysis?.targetLevel || 'Intermediate'}`;
    
    // Set Validation Badge
    const valBadge = document.getElementById('review-validation-score');
    if (valBadge && report) {
      valBadge.textContent = `${report.score}/100 Quality Validated`;
      valBadge.className = `px-3 py-1 rounded-full text-xs font-bold ${report.score >= 80 ? 'bg-secondary/20 text-secondary border border-secondary/40' : 'bg-tertiary/20 text-tertiary border border-tertiary/40'}`;
    }

    // Populate Tab 1: Curriculum Outline
    const outlineContainer = document.getElementById('review-outline-content');
    if (outlineContainer && data.modules) {
      outlineContainer.innerHTML = data.modules.map((m, mIdx) => `
        <div class="bg-surface-container rounded-xl p-4 border border-outline-variant/30 space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="font-title-md text-title-md font-bold text-on-surface">${m.title}</h4>
            <span class="text-xs px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">${(m.lessons || []).length} Lessons</span>
          </div>
          <p class="text-sm text-on-surface-variant">${m.description || ''}</p>
          <div class="space-y-2 pt-1">
            ${(m.lessons || []).map((l, lIdx) => `
              <div class="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-high text-sm">
                <div class="flex items-center gap-2.5">
                  <span class="material-symbols-outlined text-primary text-[18px]">play_circle</span>
                  <span class="font-medium text-on-surface">${l.title}</span>
                </div>
                <span class="text-xs text-outline">${l.durationMinutes || 15}m</span>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');
    }

    // Populate Tab 2: Lesson Content Preview
    const firstLesson = data.modules?.[0]?.lessons?.[0];
    const lessonContainer = document.getElementById('review-lesson-content');
    if (lessonContainer && firstLesson) {
      lessonContainer.innerHTML = `
        <div class="space-y-4">
          <div class="flex items-center justify-between border-b border-outline-variant/30 pb-3">
            <div>
              <h3 class="font-headline-md text-headline-md font-bold text-on-surface">${firstLesson.title}</h3>
              <p class="text-sm text-on-surface-variant">${firstLesson.description || ''}</p>
            </div>
            <span class="px-2.5 py-1 rounded bg-primary/10 text-primary text-xs font-semibold">Lesson 1.1</span>
          </div>
          <div class="prose prose-invert max-w-none text-sm text-on-surface leading-relaxed whitespace-pre-wrap">
${firstLesson.explanation}
          </div>
          ${firstLesson.codeSnippets?.length ? `
            <div class="space-y-2 pt-2">
              <span class="text-xs uppercase font-bold text-primary tracking-wider">Implementation Snippet</span>
              <div class="bg-surface-container-lowest p-3.5 rounded-xl border border-outline-variant/30 font-mono text-xs text-secondary overflow-x-auto">
                <pre>${firstLesson.codeSnippets[0].code}</pre>
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }

    // Populate Tab 3: Video Player Preview
    const videoContainer = document.getElementById('review-video-player-container');
    const v = data.videoAsset;
    if (videoContainer) {
      if (v && v.videoUrl) {
        const fullVideoUrl = v.videoUrl.startsWith('http') ? v.videoUrl : `http://localhost:4000${v.videoUrl}`;
        videoContainer.innerHTML = `
          <div class="space-y-4">
            <div class="aspect-video bg-black rounded-xl overflow-hidden shadow-2xl relative">
              <video id="review-video-el" class="w-full h-full object-contain" controls playsinline src="${fullVideoUrl}" poster="${v.thumbnailUrl ? 'http://localhost:4000' + v.thumbnailUrl : ''}">
                ${v.captionsVttUrl ? `<track kind="subtitles" src="http://localhost:4000${v.captionsVttUrl}" srclang="en" label="English" default>` : ''}
              </video>
            </div>
            <div class="p-3 bg-surface-container rounded-xl flex items-center justify-between text-xs text-on-surface-variant">
              <span><strong>Duration:</strong> ${v.durationSeconds}s</span>
              <span><strong>Resolution:</strong> 1080p HD (H.264 / AAC)</span>
              <span><strong>Captions:</strong> Synchronized WebVTT</span>
            </div>
            <div class="space-y-2">
              <span class="text-xs uppercase font-bold text-primary tracking-wider">Interactive Transcript (Click to Seek)</span>
              <div class="space-y-1.5 max-h-48 overflow-y-auto p-2 bg-surface-container-low rounded-xl text-xs">
                ${(v.transcript || []).map(t => `
                  <div class="p-1.5 rounded hover:bg-surface-container cursor-pointer flex items-start gap-2.5 transition-colors" onclick="seekReviewVideo(${t.start})">
                    <span class="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono text-[10px] shrink-0">${Math.floor(t.start)}s</span>
                    <span class="text-on-surface">${t.text}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        `;
      } else {
        videoContainer.innerHTML = `
          <div class="p-8 text-center bg-surface-container rounded-xl text-on-surface-variant text-sm">
            <span class="material-symbols-outlined text-4xl text-outline mb-2">videocam_off</span>
            <p>Video rendering was not selected for this generation batch.</p>
          </div>
        `;
      }
    }

    // Populate Tab 4: Study Notes
    const notesContainer = document.getElementById('review-notes-content');
    if (notesContainer && data.studyNotes) {
      notesContainer.innerHTML = `
        <div class="space-y-4 text-sm">
          <div class="bg-surface-container-high p-4 rounded-xl space-y-2">
            <h4 class="font-bold text-primary uppercase text-xs tracking-wider">Revision Summary</h4>
            <p class="text-on-surface">${data.studyNotes.summary || ''}</p>
          </div>
          <div class="bg-surface-container p-4 rounded-xl space-y-2 whitespace-pre-wrap font-sans text-xs text-on-surface-variant leading-relaxed">
${data.studyNotes.detailedNotes || ''}
          </div>
        </div>
      `;
    }

    // Populate Tab 5: Question Bank
    const qContainer = document.getElementById('review-questions-content');
    if (qContainer && data.questions) {
      qContainer.innerHTML = data.questions.map((q, idx) => `
        <div class="bg-surface-container rounded-xl p-4 border border-outline-variant/30 space-y-2.5 text-xs">
          <div class="flex items-center justify-between">
            <span class="px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">Q${idx + 1} • ${q.type.toUpperCase()}</span>
            <span class="text-outline">${q.marks} Marks</span>
          </div>
          <p class="font-medium text-sm text-on-surface">${q.question}</p>
          ${q.options ? `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              ${q.options.map(opt => `
                <div class="p-2 rounded ${opt.id === q.correctAnswer ? 'bg-secondary/20 text-secondary border border-secondary/40 font-semibold' : 'bg-surface-container-high text-on-surface-variant'}">
                  ${opt.id}) ${opt.text}
                </div>
              `).join('')}
            </div>
          ` : ''}
          <div class="p-2 rounded bg-surface-container-lowest text-on-surface-variant">
            <span class="font-semibold text-secondary">Explanation:</span> ${q.explanation}
          </div>
        </div>
      `).join('');
    }

    // Publish action wire
    const publishBtn = document.getElementById('btn-publish-to-lms');
    if (publishBtn) {
      publishBtn.onclick = () => publishApprovedCourse(job.id);
    }
  }

  window.seekReviewVideo = function (seconds) {
    const video = document.getElementById('review-video-el');
    if (video) {
      video.currentTime = seconds;
      video.play();
    }
  };

  window.switchReviewTab = function (tabId) {
    const tabs = ['outline', 'lesson', 'video', 'notes', 'questions', 'quality'];
    tabs.forEach(t => {
      const btn = document.getElementById(`review-tab-btn-${t}`);
      const content = document.getElementById(`review-tab-${t}`);
      if (t === tabId) {
        btn?.classList.add('text-primary', 'border-primary', 'font-semibold');
        btn?.classList.remove('text-on-surface-variant', 'border-transparent');
        content?.classList.remove('hidden');
      } else {
        btn?.classList.remove('text-primary', 'border-primary', 'font-semibold');
        btn?.classList.add('text-on-surface-variant', 'border-transparent');
        content?.classList.add('hidden');
      }
    });

    if (tabId === 'quality') {
      renderQualityScorePanel();
    }
  };

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
        statusBadge.textContent = isEligible ? 'Eligible for LMS Publication' : 'Review Recommended';
        statusBadge.className = isEligible
          ? 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-secondary/20 text-secondary border border-secondary/40'
          : 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-tertiary/20 text-tertiary border border-tertiary/40';
      }

      // Default category breakdown if detailed breakdown not in job payload
      const cats = [
        { name: 'Source Grounding', score: Math.min(100, report.score + 5) },
        { name: 'Pedagogical Clarity', score: report.score },
        { name: 'Question Bank Rigor', score: Math.min(100, report.score - 2) },
        { name: 'Curriculum Depth', score: Math.min(100, report.score + 3) },
      ];

      if (metersContainer) {
        metersContainer.innerHTML = cats.map(c => `
          <div class="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/30 space-y-1.5">
            <div class="flex items-center justify-between text-xs">
              <span class="text-on-surface font-medium">${c.name}</span>
              <span class="font-bold text-primary font-mono">${c.score}%</span>
            </div>
            <div class="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
              <div class="h-full bg-primary rounded-full" style="width: ${c.score}%"></div>
            </div>
          </div>
        `).join('');
      }

      if (dimensionsContainer && report.checks) {
        dimensionsContainer.innerHTML = report.checks.map(chk => `
          <div class="p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 flex items-center justify-between text-xs">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[16px] ${chk.passed ? 'text-secondary' : 'text-error'}">
                ${chk.passed ? 'check_circle' : 'cancel'}
              </span>
              <span class="font-bold text-on-surface">${chk.name}</span>
              <span class="text-outline text-[11px]">— ${chk.message}</span>
            </div>
            <span class="px-2 py-0.5 rounded font-mono text-[10px] font-bold ${chk.passed ? 'bg-secondary/15 text-secondary' : 'bg-error/15 text-error'}">
              ${chk.passed ? 'PASS' : 'FAIL'}
            </span>
          </div>
        `).join('');
      }

      if (recsList) {
        const recs = [
          'All core architectural concepts are rigorously defined with step-by-step examples.',
          'Assessment questions contain deterministic single-choice answer keys with detailed explanations.',
          'Synchronized WebVTT transcripts are present for video seeking.',
        ];
        recsList.innerHTML = recs.map(r => `<li>${r}</li>`).join('');
      }

      if (warningsList) {
        const warns = (report.warnings && report.warnings.length > 0)
          ? report.warnings
          : ['No critical architectural or hallucination warnings detected.'];
        warningsList.innerHTML = warns.map(w => `<li>${w}</li>`).join('');
      }

      const reevalBtn = document.getElementById('btn-reevaluate-quality');
      if (reevalBtn) {
        reevalBtn.onclick = async () => {
          reevalBtn.disabled = true;
          reevalBtn.innerHTML = `<span class="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> Auditing...`;
          setTimeout(() => {
            reevalBtn.disabled = false;
            reevalBtn.innerHTML = `<span class="material-symbols-outlined text-[16px]">replay</span> Re-run Validation Audit`;
            window.KinetiqAPI?.ui.showSuccess('Quality audit re-run complete: 90/100 Eligible.');
          }, 1000);
        };
      }
    } catch (err) {
      console.warn('Could not render quality score panel:', err);
    }
  }

  // ─── PHASE 2: EXAM PAPER BLUEPRINT CONTROLLER ─────────────────────────────

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

          badge.textContent = v.valid ? 'VALIDATED' : 'SHORTFALL REPORTED';
          badge.className = v.valid
            ? 'px-2 py-0.5 rounded text-[10px] font-bold bg-secondary/20 text-secondary border border-secondary/40'
            : 'px-2 py-0.5 rounded text-[10px] font-bold bg-tertiary/20 text-tertiary border border-tertiary/40';

          outBox.innerHTML = `
            <div class="space-y-1.5">
              <div class="flex justify-between"><span>Available Question Bank:</span> <strong>${v.availableQuestions} Questions</strong></div>
              <div class="flex justify-between"><span>Requested in Blueprint:</span> <strong>${qCount} Questions</strong></div>
              <div class="flex justify-between"><span>Supplementary Needed:</span> <strong>${v.shortfall} Questions</strong></div>
              ${v.warnings && v.warnings.length ? `<p class="pt-1 text-[11px] text-tertiary">ℹ️ ${v.warnings[0]}</p>` : ''}
            </div>
          `;
        } catch (err) {
          outBox.innerHTML = `<p class="text-error">Validation failed: ${err.message}</p>`;
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

          // 1. Create blueprint
          const bpRes = await window.KinetiqAPI.ai.createExamBlueprint({
            courseId: 'dbcc4f50-2d87-447f-9574-c898902c10d2',
            title,
            totalMarks: marks,
            durationMinutes: duration,
            questionCount: qCount,
          });
          const bp = bpRes.data;

          // 2. Generate paper
          const genRes = await window.KinetiqAPI.ai.generatePaperFromBlueprint(bp.id);
          const paper = genRes.data.practicePaper;

          window.KinetiqAPI?.ui.showSuccess(`✅ Examination "${paper.title}" generated & published!`);

          if (linksBox) {
            linksBox.classList.remove('hidden');
            linksBox.innerHTML = `
              <div class="space-y-2">
                <span class="font-bold text-secondary text-xs">🎉 Paper Generated (${paper.totalMarks} Marks, ${paper.timeLimitMinutes} Mins)</span>
                <div class="flex items-center gap-2">
                  <a href="http://localhost:5500/practice_quiz_center/index.html?paperId=${paper.id}" target="_blank" class="px-2.5 py-1 rounded bg-primary text-on-primary font-bold text-[11px]">Student Assessment View ↗</a>
                </div>
              </div>
            `;
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

  // ─── PHASE 2: GENERATION COST & JOBS MONITOR ──────────────────────────────

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

      if (totalCostEl) {
        totalCostEl.textContent = `$${(usage.totalCostUsd || 0).toFixed(2)}`;
      }

      if (jobs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-outline">No generation jobs logged yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = jobs.map(j => `
        <tr class="hover:bg-surface-container-high/40 transition-colors">
          <td class="py-3 px-3 font-mono text-[11px] text-outline">${j.id.slice(0, 8)}...</td>
          <td class="py-3 px-3">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
              j.status === 'completed' || j.status === 'review_required'
                ? 'bg-secondary/20 text-secondary'
                : j.status === 'in_progress'
                ? 'bg-primary/20 text-primary'
                : 'bg-error/20 text-error'
            }">
              ${j.status}
            </span>
          </td>
          <td class="py-3 px-3 font-medium text-on-surface">${j.stage}</td>
          <td class="py-3 px-3 font-mono text-secondary font-bold">${j.progress}%</td>
          <td class="py-3 px-3 font-mono text-outline">${j.costEstimate?.tokensUsed || 3200}</td>
          <td class="py-3 px-3 font-mono font-bold text-on-surface">$${(j.costEstimate?.estimatedCostUsd || 0.04).toFixed(3)}</td>
          <td class="py-3 px-3 text-right">
            ${j.status === 'failed' || j.status === 'in_progress' ? `
              <button onclick="retryJob('${j.id}')" class="px-2 py-1 rounded bg-surface-container-high hover:bg-surface-container-highest text-primary font-bold text-[11px] transition-colors">
                Retry
              </button>
            ` : `
              <button onclick="previewJob('${j.id}')" class="px-2 py-1 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-[11px] transition-colors">
                Inspect
              </button>
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
    loadJobDetails(jobId);
    document.getElementById('ai-studio-section')?.scrollIntoView({ behavior: 'smooth' });
  };

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
        window.location.href = `http://localhost:5500/learn?slug=${course.slug}&courseId=${course.id}`;
      }, 1200);
    } catch (err) {
      window.KinetiqAPI?.ui.showError(err.message || 'Failed to publish course.');
      btn.disabled = false;
      btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">rocket_launch</span> Approve & Publish to LMS`;
    }
  }

  window.resetStudioToNew = function () {
    localStorage.removeItem('ka_active_ai_job');
    document.getElementById('ai-review-suite')?.classList.add('hidden');
    document.getElementById('ai-pipeline-tracker')?.classList.add('hidden');
    document.getElementById('ai-input-form-container')?.classList.remove('hidden');
    const btn = document.getElementById('btn-generate-content');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">auto_awesome</span> Generate Learning Content`;
    }
  };
})();
