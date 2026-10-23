import bcrypt from 'bcryptjs';
import { User, UserRole } from '../models/User';
import { QuestionBankItem } from '../models/AiLearning';
import { sequelize } from '../config/database';
import { models } from '../models';

const BASE_URL = 'http://localhost:4000/api/v1';

async function request(path: string, options: any = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  const data: any = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function login(email: string, password = 'Password123!') {
  const res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(res.data)}`);
  }
  return res.data.data.accessToken;
}

async function runAcceptanceTests() {
  console.log('================================================================');
  console.log('🚀 RUNNING ACCEPTANCE TESTS — ADMIN-CONTROLLED AI LEARNING STUDIO');
  console.log('================================================================\n');

  await sequelize.authenticate();
  sequelize.addModels(models);

  // 1. Ensure test users exist with Password123!
  const passwordHash = await bcrypt.hash('Password123!', 10);
  
  let instructor = await User.findOne({ where: { email: 'instructor@kinetiqacademy.com' } });
  if (!instructor) {
    instructor = await User.create({
      email: 'instructor@kinetiqacademy.com',
      passwordHash: 'Password123!',
      firstName: 'Dr. Sarah',
      lastName: 'Jenkins',
      role: UserRole.INSTRUCTOR,
      isActive: true,
      isEmailVerified: true,
    });
  } else {
    instructor.passwordHash = 'Password123!';
    await instructor.save();
  }

  let student1 = await User.findOne({ where: { email: 'student@kinetiqacademy.com' } });
  if (!student1) {
    student1 = await User.create({
      email: 'student@kinetiqacademy.com',
      passwordHash: 'Password123!',
      firstName: 'Alex',
      lastName: 'Chen',
      role: UserRole.STUDENT,
      isActive: true,
      isEmailVerified: true,
    });
  } else {
    student1.passwordHash = 'Password123!';
    await student1.save();
  }

  let student2 = await User.findOne({ where: { email: 'student2@kinetiqacademy.com' } });
  if (!student2) {
    student2 = await User.create({
      email: 'student2@kinetiqacademy.com',
      passwordHash: 'Password123!',
      firstName: 'Marcus',
      lastName: 'Vance',
      role: UserRole.STUDENT,
      isActive: true,
      isEmailVerified: true,
    });
  } else {
    student2.passwordHash = 'Password123!';
    await student2.save();
  }

  console.log('✅ Verified Test Accounts:');
  console.log(`   Instructor: ${instructor.email} (${instructor.id})`);
  console.log(`   Student 1 (Assigned): ${student1.email} (${student1.id})`);
  console.log(`   Student 2 (Unassigned): ${student2.email} (${student2.id})\n`);

  const adminToken = await login('instructor@kinetiqacademy.com');
  const student1Token = await login('student@kinetiqacademy.com');
  const student2Token = await login('student2@kinetiqacademy.com');

  // ============================================================================
  // TEST A: Admin Creates Content, Generates Pack, Publishes, and Assigns Access
  // ============================================================================
  console.log('--- TEST A: Admin Creates Content and Publishes to Specific Student ---');
  
  const createRes = await request('/learning-projects', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      title: 'Formal Safety Verification in Distributed Consensus',
      subject: 'Distributed Systems & Cloud Architecture',
      description: 'Formal invariant proofs and consensus dynamics.',
      settings: { educationLevel: 'graduate', explanationDepth: 'deep_dive' },
    }),
  });
  console.log(`1. Create Project: Status ${createRes.status}`);
  if (createRes.status !== 201) throw new Error('Failed to create project: ' + JSON.stringify(createRes.data));
  const projectId = createRes.data.data.id;

  const addSourceRes = await request(`/learning-projects/${projectId}/sources/text`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      title: 'Raft Safety Invariants and Quorum Bounds',
      text: 'Raft guarantees state machine safety through leader completeness. A leader only applies log entries after receiving acknowledgments from a majority quorum (floor(N/2) + 1). Invariant validation ensures no two distinct nodes commit contradictory terms.',
    }),
  });
  console.log(`2. Add Source: Status ${addSourceRes.status}`);

  const analyzeRes = await request(`/learning-projects/${projectId}/analyze`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({}),
  });
  console.log(`3. Analyze AI: Status ${analyzeRes.status}`);

  const genPackRes = await request(`/learning-projects/${projectId}/generate-pack`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ packType: 'complete' }),
  });
  console.log(`4. Generate Study Pack: Status ${genPackRes.status}`);

  // Publish with explicit assignment target audience
  const publishRes = await request(`/learning-projects/${projectId}/publish`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      publicationSettings: {
        targetAudience: 'assigned',
        publishNotes: true,
        publishFlashcards: true,
        publishQuiz: true,
        publishPracticePaper: true,
        publishVideo: true,
        publishTutor: true,
        allowDownload: true,
      },
    }),
  });
  console.log(`5. Publish Project: Status ${publishRes.status}`);
  if (publishRes.status !== 200 || !publishRes.data.data.isPublished) throw new Error('Publishing failed');

  // Assign access explicitly to Student 1
  const assignRes = await request(`/learning-projects/${projectId}/access`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      studentId: student1.id,
      assignmentType: 'individual',
      notes: 'Assigned for Distributed Systems Exam prep',
    }),
  });
  console.log(`6. Assign Student 1: Status ${assignRes.status}`);
  if (assignRes.status !== 201 || assignRes.data.data.status !== 'active') throw new Error('Assignment failed');
  console.log('✅ TEST A PASSED: Admin successfully created, generated, published, and assigned project.\n');

  // ============================================================================
  // TEST B: Assigned Student 1 Sees Content & Accesses Published Resources
  // ============================================================================
  console.log('--- TEST B: Assigned Student 1 Sees Content & Published Resources ---');
  
  const s1ListRes = await request('/learning-projects', {
    headers: { Authorization: `Bearer ${student1Token}` },
  });
  const s1Projects = s1ListRes.data.data || [];
  const s1HasProject = s1Projects.some((p: any) => p.id === projectId);
  console.log(`1. Student 1 Projects List: Found ${s1Projects.length} projects, Target present: ${s1HasProject}`);
  if (!s1HasProject) throw new Error('TEST B Failed: Assigned project not found in Student 1 dashboard');

  const s1PackRes = await request(`/learning-projects/${projectId}/study-pack`, {
    headers: { Authorization: `Bearer ${student1Token}` },
  });
  console.log(`2. Student 1 Fetch Study Pack: Status ${s1PackRes.status}`);
  if (s1PackRes.status !== 200) throw new Error('TEST B Failed: Cannot fetch study pack');
  
  const pack = s1PackRes.data.data;
  console.log(`   - Notes count: ${pack.notes.length}`);
  console.log(`   - Flashcards count: ${pack.flashcards.length}`);
  console.log(`   - Questions count: ${pack.questions.length}`);
  console.log(`   - Video Asset available: ${!!pack.videoAsset}`);
  console.log(`   - Question 1 answers hidden upfront: ${pack.questions[0]?.correctAnswer === undefined}`);

  if (pack.questions[0]?.correctAnswer !== undefined) {
    throw new Error('TEST B Failed: Answer keys must be hidden from students upfront!');
  }
  console.log('✅ TEST B PASSED: Assigned student accesses all authorized published resources with answers hidden.\n');

  // ============================================================================
  // TEST C: Unassigned Student 2 Cannot Access Content (Blocked with 403)
  // ============================================================================
  console.log('--- TEST C: Unassigned Student 2 Cannot Access Content ---');

  const s2ListRes = await request('/learning-projects', {
    headers: { Authorization: `Bearer ${student2Token}` },
  });
  const s2Projects = s2ListRes.data.data || [];
  const s2HasProject = s2Projects.some((p: any) => p.id === projectId);
  console.log(`1. Student 2 Projects List: Found ${s2Projects.length} projects, Target present: ${s2HasProject}`);
  if (s2HasProject) throw new Error('TEST C Failed: Project must NOT appear in unassigned student dashboard');

  const s2DirectGet = await request(`/learning-projects/${projectId}`, {
    headers: { Authorization: `Bearer ${student2Token}` },
  });
  console.log(`2. Student 2 Direct GET /learning-projects/${projectId}: Status ${s2DirectGet.status} (Expected 403)`);
  if (s2DirectGet.status !== 403) throw new Error(`TEST C Failed: Expected 403 Forbidden, got ${s2DirectGet.status}`);

  const s2DirectPack = await request(`/learning-projects/${projectId}/study-pack`, {
    headers: { Authorization: `Bearer ${student2Token}` },
  });
  console.log(`3. Student 2 Direct GET /study-pack: Status ${s2DirectPack.status} (Expected 403)`);
  if (s2DirectPack.status !== 403) throw new Error(`TEST C Failed: Expected 403 Forbidden, got ${s2DirectPack.status}`);
  console.log('✅ TEST C PASSED: Unassigned student receives strict HTTP 403 Forbidden.\n');

  // ============================================================================
  // TEST D: Student Cannot Create Official Content or Call Administrative APIs
  // ============================================================================
  console.log('--- TEST D: Student Blocked From Administrative Operations ---');

  const sCreateRes = await request('/learning-projects', {
    method: 'POST',
    headers: { Authorization: `Bearer ${student1Token}` },
    body: JSON.stringify({ title: 'Student Illegal Project' }),
  });
  console.log(`1. Student POST /learning-projects: Status ${sCreateRes.status} (Expected 403)`);
  if (sCreateRes.status !== 403) throw new Error(`TEST D Failed: Student project creation returned ${sCreateRes.status}`);

  const sImportRes = await request(`/learning-projects/${projectId}/sources/url`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${student1Token}` },
    body: JSON.stringify({ url: 'https://example.com' }),
  });
  console.log(`2. Student POST /sources/url: Status ${sImportRes.status} (Expected 403)`);
  if (sImportRes.status !== 403) throw new Error(`TEST D Failed: Student source import returned ${sImportRes.status}`);

  const sAnalyzeRes = await request(`/learning-projects/${projectId}/analyze`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${student1Token}` },
    body: JSON.stringify({}),
  });
  console.log(`3. Student POST /analyze: Status ${sAnalyzeRes.status} (Expected 403)`);
  if (sAnalyzeRes.status !== 403) throw new Error(`TEST D Failed: Student analyze returned ${sAnalyzeRes.status}`);

  const sGenPackRes = await request(`/learning-projects/${projectId}/generate-pack`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${student1Token}` },
    body: JSON.stringify({ packType: 'complete' }),
  });
  console.log(`4. Student POST /generate-pack: Status ${sGenPackRes.status} (Expected 403)`);
  if (sGenPackRes.status !== 403) throw new Error(`TEST D Failed: Student generate pack returned ${sGenPackRes.status}`);

  const sPublishRes = await request(`/learning-projects/${projectId}/publish`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${student1Token}` },
    body: JSON.stringify({}),
  });
  console.log(`5. Student POST /publish: Status ${sPublishRes.status} (Expected 403)`);
  if (sPublishRes.status !== 403) throw new Error(`TEST D Failed: Student publish returned ${sPublishRes.status}`);

  const sAccessRes = await request(`/learning-projects/${projectId}/access`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${student1Token}` },
    body: JSON.stringify({ studentId: student2.id }),
  });
  console.log(`6. Student POST /access: Status ${sAccessRes.status} (Expected 403)`);
  if (sAccessRes.status !== 403) throw new Error(`TEST D Failed: Student grant access returned ${sAccessRes.status}`);
  console.log('✅ TEST D PASSED: All administrative creation and publication actions return HTTP 403 for students.\n');

  // ============================================================================
  // TEST E: Access Revocation Immediately Cuts Off Student Access
  // ============================================================================
  console.log('--- TEST E: Access Revocation Immediately Enforces 403 ---');

  const revokeRes = await request(`/learning-projects/${projectId}/access/${student1.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(`1. Admin Revokes Access for Student 1: Status ${revokeRes.status}`);
  if (revokeRes.status !== 200) throw new Error('Failed to revoke access');

  const s1RevokedGet = await request(`/learning-projects/${projectId}`, {
    headers: { Authorization: `Bearer ${student1Token}` },
  });
  console.log(`2. Student 1 Subsequent GET /learning-projects/${projectId}: Status ${s1RevokedGet.status} (Expected 403)`);
  if (s1RevokedGet.status !== 403) throw new Error(`TEST E Failed: Expected 403 Forbidden after revocation, got ${s1RevokedGet.status}`);

  const s1RevokedPack = await request(`/learning-projects/${projectId}/study-pack`, {
    headers: { Authorization: `Bearer ${student1Token}` },
  });
  console.log(`3. Student 1 Subsequent GET /study-pack: Status ${s1RevokedPack.status} (Expected 403)`);
  if (s1RevokedPack.status !== 403) throw new Error(`TEST E Failed: Expected 403 Forbidden on study pack, got ${s1RevokedPack.status}`);
  console.log('✅ TEST E PASSED: Immediate revocation enforcement on backend requests.\n');

  // ============================================================================
  // TEST F: Video Lecture Playback & Protection
  // ============================================================================
  console.log('--- TEST F: Protected Video Asset Access & Playback ---');

  // Re-assign Student 1
  await request(`/learning-projects/${projectId}/access`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ studentId: student1.id }),
  });

  const s1VideoRes = await request(`/learning-projects/${projectId}/video`, {
    headers: { Authorization: `Bearer ${student1Token}` },
  });
  console.log(`1. Assigned Student 1 GET /video: Status ${s1VideoRes.status}`);
  if (s1VideoRes.status !== 200 || !s1VideoRes.data.data.videoUrl) throw new Error('TEST F Failed: Video asset unavailable for assigned student');
  console.log(`   Video URL: ${s1VideoRes.data.data.videoUrl}`);

  const s2VideoRes = await request(`/learning-projects/${projectId}/video`, {
    headers: { Authorization: `Bearer ${student2Token}` },
  });
  console.log(`2. Unassigned Student 2 GET /video: Status ${s2VideoRes.status} (Expected 403)`);
  if (s2VideoRes.status !== 403) throw new Error(`TEST F Failed: Unassigned student must be blocked with 403 from video`);
  console.log('✅ TEST F PASSED: Video lecture endpoint correctly protects streaming assets.\n');

  // ============================================================================
  // TEST G: Student Progress and Question Bank Immutability
  // ============================================================================
  console.log('--- TEST G: Student Progress Isolation & Question Bank Immutability ---');

  const beforeItems = await QuestionBankItem.findAll({ raw: true });
  const sampleQuestion = pack.questions[0];

  const submitRes = await request(`/learning-projects/${projectId}/practice/submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${student1Token}` },
    body: JSON.stringify({
      answers: {
        [sampleQuestion.id]: 'Majority Quorum',
      },
    }),
  });
  console.log(`1. Student 1 Practice Submit: Status ${submitRes.status}`);
  if (submitRes.status !== 200 || submitRes.data.data.totalQuestions === 0) throw new Error('Practice submission failed');

  const afterItems = await QuestionBankItem.findAll({ raw: true });
  console.log(`2. Official Question Bank Item Count: Before=${beforeItems.length}, After=${afterItems.length}`);
  if (beforeItems.length !== afterItems.length) throw new Error('TEST G Failed: Shared QuestionBank was mutated!');

  // Check student analytics
  const analyticsRes = await request(`/learning-projects/${projectId}/analytics`, {
    headers: { Authorization: `Bearer ${student1Token}` },
  });
  console.log(`3. Student 1 Analytics: Status ${analyticsRes.status}, Mastery: ${analyticsRes.data.data.overallMastery}%`);
  if (analyticsRes.status !== 200) throw new Error('Analytics failed');
  console.log('✅ TEST G PASSED: Student practice recorded without altering shared teacher question bank.\n');

  // ============================================================================
  // TEST H: Existing LMS Functionality Integrity
  // ============================================================================
  console.log('--- TEST H: Existing LMS Features Integrity Check ---');

  const coursesRes = await request('/courses?limit=5');
  console.log(`1. GET /courses: Status ${coursesRes.status}`);
  if (coursesRes.status !== 200) throw new Error('Existing courses route broken');

  const categoriesRes = await request('/courses/categories');
  console.log(`2. GET /courses/categories: Status ${categoriesRes.status}`);
  if (categoriesRes.status !== 200) throw new Error('Existing categories route broken');

  const profileRes = await request('/users/me', {
    headers: { Authorization: `Bearer ${student1Token}` },
  });
  console.log(`3. GET /users/me: Status ${profileRes.status}`);
  if (profileRes.status !== 200) throw new Error('Existing profile route broken');

  console.log('✅ TEST H PASSED: Core LMS endpoints, auth, and course delivery remain intact.\n');

  console.log('================================================================');
  console.log('🎉 ALL ACCEPTANCE TESTS PASSED SUCCESSFULLY! (TESTS A THROUGH H)');
  console.log('================================================================');
  process.exit(0);
}

runAcceptanceTests().catch(err => {
  console.error('\n❌ ACCEPTANCE TEST FAILED:', err);
  process.exit(1);
});
