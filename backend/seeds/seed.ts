/**
 * Kinetiq Academy - Database Seed Data
 * 
 * Run with: npx tsx seeds/seed.ts
 * 
 * Seeds: admin user, categories, sample courses, modules, lessons
 */

import 'dotenv/config';
import { Sequelize } from 'sequelize-typescript';
import { models } from '../src/models';
import { User, UserRole, AuthProvider } from '../src/models/User';
import { Profile } from '../src/models/Profile';
import { Onboarding } from '../src/models/Onboarding';
import { Course, Section, Lesson, CourseStatus, CourseLevel, LessonType } from '../src/models/Course';
import { logger } from '../src/utils/logger';
import bcrypt from 'bcryptjs';
import slugify from 'slugify';

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'kinetiq_academy',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '5515@',
  logging: false,
  define: {
    underscored: true,   // Use snake_case column names
    timestamps: true,
    paranoid: true,      // Soft deletes
  },
});

sequelize.addModels(models);

const seed = async () => {
  console.log('🌱 Starting seed...');

  await sequelize.authenticate();
  await sequelize.sync({ alter: false }); // Don't alter schema, just ensure tables exist

  // ─── 1. Admin User ────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Admin@1234', 12);
  const [admin] = await User.findOrCreate({
    where: { email: 'admin@kinetiqacademy.com' },
    defaults: {
      email: 'admin@kinetiqacademy.com',
      passwordHash,
      firstName: 'Kinetiq',
      lastName: 'Admin',
      role: UserRole.ADMIN,
      isEmailVerified: true,
      isActive: true,
    },
  });

  await Profile.findOrCreate({
    where: { userId: admin.id },
    defaults: {
      userId: admin.id,
      firstName: 'Kinetiq',
      lastName: 'Admin',
      displayName: 'Admin',
    },
  });
  console.log('✅ Admin user created');

  // ─── 2. Instructor User ───────────────────────────────────────
  const instHash = await bcrypt.hash('Instructor@1234', 12);
  const [instructor] = await User.findOrCreate({
    where: { email: 'instructor@kinetiqacademy.com' },
    defaults: {
      email: 'instructor@kinetiqacademy.com',
      passwordHash: instHash,
      firstName: 'Sarah',
      lastName: 'Johnson',
      role: UserRole.INSTRUCTOR,
      isEmailVerified: true,
      isActive: true,
      bio: 'Senior Full-Stack Engineer with 10+ years of experience. Passionate about teaching modern web development.',
      avatarUrl: 'https://ui-avatars.com/api/?name=Sarah+Johnson&background=6366f1&color=fff&size=128',
    },
  });

  await Profile.findOrCreate({
    where: { userId: instructor.id },
    defaults: {
      userId: instructor.id,
      firstName: 'Sarah',
      lastName: 'Johnson',
      displayName: 'Sarah Johnson',
      bio: 'Senior Full-Stack Engineer',
      avatarUrl: 'https://ui-avatars.com/api/?name=Sarah+Johnson&background=6366f1&color=fff',
    },
  });
  console.log('✅ Instructor user created');

  // ─── 3. Student User ──────────────────────────────────────────
  const stuHash = await bcrypt.hash('Student@1234', 12);
  const [student] = await User.findOrCreate({
    where: { email: 'student@kinetiqacademy.com' },
    defaults: {
      email: 'student@kinetiqacademy.com',
      passwordHash: stuHash,
      firstName: 'Alex',
      lastName: 'Chen',
      role: UserRole.STUDENT,
      isEmailVerified: true,
      isActive: true,
    },
  });
  console.log('✅ Student user created');

  // ─── 4. Courses ───────────────────────────────────────────────
  const coursesData = [
    {
      title: 'Full-Stack Next.js & Distributed Systems',
      shortDescription: 'Master Next.js 14, microservices, Kubernetes, and distributed architecture patterns.',
      description: 'A comprehensive course covering modern full-stack development with Next.js 14, React Server Components, distributed systems, microservices architecture, Docker, Kubernetes, and production deployment.',
      category: 'Web Development',
      level: CourseLevel.ADVANCED,
      price: 89.99,
      isFree: false,
      tags: ['nextjs', 'react', 'kubernetes', 'microservices', 'typescript'],
      hasCertificate: true,
      language: 'English',
      learningObjectives: [
        'Build production-grade Next.js applications',
        'Design and implement microservices',
        'Deploy with Kubernetes and Docker',
        'Implement distributed caching and messaging',
      ],
    },
    {
      title: 'Machine Learning Fundamentals with Python',
      shortDescription: 'Learn ML from scratch: supervised learning, neural networks, and real-world projects.',
      description: 'Start your AI journey with Python. Cover regression, classification, clustering, neural networks with TensorFlow/PyTorch, and build 5 real-world projects.',
      category: 'Data Science & AI',
      level: CourseLevel.BEGINNER,
      price: 69.99,
      isFree: false,
      tags: ['python', 'machine-learning', 'tensorflow', 'data-science', 'ai'],
      hasCertificate: true,
      language: 'English',
      learningObjectives: [
        'Understand core ML algorithms',
        'Build neural networks with PyTorch',
        'Work with real datasets',
        'Deploy ML models to production',
      ],
    },
    {
      title: 'React Native Mobile Development',
      shortDescription: 'Build beautiful cross-platform iOS & Android apps with React Native and Expo.',
      description: 'Comprehensive React Native course covering navigation, state management with Zustand, animations, native modules, push notifications, and App Store deployment.',
      category: 'Mobile Development',
      level: CourseLevel.INTERMEDIATE,
      price: 59.99,
      isFree: false,
      tags: ['react-native', 'expo', 'mobile', 'ios', 'android'],
      hasCertificate: true,
      language: 'English',
      learningObjectives: [
        'Build cross-platform mobile apps',
        'Master React Native navigation',
        'Implement complex animations',
        'Deploy to App Store and Google Play',
      ],
    },
    {
      title: 'Introduction to Web Development',
      shortDescription: 'Your first step into web development: HTML, CSS, and JavaScript fundamentals.',
      description: 'Perfect for complete beginners. Learn HTML5, CSS3, and vanilla JavaScript to build your first websites. Includes 10 hands-on projects.',
      category: 'Web Development',
      level: CourseLevel.BEGINNER,
      price: 0,
      isFree: true,
      tags: ['html', 'css', 'javascript', 'web-development', 'beginner'],
      hasCertificate: false,
      language: 'English',
      learningObjectives: [
        'Build semantic HTML pages',
        'Style with modern CSS',
        'Add interactivity with JavaScript',
        'Complete 10 real projects',
      ],
    },
    {
      title: 'DevOps Engineering Masterclass',
      shortDescription: 'CI/CD, Docker, Kubernetes, Terraform, and cloud infrastructure at scale.',
      description: 'Master DevOps practices: GitHub Actions CI/CD, Docker containerization, Kubernetes orchestration, Terraform IaC, AWS/GCP deployment, monitoring with Prometheus & Grafana.',
      category: 'DevOps & Cloud',
      level: CourseLevel.ADVANCED,
      price: 99.99,
      isFree: false,
      tags: ['devops', 'docker', 'kubernetes', 'terraform', 'aws', 'ci-cd'],
      hasCertificate: true,
      language: 'English',
      learningObjectives: [
        'Set up automated CI/CD pipelines',
        'Deploy microservices with Kubernetes',
        'Provision infrastructure with Terraform',
        'Monitor systems with Prometheus',
      ],
    },
  ];

  const createdCourses = [];
  for (const courseData of coursesData) {
    const slug = slugify(courseData.title, { lower: true, strict: true });
    const [course] = await Course.findOrCreate({
      where: { slug },
      defaults: {
        ...courseData,
        instructorId: instructor.id,
        slug,
        status: CourseStatus.PUBLISHED,
        publishedAt: new Date(),
        totalDurationMinutes: Math.floor(Math.random() * 2000) + 500,
        totalEnrollments: Math.floor(Math.random() * 5000) + 100,
        avgRating: parseFloat((3.8 + Math.random() * 1.2).toFixed(1)),
        totalReviews: Math.floor(Math.random() * 500) + 20,
      },
    });
    createdCourses.push(course);

    // Create Sections & Lessons for first course only (as example)
    if (courseData.title.includes('Full-Stack')) {
      const sections = [
        {
          title: 'Getting Started with Next.js 14',
          lessons: [
            { title: 'Course Introduction & Setup', type: LessonType.VIDEO, durationMinutes: 8, isFree: true },
            { title: 'Next.js 14 Project Structure', type: LessonType.VIDEO, durationMinutes: 15 },
            { title: 'React Server Components Deep Dive', type: LessonType.VIDEO, durationMinutes: 25 },
            { title: 'Knowledge Check', type: LessonType.QUIZ, durationMinutes: 10 },
          ],
        },
        {
          title: 'Microservices Architecture',
          lessons: [
            { title: 'Monolith vs Microservices', type: LessonType.VIDEO, durationMinutes: 20 },
            { title: 'Service Communication Patterns', type: LessonType.VIDEO, durationMinutes: 30 },
            { title: 'API Gateway Design', type: LessonType.ARTICLE, durationMinutes: 15 },
            { title: 'Microservices Quiz', type: LessonType.QUIZ, durationMinutes: 15 },
          ],
        },
        {
          title: 'Docker & Kubernetes',
          lessons: [
            { title: 'Docker Fundamentals', type: LessonType.VIDEO, durationMinutes: 35 },
            { title: 'Docker Compose for Dev', type: LessonType.VIDEO, durationMinutes: 20 },
            { title: 'Kubernetes Core Concepts', type: LessonType.VIDEO, durationMinutes: 45 },
            { title: 'Deploying to K8s', type: LessonType.VIDEO, durationMinutes: 40 },
          ],
        },
      ];

      for (let si = 0; si < sections.length; si++) {
        const sectionData = sections[si];
        const [section] = await Section.findOrCreate({
          where: { courseId: course.id, title: sectionData.title },
          defaults: {
            courseId: course.id,
            title: sectionData.title,
            orderIndex: si,
            isPublished: true,
          },
        });

        for (let li = 0; li < sectionData.lessons.length; li++) {
          const lessonData = sectionData.lessons[li];
          await Lesson.findOrCreate({
            where: { sectionId: section.id, title: lessonData.title },
            defaults: {
              sectionId: section.id,
              courseId: course.id,
              title: lessonData.title,
              type: lessonData.type,
              durationMinutes: lessonData.durationMinutes,
              orderIndex: li,
              isFree: lessonData.isFree || false,
              isPublished: true,
              ...(lessonData.type === LessonType.QUIZ ? {
                metadata: {
                  passingScore: 70,
                  questions: [
                    {
                      id: 'q1',
                      text: 'What is a key advantage of React Server Components?',
                      options: ['Better SEO', 'Reduced client-side JavaScript', 'Faster hydration', 'All of the above'],
                      correctIndex: 3,
                      explanation: 'RSCs offer all these benefits by moving rendering to the server.',
                    },
                  ],
                },
              } : {}),
            },
          });
        }
      }
    }
  }
  console.log(`✅ ${createdCourses.length} courses created`);

  console.log('\n🎉 Seed completed successfully!\n');
  console.log('─'.repeat(50));
  console.log('Test accounts:');
  console.log('  Admin:      admin@kinetiqacademy.com / Admin@1234');
  console.log('  Instructor: instructor@kinetiqacademy.com / Instructor@1234');
  console.log('  Student:    student@kinetiqacademy.com / Student@1234');
  console.log('─'.repeat(50));

  await sequelize.close();
  process.exit(0);
};

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
