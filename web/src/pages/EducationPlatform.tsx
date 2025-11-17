/**
 * Perwerde Education Platform
 *
 * Decentralized education system for Digital Kurdistan
 * - Browse courses from blockchain
 * - Enroll in courses
 * - Track learning progress
 * - Earn educational credentials
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  GraduationCap,
  BookOpen,
  Award,
  Users,
  Clock,
  Star,
  TrendingUp,
  CheckCircle,
  Play,
  ExternalLink,
} from 'lucide-react';
import { usePolkadot } from '@/contexts/PolkadotContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { AsyncComponent, LoadingState } from '@pezkuwi/components/AsyncComponent';
import {
  getActiveCourses,
  getStudentProgress,
  getStudentCourses,
  getCourseById,
  isEnrolled,
  type Course,
  type StudentProgress,
  formatIPFSLink,
  getCourseDifficulty,
} from '@pezkuwi/lib/perwerde';
import { web3FromAddress } from '@polkadot/extension-dapp';
import { handleBlockchainError, handleBlockchainSuccess } from '@pezkuwi/lib/error-handler';

export default function EducationPlatform() {
  const { api, selectedAccount, isApiReady } = usePolkadot();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [studentProgress, setStudentProgress] = useState<StudentProgress | null>(null);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<number[]>([]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!api || !isApiReady) return;

      try {
        setLoading(true);
        const coursesData = await getActiveCourses(api);
        setCourses(coursesData);

        // If user is logged in, fetch their progress
        if (selectedAccount) {
          const [progress, enrolledIds] = await Promise.all([
            getStudentProgress(api, selectedAccount.address),
            getStudentCourses(api, selectedAccount.address),
          ]);

          setStudentProgress(progress);
          setEnrolledCourseIds(enrolledIds);
        }
      } catch (error) {
        console.error('Failed to load education data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load courses data',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [api, isApiReady, selectedAccount]);

  const handleEnroll = async (courseId: number) => {
    if (!api || !selectedAccount) {
      toast({
        title: 'Error',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return;
    }

    try {
      const injector = await web3FromAddress(selectedAccount.address);
      const tx = api.tx.perwerde.enroll(courseId);

      await tx.signAndSend(
        selectedAccount.address,
        { signer: injector.signer },
        ({ status, dispatchError }) => {
          if (status.isInBlock) {
            if (dispatchError) {
              handleBlockchainError(dispatchError, api, toast);
            } else {
              handleBlockchainSuccess('perwerde.enrolled', toast);
              // Refresh data
              setTimeout(async () => {
                if (api && selectedAccount) {
                  const [progress, enrolledIds] = await Promise.all([
                    getStudentProgress(api, selectedAccount.address),
                    getStudentCourses(api, selectedAccount.address),
                  ]);
                  setStudentProgress(progress);
                  setEnrolledCourseIds(enrolledIds);
                }
              }, 2000);
            }
          }
        }
      );
    } catch (error: any) {
      console.error('Enroll failed:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to enroll in course',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <LoadingState message="Loading education platform..." />;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <GraduationCap className="w-10 h-10 text-green-500" />
          Perwerde - Education Platform
        </h1>
        <p className="text-gray-400">
          Decentralized learning for Digital Kurdistan. Build skills, earn credentials, empower our nation.
        </p>
      </div>

      {/* Stats Cards */}
      {studentProgress && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{studentProgress.totalCourses}</div>
                  <div className="text-sm text-gray-400">Enrolled Courses</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{studentProgress.completedCourses}</div>
                  <div className="text-sm text-gray-400">Completed</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{studentProgress.activeCourses}</div>
                  <div className="text-sm text-gray-400">In Progress</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Award className="w-6 h-6 text-yellow-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{studentProgress.totalPoints}</div>
                  <div className="text-sm text-gray-400">Total Points</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Courses List */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">
            {courses.length > 0 ? `Available Courses (${courses.length})` : 'No Courses Available'}
          </h2>
        </div>

        {courses.length === 0 ? (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-12 text-center">
              <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-400 mb-2">No Active Courses</h3>
              <p className="text-gray-500 mb-6">
                Check back later for new educational content. Courses will be added by educators.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {courses.map((course) => {
              const isUserEnrolled = enrolledCourseIds.includes(course.id);

              return (
                <Card
                  key={course.id}
                  className="bg-gray-900 border-gray-800 hover:border-green-500/50 transition-colors"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-6">
                      {/* Course Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-white">{course.name}</h3>
                          <Badge className="bg-green-500/10 text-green-400 border-green-500/30">
                            #{course.id}
                          </Badge>
                          {isUserEnrolled && (
                            <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                              Enrolled
                            </Badge>
                          )}
                        </div>

                        <p className="text-gray-400 mb-4">{course.description}</p>

                        <div className="flex items-center gap-4 text-sm text-gray-400">
                          <div className="flex items-center gap-1">
                            <GraduationCap className="w-4 h-4" />
                            {course.owner.slice(0, 8)}...{course.owner.slice(-6)}
                          </div>
                          {course.contentLink && (
                            <a
                              href={formatIPFSLink(course.contentLink)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-green-400 hover:text-green-300"
                            >
                              <ExternalLink className="w-4 h-4" />
                              Course Materials
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2">
                        {isUserEnrolled ? (
                          <>
                            <Button className="bg-blue-600 hover:bg-blue-700">
                              <Play className="w-4 h-4 mr-2" />
                              Continue Learning
                            </Button>
                            <Button variant="outline">View Progress</Button>
                          </>
                        ) : (
                          <>
                            <Button
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleEnroll(course.id)}
                              disabled={!selectedAccount}
                            >
                              Enroll Now
                            </Button>
                            <Button variant="outline">View Details</Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Blockchain Features */}
      <Card className="mt-8 bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Blockchain-Powered Education
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-2 gap-4 text-sm">
            <li className="flex items-center gap-2 text-gray-300">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Decentralized course hosting (IPFS)
            </li>
            <li className="flex items-center gap-2 text-gray-300">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              On-chain enrollment & completion tracking
            </li>
            <li className="flex items-center gap-2 text-gray-300">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Points-based achievement system
            </li>
            <li className="flex items-center gap-2 text-gray-300">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Trust score integration
            </li>
            <li className="flex items-center gap-2 text-gray-300">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Transparent educator verification
            </li>
            <li className="flex items-center gap-2 text-gray-300">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Immutable learning records
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
