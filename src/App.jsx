import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import ProfileSelector from './components/ProfileSelector';
import Navbar from './components/Navbar';
import ActiveWorkout from './components/ActiveWorkout';
import WorkoutTemplates from './components/WorkoutTemplates';
import ExerciseLibrary from './components/ExerciseLibrary';
import Evolution from './components/Evolution';
import BodyMetrics from './components/BodyMetrics';
import GymManager from './components/GymManager';
import { 
  getCachedData, 
  setCachedData, 
  isOnline, 
  syncPendingWorkouts, 
  getPendingWorkouts 
} from './offlineStorage';
import { WifiOff, CloudUpload, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [currentProfile, setCurrentProfile] = useState(() => {
    const saved = localStorage.getItem('meu_treino_profile');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState('workout'); // 'workout' | 'templates' | 'exercises' | 'evolution' | 'body'
  const [gyms, setGyms] = useState([]);
  const [currentGym, setCurrentGym] = useState(null);
  const [showGymModal, setShowGymModal] = useState(false);

  // Estado de conexão e sincronização offline
  const [isOfflineMode, setIsOfflineMode] = useState(!isOnline());
  const [pendingWorkoutsCount, setPendingWorkoutsCount] = useState(() => getPendingWorkouts().length);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState('');

  // Monitora conexão com a internet em tempo real
  useEffect(() => {
    function handleOnline() {
      setIsOfflineMode(false);
      triggerSync();
    }

    function handleOffline() {
      setIsOfflineMode(true);
    }

    function handleQueueUpdated(e) {
      setPendingWorkoutsCount(e.detail?.count ?? getPendingWorkouts().length);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('meu-treino-offline-updated', handleQueueUpdated);

    // Se abrir o app com internet e tiver treinos na fila, sincroniza automaticamente
    if (isOnline()) {
      triggerSync();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('meu-treino-offline-updated', handleQueueUpdated);
    };
  }, []);

  async function triggerSync() {
    const pending = getPendingWorkouts();
    if (pending.length === 0) return;

    setSyncing(true);
    try {
      const count = await syncPendingWorkouts(supabase);
      if (count > 0) {
        setSyncSuccessMsg(`${count} treino(s) sincronizado(s) com a nuvem! ☁️`);
        setPendingWorkoutsCount(getPendingWorkouts().length);
        setTimeout(() => setSyncSuccessMsg(''), 4000);
      }
    } catch (e) {
      console.error('Erro na sincronização automática:', e);
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    if (currentProfile) {
      loadGyms();
    }
  }, [currentProfile?.id]);

  async function loadGyms() {
    // 1. Carrega imediatamente do cache local para funcionar offline instantaneamente
    const cachedGyms = getCachedData(`meu_treino_gyms_${currentProfile.id}`);
    if (cachedGyms && cachedGyms.length > 0) {
      setGyms(cachedGyms);
      const savedGymId = localStorage.getItem(`meu_treino_gym_${currentProfile.id}`);
      const found = cachedGyms.find(g => g.id === savedGymId);
      setCurrentGym(found || cachedGyms[0]);
    }

    // 2. Busca dados atualizados no Supabase se houver conexão
    try {
      const { data, error } = await supabase
        .from('gyms')
        .select('*')
        .eq('profile_id', currentProfile.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setGyms(data);
        setCachedData(`meu_treino_gyms_${currentProfile.id}`, data);
        const savedGymId = localStorage.getItem(`meu_treino_gym_${currentProfile.id}`);
        const found = data.find(g => g.id === savedGymId);
        setCurrentGym(found || data[0]);
      } else if (!cachedGyms || cachedGyms.length === 0) {
        // Se por algum motivo não tiver academia, cria uma padrão
        const { data: newGym } = await supabase
          .from('gyms')
          .insert([{ profile_id: currentProfile.id, name: 'Minha Academia' }])
          .select()
          .single();
        if (newGym) {
          setGyms([newGym]);
          setCurrentGym(newGym);
          setCachedData(`meu_treino_gyms_${currentProfile.id}`, [newGym]);
        }
      }
    } catch (err) {
      console.warn('Aviso: Não foi possível sincronizar academias agora (usando dados locais):', err);
    }
  }

  function handleSelectGym(gym) {
    setCurrentGym(gym);
    if (currentProfile) {
      localStorage.setItem(`meu_treino_gym_${currentProfile.id}`, gym.id);
    }
  }

  function handleSwitchProfile() {
    localStorage.removeItem('meu_treino_profile');
    setCurrentProfile(null);
  }

  // Se não estiver logado em nenhum perfil, mostra a tela "estilo Netflix"
  if (!currentProfile) {
    return <ProfileSelector onSelectProfile={setCurrentProfile} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Barra de Notificação de Status Offline / Sincronização */}
      {isOfflineMode && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-3 py-1.5 flex items-center justify-between text-[11px] text-amber-300">
          <div className="flex items-center gap-1.5 max-w-lg mx-auto w-full">
            <WifiOff className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span>
              <strong>Modo Offline ativo:</strong> Seus treinos serão salvos no celular e enviados quando a internet voltar.
            </span>
          </div>
        </div>
      )}

      {syncing && (
        <div className="bg-emerald-500/20 border-b border-emerald-500/40 px-3 py-1.5 flex items-center justify-center gap-1.5 text-[11px] text-emerald-300 font-bold animate-pulse">
          <CloudUpload className="w-3.5 h-3.5" />
          <span>Sincronizando treinos pendentes com a nuvem...</span>
        </div>
      )}

      {syncSuccessMsg && (
        <div className="bg-emerald-500 text-slate-950 font-bold px-3 py-1.5 flex items-center justify-center gap-1.5 text-xs shadow-md">
          <CheckCircle2 className="w-4 h-4 stroke-[3]" />
          <span>{syncSuccessMsg}</span>
        </div>
      )}

      {/* Barra de Navegação */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentProfile={currentProfile}
        onSwitchProfile={handleSwitchProfile}
        currentGym={currentGym}
        onOpenGymModal={() => setShowGymModal(true)}
        pendingWorkoutsCount={pendingWorkoutsCount}
        onTriggerSync={triggerSync}
        isOfflineMode={isOfflineMode}
      />

      {/* Conteúdo Principal de cada Aba */}
      <main className="flex-1">
        {activeTab === 'workout' && (
          <ActiveWorkout
            profile={currentProfile}
            gyms={gyms}
            currentGym={currentGym}
            onSelectGym={handleSelectGym}
            onWorkoutFinished={() => setActiveTab('evolution')}
          />
        )}

        {activeTab === 'templates' && (
          <WorkoutTemplates profile={currentProfile} />
        )}

        {activeTab === 'exercises' && (
          <ExerciseLibrary profile={currentProfile} />
        )}

        {activeTab === 'evolution' && (
          <Evolution 
            profile={currentProfile} 
            gyms={gyms} 
            pendingWorkoutsCount={pendingWorkoutsCount}
            onTriggerSync={triggerSync}
          />
        )}

        {activeTab === 'body' && (
          <BodyMetrics profile={currentProfile} />
        )}
      </main>

      {/* Modal de Gerenciamento de Academias */}
      {showGymModal && (
        <GymManager
          profileId={currentProfile.id}
          gyms={gyms}
          currentGym={currentGym}
          onSelectGym={handleSelectGym}
          onGymsUpdated={loadGyms}
          onClose={() => setShowGymModal(false)}
        />
      )}
    </div>
  );
}
