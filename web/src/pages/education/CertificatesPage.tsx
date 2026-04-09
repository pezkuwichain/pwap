import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePezkuwi } from '@/contexts/PezkuwiContext';

interface Course {
  id: number;
  owner: string;
  name: string;
  description: string;
  contentLink: string;
  status: 'Active' | 'Archived';
}

interface Enrollment {
  courseId: number;
  enrolledAt: number;
  completedAt: number | null;
  pointsEarned: number;
}

type Tab = 'courses' | 'enrolled' | 'completed';

interface CourseChainData {
  id: number; owner: string;
  name: number[] | string; description: number[] | string;
  contentLink: number[] | string;
  status: 'Active' | 'Archived';
}
interface EnrollmentChainData {
  student: string; courseId: number; enrolledAt: number;
  completedAt: number | null; pointsEarned: number;
}

function decodeText(data: number[] | string): string {
  if (typeof data === 'string') return data;
  try { return new TextDecoder().decode(new Uint8Array(data)); } catch { return ''; }
}

export default function CertificatesPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { api, isApiReady, selectedAccount, getKeyPair } = usePezkuwi();

  const [tab, setTab] = useState<Tab>('courses');
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState<number | null>(null);
  const [expandedCourse, setExpandedCourse] = useState<Course | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {
    if (!api || !isApiReady) return;
    try {
      const entries = await api.query.perwerde.courses.entries();
      const list: Course[] = [];
      for (const [, value] of entries) {
        if (!value.isEmpty) {
          const d = value.toJSON() as unknown as CourseChainData;
          list.push({ id: d.id, owner: d.owner, name: decodeText(d.name), description: decodeText(d.description), contentLink: decodeText(d.contentLink), status: d.status });
        }
      }
      list.sort((a, b) => b.id - a.id);
      setCourses(list);
    } catch (e) { console.error('fetchCourses', e); }
  }, [api, isApiReady]);

  const fetchEnrollments = useCallback(async () => {
    if (!api || !isApiReady || !selectedAccount) return;
    try {
      const ids = (await api.query.perwerde.studentCourses(selectedAccount.address)).toJSON() as number[];
      const list: Enrollment[] = [];
      let pts = 0;
      for (const cid of ids) {
        const e = await api.query.perwerde.enrollments([selectedAccount.address, cid]);
        if (!e.isEmpty) {
          const d = e.toJSON() as unknown as EnrollmentChainData;
          list.push({ courseId: d.courseId, enrolledAt: d.enrolledAt, completedAt: d.completedAt, pointsEarned: d.pointsEarned });
          if (d.completedAt) pts += d.pointsEarned;
        }
      }
      setEnrollments(list);
      setScore(pts);
    } catch (e) { console.error('fetchEnrollments', e); }
  }, [api, isApiReady, selectedAccount]);

  const load = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchCourses(), fetchEnrollments()]);
    setLoading(false);
  }, [fetchCourses, fetchEnrollments]);

  useEffect(() => {
    if (isApiReady) load();
  }, [isApiReady, selectedAccount, load]);

  const isEnrolled = (id: number) => enrollments.some(e => e.courseId === id);
  const isCompleted = (id: number) => enrollments.find(e => e.courseId === id)?.completedAt != null;
  const getEnrollment = (id: number) => enrollments.find(e => e.courseId === id);

  const handleEnroll = async (courseId: number) => {
    if (!api || !selectedAccount) return;
    setEnrolling(courseId);
    setError(null);
    try {
      const kp = await getKeyPair(selectedAccount.address);
      if (!kp) throw new Error('Could not get signer');
      await new Promise<void>((resolve, reject) => {
        api.tx.perwerde.enroll(courseId).signAndSend(kp, ({ status, dispatchError }) => {
          if (dispatchError) {
            const msg = dispatchError.isModule
              ? (() => { const d = api.registry.findMetaError(dispatchError.asModule); return `${d.section}.${d.name}`; })()
              : dispatchError.toString();
            reject(new Error(msg)); return;
          }
          if (status.isInBlock || status.isFinalized) resolve();
        });
      });
      setExpandedCourse(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setEnrolling(null);
    }
  };

  const filteredCourses = courses.filter(c => {
    if (tab === 'courses') return c.status === 'Active';
    if (tab === 'enrolled') return isEnrolled(c.id) && !isCompleted(c.id);
    return isCompleted(c.id);
  });

  const enrolledCount = enrollments.filter(e => !e.completedAt).length;
  const completedCount = enrollments.filter(e => e.completedAt != null).length;

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'courses',   label: t('certificates.tab.courses', 'Kurs'),    count: courses.filter(c => c.status === 'Active').length },
    { key: 'enrolled',  label: t('certificates.tab.enrolled', 'Tev li'), count: enrolledCount },
    { key: 'completed', label: t('certificates.tab.completed', 'Qediya'), count: completedCount },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="bg-yellow-600 px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate(-1)} className="text-white/80 hover:text-white text-xl leading-none">←</button>
          <span className="text-sm text-white/70">{t('certificates.breadcrumb', 'Education')}</span>
        </div>
        <div className="text-center mb-3">
          <span className="text-4xl block mb-1">🏆</span>
          <h1 className="text-xl font-bold">{t('certificates.title', 'Perwerde')}</h1>
          <p className="text-white/70 text-xs mt-0.5">{t('certificates.subtitle', 'Digital Education Platform')}</p>
        </div>
        {/* Score bar */}
        {selectedAccount && (
          <div className="flex justify-around bg-white/15 rounded-xl py-2.5 mx-2">
            <div className="text-center">
              <p className="text-lg font-bold text-yellow-300">{score}</p>
              <p className="text-[10px] text-white/70">{t('certificates.stats.points', 'Puan / Points')}</p>
            </div>
            <div className="w-px bg-white/30" />
            <div className="text-center">
              <p className="text-lg font-bold">{completedCount}</p>
              <p className="text-[10px] text-white/70">{t('certificates.stats.done', 'Qediyayî / Done')}</p>
            </div>
            <div className="w-px bg-white/30" />
            <div className="text-center">
              <p className="text-lg font-bold">{enrolledCount}</p>
              <p className="text-[10px] text-white/70">{t('certificates.stats.active', 'Aktîv / Active')}</p>
            </div>
          </div>
        )}
      </div>

      {/* No wallet */}
      {!selectedAccount && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 text-center">
          <span className="text-6xl mb-4">📚</span>
          <p className="font-bold text-lg mb-2">{t('certificates.noWallet.title', 'Perwerde')}</p>
          <p className="text-sm text-gray-400 mb-1">{t('certificates.noWallet.desc', 'Ji kerema xwe wallet ve girêbidin da ku bikaribin kursan bibînin û tev li wan bibin.')}</p>
          <p className="text-xs text-gray-500">{t('certificates.noWallet.en', 'Please connect your wallet to view and enroll in courses.')}</p>
        </div>
      )}

      {selectedAccount && (
        <>
          {/* Tabs */}
          <div className="flex gap-2 px-4 pt-3 pb-1">
            {TABS.map(tb => (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-colors ${
                  tab === tb.key ? 'bg-yellow-500 text-gray-900' : 'bg-gray-800 text-gray-400'
                }`}
              >
                {tb.label}
                {tb.count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tab === tb.key ? 'bg-gray-900 text-yellow-400' : 'bg-gray-600 text-white'}`}>
                    {tb.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mx-4 mt-2 bg-red-900/30 border border-red-700 rounded-xl p-3 text-xs text-red-300">
              ⚠️ {error}
            </div>
          )}

          {/* Course list */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 max-w-lg mx-auto w-full">
            {loading && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-3xl mb-3 animate-spin">⏳</div>
                <p className="text-sm">{t('certificates.loading', 'Tê barkirin... / Loading...')}</p>
              </div>
            )}

            {!loading && filteredCourses.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p className="text-4xl mb-3">{tab === 'completed' ? '🎓' : tab === 'enrolled' ? '📋' : '📭'}</p>
                <p className="text-sm">
                  {tab === 'courses' ? t('certificates.empty.courses', 'Kursek tune / No courses available')
                   : tab === 'enrolled' ? t('certificates.empty.enrolled', 'Tu tev li kursekê nebûyî / Not enrolled in any course')
                   : t('certificates.empty.completed', 'Kursek neqediyaye / No completed courses')}
                </p>
              </div>
            )}

            {!loading && filteredCourses.map(course => {
              const enrolled = isEnrolled(course.id);
              const completed = isCompleted(course.id);
              const enroll = getEnrollment(course.id);
              const isExpanded = expandedCourse?.id === course.id;

              return (
                <div key={course.id} className="bg-gray-900 rounded-2xl p-4">
                  <div
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => setExpandedCourse(isExpanded ? null : course)}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${
                      completed ? 'bg-green-900/50' : enrolled ? 'bg-blue-900/50' : 'bg-gray-800'
                    }`}>
                      {completed ? '✅' : enrolled ? '📖' : '📚'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-white truncate">{course.name}</p>
                      <p className="text-[11px] text-gray-500">Kurs #{course.id}</p>
                    </div>
                    {completed && enroll && (
                      <span className="text-[11px] font-bold text-white bg-green-700 px-2 py-0.5 rounded-full flex-shrink-0">
                        +{enroll.pointsEarned}
                      </span>
                    )}
                    <span className="text-gray-600 text-sm">{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-700 space-y-3">
                      {course.description && (
                        <p className="text-xs text-gray-300 leading-relaxed">{course.description}</p>
                      )}

                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-500">{t('certificates.course.status', 'Rewş / Status')}</span>
                          <span className={course.status === 'Active' ? 'text-green-400' : 'text-gray-400'}>
                            {course.status === 'Active' ? 'Aktîv' : 'Arşîv'}
                          </span>
                        </div>
                        {enrolled && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">{t('certificates.course.enrollment', 'Têketin / Enrolled')}</span>
                            <span className={completed ? 'text-green-400' : 'text-blue-400'}>
                              {completed ? 'Qediya ✅' : 'Aktîv 📖'}
                            </span>
                          </div>
                        )}
                        {completed && enroll && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">{t('certificates.course.points', 'Puan / Points')}</span>
                            <span className="text-yellow-400 font-bold">+{enroll.pointsEarned}</span>
                          </div>
                        )}
                      </div>

                      {course.contentLink && (
                        <a
                          href={course.contentLink.startsWith('http') ? course.contentLink : `https://ipfs.io/ipfs/${course.contentLink}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 bg-blue-900/30 border border-blue-700/40 rounded-xl py-2.5 text-xs text-blue-300 font-semibold"
                        >
                          📄 {t('certificates.course.openContent', 'Naveroka Kursê Veke / Open Course Content')}
                        </a>
                      )}

                      {!enrolled && course.status === 'Active' && (
                        <button
                          className="w-full bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                          disabled={enrolling === course.id}
                          onClick={() => handleEnroll(course.id)}
                        >
                          {enrolling === course.id ? (
                            <span className="animate-spin">⏳</span>
                          ) : (
                            <>📝 {t('certificates.enroll', 'Tev li Kursê / Enroll')}</>
                          )}
                        </button>
                      )}
                      {completed && (
                        <div className="flex items-center justify-center gap-2 bg-green-900/30 border border-green-700/40 rounded-xl py-2.5 text-xs text-green-300 font-semibold">
                          🎓 {t('certificates.completedBanner', 'Te ev kurs qedand! / You completed this course!')}
                        </div>
                      )}
                      {enrolled && !completed && (
                        <div className="flex items-center justify-center gap-2 bg-blue-900/30 border border-blue-700/40 rounded-xl py-2.5 text-xs text-blue-300 font-semibold">
                          📖 {t('certificates.enrolledBanner', 'Tu tev li vê kursê yî / You are enrolled')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="h-10" />
    </div>
  );
}
