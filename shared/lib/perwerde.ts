/**
 * Perwerde (Education) Pallet Integration
 *
 * This module provides helper functions for interacting with the Perwerde pallet,
 * which handles:
 * - Course creation and management
 * - Student enrollment
 * - Course completion tracking
 * - Education points/scores
 */

import type { ApiPromise } from '@polkadot/api';
import type { Option } from '@polkadot/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type CourseStatus = 'Active' | 'Archived';

export interface Course {
  id: number;
  owner: string;
  name: string;
  description: string;
  contentLink: string;
  status: CourseStatus;
  createdAt: number;
}

export interface Enrollment {
  student: string;
  courseId: number;
  enrolledAt: number;
  completedAt?: number;
  pointsEarned: number;
  isCompleted: boolean;
}

export interface StudentProgress {
  totalCourses: number;
  completedCourses: number;
  totalPoints: number;
  activeCourses: number;
}

// ============================================================================
// QUERY FUNCTIONS (Read-only)
// ============================================================================

/**
 * Get all courses (active and archived)
 */
export async function getAllCourses(api: ApiPromise): Promise<Course[]> {
  const nextId = await api.query.perwerde.nextCourseId();
  const currentId = (nextId.toJSON() as number) || 0;

  const courses: Course[] = [];

  for (let i = 0; i < currentId; i++) {
    const courseOption = await api.query.perwerde.courses(i);

    if (courseOption.isSome) {
      const courseData = courseOption.unwrap().toJSON() as any;

      courses.push({
        id: i,
        owner: courseData.owner,
        name: hexToString(courseData.name),
        description: hexToString(courseData.description),
        contentLink: hexToString(courseData.contentLink),
        status: courseData.status as CourseStatus,
        createdAt: courseData.createdAt,
      });
    }
  }

  return courses;
}

/**
 * Get active courses only
 */
export async function getActiveCourses(api: ApiPromise): Promise<Course[]> {
  const allCourses = await getAllCourses(api);
  return allCourses.filter((course) => course.status === 'Active');
}

/**
 * Get course by ID
 */
export async function getCourseById(api: ApiPromise, courseId: number): Promise<Course | null> {
  const courseOption = await api.query.perwerde.courses(courseId);

  if (courseOption.isNone) {
    return null;
  }

  const courseData = courseOption.unwrap().toJSON() as any;

  return {
    id: courseId,
    owner: courseData.owner,
    name: hexToString(courseData.name),
    description: hexToString(courseData.description),
    contentLink: hexToString(courseData.contentLink),
    status: courseData.status as CourseStatus,
    createdAt: courseData.createdAt,
  };
}

/**
 * Get student's enrolled courses
 */
export async function getStudentCourses(api: ApiPromise, studentAddress: string): Promise<number[]> {
  const coursesOption = await api.query.perwerde.studentCourses(studentAddress);

  if (coursesOption.isNone || coursesOption.isEmpty) {
    return [];
  }

  return (coursesOption.toJSON() as number[]) || [];
}

/**
 * Get enrollment details for a student in a specific course
 */
export async function getEnrollment(
  api: ApiPromise,
  studentAddress: string,
  courseId: number
): Promise<Enrollment | null> {
  const enrollmentOption = await api.query.perwerde.enrollments([studentAddress, courseId]);

  if (enrollmentOption.isNone) {
    return null;
  }

  const enrollmentData = enrollmentOption.unwrap().toJSON() as any;

  return {
    student: enrollmentData.student,
    courseId: enrollmentData.courseId,
    enrolledAt: enrollmentData.enrolledAt,
    completedAt: enrollmentData.completedAt || undefined,
    pointsEarned: enrollmentData.pointsEarned || 0,
    isCompleted: !!enrollmentData.completedAt,
  };
}

/**
 * Get student's progress summary
 */
export async function getStudentProgress(api: ApiPromise, studentAddress: string): Promise<StudentProgress> {
  const courseIds = await getStudentCourses(api, studentAddress);

  let completedCourses = 0;
  let totalPoints = 0;

  for (const courseId of courseIds) {
    const enrollment = await getEnrollment(api, studentAddress, courseId);

    if (enrollment) {
      if (enrollment.isCompleted) {
        completedCourses++;
        totalPoints += enrollment.pointsEarned;
      }
    }
  }

  return {
    totalCourses: courseIds.length,
    completedCourses,
    totalPoints,
    activeCourses: courseIds.length - completedCourses,
  };
}

/**
 * Get Perwerde score for a student (sum of all earned points)
 */
export async function getPerwerdeScore(api: ApiPromise, studentAddress: string): Promise<number> {
  try {
    // Try to call the get_perwerde_score runtime API
    // This might not exist in all versions, fallback to manual calculation
    const score = await api.call.perwerdeApi?.getPerwerdeScore(studentAddress);
    return score ? (score.toJSON() as number) : 0;
  } catch (error) {
    // Fallback: manually sum all points
    const progress = await getStudentProgress(api, studentAddress);
    return progress.totalPoints;
  }
}

/**
 * Check if student is enrolled in a course
 */
