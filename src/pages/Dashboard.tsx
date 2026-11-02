import { Layers, Rocket, Sparkles, ArrowRight, Activity, BarChart3, CheckCircle2, CircleDot, FolderGit2 } from 'lucide-react';
import type { ProjectWithStatus } from '../lib/types';
import { ProjectCard } from '../components/ProjectCard';

export function Dashboard({
  items,
  onPublishProject,
  onGoProjects,
}: {
  items: ProjectWithStatus[];
  onPublishProject: () => void;
  onGoProjects: () => void;
}) {
  const total = items.length;
  const connected = items.filter((i) => i.status?.is_repo).length;
  const pending = items.filter((i) => (i.status?.pending ?? 0) > 0).length;
  const ok = total > 0 && connected === total;

  // Atividades recentes: último commit de cada projeto
  const activities = items
    .filter((i) => i.status?.last_commit_message)
    .slice(0, 4);

  // Anel de progresso (projetos conectados)
  const pct = total > 0 ? Math.round((connected / total) * 100) : 0;
  const R = 26;
  const C = 2 * Math.PI * R;

  const stats = [
    { label: 'Projetos cadastrados', value: total, color: 'bg-accent-400' },
    { label: 'Projetos conectados', value: connected, color: 'bg-emerald-400' },
    { label: 'Alterações pendentes', value: pending, color: 'bg-amber-400' },
  ];

  return (
    <div className="p-6 max-w-6xl">
      {/* Pílula de status do sistema */}
      <div
        className={`inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border mb-4 ${
          ok
            ? 'text-emerald-400 bg-emerald-400/5 border-emerald-400/20'
            : 'text-amber-400 bg-amber-400/5 border-amber-400/20'
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            ok ? 'bg-emerald-400' : 'bg-amber-400'
          } shadow-[0_0_8px_currentColor]`}
        />
        {ok ? 'Tudo funcionando perfeitamente!' : 'Existem itens para revisar nos seus projetos'}
      </div>

      {/* Hero de boas-vindas (identidade visual) */}
      <div className="relative overflow-hidden rounded-2xl border border-accent-500/25 bg-dark-850/60 p-7 mb-6 shadow-card-glow">
        <div className="absolute -top-24 -right-16 w-80 h-80 rounded-full bg-accent-600/25 blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 bottom-0 w-1/2 bg-[radial-gradient(ellipse_at_right,rgba(192,38,211,0.15),transparent_70%)] pointer-events-none" />
        <div className="relative">
          <h2 className="text-3xl font-bold text-white leading-tight">
            Bem-vindo ao{' '}
            <span className="brand-text">Elements Publisher!</span>
          </h2>
          <p className="text-sm text-gray-400 mt-2 mb-5">
            Publique, sincronize e mantenha seus projetos no GitHub — sem terminal.
          </p>
          <button
            onClick={onPublishProject}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent-gradient text-white text-sm font-semibold shadow-accent-glow hover:brightness-110 transition-all"
          >
            <Rocket size={15} />
            Publicar Atualizações
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* Seus projetos */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <Layers size={16} className="text-accent-400" />
          Seus Projetos
        </h3>
        <button
          onClick={onGoProjects}
          className="text-xs text-accent-400 hover:text-fuchsia-400 flex items-center gap-1 transition-colors"
        >
          Ver todos <ArrowRight size={12} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {items.length === 0 ? (
          <div className="col-span-3 bg-dark-850/70 border border-dark-700/60 rounded-2xl p-10 text-center">
            <Sparkles size={20} className="text-accent-400 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Nenhum projeto ainda — clique em <span className="text-accent-400">Ver todos</span> para cadastrar.</p>
          </div>
        ) : (
          items.map((data) => (
            <ProjectCard
              key={data.project.name}
              data={data}
              onPublish={onPublishProject}
            />
          ))
        )}
      </div>

      {/* Resumo + Atividades */}
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-2 bg-dark-850/70 border border-dark-700/60 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <BarChart3 size={15} className="text-accent-400" />
            Resumo do Sistema
          </h3>
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 space-y-3">
              {stats.map((s) => (
                <div key={s.label} className="flex items-center gap-2.5 text-sm">
                  <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                  <span className="text-gray-400 flex-1">{s.label}</span>
                  <span className="text-white font-semibold">{s.value}</span>
                </div>
              ))}
            </div>
            <div className="relative w-[72px] h-[72px] shrink-0">
              <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
                <circle cx="32" cy="32" r={R} fill="none" stroke="#1e1740" strokeWidth="6" />
                <circle
                  cx="32" cy="32" r={R} fill="none"
                  stroke={pct >= 100 ? '#34d399' : '#8b5cf6'}
                  strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={C - (C * pct) / 100}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-bold text-white">{pct}%</span>
                <span className="text-[9px] text-gray-500">{connected}/{total}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-3 bg-dark-850/70 border border-dark-700/60 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <Activity size={15} className="text-accent-400" />
            Últimas Atividades
          </h3>
          {activities.length === 0 ? (
            <p className="text-xs text-gray-500 py-4">Sem commits recentes nos seus projetos.</p>
          ) : (
            <div className="space-y-2.5">
              {activities.map((a) => (
                <div key={a.project.name} className="flex items-center gap-2.5 text-xs">
                  {a.status!.is_repo ? (
                    (a.status!.pending ?? 0) > 0 ? (
                      <CircleDot size={14} className="text-amber-400" />
                    ) : (
                      <CheckCircle2 size={14} className="text-emerald-400" />
                    )
                  ) : (
                    <FolderGit2 size={14} className="text-gray-500" />
                  )}
                  <span className="text-gray-200 font-medium w-32 truncate">{a.project.name}</span>
                  <span className="text-gray-500 flex-1 truncate">{a.status!.last_commit_message}</span>
                  <span className="text-gray-600 shrink-0">{a.status!.last_commit_date || ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
