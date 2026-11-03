import { useState, useEffect } from 'react';
import { Terminal, User, Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

interface CheckItem {
  label: string;
  ok: boolean | null;
}

export function SetupWizard() {
  const [gitInstalled, setGitInstalled] = useState<boolean | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [currentName, setCurrentName] = useState('');
  const [currentEmail, setCurrentEmail] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.checkGitInstallation().then(setGitInstalled);
    // Lê configurações existentes (não sobrescreve sem autorização)
    Promise.all([
      api.getGitConfig('user.name').catch(() => ''),
      api.getGitConfig('user.email').catch(() => ''),
    ]).then(([name, email]) => {
      setCurrentName(name);
      setCurrentEmail(email);
      // Pré-preenche os campos apenas se estiverem vazios
      setUserName(name);
      setUserEmail(email);
      setLoaded(true);
    });
  }, []);

  const save = async () => {
    if (!userName.trim() || !userEmail.trim()) return;
    setSaving(true);
    try {
      const nameRes = await api.setGitConfig('user.name', userName.trim());
      const emailRes = await api.setGitConfig('user.email', userEmail.trim());
      if (nameRes.success && emailRes.success) {
        setSaved(true);
      }
    } finally {
      setSaving(false);
    }
  };

  const checks: CheckItem[] = [
    { label: 'Git instalado no sistema', ok: gitInstalled },
    { label: 'Nome do desenvolvedor configurado', ok: currentName ? true : false },
    { label: 'E-mail do desenvolvedor configurado', ok: currentEmail ? true : false },
  ];

  return (
    <div className="flex items-center justify-center min-h-screen bg-dark-950 p-6">
      <div className="w-full max-w-lg bg-dark-900 border border-dark-800 rounded-2xl p-8 shadow-2xl shadow-accent-glow">
        <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
          <Terminal className="text-accent-500" size={24} /> Elements Publisher
        </h1>
        <p className="text-sm text-gray-500 mb-6">Assistente de configuração inicial</p>

        <div className="space-y-2.5 mb-6">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-3 p-3 bg-dark-850 border border-dark-800 rounded-lg">
              {c.ok === null ? (
                <Loader2 className="text-gray-500 animate-spin" size={18} />
              ) : c.ok ? (
                <CheckCircle className="text-emerald-500" size={18} />
              ) : (
                <AlertCircle className="text-amber-500" size={18} />
              )}
              <span className="text-gray-200 text-sm">{c.label}</span>
              {c.ok && c.label.includes('Nome') && currentName && (
                <span className="ml-auto text-xs text-gray-500">{currentName}</span>
              )}
              {c.ok && c.label.includes('E-mail') && currentEmail && (
                <span className="ml-auto text-xs text-gray-500">{currentEmail}</span>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Nome do Desenvolvedor</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 text-gray-500" size={18} />
              <input
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                disabled={!loaded}
                className="w-full bg-dark-950 border border-dark-700 rounded-lg py-2 pl-10 pr-4 text-white text-sm focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500 outline-none transition-all"
                placeholder="Ex: Gabriel"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">E-mail do Git</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 text-gray-500" size={18} />
              <input
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                disabled={!loaded}
                className="w-full bg-dark-950 border border-dark-700 rounded-lg py-2 pl-10 pr-4 text-white text-sm focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500 outline-none transition-all"
                placeholder="Ex: gabriel.silvarodrigues258@gmail.com"
              />
            </div>
          </div>

          <button
            onClick={save}
            disabled={saving || !userName.trim() || !userEmail.trim()}
            className="w-full mt-2 py-2.5 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-sm transition-all shadow-lg shadow-accent-glow"
          >
            {saving ? 'Salvando...' : saved ? '✓ Configurações salvas' : 'Confirmar e Salvar Configurações'}
          </button>
        </div>
      </div>
    </div>
  );
}
