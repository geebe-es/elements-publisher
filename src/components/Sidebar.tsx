import {
  LayoutDashboard,
  FolderGit2,
  UploadCloud,
  History,
  GitBranch,
  Tag,
  Github,
  Settings,
  ScrollText,
  ChevronDown,
} from 'lucide-react';
import logo from '../assets/logo.png';

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'projects', label: 'Meus Projetos', icon: FolderGit2 },
  { id: 'publish', label: 'Publicar Atualizações', icon: UploadCloud },
  { id: 'history', label: 'Histórico', icon: History },
  { id: 'branches', label: 'Branches', icon: GitBranch },
  { id: 'releases', label: 'Releases', icon: Tag },
  { id: 'github', label: 'Integração GitHub', icon: Github },
  { id: 'settings', label: 'Configurações', icon: Settings },
  { id: 'logs', label: 'Logs e Diagnóstico', icon: ScrollText },
] as const;

export type PageId = (typeof NAV_ITEMS)[number]['id'];

export function Sidebar({ active, onChange }: { active: PageId; onChange: (id: PageId) => void }) {
  return (
    <aside className="w-60 shrink-0 h-full border-r border-accent-700/25 bg-dark-900/70 backdrop-blur flex flex-col">
      {/* Marca — logo + nome em gradiente (identidade visual) */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="Elements" className="w-10 h-10 drop-shadow-[0_0_12px_rgba(139,92,246,0.6)]" />
          <div>
            <h1 className="text-lg font-bold leading-none text-white tracking-tight">Elements</h1>
            <p className="brand-text text-lg font-bold leading-tight tracking-tight">Publisher</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
              active === id
                ? 'bg-accent-gradient text-white font-semibold shadow-accent-glow-sm'
                : 'text-gray-400 hover:text-gray-100 hover:bg-dark-800/70'
            }`}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>

      {/* Perfil do desenvolvedor */}
      <div className="px-3 pb-3">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-dark-850/80 border border-accent-700/30">
          <div className="w-10 h-10 rounded-full bg-accent-gradient flex items-center justify-center text-white font-bold shadow-accent-glow-sm">
            G
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">Gabriel</p>
            <p className="text-[10px] text-gray-500">Desenvolvedor</p>
          </div>
          <ChevronDown size={14} className="text-gray-500" />
        </div>
        <p className="text-[10px] text-gray-600 text-center mt-2">v{__APP_VERSION__} — Windows</p>
      </div>
    </aside>
  );
}
