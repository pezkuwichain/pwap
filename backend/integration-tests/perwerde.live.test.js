/**
 * @file: perwerde.live.test.js
 * @description: Live integration tests for the Perwerde (Education Platform) pallet.
 * 
 * @preconditions:
 *  1. A local Pezkuwi dev node must be running and accessible at `ws://127.0.0.1:8082`.
 *  2. The node must have the `perwerde` pallet included.
 */

import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';

// ========================================
// TEST CONFIGURATION
// ========================================

const WS_ENDPOINT = 'ws://127.0.0.1:8082';
jest.setTimeout(60000); // 60 seconds

// ========================================
// TEST SETUP & TEARDOWN
// ========================================

let api;
let keyring;
let admin, student1, nonAdmin;
let courseId = 0;

beforeAll(async () => {
  const wsProvider = new WsProvider(WS_ENDPOINT);
  api = await ApiPromise.create({ provider: wsProvider });
  keyring = new Keyring({ type: 'sr25519' });
  
  // Per mock.rs, admin is account 0, which is //Alice
  admin = keyring.addFromUri('//Alice');
  student1 = keyring.addFromUri('//Charlie');
  nonAdmin = keyring.addFromUri('//Dave');

  console.log('Connected to node for Perwerde tests.');
});

afterAll(async () => {
  if (api) await api.disconnect();
  console.log('Disconnected from node.');
});

// Helper to wait for the next finalized block and get the tx result
const sendAndFinalize = async (tx) => {
    return new Promise((resolve, reject) => {
        tx.signAndSend(admin, ({ status, dispatchError, events }) => {
            if (status.isFinalized) {
                if (dispatchError) {
                    const decoded = api.registry.findMetaError(dispatchError.asModule);
                    const errorMsg = `${decoded.section}.${decoded.name}`;
                    reject(new Error(errorMsg));
                } else {
                    resolve(events);
                }
            }
        }).catch(reject);
    });
};

// ========================================
// LIVE PALLET TESTS (Translated from .rs)
// ========================================

describe('Perwerde Pallet Live Tests', () => {

  /**
   * Corresponds to: `create_course_works` and `next_course_id_increments_correctly`
   */
  it('should allow an admin to create a course', async () => {
    const nextCourseId = await api.query.perwerde.nextCourseId();
    courseId = nextCourseId.toNumber();

    const tx = api.tx.perwerde.createCourse(
      "Blockchain 101",
      "An introduction to blockchain technology.",
      "https://example.com/blockchain101"
    );
    await sendAndFinalize(tx);

    const course = (await api.query.perwerde.courses(courseId)).unwrap();
    expect(course.owner.toString()).toBe(admin.address);
    expect(course.name.toHuman()).toBe("Blockchain 101");
  });

  /**
   * Corresponds to: `create_course_fails_for_non_admin`
   */
  it('should NOT allow a non-admin to create a course', async () => {
    const tx = api.tx.perwerde.createCourse(
      "Unauthorized Course", "Desc", "URL"
    );
    
    // We expect this transaction to fail with a BadOrigin error
    await expect(
        sendAndFinalize(tx.sign(nonAdmin)) // Sign with the wrong account
    ).rejects.toThrow('system.BadOrigin');
  });

  /**
   * Corresponds to: `enroll_works` and part of `complete_course_works`
   */
  it('should allow a student to enroll in and complete a course', async () => {
    // Phase 1: Enroll
    const enrollTx = api.tx.perwerde.enroll(courseId);
    await sendAndFinalize(enrollTx.sign(student1));

    let enrollment = (await api.query.perwerde.enrollments([student1.address, courseId])).unwrap();
    expect(enrollment.student.toString()).toBe(student1.address);
    expect(enrollment.completedAt.isNone).toBe(true);

    // Phase 2: Complete
    const points = 95;
    const completeTx = api.tx.perwerde.completeCourse(courseId, points);
    await sendAndFinalize(completeTx.sign(student1));
    
    enrollment = (await api.query.perwerde.enrollments([student1.address, courseId])).unwrap();
    expect(enrollment.completedAt.isSome).toBe(true);
    expect(enrollment.pointsEarned.toNumber()).toBe(points);
  });
  
  /**
   * Corresponds to: `enroll_fails_if_already_enrolled`
   */
  it('should fail if a student tries to enroll in the same course twice', async () => {
    // Student1 is already enrolled from the previous test.
    const enrollTx = api.tx.perwerde.enroll(courseId);

    await expect(
        sendAndFinalize(enrollTx.sign(student1))
    ).rejects.toThrow('perwerde.AlreadyEnrolled');
  });
  
  /**
   * Corresponds to: `archive_course_works`
   */
  it('should allow the course owner to archive it', async () => {
    const archiveTx = api.tx.perwerde.archiveCourse(courseId);
    await sendAndFinalize(archiveTx); // Signed by admin by default in helper

    const course = (await api.query.perwerde.courses(courseId)).unwrap();
    expect(course.status.toString()).toBe('Archived');
  });

  /**
   * Corresponds to: `enroll_fails_for_archived_course`
   */
  it('should fail if a student tries to enroll in an archived course', async () => {
    const newStudent = keyring.addFromUri('//Ferdie');
    const enrollTx = api.tx.perwerde.enroll(courseId);

    await expect(
        sendAndFinalize(enrollTx.sign(newStudent))
    ).rejects.toThrow('perwerde.CourseNotActive');
  });
});
