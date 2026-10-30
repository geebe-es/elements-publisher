import { useState, useEffect, useCallback } from 'react';
import { SetupWizard } from './components/SetupWizard';
import { Sidebar, type PageId } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { Publish } from './pages/Publish';
import { HistoryPage } from './pages/History';
import { BranchesPage } from './pages/Branches';
import { ReleasesPage } from './pages/Releases';
import { SettingsPage } from './pages/Settings';
import { LogsPage } from './pages/Logs';
import { GithubPage } from './pages/Github';
import { api } from './lib/api';
import type { Project, ProjectWithStatus } from './lib/types';

function Placeholder({ page }: { page: PageId }) {
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-white capitalize">{page}</h2>
      <p className="text-sm text-gray-500 mt-1">Esta seção será implementada em breve.</p>
    </div>
  );
}

function MainApp({ gitIdentityOk }: { gitIdentityOk: boolean }) {
  const [page, setPage] = useState<PageId>('dashboard');
  const [items, setItems] = useState<ProjectWithStatus[]>([]);
  const projects = items.map((i) => i.project);

  const load = useCallback(async () => {
    const list = await api.loadProjects();
    const base: ProjectWithStatus[] = list.map((p) => ({
      project: p,
      status: null,
      loading: true,
    }));
    setItems(base);

    // Consulta status sob demanda, um por um (sem varreduras contínuas)
    list.forEach(async (project: Project, idx: number) => {
      try {
        const status = await api.projectStatus(project.path);
        setItems((prev) => {
          const next = [...prev];
          next[idx] = { project, status, loading: false };
          return next;
        });
      } catch {
        setItems((prev) => {
          const next = [...prev];
          next[idx] = { project, status: null, loading: false };
          return next;
        });
      }
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex h-screen bg-dark-950">
      <Sidebar active={page} onChange={setPage} />
      <main className="flex-1 overflow-y-auto">
        {!gitIdentityOk && (
          <div className="mx-6 mt-4 bg-amber-400/10 border border-amber-400/30 text-amber-400 rounded-lg px-4 py-2 text-xs flex items-center gap-2">
            Identidade Git incompleta — configure nome e e-mail nas Configurações.
          </div>
        )}
        {page === 'dashboard' && (
          <Dashboard
            items={items}
            onPublishProject={() => setPage('publish')}
          />
        )}
        {page === 'projects' && <Projects items={items} onRefresh={load} />}
        {page === 'publish' && <Publish projects={projects} onDone={load} />}
        {page === 'history' && <HistoryPage projects={projects} />}
        {page === 'branches' && <BranchesPage projects={projects} />}
        {page === 'releases' && <ReleasesPage projects={projects} />}
        {page === 'github' && <GithubPage projects={projects} />}
        {page === 'settings' && <SettingsPage />}
        {page === 'logs' && <LogsPage />}
        {page !== 'dashboard' &&
          page !== 'projects' &&
          page !== 'publish' &&
          page !== 'history' &&
          page !== 'branches' &&
          page !== 'releases' &&
          page !== 'github' &&
          page !== 'settings' &&
          page !== 'logs' && <Placeholder page={page} />}
      </main>
    </div>
  );
}

export default function App() {
  const [identityOk, setIdentityOk] = useState<boolean | null>(null);

  useEffect(() => {
    Promise.all([
      api.getGitConfig('user.name').catch(() => ''),
      api.getGitConfig('user.email').catch(() => ''),
    ]).then(([name, email]) => setIdentityOk(Boolean(name && email)));
  }, []);

  if (identityOk === null) {
    return <div className="min-h-screen bg-dark-950" />;
  }

  if (!identityOk) {
    return (
      <div className="min-h-screen bg-dark-950">
        <SetupWizard />
      </div>
    );
  }

  return <MainApp gitIdentityOk={identityOk} />;
}
