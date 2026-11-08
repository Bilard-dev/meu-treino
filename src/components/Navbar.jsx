import React from 'react';
import { Dumbbell, ClipboardList, Layers, TrendingUp, Scale, LogOut, Building2, CloudUpload, WifiOff } from 'lucide-react';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  currentProfile, 
  onSwitchProfile, 
  currentGym, 
  onOpenGymModal,
  pendingWorkoutsCount = 0,
  onTriggerSync,
  isOfflineMode = false
}) {
  const tabs = [
    { id: 'workout', label: 'Treinar', icon: Dumbbell },
    { id: 'templates', label: 'Fichas', icon: ClipboardList },
    { id: 'exercises', label: 'Exercícios', icon: Layers },
    { id: 'evolution', label: 'Evolução', icon: TrendingUp },
    { id: 'body', label: 'Medidas', icon: Scale },
  ];

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center font-bold text-slate-950 text-sm shadow-md shadow-emerald-500/20">
              {currentProfile?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <span className="text-xs text-slate-400 block leading-tight">Treinando como</span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white leading-tight">{currentProfile?.name}</span>
                {isOfflineMode && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.2 rounded-full font-semibold flex items-center gap-0.5" title="Modo Offline">
                    <WifiOff className="w-2.5 h-2.5" /> Offline
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão de Sincronização Pendente (se houver treinos salvos offline) */}
            {pendingWorkoutsCount > 0 && (
              <button
                onClick={onTriggerSync}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 rounded-xl text-[11px] text-emerald-300 font-bold active:scale-95 transition"
                title="Sincronizar treinos com a nuvem"
              >
                <CloudUpload className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
                <span>{pendingWorkoutsCount}</span>
              </button>
            )}

            {/* Seletor Rápido de Academia */}
            <button
              onClick={onOpenGymModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-xs text-slate-300 active:scale-95 transition"
              title="Mudar Academia"
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="max-w-[100px] truncate">{currentGym?.name || 'Academia'}</span>
            </button>

            {/* Trocar de Perfil */}
            <button
              onClick={onSwitchProfile}
              className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl active:scale-95 transition"
              title="Trocar Perfil / Sair"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Bottom Nav Bar (Fixa para celular - 5 abas) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/80 pb-safe">
        <div className="max-w-lg mx-auto flex items-center justify-around px-1 py-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center py-1 px-2 rounded-2xl transition-all ${
                  isActive
                    ? 'text-emerald-400 scale-105'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <div className={`p-1 rounded-xl transition ${isActive ? 'bg-emerald-500/10' : ''}`}>
                  <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                </div>
                <span className={`text-[10px] font-medium mt-0.5 ${isActive ? 'font-bold' : ''}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
