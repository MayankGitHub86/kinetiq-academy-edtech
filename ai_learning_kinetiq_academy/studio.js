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

  document.addEventListener('DOMContentLoaded', async () => {
    if (!window.KinetiqAPI) return;

    // Check auth or default to instructor for demo access if completely empty
    if (!window.KinetiqAPI.store.user.isLoggedIn()) {
      try {
        await window.KinetiqAPI.auth.login('instructor@kinetiqacademy.com', 'Password123!');
      } catch (e) {
        console.warn('Initial session check:', e);
      }
    }

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
        const title = document.getElementById('inp-proj-title')?.value;
        const subject = document.getElementById('inp-proj-subject')?.value;
        const description = document.getElementById('inp-proj-desc')?.value;
        const educationLevel = document.getElementById('sel-education-level')?.value;
        const explanationDepth = document.getElementById('sel-explanation-depth')?.value;

        if (!title) return;

        try {
          window.KinetiqAPI.ui.showLoading('Creating AI Learning Project...');
          const res = await window.KinetiqAPI.learningProjects.create({
            title,
            subject,
            description,
            settings: { educationLevel, explanationDepth },
          });

          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showSuccess('Project created successfully!');
          modalNewProj.classList.add('hidden');
          formNewProj.reset();

          await loadProjects(res.data.id);
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

    // 5. AI Analysis & Study Pack Generation
    const btnAnalyze = document.getElementById('btn-analyze-project');
    if (btnAnalyze) {
      btnAnalyze.addEventListener('click', async () => {
        if (!currentProject) return;
        try {
          window.KinetiqAPI.ui.showLoading('Central AI Knowledge Engine: synthesizing multi-source knowledge map...');
          await window.KinetiqAPI.learningProjects.analyze(currentProject.id);
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showSuccess('Knowledge map synthesized!');
          await refreshCurrentProject();
          switchTab('knowledge-map');
        } catch (err) {
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showError(err.message);
        }
      });
    }

    const btnGeneratePack = document.getElementById('btn-generate-pack');
    if (btnGeneratePack) {
      btnGeneratePack.addEventListener('click', async () => {
        if (!currentProject) return;
        const packType = document.getElementById('sel-pack-type')?.value || 'complete';
        try {
          window.KinetiqAPI.ui.showLoading('Generating Personal Study Pack (Notes, Flashcards, Questions, Video)...');
          await window.KinetiqAPI.learningProjects.generatePack(currentProject.id, { packType });
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showSuccess('Personal Study Pack ready!');
          await refreshCurrentProject();
          switchTab('study-notes');
        } catch (err) {
          window.KinetiqAPI.ui.hideLoading();
          window.KinetiqAPI.ui.showError(err.message);
        }
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
      window.KinetiqAPI.ui.showError(err.message);
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
      renderKnowledgeMap();
      renderStudyNotes();
      renderFlashcards();
      renderQuiz();
      renderExamBlueprint();
      renderVideoLecture();
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
  };

})();
