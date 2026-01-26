import { cn } from '@/lib/utils';
import { useTelegram } from '../hooks/useTelegram';
import {
  Megaphone,
  MessageCircle,
  Gift,
  Smartphone,
  Wallet
} from 'lucide-react';

export type Section = 'announcements' | 'forum' | 'rewards' | 'apk' | 'wallet';

interface SidebarItem {
  id: Section;
  icon: React.ReactNode;
  label: string;
  emoji: string;
}

const sidebarItems: SidebarItem[] = [
  {
    id: 'announcements',
    icon: <Megaphone className="w-5 h-5" />,
    label: 'Duyurular',
    emoji: '📢'
  },
  {
    id: 'forum',
    icon: <MessageCircle className="w-5 h-5" />,
    label: 'Forum',
    emoji: '💬'
  },
  {
    id: 'rewards',
    icon: <Gift className="w-5 h-5" />,
    label: 'Rewards',
    emoji: '🎁'
  },
  {
    id: 'apk',
    icon: <Smartphone className="w-5 h-5" />,
    label: 'APK',
    emoji: '📱'
  },
  {
    id: 'wallet',
    icon: <Wallet className="w-5 h-5" />,
    label: 'Wallet',
    emoji: '💳'
  },
];

interface SidebarProps {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
}

export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const { hapticSelection, isTelegram } = useTelegram();

  const handleClick = (section: Section) => {
    if (isTelegram) {
      hapticSelection();
    }
    onSectionChange(section);
  };

  return (
    <div className="w-16 bg-gray-900 border-r border-gray-800 flex flex-col items-center py-3 gap-1">
      {/* Logo at top */}
      <div className="mb-4 p-2">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
          <span className="text-white font-bold text-lg">P</span>
        </div>
      </div>

      {/* Divider */}
      <div className="w-8 h-0.5 bg-gray-700 rounded-full mb-3" />

      {/* Navigation items */}
      <nav className="flex flex-col items-center gap-2 flex-1">
        {sidebarItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleClick(item.id)}
            className={cn(
              'relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200',
              'hover:rounded-xl hover:bg-green-600',
              activeSection === item.id
                ? 'bg-green-600 rounded-xl'
                : 'bg-gray-800 hover:bg-gray-700'
            )}
            title={item.label}
          >
            {/* Active indicator */}
            <div
              className={cn(
                'absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-1 rounded-r-full bg-white transition-all duration-200',
                activeSection === item.id ? 'h-10' : 'h-0 group-hover:h-5'
              )}
            />

            {/* Icon */}
            <span className={cn(
              'text-gray-400 transition-colors duration-200',
              activeSection === item.id ? 'text-white' : 'hover:text-white'
            )}>
              {item.icon}
            </span>
          </button>
        ))}
      </nav>

      {/* Bottom section - could add settings or user avatar here */}
      <div className="mt-auto pt-3 border-t border-gray-800">
        <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
          <span className="text-xs text-gray-500">v1</span>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
