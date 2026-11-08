import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { User, Lock, Plus, ArrowRight, ShieldCheck, Dumbbell } from 'lucide-react';

export default function ProfileSelector({ onSelectProfile }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  
  // Modal de criação de novo perfil
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    // Carrega perfis do cache imediatamente para o caso de estar offline
    try {
      const cached = localStorage.getItem('meu_treino_profiles_cache');
      if (cached) {
        setProfiles(JSON.parse(cached));
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
    }
    loadProfiles();
  }, []);

  async function loadProfiles() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (data) {
        setProfiles(data);
        localStorage.setItem('meu_treino_profiles_cache', JSON.stringify(data));
      }
    } catch (err) {
      console.error('Erro ao buscar perfis:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleProfileClick(profile) {
    setSelectedProfile(profile);
    setPinInput('');
    setPinError('');
  }

  function handlePinSubmit(e) {
    e.preventDefault();
    if (selectedProfile.pin === pinInput.trim()) {
      localStorage.setItem('meu_treino_profile', JSON.stringify(selectedProfile));
      onSelectProfile(selectedProfile);
    } else {
      setPinError('Senha incorreta. Tente novamente.');
      setPinInput('');
    }
  }

  async function handleCreateProfile(e) {
    e.preventDefault();
    if (!newName.trim() || newPin.trim().length < 4) {
      setCreateError('Digite o nome e uma senha de pelo menos 4 números.');
      return;
    }

    setCreating(true);
    setCreateError('');

    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert([{ name: newName.trim(), pin: newPin.trim() }])
        .select()
        .single();

      if (error) throw error;

      // Adiciona academias padrão de exemplo
      await supabase.from('gyms').insert([
        { profile_id: data.id, name: 'Academia Principal' },
        { profile_id: data.id, name: 'Segunda Academia' }
      ]);

      // Perfis iniciam com a lista de exercícios zerada (o próprio usuário cria os seus)
      setShowCreateModal(false);
      setNewName('');
      setNewPin('');
      await loadProfiles();
      
      // Conecta diretamente no perfil criado
      localStorage.setItem('meu_treino_profile', JSON.stringify(data));
      onSelectProfile(data);
    } catch (err) {
      console.error('Erro ao criar perfil:', err);
      setCreateError('Erro ao criar perfil. Tente novamente.');
    } finally {
      setCreating(false);
    }
  }

  const avatarColors = [
    'from-emerald-500 to-teal-700',
    'from-blue-500 to-indigo-700',
    'from-purple-500 to-pink-700',
    'from-amber-500 to-orange-700'
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      {/* Top Brand */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Dumbbell className="w-7 h-7 text-slate-950 stroke-[2.5]" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Meu Treino</h1>
          <p className="text-xs text-slate-400">Simples, prático e sem frescura</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm">Carregando seus perfis...</p>
        </div>
      ) : selectedProfile ? (
        /* Tela de Digitação do PIN (estilo Netflix) */
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-3xl font-bold text-white shadow-lg mb-4">
            {selectedProfile.name.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-xl font-bold text-white mb-1">Olá, {selectedProfile.name}</h2>
          <p className="text-xs text-slate-400 mb-6">Digite sua senha numérica de 4 dígitos</p>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              autoFocus
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="••••"
              className="w-full text-center text-3xl tracking-widest bg-slate-950 border border-slate-700 rounded-2xl py-3 text-white focus:outline-none focus:border-emerald-500"
            />

            {pinError && (
              <p className="text-xs text-rose-400 font-medium">{pinError}</p>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl shadow-lg shadow-emerald-500/20 active:scale-95 transition flex items-center justify-center gap-2"
            >
              Entrar no Treino <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setSelectedProfile(null)}
              className="w-full py-2 text-xs text-slate-400 hover:text-white transition"
            >
              Trocar de Perfil
            </button>
          </form>
        </div>
      ) : (
        /* Lista de Perfis */
        <div className="w-full max-w-md">
          <h2 className="text-center text-lg font-semibold text-slate-300 mb-6">
            Quem está treinando hoje?
          </h2>

          <div className="grid grid-cols-2 gap-4 mb-6">
            {profiles.map((p, idx) => (
              <button
                key={p.id}
                onClick={() => handleProfileClick(p)}
                className="group bg-slate-900 border border-slate-800/80 hover:border-emerald-500/60 p-5 rounded-3xl flex flex-col items-center justify-center gap-3 transition-all active:scale-95 shadow-lg"
              >
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-tr ${avatarColors[idx % avatarColors.length]} flex items-center justify-center text-2xl font-black text-white shadow-md group-hover:scale-105 transition-transform`}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-semibold text-slate-200 group-hover:text-emerald-400 text-sm truncate max-w-full">
                  {p.name}
                </span>
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Toque para entrar
                </span>
              </button>
            ))}

            {/* Botão de Adicionar Perfil */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="border-2 border-dashed border-slate-800 hover:border-slate-600 p-5 rounded-3xl flex flex-col items-center justify-center gap-3 transition-all active:scale-95 text-slate-400 hover:text-slate-200"
            >
              <div className="w-16 h-16 rounded-2xl bg-slate-800/60 flex items-center justify-center">
                <Plus className="w-8 h-8 text-slate-400" />
              </div>
              <span className="font-medium text-sm">Novo Perfil</span>
              <span className="text-[11px] text-slate-600">Criar agora</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal para Criar Novo Perfil */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Criar Novo Perfil</h3>
            <p className="text-xs text-slate-400 mb-4">
              Crie o seu perfil ou o da sua namorada para salvar os treinos.
            </p>

            <form onSubmit={handleCreateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Seu Nome ou Apelido
                </label>
                <input
                  type="text"
                  placeholder="Ex: Tiago"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Senha Numérica (PIN de 4 números)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Ex: 1234"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm tracking-widest focus:outline-none focus:border-emerald-500"
                />
              </div>

              {createError && (
                <p className="text-xs text-rose-400">{createError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 text-xs font-medium text-slate-400 bg-slate-800 rounded-xl hover:bg-slate-700 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-3 text-xs font-bold text-slate-950 bg-emerald-500 rounded-xl hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20"
                >
                  {creating ? 'Criando...' : 'Salvar Perfil'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
