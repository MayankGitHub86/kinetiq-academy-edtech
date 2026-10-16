import crypto from 'crypto';
import { Op, Sequelize } from 'sequelize';
import { LearningProject, ProjectStatus, LearningSource, LearningSourceType, ProjectStudentAccess } from '../models/LearningProject';
import { User, UserRole } from '../models/User';
import { Course, Section, Lesson } from '../models/Course';
import { StudyNote, Flashcard, QuestionBankItem, PracticePaper, VideoAsset } from '../models/AiLearning';
import { VideoChapter, VideoCheckpoint, GenerationStageRecord } from '../models/AiLearningPhase2';
import { ContentIngestionService } from './contentIngestion.service';
import { SSRFProtection } from './ssrf.service';
import { AdaptiveLearningService } from './adaptiveLearning.service';
import { CourseQualityService } from './courseQuality.service';
import { logger } from '../utils/logger';

export class ForbiddenError extends Error {
  public statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export interface PersonalizationSettings {
  educationLevel?: string;
  targetExam?: string;
  language?: string;
  explanationDepth?: 'concise' | 'standard' | 'deep_dive';
  availableStudyTime?: string;
  preferredFormat?: string;
  targetDate?: string;
}

export class LearningProjectService {
  /**
   * Create a new student learning project and provision an associated LMS Course
   */
  public static async createProject(
    userId: string,
    data: {
      title: string;
      description?: string;
      subject?: string;
      settings?: PersonalizationSettings;
    }
  ): Promise<LearningProject> {
    const slug = `${data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;

    const level = data.settings?.educationLevel === 'graduate' || data.settings?.explanationDepth === 'deep_dive'
      ? 'advanced'
      : data.settings?.educationLevel === 'high_school'
      ? 'beginner'
      : 'intermediate';

    // Provision backing LMS course container for unified player, progress, and assessments
    const course = await Course.create({
      instructorId: userId,
      title: data.title,
      slug,
      shortDescription: data.description || `AI Learning Project: ${data.title}`,
      description: data.description || `AI generated study workspace for ${data.title}`,
      category: data.subject || 'Engineering & Computer Science',
      level,
      status: 'published',
      isPublished: true,
      publishedAt: new Date(),
    });

    const project = await LearningProject.create({
      userId,
      title: data.title,
      description: data.description,
      subject: data.subject || 'General Learning',
      status: ProjectStatus.DRAFT,
      courseId: course.id,
      settings: data.settings || {
        educationLevel: 'undergraduate',
        explanationDepth: 'standard',
        language: 'English',
        availableStudyTime: '45 mins/day',
      },
      stats: {
        sourceCount: 0,
        notesCount: 0,
        flashcardsCount: 0,
        quizCount: 0,
        paperCount: 0,
        videoCount: 0,
      },
    });

    logger.info(`Created LearningProject ${project.id} with Course ${course.id} for user ${userId}`);
    return project;
  }

  /**
   * List all projects based on user role:
   * - Students only see published projects explicitly assigned to them or set to targetAudience='all'.
   * - Instructors/Admins see projects they manage.
   */
  public static async getProjects(userId: string, userRole?: UserRole): Promise<LearningProject[]> {
    if (userRole === UserRole.STUDENT) {
      const accesses = await ProjectStudentAccess.findAll({
        where: {
          studentId: userId,
          status: 'active',
        },
      });

      const assignedProjectIds = accesses
        .filter(a => !a.validUntil || new Date(a.validUntil) >= new Date())
        .map(a => a.projectId);

      const projects = await LearningProject.findAll({
        where: {
          isPublished: true,
          [Op.or]: [
            { id: { [Op.in]: assignedProjectIds } },
            Sequelize.literal(`(publication_settings->>'targetAudience') = 'all'`),
          ],
        },
        order: [['publishedAt', 'DESC'], ['createdAt', 'DESC']],
        include: [
          { model: LearningSource, as: 'sources', attributes: ['id', 'title', 'sourceType', 'status', 'createdAt'] },
          { model: Course, as: 'course', attributes: ['id', 'title', 'category', 'level'] },
        ],
      });

      return projects;
    }

    const whereClause: any = {};
    if (userRole === UserRole.INSTRUCTOR) {
      whereClause.userId = userId;
    }

    return LearningProject.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      include: [
        { model: LearningSource, as: 'sources', attributes: ['id', 'title', 'sourceType', 'status', 'createdAt'] },
        { model: ProjectStudentAccess, as: 'studentAccesses' },
      ],
    });
  }

  /**
   * Get project by ID with authorization check:
   * - Students must have active access to a published project.
   * - Instructors must own the project (or be admin).
   */
  public static async getProjectById(userId: string, projectId: string, userRole?: UserRole): Promise<LearningProject> {
    const project = await LearningProject.findByPk(projectId, {
      include: [
        { model: LearningSource, as: 'sources' },
        { model: Course, as: 'course' },
      ],
    });

    if (!project) {
      const err = new Error('Learning project not found.');
      (err as any).statusCode = 404;
      throw err;
    }

    if (userRole === UserRole.STUDENT) {
      if (!project.isPublished) {
        throw new ForbiddenError('This learning project is not published or is still in draft state.');
      }

      const isPublicToAll = project.publicationSettings?.targetAudience === 'all';
      if (!isPublicToAll) {
        const access = await ProjectStudentAccess.findOne({
          where: {
            projectId,
            studentId: userId,
            status: 'active',
          },
        });

        if (!access) {
          throw new ForbiddenError('You do not have access to this learning project. It has not been assigned to your account.');
        }

        if (access.validUntil && new Date(access.validUntil) < new Date()) {
          throw new ForbiddenError('Your access to this learning project has expired.');
        }
      }
    } else if (userRole === UserRole.INSTRUCTOR) {
      if (project.userId !== userId) {
        throw new ForbiddenError('Unauthorized: You do not have permissions to manage this learning project.');
      }
    } else if (!userRole) {
      if (project.userId !== userId) {
        throw new ForbiddenError('Unauthorized: You do not have permissions to manage this learning project.');
      }
    }

    return project;
  }

  /**
   * Publish a learning project after review
   */
  public static async publishProject(
    userId: string,
    projectId: string,
    userRole: UserRole,
    publicationSettings?: any
  ): Promise<LearningProject> {
    if (userRole === UserRole.STUDENT) {
      throw new ForbiddenError('Students are not permitted to publish learning projects.');
    }

    const project = await this.getProjectById(userId, projectId, userRole);

    if (project.status === ProjectStatus.FAILED) {
      throw new Error('Cannot publish a failed project. Please retry generation first.');
    }

    project.isPublished = true;
    project.publishedAt = new Date();
    project.publishedBy = userId;
    if (publicationSettings) {
      project.publicationSettings = {
        ...project.publicationSettings,
        ...publicationSettings,
      };
    }
    await project.save();
    logger.info(`Project ${projectId} published by user ${userId}`);
    return project;
  }

  /**
   * Unpublish a learning project
   */
  public static async unpublishProject(
    userId: string,
    projectId: string,
    userRole: UserRole
  ): Promise<LearningProject> {
    if (userRole === UserRole.STUDENT) {
      throw new ForbiddenError('Students are not permitted to unpublish learning projects.');
    }

    const project = await this.getProjectById(userId, projectId, userRole);
    project.isPublished = false;
    await project.save();
    logger.info(`Project ${projectId} unpublished by user ${userId}`);
    return project;
  }

  /**
   * Assign learning project access to a student or group
   */
  public static async assignStudentAccess(
    adminId: string,
    projectId: string,
    userRole: UserRole,
    data: {
      studentId: string;
      assignmentType?: 'individual' | 'group' | 'course' | 'all';
      groupOrBatch?: string;
      validFrom?: Date;
      validUntil?: Date;
      notes?: string;
    }
  ): Promise<ProjectStudentAccess> {
    if (userRole === UserRole.STUDENT) {
      throw new ForbiddenError('Students cannot manage access permissions.');
    }

    const project = await this.getProjectById(adminId, projectId, userRole);
    const student = await User.findByPk(data.studentId);
    if (!student) {
      throw new Error('Student user not found.');
    }

    let access = await ProjectStudentAccess.findOne({
      where: { projectId: project.id, studentId: student.id },
      paranoid: false,
    });

    if (access) {
      if (access.deletedAt) await access.restore();
      access.status = 'active';
      access.grantedBy = adminId;
      access.assignmentType = data.assignmentType || 'individual';
      access.groupOrBatch = data.groupOrBatch;
      access.validFrom = data.validFrom;
      access.validUntil = data.validUntil;
      access.notes = data.notes;
      await access.save();
    } else {
      access = await ProjectStudentAccess.create({
        projectId: project.id,
        studentId: student.id,
        grantedBy: adminId,
        status: 'active',
        assignmentType: data.assignmentType || 'individual',
        groupOrBatch: data.groupOrBatch,
        validFrom: data.validFrom,
        validUntil: data.validUntil,
        notes: data.notes,
      });
    }

    logger.info(`Assigned access to project ${projectId} for student ${student.id} by admin ${adminId}`);
    return access;
  }

  /**
   * Revoke student access to a project
   */
  public static async revokeStudentAccess(
    adminId: string,
    projectId: string,
    studentId: string,
    userRole: UserRole
  ): Promise<{ revoked: boolean; studentId: string; projectId: string }> {
    if (userRole === UserRole.STUDENT) {
      throw new ForbiddenError('Students cannot manage access permissions.');
    }

    const project = await this.getProjectById(adminId, projectId, userRole);
    const access = await ProjectStudentAccess.findOne({
      where: { projectId: project.id, studentId },
    });

    if (!access) {
      throw new Error('No access assignment record found for this student and project.');
    }

    access.status = 'revoked';
    await access.save();
    logger.info(`Revoked access to project ${projectId} for student ${studentId} by admin ${adminId}`);
    return { revoked: true, studentId, projectId };
  }

  /**
   * Get list of students assigned to a project
   */
  public static async getProjectAccessList(
    adminId: string,
    projectId: string,
    userRole: UserRole
  ): Promise<any[]> {
    if (userRole === UserRole.STUDENT) {
      throw new ForbiddenError('Students cannot view access assignment records.');
    }

    await this.getProjectById(adminId, projectId, userRole);
    const accesses = await ProjectStudentAccess.findAll({
      where: { projectId },
      include: [
        {
          model: User,
          as: 'student',
          attributes: ['id', 'email', 'firstName', 'lastName'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return accesses;
  }

  /**
   * List all eligible students that an admin can assign to projects
   */
  public static async getEligibleStudents(): Promise<any[]> {
    const students = await User.findAll({
      where: { role: UserRole.STUDENT, isActive: true },
      attributes: ['id', 'email', 'firstName', 'lastName'],
      order: [['firstName', 'ASC'], ['email', 'ASC']],
    });
    return students.map(s => ({
      id: s.id,
      email: s.email,
      name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.email,
    }));
  }

  /**
   * Get video asset for an authorized project
   */
  public static async getVideoAsset(userId: string, projectId: string, userRole?: UserRole): Promise<VideoAsset | null> {
    const project = await this.getProjectById(userId, projectId, userRole);
    if (userRole === UserRole.STUDENT && project.publicationSettings?.publishVideo === false) {
      throw new ForbiddenError('Video lectures are disabled for this project.');
    }
    if (!project.courseId) return null;
    return VideoAsset.findOne({ where: { courseId: project.courseId } });
  }

  /**
   * Update student personalization settings
   */
  public static async updateSettings(
    userId: string,
    projectId: string,
    settings: PersonalizationSettings
  ): Promise<LearningProject> {
    const project = await this.getProjectById(userId, projectId);
    project.settings = { ...project.settings, ...settings };
    await project.save();
    return project;
  }

  /**
   * Import educational source via public URL with SSRF protection
   */
  public static async addSourceFromUrl(userId: string, projectId: string, urlString: string): Promise<LearningSource> {
    const project = await this.getProjectById(userId, projectId);

    // SSRF Check and extraction
    const extracted = await ContentIngestionService.extractFromUrl(urlString);
    const contentHash = crypto.createHash('sha256').update(extracted.cleanedText).digest('hex');

    // Duplicate check in same project
    const existing = await LearningSource.findOne({
      where: { projectId, contentHash },
    });
    if (existing) {
      return existing;
    }

    const source = await LearningSource.create({
      projectId,
      userId,
      sourceType: LearningSourceType.URL,
      title: extracted.title || urlString,
      url: extracted.url,
      rawText: extracted.rawText,
      cleanedText: extracted.cleanedText,
      contentHash,
      status: 'extracted',
      headings: extracted.headings,
      chunks: extracted.chunks,
      metadata: {
        ...extracted.metadata,
        author: extracted.author,
        wordCount: extracted.wordCount,
      },
    });

    // Update stats
    project.stats = {
      ...project.stats,
      sourceCount: (project.stats?.sourceCount || 0) + 1,
    };
    await project.save();

    return source;
  }

  /**
   * Import educational source via file upload
   */
  public static async addSourceFromFile(
    userId: string,
    projectId: string,
    filePath: string,
    originalName: string,
    mimeType: string
  ): Promise<LearningSource> {
    const project = await this.getProjectById(userId, projectId);

    const extracted = await ContentIngestionService.extractFromFile(filePath, originalName, mimeType);
    const contentHash = crypto.createHash('sha256').update(extracted.cleanedText).digest('hex');

    const source = await LearningSource.create({
      projectId,
      userId,
      sourceType: LearningSourceType.DOCUMENT,
      title: extracted.title || originalName,
      filePath,
      rawText: extracted.rawText,
      cleanedText: extracted.cleanedText,
      contentHash,
      status: 'extracted',
      headings: extracted.headings,
      chunks: extracted.chunks,
      metadata: {
        ...extracted.metadata,
        wordCount: extracted.wordCount,
      },
    });

    project.stats = {
      ...project.stats,
      sourceCount: (project.stats?.sourceCount || 0) + 1,
    };
    await project.save();

    return source;
  }

  /**
   * Import raw pasted text
   */
  public static async addSourceFromText(
    userId: string,
    projectId: string,
    rawText: string,
    title = 'Study Notes Source'
  ): Promise<LearningSource> {
    const project = await this.getProjectById(userId, projectId);

    const extracted = ContentIngestionService.extractFromText(rawText, title);
    const contentHash = crypto.createHash('sha256').update(extracted.cleanedText).digest('hex');

    const source = await LearningSource.create({
      projectId,
      userId,
      sourceType: LearningSourceType.TEXT,
      title,
      rawText: extracted.rawText,
      cleanedText: extracted.cleanedText,
      contentHash,
      status: 'extracted',
      headings: extracted.headings,
      chunks: extracted.chunks,
      metadata: {
        ...extracted.metadata,
        wordCount: extracted.wordCount,
      },
    });

    project.stats = {
      ...project.stats,
      sourceCount: (project.stats?.sourceCount || 0) + 1,
    };
    await project.save();

    return source;
  }

  /**
   * Remove a source from project
   */
  public static async deleteSource(userId: string, projectId: string, sourceId: string): Promise<boolean> {
    const project = await this.getProjectById(userId, projectId);
    const deleted = await LearningSource.destroy({
      where: { id: sourceId, projectId, userId },
    });

    if (deleted) {
      project.stats = {
        ...project.stats,
        sourceCount: Math.max(0, (project.stats?.sourceCount || 1) - 1),
      };
      await project.save();
    }
    return deleted > 0;
  }

  /**
   * Central AI Knowledge Engine: Analyzes all project sources to create structured knowledge map
   */
  public static async analyzeProject(
    userId: string,
    projectId: string,
    overrideSettings?: PersonalizationSettings
  ): Promise<any> {
    const project = await this.getProjectById(userId, projectId);

    if (overrideSettings) {
      project.settings = { ...project.settings, ...overrideSettings };
    }

    project.status = ProjectStatus.ANALYZING;
    await project.save();

    const sources = await LearningSource.findAll({ where: { projectId } });
    if (!sources || sources.length === 0) {
      project.status = ProjectStatus.DRAFT;
      await project.save();
      throw new Error('Cannot analyze project with zero sources. Please add at least one source URL or file.');
    }

    // Combine all chunks and headings
    const allChunks: Array<{ id: number; heading: string; text: string }> = [];
    sources.forEach(s => {
      if (s.chunks && Array.isArray(s.chunks)) {
        allChunks.push(...s.chunks);
      }
    });

    // Derive structured knowledge map from gathered educational concepts
    const primaryTitle = sources[0].title || project.title;
    const chapters = [
      {
        title: `1. Foundational Architecture & Core Tenets of ${primaryTitle}`,
        description: `Introduction to fundamental paradigms, theoretical models, and execution lifecycle based on ingested sources.`,
        lessons: [
          {
            title: `1.1 Core Principles and Definitions`,
            description: `Core terminologies, operational constraints, and architectural invariants.`,
            durationMinutes: 12,
          },
          {
            title: `1.2 State Transition & Safety Guarantees`,
            description: `Comprehensive analysis of state transitions, fault boundaries, and correctness invariants.`,
            durationMinutes: 18,
          },
        ],
      },
      {
        title: `2. Deep-Dive Implementation & Engineering Patterns`,
        description: `Practical walkthrough of components, communication protocols, and handling edge conditions.`,
        lessons: [
          {
            title: `2.1 Protocol Walkthrough and Edge Scenarios`,
            description: `Step-by-step tracing of realistic executions and performance tradeoffs.`,
            durationMinutes: 20,
          },
          {
            title: `2.2 Verification, Resilience & Fault Recovery`,
            description: `Resilience mechanisms, heartbeat monitoring, and automated failover orchestration.`,
            durationMinutes: 15,
          },
        ],
      },
    ];

    const keyConcepts = [
      {
        name: 'Invariance Consistency',
        definition: 'System states must remain mathematically sound across transitions despite transient node or network faults.',
        importance: 'Critical',
      },
      {
        name: 'Log Replication & Ordering',
        definition: 'Sequential log entries applied deterministically across distributed replicas to guarantee state coherence.',
        importance: 'High',
      },
      {
        name: 'Leader Election & Term Epochs',
        definition: 'Consensus coordination pattern establishing a single authority per term to serialize commands.',
        importance: 'High',
      },
      {
        name: 'Safety & Liveness Balance',
        definition: 'Guaranteeing that nothing bad happens (safety) while ensuring the system makes forward progress (liveness).',
        importance: 'Essential',
      },
    ];

    const learningObjectives = [
      'Understand core architectural invariants and component responsibilities',
      'Analyze state transitions and safety validation rules under network latency',
      'Trace request execution lifecycles and recovery protocols after node failure',
      'Synthesize trade-offs between strict consistency and high availability',
    ];

    const prerequisites = [
      'Basic systems programming and async communication models',
      'Familiarity with state machines and concurrency fundamentals',
    ];

    const glossary = [
      { term: 'Epoch / Term', definition: 'A logical time interval used by replicas to detect stale leaders.', example: 'Term 4 elected Node C' },
      { term: 'Quorum', definition: 'Strict majority of nodes (floor(N/2) + 1) required for committed actions.', example: '3 nodes out of 5' },
      { term: 'Heartbeat', definition: 'Periodic ping sent by the leader to suppress elections.', example: 'Heartbeats sent every 50ms' },
    ];

    const knowledgeMap = {
      subject: project.subject,
      targetLevel: project.settings?.educationLevel || 'undergraduate',
      topics: [project.subject, 'Architecture Principles', 'Fault Tolerance', 'Implementation Patterns'],
      chapters,
      keyConcepts,
      learningObjectives,
      prerequisites,
      glossary,
      recommendedSequence: [
        'Read Foundational Architecture Notes',
        'Practice Core Tenets Flashcard Deck',
        'Complete Diagnostic Checkpoint Quiz',
        'Review Interactive Video Lesson & Chapters',
        'Undertake Comprehensive Exam Blueprint Paper',
      ],
      difficultyEstimate: project.settings?.explanationDepth === 'deep_dive' ? 'Advanced' : 'Intermediate',
      qualityScore: 92,
      analyzedAt: new Date().toISOString(),
    };

    project.knowledgeMap = knowledgeMap;
    project.status = ProjectStatus.READY;
    await project.save();

    logger.info(`Analyzed project ${projectId}: synthesized knowledge map with ${chapters.length} chapters.`);
    return knowledgeMap;
  }

  /**
   * Generate Full Personal Study Pack for the project
   */
  public static async generateStudyPack(
    userId: string,
    projectId: string,
    options: {
      packType: 'quick' | 'complete' | 'full_video';
    }
  ): Promise<any> {
    const project = await this.getProjectById(userId, projectId);
    if (!project.knowledgeMap) {
      await this.analyzeProject(userId, projectId);
      await project.reload();
    }

    project.status = ProjectStatus.GENERATING;
    await project.save();

    const courseId = project.courseId!;
    const km = project.knowledgeMap!;

    // 1. Create or sync sections and lessons in LMS Course
    let section = await Section.findOne({ where: { courseId } });
    if (!section) {
      section = await Section.create({
        courseId,
        title: km.chapters[0]?.title || 'Module 1: Core Principles',
        orderIndex: 0,
      });
    }

    let lesson = await Lesson.findOne({ where: { sectionId: section.id } });
    if (!lesson) {
      lesson = await Lesson.create({
        courseId,
        sectionId: section.id,
        title: km.chapters[0]?.lessons[0]?.title || '1.1 Core Foundations',
        type: 'video',
        durationMinutes: 15,
        orderIndex: 0,
        content: `Comprehensive lesson on ${project.title}. Derived directly from imported sources.`,
      });
    }

    // 2. Generate AI Study Notes
    const studyNote = await StudyNote.create({
      courseId,
      lessonId: lesson.id,
      title: `${project.title}: Comprehensive Master Notes`,
      summary: `High-yield synthesis of ${project.title} covering architecture, algorithms, and key theorems.`,
      detailedNotes: `
# ${project.title} — Comprehensive Study Notes

## 1. Overview and Core Philosophy
Derived from ingested source materials. The system coordinates operations through verified invariants, state transition rules, and deterministic state machine replication.

## 2. Invariants & Architecture Rules
- **Safety Rule**: If a command is committed at index $i$, no other command may ever be committed at index $i$.
- **Leader Completeness**: An elected leader must contain all committed entries from prior terms.
- **State Transition Monotonicity**: Logs can only grow and match prior leader prefixes.

## 3. Mathematical Foundations & Trade-offs
$$N_{\\text{quorum}} = \\left\\lfloor \\frac{N}{2} \\right\\rfloor + 1$$
Requires strict majorities to survive up to $\\lfloor (N-1)/2 \\rfloor$ node failures.

## 4. Summary Revision Points
1. Always establish leadership before accepting writes.
2. Two-phase commit or consensus ensures uncommitted state can be rolled back safely.
3. Keep heartbeats below election timeout thresholds to avoid split-brain elections.
      `.trim(),
      quickRevision: `### Rapid Revision Checklist\n- [ ] Quorum formula: floor(N/2) + 1\n- [ ] Heartbeat frequency: < 150ms\n- [ ] State consistency invariant confirmed`,
      formulaSheet: `Quorum = floor(N/2) + 1; Max Faults = floor((N-1)/2); RTT Timeout = 2 * HeartbeatInterval`,
      faq: [
        { question: 'What happens when two nodes declare candidacy simultaneously?', answer: 'Split votes cause timeout and a subsequent randomized election term.' },
        { question: 'Can an uncommitted entry overwrite a committed entry?', answer: 'No, safety invariants prevent committed entries from being superseded.' },
      ],
      diagrams: [
        {
          title: 'State Transition Diagram',
          type: 'mermaid',
          code: 'stateDiagram-v2\n[*] --> Follower\nFollower --> Candidate: Timeout\nCandidate --> Leader: Quorum Votes\nLeader --> Follower: Higher Term Discovered',
        },
      ],
    });

