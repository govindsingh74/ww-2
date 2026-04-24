import { Globe, Newspaper, Trophy, Layers, Zap, Swords } from 'lucide-react';

type Tab = 'map' | 'rankings' | 'news' | 'battles';

interface HeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  seedStatus: string;
  isSeeding: boolean;
}

export function Header({ activeTab, onTabChange, seedStatus, isSeeding }: HeaderProps) {
  return (
    <header className="bg-gray-950 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 bg-amber-500 rounded flex items-center justify-center">
            <Globe size={18} className="text-gray-950" />
          </div>
          <span className="text-white font-bold tracking-wide text-sm uppercase">
            World<span className="text-amber-400">Domination</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          <NavBtn icon={<Layers size={15} />} label="Map" active={activeTab === 'map'} onClick={() => onTabChange('map')} />
          <NavBtn icon={<Trophy size={15} />} label="Rankings" active={activeTab === 'rankings'} onClick={() => onTabChange('rankings')} />
          <NavBtn icon={<Swords size={15} />} label="Battles" active={activeTab === 'battles'} onClick={() => onTabChange('battles')} />
          <NavBtn icon={<Newspaper size={15} />} label="News" active={activeTab === 'news'} onClick={() => onTabChange('news')} />
        </nav>

        {/* Status */}
        <div className="flex items-center gap-2 shrink-0">
          {isSeeding && (
            <div className="flex items-center gap-1.5 text-amber-400 text-xs">
              <Zap size={13} className="animate-pulse" />
              <span>Initializing world…</span>
            </div>
          )}
          {!isSeeding && seedStatus && (
            <span className="text-gray-500 text-xs truncate max-w-48">{seedStatus}</span>
          )}
        </div>
      </div>
    </header>
  );
}

function NavBtn({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
        active
          ? 'bg-amber-500 text-gray-950'
          : 'text-gray-400 hover:text-white hover:bg-gray-800'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
