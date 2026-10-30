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
} from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'projects', label: 'Meus Projetos', icon: FolderGit2 },
  { id: 'publish', label: 'Publicar', icon: UploadCloud },
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
    <aside className="w-56 shrink-0 h-screen border-r border-dark-800 bg-dark-900 flex flex-col">
      <div className="px-4 py-5 border-b border-dark-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center shadow-lg shadow-accent-glow">
            <UploadCloud size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white leading-tight">Elements Publisher</h1>
            <p className="text-[10px] text-gray-500">Gerenciador de projetos GitHub</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              active === id
                ? 'bg-accent-500/10 text-accent-500 font-medium'
                : 'text-gray-400 hover:text-gray-200 hover:bg-dark-800'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-dark-800">
        <p className="text-[10px] text-gray-600">v0.1.0 — Windows</p>
      </div>
    </aside>
  );
}
