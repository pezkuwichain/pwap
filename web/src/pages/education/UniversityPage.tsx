import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface Course {
  id: string;
  emoji: string;
  titleKu: string;
  title: string;
  instructor: string;
  duration: string;
  level: 'Destpêk' | 'Navîn' | 'Pêşketî';
  levelEn: 'Beginner' | 'Intermediate' | 'Advanced';
  enrolled: number;
  lessons: number;
  description: string;
  reward: string;
}

const COURSES: Course[] = [
  {
    id: '1', emoji: '🗣️',
    titleKu: 'Zimanê Kurdî - Kurmancî', title: 'Kurdish Language - Kurmanji',
    instructor: 'Prof. Berfîn Shêx', duration: '12 hefte / weeks',
    level: 'Destpêk', levelEn: 'Beginner', enrolled: 456, lessons: 48,
    description: 'Learn Kurmanji Kurdish from scratch. Covers alphabet, grammar, conversation, reading, and writing.',
    reward: 'NFT Certificate + 50 HEZ',
  },
  {
    id: '2', emoji: '🔗',
    titleKu: 'Blockchain 101', title: 'Blockchain 101',
    instructor: 'Dr. Azad Kurdo', duration: '8 hefte / weeks',
    level: 'Destpêk', levelEn: 'Beginner', enrolled: 312, lessons: 32,
    description: 'Introduction to blockchain technology. Learn about consensus, cryptography, smart contracts, and decentralized applications.',
    reward: 'NFT Certificate + 30 HEZ',
  },
  {
    id: '3', emoji: '💻',
    titleKu: 'Pêşvebirina Smart Contract', title: 'Smart Contract Development',
    instructor: 'Jîn Bakir', duration: '10 hefte / weeks',
    level: 'Navîn', levelEn: 'Intermediate', enrolled: 187, lessons: 40,
    description: 'Build smart contracts for the Pezkuwi network. Covers Solidity/Ink!, testing, deployment, and security best practices.',
    reward: 'NFT Certificate + 100 HEZ',
  },
  {
    id: '4', emoji: '📊',
    titleKu: 'Aboriya Dijîtal û DeFi', title: 'Digital Economics & DeFi',
    instructor: 'Prof. Serhat Demirtash', duration: '6 hefte / weeks',
    level: 'Navîn', levelEn: 'Intermediate', enrolled: 234, lessons: 24,
    description: 'Understand decentralized finance, tokenomics, yield farming, liquidity pools, and the Bereketli neighborhood economy model.',
    reward: 'NFT Certificate + 40 HEZ',
  },
  {
    id: '5', emoji: '🛡️',
    titleKu: 'Ewlehiya Sîber û Blockchain', title: 'Cyber Security & Blockchain',
    instructor: 'Kawa Zana', duration: '8 hefte / weeks',
    level: 'Pêşketî', levelEn: 'Advanced', enrolled: 98, lessons: 32,
    description: 'Advanced security topics including audit techniques, common vulnerabilities, formal verification, and incident response.',
    reward: 'NFT Certificate + 150 HEZ',
  },
  {
    id: '6', emoji: '🏛️',
    titleKu: 'Dîroka Kurdistanê - Dijîtal', title: 'History of Kurdistan - Digital',
    instructor: 'Prof. Dilovan Ehmed', duration: '10 hefte / weeks',
    level: 'Destpêk', levelEn: 'Beginner', enrolled: 567, lessons: 40,
    description: 'A comprehensive digital course on Kurdish history, culture, and the journey toward digital sovereignty and self-governance.',
    reward: 'NFT Certificate + 25 HEZ',
  },
];

const LEVEL_COLORS: Record<Course['level'], string> = {
  'Destpêk': '#16a34a',
  'Navîn':   '#2563eb',
  'Pêşketî': '#7c3aed',
};

export default function UniversityPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const totalStudents = COURSES.reduce((s, c) => s + c.enrolled, 0);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-green-700 px-4 pt-4 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="text-white/80 hover:text-white text-xl leading-none">←</button>
          <span className="text-sm text-white/70">{t('university.breadcrumb', 'Education')}</span>
        </div>
        <div className="text-center">
          <span className="text-5xl block mb-2">🎓</span>
          <h1 className="text-2xl font-bold">{t('university.title', 'Zanîngeha Dijîtal')}</h1>
          <p className="text-white/70 text-sm mt-0.5">{t('university.subtitle', 'Kurdistan Digital University')}</p>
        </div>
        <div className="flex justify-center gap-8 mt-4 bg-white/15 rounded-xl py-3 mx-4">
          <div className="text-center">
            <p className="text-xl font-bold">{COURSES.length}</p>
            <p className="text-[10px] text-white/70">{t('university.stats.courses', 'Kurs / Courses')}</p>
          </div>
          <div className="w-px bg-white/30" />
          <div className="text-center">
            <p className="text-xl font-bold">{totalStudents.toLocaleString()}</p>
            <p className="text-[10px] text-white/70">{t('university.stats.students', 'Xwendekar / Students')}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3 max-w-lg mx-auto">
        {COURSES.map(course => {
          const color = LEVEL_COLORS[course.level];
          return (
            <div key={course.id} className="bg-gray-900 rounded-2xl p-4">
              {/* Top row */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl">{course.emoji}</span>
                <span
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ color, backgroundColor: color + '22' }}
                >
                  {course.level} / {course.levelEn}
                </span>
              </div>

              <p className="font-bold text-white text-sm">{course.titleKu}</p>
              <p className="text-xs text-gray-400 mb-1">{course.title}</p>
              <p className="text-xs text-blue-400 mb-3">👨‍🏫 {course.instructor}</p>
              <p className="text-xs text-gray-300 leading-relaxed mb-3">{course.description}</p>

              {/* Meta */}
              <div className="flex justify-around bg-gray-800 rounded-xl py-2.5 mb-3">
                <div className="text-center">
                  <p className="text-base">📚</p>
                  <p className="text-[11px] text-gray-400">{course.lessons} ders</p>
                </div>
                <div className="text-center">
                  <p className="text-base">⏱️</p>
                  <p className="text-[11px] text-gray-400">{course.duration}</p>
                </div>
                <div className="text-center">
                  <p className="text-base">👥</p>
                  <p className="text-[11px] text-gray-400">{course.enrolled}</p>
                </div>
              </div>

              {/* Reward */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-gray-400">{t('university.reward', '🎁 Xelat / Reward:')}</span>
                <span className="text-xs font-semibold text-yellow-400">{course.reward}</span>
              </div>

              {/* Enroll button */}
              <button
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity active:opacity-80"
                style={{ backgroundColor: color }}
                onClick={() => navigate('/education/certificates')}
              >
                {t('university.enroll', 'Tomar bibe / Enroll')}
              </button>
            </div>
          );
        })}
      </div>
      <div className="h-10" />
    </div>
  );
}