export async function isEnrolled(
  api: ApiPromise,
  studentAddress: string,
  courseId: number
): Promise<boolean> {
  const enrollment = await getEnrollment(api, studentAddress, courseId);
  return enrollment !== null;
}

/**
 * Get course enrollment statistics
 */
export async function getCourseStats(
  api: ApiPromise,
  courseId: number
): Promise<{
  totalEnrollments: number;
  completions: number;
  averagePoints: number;
}> {
  // Note: This requires iterating through all enrollments, which can be expensive
  // In production, consider caching or maintaining separate counters

  const entries = await api.query.perwerde.enrollments.entries();

  let totalEnrollments = 0;
  let completions = 0;
  let totalPoints = 0;

  for (const [key, value] of entries) {
    const enrollmentData = value.toJSON() as any;
    const enrollmentCourseId = (key.args[1] as any).toNumber();

    if (enrollmentCourseId === courseId) {
      totalEnrollments++;

      if (enrollmentData.completedAt) {
        completions++;
        totalPoints += enrollmentData.pointsEarned || 0;
      }
    }
  }

  return {
    totalEnrollments,
    completions,
    averagePoints: completions > 0 ? Math.round(totalPoints / completions) : 0,
  };
}

// ============================================================================
// TRANSACTION FUNCTIONS
// ============================================================================

/**
 * Create a new course
 * @requires AdminOrigin (only admin can create courses in current implementation)
 */
export async function createCourse(
  api: ApiPromise,
  signer: any,
  name: string,
  description: string,
  contentLink: string
): Promise<void> {
  const tx = api.tx.perwerde.createCourse(name, description, contentLink);

  return new Promise((resolve, reject) => {
    tx.signAndSend(signer, ({ status, dispatchError }) => {
      if (status.isInBlock) {
        if (dispatchError) {
          reject(dispatchError);
        } else {
          resolve();
        }
      }
    });
  });
}

/**
 * Enroll in a course
 */
export async function enrollInCourse(
  api: ApiPromise,
  signerAddress: string,
  courseId: number
): Promise<void> {
  const tx = api.tx.perwerde.enroll(courseId);

  return new Promise((resolve, reject) => {
    tx.signAndSend(signerAddress, ({ status, dispatchError }) => {
      if (status.isInBlock) {
        if (dispatchError) {
          reject(dispatchError);
        } else {
          resolve();
        }
      }
    });
  });
}

/**
 * Complete a course
 * @requires Course owner to call this for student
 */
export async function completeCourse(
  api: ApiPromise,
  signer: any,
  studentAddress: string,
  courseId: number,
  points: number
): Promise<void> {
  const tx = api.tx.perwerde.completeCourse(courseId, points);

  return new Promise((resolve, reject) => {
    tx.signAndSend(signer, ({ status, dispatchError }) => {
      if (status.isInBlock) {
        if (dispatchError) {
          reject(dispatchError);
        } else {
          resolve();
        }
      }
    });
  });
}

/**
 * Archive a course
 * @requires Course owner
 */
export async function archiveCourse(
  api: ApiPromise,
  signer: any,
  courseId: number
): Promise<void> {
  const tx = api.tx.perwerde.archiveCourse(courseId);

  return new Promise((resolve, reject) => {
    tx.signAndSend(signer, ({ status, dispatchError }) => {
      if (status.isInBlock) {
        if (dispatchError) {
          reject(dispatchError);
        } else {
          resolve();
        }
      }
    });
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert hex string to UTF-8 string
 */
function hexToString(hex: any): string {
  if (!hex) return '';

  // If it's already a string, return it
  if (typeof hex === 'string' && !hex.startsWith('0x')) {
    return hex;
  }

  // If it's a hex string, convert it
  const hexStr = hex.toString().replace(/^0x/, '');
  let str = '';

  for (let i = 0; i < hexStr.length; i += 2) {
    const code = parseInt(hexStr.substr(i, 2), 16);
    if (code !== 0) {
      // Skip null bytes
      str += String.fromCharCode(code);
    }
  }

  return str.trim();
}

/**
 * Get course difficulty label (based on points threshold)
 */
export function getCourseDifficulty(averagePoints: number): {
  label: string;
  color: string;
} {
  if (averagePoints >= 100) {
    return { label: 'Advanced', color: 'red' };
  } else if (averagePoints >= 50) {
    return { label: 'Intermediate', color: 'yellow' };
  } else {
    return { label: 'Beginner', color: 'green' };
  }
}

/**
 * Format IPFS link to gateway URL
 */
export function formatIPFSLink(ipfsHash: string): string {
  if (!ipfsHash) return '';

  // If already a full URL, return it
  if (ipfsHash.startsWith('http')) {
    return ipfsHash;
  }

  // If starts with ipfs://, convert to gateway
  if (ipfsHash.startsWith('ipfs://')) {
    const hash = ipfsHash.replace('ipfs://', '');
    return `https://ipfs.io/ipfs/${hash}`;
  }

  // If it's just a hash, add gateway
  return `https://ipfs.io/ipfs/${ipfsHash}`;
}
