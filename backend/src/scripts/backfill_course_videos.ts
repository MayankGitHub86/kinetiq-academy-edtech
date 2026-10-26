import { sequelize } from '../config/database';
import { models } from '../models';
import { Course, Lesson, Section, LessonType } from '../models/Course';
import { VideoAsset } from '../models/AiLearning';
import { v4 as uuidv4 } from 'uuid';

async function backfill() {
  sequelize.addModels(models);
  await sequelize.authenticate();
  console.log('✅ Connected to database.');

  const courses = await Course.findAll({
    include: [{ model: Section, include: [Lesson] }],
  });

  console.log(`Found ${courses.length} courses to inspect.`);

  let updatedLessonsCount = 0;
  let createdVideoAssetsCount = 0;

  for (const course of courses) {
    const allLessons = (course.sections || []).flatMap((s: any) => s.lessons || []);
    // Find if course has any lesson with video or a VideoAsset
    let courseVideoUrl: string | undefined;
    let templateVideoAsset: any = null;

    for (const l of allLessons) {
      if (l.videoUrl) {
        courseVideoUrl = l.videoUrl;
        templateVideoAsset = await VideoAsset.findOne({ where: { lessonId: l.id } });
        if (templateVideoAsset) break;
      }
    }

    if (!templateVideoAsset) {
      templateVideoAsset = await VideoAsset.findOne({ where: { courseId: course.id } });
      if (templateVideoAsset) {
        courseVideoUrl = templateVideoAsset.videoUrl;
      }
    }

    if (!courseVideoUrl) {
      continue; // No video for this course
    }

    console.log(`Course "${course.title}" (${course.slug}) has video: ${courseVideoUrl}`);

    for (const lesson of allLessons) {
      let needsSave = false;
      if (!lesson.videoUrl) {
        lesson.videoUrl = courseVideoUrl;
        lesson.type = LessonType.VIDEO;
        await lesson.save();
        updatedLessonsCount++;
        needsSave = true;
      }

      // Check if VideoAsset exists for this lesson
      const existingVa = await VideoAsset.findOne({ where: { lessonId: lesson.id } });
      if (!existingVa) {
        await VideoAsset.create({
          id: uuidv4(),
          lessonId: lesson.id,
          courseId: course.id,
          title: lesson.title,
          videoUrl: courseVideoUrl,
          thumbnailUrl: templateVideoAsset?.thumbnailUrl,
          durationSeconds: templateVideoAsset?.durationSeconds || 44,
          videoStyle: templateVideoAsset?.videoStyle || 'technical_whiteboard',
          script: templateVideoAsset?.script || '',
          storyboard: templateVideoAsset?.storyboard || [],
          captionsVtt: templateVideoAsset?.captionsVtt || '',
          captionsVttUrl: templateVideoAsset?.captionsVttUrl || courseVideoUrl.replace(/\.mp4$/i, '.vtt'),
          transcript: templateVideoAsset?.transcript || [],
          provider: 'scene_renderer',
          status: 'ready',
        });
        createdVideoAssetsCount++;
      }
    }
  }

  console.log(`🎉 Backfill complete! Updated ${updatedLessonsCount} lessons and created ${createdVideoAssetsCount} video assets.`);
  process.exit(0);
}

backfill().catch((err) => {
  console.error('Backfill error:', err);
  process.exit(1);
});
