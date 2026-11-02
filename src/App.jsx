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

export default function App() {
  const [currentProfile, setCurrentProfile] = useState(() => {
    const saved = localStorage.getItem('meu_treino_profile');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState('workout'); // 'workout' | 'templates' | 'exercises' | 'evolution' | 'body'
  const [gyms, setGyms] = useState([]);
  const [currentGym, setCurrentGym] = useState(null);
  const [showGymModal, setShowGymModal] = useState(false);

  useEffect(() => {
    if (currentProfile) {
      loadGyms();
    }
  }, [currentProfile?.id]);

  async function loadGyms() {
    try {
      const { data, error } = await supabase
        .from('gyms')
        .select('*')
        .eq('profile_id', currentProfile.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setGyms(data || []);

      if (data && data.length > 0) {
        // Recupera a última academia usada ou usa a primeira
        const savedGymId = localStorage.getItem(`meu_treino_gym_${currentProfile.id}`);
        const found = data.find(g => g.id === savedGymId);
        setCurrentGym(found || data[0]);
      } else {
        // Se por algum motivo não tiver academia, cria uma padrão
        const { data: newGym } = await supabase
          .from('gyms')
          .insert([{ profile_id: currentProfile.id, name: 'Minha Academia' }])
          .select()
          .single();
        if (newGym) {
          setGyms([newGym]);
          setCurrentGym(newGym);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar academias:', err);
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
      {/* Barra de Navegação */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentProfile={currentProfile}
        onSwitchProfile={handleSwitchProfile}
        currentGym={currentGym}
        onOpenGymModal={() => setShowGymModal(true)}
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
          <Evolution profile={currentProfile} gyms={gyms} />
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