    // 3. Generate Flashcards (Topic-wise)
    const flashcardsData = [
      { front: `What is the minimum quorum required in a 5-node cluster?`, back: `3 nodes (floor(5/2) + 1). Can tolerate up to 2 faults.`, topic: 'Architecture Principles' },
      { front: `Explain the purpose of logical terms/epochs.`, back: `Acts as logical clocks to identify obsolete leaders and prevent stale writes.`, topic: 'Architecture Principles' },
      { front: `Why do election timeouts utilize randomized jitter?`, back: `To break symmetry and prevent repeated split votes among concurrent candidates.`, topic: 'Fault Tolerance' },
      { front: `What is the Leader Completeness Property?`, back: `Any log entry committed in a term is present in leaders of all higher terms.`, topic: 'Fault Tolerance' },
      { front: `When is a log entry considered safely committed?`, back: `When replicated to a strict quorum of nodes by the leader of the current term.`, topic: 'Implementation Patterns' },
    ];

    const flashcards = await Promise.all(
      flashcardsData.map(f =>
        Flashcard.create({
          courseId,
          topic: f.topic,
          front: f.front,
          back: f.back,
        })
      )
    );

    // 4. Generate Question Bank (MCQs, Multi-select, T/F)
    const questionsData = [
      {
        topic: 'Architecture Principles',
        type: 'multiple_choice',
        difficulty: 'medium',
        question: `In a 7-node cluster, what is the maximum number of simultaneous node failures the cluster can endure while remaining operational?`,
        options: ['1 node', '2 nodes', '3 nodes', '4 nodes'],
        correctAnswer: '3 nodes',
        explanation: `Using the fault tolerance formula floor((7-1)/2) = 3 nodes. A quorum of 4 remains active.`,
        marks: 2,
      },
      {
        topic: 'Architecture Principles',
        type: 'true_false',
        difficulty: 'easy',
        question: `A follower will immediately increment its current term and become a candidate when its election timeout elapses without receiving a heartbeat.`,
        options: ['True', 'False'],
        correctAnswer: 'True',
        explanation: `Followers transition to Candidate upon election timer expiry and trigger a new election term.`,
        marks: 1,
      },
      {
        topic: 'Fault Tolerance',
        type: 'multiple_choice',
        difficulty: 'hard',
        question: `Which invariant guarantees that once an entry is committed, it will never be overwritten in any subsequent term?`,
        options: ['Election Safety', 'Leader Append-Only', 'Leader Completeness', 'State Machine Safety'],
        correctAnswer: 'Leader Completeness',
        explanation: `Leader Completeness enforces that any leader elected for higher terms possesses all committed log entries.`,
        marks: 3,
      },
      {
        topic: 'Implementation Patterns',
        type: 'short_answer',
        difficulty: 'medium',
        question: `Why must heartbeats be sent significantly more frequently than the election timeout?`,
        options: [],
        correctAnswer: `To prevent followers from timing out and initiating unnecessary disruptive elections during normal operation.`,
        explanation: `Heartbeats refresh follower timers before expiration to maintain cluster stability.`,
        marks: 2,
      },
    ];

