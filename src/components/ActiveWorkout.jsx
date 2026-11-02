import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import confetti from 'canvas-confetti';
import { 
  Play, Plus, Check, Trash2, Clock, Dumbbell, 
  ChevronDown, Flame, Sparkles, AlertCircle, ArrowLeft 
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

  // Modais de suporte
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseMuscle, setNewExerciseMuscle] = useState('Peito');
  const [newExerciseType, setNewExerciseType] = useState('machine');

  useEffect(() => {
    loadInitialData();
  }, [profile.id, currentGym?.id]);

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
        for (let i = 1; i <= numSets; i++) {
          sets.push({
            set_number: i,
            weight_kg: '',
            reps: '',
            rest_seconds: item.default_rest_seconds || 60,
            completed: false
          });
        }
        return {
          exercise: item.exercises,
          sets: sets
        };
      });

    setActiveSession({
      name: tpl.name,
      template_id: tpl.id,
      startedAt: new Date(),
    });
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
      startedAt: new Date(),
    });
    setSessionExercises([]);
  }

  // Adicionar exercício na sessão atual
  function handleAddExerciseToSession(exercise) {
    fetchLastLoad(exercise);
    setSessionExercises(prev => [
      ...prev,
      {
        exercise: exercise,
        sets: [
          { set_number: 1, weight_kg: '', reps: '', rest_seconds: 60, completed: false },
          { set_number: 2, weight_kg: '', reps: '', rest_seconds: 60, completed: false },
          { set_number: 3, weight_kg: '', reps: '', rest_seconds: 60, completed: false },
        ]
      }
    ]);
    setShowAddExerciseModal(false);
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

  // Alterar dados de uma série
  function handleUpdateSet(exIndex, setIndex, field, value) {
    setSessionExercises(prev => {
      const updated = [...prev];
      updated[exIndex].sets[setIndex][field] = value;
      return updated;
    });
  }

  // Adicionar mais uma série para um exercício
  function handleAddSet(exIndex) {
    setSessionExercises(prev => {
      const updated = [...prev];
      const currentSets = updated[exIndex].sets;
      const lastSet = currentSets[currentSets.length - 1];
      currentSets.push({
        set_number: currentSets.length + 1,
        weight_kg: lastSet ? lastSet.weight_kg : '',
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

  // Finalizar e Salvar Treino
  async function handleFinishWorkout() {
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
          // Salva séries concluídas ou que tenham peso/reps informados
          if (s.completed || (s.weight_kg && s.reps)) {
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

      setActiveSession(null);
      setSessionExercises([]);
      if (onWorkoutFinished) onWorkoutFinished();
    } catch (err) {
      console.error('Erro ao finalizar treino:', err);
      alert('Erro ao salvar treino. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

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
    <div className="pb-32 pt-2 px-3 max-w-lg mx-auto">
      {/* Top Header do Treino Ativo */}
      <div className="sticky top-14 z-30 bg-slate-950/95 backdrop-blur-md py-2 border-b border-slate-800/80 flex items-center justify-between mb-4">
        <div>
          <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            TREINO EM ANDAMENTO
          </span>
          <h2 className="text-lg font-black text-white">{activeSession.name}</h2>
          <span className="text-xs text-slate-400">Na {currentGym?.name || 'Academia'}</span>
        </div>

        <button
          onClick={() => {
            if (confirm('Deseja realmente cancelar este treino? Os dados não serão salvos.')) {
              setActiveSession(null);
            }
          }}
          className="text-xs text-rose-400 hover:text-rose-300 px-2.5 py-1.5 rounded-xl border border-rose-500/20 bg-rose-500/5 active:scale-95 transition"
        >
          Cancelar
        </button>
      </div>

      {/* Lista de Exercícios do Treino */}
      <div className="space-y-4">
        {sessionExercises.map((item, exIdx) => {
          const ex = item.exercise;
          const last = lastLoads[ex.id];
          const isMachine = ex.type === 'machine';

          return (
            <div
              key={exIdx}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-lg"
            >
              {/* Header do Exercício */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {ex.muscle_group}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      isMachine 
                        ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' 
                        : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                    }`}>
                      {isMachine ? '⚙️ Máquina / Polia' : '🏋️ Peso Livre'}
                    </span>
                  </div>
                  <h3 className="font-bold text-white text-base">{ex.name}</h3>

                  {/* Inteligência de Carga Anterior */}
                  {last ? (
                    <p className="text-[11px] text-emerald-400 font-medium mt-0.5 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Última vez {isMachine ? `nesta academia (${currentGym?.name})` : 'geral'}:{' '}
                      <strong>{last.weight} kg × {last.reps} reps</strong>
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Primeiro registro deste exercício {isMachine ? 'nesta academia' : ''}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => handleRemoveExerciseFromSession(exIdx)}
                  className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition"
                  title="Tirar exercício deste treino"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Tabela de Séries */}
              <div className="space-y-2 mt-3">
                <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                  <div className="col-span-2 text-center">Série</div>
                  <div className="col-span-3 text-center">Kg</div>
                  <div className="col-span-3 text-center">Reps</div>
                  <div className="col-span-2 text-center">Desc.</div>
                  <div className="col-span-2 text-center">Feito</div>
                </div>

                {item.sets.map((set, setIdx) => (
                  <div
                    key={setIdx}
                    className={`grid grid-cols-12 gap-2 items-center p-1.5 rounded-2xl border transition ${
                      set.completed 
                        ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200' 
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    {/* Número da série */}
                    <div className="col-span-2 text-center font-bold text-xs text-slate-400">
                      #{set.set_number}
                    </div>

                    {/* Carga (Kg) */}
                    <div className="col-span-3">
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder="0"
                        value={set.weight_kg}
                        onChange={(e) => handleUpdateSet(exIdx, setIdx, 'weight_kg', e.target.value)}
                        className="w-full text-center bg-slate-900 border border-slate-700 rounded-xl py-2 text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    {/* Repetições */}
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

                    {/* Descanso */}
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

                    {/* Botão de Concluído */}
                    <div className="col-span-2 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => handleUpdateSet(exIdx, setIdx, 'completed', !set.completed)}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition active:scale-90 ${
                          set.completed
                            ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <Check className="w-5 h-5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Botão de Adicionar mais uma série */}
                <button
                  type="button"
                  onClick={() => handleAddSet(exIdx)}
                  className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-950/40 border border-dashed border-slate-800 rounded-xl flex items-center justify-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Série
                </button>
              </div>
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
      </div>

      {/* Barra Fixa Inferior: Finalizar Treino */}
      <div className="fixed bottom-16 left-0 right-0 p-3 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent z-30">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleFinishWorkout}
            disabled={saving}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-emerald-500/30 active:scale-95 transition flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5 stroke-[3]" />
            {saving ? 'Salvando Treino...' : 'FINALIZAR TREINO'}
          </button>
        </div>
      </div>

      {/* Modal: Escolher ou Criar Exercício Avulso */}
      {showAddExerciseModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <h3 className="text-base font-bold text-white mb-2">Adicionar Exercício</h3>
            <p className="text-xs text-slate-400 mb-4">Escolha um existente ou cadastre um novo na hora.</p>

            {/* Criar Rápido */}
            <form onSubmit={handleCreateNewExercise} className="mb-4 bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 block">Cadastrar Novo:</span>
              <input
                type="text"
                placeholder="Nome (ex: Elevação Frontal)"
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
                  <span className="text-[10px] text-slate-500">{ex.muscle_group} • {ex.type === 'machine' ? 'Máquina' : 'Livre'}</span>
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
