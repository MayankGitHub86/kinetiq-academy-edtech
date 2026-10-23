/**
 * Kinetiq Academy - Universal API Client
 * Connects the frontend to the backend REST API.
 * Handles auth tokens, request/response, and error display.
 */

(function () {
  'use strict';

  const BASE_URL = (window.KINETIQ_CONFIG && window.KINETIQ_CONFIG.API_BASE_URL) || 'http://localhost:4000/api/v1';
  const SOCKET_URL = (window.KINETIQ_CONFIG && window.KINETIQ_CONFIG.SOCKET_URL) || 'http://localhost:4000';

  // ─── Token Management ──────────────────────────────────────────────────────

  const TokenStore = {
    getAccess: () => localStorage.getItem('ka_access_token'),
    getRefresh: () => localStorage.getItem('ka_refresh_token'),
    setTokens: (access, refresh) => {
      if (access) localStorage.setItem('ka_access_token', access);
      if (refresh) localStorage.setItem('ka_refresh_token', refresh);
    },
    clear: () => {
      localStorage.removeItem('ka_access_token');
      localStorage.removeItem('ka_refresh_token');
      localStorage.removeItem('ka_user');
    },
    isExpired: () => {
      const token = localStorage.getItem('ka_access_token');
      if (!token) return true;
      try {
        const parts = token.split('.');
        if (parts.length !== 3) return true;
        const payload = JSON.parse(atob(parts[1]));
        if (!payload.exp) return false;
        // Buffer by 10 seconds before actual expiry
        return Date.now() >= (payload.exp * 1000 - 10000);
      } catch {
        return true;
      }
    },
  };

  const UserStore = {
    get: () => {
      try { return JSON.parse(localStorage.getItem('ka_user') || 'null'); } catch { return null; }
    },
    set: (user) => localStorage.setItem('ka_user', JSON.stringify(user)),
    clear: () => localStorage.removeItem('ka_user'),
    isLoggedIn: () => !!TokenStore.getAccess() && !TokenStore.isExpired(),
    isAdmin: () => { const u = UserStore.get(); return u?.role === 'admin'; },
    isInstructor: () => { const u = UserStore.get(); return u?.role === 'instructor' || u?.role === 'admin'; },
  };

  // ─── Core HTTP Client ──────────────────────────────────────────────────────

  let _refreshPromise = null;

  async function request(method, path, body = null, opts = {}) {
    // If access token is expired but refresh token exists, refresh upfront
    if (TokenStore.isExpired() && TokenStore.getRefresh() && !path.includes('/auth/')) {
      try {
        if (!_refreshPromise) {
          _refreshPromise = refreshAccessToken().finally(() => { _refreshPromise = null; });
        }
        await _refreshPromise;
      } catch {
        TokenStore.clear();
      }
    }

    const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
    const headers = { 'Content-Type': 'application/json', ...opts.headers };

    const token = TokenStore.getAccess();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const fetchOpts = { method, headers, credentials: 'include' };
    if (body && method !== 'GET') fetchOpts.body = JSON.stringify(body);

    let res = await fetch(url, fetchOpts);

    // Auto-refresh token on 401
    if (res.status === 401 && !opts._retry && !path.includes('/auth/login') && !path.includes('/auth/register')) {
      if (TokenStore.getRefresh()) {
        if (!_refreshPromise) {
          _refreshPromise = refreshAccessToken().finally(() => { _refreshPromise = null; });
        }
        try {
          await _refreshPromise;
          return request(method, path, body, { ...opts, _retry: true });
        } catch {
          TokenStore.clear();
        }
      } else {
        TokenStore.clear();
      }
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401) {
        TokenStore.clear();
      }
      const err = new Error(data.message || data.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  async function refreshAccessToken() {
    const refreshToken = TokenStore.getRefresh();
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) throw new Error('Refresh failed');
    const data = await res.json();
    TokenStore.setTokens(data.data.accessToken, data.data.refreshToken);
  }

  const api = {
    get: (path, opts) => request('GET', path, null, opts),
    post: (path, body, opts) => request('POST', path, body, opts),
    patch: (path, body, opts) => request('PATCH', path, body, opts),
    put: (path, body, opts) => request('PUT', path, body, opts),
    delete: (path, opts) => request('DELETE', path, null, opts),
  };

  // ─── Auth API ──────────────────────────────────────────────────────────────

  const Auth = {
    async register(firstName, lastName, email, password, role = 'student') {
      const res = await api.post('/auth/register', { firstName, lastName, email, password, role });
      TokenStore.setTokens(res.data.accessToken, res.data.refreshToken);
      UserStore.set(res.data.user);
      return res.data;
    },

    async login(email, password) {
      const res = await api.post('/auth/login', { email, password });
      TokenStore.setTokens(res.data.accessToken, res.data.refreshToken);
      UserStore.set(res.data.user);
      return res.data;
    },

    async logout() {
      try { await api.post('/auth/logout'); } catch {}
      TokenStore.clear();
    },

    async verifyEmail(token) {
      return api.get(`/auth/verify-email?token=${token}`);
    },

    async requestPasswordReset(email) {
      return api.post('/auth/forgot-password', { email });
    },

    async resetPassword(token, newPassword) {
      return api.post('/auth/reset-password', { token, newPassword });
    },
  };

  // ─── Courses API ───────────────────────────────────────────────────────────

  const Courses = {
    async list(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return api.get(`/courses${qs ? '?' + qs : ''}`);
    },

    async get(slug) {
      return api.get(`/courses/${slug}`);
    },

    async getBySlug(slug) {
      return api.get(`/courses/${slug}`);
    },

    async getById(id) {
      return api.get(`/courses/${id}`);
    },

    async getCategories() {
      return api.get('/courses/categories');
    },

    async enroll(courseId) {
      return api.post(`/courses/${courseId}/enroll`);
    },

    async submitReview(courseId, rating, comment) {
      return api.post(`/courses/${courseId}/review`, { rating, comment });
    },

    async updateProgress(courseId, lessonId, data) {
      return api.patch(`/courses/${courseId}/lessons/${lessonId}/progress`, data);
    },

    async getLesson(courseId, lessonId) {
      return api.get(`/courses/${courseId}/lessons/${lessonId}`);
    },
  };

  // ─── User API ──────────────────────────────────────────────────────────────

  const User = {
    async getMe() {
      return api.get('/users/me');
    },

    async updateMe(data) {
      return api.patch('/users/me', data);
    },

    async getDashboard() {
      return api.get('/users/dashboard');
    },

    async getEnrolledCourses(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return api.get(`/users/courses${qs ? '?' + qs : ''}`);
    },

    async getNotifications(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return api.get(`/users/notifications${qs ? '?' + qs : ''}`);
    },

    async markNotificationRead(id) {
      return api.patch(`/users/notifications/${id}/read`);
    },

    async markAllNotificationsRead() {
      return api.post('/users/notifications/read-all');
    },

    async changePassword(currentPassword, newPassword) {
      return api.post('/users/change-password', { currentPassword, newPassword });
    },

    async getCertificates() {
      return api.get('/users/certificates');
    },

    async completeOnboarding(data) {
      return api.post('/users/onboarding', data);
    },
  };

  // ─── AI API ────────────────────────────────────────────────────────────────

  const AI = {
    async getRecommendations(limit = 8) {
      return api.get(`/ai/recommendations?limit=${limit}`);
    },

    async getTrending(limit = 6) {
      return api.get(`/ai/trending?limit=${limit}`);
    },

    async getSimilar(courseId, limit = 4) {
      return api.get(`/ai/similar/${courseId}?limit=${limit}`);
    },

    async search(query, limit = 10) {
      return api.get(`/ai/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    },

    async trackEvent(eventName, properties, sessionId) {
      return api.post('/ai/track', { eventName, properties, sessionId }).catch(() => {});
    },

    async createContentJob(payload) {
      return api.post('/ai/content-jobs', payload);
    },

    async uploadDocumentJob(formData) {
      const url = `${BASE_URL}/ai/content-jobs/upload`;
      const token = TokenStore.getAccess();
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(url, { method: 'POST', headers, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      return data;
    },

    async getContentJob(id) {
      return api.get(`/ai/content-jobs/${id}`);
    },

    async listContentJobs() {
      return api.get('/ai/content-jobs');
    },

    async publishContentJob(id, publishImmediately = true) {
      return api.post(`/ai/content-jobs/${id}/publish`, { publishImmediately });
    },

    async cancelContentJob(id) {
      return api.post(`/ai/content-jobs/${id}/cancel`);
    },

    async askTutor(courseId, query, lessonId = null, videoTimestamp = null) {
      return api.post('/ai/tutor/chat', { courseId, query, lessonId, videoTimestamp });
    },

    async getPracticePaper(paperId) {
      return api.get(`/ai/practice-papers/${paperId}`);
    },

    async submitPracticePaper(paperId, answers) {
      return api.post(`/ai/practice-papers/${paperId}/submit`, { answers });
    },

    async getCoursePackage(courseId) {
      return api.get(`/ai/courses/${courseId}/package`);
    },

    async getDiagnostics() {
      return api.get('/ai/diagnostics');
    },

    async updateLesson(jobId, moduleIndex, lessonIndex, data) {
      const payload = (typeof moduleIndex === 'object' && moduleIndex !== null)
        ? moduleIndex
        : { moduleIndex, lessonIndex, ...(data || {}) };
      return api.put(`/ai/content-jobs/${jobId}/lesson`, payload);
    },

    async updateCurriculum(jobId, modules) {
      return api.put(`/ai/content-jobs/${jobId}/curriculum`, { modules });
    },

    async updateStudyNotes(jobId, studyNotes) {
      return api.put(`/ai/content-jobs/${jobId}/study-notes`, { studyNotes });
    },

    async updateQuestions(jobId, questions) {
      return api.put(`/ai/content-jobs/${jobId}/questions`, { questions });
    },

    async approveCurriculum(jobId, approvedModules = null) {
      const body = approvedModules ? { approvedModules } : {};
      return api.post(`/ai/content-jobs/${jobId}/approve-curriculum`, body);
    },

    async retryJob(jobId) {
      return api.post(`/ai/content-jobs/${jobId}/retry`);
    },

    async getJobVersions(jobId) {
      return api.get(`/ai/content-jobs/${jobId}/versions`);
    },

    // ─── Phase 2: Course Quality Score ─────────────────────────────────────────
    async getCourseQuality(courseId) {
      return api.get(`/ai/courses/${courseId}/quality`);
    },

    async reevaluateCourseQuality(courseId, jobId = null) {
      return api.post(`/ai/courses/${courseId}/quality/re-evaluate`, { jobId });
    },

    async overrideQualityReport(reportId, status, notes = '') {
      return api.post(`/ai/quality-reports/${reportId}/override`, { status, notes });
    },

    // ─── Phase 2: Adaptive Learning & Topic Mastery ───────────────────────────
    async getAdaptiveProfile(courseId = null) {
      return api.get(`/ai/learning-paths/profile${courseId ? '?courseId=' + courseId : ''}`);
    },

    async getCourseMastery(courseId) {
      return api.get(`/ai/courses/${courseId}/mastery`);
    },

    async resolveRecommendation(id) {
      return api.post(`/ai/recommendations/${id}/resolve`);
    },

    // ─── Phase 2: Interactive Video Learning ──────────────────────────────────
    async getVideoChapters(lessonId, courseId = '') {
      return api.get(`/ai/lessons/${lessonId}/video/chapters${courseId ? '?courseId=' + courseId : ''}`);
    },

    async getVideoCheckpoints(lessonId, courseId = '') {
      return api.get(`/ai/lessons/${lessonId}/video/checkpoints${courseId ? '?courseId=' + courseId : ''}`);
    },

    async submitCheckpoint(checkpointId, selectedAnswer) {
      return api.post(`/ai/video/checkpoints/${checkpointId}/submit`, { selectedAnswer });
    },

    async explainMoment(courseId, lessonId, timestampSeconds, nearbyTranscript = '') {
      return api.post('/ai/video/explain-moment', { courseId, lessonId, timestampSeconds, nearbyTranscript });
    },

    async getVideoNotes(lessonId) {
      return api.get(`/ai/lessons/${lessonId}/video/notes`);
    },

    async addVideoNote(courseId, lessonId, timestampSeconds, noteText) {
      return api.post(`/ai/lessons/${lessonId}/video/notes`, { courseId, timestampSeconds, noteText });
    },

    async deleteVideoNote(noteId) {
      return api.delete(`/ai/video/notes/${noteId}`);
    },

    async getVideoBookmarks(lessonId) {
      return api.get(`/ai/lessons/${lessonId}/video/bookmarks`);
    },

    async addVideoBookmark(courseId, lessonId, timestampSeconds, label = '') {
      return api.post(`/ai/lessons/${lessonId}/video/bookmarks`, { courseId, timestampSeconds, label });
    },

    async deleteVideoBookmark(bookmarkId) {
      return api.delete(`/ai/video/bookmarks/${bookmarkId}`);
    },

    async trackVideoProgress(courseId, lessonId, watchedSeconds, totalDurationSeconds) {
      return api.post('/ai/video/progress', { courseId, lessonId, watchedSeconds, totalDurationSeconds });
    },

    // ─── Phase 2: Exam Paper Blueprints ───────────────────────────────────────
    async validateExamBlueprint(blueprintDto) {
      return api.post('/ai/exam-blueprints/validate', blueprintDto);
    },

    async createExamBlueprint(blueprintDto) {
      return api.post('/ai/exam-blueprints', blueprintDto);
    },

    async listExamBlueprints(courseId = '') {
      return api.get(`/ai/exam-blueprints${courseId ? '?courseId=' + courseId : ''}`);
    },

    async generatePaperFromBlueprint(blueprintId) {
      return api.post(`/ai/exam-blueprints/${blueprintId}/generate`);
    },

    async getBlueprintVersions(blueprintId) {
      return api.get(`/ai/exam-blueprints/${blueprintId}/versions`);
    },

    // ─── Phase 2: Cost & Stage Monitoring ─────────────────────────────────────
    async getJobStages(jobId) {
      return api.get(`/ai/content-jobs/${jobId}/stages`);
    },

    async retryContentJob(jobId) {
      return api.post(`/ai/content-jobs/${jobId}/retry`);
    },

    async getGenerationUsage() {
      return api.get('/ai/generation-usage');
    },
  };

  // ─── Payments API ──────────────────────────────────────────────────────────

  const Payments = {
    async createCheckoutSession(courseId) {
      const origin = window.location.origin;
      return api.post('/payments/checkout', {
        courseId,
        successUrl: `${origin}/student_portal_dashboard_kinetiq_academy/code.html?payment=success&course=${courseId}`,
        cancelUrl: window.location.href,
      });
    },

    async getOrders(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return api.get(`/payments/orders${qs ? '?' + qs : ''}`);
    },
  };

  // ─── Quiz API ──────────────────────────────────────────────────────────────

  const Quiz = {
    async startAttempt(lessonId) {
      return api.post(`/quiz/lessons/${lessonId}/start`);
    },

    async submit(attemptId, lessonId, answers, timeTakenSeconds) {
      return api.post(`/quiz/attempts/${attemptId}/submit`, { answers, lessonId, timeTakenSeconds });
    },

    async getHistory(lessonId) {
      return api.get(`/quiz/lessons/${lessonId}/history`);
    },

    async getBestAttempt(lessonId) {
      return api.get(`/quiz/lessons/${lessonId}/best`);
    },
  };

  // ─── Certificates API ──────────────────────────────────────────────────────

  const Certificates = {
    async get(id) {
      return api.get(`/quiz/certificates/${id}`);
    },

    async verify(number) {
      return api.get(`/quiz/certificates/verify/${number}`);
    },
  };

  const Analytics = {
    async getInstructor() {
      return api.get('/analytics/instructor');
    },

    async getPlatform() {
      return api.get('/analytics/platform');
    },
  };

  // ─── Admin API ─────────────────────────────────────────────────────────────

  const Admin = {
    async getStats() {
      return api.get('/admin/stats');
    },

    async getUsers(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return api.get(`/admin/users${qs ? '?' + qs : ''}`);
    },

    async getCourses(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return api.get(`/admin/courses${qs ? '?' + qs : ''}`);
    },

    async updateUserRole(userId, role) {
      return api.patch(`/admin/users/${userId}/role`, { role });
    },
  };

  // ─── UI Helpers ────────────────────────────────────────────────────────────

  const UI = {
    /**
     * Show a loading spinner overlay
     */
    showLoading(message = 'Loading...') {
      let el = document.getElementById('ka-loading-overlay');
      if (!el) {
        el = document.createElement('div');
        el.id = 'ka-loading-overlay';
        el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(9,13,22,0.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;';
        el.innerHTML = `
          <div style="width:40px;height:40px;border:3px solid rgba(99,102,241,0.3);border-top-color:#6366f1;border-radius:50%;animation:ka-spin 0.8s linear infinite;"></div>
          <div id="ka-loading-msg" style="color:#c7d2fe;font-family:sans-serif;font-size:14px;">${message}</div>
          <style>@keyframes ka-spin{to{transform:rotate(360deg)}}</style>
        `;
        document.body.appendChild(el);
      } else {
        document.getElementById('ka-loading-msg').textContent = message;
        el.style.display = 'flex';
      }
    },

    hideLoading() {
      const el = document.getElementById('ka-loading-overlay');
      if (el) el.style.display = 'none';
    },

    /**
     * Show an error banner at top of page
     */
    showError(message, duration = 5000) {
      let el = document.getElementById('ka-error-banner');
      if (!el) {
        el = document.createElement('div');
        el.id = 'ka-error-banner';
        el.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:99999;padding:12px 24px;background:#ef4444;color:#fff;border-radius:8px;font-family:sans-serif;font-size:14px;box-shadow:0 8px 32px rgba(239,68,68,0.3);display:flex;align-items:center;gap:8px;';
        document.body.appendChild(el);
      }
      el.innerHTML = `<span>⚠️</span> <span>${message}</span>`;
      el.style.display = 'flex';
      clearTimeout(el._timeout);
      el._timeout = setTimeout(() => { el.style.display = 'none'; }, duration);
    },

    showSuccess(message, duration = 3000) {
      if (window.KinetiqRouter?.showToast) {
        window.KinetiqRouter.showToast(message, duration);
      }
    },

    /**
     * Format duration minutes to readable string
     */
    formatDuration(minutes) {
      if (!minutes) return '0m';
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      if (h === 0) return `${m}m`;
      return m === 0 ? `${h}h` : `${h}h ${m}m`;
    },

    /**
     * Format rating stars
     */
    formatRating(rating, max = 5) {
      const full = Math.floor(rating);
      const half = rating % 1 >= 0.5;
      let stars = '★'.repeat(full);
      if (half) stars += '⯨';
      stars += '☆'.repeat(max - full - (half ? 1 : 0));
      return stars;
    },

    /**
     * Format price
     */
    formatPrice(price, currency = 'USD') {
      if (!price || price === 0) return 'Free';
      return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price);
    },

    /**
     * Format relative time
     */
    formatRelativeTime(dateStr) {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = now - date;
      const s = Math.floor(diff / 1000);
      const m = Math.floor(s / 60);
      const h = Math.floor(m / 60);
      const d = Math.floor(h / 24);
      if (d > 30) return date.toLocaleDateString();
      if (d > 0) return `${d}d ago`;
      if (h > 0) return `${h}h ago`;
      if (m > 0) return `${m}m ago`;
      return 'just now';
    },
  };

  // ─── Auth Guards ───────────────────────────────────────────────────────────

  function requireAuth() {
    if (!UserStore.isLoggedIn()) {
      window.location.href = window.KinetiqRouter?.resolveUrl('login') || '/sign_in_register_kinetiq_academy/index.html?tab=signin';
      return false;
    }
    return true;
  }

  function requireInstructor() {
    if (!UserStore.isLoggedIn()) {
      window.location.href = window.KinetiqRouter?.resolveUrl('login') || '/sign_in_register_kinetiq_academy/index.html?tab=signin';
      return false;
    }
    if (!UserStore.isInstructor()) {
      UI.showError('Access Denied: Instructor or Administrator privileges required.');
      return false;
    }
    return true;
  }

  // ─── Real-time (Socket.IO) ─────────────────────────────────────────────────

  let _socket = null;

  const Socket = {
    connect() {
      if (_socket || !UserStore.isLoggedIn()) return;
      if (typeof io === 'undefined') return; // socket.io not loaded
      _socket = io(SOCKET_URL, {
        auth: { token: TokenStore.getAccess() },
      });
      _socket.on('notification', (data) => {
        UI.showSuccess(data.message || 'New notification');
      });
      _socket.on('connect_error', (err) => {
        console.warn('Socket connection failed (non-fatal):', err.message);
      });
      return _socket;
    },

    joinCourse(courseId) {
      if (_socket) _socket.emit('join:course', courseId);
    },

    on(event, handler) {
      if (_socket) _socket.on(event, handler);
    },

    disconnect() {
      if (_socket) { _socket.disconnect(); _socket = null; }
    },
  };

  // ─── Student & Admin AI Learning Projects API ──────────────────────────────

  const LearningProjects = {
    create(data) {
      return api.post('/learning-projects', data);
    },
    list() {
      return api.get('/learning-projects');
    },
    get(id) {
      return api.get(`/learning-projects/${id}`);
    },
    updateSettings(id, settings) {
      return api.put(`/learning-projects/${id}/settings`, settings);
    },
    addUrlSource(id, url) {
      return api.post(`/learning-projects/${id}/sources/url`, { url });
    },
    async addFileSource(id, file) {
      const token = TokenStore.getAccess();
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${BASE_URL}/learning-projects/${id}/sources/file`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'File upload failed');
      return data;
    },
    addTextSource(id, text, title) {
      return api.post(`/learning-projects/${id}/sources/text`, { text, title });
    },
    deleteSource(id, sourceId) {
      return api.delete(`/learning-projects/${id}/sources/${sourceId}`);
    },
    analyze(id, settings) {
      return api.post(`/learning-projects/${id}/analyze`, { settings });
    },
    generatePack(id, options) {
      return api.post(`/learning-projects/${id}/generate-pack`, options || {});
    },
    publish(id, publicationSettings) {
      return api.post(`/learning-projects/${id}/publish`, { publicationSettings });
    },
    unpublish(id) {
      return api.post(`/learning-projects/${id}/unpublish`);
    },
    getAccessList(id) {
      return api.get(`/learning-projects/${id}/access`);
    },
    assignAccess(id, data) {
      return api.post(`/learning-projects/${id}/access`, data);
    },
    revokeAccess(id, studentId) {
      return api.delete(`/learning-projects/${id}/access/${studentId}`);
    },
    getEligibleStudents() {
      return api.get('/learning-projects/admin/students');
    },
    getStudyPack(id) {
      return api.get(`/learning-projects/${id}/study-pack`);
    },
    getVideo(id) {
      return api.get(`/learning-projects/${id}/video`);
    },
    askTutor(id, query, timestamp) {
      return api.post(`/learning-projects/${id}/tutor`, { query, timestamp });
    },
    submitPractice(id, answers) {
      return api.post(`/learning-projects/${id}/practice/submit`, { answers });
    },
    getAnalytics(id) {
      return api.get(`/learning-projects/${id}/analytics`);
    },
    getExportUrl(id) {
      return `${BASE_URL}/learning-projects/${id}/export`;
    },
    updateOverview(id, data) {
      return api.put(`/learning-projects/${id}/overview`, data);
    },
    getModules(id) {
      return api.get(`/learning-projects/${id}/modules`);
    },
    createSection(id, data) {
      return api.post(`/learning-projects/${id}/sections`, data);
    },
    updateSection(id, sectionId, data) {
      return api.put(`/learning-projects/${id}/sections/${sectionId}`, data);
    },
    deleteSection(id, sectionId) {
      return api.delete(`/learning-projects/${id}/sections/${sectionId}`);
    },
    createLesson(id, data) {
      return api.post(`/learning-projects/${id}/lessons`, data);
    },
    updateLesson(id, lessonId, data) {
      return api.put(`/learning-projects/${id}/lessons/${lessonId}`, data);
    },
    deleteLesson(id, lessonId) {
      return api.delete(`/learning-projects/${id}/lessons/${lessonId}`);
    },
    regenerateLesson(id, lessonId) {
      return api.post(`/learning-projects/${id}/lessons/${lessonId}/regenerate`);
    },
    reorder(id, data) {
      return api.post(`/learning-projects/${id}/reorder`, data);
    },
    updateStudyNote(id, noteId, data) {
      return api.put(`/learning-projects/${id}/study-notes/${noteId}`, data);
    },
    addFlashcard(id, data) {
      return api.post(`/learning-projects/${id}/flashcards`, data);
    },
    updateFlashcard(id, flashcardId, data) {
      return api.put(`/learning-projects/${id}/flashcards/${flashcardId}`, data);
    },
    deleteFlashcard(id, flashcardId) {
      return api.delete(`/learning-projects/${id}/flashcards/${flashcardId}`);
    },
    addQuestion(id, data) {
      return api.post(`/learning-projects/${id}/questions`, data);
    },
    updateQuestion(id, questionId, data) {
      return api.put(`/learning-projects/${id}/questions/${questionId}`, data);
    },
    deleteQuestion(id, questionId) {
      return api.delete(`/learning-projects/${id}/questions/${questionId}`);
    },
    updateVideoScript(id, videoAssetId, data) {
      return api.put(`/learning-projects/${id}/video-script/${videoAssetId}`, data);
    },
    regenerateVideo(id, videoAssetId) {
      return api.post(`/learning-projects/${id}/video-regenerate/${videoAssetId}`);
    },
    approve(id) {
      return api.post(`/learning-projects/${id}/approve`);
    },
    archive(id) {
      return api.post(`/learning-projects/${id}/archive`);
    },
    updateStatus(id, status) {
      return api.patch(`/learning-projects/${id}/status`, { status });
    },
    previewStudent(id) {
      return api.get(`/learning-projects/${id}/preview-student`);
    },
    getGenerationStatus(id) {
      return api.get(`/learning-projects/${id}/generation-status`);
    },
    getSyllabus(id) {
      return api.get(`/learning-projects/${id}/syllabus`);
    },
    updateSyllabus(id, data) {
      return api.put(`/learning-projects/${id}/syllabus`, data);
    },
    getCompleteness(id) {
      return api.get(`/learning-projects/${id}/completeness`);
    },
    getQualityReport(id) {
      return api.get(`/learning-projects/${id}/quality-report`);
    },
    generatePracticePaper(id, config) {
      return api.post(`/learning-projects/${id}/practice-papers/generate`, config);
    },
  };

  // ─── Global Export ─────────────────────────────────────────────────────────

  window.KinetiqAPI = {
    auth: Auth,
    courses: Courses,
    user: User,
    ai: AI,
    learningProjects: LearningProjects,
    payments: Payments,
    quiz: Quiz,
    certificates: Certificates,
    analytics: Analytics,
    admin: Admin,
    ui: UI,
    socket: Socket,
    store: { token: TokenStore, user: UserStore },
    requireAuth,
    requireInstructor,
    BASE_URL,
  };

  // Auto-connect socket if user is logged in
  if (UserStore.isLoggedIn()) {
    document.addEventListener('DOMContentLoaded', () => {
      Socket.connect();
    });
  }

})();