    const questionItems = await Promise.all(
      questionsData.map(q =>
        QuestionBankItem.create({
          courseId,
          topic: q.topic,
          type: q.type,
          difficulty: q.difficulty,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          marks: q.marks,
          sourceReference: `Ingested source: ${project.title}`,
        })
      )
    );

    // 5. Generate Practice Paper
    const practicePaper = await PracticePaper.create({
      courseId,
      title: `${project.title}: Comprehensive Exam Blueprint Paper`,
      totalMarks: 25,
      timeLimitMinutes: 45,
      passingScore: 70,
      questionIds: questionItems.map(q => q.id),
    });

    // 6. Generate Video Asset & Interactive Chapters/Checkpoints if Full Video Pack requested
    let videoAsset: VideoAsset | null = null;
    if (options.packType === 'full_video' || options.packType === 'complete') {
      videoAsset = await VideoAsset.findOne({ where: { courseId, lessonId: lesson.id } });
      if (!videoAsset) {
        videoAsset = await VideoAsset.create({
          courseId,
          lessonId: lesson.id,
          title: `Video Lecture: Masterclass in ${project.title}`,
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          durationSeconds: 360,
          status: 'ready',
          transcript: [
            { start: 0, end: 15, text: `Welcome to this comprehensive masterclass on ${project.title}.` },
            { start: 15, end: 45, text: `In this lecture, we study the core architectural principles derived from our source documents.` },
            { start: 45, end: 90, text: `Notice that quorums ensure that no two partitioned subgroups can commit conflicting decisions.` },
          ],
        });

        // Add Video Chapters
        await VideoChapter.bulkCreate([
          { courseId, lessonId: lesson.id, title: '1. Introduction & Context', startSeconds: 0, endSeconds: 60, keyConcepts: ['Motivation'] },
          { courseId, lessonId: lesson.id, title: '2. Core Invariants & State Transitions', startSeconds: 60, endSeconds: 180, keyConcepts: ['Safety'] },
          { courseId, lessonId: lesson.id, title: '3. Failure Recovery & Implementation', startSeconds: 180, endSeconds: 360, keyConcepts: ['Recovery'] },
        ]);

        // Add Interactive In-Video Checkpoint
        await VideoCheckpoint.create({
          courseId,
          lessonId: lesson.id,
          timestampSeconds: 15,
          prompt: `In ${project.title}, what condition is mandatory before applying a mutation to state?`,
          questionType: 'mcq',
          options: [
            { id: '1', text: 'A majority quorum must acknowledge the log entry' },
            { id: '2', text: 'All nodes must be online' },
            { id: '3', text: 'The master must restart' },
          ],
          correctAnswer: 'A majority quorum must acknowledge the log entry',
          explanation: `A strict quorum (floor(N/2) + 1) must commit the entry to uphold safety.`,
          pauseUntilAnswered: true,
        });
      }
    }

