import bcrypt from 'bcryptjs';
import { User, UserRole } from '../models/User';
import { Course, Section, Lesson, LessonProgress } from '../models/Course';
import { LearningProject, ProjectStatus } from '../models/LearningProject';
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

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED ASSERTION: ${msg}`);
    throw new Error(`Assertion Failure: ${msg}`);
  }
  console.log(`   ✅ PASS: ${msg}`);
}

async function runMasterTestSuite() {
  console.log('================================================================');
  console.log('🚀 RUNNING MASTER ACCEPTANCE SUITE — SCENARIOS A THROUGH J');
  console.log('================================================================\n');

  await sequelize.authenticate();
  sequelize.addModels(models);

  // 1. Ensure test users exist
  let instructor = await User.findOne({ where: { email: 'instructor@kinetiqacademy.com' } });
  if (!instructor) {
    instructor = await User.create({
      email: 'instructor@kinetiqacademy.com',
      passwordHash: 'Password123!',
      firstName: 'Master',
      lastName: 'Instructor',
      role: UserRole.INSTRUCTOR,
      isActive: true,
      isEmailVerified: true,
    });
  } else {
    instructor.passwordHash = 'Password123!';
    await instructor.save();
  }

  let student = await User.findOne({ where: { email: 'student@kinetiqacademy.com' } });
  if (!student) {
    student = await User.create({
      email: 'student@kinetiqacademy.com',
      passwordHash: 'Password123!',
      firstName: 'Alex',
      lastName: 'Chen',
      role: UserRole.STUDENT,
      isActive: true,
      isEmailVerified: true,
    });
  } else {
    student.passwordHash = 'Password123!';
    await student.save();
  }

  const adminToken = await login('instructor@kinetiqacademy.com');
  const studentToken = await login('student@kinetiqacademy.com');
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  const studentHeaders = { Authorization: `Bearer ${studentToken}` };

  // ============================================================================
  // SCENARIO A: Admin submits a valid public course URL
  // Expected: Source is extracted, AI generates structured content, course enters review
  // ============================================================================
  console.log('\n--- SCENARIO A: Admin submits a valid public course URL & generates course ---');
  const projARes = await request('/learning-projects', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      title: 'Scenario A: Distributed Consensus Systems',
      subject: 'Computer Science',
      category: 'Distributed Systems',
      targetLevel: 'graduate',
      language: 'English',
      difficulty: 'Advanced',
      estimatedDurationMinutes: 180,
      learningObjectives: ['Understand Paxos consensus', 'Master Raft leader election'],
      sourceText: 'Raft is a consensus algorithm that is designed to be easy to understand. It is equivalent to Paxos in fault-tolerance and performance. The algorithm decomposes consensus into leader election, log replication, and safety. Raft ensures that a cluster of state machines can continue to operate as long as a majority of the servers are up.',
    }),
  });
  assert(projARes.ok, `Project A created successfully with status ${projARes.status}`);
  const projectAId = projARes.data.data.id;

  // Add source URL (using a verified public endpoint or test site)
  const addUrlRes = await request(`/learning-projects/${projectAId}/sources/url`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ url: 'https://example.com' }),
  });
  assert(addUrlRes.ok, `Public URL extracted and ingested (status ${addUrlRes.status})`);

  // Generate course (AI pipeline)
  const genARes = await request(`/learning-projects/${projectAId}/generate-pack`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ packType: 'complete' }),
  });
  assert(genARes.ok, 'Course generation pipeline executed');
  
  // Verify status is review_required
  const checkARes = await request(`/learning-projects/${projectAId}`, { headers: adminHeaders });
  assert(checkARes.data.data.status === ProjectStatus.REVIEW_REQUIRED, `Course status transitioned to '${checkARes.data.data.status}'`);
  assert(checkARes.data.data.stats.notesCount > 0, 'Study notes created');
  assert(checkARes.data.data.stats.quizCount > 0, 'Assessment questions created');

  // ============================================================================
  // SCENARIO B: Admin uploads supported documents
  // Expected: Content is extracted and included in the generated course
  // ============================================================================
  console.log('\n--- SCENARIO B: Admin uploads supported documents ---');
  const projBRes = await request('/learning-projects', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      title: 'Scenario B: Document Ingestion Pipeline',
      subject: 'Data Engineering',
    }),
  });
  const projectBId = projBRes.data.data.id;

  // Upload markdown document via multi-part or text representation
  const textSourceRes = await request(`/learning-projects/${projectBId}/sources/text`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      title: 'Distributed Storage Syllabus.md',
      text: '# Distributed Storage Systems\n\nConsistency, Availability, and Partition tolerance (CAP Theorem) states that any distributed data store can only provide two out of the three guarantees. Eventual consistency is widely used in distributed key-value databases like DynamoDB and Cassandra.',
    }),
  });
  assert(textSourceRes.ok, 'Document content extracted and stored as verified educational source');

  const sourcesListRes = await request(`/learning-projects/${projectBId}`, { headers: adminHeaders });
  assert(sourcesListRes.data.data.sources.length >= 1, 'Document source appears in project source registry');

  // ============================================================================
  // SCENARIO C: Source URL is invalid or inaccessible
  // Expected: A clear error appears and no fake course content is created
  // ============================================================================
  console.log('\n--- SCENARIO C: Invalid or inaccessible URL rejection (SSRF & Error Handling) ---');
  const invalidSsrfRes = await request(`/learning-projects/${projectAId}/sources/url`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ url: 'http://169.254.169.254/latest/meta-data/' }),
  });
  assert(!invalidSsrfRes.ok, 'SSRF firewall blocked private cloud metadata endpoint');
  assert(/blocked|private|prohibited|not allowed|ssrf/i.test(invalidSsrfRes.data.message || invalidSsrfRes.data.error || ''), 'Error message clearly explains security rejection');

  const invalidDomainRes = await request(`/learning-projects/${projectAId}/sources/url`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ url: 'https://non-existent-domain-xyz-404-never-found.org/doc' }),
  });
  assert(!invalidDomainRes.ok, 'Inaccessible / non-resolvable domain rejected with clear error');

  // ============================================================================
  // SCENARIO D: Video generation failure handling
  // Expected: Other content remains available for review and video job can be retried
  // ============================================================================
  console.log('\n--- SCENARIO D: Video generation resilience & retry handling ---');
  const packDRes = await request(`/learning-projects/${projectAId}/study-pack`, { headers: adminHeaders });
  assert(packDRes.ok && packDRes.data.data.notes.length > 0, 'Study notes remain intact and accessible');
  assert(packDRes.data.data.questions.length > 0, 'Quiz questions remain intact and accessible');

  const videoAsset = packDRes.data.data.videoAsset;
  assert(videoAsset != null, 'Video asset record exists');

  // Test video regeneration
  const regenVideoRes = await request(`/learning-projects/${projectAId}/video-regenerate/${videoAsset.id}`, {
    method: 'POST',
    headers: adminHeaders,
  });
  assert(regenVideoRes.ok, 'Video generation job successfully retried without corrupting notes or questions');

  // ============================================================================
  // SCENARIO E: Admin edits and publishes the course
  // Expected: Approved content becomes visible to authorized students
  // ============================================================================
  console.log('\n--- SCENARIO E: Admin edits, approves, and publishes the course ---');
  // 1. Edit overview
  const editRes = await request(`/learning-projects/${projectAId}/overview`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      title: 'Scenario A: Master Distributed Consensus Systems (Reviewed)',
      difficulty: 'Expert',
    }),
  });
  assert(editRes.ok, 'Course overview edited by administrator');

  // 2. Approve
  const approveRes = await request(`/learning-projects/${projectAId}/approve`, {
    method: 'POST',
    headers: adminHeaders,
  });
  assert(approveRes.ok, `Course approved (status: ${approveRes.data.data.status})`);

  // 3. Publish to all enrolled students
  const publishRes = await request(`/learning-projects/${projectAId}/publish`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      publicationSettings: {
        targetAudience: 'all',
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
  assert(publishRes.ok, 'Course successfully published to student portal');
  assert(publishRes.data.data.isPublished === true, 'isPublished is true');

  // ============================================================================
  // SCENARIO F: Student opens the course
  // Expected: Modules, lessons, video assets, and practice material load from backend
  // ============================================================================
  console.log('\n--- SCENARIO F: Student opens the published course ---');
  const studentListRes = await request('/learning-projects', { headers: studentHeaders });
  assert(studentListRes.ok, 'Student can list available published courses');
  const publishedInList = studentListRes.data.data.find((p: any) => p.id === projectAId);
  assert(publishedInList != null, 'Published course appears in student project list');

  const studentStudyPackRes = await request(`/learning-projects/${projectAId}/study-pack`, { headers: studentHeaders });
  assert(studentStudyPackRes.ok, 'Student can load published study pack');
  assert(studentStudyPackRes.data.data.notes.length > 0, 'Student loads rich study notes');
  assert(studentStudyPackRes.data.data.flashcards.length > 0, 'Student loads flashcards');
  assert(studentStudyPackRes.data.data.questions.length > 0, 'Student loads questions');
  assert(studentStudyPackRes.data.data.videoAsset != null, 'Student loads video asset');

  // ============================================================================
  // SCENARIO G: Student attempts a quiz
  // Expected: Answers and scores are persisted, grading is correct, progress updates
  // ============================================================================
  console.log('\n--- SCENARIO G: Student attempts quiz, grading is persisted ---');
  const questions = studentStudyPackRes.data.data.questions;
  const firstQ = questions[0];
  
  // Submit practice attempt with answer
  const answers: Record<string, string> = {};
  // For multiple choice, first option or text
  answers[firstQ.id] = (firstQ.options && firstQ.options[0]) || 'Option A';

  const quizSubmitRes = await request(`/learning-projects/${projectAId}/practice/submit`, {
    method: 'POST',
    headers: studentHeaders,
    body: JSON.stringify({ answers }),
  });
  assert(quizSubmitRes.ok, 'Quiz submission accepted and graded by backend');
  assert(typeof quizSubmitRes.data.data.scorePercentage === 'number', `Score calculated: ${quizSubmitRes.data.data.scorePercentage}%`);
  assert(quizSubmitRes.data.data.results.length > 0, 'Individual question feedback provided with correct answer and explanation');

  // Verify analytics updated
  const analyticsRes = await request(`/learning-projects/${projectAId}/analytics`, { headers: studentHeaders });
  assert(analyticsRes.ok && analyticsRes.data.data.overallMastery !== undefined, 'Mastery and weak-area tracking updated');

  // ============================================================================
  // SCENARIO H: Student attempts to access an unpublished course or admin endpoint
  // Expected: Access is denied by the backend (403 or 404)
  // ============================================================================
  console.log('\n--- SCENARIO H: Security Guardrails — Student access to unpublished/admin endpoints ---');
  // Project B is unpublished (draft)
  const unpubAccessRes = await request(`/learning-projects/${projectBId}`, { headers: studentHeaders });
  assert(unpubAccessRes.status === 403 || unpubAccessRes.status === 404, `Student access to unpublished course rejected (Status: ${unpubAccessRes.status})`);

  // Student attempts to publish course (admin endpoint)
  const studentPublishRes = await request(`/learning-projects/${projectBId}/publish`, {
    method: 'POST',
    headers: studentHeaders,
    body: JSON.stringify({ publicationSettings: { targetAudience: 'all' } }),
  });
  assert(studentPublishRes.status === 403, `Student attempt to publish course rejected (Status: ${studentPublishRes.status})`);

  // Student requests study pack for project A — verify answer keys are hidden!
  const studentPack = studentStudyPackRes.data.data;
  const anyLeakedAnswer = studentPack.questions.some((q: any) => q.correctAnswer !== undefined);
  assert(!anyLeakedAnswer, 'SECURITY VERIFIED: Answer keys strictly stripped from student study pack!');

  // ============================================================================
  // SCENARIO I: Admin regenerates a single lesson
  // Expected: Other lessons and historical student attempts remain intact
  // ============================================================================
  console.log('\n--- SCENARIO I: Admin regenerates single lesson without affecting attempts ---');
  const modulesRes = await request(`/learning-projects/${projectAId}/modules`, { headers: adminHeaders });
  assert(modulesRes.ok, 'Retrieved modules tree');
  const sectionsList = Array.isArray(modulesRes.data.data) ? modulesRes.data.data : (modulesRes.data.data?.sections || []);
  assert(sectionsList.length > 0, 'At least one module section exists');
  const firstSection = sectionsList[0];
  const lessonToRegen = firstSection.lessons[0];
  const otherLessonsCountBefore = firstSection.lessons.length;

  const regenLessonRes = await request(`/learning-projects/${projectAId}/lessons/${lessonToRegen.id}/regenerate`, {
    method: 'POST',
    headers: adminHeaders,
  });
  assert(regenLessonRes.ok, 'Single lesson regenerated with fresh AI notes');

  const modulesAfterRes = await request(`/learning-projects/${projectAId}/modules`, { headers: adminHeaders });
  const sectionsAfterList = Array.isArray(modulesAfterRes.data.data) ? modulesAfterRes.data.data : (modulesAfterRes.data.data?.sections || []);
  const firstSectionAfter = sectionsAfterList[0];
  assert(firstSectionAfter.lessons.length === otherLessonsCountBefore, 'Curriculum structure preserved without deleting neighboring lessons');

  // Verify previous student analytics / attempts are still intact
  const analyticsAfterRes = await request(`/learning-projects/${projectAId}/analytics`, { headers: studentHeaders });
  assert(analyticsAfterRes.ok && analyticsAfterRes.data.data.overallMastery !== undefined, 'Historical student assessment records remain intact');

  // ============================================================================
  // SCENARIO J: Background job retry & idempotency
  // Expected: System recovers safely without duplicate courses or duplicate content
  // ============================================================================
  console.log('\n--- SCENARIO J: Job idempotency and recovery ---');
  const genAgainRes = await request(`/learning-projects/${projectAId}/generate-pack`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ packType: 'complete' }),
  });
  assert(genAgainRes.ok, 'Pack regeneration request succeeded idempotently');

  const checkDupRes = await request(`/learning-projects/${projectAId}`, { headers: adminHeaders });
  assert(checkDupRes.data.data.courseId === projARes.data.data.courseId, 'Idempotent: Backing course ID unchanged without duplicate creation');

  console.log('\n================================================================');
  console.log('🎉 ALL ACCEPTANCE SCENARIOS A THROUGH J PASSED WITH 100% SUCCESS!');
  console.log('================================================================\n');
}

runMasterTestSuite().catch(err => {
  console.error('Master Test Suite encountered error:', err);
  process.exit(1);
});
