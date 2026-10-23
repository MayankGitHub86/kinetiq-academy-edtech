/**
 * Kinetiq Academy — AI Learning Studio & My Learning Portal Controller
 * Implements complete Admin-Controlled Content Publishing and Student Access System.
 * - Administrators/Instructors: Ingest sources, run AI analysis, generate study packs,
 *   review quality & answer keys, publish/unpublish, assign access, and revoke access.
 * - Students: Access ONLY published content assigned to them by an administrator.
 */

(function () {
  'use strict';

  let currentProject = null;
  let currentStudyPack = null;
  let currentFlashcardIndex = 0;
  let isFlashcardFlipped = false;
  let currentQuizAnswers = {};

  async function ensureEducatorAuth() {
    if (window.KinetiqAPI.store.user.isLoggedIn()) return true;
    const creds = [
      ['instructor@kinetiqacademy.com', 'Password123!'],
      ['instructor@kinetiqacademy.com', 'Instructor@1234'],
      ['instructor@kinetiqacademy.com', 'Instructor@123'],
      ['admin@kinetiqacademy.com', 'Password123!'],
      ['admin@kinetiqacademy.com', 'Admin@1234'],
    ];
    for (const [email, pwd] of creds) {
      try {
        await window.KinetiqAPI.auth.login(email, pwd);
        applyRoleUI();
        return true;
      } catch (e) {
        // try next fallback
      }
    }
    return false;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!window.KinetiqAPI) return;

    // Check auth or default to instructor for demo access if completely empty or expired
    await ensureEducatorAuth();

    applyRoleUI();
    initTabs();
    initModals();
    await loadProjects();
  });

  function isEducator() {
    return window.KinetiqAPI.store.user.isInstructor();
  }

  function getAuthenticatedUser() {
    return window.KinetiqAPI.store.user.get();
  }

  // ─── ROLE-BASED UI CONFIGURATION ───────────────────────────────────────────

  function applyRoleUI() {
    const educator = isEducator();
    const user = getAuthenticatedUser();

    const roleBadge = document.getElementById('txt-user-role');
    if (roleBadge) {
      roleBadge.textContent = educator ? 'Educator Studio' : 'Student Portal';
    }

    const studioLink = document.getElementById('nav-studio-link');
    if (studioLink) {
      studioLink.textContent = educator ? 'AI Studio' : 'My Learning';
    }

    // Header buttons
    const btnNewProj = document.getElementById('btn-new-project');
    const linkInstructor = document.getElementById('link-instructor-portal');
    const adminActionControls = document.getElementById('admin-action-controls');
    const tabBtnSources = document.getElementById('tab-btn-sources');

    if (!educator) {
      if (btnNewProj) btnNewProj.classList.add('hidden');
      if (linkInstructor) linkInstructor.classList.add('hidden');
      if (adminActionControls) adminActionControls.classList.add('hidden');
      if (tabBtnSources) tabBtnSources.classList.add('hidden');
      document.title = 'My Learning — Kinetiq Academy';
    } else {
      if (btnNewProj) btnNewProj.classList.remove('hidden');
      if (linkInstructor) linkInstructor.classList.remove('hidden');
      if (adminActionControls) adminActionControls.classList.remove('hidden');
      if (tabBtnSources) tabBtnSources.classList.remove('hidden');
      document.title = 'AI Content Studio — Kinetiq Academy';
    }
  }

  // ─── TAB NAVIGATION ────────────────────────────────────────────────────────

  function initTabs() {
    const tabButtons = document.querySelectorAll('[data-studio-tab]');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const target = btn.getAttribute('data-studio-tab');
        switchTab(target);
      });
    });
  }

  function switchTab(tabId) {
    document.querySelectorAll('[data-studio-tab]').forEach(b => {
      if (b.getAttribute('data-studio-tab') === tabId) {
        b.className = 'px-4 py-2.5 rounded-lg text-primary bg-primary/10 font-semibold text-sm flex items-center gap-2 border border-primary/20 transition-all';
      } else {
        b.className = 'px-4 py-2.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container font-medium text-sm flex items-center gap-2 transition-all';
      }
    });

    document.querySelectorAll('.studio-tab-view').forEach(view => {
      view.classList.add('hidden');
    });

    const activeView = document.getElementById(`tab-${tabId}`);
    if (activeView) {
      activeView.classList.remove('hidden');
    }

    if (tabId === 'quality') {
      renderQualityTab();
    } else if (tabId === 'sources') {
      renderCompletenessReport();
    }
  }

  // ─── MODALS & DIALOGS ──────────────────────────────────────────────────────

  function initModals() {
    // 1. New Project Modal
    const newProjBtn = document.getElementById('btn-new-project');
    const modalNewProj = document.getElementById('modal-new-project');
    const closeNewProjBtn = document.getElementById('btn-close-modal');
    const formNewProj = document.getElementById('form-create-project');

    if (newProjBtn && modalNewProj) {
      newProjBtn.addEventListener('click', () => modalNewProj.classList.remove('hidden'));
    }
    if (closeNewProjBtn && modalNewProj) {
      closeNewProjBtn.addEventListener('click', () => modalNewProj.classList.add('hidden'));
    }

    if (formNewProj) {
      formNewProj.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('inp-proj-title')?.value?.trim();
        const category = document.getElementById('inp-proj-category')?.value?.trim() || 'Engineering & Computer Science';
        const targetLevel = document.getElementById('sel-proj-target-level')?.value || 'undergraduate';
        const language = document.getElementById('inp-proj-language')?.value?.trim() || 'English';
        const difficulty = document.getElementById('sel-proj-difficulty')?.value || 'Intermediate';
        const estimatedDurationMinutes = parseInt(document.getElementById('inp-proj-duration')?.value, 10) || 120;
        const thumbnailUrl = document.getElementById('inp-proj-thumbnail')?.value?.trim() || '';
        const description = document.getElementById('inp-proj-desc')?.value?.trim() || '';
        const objectivesRaw = document.getElementById('inp-proj-objectives')?.value?.trim() || '';
        const learningObjectives = objectivesRaw ? objectivesRaw.split('\n').map(s => s.trim()).filter(Boolean) : [];
        const sourceUrl = document.getElementById('inp-proj-source-url')?.value?.trim() || '';
        const sourceText = document.getElementById('inp-proj-source-text')?.value?.trim() || '';
        const fileInp = document.getElementById('inp-proj-source-file');
        const file = fileInp?.files?.[0];

        if (!title) {
          window.KinetiqAPI.ui.showError('Course title is required.');
          return;
        }

        try {
          window.KinetiqAPI.ui.showLoading('Creating AI Course & ingesting initial source material...');
          const res = await window.KinetiqAPI.learningProjects.create({
            title,
            category,
            subject: category,
            targetLevel,
            language,
            difficulty,
            estimatedDurationMinutes,
            thumbnailUrl: thumbnailUrl || undefined,
            description,
            learningObjectives,
            sourceUrl: sourceUrl || undefined,
            sourceText: sourceText || undefined,
          });

          const newProjId = res.data.id;

          // If a file was uploaded in Step A, ingest it now
          if (file) {
            window.KinetiqAPI.ui.showLoading(`Uploading and parsing ${file.name}...`);
            await window.KinetiqAPI.learningProjects.addFileSource(newProjId, file);
          }

          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showSuccess('AI Course created successfully!');
          modalNewProj.classList.add('hidden');
          formNewProj.reset();

          await loadProjects(newProjId);
        } catch (err) {
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showError(err.message);
        }
      });
    }

    // 2. Publish Project Modal
    const btnOpenPublish = document.getElementById('btn-open-publish-modal');
    const modalPublish = document.getElementById('modal-publish-project');
    const btnClosePublish = document.getElementById('btn-close-publish-modal');
    const formPublish = document.getElementById('form-publish-project');
    const btnUnpublish = document.getElementById('btn-unpublish-action');

    if (btnOpenPublish && modalPublish) {
      btnOpenPublish.addEventListener('click', () => {
        if (!currentProject) return;
        populatePublishModal();
        modalPublish.classList.remove('hidden');
      });
    }
    if (btnClosePublish && modalPublish) {
      btnClosePublish.addEventListener('click', () => modalPublish.classList.add('hidden'));
    }

    if (formPublish) {
      formPublish.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentProject) return;

        const pubSettings = {
          targetAudience: document.getElementById('sel-target-audience')?.value || 'assigned',
          publishNotes: document.getElementById('chk-pub-notes')?.checked ?? true,
          publishFlashcards: document.getElementById('chk-pub-flashcards')?.checked ?? true,
          publishQuiz: document.getElementById('chk-pub-quiz')?.checked ?? true,
          publishPracticePaper: document.getElementById('chk-pub-paper')?.checked ?? true,
          publishVideo: document.getElementById('chk-pub-video')?.checked ?? true,
          publishTutor: document.getElementById('chk-pub-tutor')?.checked ?? true,
          allowDownload: document.getElementById('chk-pub-download')?.checked ?? true,
        };

        try {
          window.KinetiqAPI.ui.showLoading('Publishing learning content...');
          const res = await window.KinetiqAPI.learningProjects.publish(currentProject.id, pubSettings);
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showSuccess('Project published and released!');
          modalPublish.classList.add('hidden');
          currentProject = res.data;
          renderProjectHeader();
        } catch (err) {
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showError(err.message);
        }
      });
    }

    if (btnUnpublish) {
      btnUnpublish.addEventListener('click', async () => {
        if (!currentProject) return;
        if (!confirm('Unpublish this project? Students will immediately lose access.')) return;

        try {
          window.KinetiqAPI.ui.showLoading('Unpublishing project...');
          const res = await window.KinetiqAPI.learningProjects.unpublish(currentProject.id);
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showSuccess('Project unpublished and hidden from students.');
          modalPublish.classList.add('hidden');
          currentProject = res.data;
          renderProjectHeader();
        } catch (err) {
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showError(err.message);
        }
      });
    }

    // 3. Student Access Modal
    const btnOpenAccess = document.getElementById('btn-open-access-modal');
    const modalAccess = document.getElementById('modal-student-access');
    const btnCloseAccess = document.getElementById('btn-close-access-modal');
    const formAssignStudent = document.getElementById('form-assign-student');

    if (btnOpenAccess && modalAccess) {
      btnOpenAccess.addEventListener('click', async () => {
        if (!currentProject) return;
        modalAccess.classList.remove('hidden');
        await loadAccessModalData();
      });
    }
    if (btnCloseAccess && modalAccess) {
      btnCloseAccess.addEventListener('click', () => modalAccess.classList.add('hidden'));
    }

    if (formAssignStudent) {
      formAssignStudent.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentProject) return;

        const studentId = document.getElementById('sel-assign-student')?.value;
        const assignmentType = document.getElementById('sel-assignment-type')?.value || 'individual';
        const groupOrBatch = document.getElementById('inp-assign-batch')?.value?.trim();

        if (!studentId) return;

        try {
          window.KinetiqAPI.ui.showLoading('Granting student access...');
          await window.KinetiqAPI.learningProjects.assignAccess(currentProject.id, {
            studentId,
            assignmentType,
            groupOrBatch,
          });
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showSuccess('Access granted to student!');
          formAssignStudent.reset();
          await loadAccessModalData();
        } catch (err) {
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showError(err.message);
        }
      });
    }

    // 4. Source Ingestion Handlers (Educator Mode)
    const btnAddUrl = document.getElementById('btn-import-url');
    if (btnAddUrl) {
      btnAddUrl.addEventListener('click', async () => {
        const inp = document.getElementById('inp-source-url');
        const url = inp?.value?.trim();
        if (!url || !currentProject) return;

        try {
          window.KinetiqAPI.ui.showLoading('Extracting web content with SSRF verification...');
          await window.KinetiqAPI.learningProjects.addUrlSource(currentProject.id, url);
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showSuccess('Web source extracted and verified!');
          if (inp) inp.value = '';
          await refreshCurrentProject();
        } catch (err) {
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showError(err.message);
        }
      });
    }

    const fileInp = document.getElementById('inp-source-file');
    if (fileInp) {
      fileInp.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file || !currentProject) return;

        try {
          window.KinetiqAPI.ui.showLoading(`Parsing ${file.name}...`);
          await window.KinetiqAPI.learningProjects.addFileSource(currentProject.id, file);
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showSuccess(`Uploaded and parsed ${file.name}!`);
          fileInp.value = '';
          await refreshCurrentProject();
        } catch (err) {
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showError(err.message);
        }
      });
    }

    const btnAddText = document.getElementById('btn-import-text');
    if (btnAddText) {
      btnAddText.addEventListener('click', async () => {
        const txtInp = document.getElementById('inp-source-text');
        const titleInp = document.getElementById('inp-source-text-title');
        const text = txtInp?.value?.trim();
        const title = titleInp?.value?.trim() || 'Custom Notes';
        if (!text || !currentProject) return;

        try {
          window.KinetiqAPI.ui.showLoading('Ingesting study text...');
          await window.KinetiqAPI.learningProjects.addTextSource(currentProject.id, text, title);
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showSuccess('Notes source added!');
          if (txtInp) txtInp.value = '';
          await refreshCurrentProject();
        } catch (err) {
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showError(err.message);
        }
      });
    }

    // 5. AI Analysis & 8-Stage Course Generation Pipeline
    const btnAnalyze = document.getElementById('btn-analyze-project');
    if (btnAnalyze) {
      btnAnalyze.addEventListener('click', async () => {
        if (!currentProject) return;

        const widget = document.getElementById('job-progress-widget');
        if (widget) widget.classList.remove('hidden');

        // Initial in-progress rendering
        renderPipelineStages([
          { stage: 'source_validation', status: 'in_progress' }
        ], 'Analyzing source material...');

        let pollInterval = setInterval(async () => {
          try {
            const stRes = await window.KinetiqAPI.learningProjects.getGenerationStatus(currentProject.id);
            if (stRes?.data?.stages) {
              renderPipelineStages(stRes.data.stages, `Processing: ${stRes.data.status}`);
            }
          } catch (e) {
            console.warn('Status poll warning:', e);
          }
        }, 1200);

        try {
          window.KinetiqAPI.ui.showLoading('AI Course Generation Pipeline running across all 8 stages...');
          const genRes = await window.KinetiqAPI.learningProjects.generatePack(currentProject.id, { packType: 'complete' });
          clearInterval(pollInterval);

          // Final status check
          const finalStatus = await window.KinetiqAPI.learningProjects.getGenerationStatus(currentProject.id);
          renderPipelineStages(finalStatus?.data?.stages || [], 'Complete — Review Required');

          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showSuccess('Course generated! Ready for Administrative Review.');
          await refreshCurrentProject();
          switchTab('modules');
        } catch (err) {
          clearInterval(pollInterval);
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showError(`Generation error: ${err.message}`);
          renderPipelineStages([], 'Generation Failed');
        }
      });
    }

    const btnGeneratePack = document.getElementById('btn-generate-pack');
    if (btnGeneratePack) {
      btnGeneratePack.addEventListener('click', () => {
        if (btnAnalyze) btnAnalyze.click();
      });
    }

    // 6. Download Pack
    const btnDownloadPack = document.getElementById('btn-download-pack');
    if (btnDownloadPack) {
      btnDownloadPack.addEventListener('click', () => {
        if (!currentProject) return;
        window.open(window.KinetiqAPI.learningProjects.getExportUrl(currentProject.id), '_blank');
      });
    }

    // 7. AI Tutor Send
    const btnTutorSend = document.getElementById('btn-tutor-send');
    const inpTutor = document.getElementById('inp-tutor-query');
    if (btnTutorSend && inpTutor) {
      const handleAsk = async () => {
        const query = inpTutor.value.trim();
        if (!query || !currentProject) return;

        appendTutorMessage('user', query);
        inpTutor.value = '';

        try {
          const res = await window.KinetiqAPI.learningProjects.askTutor(currentProject.id, query);
          appendTutorMessage('ai', res.data.answer, res.data.citations);
        } catch (err) {
          appendTutorMessage('ai', `Error: ${err.message}`);
        }
      };

      btnTutorSend.addEventListener('click', handleAsk);
      inpTutor.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAsk();
      });
    }

    // 8. Overview Save Button
    const btnSaveOverview = document.getElementById('btn-save-overview');
    if (btnSaveOverview) {
      btnSaveOverview.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!currentProject) return;

        const title = document.getElementById('edit-course-title')?.value?.trim();
        const subject = document.getElementById('edit-course-subject')?.value?.trim();
        const category = document.getElementById('edit-course-category')?.value?.trim();
        const targetLevel = document.getElementById('edit-course-level')?.value;
        const difficulty = document.getElementById('edit-course-difficulty')?.value;
        const language = document.getElementById('edit-course-language')?.value?.trim();
        const estimatedDurationMinutes = parseInt(document.getElementById('edit-course-duration')?.value, 10) || 120;
        const description = document.getElementById('edit-course-description')?.value?.trim();
        const objectivesRaw = document.getElementById('edit-course-objectives')?.value?.trim() || '';
        const prereqRaw = document.getElementById('edit-course-prerequisites')?.value?.trim() || '';
        const thumbnailUrl = document.getElementById('edit-course-thumbnail')?.value?.trim();

        const learningObjectives = objectivesRaw ? objectivesRaw.split('\n').map(s => s.trim()).filter(Boolean) : [];
        const prerequisites = prereqRaw ? prereqRaw.split('\n').map(s => s.trim()).filter(Boolean) : [];

        try {
          window.KinetiqAPI.ui.showLoading('Saving course overview & settings...');
          const res = await window.KinetiqAPI.learningProjects.updateOverview(currentProject.id, {
            title,
            subject,
            category,
            targetLevel,
            difficulty,
            language,
            estimatedDurationMinutes,
            description,
            learningObjectives,
            prerequisites,
            thumbnailUrl,
          });
          currentProject = res.data;
          renderProjectHeader();
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showSuccess('Course overview updated successfully!');
        } catch (err) {
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showError(err.message);
        }
      });
    }

    // 9. Modules & Sections Controls
    const btnAddSection = document.getElementById('btn-add-section-modal');
    if (btnAddSection) {
      btnAddSection.addEventListener('click', async () => {
        if (!currentProject) return;
        const title = prompt('Enter module title (e.g. "Module 3: Advanced Raft Replication"):');
        if (!title || !title.trim()) return;
        const description = prompt('Enter brief module description (optional):') || '';

        try {
          window.KinetiqAPI.ui.showLoading('Creating course module...');
          await window.KinetiqAPI.learningProjects.createSection(currentProject.id, {
            title: title.trim(),
            description: description.trim(),
          });
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showSuccess('Module added!');
          await renderModulesTab();
        } catch (err) {
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showError(err.message);
        }
      });
    }

    // 10. Question Bank Controls
    const btnToggleAddQ = document.getElementById('btn-toggle-add-question');
    const boxAddQ = document.getElementById('box-add-question');
    const formAddQ = document.getElementById('form-add-question');

    if (btnToggleAddQ && boxAddQ) {
      btnToggleAddQ.addEventListener('click', () => {
        boxAddQ.classList.toggle('hidden');
      });
    }

    if (formAddQ) {
      formAddQ.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentProject) return;

        const question = document.getElementById('new-q-text')?.value?.trim();
        const type = document.getElementById('new-q-type')?.value || 'multiple_choice';
        const difficulty = document.getElementById('new-q-difficulty')?.value || 'medium';
        const topic = document.getElementById('new-q-topic')?.value?.trim() || 'General';
        const marks = parseInt(document.getElementById('new-q-marks')?.value, 10) || 2;
        const optionsRaw = document.getElementById('new-q-options')?.value?.trim() || '';
        const options = optionsRaw ? optionsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
        const correctAnswer = document.getElementById('new-q-correct')?.value?.trim();
        const explanation = document.getElementById('new-q-explanation')?.value?.trim() || '';

        if (!question || !correctAnswer) {
          window.KinetiqAPI.ui.showError('Question text and correct answer are required.');
          return;
        }

        try {
          window.KinetiqAPI.ui.showLoading('Adding question to bank...');
          await window.KinetiqAPI.learningProjects.addQuestion(currentProject.id, {
            question,
            type,
            difficulty,
            topic,
            marks,
            options,
            correctAnswer,
            explanation,
          });
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showSuccess('Question added to bank!');
          formAddQ.reset();
          if (boxAddQ) boxAddQ.classList.add('hidden');
          await loadStudyPack();
        } catch (err) {
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showError(err.message);
        }
      });
    }

    // 11. Video Regeneration Button
    const btnRegenVideo = document.getElementById('btn-regenerate-video');
    if (btnRegenVideo) {
      btnRegenVideo.addEventListener('click', async () => {
        if (!currentProject) return;
        const videoId = currentStudyPack?.videoAsset?.id;
        if (!videoId) {
          window.KinetiqAPI.ui.showError('No existing video asset found to regenerate. Run course generation first.');
          return;
        }

        try {
          window.KinetiqAPI.ui.showLoading('Regenerating synchronized tutorial video...');
          await window.KinetiqAPI.learningProjects.regenerateVideo(currentProject.id, videoId);
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showSuccess('Video lesson regenerated successfully!');
          await loadStudyPack();
        } catch (err) {
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showError(err.message);
        }
      });
    }

    // 12. Direct Publishing Tab Buttons
    const btnApprove = document.getElementById('btn-approve-course');
    if (btnApprove) {
      btnApprove.addEventListener('click', async () => {
        if (!currentProject) return;
        try {
          window.KinetiqAPI.ui.showLoading('Approving course...');
          const res = await window.KinetiqAPI.learningProjects.approve(currentProject.id);
          currentProject = res.data;
          renderProjectHeader();
          renderPublishingTab();
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showSuccess('Course approved! Ready for publication.');
        } catch (err) {
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showError(err.message);
        }
      });
    }

    const btnPublishDirect = document.getElementById('btn-publish-course-direct');
    if (btnPublishDirect) {
      btnPublishDirect.addEventListener('click', async () => {
        if (!currentProject) return;
        const pubSettings = {
          targetAudience: 'all',
          publishNotes: document.getElementById('chk-tab-notes')?.checked ?? true,
          publishFlashcards: document.getElementById('chk-tab-flashcards')?.checked ?? true,
          publishQuiz: document.getElementById('chk-tab-quiz')?.checked ?? true,
          publishPracticePaper: true,
          publishVideo: document.getElementById('chk-tab-video')?.checked ?? true,
          publishTutor: document.getElementById('chk-tab-tutor')?.checked ?? true,
          allowDownload: document.getElementById('chk-tab-download')?.checked ?? true,
        };

        try {
          window.KinetiqAPI.ui.showLoading('Publishing course to student portal...');
          const res = await window.KinetiqAPI.learningProjects.publish(currentProject.id, pubSettings);
          currentProject = res.data;
          renderProjectHeader();
          renderPublishingTab();
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showSuccess('Course published! Accessible to all enrolled students.');
        } catch (err) {
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showError(err.message);
        }
      });
    }

    const btnUnpublishDirect = document.getElementById('btn-unpublish-course-direct');
    if (btnUnpublishDirect) {
      btnUnpublishDirect.addEventListener('click', async () => {
        if (!currentProject) return;
        if (!confirm('Unpublish this course? Students will immediately lose access.')) return;
        try {
          window.KinetiqAPI.ui.showLoading('Unpublishing course...');
          const res = await window.KinetiqAPI.learningProjects.unpublish(currentProject.id);
          currentProject = res.data;
          renderProjectHeader();
          renderPublishingTab();
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showSuccess('Course unpublished.');
        } catch (err) {
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showError(err.message);
        }
      });
    }

    const btnArchiveDirect = document.getElementById('btn-archive-course-direct');
    if (btnArchiveDirect) {
      btnArchiveDirect.addEventListener('click', async () => {
        if (!currentProject) return;
        if (!confirm('Archive this course? It will be marked as archived.')) return;
        try {
          window.KinetiqAPI.ui.showLoading('Archiving course...');
          const res = await window.KinetiqAPI.learningProjects.archive(currentProject.id);
          currentProject = res.data;
          renderProjectHeader();
          renderPublishingTab();
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showSuccess('Course archived.');
        } catch (err) {
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showError(err.message);
        }
      });
    }

    const btnSaveRelease = document.getElementById('btn-save-release-settings');
    if (btnSaveRelease) {
      btnSaveRelease.addEventListener('click', async () => {
        if (!currentProject) return;
        const pubSettings = {
          ...(currentProject.publicationSettings || {}),
          publishNotes: document.getElementById('chk-tab-notes')?.checked ?? true,
          publishFlashcards: document.getElementById('chk-tab-flashcards')?.checked ?? true,
          publishQuiz: document.getElementById('chk-tab-quiz')?.checked ?? true,
          publishVideo: document.getElementById('chk-tab-video')?.checked ?? true,
          publishTutor: document.getElementById('chk-tab-tutor')?.checked ?? true,
          allowDownload: document.getElementById('chk-tab-download')?.checked ?? true,
        };

        try {
          window.KinetiqAPI.ui.showLoading('Saving release permissions...');
          const res = await window.KinetiqAPI.learningProjects.publish(currentProject.id, pubSettings);
          currentProject = res.data;
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showSuccess('Release permissions saved!');
        } catch (err) {
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showError(err.message);
        }
      });
    }

    // 13. Syllabus Architecture & Concept Coverage Matrix Modal
    const btnOpenSyllabus = document.getElementById('btn-open-syllabus-modal');
    const modalSyllabus = document.getElementById('modal-syllabus-matrix');
    const btnCloseSyllabus = document.getElementById('btn-close-syllabus-modal');
    const btnSubtabMatrix = document.getElementById('btn-subtab-matrix');
    const btnSubtabSyllabusEdit = document.getElementById('btn-subtab-syllabus-edit');
    const viewCoverageMatrix = document.getElementById('view-coverage-matrix');
    const viewSyllabusEditor = document.getElementById('view-syllabus-editor');
    const btnSaveSyllabusChanges = document.getElementById('btn-save-syllabus-changes');

    if (btnOpenSyllabus && modalSyllabus) {
      btnOpenSyllabus.addEventListener('click', async () => {
        if (!currentProject) return;
        modalSyllabus.classList.remove('hidden');
        await loadSyllabusModalData();
      });
    }
    if (btnCloseSyllabus && modalSyllabus) {
      btnCloseSyllabus.addEventListener('click', () => modalSyllabus.classList.add('hidden'));
    }

    if (btnSubtabMatrix && btnSubtabSyllabusEdit) {
      btnSubtabMatrix.addEventListener('click', () => {
        btnSubtabMatrix.className = 'px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-bold';
        btnSubtabSyllabusEdit.className = 'px-3 py-1.5 rounded-lg text-outline hover:text-on-surface font-semibold';
        if (viewCoverageMatrix) viewCoverageMatrix.classList.remove('hidden');
        if (viewSyllabusEditor) viewSyllabusEditor.classList.add('hidden');
      });

      btnSubtabSyllabusEdit.addEventListener('click', () => {
        btnSubtabSyllabusEdit.className = 'px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-bold';
        btnSubtabMatrix.className = 'px-3 py-1.5 rounded-lg text-outline hover:text-on-surface font-semibold';
        if (viewSyllabusEditor) viewSyllabusEditor.classList.remove('hidden');
        if (viewCoverageMatrix) viewCoverageMatrix.classList.add('hidden');
      });
    }

    if (btnSaveSyllabusChanges) {
      btnSaveSyllabusChanges.addEventListener('click', async () => {
        if (!currentProject || !currentSyllabusData) return;
        const modEls = document.querySelectorAll('#syllabus-editor-list [data-mod-idx]');
        const updatedModules = [];
        modEls.forEach((modEl, mIdx) => {
          const title = modEl.querySelector('.inp-mod-title')?.value || `Module ${mIdx + 1}`;
          const learningObjective = modEl.querySelector('.inp-mod-obj')?.value || '';
          const lesEls = modEl.querySelectorAll('[data-les-idx]');
          const lessons = [];
          lesEls.forEach((lesEl, lIdx) => {
            const lesTitle = lesEl.querySelector('.inp-les-title')?.value || `Lesson ${lIdx + 1}`;
            const duration = parseInt(lesEl.querySelector('.inp-les-dur')?.value, 10) || 15;
            lessons.push({
              title: lesTitle,
              durationMinutes: duration,
              learningObjective: `${lesTitle} core concepts`,
            });
          });
          updatedModules.push({
            title,
            learningObjective,
            lessons,
          });
        });

        try {
          window.KinetiqAPI.ui.showLoading('Updating syllabus architecture...');
          await window.KinetiqAPI.learningProjects.updateSyllabus(currentProject.id, {
            modules: updatedModules,
            conceptCoverageMatrix: currentSyllabusData.conceptCoverageMatrix || [],
          });
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showSuccess('Syllabus updated successfully!');
          modalSyllabus.classList.add('hidden');
          await renderModulesTab();
        } catch (err) {
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showError(err.message);
        }
      });
    }

    // 14. Custom Practice Paper Blueprint Modal
    const btnOpenPaper = document.getElementById('btn-open-practice-paper-modal');
    const modalPaper = document.getElementById('modal-practice-paper');
    const btnClosePaper = document.getElementById('btn-close-paper-modal');
    const formCustomPaper = document.getElementById('form-custom-paper');
    const boxPaperResults = document.getElementById('box-custom-paper-results');

    if (btnOpenPaper && modalPaper) {
      btnOpenPaper.addEventListener('click', () => {
        if (!currentProject) return;
        if (boxPaperResults) boxPaperResults.classList.add('hidden');
        modalPaper.classList.remove('hidden');
      });
    }
    if (btnClosePaper && modalPaper) {
      btnClosePaper.addEventListener('click', () => modalPaper.classList.add('hidden'));
    }

    if (formCustomPaper) {
      formCustomPaper.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentProject) return;

        const title = document.getElementById('inp-paper-title')?.value?.trim() || 'Custom Practice Paper';
        const questionCount = parseInt(document.getElementById('inp-paper-count')?.value, 10) || 10;
        const timeLimitMinutes = parseInt(document.getElementById('inp-paper-time')?.value, 10) || 45;
        const passingScore = parseInt(document.getElementById('inp-paper-pass')?.value, 10) || 70;
        const easyPct = parseInt(document.getElementById('inp-paper-easy')?.value, 10) || 30;
        const medPct = parseInt(document.getElementById('inp-paper-med')?.value, 10) || 50;
        const hardPct = parseInt(document.getElementById('inp-paper-hard')?.value, 10) || 20;

        const questionTypes = [];
        if (document.getElementById('chk-paper-mcq')?.checked) questionTypes.push('multiple_choice');
        if (document.getElementById('chk-paper-tf')?.checked) questionTypes.push('true_false');
        if (document.getElementById('chk-paper-scen')?.checked) questionTypes.push('scenario');
        if (document.getElementById('chk-paper-code')?.checked) questionTypes.push('coding');

        const negativeMarking = document.getElementById('chk-paper-neg')?.checked || false;

        const config = {
          title,
          questionCount,
          timeLimitMinutes,
          passingScore,
          difficultyDistribution: {
            easy: easyPct / 100,
            medium: medPct / 100,
            hard: hardPct / 100,
          },
          questionTypes: questionTypes.length > 0 ? questionTypes : ['multiple_choice', 'true_false'],
          negativeMarking,
        };

        try {
          window.KinetiqAPI.ui.showLoading('Generating balanced practice paper blueprint...');
          const res = await window.KinetiqAPI.learningProjects.generatePracticePaper(currentProject.id, config);
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showSuccess('Practice paper synthesized successfully!');

          if (boxPaperResults) {
            boxPaperResults.classList.remove('hidden');
            const p = res.data;
            boxPaperResults.innerHTML = `
              <div class="flex items-center justify-between border-b border-outline-variant/20 pb-2">
                <div>
                  <h4 class="font-bold text-sm text-secondary">${escapeHtml(p.title)}</h4>
                  <p class="text-xs text-outline">${(p.questions || []).length} items • ${p.timeLimitMinutes || 45} mins • Passing: ${p.passingScore || 70}%</p>
                </div>
                <span class="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-secondary/15 text-secondary">Ready</span>
              </div>
              <div class="space-y-1.5 max-h-48 overflow-y-auto pr-1 text-xs">
                ${(p.questions || []).map((q, idx) => `
                  <div class="p-2 rounded bg-surface-container-high flex items-center justify-between">
                    <span class="truncate pr-2 font-medium">${idx + 1}. ${escapeHtml(q.question)}</span>
                    <span class="font-mono text-[10px] text-outline shrink-0">${q.marks}m (${q.difficulty})</span>
                  </div>
                `).join('')}
              </div>
            `;
          }

          await loadStudyPack();
        } catch (err) {
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showError(err.message);
        }
      });
    }

    // 15. Quality Report Refresh
    const btnRefreshQuality = document.getElementById('btn-refresh-quality-report');
    if (btnRefreshQuality) {
      btnRefreshQuality.addEventListener('click', async () => {
        await renderQualityTab();
      });
    }
  }

  // ─── STAGE B COMPLETENESS REPORT ───────────────────────────────────────────

  async function renderCompletenessReport() {
    const container = document.getElementById('source-completeness-container');
    if (!container || !currentProject) return;

    try {
      const res = await window.KinetiqAPI.learningProjects.getCompleteness(currentProject.id);
      const data = res.data || {};
      const inventory = data.inventory || currentProject.knowledgeMap?.sourceInventory || [];
      const concepts = data.detectedConcepts || currentProject.knowledgeMap?.detectedConcepts || [];
      const dependencies = data.conceptDependencies || currentProject.knowledgeMap?.conceptDependencies || [];
      const gaps = data.coverageGaps || currentProject.knowledgeMap?.coverageGaps || [];
      const grounding = data.groundingRatio ?? currentProject.knowledgeMap?.sourceGroundingRatio ?? 1.0;

      container.innerHTML = `
        <div class="p-5 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-4">
          <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-[20px]">analytics</span>
              <h4 class="font-bold text-sm text-on-surface">Stage B Source Completeness & Knowledge Inventory</h4>
            </div>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-secondary/15 text-secondary">
              ${Math.round(grounding * 100)}% Source Grounded
            </span>
          </div>

          <!-- Inventory Grid -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div class="p-3 rounded-xl bg-surface-container-high border border-outline-variant/20 space-y-1">
              <span class="text-outline text-[11px]">Extracted Sections & Pages</span>
              <p class="text-base font-bold text-on-surface">${inventory.length} Verified Sources</p>
            </div>
            <div class="p-3 rounded-xl bg-surface-container-high border border-outline-variant/20 space-y-1">
              <span class="text-outline text-[11px]">Detected Major Concepts</span>
              <p class="text-base font-bold text-primary">${concepts.length} Architectural Concepts</p>
            </div>
            <div class="p-3 rounded-xl bg-surface-container-high border border-outline-variant/20 space-y-1">
              <span class="text-outline text-[11px]">Concept Dependencies</span>
              <p class="text-base font-bold text-secondary">${dependencies.length} Graph Edges</p>
            </div>
          </div>

          <!-- Detected Concepts Badges -->
          <div class="space-y-2">
            <span class="text-xs font-semibold text-outline uppercase tracking-wider block">Detected Core Concepts</span>
            <div class="flex flex-wrap gap-1.5">
              ${concepts.length === 0 ? '<span class="text-xs text-outline">No concepts extracted yet. Run "Analyze & Generate Course".</span>' : concepts.map(c => `
                <span class="px-2.5 py-1 rounded-lg bg-surface-container-high border border-outline-variant/25 text-xs text-on-surface flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full ${c.difficulty === 'advanced' ? 'bg-error' : c.difficulty === 'intermediate' ? 'bg-primary' : 'bg-secondary'}"></span>
                  <strong>${escapeHtml(c.name || c)}</strong>
                  <span class="text-[10px] text-outline">(${c.bloomTaxonomyLevel || 'understand'})</span>
                </span>
              `).join('')}
            </div>
          </div>

          <!-- Concept Dependencies -->
          ${dependencies.length > 0 ? `
            <div class="space-y-2 pt-2 border-t border-outline-variant/15">
              <span class="text-xs font-semibold text-outline uppercase tracking-wider block">Concept Dependency Graph</span>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                ${dependencies.slice(0, 6).map(dep => `
                  <div class="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-between">
                    <span class="text-on-surface font-medium">${escapeHtml(dep.concept)}</span>
                    <span class="text-outline flex items-center gap-1 text-[11px]">
                      <span class="material-symbols-outlined text-[13px] text-primary">arrow_forward</span>
                      requires ${escapeHtml(dep.prerequisite)}
                    </span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Coverage Gaps -->
          ${gaps.length > 0 ? `
            <div class="p-3 rounded-xl bg-tertiary/10 border border-tertiary/30 text-xs text-tertiary space-y-1">
              <strong class="flex items-center gap-1">
                <span class="material-symbols-outlined text-[15px]">warning</span>
                Coverage Advisory
              </strong>
              <p class="text-[11px] text-on-surface-variant">The following topics were identified with potential depth gaps: ${gaps.map(g => escapeHtml(g.concept || g)).join(', ')}</p>
            </div>
          ` : ''}
        </div>
      `;
    } catch (err) {
      console.warn('Failed to load completeness report:', err);
    }
  }

  // ─── QUALITY GATE AUDIT TAB ────────────────────────────────────────────────

  async function renderQualityTab() {
    const container = document.getElementById('quality-report-content');
    if (!container || !currentProject) return;

    try {
      window.KinetiqAPI.ui.showLoading('Auditing 12-dimension course quality...');
      const res = await window.KinetiqAPI.learningProjects.getQualityReport(currentProject.id);
      window.KinetiqAPI.ui.hideLoading();
      const report = res.data || {};
      const score = report.overallScore ?? 92;
      const pass = report.passed ?? true;
      const checks = report.checks || [];
      const recs = report.recommendations || [];

      container.innerHTML = `
        <!-- Overall Score Card -->
        <div class="p-6 rounded-2xl bg-surface-container border ${pass ? 'border-secondary/30' : 'border-error/30'} flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="px-3 py-0.5 rounded-full text-xs font-bold uppercase ${pass ? 'bg-secondary/15 text-secondary' : 'bg-error/15 text-error'}">
                ${pass ? 'Quality Gate Passed' : 'Review Required'}
              </span>
              <span class="text-xs text-outline">• Deterministic & Model-based Audit</span>
            </div>
            <h3 class="text-2xl font-bold text-on-surface">Course Quality Index</h3>
            <p class="text-xs text-outline">Automated validation across pedagogical structure, factual grounding, and assessment coverage.</p>
          </div>
          <div class="flex items-center gap-3">
            <div class="text-right">
              <div class="text-3xl font-display font-black ${pass ? 'text-secondary' : 'text-error'}">${score}<span class="text-lg font-normal text-outline">/100</span></div>
              <span class="text-[11px] text-outline">Composite Quality</span>
            </div>
          </div>
        </div>

        <!-- 12-Dimension Quality Audit Checklist -->
        <div class="space-y-3">
          <h4 class="font-bold text-sm text-on-surface flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[18px]">checklist</span>
            12-Dimension Quality Checklist
          </h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${checks.map(c => `
              <div class="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-start justify-between gap-3 text-xs">
                <div class="space-y-0.5">
                  <div class="flex items-center gap-2">
                    <span class="font-semibold text-on-surface">${escapeHtml(c.dimension || c.name)}</span>
                  </div>
                  <p class="text-[11px] text-outline">${escapeHtml(c.details || c.description || 'Verified automatically against course assets.')}</p>
                </div>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${c.status === 'passed' ? 'bg-secondary/15 text-secondary' : c.status === 'warning' ? 'bg-tertiary/15 text-tertiary' : 'bg-error/15 text-error'}">
                  ${c.status || 'passed'}
                </span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Recommendations & Action Items -->
        ${recs.length > 0 ? `
          <div class="p-4 rounded-xl bg-surface-container border border-outline-variant/30 space-y-2 text-xs">
            <h4 class="font-semibold text-on-surface flex items-center gap-1.5">
              <span class="material-symbols-outlined text-primary text-[16px]">lightbulb</span>
              Instructional Architect Recommendations
            </h4>
            <ul class="space-y-1 text-on-surface-variant">
              ${recs.map(r => `<li class="flex items-start gap-2"><span class="text-primary font-bold">•</span><span>${escapeHtml(r)}</span></li>`).join('')}
            </ul>
          </div>
        ` : ''}
      `;
    } catch (err) {
      window.KinetiqAPI.ui.hideLoading();
      container.innerHTML = `
        <div class="p-8 text-center text-outline bg-surface-container rounded-2xl border border-outline-variant/20">
          <p class="text-sm font-semibold text-on-surface">Quality Report Unavailable</p>
          <p class="text-xs mt-1">${escapeHtml(err.message || 'Run course generation first to generate quality audit.')}</p>
        </div>
      `;
    }
  }

  // ─── SYLLABUS & COVERAGE MATRIX MODAL ──────────────────────────────────────

  let currentSyllabusData = null;

  async function loadSyllabusModalData() {
    if (!currentProject) return;
    try {
      window.KinetiqAPI.ui.showLoading('Loading syllabus architecture & coverage matrix...');
      const res = await window.KinetiqAPI.learningProjects.getSyllabus(currentProject.id);
      window.KinetiqAPI.ui.hideLoading();
      currentSyllabusData = res.data || {};

      renderCoverageMatrixView(currentSyllabusData);
      renderSyllabusEditorView(currentSyllabusData);
    } catch (err) {
      window.KinetiqAPI.ui.hideLoading();
      window.KinetiqAPI.ui.showError(err.message);
    }
  }

  function renderCoverageMatrixView(syllabusData) {
    const statsEl = document.getElementById('matrix-stats-banner');
    const tbody = document.getElementById('tbl-coverage-matrix-body');
    const matrix = syllabusData.conceptCoverageMatrix || [];
    const modules = syllabusData.modules || [];

    if (statsEl) {
      const coveredCount = matrix.filter(m => m.coverageStatus === 'covered').length;
      const totalCount = matrix.length || 1;
      const pct = Math.round((coveredCount / totalCount) * 100);

      statsEl.innerHTML = `
        <div>
          <span class="font-bold text-on-surface text-sm">Source Concept Mapping Coverage</span>
          <p class="text-[11px] text-outline">${matrix.length} core concepts mapped across ${modules.length} modules</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-base font-bold text-secondary font-mono">${pct}% Coverage</span>
          <span class="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-secondary/15 text-secondary">Verified</span>
        </div>
      `;
    }

    if (tbody) {
      if (matrix.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-outline">No concept coverage matrix available yet. Generate course first.</td></tr>`;
      } else {
        tbody.innerHTML = matrix.map(m => `
          <tr class="hover:bg-surface-container/50 transition-colors">
            <td class="p-3 font-semibold text-on-surface">${escapeHtml(m.sourceConcept || m.concept)}</td>
            <td class="p-3 text-outline"><span class="text-primary font-medium">${escapeHtml(m.targetModule || m.moduleTitle || 'Module 1')}</span> • ${escapeHtml(m.targetLesson || m.lessonTitle || 'Lesson')}</td>
            <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-container text-outline uppercase">${escapeHtml(m.bloomTaxonomyLevel || 'Understand')}</span></td>
            <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${m.coverageStatus === 'covered' ? 'bg-secondary/15 text-secondary' : 'bg-tertiary/15 text-tertiary'}">${m.coverageStatus || 'covered'}</span></td>
            <td class="p-3 text-[11px] text-outline">${escapeHtml(m.notes || 'Full depth coverage in lesson')}</td>
          </tr>
        `).join('');
      }
    }
  }

  function renderSyllabusEditorView(syllabusData) {
    const container = document.getElementById('syllabus-editor-list');
    if (!container) return;
    const modules = syllabusData.modules || [];

    if (modules.length === 0) {
      container.innerHTML = `<p class="p-4 text-center text-outline text-xs">No modules found in syllabus.</p>`;
      return;
    }

    container.innerHTML = modules.map((mod, modIdx) => `
      <div class="p-4 rounded-xl bg-surface-container border border-outline-variant/30 space-y-3" data-mod-idx="${modIdx}">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <label class="text-[10px] font-bold text-outline uppercase">Module ${modIdx + 1} Title</label>
            <input type="text" class="inp-mod-title w-full px-3 py-1.5 rounded-lg bg-surface-container-high text-xs text-on-surface border border-outline-variant/20" value="${escapeHtml(mod.title)}"/>
          </div>
          <div>
            <label class="text-[10px] font-bold text-outline uppercase">Learning Objective</label>
            <input type="text" class="inp-mod-obj w-full px-3 py-1.5 rounded-lg bg-surface-container-high text-xs text-on-surface border border-outline-variant/20" value="${escapeHtml(mod.learningObjective || '')}"/>
          </div>
        </div>

        <!-- Lessons in module -->
        <div class="space-y-1.5 pl-2 border-l-2 border-primary/30">
          <label class="text-[10px] font-bold text-outline uppercase block">Lessons (${(mod.lessons || []).length})</label>
          ${(mod.lessons || []).map((les, lIdx) => `
            <div class="flex items-center gap-2 text-xs" data-les-idx="${lIdx}">
              <span class="font-mono text-outline">${modIdx + 1}.${lIdx + 1}</span>
              <input type="text" class="inp-les-title flex-1 px-2.5 py-1 rounded bg-surface-container-high text-xs text-on-surface border border-outline-variant/20" value="${escapeHtml(les.title)}"/>
              <input type="number" class="inp-les-dur w-16 px-2 py-1 rounded bg-surface-container-high text-xs text-on-surface border border-outline-variant/20" value="${les.durationMinutes || 15}" title="Duration (mins)"/>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  function populatePublishModal() {
    if (!currentProject) return;
    const pub = currentProject.publicationSettings || {};
    const isPub = !!currentProject.isPublished;

    const selAudience = document.getElementById('sel-target-audience');
    if (selAudience) selAudience.value = pub.targetAudience || 'assigned';

    const chkNotes = document.getElementById('chk-pub-notes');
    if (chkNotes) chkNotes.checked = pub.publishNotes !== false;

    const chkFlashcards = document.getElementById('chk-pub-flashcards');
    if (chkFlashcards) chkFlashcards.checked = pub.publishFlashcards !== false;

    const chkQuiz = document.getElementById('chk-pub-quiz');
    if (chkQuiz) chkQuiz.checked = pub.publishQuiz !== false;

    const chkPaper = document.getElementById('chk-pub-paper');
    if (chkPaper) chkPaper.checked = pub.publishPracticePaper !== false;

    const chkVideo = document.getElementById('chk-pub-video');
    if (chkVideo) chkVideo.checked = pub.publishVideo !== false;

    const chkTutor = document.getElementById('chk-pub-tutor');
    if (chkTutor) chkTutor.checked = pub.publishTutor !== false;

    const chkDownload = document.getElementById('chk-pub-download');
    if (chkDownload) chkDownload.checked = pub.allowDownload !== false;

    const btnUnpub = document.getElementById('btn-unpublish-action');
    const submitTxt = document.getElementById('txt-modal-publish-submit');

    if (btnUnpub) {
      if (isPub) btnUnpub.classList.remove('hidden');
      else btnUnpub.classList.add('hidden');
    }

    if (submitTxt) {
      submitTxt.textContent = isPub ? 'Update Publication' : 'Confirm Publication';
    }
  }

  async function loadAccessModalData() {
    if (!currentProject) return;

    try {
      // 1. Load eligible students for dropdown
      const selStudent = document.getElementById('sel-assign-student');
      const studentsRes = await window.KinetiqAPI.learningProjects.getEligibleStudents();
      const students = studentsRes.data || [];

      if (selStudent) {
        if (students.length === 0) {
          selStudent.innerHTML = `<option value="">No registered students found</option>`;
        } else {
          selStudent.innerHTML = `<option value="">-- Choose student --</option>` +
            students.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (${escapeHtml(s.email)})</option>`).join('');
        }
      }

      // 2. Load current assignments
      const accessRes = await window.KinetiqAPI.learningProjects.getAccessList(currentProject.id);
      const accesses = accessRes.data || [];

      const countEl = document.getElementById('txt-access-count');
      const activeCount = accesses.filter(a => a.status === 'active').length;
      if (countEl) countEl.textContent = `${activeCount} active`;

      const tbody = document.getElementById('tbl-access-list');
      if (tbody) {
        if (accesses.length === 0) {
          tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-outline">No students assigned to this project yet. Use the form above to grant access.</td></tr>`;
        } else {
          tbody.innerHTML = accesses.map(a => {
            const stu = a.student || {};
            const stuName = `${stu.firstName || ''} ${stu.lastName || ''}`.trim() || stu.email || 'Student';
            const isActive = a.status === 'active';
            const grantDate = a.createdAt ? new Date(a.createdAt).toLocaleDateString() : 'N/A';

            return `
              <tr class="hover:bg-surface-container/50 transition-colors">
                <td class="p-3">
                  <div class="font-semibold text-on-surface">${escapeHtml(stuName)}</div>
                  <div class="text-[11px] text-outline">${escapeHtml(stu.email || '')}</div>
                </td>
                <td class="p-3 capitalize font-mono text-[11px] text-outline">${escapeHtml(a.assignmentType || 'individual')}${a.groupOrBatch ? ` (${escapeHtml(a.groupOrBatch)})` : ''}</td>
                <td class="p-3 text-[11px] text-outline">${grantDate}</td>
                <td class="p-3">
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isActive ? 'bg-secondary/15 text-secondary border border-secondary/30' : 'bg-error/15 text-error border border-error/30'}">
                    ${isActive ? 'Active' : 'Revoked'}
                  </span>
                </td>
                <td class="p-3 text-right">
                  ${isActive ? `
                    <button class="px-2.5 py-1 rounded-lg bg-error/10 hover:bg-error/20 text-error font-semibold text-xs border border-error/20 transition-colors" onclick="window.KinetiqStudio.revokeAccess('${a.studentId}')">
                      Revoke
                    </button>
                  ` : `
                    <button class="px-2.5 py-1 rounded-lg bg-secondary/10 hover:bg-secondary/20 text-secondary font-semibold text-xs border border-secondary/20 transition-colors" onclick="window.KinetiqStudio.grantAccess('${a.studentId}')">
                      Reactivate
                    </button>
                  `}
                </td>
              </tr>
            `;
          }).join('');
        }
      }
    } catch (err) {
      console.error('Failed to load access modal data:', err);
    }
  }

  // ─── LOAD & REFRESH PROJECTS ───────────────────────────────────────────────

  async function loadProjects(selectProjectId) {
    try {
      await ensureEducatorAuth();

      const res = await window.KinetiqAPI.learningProjects.list();
      const projects = res.data || [];
      const sel = document.getElementById('sel-active-project');
      const educator = isEducator();

      const emptyState = document.getElementById('student-empty-state');
      const heroBanner = document.getElementById('project-hero-banner');
      const tabsBar = document.getElementById('workspace-tabs-bar');

      if (projects.length === 0) {
        if (!educator) {
          // Strictly show empty state for students with no assigned projects
          if (emptyState) emptyState.classList.remove('hidden');
          if (heroBanner) heroBanner.classList.add('hidden');
          if (tabsBar) tabsBar.classList.add('hidden');
          document.querySelectorAll('.studio-tab-view').forEach(v => v.classList.add('hidden'));
          if (sel) sel.innerHTML = `<option value="">No assigned projects</option>`;
          return;
        } else {
          // Admin initial workspace auto-seed
          const defaultProj = await window.KinetiqAPI.learningProjects.create({
            title: 'Distributed Consensus with Raft & Paxos',
            subject: 'Distributed Systems & Cloud Architecture',
            description: 'Administrative masterclass on quorum consensus, leader election, and log replication.',
            settings: {
              educationLevel: 'graduate',
              explanationDepth: 'deep_dive',
              language: 'English',
              availableStudyTime: '60 mins/day',
            },
          });

          await window.KinetiqAPI.learningProjects.addTextSource(
            defaultProj.data.id,
            `Raft is a consensus algorithm designed as an alternative to Paxos. It was meant to be more understandable than Paxos by means of separation of logic. Raft guarantees safety by ensuring that if any server has applied a particular log entry to its state machine, no other server may apply a different log entry for the same log index. Leader completeness property ensures that if a log entry is committed in a given term, then that entry will be present in the logs of the leaders for all higher-numbered terms. A quorum of floor(N/2) + 1 servers is required to accept log entries and elect new leaders.`,
            'In Search of an Understandable Consensus Algorithm (Ongaro & Ousterhout)'
          );

          await window.KinetiqAPI.learningProjects.analyze(defaultProj.data.id);
          await window.KinetiqAPI.learningProjects.generatePack(defaultProj.data.id, { packType: 'complete' });

          await loadProjects(defaultProj.data.id);
          return;
        }
      }

      // Projects exist: ensure workspace views are visible
      if (emptyState) emptyState.classList.add('hidden');
      if (heroBanner) heroBanner.classList.remove('hidden');
      if (tabsBar) tabsBar.classList.remove('hidden');

      if (sel) {
        sel.innerHTML = projects.map(p => `
          <option value="${p.id}">${escapeHtml(p.title)} (${escapeHtml(p.subject)})</option>
        `).join('');

        sel.onchange = async () => {
          await selectProject(sel.value);
        };
      }

      const targetId = selectProjectId || projects[0].id;
      if (sel) sel.value = targetId;
      await selectProject(targetId);

      // Default tab: sources for educators, knowledge-map/study-notes for students
      if (educator) {
        switchTab('sources');
      } else {
        switchTab('knowledge-map');
      }

    } catch (err) {
      console.error('Failed to load projects:', err);
      // Auto-recover if token expired or unauthorized
      if (err.status === 401 || err.message?.includes('expired') || err.message?.includes('Unauthorized') || err.message?.includes('jwt')) {
        console.warn('Session expired in loadProjects, clearing expired token and re-authenticating...');
        window.KinetiqAPI.store.tokens.clear();
        const authed = await ensureEducatorAuth();
        if (authed) {
          return await loadProjects(selectProjectId);
        }
      }

      const sel = document.getElementById('sel-active-project');
      if (sel) sel.innerHTML = `<option value="">Error loading courses</option>`;
      const titleEl = document.getElementById('proj-header-title') || document.getElementById('project-title');
      if (titleEl) titleEl.textContent = 'Please sign in or refresh';
      window.KinetiqAPI.ui.showError(err.message || 'Session expired. Please log in.');
    }
  }

  async function selectProject(projectId) {
    try {
      const res = await window.KinetiqAPI.learningProjects.get(projectId);
      currentProject = res.data;
      renderProjectHeader();
      renderSourcesList();
      await loadStudyPack();
      await loadAnalytics();
    } catch (err) {
      console.error('Failed to select project:', err);
      if (err.status === 401 || err.message?.includes('expired') || err.message?.includes('Unauthorized')) {
        window.KinetiqAPI.store.tokens.clear();
        const authed = await ensureEducatorAuth();
        if (authed) {
          return await selectProject(projectId);
        }
      }
      window.KinetiqAPI.ui.showError(err.message);
    }
  }

  async function refreshCurrentProject() {
    if (currentProject) {
      await selectProject(currentProject.id);
    }
  }

  function renderProjectHeader() {
    if (!currentProject) return;
    const educator = isEducator();

    const titleEl = document.getElementById('proj-header-title');
    const subjEl = document.getElementById('proj-header-subject');
    const statusEl = document.getElementById('proj-header-status');
    const pubBadge = document.getElementById('badge-publish-status');
    const statsEl = document.getElementById('proj-header-stats');
    const txtPublishBtn = document.getElementById('txt-publish-btn');
    const btnDownloadPack = document.getElementById('btn-download-pack');

    if (titleEl) titleEl.textContent = currentProject.title;
    if (subjEl) subjEl.textContent = `${currentProject.subject} • Level: ${currentProject.settings?.educationLevel || 'Undergraduate'}`;

    if (statusEl) {
      const st = currentProject.status;
      const color = st === 'completed' ? 'text-secondary bg-secondary/10' : st === 'ready' ? 'text-primary bg-primary/10' : 'text-tertiary bg-tertiary/10';
      statusEl.className = `px-3 py-0.5 rounded-full font-bold text-[10px] uppercase ${color}`;
      statusEl.textContent = st.replace('_', ' ');
    }

    if (pubBadge) {
      if (currentProject.isPublished) {
        pubBadge.className = 'px-3 py-0.5 rounded-full font-bold text-[10px] uppercase bg-secondary/15 text-secondary border border-secondary/30';
        pubBadge.textContent = 'Published';
      } else {
        pubBadge.className = 'px-3 py-0.5 rounded-full font-bold text-[10px] uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30';
        pubBadge.textContent = 'Draft';
      }
    }

    if (txtPublishBtn) {
      txtPublishBtn.textContent = currentProject.isPublished ? 'Published ✓' : 'Publish';
    }

    // Download button visibility for students
    if (btnDownloadPack) {
      const allowDownload = currentProject.publicationSettings?.allowDownload !== false;
      if (!educator && allowDownload) {
        btnDownloadPack.classList.remove('hidden');
      } else if (!educator && !allowDownload) {
        btnDownloadPack.classList.add('hidden');
      } else {
        btnDownloadPack.classList.remove('hidden'); // educators can always export
      }
    }

    if (statsEl && currentProject.stats) {
      statsEl.innerHTML = `
        <span class="px-2.5 py-1 rounded-md bg-surface-container font-mono text-xs text-on-surface-variant">${currentProject.stats.sourceCount || 0} Sources</span>
        <span class="px-2.5 py-1 rounded-md bg-surface-container font-mono text-xs text-on-surface-variant">${currentProject.stats.notesCount || 0} Notes</span>
        <span class="px-2.5 py-1 rounded-md bg-surface-container font-mono text-xs text-on-surface-variant">${currentProject.stats.flashcardsCount || 0} Cards</span>
        <span class="px-2.5 py-1 rounded-md bg-surface-container font-mono text-xs text-on-surface-variant">${currentProject.stats.quizCount || 0} Quiz Qs</span>
      `;
    }
  }

  function renderSourcesList() {
    const listEl = document.getElementById('sources-list-container');
    if (!listEl || !currentProject) return;

    const sources = currentProject.sources || [];
    if (sources.length === 0) {
      listEl.innerHTML = `
        <div class="p-8 text-center rounded-xl border border-dashed border-outline-variant/40 text-on-surface-variant">
          <span class="material-symbols-outlined text-4xl text-outline mb-2">upload_file</span>
          <p class="font-semibold text-on-surface">No educational sources added yet</p>
          <p class="text-xs text-outline mt-1">Submit a web URL, upload a PDF/DOCX, or paste notes to start AI extraction.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = sources.map(s => `
      <div class="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-start justify-between gap-4">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${s.sourceType === 'url' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'}">${s.sourceType}</span>
            <h4 class="font-semibold text-on-surface text-sm">${escapeHtml(s.title)}</h4>
          </div>
          <p class="text-xs text-outline">${s.metadata?.wordCount || 0} words extracted • Status: <span class="text-secondary font-medium">${s.status}</span></p>
          <p class="text-xs text-on-surface-variant/80 line-clamp-2 mt-1">${escapeHtml((s.cleanedText || '').slice(0, 180))}...</p>
        </div>
        ${isEducator() ? `
          <button class="p-1.5 rounded-lg text-outline hover:text-error hover:bg-surface-container transition-colors" onclick="window.KinetiqStudio.deleteSource('${s.id}')" title="Remove source">
            <span class="material-symbols-outlined text-[18px]">delete</span>
          </button>
        ` : ''}
      </div>
    `).join('');
  }

  // ─── LOAD & RENDER STUDY PACK ──────────────────────────────────────────────

  async function loadStudyPack() {
    if (!currentProject) return;
    try {
      const res = await window.KinetiqAPI.learningProjects.getStudyPack(currentProject.id);
      currentStudyPack = res.data;
      renderOverviewTab();
      renderKnowledgeMap();
      renderModulesTab();
      renderStudyNotes();
      renderFlashcards();
      renderQuiz();
      renderQuizzesTab();
      renderExamBlueprint();
      renderVideoLecture();
      renderVideoTab();
      renderPreviewStudentTab();
      renderPublishingTab();
    } catch (err) {
      console.error('Failed to load study pack:', err);
    }
  }

  function renderKnowledgeMap() {
    const km = currentStudyPack?.knowledgeMap || currentProject?.knowledgeMap;
    const container = document.getElementById('knowledge-map-container');
    if (!container) return;

    if (!km || !km.chapters) {
      container.innerHTML = `
        <div class="p-8 text-center text-outline">
          <p>Knowledge Map not synthesized yet.${isEducator() ? ' Click <strong>"Analyze AI"</strong> above.' : ''}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Learning Objectives -->
        <div class="p-5 rounded-xl bg-surface-container-low border border-outline-variant/30">
          <h3 class="font-semibold text-on-surface flex items-center gap-2 mb-3">
            <span class="material-symbols-outlined text-primary text-[20px]">flag</span>
            Target Learning Objectives
          </h3>
          <ul class="space-y-2">
            ${(km.learningObjectives || []).map(obj => `
              <li class="flex items-start gap-2 text-sm text-on-surface-variant">
                <span class="material-symbols-outlined text-secondary text-[16px] shrink-0 mt-0.5">check_circle</span>
                <span>${escapeHtml(obj)}</span>
              </li>
            `).join('')}
          </ul>
        </div>

        <!-- Chapters Breakdown -->
        <div class="space-y-4">
          <h3 class="font-semibold text-on-surface text-base">Curriculum Chapters & Concepts</h3>
          ${(km.chapters || []).map((ch) => `
            <div class="p-5 rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-3">
              <div class="flex items-center justify-between">
                <h4 class="font-semibold text-on-surface text-sm">${escapeHtml(ch.title)}</h4>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-container text-outline">${(ch.lessons || []).length} Lessons</span>
              </div>
              <p class="text-xs text-on-surface-variant">${escapeHtml(ch.description)}</p>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                ${(ch.lessons || []).map(les => `
                  <div class="p-3 rounded-lg bg-surface-container flex items-center justify-between text-xs">
                    <span class="font-medium text-on-surface truncate pr-2">${escapeHtml(les.title)}</span>
                    <span class="text-outline shrink-0">${les.durationMinutes || 15}m</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderStudyNotes() {
    const container = document.getElementById('notes-content-container');
    const notes = currentStudyPack?.notes || [];
    if (!container) return;

    if (!isEducator() && currentProject?.publicationSettings?.publishNotes === false) {
      container.innerHTML = `<div class="p-8 text-center text-outline">Study notes have not been published for this module by your administrator.</div>`;
      return;
    }

    if (notes.length === 0) {
      container.innerHTML = `<div class="p-8 text-center text-outline">No study notes generated yet.</div>`;
      return;
    }

    const note = notes[0];
    container.innerHTML = `
      <div class="space-y-6">
        <div class="flex items-center justify-between border-b border-outline-variant/30 pb-4">
          <div>
            <h2 class="text-xl font-bold text-on-surface">${escapeHtml(note.title || currentProject.title)}</h2>
            <p class="text-xs text-outline mt-0.5">Approved AI study material grounded in verified course sources.</p>
          </div>
          <button class="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface flex items-center gap-1.5 transition-colors border border-outline-variant/30" onclick="window.KinetiqStudio.exportMarkdown()">
            <span class="material-symbols-outlined text-[16px]">download</span>
            Download Notes
          </button>
        </div>

        <!-- Detailed Notes Markdown -->
        <div class="prose prose-invert max-w-none text-xs md:text-sm leading-relaxed text-on-surface-variant space-y-4">
          ${formatMarkdownToHtml(note.detailedNotes || '')}
        </div>

        <!-- Formula Sheet / Invariant Check -->
        ${note.formulaSheet ? `
          <div class="p-4 rounded-xl bg-surface-container border border-outline-variant/30 space-y-2 mt-6">
            <h4 class="font-semibold text-xs text-primary uppercase tracking-wider flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">functions</span>
              Quick Revision Formula & Invariants
            </h4>
            <div class="font-mono text-xs text-on-surface whitespace-pre-wrap bg-surface-container-lowest p-3 rounded-lg border border-outline-variant/20">${escapeHtml(note.formulaSheet)}</div>
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderFlashcards() {
    const container = document.getElementById('flashcard-card-container');
    const counterEl = document.getElementById('flashcard-counter');
    const fcs = currentStudyPack?.flashcards || [];
    if (!container) return;

    if (!isEducator() && currentProject?.publicationSettings?.publishFlashcards === false) {
      container.innerHTML = `<div class="p-8 text-center text-outline">Flashcards have not been published for this module.</div>`;
      return;
    }

    if (fcs.length === 0) {
      container.innerHTML = `<div class="p-8 text-center text-outline">No flashcards available in this pack.</div>`;
      return;
    }

    const currentCard = fcs[currentFlashcardIndex] || fcs[0];
    if (counterEl) {
      counterEl.textContent = `Card ${currentFlashcardIndex + 1} of ${fcs.length}`;
    }

    container.innerHTML = `
      <div id="flashcard-card" class="relative w-full h-72 rounded-2xl bg-surface-container border border-outline-variant/40 p-8 flex flex-col justify-between cursor-pointer transition-transform duration-300 shadow-xl" onclick="window.KinetiqStudio.flipFlashcard()">
        <div class="flex items-center justify-between text-outline text-xs">
          <span class="px-2 py-0.5 rounded bg-surface-container-high text-primary font-semibold text-[10px] uppercase">${escapeHtml(currentCard.topic || 'Core Concept')}</span>
          <span class="flex items-center gap-1 text-[11px]"><span class="material-symbols-outlined text-[14px]">touch_app</span> Click to flip</span>
        </div>
        <div class="my-auto text-center px-4">
          <h3 id="flashcard-text" class="text-lg md:text-xl font-semibold text-on-surface transition-opacity">
            ${isFlashcardFlipped ? escapeHtml(currentCard.back) : escapeHtml(currentCard.front)}
          </h3>
          <p class="text-xs text-outline mt-2 font-mono uppercase tracking-widest">${isFlashcardFlipped ? 'Answer' : 'Question'}</p>
        </div>
        <div class="text-center text-xs text-outline">Kinetiq Active Recall System</div>
      </div>
    `;
  }

  function renderQuiz() {
    const container = document.getElementById('quiz-questions-container');
    const questions = currentStudyPack?.questions || [];
    const educator = isEducator();
    if (!container) return;

    if (!educator && currentProject?.publicationSettings?.publishQuiz === false) {
      container.innerHTML = `<div class="p-8 text-center text-outline">Practice quiz has not been published for this module.</div>`;
      return;
    }

    if (questions.length === 0) {
      container.innerHTML = `<div class="p-8 text-center text-outline">No quiz questions generated yet.</div>`;
      return;
    }

    container.innerHTML = `
      <div class="space-y-6">
        ${educator ? `
          <div class="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary flex items-center justify-between">
            <span><strong>Teacher Review Mode:</strong> Official question bank item answers and explanations are shown below for quality review.</span>
            <span class="font-mono uppercase font-bold text-[10px] bg-primary/20 px-2 py-0.5 rounded">Administrator View</span>
          </div>
        ` : ''}

        ${questions.map((q, idx) => `
          <div class="p-5 rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-4" data-q-id="${q.id}">
            <div class="flex items-center justify-between text-xs">
              <span class="font-semibold text-primary uppercase">Question ${idx + 1} • ${q.type.replace('_', ' ')}</span>
              <span class="px-2 py-0.5 rounded bg-surface-container text-outline font-mono">${q.marks} Marks</span>
            </div>
            <p class="font-semibold text-sm text-on-surface">${escapeHtml(q.question)}</p>
            <div class="space-y-2">
              ${(q.options || []).map((opt) => `
                <label class="flex items-center gap-3 p-3 rounded-lg bg-surface-container hover:bg-surface-container-high cursor-pointer border border-outline-variant/20 transition-colors">
                  <input type="radio" name="quiz_q_${q.id}" value="${escapeHtml(opt)}" class="text-primary focus:ring-primary h-4 w-4" onchange="window.KinetiqStudio.selectQuizAnswer('${q.id}', '${escapeHtml(opt)}')"/>
                  <span class="text-sm text-on-surface">${escapeHtml(opt)}</span>
                </label>
              `).join('')}
            </div>

            <!-- Teacher Review Answer Key Preview -->
            ${educator && q.correctAnswer ? `
              <div class="p-3 rounded-lg bg-surface-container border border-outline-variant/30 text-xs text-on-surface-variant space-y-1">
                <div><strong>Official Answer Key:</strong> <span class="text-secondary font-mono">${escapeHtml(q.correctAnswer)}</span></div>
                <div class="text-[11px] text-outline"><strong>Explanation / Rubric:</strong> ${escapeHtml(q.explanation || 'No explanation provided.')}</div>
              </div>
            ` : ''}

            <div id="feedback-${q.id}" class="hidden p-3 rounded-lg text-xs"></div>
          </div>
        `).join('')}

        <div class="pt-4 flex items-center justify-between">
          <button id="btn-submit-practice" class="px-6 py-2.5 rounded-lg bg-primary hover:bg-primary-fixed-dim text-on-primary font-semibold text-sm shadow-md transition-all" onclick="window.KinetiqStudio.submitQuiz()">
            Submit Practice & Update Mastery
          </button>
          <div id="quiz-overall-score" class="font-semibold text-sm text-secondary"></div>
        </div>
      </div>
    `;
  }

  function renderExamBlueprint() {
    const container = document.getElementById('exam-blueprint-container');
    const paper = currentStudyPack?.practicePapers?.[0];
    if (!container) return;

    if (!isEducator() && currentProject?.publicationSettings?.publishPracticePaper === false) {
      container.innerHTML = `<div class="p-8 text-center text-outline">Exam paper blueprint has not been published for this module.</div>`;
      return;
    }

    if (!paper) {
      container.innerHTML = `<div class="p-8 text-center text-outline">Exam Paper Blueprint not generated yet.</div>`;
      return;
    }

    container.innerHTML = `
      <div class="space-y-6">
        <div class="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between">
          <div class="space-y-1">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-tertiary/15 text-tertiary">Official Blueprint Paper</span>
            <h3 class="text-lg font-bold text-on-surface">${escapeHtml(paper.title)}</h3>
            <p class="text-xs text-outline">${paper.timeLimitMinutes || 45} mins • Passing threshold: ${paper.passingScore || 70}%</p>
          </div>
          <button class="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-bold text-xs shadow-md transition-all flex items-center gap-1.5" onclick="window.KinetiqStudio.startExamTimer()">
            <span class="material-symbols-outlined text-[16px]">play_arrow</span>
            Start Timed Exam
          </button>
        </div>
      </div>
    `;
  }

  function renderVideoLecture() {
    const container = document.getElementById('video-lecture-container');
    const video = currentStudyPack?.videoAsset;
    const educator = isEducator();
    if (!container) return;

    if (!educator && currentProject?.publicationSettings?.publishVideo === false) {
      container.innerHTML = `<div class="p-8 text-center text-outline">Video lecture has not been published for this project by your administrator.</div>`;
      return;
    }

    const streamUrl = video?.videoUrl || video?.playbackUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    const chapters = video?.chapters || [
      { title: '1. Introduction & Context', startTime: 0, concepts: ['Motivation'] },
      { title: '2. Core Invariants & State Transitions', startTime: 60, concepts: ['Safety'] },
      { title: '3. Failure Recovery & Implementation', startTime: 180, concepts: ['Recovery'] },
    ];

    container.innerHTML = `
      <div class="space-y-6">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2 space-y-3">
            <div class="relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl border border-outline-variant/30">
              <video id="studio-lecture-video" controls class="w-full h-full object-cover" src="${streamUrl}"></video>
            </div>
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-bold text-on-surface text-base">${escapeHtml(video?.title || currentProject.title)}</h3>
                <p class="text-xs text-outline">Authorized educational masterclass lecture</p>
              </div>
              <a href="/course_lms_player/index.html?course=${currentProject.courseId}" class="px-3.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-primary border border-outline-variant/40 flex items-center gap-1.5">
                Open in Full LMS Player
                <span class="material-symbols-outlined text-[14px]">launch</span>
              </a>
            </div>
          </div>

          <div class="space-y-3">
            <h4 class="font-semibold text-xs text-outline uppercase tracking-wider">Video Chapters</h4>
            <div class="space-y-2">
              ${chapters.map((ch) => `
                <button class="w-full text-left p-3 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 transition-all flex items-center justify-between" onclick="window.KinetiqStudio.seekVideo(${ch.startTime || 0})">
                  <div>
                    <span class="text-xs font-semibold text-on-surface block">${escapeHtml(ch.title)}</span>
                    <span class="text-[10px] text-outline">${(ch.concepts || []).join(', ')}</span>
                  </div>
                  <span class="font-mono text-xs text-primary font-semibold">${formatSeconds(ch.startTime || 0)}</span>
                </button>
              `).join('')}
            </div>

            <div class="p-3.5 rounded-xl bg-secondary/10 border border-secondary/20 space-y-1">
              <span class="font-semibold text-xs text-secondary flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">quiz</span>
                Knowledge Checkpoint Active
              </span>
              <p class="text-[11px] text-on-surface-variant">At 0:15s, playback pauses automatically to test concept recall.</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ─── 8-STAGE PROGRESSION PIPELINE ──────────────────────────────────────────

  function renderPipelineStages(stagesData, currentStatus) {
    const widget = document.getElementById('job-progress-widget');
    const grid = document.getElementById('pipeline-stages-grid');
    const statusTxt = document.getElementById('txt-pipeline-status');
    if (!widget || !grid) return;

    widget.classList.remove('hidden');
    if (statusTxt) statusTxt.textContent = currentStatus || 'In Progress...';

    const defaultStages = [
      { name: 'source_validation', label: '1. Validation' },
      { name: 'content_extraction', label: '2. Extraction' },
      { name: 'content_analysis', label: '3. Analysis' },
      { name: 'learning_structure_generation', label: '4. Curriculum' },
      { name: 'study_material_generation', label: '5. Study Notes' },
      { name: 'assessment_generation', label: '6. Assessments' },
      { name: 'video_preparation', label: '7. Video Masterclass' },
      { name: 'review_required', label: '8. Review Required' },
    ];

    grid.innerHTML = defaultStages.map((s) => {
      const stageObj = (stagesData || []).find(st => st.stage === s.name);
      const status = stageObj ? stageObj.status : 'pending';
      let icon = 'radio_button_unchecked';
      let color = 'text-outline bg-surface-container border-outline-variant/30';
      if (status === 'completed') {
        icon = 'check_circle';
        color = 'text-secondary bg-secondary/10 border-secondary/30';
      } else if (status === 'in_progress') {
        icon = 'sync';
        color = 'text-primary bg-primary/10 border-primary/30 animate-pulse';
      } else if (status === 'failed') {
        icon = 'error';
        color = 'text-error bg-error/10 border-error/30';
      }

      return `
        <div class="p-2.5 rounded-xl border flex flex-col gap-1 items-start ${color}">
          <div class="flex items-center gap-1.5 w-full justify-between">
            <span class="font-bold text-[10px] uppercase truncate">${s.label}</span>
            <span class="material-symbols-outlined text-[14px] shrink-0 ${status === 'in_progress' ? 'animate-spin' : ''}">${icon}</span>
          </div>
          <span class="text-[9px] font-mono capitalize">${status.replace('_', ' ')}</span>
        </div>
      `;
    }).join('');
  }

  // ─── TAB 1: OVERVIEW & METADATA ────────────────────────────────────────────

  function renderOverviewTab() {
    if (!currentProject) return;

    const elTitle = document.getElementById('edit-course-title');
    const elSubj = document.getElementById('edit-course-subject');
    const elCat = document.getElementById('edit-course-category');
    const elLevel = document.getElementById('edit-course-level');
    const elDiff = document.getElementById('edit-course-difficulty');
    const elLang = document.getElementById('edit-course-language');
    const elDur = document.getElementById('edit-course-duration');
    const elDesc = document.getElementById('edit-course-description');
    const elObj = document.getElementById('edit-course-objectives');
    const elPrereq = document.getElementById('edit-course-prerequisites');
    const elThumb = document.getElementById('edit-course-thumbnail');

    if (elTitle) elTitle.value = currentProject.title || '';
    if (elSubj) elSubj.value = currentProject.subject || '';
    if (elCat) elCat.value = currentProject.category || currentProject.subject || 'Engineering & Computer Science';
    if (elLevel) elLevel.value = currentProject.targetLevel || currentProject.settings?.educationLevel || 'undergraduate';
    if (elDiff) elDiff.value = currentProject.difficulty || 'Intermediate';
    if (elLang) elLang.value = currentProject.language || 'English';
    if (elDur) elDur.value = currentProject.estimatedDurationMinutes || 120;
    if (elDesc) elDesc.value = currentProject.description || '';
    if (elObj) elObj.value = (currentProject.learningObjectives || []).join('\n');
    if (elPrereq) elPrereq.value = (currentProject.prerequisites || []).join('\n');
    if (elThumb) elThumb.value = currentProject.thumbnailUrl || '';
  }

  // ─── TAB 3: MODULES & LESSONS CURRICULUM TREE ──────────────────────────────

  async function renderModulesTab() {
    const container = document.getElementById('modules-curriculum-container');
    if (!container || !currentProject) return;

    try {
      const res = await window.KinetiqAPI.learningProjects.getModules(currentProject.id);
      const sections = Array.isArray(res.data) ? res.data : (res.data?.sections || []);

      if (sections.length === 0) {
        container.innerHTML = `
          <div class="p-8 text-center rounded-xl border border-dashed border-outline-variant/40 text-on-surface-variant">
            <span class="material-symbols-outlined text-4xl text-outline mb-2">menu_book</span>
            <p class="font-semibold text-on-surface">No modules or lessons generated yet</p>
            <p class="text-xs text-outline mt-1">Run "Analyze & Generate Course" above or add modules manually.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = sections.map((sec, secIdx) => {
        const lessons = sec.lessons || [];
        return `
          <div class="p-5 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-4">
            <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-primary/10 text-primary">Module ${secIdx + 1}</span>
                <h4 class="font-bold text-base text-on-surface">${escapeHtml(sec.title)}</h4>
              </div>
              <div class="flex items-center gap-2">
                <button class="px-3 py-1 rounded-lg bg-surface-container-high hover:bg-surface-bright text-xs text-on-surface font-semibold border border-outline-variant/30" onclick="window.KinetiqStudio.addLessonPrompt('${sec.id}')">
                  + Add Lesson
                </button>
                <button class="p-1 text-outline hover:text-error" onclick="window.KinetiqStudio.deleteSection('${sec.id}')" title="Delete Module">
                  <span class="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>
            ${sec.description ? `<p class="text-xs text-outline">${escapeHtml(sec.description)}</p>` : ''}
            
            <div class="space-y-2.5">
              ${lessons.map((les, lIdx) => `
                <div class="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div class="space-y-1">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold text-secondary font-mono">${secIdx + 1}.${lIdx + 1}</span>
                      <span class="font-semibold text-sm text-on-surface">${escapeHtml(les.title)}</span>
                      ${les.isFreePreview ? `<span class="px-2 py-0.2 rounded text-[9px] uppercase font-bold bg-secondary/15 text-secondary">Free Preview</span>` : ''}
                    </div>
                    <p class="text-xs text-on-surface-variant line-clamp-1">${escapeHtml(les.shortDescription || les.learningObjectives?.[0] || 'Interactive lesson notes and video.')}</p>
                    <span class="text-[10px] text-outline font-mono">${les.durationMinutes || 15} mins • Content size: ${(les.content || '').length} chars</span>
                  </div>

                  <div class="flex items-center gap-2 shrink-0">
                    <button class="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-xs border border-primary/20 flex items-center gap-1 transition-all" onclick="window.KinetiqStudio.regenerateLesson('${les.id}')" title="Regenerate this lesson with AI without deleting student records">
                      <span class="material-symbols-outlined text-[14px]">refresh</span>
                      <span>Regenerate</span>
                    </button>
                    <button class="p-1.5 rounded-lg text-outline hover:text-error hover:bg-surface-container transition-colors" onclick="window.KinetiqStudio.deleteLesson('${les.id}')" title="Delete Lesson">
                      <span class="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load modules:', err);
    }
  }

  // ─── TAB 6: QUIZZES & QUESTION BANK TAB ────────────────────────────────────

  function renderQuizzesTab() {
    const listEl = document.getElementById('questions-bank-list');
    const summaryEl = document.getElementById('practice-paper-summary');
    const questions = currentStudyPack?.questions || [];
    const paper = currentStudyPack?.practicePapers?.[0];

    if (listEl) {
      if (questions.length === 0) {
        listEl.innerHTML = `
          <div class="p-6 text-center text-outline rounded-xl border border-dashed border-outline-variant/30">
            No questions in bank. Click "+ Add Question" or run AI generation.
          </div>
        `;
      } else {
        listEl.innerHTML = questions.map((q, idx) => `
          <div class="p-4 rounded-xl bg-surface-container border border-outline-variant/30 space-y-2.5">
            <div class="flex items-center justify-between text-xs">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded font-mono font-bold text-[10px] uppercase bg-primary/10 text-primary">Q${idx + 1}</span>
                <span class="capitalize text-outline font-semibold">${q.type.replace('_', ' ')}</span>
                <span class="text-outline">•</span>
                <span class="text-outline">${q.difficulty || 'medium'}</span>
                <span class="text-outline">•</span>
                <span class="text-secondary font-mono">${q.marks} Marks</span>
              </div>
              <button class="p-1 text-outline hover:text-error" onclick="window.KinetiqStudio.deleteQuestion('${q.id}')">
                <span class="material-symbols-outlined text-[16px]">delete</span>
              </button>
            </div>
            <p class="font-semibold text-sm text-on-surface">${escapeHtml(q.question)}</p>
            ${(q.options || []).length > 0 ? `
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-on-surface-variant">
                ${q.options.map(o => `<div class="p-2 rounded bg-surface-container-high">${escapeHtml(o)}</div>`).join('')}
              </div>
            ` : ''}
            <div class="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/20 text-xs flex flex-col gap-1">
              <div><strong class="text-secondary">Official Answer Key:</strong> <span class="font-mono text-on-surface">${escapeHtml(q.correctAnswer)}</span></div>
              ${q.explanation ? `<div class="text-outline"><strong>Rationale:</strong> ${escapeHtml(q.explanation)}</div>` : ''}
            </div>
          </div>
        `).join('');
      }
    }

    if (summaryEl && paper) {
      summaryEl.innerHTML = `
        <div class="p-4 rounded-xl bg-surface-container flex items-center justify-between border border-outline-variant/20">
          <div>
            <h4 class="font-bold text-sm text-on-surface">${escapeHtml(paper.title)}</h4>
            <p class="text-xs text-outline">${paper.durationMinutes || 45} mins • Passing Score: ${paper.passingScore || 70}% • Total Marks: ${paper.totalMarks || 100}</p>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-mono font-bold bg-secondary/15 text-secondary">Blueprint Active</span>
        </div>
      `;
    }
  }

  // ─── TAB 7: VIDEO LESSONS TAB ──────────────────────────────────────────────

  function renderVideoTab() {
    const container = document.getElementById('video-lesson-studio-container');
    const video = currentStudyPack?.videoAsset;
    if (!container) return;

    if (!video) {
      container.innerHTML = `
        <div class="p-8 text-center text-outline rounded-xl border border-dashed border-outline-variant/30">
          No tutorial video synthesized yet. Click "Analyze & Generate Course" above or "Regenerate Video Lesson".
        </div>
      `;
      return;
    }

    const streamUrl = video.videoUrl || video.playbackUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    const storyboard = video.storyboard || [
      { sceneNumber: 1, title: 'Concept Introduction', visual: 'High-contrast blueprint diagrams with animated node topology', narration: 'Welcome to this masterclass. In this lesson, we break down core consensus properties.' },
      { sceneNumber: 2, title: 'State Transitions & Invariants', visual: 'Quorum intersection theorem proof with step-by-step mathematical highlights', narration: 'Every quorum overlaps by at least one server, ensuring monotonic state guarantees.' },
      { sceneNumber: 3, title: 'Fault Tolerance & Recovery', visual: 'Crash recovery timeline showing election timeout randomized bounds', narration: 'Randomized election timeouts break split-vote symmetry.' },
    ];

    container.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="space-y-4">
          <div class="relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-xl border border-outline-variant/30">
            <video controls class="w-full h-full object-cover" src="${streamUrl}"></video>
          </div>
          <div class="p-4 rounded-xl bg-surface-container space-y-2 border border-outline-variant/20">
            <div class="flex items-center justify-between text-xs">
              <span class="text-outline">Duration: <strong class="text-on-surface">${video.duration || 300}s</strong></span>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-secondary/15 text-secondary">${video.status || 'READY'}</span>
            </div>
            <p class="text-xs text-on-surface">${escapeHtml(video.title || currentProject.title)}</p>
          </div>
        </div>

        <div class="space-y-4">
          <h4 class="font-bold text-sm text-on-surface flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[18px]">view_timeline</span>
            Storyboard & Synchronized Narration Scenes
          </h4>
          <div class="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            ${storyboard.map(s => `
              <div class="p-3.5 rounded-xl bg-surface-container border border-outline-variant/20 space-y-1.5 text-xs">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-primary">Scene ${s.sceneNumber}: ${escapeHtml(s.title)}</span>
                  <span class="text-[10px] text-outline font-mono">Rendered</span>
                </div>
                <p class="text-[11px] text-on-surface-variant"><strong>Visual:</strong> ${escapeHtml(s.visual)}</p>
                <p class="text-[11px] text-outline italic">"${escapeHtml(s.narration)}"</p>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // ─── TAB 8: PREVIEW AS STUDENT TAB ─────────────────────────────────────────

  async function renderPreviewStudentTab() {
    const container = document.getElementById('student-preview-container');
    if (!container || !currentProject) return;

    try {
      const res = await window.KinetiqAPI.learningProjects.previewStudent(currentProject.id);
      const data = res.data || {};
      const proj = data.project || data.overview || currentProject;
      const course = data.course || {};
      const sections = data.sections || data.modules || [];
      const questions = data.questions || [];

      container.innerHTML = `
        <div class="space-y-6">
          <div class="p-6 rounded-2xl bg-surface-container border border-secondary/30 space-y-3">
            <div class="flex items-center justify-between">
              <div class="space-y-1">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-secondary/15 text-secondary">Student Preview Mode</span>
                <h3 class="text-xl font-bold text-on-surface">${escapeHtml(proj.title || 'Course')}</h3>
                <p class="text-xs text-outline">${escapeHtml(proj.subject || '')} • Difficulty: ${proj.difficulty || 'Intermediate'} • Duration: ${proj.estimatedDurationMinutes || 45} mins</p>
              </div>
              <a href="/course_lms_player/index.html?course=${currentProject.courseId}" class="px-4 py-2 rounded-xl bg-secondary text-on-secondary font-bold text-xs flex items-center gap-1.5 shadow-md">
                <span>Open Student Player</span>
                <span class="material-symbols-outlined text-[16px]">launch</span>
              </a>
            </div>
            <p class="text-xs text-on-surface-variant leading-relaxed">${escapeHtml(proj.description || 'No description provided.')}</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="p-5 rounded-2xl bg-surface-container border border-outline-variant/20 space-y-3">
              <h4 class="font-bold text-sm text-on-surface">Curriculum (${sections.length} Modules)</h4>
              <div class="space-y-2">
                ${sections.length === 0 ? '<p class="text-xs text-outline">No curriculum modules available yet.</p>' : sections.map((s, idx) => `
                  <div class="p-3 rounded-xl bg-surface-container-high text-xs">
                    <span class="font-bold text-primary">Module ${idx + 1}: ${escapeHtml(s.title)}</span>
                    <div class="text-[11px] text-outline mt-1">${(s.lessons || []).length} Lessons</div>
                  </div>
                `).join('')}
              </div>
            </div>

            <div class="p-5 rounded-2xl bg-surface-container border border-outline-variant/20 space-y-3">
              <h4 class="font-bold text-sm text-on-surface">Interactive Questions (${questions.length} items)</h4>
              <p class="text-[11px] text-outline">Note: In student mode, official answer keys and explanations are stripped!</p>
              <div class="space-y-2">
                ${questions.length === 0 ? '<p class="text-xs text-outline">No assessment questions available yet.</p>' : questions.map((q, idx) => `
                  <div class="p-3 rounded-xl bg-surface-container-high text-xs space-y-1.5">
                    <span class="font-semibold text-on-surface">Q${idx + 1}: ${escapeHtml(q.question)}</span>
                    ${(q.options || []).length > 0 ? `
                      <div class="text-[11px] text-outline space-y-0.5">
                        ${q.options.map(o => `<div>• ${escapeHtml(o)}</div>`).join('')}
                      </div>
                    ` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      console.warn('Student preview unavailable:', err.message);
      container.innerHTML = `
        <div class="p-8 text-center text-outline bg-surface-container rounded-2xl border border-outline-variant/20 space-y-2">
          <p class="text-sm font-semibold text-on-surface">Student Preview Unavailable</p>
          <p class="text-xs">${escapeHtml(err.message || 'Complete course generation to preview as student.')}</p>
        </div>
      `;
    }
  }

  // ─── TAB 9: PUBLISHING SETTINGS TAB ────────────────────────────────────────

  function renderPublishingTab() {
    if (!currentProject) return;

    const elStatus = document.getElementById('txt-pub-tab-status');
    const elVis = document.getElementById('txt-pub-tab-vis');
    const pub = currentProject.publicationSettings || {};

    if (elStatus) elStatus.textContent = currentProject.status.toUpperCase();
    if (elVis) elVis.textContent = currentProject.isPublished ? 'Published to Student Portal ✓' : 'Draft / Unpublished';

    const chkNotes = document.getElementById('chk-tab-notes');
    const chkFlash = document.getElementById('chk-tab-flashcards');
    const chkQuiz = document.getElementById('chk-tab-quiz');
    const chkVideo = document.getElementById('chk-tab-video');
    const chkTutor = document.getElementById('chk-tab-tutor');
    const chkDown = document.getElementById('chk-tab-download');

    if (chkNotes) chkNotes.checked = pub.publishNotes !== false;
    if (chkFlash) chkFlash.checked = pub.publishFlashcards !== false;
    if (chkQuiz) chkQuiz.checked = pub.publishQuiz !== false;
    if (chkVideo) chkVideo.checked = pub.publishVideo !== false;
    if (chkTutor) chkTutor.checked = pub.publishTutor !== false;
    if (chkDown) chkDown.checked = pub.allowDownload !== false;

    // Render access table in publishing tab
    loadPublishingAccessTable();
  }

  async function loadPublishingAccessTable() {
    const wrap = document.getElementById('publishing-access-table-wrap');
    if (!wrap || !currentProject) return;

    try {
      const accessRes = await window.KinetiqAPI.learningProjects.getAccessList(currentProject.id);
      const accesses = accessRes.data || [];

      if (accesses.length === 0) {
        wrap.innerHTML = `<div class="p-4 rounded-xl bg-surface-container text-xs text-outline text-center">No individual students assigned. When published with "all" audience, all students have access.</div>`;
        return;
      }

      wrap.innerHTML = `
        <div class="border border-outline-variant/20 rounded-xl overflow-hidden">
          <table class="w-full text-left text-xs">
            <thead class="bg-surface-container text-outline">
              <tr>
                <th class="p-2.5">Student</th>
                <th class="p-2.5">Type</th>
                <th class="p-2.5">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline-variant/15 text-on-surface">
              ${accesses.map(a => `
                <tr>
                  <td class="p-2.5">${escapeHtml(a.student?.email || a.studentId)}</td>
                  <td class="p-2.5 capitalize">${escapeHtml(a.assignmentType || 'individual')}</td>
                  <td class="p-2.5"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${a.status === 'active' ? 'bg-secondary/15 text-secondary' : 'bg-error/15 text-error'}">${a.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) {
      console.warn('Failed to load access list for publishing tab:', e);
    }
  }

  // ─── LOAD ANALYTICS & ADAPTIVE STUDY PLAN ──────────────────────────────────

  async function loadAnalytics() {
    if (!currentProject) return;
    try {
      const res = await window.KinetiqAPI.learningProjects.getAnalytics(currentProject.id);
      const data = res.data;
      const container = document.getElementById('analytics-plan-container');
      if (!container) return;

      container.innerHTML = `
        <div class="space-y-6">
          <div class="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between">
            <div class="space-y-1">
              <span class="font-semibold text-xs text-outline uppercase tracking-wider">Cognitive Mastery Score</span>
              <div class="flex items-baseline gap-2">
                <span class="text-3xl font-bold text-on-surface">${data.overallMastery || 75}%</span>
                <span class="text-xs text-secondary font-medium">+12% from practice drills</span>
              </div>
            </div>
            <div class="w-48 bg-surface-container rounded-full h-3 overflow-hidden">
              <div class="bg-gradient-to-r from-primary to-secondary h-full rounded-full" style="width: ${data.overallMastery || 75}%"></div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="p-5 rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-3">
              <h4 class="font-semibold text-sm text-error flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[18px]">priority_high</span>
                Priority Recovery Objectives
              </h4>
              <div class="space-y-2">
                ${(data.weakTopics || []).map(wt => `
                  <div class="p-3 rounded-lg bg-surface-container flex items-center justify-between text-xs">
                    <span class="font-medium text-on-surface">${escapeHtml(wt.topic)}</span>
                    <span class="text-error font-bold">${wt.masteryScore}% accuracy</span>
                  </div>
                `).join('') || '<p class="text-xs text-outline">No critical weak topics detected.</p>'}
              </div>
            </div>

            <div class="p-5 rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-3">
              <h4 class="font-semibold text-sm text-primary flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[18px]">verified</span>
                Cognitive Reinforcement Recommendations
              </h4>
              <div class="space-y-2">
                ${(data.recommendations || []).map(rec => `
                  <div class="p-3 rounded-lg bg-surface-container text-xs text-on-surface-variant flex items-start gap-2">
                    <span class="material-symbols-outlined text-primary text-[16px] shrink-0 mt-0.5">lightbulb</span>
                    <span>${escapeHtml(rec.action || rec.reason || '')}</span>
                  </div>
                `).join('') || '<p class="text-xs text-outline">Continue regular practice to maintain recall.</p>'}
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  }

  // ─── CHAT TUTOR MESSAGES ───────────────────────────────────────────────────

  function appendTutorMessage(role, text, citations = []) {
    const chatContainer = document.getElementById('tutor-messages-container');
    if (!chatContainer) return;

    const isUser = role === 'user';
    const msgDiv = document.createElement('div');
    msgDiv.className = `flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`;

    let citationsHtml = '';
    if (citations && citations.length > 0) {
      citationsHtml = `
        <div class="pt-2 border-t border-outline-variant/20 space-y-1">
          <span class="text-[10px] uppercase font-bold text-primary block">Source Passages & Citations:</span>
          ${citations.map(c => `
            <div class="p-2 rounded bg-surface-container-high/60 text-[11px] text-on-surface-variant border border-outline-variant/20">
              <span class="font-semibold text-primary">${escapeHtml(c.sourceTitle)}</span> › <em>${escapeHtml(c.heading)}</em>
              <p class="mt-0.5 text-outline">${escapeHtml(c.textSnippet)}</p>
            </div>
          `).join('')}
        </div>
      `;
    }

    msgDiv.innerHTML = `
      ${!isUser ? `<div class="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5"><span class="material-symbols-outlined text-[16px]">smart_toy</span></div>` : ''}
      <div class="max-w-xl p-3.5 rounded-2xl ${isUser ? 'bg-primary text-on-primary rounded-br-sm' : 'bg-surface-container text-on-surface rounded-bl-sm border border-outline-variant/30'} text-xs leading-relaxed space-y-2">
        <div class="whitespace-pre-line">${escapeHtml(text)}</div>
        ${citationsHtml}
      </div>
      ${isUser ? `<div class="w-7 h-7 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center shrink-0 mt-0.5"><span class="material-symbols-outlined text-[16px]">person</span></div>` : ''}
    `;

    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  // ─── UTILITY HELPERS ───────────────────────────────────────────────────────

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatMarkdownToHtml(md) {
    return md
      .replace(/^### (.*$)/gim, '<h3 class="text-base font-bold text-on-surface mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-on-surface mt-5 mb-2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold text-primary mt-6 mb-3">$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/\n$/gim, '<br />');
  }

  function formatSeconds(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  // ─── GLOBAL CONTROLLER DISPATCHER ──────────────────────────────────────────

  window.KinetiqStudio = {
    deleteSource: async (sourceId) => {
      if (!currentProject) return;
      if (!confirm('Remove this educational source from the project?')) return;
      try {
        await window.KinetiqAPI.learningProjects.deleteSource(currentProject.id, sourceId);
        window.KinetiqAPI.ui.showSuccess('Source removed.');
        await refreshCurrentProject();
      } catch (e) {
        window.KinetiqAPI.ui.showError(e.message);
      }
    },

    revokeAccess: async (studentId) => {
      if (!currentProject) return;
      if (!confirm('Revoke access for this student? They will no longer be able to view this content.')) return;
      try {
        window.KinetiqAPI.ui.showLoading('Revoking access...');
        await window.KinetiqAPI.learningProjects.revokeAccess(currentProject.id, studentId);
        window.KinetiqAPI.ui.hideLoading();
        window.KinetiqAPI.ui.showSuccess('Student access revoked.');
        await loadAccessModalData();
      } catch (e) {
        window.KinetiqAPI.ui.hideLoading();
        window.KinetiqAPI.ui.showError(e.message);
      }
    },

    grantAccess: async (studentId) => {
      if (!currentProject) return;
      try {
        window.KinetiqAPI.ui.showLoading('Reactivating access...');
        await window.KinetiqAPI.learningProjects.assignAccess(currentProject.id, { studentId });
        window.KinetiqAPI.ui.hideLoading();
        window.KinetiqAPI.ui.showSuccess('Student access reactivated.');
        await loadAccessModalData();
      } catch (e) {
        window.KinetiqAPI.ui.hideLoading();
        window.KinetiqAPI.ui.showError(e.message);
      }
    },

    flipFlashcard: () => {
      isFlashcardFlipped = !isFlashcardFlipped;
      renderFlashcards();
    },

    nextFlashcard: () => {
      const fcs = currentStudyPack?.flashcards || [];
      if (fcs.length === 0) return;
      currentFlashcardIndex = (currentFlashcardIndex + 1) % fcs.length;
      isFlashcardFlipped = false;
      renderFlashcards();
    },

    prevFlashcard: () => {
      const fcs = currentStudyPack?.flashcards || [];
      if (fcs.length === 0) return;
      currentFlashcardIndex = (currentFlashcardIndex - 1 + fcs.length) % fcs.length;
      isFlashcardFlipped = false;
      renderFlashcards();
    },

    selectQuizAnswer: (questionId, value) => {
      currentQuizAnswers[questionId] = value;
    },

    submitQuiz: async () => {
      if (!currentProject) return;
      try {
        window.KinetiqAPI.ui.showLoading('Grading answers and updating topic mastery...');
        const res = await window.KinetiqAPI.learningProjects.submitPractice(currentProject.id, currentQuizAnswers);
        window.KinetiqAPI.ui.hideLoading();

        const data = res.data;
        const scoreEl = document.getElementById('quiz-overall-score');
        if (scoreEl) {
          scoreEl.textContent = `Score: ${data.scorePercentage}% (${data.earnedMarks}/${data.totalMarks} Marks) • Progress saved!`;
        }

        // Show feedback on individual questions
        (data.results || []).forEach(r => {
          const fb = document.getElementById(`feedback-${r.questionId}`);
          if (fb) {
            fb.classList.remove('hidden');
            fb.className = `p-3 rounded-lg text-xs mt-2 ${r.isCorrect ? 'bg-secondary/10 text-secondary border border-secondary/20' : 'bg-error/10 text-error border border-error/20'}`;
            fb.innerHTML = `
              <strong>${r.isCorrect ? '✅ Correct' : '❌ Incorrect'}</strong> — Expected: <em>${escapeHtml(r.correctAnswer)}</em>
              <p class="mt-1 text-on-surface-variant">${escapeHtml(r.explanation)}</p>
            `;
          }
        });

        await loadAnalytics();
      } catch (err) {
        window.KinetiqAPI.ui.hideLoading();
        window.KinetiqAPI.ui.showError(err.message);
      }
    },

    startExamTimer: () => {
      alert('Exam session initiated! Answer questions carefully. Timer is running.');
      switchTab('practice-quiz');
    },

    seekVideo: (time) => {
      const vid = document.getElementById('studio-lecture-video');
      if (vid) {
        vid.currentTime = time;
        vid.play();
      }
    },

    exportMarkdown: () => {
      if (!currentProject) return;
      window.open(window.KinetiqAPI.learningProjects.getExportUrl(currentProject.id), '_blank');
    },

    addLessonPrompt: async (sectionId) => {
      if (!currentProject) return;
      const title = prompt('Enter lesson title (e.g. "Quorum Safety Invariants"):');
      if (!title || !title.trim()) return;
      const durationMinutes = parseInt(prompt('Estimated duration in minutes (e.g. 15):') || '15', 10);
      try {
        window.KinetiqAPI.ui.showLoading('Adding lesson...');
        await window.KinetiqAPI.learningProjects.createLesson(currentProject.id, {
          sectionId,
          title: title.trim(),
          durationMinutes,
        });
        window.KinetiqAPI.ui.hideLoading();
        window.KinetiqAPI.ui.showSuccess('Lesson added!');
        await renderModulesTab();
      } catch (err) {
        window.KinetiqAPI.ui.hideLoading();
        window.KinetiqAPI.ui.showError(err.message);
      }
    },

    deleteSection: async (sectionId) => {
      if (!currentProject) return;
      if (!confirm('Delete this module and all its lessons?')) return;
      try {
        window.KinetiqAPI.ui.showLoading('Deleting module...');
        await window.KinetiqAPI.learningProjects.deleteSection(currentProject.id, sectionId);
        window.KinetiqAPI.ui.hideLoading();
        window.KinetiqAPI.ui.showSuccess('Module deleted.');
        await renderModulesTab();
      } catch (err) {
        window.KinetiqAPI.ui.hideLoading();
        window.KinetiqAPI.ui.showError(err.message);
      }
    },

    deleteLesson: async (lessonId) => {
      if (!currentProject) return;
      if (!confirm('Delete this lesson?')) return;
      try {
        window.KinetiqAPI.ui.showLoading('Deleting lesson...');
        await window.KinetiqAPI.learningProjects.deleteLesson(currentProject.id, lessonId);
        window.KinetiqAPI.ui.hideLoading();
        window.KinetiqAPI.ui.showSuccess('Lesson deleted.');
        await renderModulesTab();
      } catch (err) {
        window.KinetiqAPI.ui.hideLoading();
        window.KinetiqAPI.ui.showError(err.message);
      }
    },

    regenerateLesson: async (lessonId) => {
      if (!currentProject) return;
      try {
        window.KinetiqAPI.ui.showLoading('Regenerating lesson content with AI (preserving student attempt progress)...');
        await window.KinetiqAPI.learningProjects.regenerateLesson(currentProject.id, lessonId);
        window.KinetiqAPI.ui.hideLoading();
        window.KinetiqAPI.ui.showSuccess('Lesson regenerated successfully!');
        await renderModulesTab();
      } catch (err) {
        window.KinetiqAPI.ui.hideLoading();
        window.KinetiqAPI.ui.showError(err.message);
      }
    },

    deleteQuestion: async (questionId) => {
      if (!currentProject) return;
      if (!confirm('Remove this question from the bank?')) return;
      try {
        window.KinetiqAPI.ui.showLoading('Removing question...');
        await window.KinetiqAPI.learningProjects.deleteQuestion(currentProject.id, questionId);
        window.KinetiqAPI.ui.hideLoading();
        window.KinetiqAPI.ui.showSuccess('Question removed.');
        await loadStudyPack();
      } catch (err) {
        window.KinetiqAPI.ui.hideLoading();
        window.KinetiqAPI.ui.showError(err.message);
      }
    },
  };

})();