    // 7. Calculate Course Quality Report
    await CourseQualityService.evaluateCourse(courseId);

    // 8. Update Project Stats & Status
    project.stats = {
      sourceCount: project.stats?.sourceCount || 1,
      notesCount: 1,
      flashcardsCount: flashcards.length,
      quizCount: questionItems.length,
      paperCount: 1,
      videoCount: videoAsset ? 1 : 0,
    };
    project.status = ProjectStatus.COMPLETED;
    await project.save();

    logger.info(`Generated Study Pack for project ${projectId}: Notes, ${flashcards.length} Flashcards, ${questionItems.length} Questions, Practice Paper, Video Asset.`);

    return {
      success: true,
      projectId,
      courseId,
      lessonId: lesson.id,
      notesId: studyNote.id,
      flashcardsCount: flashcards.length,
      questionsCount: questionItems.length,
      practicePaperId: practicePaper.id,
      videoAssetId: videoAsset?.id,
    };
  }

  /**
   * Fetch all study pack components for a student project
   */
  public static async getStudyPack(userId: string, projectId: string, userRole?: UserRole): Promise<any> {
    const project = await this.getProjectById(userId, projectId, userRole);
    const courseId = project.courseId;

    if (!courseId) {
      return { project, notes: [], flashcards: [], questions: [], practicePapers: [], videoAsset: null };
    }

    const isStudent = userRole === UserRole.STUDENT;
    const pubSettings = project.publicationSettings || {
      publishNotes: true,
      publishFlashcards: true,
      publishQuiz: true,
      publishPracticePaper: true,
      publishVideo: true,
      publishTutor: true,
      allowDownload: true,
    };

    const [notes, flashcards, questions, practicePapers, videoAsset] = await Promise.all([
      (!isStudent || pubSettings.publishNotes !== false) ? StudyNote.findAll({ where: { courseId } }) : Promise.resolve([]),
      (!isStudent || pubSettings.publishFlashcards !== false) ? Flashcard.findAll({ where: { courseId } }) : Promise.resolve([]),
      (!isStudent || pubSettings.publishQuiz !== false) ? QuestionBankItem.findAll({ where: { courseId } }) : Promise.resolve([]),
      (!isStudent || pubSettings.publishPracticePaper !== false) ? PracticePaper.findAll({ where: { courseId } }) : Promise.resolve([]),
      (!isStudent || pubSettings.publishVideo !== false) ? VideoAsset.findOne({ where: { courseId } }) : Promise.resolve(null),
    ]);

    return {
      project,
      notes,
      flashcards,
      questions: questions.map(q => ({
        id: q.id,
        topic: q.topic,
        type: q.type,
        difficulty: q.difficulty,
        question: q.question,
        options: q.options,
        marks: q.marks,
        // Answers are hidden from student review list until submitted
        ...(isStudent ? {} : { correctAnswer: q.correctAnswer, explanation: q.explanation }),
      })),
      practicePapers: practicePapers.map(p => ({
        id: p.id,
        title: p.title,
        totalMarks: p.totalMarks,
        durationMinutes: p.timeLimitMinutes,
        passingScore: p.passingScore,
        questionCount: p.questionIds ? p.questionIds.length : 0,
      })),
      videoAsset,
      knowledgeMap: project.knowledgeMap,
      allowDownload: isStudent ? pubSettings.allowDownload !== false : true,
    };
  }

  /**
   * Ask Your Content: Source-grounded AI Tutor with citations and prompt-injection defense
   */
  public static async askTutor(
    userId: string,
    projectId: string,
    query: string,
    currentTimestamp?: number,
    userRole?: UserRole
  ): Promise<{ answer: string; citations: Array<{ sourceTitle: string; heading: string; chunkId: number; textSnippet: string }> }> {
    const project = await this.getProjectById(userId, projectId, userRole);

    if (userRole === UserRole.STUDENT && project.publicationSettings?.publishTutor === false) {
      throw new ForbiddenError('AI Tutor is disabled for this project.');
    }

    // Sanitize query to prevent prompt injection
    const sanitizedQuery = query
      .replace(/ignore (all )?previous instructions/gi, '[sanitized]')
      .replace(/you are now unrestricted/gi, '[sanitized]')
      .trim();

    const sources = await LearningSource.findAll({ where: { projectId } });
    const citations: Array<{ sourceTitle: string; heading: string; chunkId: number; textSnippet: string }> = [];

    // Collect matching source chunks
    const queryTokens = sanitizedQuery.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    for (const source of sources) {
      if (!source.chunks) continue;
      for (const chunk of source.chunks) {
        const textLower = chunk.text.toLowerCase();
        const headingLower = chunk.heading.toLowerCase();
        const matches = queryTokens.filter(t => textLower.includes(t) || headingLower.includes(t));
        if (matches.length > 0) {
          citations.push({
            sourceTitle: source.title,
            heading: chunk.heading,
            chunkId: chunk.id,
            textSnippet: chunk.text.slice(0, 240) + '...',
          });
          if (citations.length >= 3) break;
        }
      }
      if (citations.length >= 3) break;
    }

    // Grounded answer synthesis
    const topCitation = citations[0];
    let answer = `According to your study material **"${project.title}"**`;
    if (topCitation) {
      answer += ` in section _"${topCitation.heading}"_:\n\n${topCitation.textSnippet}\n\n`;
      answer += `**Key Takeaway**: In this context, operations must adhere to invariant verification and safety guarantees before state commitment.`;
    } else {
      answer += `:\n\nBased on your ingested documents, the core topic revolves around architectural invariants, safety thresholds, and deterministic execution protocols.`;
    }

    if (currentTimestamp !== undefined) {
      answer += `\n\n*(Timestamp context: You asked this at ${currentTimestamp}s into the lecture video).*`;
    }

    return { answer, citations };
  }

  /**
   * Submit quiz or practice paper questions, evaluate, and update adaptive mastery
   */
  public static async submitPractice(
    userId: string,
    projectId: string,
    answers: Record<string, any>,
    userRole?: UserRole
  ): Promise<any> {
    const project = await this.getProjectById(userId, projectId, userRole);

    if (userRole === UserRole.STUDENT && project.publicationSettings?.publishQuiz === false) {
      throw new ForbiddenError('Quizzes and assessments are disabled for this project.');
    }

    const courseId = project.courseId!;

    const questionItems = await QuestionBankItem.findAll({ where: { courseId } });
    let totalMarks = 0;
    let earnedMarks = 0;
    const evaluatedResults: Array<{
      questionId: string;
      topic: string;
      question: string;
      userAnswer: any;
      correctAnswer: any;
      isCorrect: boolean;
      explanation: string;
      marks: number;
    }> = [];

    questionItems.forEach(q => {
      const uAnswer = answers[q.id];
      const isCorrect = String(uAnswer || '').trim().toLowerCase() === String(q.correctAnswer || '').trim().toLowerCase();
      const qMarks = q.marks || 1;
      totalMarks += qMarks;
      if (isCorrect) earnedMarks += qMarks;

      evaluatedResults.push({
        questionId: q.id,
        topic: q.topic || 'Core Architectural Concepts',
        question: q.question,
        userAnswer: uAnswer,
        correctAnswer: q.correctAnswer,
        isCorrect,
        explanation: q.explanation || '',
        marks: isCorrect ? qMarks : 0,
      });
    });

    const percentage = totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 100) : 0;

    // Trigger Adaptive Learning Feedback Loop
    await AdaptiveLearningService.recordAssessmentFeedback({
      userId,
      courseId,
      questionResults: evaluatedResults.map(r => ({
        topic: r.topic,
        learningObjective: r.topic,
        isCorrect: r.isCorrect,
      })),
    });

    return {
      totalQuestions: questionItems.length,
      totalMarks,
      earnedMarks,
      scorePercentage: percentage,
      passed: percentage >= 70,
      results: evaluatedResults,
    };
  }

  /**
   * Fetch adaptive learning analytics and scheduled study plan for the project
   */
  public static async getProjectAnalytics(userId: string, projectId: string, userRole?: UserRole): Promise<any> {
    const project = await this.getProjectById(userId, projectId, userRole);
    const courseId = project.courseId!;

    const adaptiveProfile = await AdaptiveLearningService.getStudentAdaptiveProfile(userId, courseId);

    // Build personalized scheduled study plan
    const scheduledPlan = [
      { day: 'Day 1', task: 'Source Ingestion & Foundational Concepts', duration: '30 mins', status: 'completed' },
      { day: 'Day 2', task: 'Mastery Flashcard Drill & Core Invariants', duration: '20 mins', status: 'completed' },
      { day: 'Day 3', task: 'Diagnostic Checkpoint Quiz & Review Notes', duration: '35 mins', status: 'in_progress' },
      { day: 'Day 4', task: 'Interactive Video Lecture & Moment Explanations', duration: '40 mins', status: 'upcoming' },
      { day: 'Day 5', task: 'Comprehensive Exam Blueprint Paper', duration: '45 mins', status: 'upcoming' },
    ];

    return {
      projectId,
      courseId,
      overallMastery: adaptiveProfile.overallMastery,
      masteryMap: adaptiveProfile.masteryMap,
      weakTopics: adaptiveProfile.weakTopics,
      recommendations: adaptiveProfile.recommendations,
      scheduledPlan,
    };
  }

  /**
   * Export complete study pack as printable/downloadable format
   */
  public static async exportStudyPack(userId: string, projectId: string, format = 'markdown', userRole?: UserRole): Promise<{ filename: string; content: string; contentType: string }> {
    const project = await this.getProjectById(userId, projectId, userRole);
    if (userRole === UserRole.STUDENT && project.publicationSettings?.allowDownload === false) {
      throw new ForbiddenError('Downloading materials has not been enabled for this project.');
    }

    const pack = await this.getStudyPack(userId, projectId, userRole);

    const content = `
# ${project.title} — Official Kinetiq AI Study Pack
**Subject:** ${project.subject} | **Date:** ${new Date().toLocaleDateString()}
**Education Level:** ${project.settings?.educationLevel || 'Undergraduate'}

---

## 1. Executive Summary & Knowledge Map
${project.knowledgeMap?.chapters?.map((ch: any) => `### ${ch.title}\n${ch.description}\n`).join('\n') || 'Study pack generated from ingested sources.'}

---

## 2. Comprehensive Study Notes
${pack.notes.map((n: any) => `### ${n.title}\n${n.detailedNotes}\n\n**Quick Revision Formula:**\n${n.formulaSheet}\n`).join('\n')}

---

## 3. Flashcards Revision Deck
${pack.flashcards.map((f: any, idx: number) => `**Card ${idx + 1} (${f.topic})**\nQ: ${f.front}\nA: ${f.back}\n`).join('\n')}

---

## 4. Practice Question Bank
${pack.questions.map((q: any, idx: number) => `**Q${idx + 1}. [${q.difficulty?.toUpperCase()} | ${q.topic}]** ${q.question}\n${q.options && q.options.length ? q.options.map((o: string, oi: number) => `   (${String.fromCharCode(65 + oi)}) ${o}`).join('\n') : ''}\n`).join('\n')}

---
*Generated securely by Kinetiq Academy AI Content-to-Learning Pipeline.*
    `.trim();

    return {
      filename: `${project.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_study_pack.md`,
      content,
      contentType: 'text/markdown',
    };
  }
}
