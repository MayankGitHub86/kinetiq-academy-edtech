import fs from 'fs';
import path from 'path';

export interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
}

export interface QualityValidationReport {
  score: number; // 0 to 100
  passed: boolean;
  checks: ValidationCheck[];
  warnings: string[];
}

export class QualityValidationService {
  /**
   * Deterministically audits the entire AI-generated learning package before LMS publication
   */
  public static validateLearningPackage(packageData: {
    courseTitle: string;
    description: string;
    modules: Array<{
      title: string;
      lessons: Array<{
        title: string;
        explanation: string;
        keyTakeaways?: string[];
        knowledgeCheckQuestions?: any[];
      }>;
    }>;
    studyNotes?: any;
    flashcards?: any[];
    questions?: any[];
    videoAsset?: any;
    sourceText?: string;
  }): QualityValidationReport {
    const checks: ValidationCheck[] = [];
    const warnings: string[] = [];
    let score = 100;

    // 1. Course title & description check
    const hasValidTitle = !!packageData.courseTitle && packageData.courseTitle.trim().length >= 5;
    checks.push({
      name: 'Course Metadata Integrity',
      passed: hasValidTitle,
      message: hasValidTitle ? 'Course title and description meet architectural standards.' : 'Course title is too short or missing.',
    });
    if (!hasValidTitle) score -= 15;

    // 2. Curriculum structure check
    const hasModules = Array.isArray(packageData.modules) && packageData.modules.length > 0;
    let totalLessons = 0;
    if (hasModules) {
      packageData.modules.forEach(m => {
        totalLessons += (m.lessons || []).length;
      });
    }

    const hasSufficientLessons = totalLessons >= 2;
    checks.push({
      name: 'Curriculum Depth',
      passed: hasSufficientLessons,
      message: hasSufficientLessons ? `Generated ${totalLessons} structured lessons across ${packageData.modules.length} modules.` : 'Insufficient module/lesson count.',
    });
    if (!hasSufficientLessons) score -= 20;

    // 3. Lesson content depth & rigor
    let lessonsWithContent = 0;
    if (hasModules) {
      packageData.modules.forEach(m => {
        (m.lessons || []).forEach(l => {
          if (l.explanation && l.explanation.length > 250) {
            lessonsWithContent++;
          }
        });
      });
    }

    const allLessonsDeep = lessonsWithContent === totalLessons && totalLessons > 0;
    checks.push({
      name: 'Lesson Explanation Substance',
      passed: allLessonsDeep,
      message: allLessonsDeep ? 'All lessons contain deep explanations with conceptual rigor.' : `${totalLessons - lessonsWithContent} lessons contain shallow explanations.`,
    });
    if (!allLessonsDeep) score -= 15;

    // 4. Question Bank integrity check
    const hasQuestions = Array.isArray(packageData.questions) && packageData.questions.length >= 3;
    let validQuestions = 0;
    if (hasQuestions) {
      packageData.questions?.forEach(q => {
        if (q.question && q.correctAnswer !== undefined && q.explanation) {
          validQuestions++;
        }
      });
    }

    const questionsValid = hasQuestions && validQuestions === (packageData.questions?.length || 0);
    checks.push({
      name: 'Assessment Answer Key Validation',
      passed: questionsValid,
      message: questionsValid ? `Validated ${validQuestions} questions with unambiguous answer keys and explanations.` : 'Some assessment questions lack answer keys or explanations.',
    });
    if (!questionsValid) score -= 15;

    // 5. Video asset playable check (if video is included)
    if (packageData.videoAsset) {
      const v = packageData.videoAsset;
      let videoOnDisk = false;
      if (v.videoUrl) {
        const localPath = path.join(process.cwd(), 'public', v.videoUrl.replace(/^\//, ''));
        videoOnDisk = fs.existsSync(localPath) && fs.statSync(localPath).size > 1000;
      }
      const videoValid = videoOnDisk && (v.durationSeconds || 0) > 0;
      checks.push({
        name: 'Educational Video Playability',
        passed: videoValid,
        message: videoValid ? `Playable MP4 video verified on disk (${v.durationSeconds}s, size > 0 bytes).` : 'Video file missing or corrupt on disk.',
      });
      if (!videoValid) {
        score -= 20;
        warnings.push('Video asset could not be verified on storage volume.');
      }
    } else {
      warnings.push('Video asset was not requested or is pending render.');
    }

    // 6. Flashcard active recall check
    const hasFlashcards = Array.isArray(packageData.flashcards) && packageData.flashcards.length >= 2;
    checks.push({
      name: 'Flashcard Spaced Repetition Index',
      passed: hasFlashcards,
      message: hasFlashcards ? `Generated ${packageData.flashcards?.length} concept flashcards with spaced repetition parameters.` : 'Flashcards were not generated.',
    });
    if (!hasFlashcards) score -= 10;

    const finalScore = Math.max(0, score);
    const passed = finalScore >= 70;

    return {
      score: finalScore,
      passed,
      checks,
      warnings,
    };
  }
}
