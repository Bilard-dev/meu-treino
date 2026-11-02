import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import confetti from 'canvas-confetti';
import { 
  Play, Plus, Check, Trash2, Clock, Dumbbell, 
  ChevronDown, ChevronUp, Flame, Sparkles, AlertCircle, ArrowLeft,
  ShieldCheck, CheckCircle2, X, Lock, Unlock, CheckCircle, Edit2
} from 'lucide-react';

export default function ActiveWorkout({ 
  profile, 
  gyms, 
  currentGym, 
  onSelectGym, 
  onWorkoutFinished 
}) {
  const [templates, setTemplates] = useState([]);
  const [allExercises, setAllExercises] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estado do treino ativo
  const [activeSession, setActiveSession] = useState(null);
  const [sessionExercises, setSessionExercises] = useState([]);
  const [lastLoads, setLastLoads] = useState({}); // { [exerciseId]: { weight, reps, gymName, date } }
  const [saving, setSaving] = useState(false);
  const [showFinishConfirmModal, setShowFinishConfirmModal] = useState(false);
  const [restoredNotice, setRestoredNotice] = useState(false);

  // Chave única para salvar o rascunho no celular (Anti-Perda)
  const DRAFT_STORAGE_KEY = `meu_treino_active_draft_${profile.id}`;

  // Modais de suporte
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseMuscle, setNewExerciseMuscle] = useState('Peito');
  const [newExerciseType, setNewExerciseType] = useState('machine');

  // Modal de Edição de Exercício Durante o Treino
  const [editingExerciseIdx, setEditingExerciseIdx] = useState(null);
  const [editExName, setEditExName] = useState('');
  const [editExMuscle, setEditExMuscle] = useState('Peito');
  const [editExType, setEditExType] = useState('machine');
  const [savingEditEx, setSavingEditEx] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, [profile.id, currentGym?.id]);

  // Recupera treino em andamento se o app fechou (Anti-Perda)
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed.activeSession && parsed.sessionExercises && parsed.sessionExercises.length > 0) {
          setActiveSession(parsed.activeSession);
          setSessionExercises(parsed.sessionExercises);
          setRestoredNotice(true);
          setTimeout(() => setRestoredNotice(false), 5000);

          // Recarrega cargas anteriores dos exercícios restaurados
          parsed.sessionExercises.forEach(item => {
            if (item.exercise) fetchLastLoad(item.exercise);
          });
        }
      }
    } catch (e) {
      console.error('Erro ao restaurar rascunho do treino:', e);
    }
  }, [profile.id]);

  // Salva automaticamente a cada alteração em tempo real (Anti-Perda)
  useEffect(() => {
    try {
      if (activeSession) {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
          activeSession,
          sessionExercises,
          savedAt: new Date().toISOString()
        }));
      } else {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    } catch (e) {
      console.error('Erro ao salvar rascunho automático:', e);
    }
  }, [activeSession, sessionExercises]);

  async function loadInitialData() {
    setLoading(true);
    try {
      // 1. Carregar fichas base do usuário
      const { data: tpls } = await supabase
        .from('workout_templates')
        .select(`
          id, name,
          workout_template_exercises (
            id, exercise_id, order_index, default_sets, default_rest_seconds,
            exercises (id, name, muscle_group, type)
          )
        `)
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: true });

      setTemplates(tpls || []);

      // 2. Carregar todos os exercícios para o caso de querer adicionar avulso
      const { data: exs } = await supabase
        .from('exercises')
        .select('*')
        .eq('profile_id', profile.id)
        .order('name', { ascending: true });

      setAllExercises(exs || []);
    } catch (err) {
      console.error('Erro ao carregar dados do treino:', err);
    } finally {
      setLoading(false);
    }
  }

  // Buscar última carga inteligente para um exercício
  async function fetchLastLoad(exercise) {
    if (!exercise) return;
    try {
      let query = supabase
        .from('workout_sets')
        .select(`
          weight_kg, reps, created_at,
          workout_sessions!inner(gym_id, gyms(name))
        `)
        .eq('exercise_id', exercise.id)
        .order('created_at', { ascending: false })
        .limit(1);

      // Se for MÁQUINA, filtra apenas pela academia atual!
      if (exercise.type === 'machine' && currentGym?.id) {
        query = query.eq('workout_sessions.gym_id', currentGym.id);
      }

      const { data } = await query;
      if (data && data.length > 0) {
        const item = data[0];
        setLastLoads(prev => ({
          ...prev,
          [exercise.id]: {
            weight: item.weight_kg,
            reps: item.reps,
            gymName: item.workout_sessions?.gyms?.name || 'Geral'
          }
        }));
      }
    } catch (err) {
      console.error('Erro ao buscar última carga:', err);
    }
  }

  // Iniciar um treino baseado em uma ficha (template)
  async function handleStartTemplate(tpl) {
    const exercisesList = (tpl.workout_template_exercises || [])
      .sort((a, b) => a.order_index - b.order_index)
      .map(item => {
        const sets = [];
        const numSets = item.default_sets || 4;
        const isBodyweight = item.exercises?.type === 'bodyweight';
        for (let i = 1; i <= numSets; i++) {
          sets.push({
            set_number: i,
            weight_kg: isBodyweight ? '0' : '',
            reps: '',
            rest_seconds: item.default_rest_seconds || 60,
            completed: false
          });
        }
        return {
          exercise: item.exercises,
          sets: sets,
          isMinimized: false
        };
      });

    const sessionObj = {
      name: tpl.name,
      template_id: tpl.id,
      startedAt: new Date().toISOString(),
    };

    setActiveSession(sessionObj);
    setSessionExercises(exercisesList);

    // Carrega a última carga de cada exercício
    exercisesList.forEach(item => {
      if (item.exercise) fetchLastLoad(item.exercise);
    });
  }

  // Iniciar um treino livre (sem ficha prévia)
  function handleStartFreeWorkout() {
    setActiveSession({
      name: 'Treino Livre',
      template_id: null,
      startedAt: new Date().toISOString(),
    });
    setSessionExercises([]);
  }

  // Adicionar exercício na sessão atual
  function handleAddExerciseToSession(exercise) {
    fetchLastLoad(exercise);
    const isBodyweight = exercise.type === 'bodyweight';
    setSessionExercises(prev => [
      ...prev,
      {
        exercise: exercise,
        sets: [
          { set_number: 1, weight_kg: isBodyweight ? '0' : '', reps: '', rest_seconds: 60, completed: false },
          { set_number: 2, weight_kg: isBodyweight ? '0' : '', reps: '', rest_seconds: 60, completed: false },
          { set_number: 3, weight_kg: isBodyweight ? '0' : '', reps: '', rest_seconds: 60, completed: false },
        ],
        isMinimized: false
      }
    ]);
    setShowAddExerciseModal(false);
  }

  // Alternar minimizar/expandir exercício
  function handleToggleMinimizeExercise(exIndex) {
    setSessionExercises(prev => {
      const updated = [...prev];
      updated[exIndex].isMinimized = !updated[exIndex].isMinimized;
      return updated;
    });
  }

  // Abrir modal para editar exercício no meio do treino
  function handleOpenEditExercise(exIdx) {
    const ex = sessionExercises[exIdx].exercise;
    setEditingExerciseIdx(exIdx);
    setEditExName(ex.name);
    setEditExMuscle(ex.muscle_group);
    setEditExType(ex.type || 'free_weight');
  }

  // Salvar edição do exercício no banco e atualizar sessão ativa
  async function handleSaveExerciseEdit(e) {
    e.preventDefault();
    if (!editExName.trim() || editingExerciseIdx === null) return;
    setSavingEditEx(true);
    const targetEx = sessionExercises[editingExerciseIdx].exercise;

    try {
      const { data, error } = await supabase
        .from('exercises')
        .update({
          name: editExName.trim(),
          muscle_group: editExMuscle,
          type: editExType
        })
        .eq('id', targetEx.id)
        .select()
        .single();

      if (error) throw error;

      // Atualiza na sessão ativa
      setSessionExercises(prev => {
        const copy = [...prev];
        copy[editingExerciseIdx].exercise = data;
        return copy;
      });

      // Atualiza na lista de todos os exercícios
      setAllExercises(prev => prev.map(e => e.id === data.id ? data : e));

      // Recalcula última carga com a nova tipagem
      fetchLastLoad(data);
      setEditingExerciseIdx(null);
    } catch (err) {
      console.error('Erro ao editar exercício:', err);
      alert('Erro ao atualizar exercício.');
    } finally {
      setSavingEditEx(false);
    }
  }

  // Criar novo exercício do zero e já adicionar na sessão
  async function handleCreateNewExercise(e) {
    e.preventDefault();
    if (!newExerciseName.trim()) return;

    try {
      const { data, error } = await supabase
        .from('exercises')
        .insert([{
          profile_id: profile.id,
          name: newExerciseName.trim(),
          muscle_group: newExerciseMuscle,
          type: newExerciseType
        }])
        .select()
        .single();

      if (error) throw error;
      setAllExercises(prev => [...prev, data]);
      handleAddExerciseToSession(data);
      setNewExerciseName('');
    } catch (err) {
      console.error('Erro ao criar exercício:', err);
    }
  }

  // Alterar dados de uma série com Auto-Completar Inteligente
  function handleUpdateSet(exIndex, setIndex, field, value) {
    setSessionExercises(prev => {
      const updated = [...prev];
      const ex = updated[exIndex].exercise;
      const isBodyweight = ex?.type === 'bodyweight';
      const currentSet = { ...updated[exIndex].sets[setIndex], [field]: value };

      // Se for alteração direta de 'completed'
      if (field === 'completed') {
        currentSet.completed = value;
      } 
      // Auto-marca como "Feito" quando digitar repetições
      else if (field === 'reps' && value && String(value).trim() !== '') {
        // Se for peso corporal, não exige peso obrigatoriamente
        if (isBodyweight || currentSet.weight_kg !== '') {
          currentSet.completed = true;
        }
      }
      // Auto-marca como "Feito" quando preencher peso (se reps já preenchidas)
      else if (field === 'weight_kg' && value && String(value).trim() !== '' && currentSet.reps !== '') {
        currentSet.completed = true;
      }

      updated[exIndex].sets[setIndex] = currentSet;
      return updated;
    });
  }

  // Adicionar mais uma série para um exercício
  function handleAddSet(exIndex) {
    setSessionExercises(prev => {
      const updated = [...prev];
      const currentSets = updated[exIndex].sets;
      const ex = updated[exIndex].exercise;
      const isBodyweight = ex?.type === 'bodyweight';
      const lastSet = currentSets[currentSets.length - 1];
      currentSets.push({
        set_number: currentSets.length + 1,
        weight_kg: lastSet ? lastSet.weight_kg : (isBodyweight ? '0' : ''),
        reps: lastSet ? lastSet.reps : '',
        rest_seconds: lastSet ? lastSet.rest_seconds : 60,
        completed: false
      });
      return updated;
    });
  }

  // Remover uma série
  function handleRemoveSet(exIndex, setIndex) {
    setSessionExercises(prev => {
      const updated = [...prev];
      updated[exIndex].sets.splice(setIndex, 1);
      // Reordena numeração
      updated[exIndex].sets.forEach((s, idx) => s.set_number = idx + 1);
      return updated;
    });
  }

  // Remover exercício da sessão do dia
  function handleRemoveExerciseFromSession(exIndex) {
    setSessionExercises(prev => prev.filter((_, idx) => idx !== exIndex));
  }

  // Cancelar treino em andamento
  function handleCancelWorkout() {
    if (confirm('Deseja realmente cancelar este treino? Todas as anotações deste treino serão apagadas.')) {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setActiveSession(null);
      setSessionExercises([]);
    }
  }

  // Finalizar e Salvar Treino
  async function handleConfirmFinishWorkout() {
    if (sessionExercises.length === 0) {
      alert('Adicione pelo menos um exercício ao treino.');
      return;
    }

    setSaving(true);
    try {
      // 1. Cria a sessão no banco
      const { data: sessionData, error: sessionError } = await supabase
        .from('workout_sessions')
        .insert([{
          profile_id: profile.id,
          gym_id: currentGym?.id || null,
          template_id: activeSession.template_id,
          name: activeSession.name,
          date: new Date().toISOString()
        }])
        .select()
        .single();

      if (sessionError) throw sessionError;

      // 2. Cria as séries registradas
      const setsToInsert = [];
      sessionExercises.forEach(item => {
        item.sets.forEach(s => {
          // Salva séries concluídas ou que tenham reps informadas
          if (s.completed || s.reps) {
            setsToInsert.push({
              session_id: sessionData.id,
              exercise_id: item.exercise.id,
              set_number: s.set_number,
              weight_kg: parseFloat(s.weight_kg) || 0,
              reps: parseInt(s.reps, 10) || 0,
              rest_seconds: parseInt(s.rest_seconds, 10) || 60,
            });
          }
        });
      });

      if (setsToInsert.length > 0) {
        const { error: setsError } = await supabase
          .from('workout_sets')
          .insert(setsToInsert);
        if (setsError) throw setsError;
      }

      // Solta confetes festivos!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      // Limpa o rascunho salvo no celular
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setActiveSession(null);
      setSessionExercises([]);
      setShowFinishConfirmModal(false);

      if (onWorkoutFinished) onWorkoutFinished();
    } catch (err) {
      console.error('Erro ao finalizar treino:', err);
      alert('Erro ao salvar treino. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  // Contagem de séries preenchidas para o resumo da confirmação
  const totalSetsCount = sessionExercises.reduce((acc, curr) => acc + curr.sets.length, 0);
  const completedSetsCount = sessionExercises.reduce((acc, curr) => {
    return acc + curr.sets.filter(s => s.completed || (s.weight_kg && s.reps)).length;
  }, 0);

  /* ------------------- RENDER: TELA DE ESCOLHA DE TREINO ------------------- */
  if (!activeSession) {
    return (
      <div className="pb-24 pt-2 px-4 max-w-lg mx-auto">
        {/* Banner do Dia */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-800 rounded-3xl p-5 mb-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 mb-1">
            <Flame className="w-4 h-4 fill-emerald-400" /> HORA DO FOCO
          </div>
          <h2 className="text-xl font-black text-white mb-1">Pronto para treinar?</h2>
          <p className="text-xs text-slate-400 mb-4">
            Academia selecionada: <strong className="text-slate-200">{currentGym?.name || 'Nenhuma selecionada'}</strong>
          </p>

          <button
            onClick={handleStartFreeWorkout}
            className="w-full py-3 bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 rounded-2xl text-xs font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition"
          >
            <Dumbbell className="w-4 h-4 text-emerald-400" />
            Iniciar Treino Livre (sem ficha)
          </button>
        </div>

        {/* Fichas Prontas */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200">Suas Fichas de Treino</h3>
          <span className="text-xs text-slate-500">{templates.length} cadastradas</span>
        </div>

        {loading ? (
          <div className="py-10 text-center text-slate-500 text-xs">Carregando fichas...</div>
        ) : templates.length === 0 ? (
          <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-3xl p-6 text-center">
            <p className="text-xs text-slate-400 mb-3">Você ainda não criou nenhuma ficha.</p>
            <p className="text-[11px] text-slate-500">
              Vá na aba <strong>"Fichas"</strong> abaixo para montar seu Treino A, B, C, ou use o botão de Treino Livre acima.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map(tpl => {
              const count = tpl.workout_template_exercises?.length || 0;
              return (
                <div
                  key={tpl.id}
                  className="bg-slate-900 border border-slate-800/80 hover:border-emerald-500/50 rounded-3xl p-4 shadow-lg transition"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-bold text-white text-base">{tpl.name}</h4>
                      <span className="text-xs text-slate-400">{count} exercícios</span>
                    </div>

                    <button
                      onClick={() => handleStartTemplate(tpl)}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" /> Iniciar
                    </button>
                  </div>

                  {/* Prévia dos exercícios */}
                  {count > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/50">
                      {tpl.workout_template_exercises.slice(0, 4).map(e => (
                        <span key={e.id} className="text-[10px] bg-slate-950 px-2 py-0.5 rounded-lg text-slate-400 border border-slate-800">
                          {e.exercises?.name}
                        </span>
                      ))}
                      {count > 4 && (
                        <span className="text-[10px] text-slate-500 px-1 py-0.5">+{count - 4} mais</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  /* ------------------- RENDER: TREINO EM ANDAMENTO ------------------- */
  return (
    <div className="pb-28 pt-2 px-3 max-w-lg mx-auto">
      {/* Alerta Visual de Recuperação Automática */}
      {restoredNotice && (
        <div className="mb-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-2 text-xs text-emerald-300 animate-in fade-in">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span><strong>Treino recuperado!</strong> Continuando exatamente de onde você parou.</span>
        </div>
      )}

      {/* Top Header do Treino Ativo */}
      <div className="sticky top-14 z-30 bg-slate-950/95 backdrop-blur-md py-2.5 border-b border-slate-800/80 flex items-center justify-between mb-4">
        <div>
          <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            TREINANDO AGORA
          </span>
          <h2 className="text-base font-black text-white leading-tight">{activeSession.name}</h2>
          <span className="text-[11px] text-slate-400 leading-tight block">{currentGym?.name || 'Academia'}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Botão Cancelar Discreto */}
          <button
            onClick={handleCancelWorkout}
            className="text-[11px] text-slate-500 hover:text-rose-400 px-2 py-1.5 rounded-xl border border-transparent hover:border-slate-800 transition"
          >
            Cancelar
          </button>

          {/* Botão Finalizar Seguro no Topo */}
          <button
            onClick={() => setShowFinishConfirmModal(true)}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 shadow-md shadow-emerald-500/20 active:scale-95 transition"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" /> Finalizar
          </button>
        </div>
      </div>

      {/* Lista de Exercícios do Treino */}
      <div className="space-y-4">
        {sessionExercises.map((item, exIdx) => {
          const ex = item.exercise;
          const last = lastLoads[ex?.id];
          const isMachine = ex?.type === 'machine';
          const isBodyweight = ex?.type === 'bodyweight';
          const isMinimized = item.isMinimized;

          // Resumo das séries feitas para o card minimizado
          const completedSets = item.sets.filter(s => s.completed);
          const maxWeight = completedSets.reduce((max, s) => Math.max(max, parseFloat(s.weight_kg) || 0), 0);

          return (
            <div
              key={exIdx}
              className={`bg-slate-900 border transition-all rounded-3xl shadow-lg ${
                isMinimized 
                  ? 'border-emerald-500/30 p-3.5 bg-slate-900/90' 
                  : 'border-slate-800 p-4'
              }`}
            >
              {/* Header do Exercício com NUMERADOR e BOTÃO EDITAR */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {/* Numerador de Exercício */}
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                      Exercício {exIdx + 1} de {sessionExercises.length}
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {ex?.muscle_group}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      isMachine 
                        ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' 
                        : isBodyweight
                        ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                        : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                    }`}>
                      {isMachine ? '⚙️ Máquina / Polia' : isBodyweight ? '🤸 Peso Corporal' : '🏋️ Peso Livre'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base">{ex?.name}</h3>
                    {/* Botão de Editar Exercício Durante o Treino */}
                    <button
                      onClick={() => handleOpenEditExercise(exIdx)}
                      className="p-1 text-slate-500 hover:text-emerald-400 rounded-lg hover:bg-slate-800 transition"
                      title="Editar nome ou tipo deste exercício"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {isMinimized && (
                      <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 ml-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Feito ({completedSets.length} séries {isBodyweight ? '' : `• máx ${maxWeight}kg`})
                      </span>
                    )}
                  </div>

                  {/* Inteligência de Carga Anterior */}
                  {!isMinimized && (
                    last ? (
                      <p className="text-[11px] text-emerald-400 font-medium mt-0.5 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Última vez {isMachine ? `nesta academia (${currentGym?.name})` : 'geral'}:{' '}
                        <strong>{last.weight} kg × {last.reps} reps</strong>
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Primeiro registro deste exercício {isMachine ? 'nesta academia' : ''}
                      </p>
                    )
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {/* Botão de Minimizar / Expandir */}
                  <button
                    onClick={() => handleToggleMinimizeExercise(exIdx)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800/80 transition"
                    title={isMinimized ? 'Expandir exercício' : 'Minimizar exercício'}
                  >
                    {isMinimized ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </button>

                  {!isMinimized && (
                    <button
                      onClick={() => handleRemoveExerciseFromSession(exIdx)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition"
                      title="Tirar exercício deste treino"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* CORPO EXPANDIDO (Tabela de Séries + Botão Concluir Exercício) */}
              {!isMinimized && (
                <div className="space-y-1.5 mt-3 pt-2 border-t border-slate-800/60">
                  <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 pb-0.5">
                    <div className="col-span-2 text-center">Série</div>
                    <div className="col-span-3 text-center">{isBodyweight ? '+Kg (opt)' : 'Kg'}</div>
                    <div className="col-span-3 text-center">Reps</div>
                    <div className="col-span-2 text-center">Desc.</div>
                    <div className="col-span-2 text-center">Feito</div>
                  </div>

                  {item.sets.map((set, setIdx) => (
                    <React.Fragment key={setIdx}>
                      {set.completed ? (
                        /* LINHA MINIMIZADA E BLOQUEADA (quando a série está Feita) */
                        <div className="grid grid-cols-12 gap-2 items-center py-1.5 px-2.5 rounded-xl border bg-emerald-950/20 border-emerald-500/30 text-emerald-300 transition-all">
                          <div className="col-span-2 text-center font-bold text-xs text-emerald-400/80 flex items-center justify-center gap-1">
                            #{set.set_number}
                          </div>

                          <div className="col-span-3 text-center">
                            <span className="text-xs font-black text-white">
                              {isBodyweight && (set.weight_kg === '0' || !set.weight_kg) ? 'Corpo' : `${set.weight_kg}kg`}
                            </span>
                          </div>

                          <div className="col-span-3 text-center">
                            <span className="text-xs font-black text-white">{set.reps}</span>
                            <span className="text-[10px] text-slate-400 font-normal ml-0.5">reps</span>
                          </div>

                          <div className="col-span-2 text-center text-[10px] text-slate-400">
                            {set.rest_seconds || 60}s
                          </div>

                          <div className="col-span-2 flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => handleUpdateSet(exIdx, setIdx, 'completed', false)}
                              className="w-7 h-7 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center shadow-sm shadow-emerald-500/30 active:scale-90 transition"
                              title="Toque para destravar e editar"
                            >
                              <Check className="w-4 h-4 stroke-[3]" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* LINHA NORMAL EM EDIÇÃO */
                        <div className="grid grid-cols-12 gap-2 items-center p-1.5 rounded-2xl border bg-slate-950 border-slate-800 transition-all">
                          <div className="col-span-2 text-center font-bold text-xs text-slate-400">
                            #{set.set_number}
                          </div>

                          <div className="col-span-3">
                            <input
                              type="number"
                              inputMode="decimal"
                              placeholder={isBodyweight ? "0" : "0"}
                              value={set.weight_kg}
                              onChange={(e) => handleUpdateSet(exIdx, setIdx, 'weight_kg', e.target.value)}
                              className="w-full text-center bg-slate-900 border border-slate-700 rounded-xl py-2 text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div className="col-span-3">
                            <input
                              type="number"
                              inputMode="numeric"
                              placeholder="0"
                              value={set.reps}
                              onChange={(e) => handleUpdateSet(exIdx, setIdx, 'reps', e.target.value)}
                              className="w-full text-center bg-slate-900 border border-slate-700 rounded-xl py-2 text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div className="col-span-2">
                            <input
                              type="number"
                              inputMode="numeric"
                              placeholder="60"
                              value={set.rest_seconds}
                              onChange={(e) => handleUpdateSet(exIdx, setIdx, 'rest_seconds', e.target.value)}
                              className="w-full text-center bg-slate-900 border border-slate-700 rounded-xl py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div className="col-span-2 flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => handleUpdateSet(exIdx, setIdx, 'completed', true)}
                              className="w-9 h-9 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition active:scale-90"
                              title="Marcar série como feita"
                            >
                              <Check className="w-5 h-5 stroke-[2.5]" />
                            </button>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  ))}

                  {/* Ações do Exercício: Adicionar Série e Finalizar Exercício */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleAddSet(exIdx)}
                      className="py-2.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-950/60 border border-dashed border-slate-800 rounded-xl flex items-center justify-center gap-1 transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar Série
                    </button>

                    {/* BOTÃO FINALIZAR EXERCÍCIO (Minimiza o card completo) */}
                    <button
                      type="button"
                      onClick={() => handleToggleMinimizeExercise(exIdx)}
                      className="py-2.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Concluir Exercício
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Botão de Adicionar Exercício Avulso neste Treino */}
        <button
          onClick={() => setShowAddExerciseModal(true)}
          className="w-full py-3.5 border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-3xl text-xs font-bold text-slate-300 flex items-center justify-center gap-2 active:scale-95 transition"
        >
          <Plus className="w-4 h-4 text-emerald-400" />
          Adicionar Exercício ao Treino
        </button>

        {/* Botão Secundário de Finalizar no Final da Página */}
        <div className="pt-4 pb-2">
          <button
            onClick={() => setShowFinishConfirmModal(true)}
            className="w-full py-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-emerald-500/40 rounded-2xl text-xs font-bold text-emerald-400 flex items-center justify-center gap-2 transition active:scale-95 shadow-lg"
          >
            <CheckCircle2 className="w-4 h-4" /> Finalizar Treino do Dia
          </button>
        </div>
      </div>

      {/* Modal: Editar Exercício no Meio do Treino */}
      {editingExerciseIdx !== null && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Editar Exercício</h3>
            <p className="text-xs text-slate-400 mb-4">Altere o nome, músculo ou categoria deste exercício.</p>

            <form onSubmit={handleSaveExerciseEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nome</label>
                <input
                  type="text"
                  value={editExName}
                  onChange={e => setEditExName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Músculo</label>
                <select
                  value={editExMuscle}
                  onChange={e => setEditExMuscle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="Peito">Peito</option>
                  <option value="Costas">Costas</option>
                  <option value="Pernas">Pernas</option>
                  <option value="Ombros">Ombros</option>
                  <option value="Bíceps">Bíceps</option>
                  <option value="Tríceps">Tríceps</option>
                  <option value="Abdômen">Abdômen</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Categoria de Carga</label>
                <select
                  value={editExType}
                  onChange={e => setEditExType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="machine">⚙️ Máquina / Polia (lembra por academia)</option>
                  <option value="free_weight">🏋️ Peso Livre / Halter (geral)</option>
                  <option value="bodyweight">🤸 Peso Corporal / Calistenia (ex: paralela)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingExerciseIdx(null)}
                  className="flex-1 py-2.5 text-xs text-slate-400 bg-slate-800 rounded-xl hover:bg-slate-700 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEditEx}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-950 bg-emerald-500 rounded-xl hover:bg-emerald-400 transition"
                >
                  {savingEditEx ? 'Salvando...' : 'Salvar Alteração'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação para Finalizar o Treino */}
      {showFinishConfirmModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
              <Check className="w-7 h-7 stroke-[3]" />
            </div>

            <h3 className="text-lg font-bold text-white mb-1">Finalizar este treino?</h3>
            <p className="text-xs text-slate-400 mb-4">
              Você completou <strong className="text-white">{completedSetsCount}</strong> de <strong className="text-slate-300">{totalSetsCount}</strong> séries anotadas.
            </p>

            <div className="space-y-2">
              <button
                type="button"
                disabled={saving}
                onClick={handleConfirmFinishWorkout}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black rounded-2xl text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition flex items-center justify-center gap-2"
              >
                {saving ? 'Salvando no banco...' : 'Sim, Salvar Treino'}
              </button>

              <button
                type="button"
                onClick={() => setShowFinishConfirmModal(false)}
                className="w-full py-2.5 text-xs text-slate-400 hover:text-white rounded-xl transition"
              >
                Voltar e Continuar Treinando
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Escolher ou Criar Exercício Avulso */}
      {showAddExerciseModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-white">Adicionar Exercício</h3>
              <button onClick={() => setShowAddExerciseModal(false)} className="p-1.5 text-slate-400 hover:text-white rounded-xl">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">Escolha um existente ou cadastre um novo na hora.</p>

            {/* Criar Rápido */}
            <form onSubmit={handleCreateNewExercise} className="mb-4 bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 block">Cadastrar Novo:</span>
              <input
                type="text"
                placeholder="Nome (ex: Paralelas na Barra)"
                value={newExerciseName}
                onChange={e => setNewExerciseName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newExerciseMuscle}
                  onChange={e => setNewExerciseMuscle(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="Peito">Peito</option>
                  <option value="Costas">Costas</option>
                  <option value="Pernas">Pernas</option>
                  <option value="Ombros">Ombros</option>
                  <option value="Bíceps">Bíceps</option>
                  <option value="Tríceps">Tríceps</option>
                  <option value="Abdômen">Abdômen</option>
                </select>

                <select
                  value={newExerciseType}
                  onChange={e => setNewExerciseType(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="machine">⚙️ Máquina / Polia</option>
                  <option value="free_weight">🏋️ Peso Livre</option>
                  <option value="bodyweight">🤸 Peso Corporal</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={!newExerciseName.trim()}
                className="w-full py-2 bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs"
              >
                Criar e Adicionar
              </button>
            </form>

            {/* Lista dos Existentes */}
            <span className="text-[11px] font-bold text-slate-400 mb-2 block">Ou escolha da lista:</span>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {allExercises.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => handleAddExerciseToSession(ex)}
                  className="w-full text-left p-3 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-800/80 flex items-center justify-between text-xs text-slate-200 transition"
                >
                  <span className="font-semibold">{ex.name}</span>
                  <span className="text-[10px] text-slate-500">
                    {ex.muscle_group} • {ex.type === 'machine' ? 'Máquina' : ex.type === 'bodyweight' ? 'Corporal' : 'Livre'}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowAddExerciseModal(false)}
              className="mt-4 w-full py-2.5 bg-slate-800 rounded-xl text-xs text-slate-400 hover:text-white"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
