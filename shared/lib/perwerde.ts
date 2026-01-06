import { ApiPromise } from '@pezkuwi/api';
import { SubmittableExtrinsic } from '@pezkuwi/api/types';
import { InjectedAccountWithMeta } from '@pezkuwi/extension-inject/types';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

/**
 * Course data structure matching blockchain pallet
 */
export interface Course {
  id: number;
  owner: string;
  name: string;
  description: string;
  content_link: string; // IPFS hash
  status: 'Active' | 'Archived';
  created_at: string;
}

/**
 * Enrollment data structure
 */
export interface Enrollment {
  id: string;
  student_address: string;
  course_id: number;
  enrolled_at: string;
  completed_at?: string;
  points_earned: number;
  is_completed: boolean;
}

/**
 * Create a new course on blockchain and sync to Supabase
 * 
 * Flow:
 * 1. Call blockchain create_course extrinsic
 * 2. Wait for block inclusion
 * 3. Extract course_id from event
 * 4. Insert to Supabase with blockchain course_id
 */
export async function createCourse(
  api: ApiPromise,
  account: InjectedAccountWithMeta,
  name: string,
  description: string,
  ipfsHash: string
): Promise<number> {
  try {
    // Convert strings to bounded vecs (Vec<u8>)
    const nameVec = Array.from(new TextEncoder().encode(name));
    const descVec = Array.from(new TextEncoder().encode(description));
    const linkVec = Array.from(new TextEncoder().encode(ipfsHash));

    // Create extrinsic
    const extrinsic = api.tx.perwerde.createCourse(nameVec, descVec, linkVec);

    // Sign and send
    const courseId = await new Promise<number>((resolve, reject) => {
      let unsub: () => void;

      extrinsic.signAndSend(
        account.address,
        ({ status, events, dispatchError }) => {
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs}`));
            } else {
              reject(new Error(dispatchError.toString()));
            }
            if (unsub) unsub();
            return;
          }

          if (status.isInBlock || status.isFinalized) {
            // Find CourseCreated event
            const courseCreatedEvent = events.find(
              ({ event }) =>
                event.section === 'perwerde' && event.method === 'CourseCreated'
            );

            if (courseCreatedEvent) {
              const courseId = courseCreatedEvent.event.data[0].toString();
              resolve(parseInt(courseId));
            } else {
              reject(new Error('CourseCreated event not found'));
            }

            if (unsub) unsub();
          }
        }
      ).then((unsubscribe) => {
        unsub = unsubscribe;
      });
    });

    // Insert to Supabase
    const { error: supabaseError } = await supabase.from('courses').insert({
      id: courseId,
      owner: account.address,
      name,
      description,
      content_link: ipfsHash,
      status: 'Active',
      created_at: new Date().toISOString(),
    });

    if (supabaseError) {
      console.error('Supabase insert failed:', supabaseError);
      toast.error('Course created on blockchain but failed to sync to database');
    } else {
      toast.success(`Course created with ID: ${courseId}`);
    }

    return courseId;
  } catch (error) {
    console.error('Create course error:', error);
    toast.error(error instanceof Error ? error.message : 'Failed to create course');
    throw error;
  }
}

/**
 * Enroll student in a course
 */
export async function enrollInCourse(
  api: ApiPromise,
  account: InjectedAccountWithMeta,
  courseId: number
): Promise<void> {
  try {
    const extrinsic = api.tx.perwerde.enroll(courseId);

    await new Promise<void>((resolve, reject) => {
      let unsub: () => void;

      extrinsic.signAndSend(
        account.address,
        ({ status, events, dispatchError }) => {
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs}`));
            } else {
              reject(new Error(dispatchError.toString()));
            }
            if (unsub) unsub();
            return;
          }

          if (status.isInBlock || status.isFinalized) {
            resolve();
            if (unsub) unsub();
          }
        }
      ).then((unsubscribe) => {
        unsub = unsubscribe;
      });
    });

    // Insert enrollment to Supabase
    const { error: supabaseError } = await supabase.from('enrollments').insert({
      student_address: account.address,
      course_id: courseId,
      enrolled_at: new Date().toISOString(),
      is_completed: false,
      points_earned: 0,
    });

    if (supabaseError) {
      console.error('Supabase enrollment insert failed:', supabaseError);
      toast.error('Enrolled on blockchain but failed to sync to database');
    } else {
      toast.success('Successfully enrolled in course');
    }
  } catch (error) {
    console.error('Enroll error:', error);
    toast.error(error instanceof Error ? error.message : 'Failed to enroll in course');
    throw error;
  }
}

