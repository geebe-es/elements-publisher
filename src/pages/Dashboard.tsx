import { FolderGit2, GitBranch, CircleDot, CheckCircle2, Info } from 'lucide-react';
import type { ProjectWithStatus } from '../lib/types';
import { ProjectCard } from '../components/ProjectCard';

export function Dashboard({
  items,
  onPublishProject,
}: {
  items: ProjectWithStatus[];
  onPublishProject: (name: string) => void;
}) {
  const total = items.length;
  const connected = items.filter((i) => i.status?.is_repo).length;
  const pending = items.filter((i) => (i.status?.pending ?? 0) > 0).length;

  const stats = [
    { label: 'Projetos cadastrados', value: total, icon: FolderGit2, color: 'text-gray-300' },
    { label: 'Projetos conectados', value: connected, icon: CheckCircle2, color: 'text-emerald-400' },
    { label: 'Com alterações pendentes', value: pending, icon: CircleDot, color: 'text-amber-400' },
  ];

  return (
    <div className="p-6 max-w-6xl">
      <h2 className="text-xl font-bold text-white mb-1">Dashboard</h2>
      <p className="text-sm text-gray-500 mb-6">Visão geral dos seus projetos</p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-dark-900 border border-dark-800 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-dark-800 border border-dark-700 flex items-center justify-center">
              <Icon size={18} className={color} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white leading-none">{value}</p>
              <p className="text-[11px] text-gray-500 mt-1">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-1.5">
        <GitBranch size={14} className="text-gray-500" />
        Meus projetos
      </h3>

      {items.length === 0 ? (
        <div className="bg-dark-900 border border-dark-800 rounded-xl p-10 text-center">
          <Info size={20} className="text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Nenhum projeto cadastrado ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {items.map((data) => (
            <ProjectCard
              key={data.project.name}
              data={data}
              onPublish={() => onPublishProject(data.project.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