/**
 * Mark course as completed (student self-completes)
 */
export async function completeCourse(
  api: ApiPromise,
  account: InjectedAccountWithMeta,
  courseId: number,
  points: number
): Promise<void> {
  try {
    const extrinsic = api.tx.perwerde.completeCourse(courseId, points);

    await new Promise<void>((resolve, reject) => {
      let unsub: () => void;

      extrinsic.signAndSend(
        account.address,
        ({ status, dispatchError }) => {
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs}`));
            } else {
              reject(new Error(dispatchError.toString()));
            }
            if (unsub) unsub();
            return;
          }

          if (status.isInBlock || status.isFinalized) {
            resolve();
            if (unsub) unsub();
          }
        }
      ).then((unsubscribe) => {
        unsub = unsubscribe;
      });
    });

    // Update enrollment in Supabase
    const { error: supabaseError } = await supabase
      .from('enrollments')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
        points_earned: points,
      })
      .eq('student_address', account.address)
      .eq('course_id', courseId);

    if (supabaseError) {
      console.error('Supabase completion update failed:', supabaseError);
      toast.error('Completed on blockchain but failed to sync to database');
    } else {
      toast.success(`Course completed! Earned ${points} points`);
    }
  } catch (error) {
    console.error('Complete course error:', error);
    toast.error(error instanceof Error ? error.message : 'Failed to complete course');
    throw error;
  }
}

/**
 * Archive a course (admin/owner only)
 */
export async function archiveCourse(
  api: ApiPromise,
  account: InjectedAccountWithMeta,
  courseId: number
): Promise<void> {
  try {
    const extrinsic = api.tx.perwerde.archiveCourse(courseId);

    await new Promise<void>((resolve, reject) => {
      let unsub: () => void;

      extrinsic.signAndSend(
        account.address,
        ({ status, dispatchError }) => {
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs}`));
            } else {
              reject(new Error(dispatchError.toString()));
            }
            if (unsub) unsub();
            return;
          }

          if (status.isInBlock || status.isFinalized) {
            resolve();
            if (unsub) unsub();
          }
        }
      ).then((unsubscribe) => {
        unsub = unsubscribe;
      });
    });

    // Update course status in Supabase
    const { error: supabaseError } = await supabase
      .from('courses')
      .update({ status: 'Archived' })
      .eq('id', courseId);

    if (supabaseError) {
      console.error('Supabase archive update failed:', supabaseError);
      toast.error('Archived on blockchain but failed to sync to database');
    } else {
      toast.success('Course archived');
    }
  } catch (error) {
    console.error('Archive course error:', error);
    toast.error(error instanceof Error ? error.message : 'Failed to archive course');
    throw error;
  }
}

/**
 * Get Perwerde score for a student (from blockchain)
 */
export async function getPerwerdeScore(
  api: ApiPromise,
  studentAddress: string
): Promise<number> {
  try {
    // This would require a custom RPC or query if exposed
    // For now, calculate from Supabase
    const { data, error } = await supabase
      .from('enrollments')
      .select('points_earned')
      .eq('student_address', studentAddress)
      .eq('is_completed', true);

    if (error) throw error;

    const totalPoints = data?.reduce((sum, e) => sum + e.points_earned, 0) || 0;
    return totalPoints;
  } catch (error) {
    console.error('Get Perwerde score error:', error);
    return 0;
  }
}

/**
 * Fetch all courses from Supabase
 */
export async function getCourses(status?: 'Active' | 'Archived'): Promise<Course[]> {
  try {
    let query = supabase.from('courses').select('*').order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Get courses error:', error);
    toast.error('Failed to fetch courses');
    return [];
  }
}

/**
 * Fetch student enrollments
 */
export async function getStudentEnrollments(studentAddress: string): Promise<Enrollment[]> {
  try {
    const { data, error } = await supabase
      .from('enrollments')
      .select('*')
      .eq('student_address', studentAddress)
      .order('enrolled_at', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Get enrollments error:', error);
    toast.error('Failed to fetch enrollments');
    return [];
  }
}
