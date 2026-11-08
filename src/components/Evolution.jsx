import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  TrendingUp, Calendar, Building2, Dumbbell, ChevronRight, 
  ChevronDown, Trash2, Award, Copy, Check, WifiOff, CloudUpload 
} from 'lucide-react';
import { 
  getCachedData, 
  setCachedData, 
  getPendingWorkouts, 
  removePendingWorkout 
} from '../offlineStorage';

// Agrupa as séries por exercício mantendo estritamente a ordem que foram executadas
function groupSetsByExercise(sets) {
  const exerciseMap = new Map();
  (sets || []).forEach(st => {
    const exId = st.exercises?.id || st.exercise_id || 'unknown';
    if (!exerciseMap.has(exId)) {
      exerciseMap.set(exId, {
        exercise: st.exercises || { name: 'Exercício', type: 'free_weight' },
        sets: []
      });
    }
    exerciseMap.get(exId).sets.push(st);
  });
  // Garante que dentro de cada exercício as séries fiquem na ordem 1, 2, 3...
  for (const item of exerciseMap.values()) {
    item.sets.sort((a, b) => a.set_number - b.set_number);
  }
  return Array.from(exerciseMap.values());
}

export default function Evolution({ profile, gyms, pendingWorkoutsCount = 0, onTriggerSync }) {
  const [activeSubTab, setActiveSubTab] = useState('history'); // 'history' | 'charts'
  const [sessions, setSessions] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);

  // Histórico expandido
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [sessionSets, setSessionSets] = useState({}); // { [sessionId]: [ { exercise, set_number, weight_kg, reps } ] }
  const [copiedSessionId, setCopiedSessionId] = useState(null);

  // Gráficos
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [chartData, setChartData] = useState([]);
  const [loadingChart, setLoadingChart] = useState(false);

  useEffect(() => {
    loadSessions();
    loadExercises();
  }, [profile.id]);

  useEffect(() => {
    if (selectedExerciseId) {
      loadExerciseEvolution(selectedExerciseId);
    }
  }, [selectedExerciseId]);

  async function loadSessions() {
    // 1. Carrega do cache local e treinos pendentes offline imediatamente
    const cached = getCachedData(`meu_treino_sessions_${profile.id}`, []);
    const pending = getPendingWorkouts().filter(p => p.session.profile_id === profile.id);

    const pendingSetsMap = {};
    const pendingFormatted = pending.map(p => {
      pendingSetsMap[p.session.id] = p.sets;
      const gFound = gyms?.find(g => g.id === p.session.gym_id);
      return {
        ...p.session,
        gyms: gFound || { name: 'Academia' },
        is_pending: true
      };
    });

    setSessionSets(prev => ({ ...prev, ...pendingSetsMap }));
    const combinedInitial = [...pendingFormatted, ...cached];
    if (combinedInitial.length > 0) {
      setSessions(combinedInitial);
      setLoading(false);
    }

    // 2. Busca do Supabase se online
    try {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select(`
          id, name, date, created_at,
          gym_id,
          gyms (name)
        `)
        .eq('profile_id', profile.id)
        .order('date', { ascending: false });

      if (error) throw error;
      if (data) {
        setCachedData(`meu_treino_sessions_${profile.id}`, data);
        setSessions([...pendingFormatted, ...data]);
      }
    } catch (err) {
      console.warn('Aviso: Operando em modo offline no histórico:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadExercises() {
    // Carrega do cache primeiro
    const cachedExs = getCachedData(`meu_treino_exercises_${profile.id}`);
    if (cachedExs && cachedExs.length > 0) {
      setExercises(cachedExs);
      if (!selectedExerciseId) setSelectedExerciseId(cachedExs[0].id);
    }

    try {
      const { data } = await supabase
        .from('exercises')
        .select('*')
        .eq('profile_id', profile.id)
        .order('name', { ascending: true });

      if (data) {
        setExercises(data);
        setCachedData(`meu_treino_exercises_${profile.id}`, data);
        if (data.length > 0 && !selectedExerciseId) {
          setSelectedExerciseId(data[0].id);
        }
      }
    } catch (err) {
      console.warn('Aviso: Operando em modo offline para carregar exercícios:', err);
    }
  }

  async function toggleExpandSession(sessionId) {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      return;
    }

    setExpandedSessionId(sessionId);
    if (!sessionSets[sessionId]) {
      try {
        const { data } = await supabase
          .from('workout_sets')
          .select(`
            id, set_number, weight_kg, reps, created_at,
            exercises (id, name, muscle_group, type)
          `)
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        setSessionSets(prev => ({
          ...prev,
          [sessionId]: data || []
        }));
      } catch (err) {
        console.error('Erro ao buscar detalhes da sessão:', err);
      }
    }
  }

  async function handleDeleteSession(sessionId, e) {
    e.stopPropagation();
    if (!confirm('Deseja excluir este treino do seu histórico?')) return;
    try {
      if (String(sessionId).startsWith('offline_')) {
        removePendingWorkout(sessionId);
      } else {
        await supabase.from('workout_sessions').delete().eq('id', sessionId);
      }
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (err) {
      console.error('Erro ao excluir treino:', err);
    }
  }

  function handleCopySessionReport(session, sets, e) {
    e.stopPropagation();
    const dateStr = new Date(session.date).toLocaleDateString('pt-BR');
    const gymStr = session.gyms?.name || 'Academia';
    let text = `🏋️ RELATÓRIO DE TREINO - Meu Treino\n`;
    text += `📅 Data: ${dateStr} • Academia: ${gymStr}\n`;
    text += `💪 Treino: ${session.name}\n\n`;

    const orderedExerciseList = groupSetsByExercise(sets);

    orderedExerciseList.forEach((item, idx) => {
      const ex = item.exercise;
      const type = ex.type === 'machine' ? 'Máquina' : ex.type === 'bodyweight' ? 'Corporal' : 'Livre';
      text += `${idx + 1}. ${ex.name} (${type})\n`;
      item.sets.forEach(st => {
        const weightStr = ex.type === 'bodyweight' && (!st.weight_kg || parseFloat(st.weight_kg) === 0) ? 'Peso Corporal' : `${st.weight_kg}kg`;
        text += `   - Série ${st.set_number}: ${weightStr} x ${st.reps} reps\n`;
      });
      text += `\n`;
    });
    text += `Total de séries completadas: ${sets.length}\n`;

    navigator.clipboard.writeText(text);
    setCopiedSessionId(session.id);
    setTimeout(() => setCopiedSessionId(null), 3000);
  }

  async function loadExerciseEvolution(exId) {
    setLoadingChart(true);
    try {
      const { data } = await supabase
        .from('workout_sets')
        .select(`
          weight_kg, reps, created_at,
          workout_sessions!inner(date, gym_id, gyms(name))
        `)
        .eq('exercise_id', exId)
        .order('created_at', { ascending: true });

      if (data) {
        const formatted = data.map(item => ({
          date: new Date(item.workout_sessions?.date || item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          weight: item.weight_kg,
          reps: item.reps,
          gym: item.workout_sessions?.gyms?.name || 'Geral'
        }));
        setChartData(formatted);
      }
    } catch (err) {
      console.warn('Aviso: Operando em modo offline no gráfico:', err);
    } finally {
      setLoadingChart(false);
    }
  }

  const selectedExercise = exercises.find(e => e.id === selectedExerciseId);

  return (
    <div className="pb-28 pt-2 px-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-black text-white">Sua Evolução</h2>
          <p className="text-xs text-slate-400">Histórico de cargas e relatórios</p>
        </div>
      </div>

      {/* Sub-abas: Histórico vs Gráficos */}
      <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800 mb-5">
        <button
          onClick={() => setActiveSubTab('history')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
            activeSubTab === 'history'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Histórico em Lista
        </button>
        <button
          onClick={() => setActiveSubTab('charts')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
            activeSubTab === 'charts'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Gráficos de Força
        </button>
      </div>

      {/* ----------------- SUB-ABA 1: HISTÓRICO EM LISTA ----------------- */}
      {activeSubTab === 'history' && (
        <div>
          {/* Banner de treinos salvos offline aguardando sincronização */}
          {pendingWorkoutsCount > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2 text-xs text-amber-300">
                <CloudUpload className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Você tem <strong>{pendingWorkoutsCount} treino(s)</strong> salvo(s) no celular.
                </span>
              </div>
              {onTriggerSync && (
                <button
                  type="button"
                  onClick={onTriggerSync}
                  className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition active:scale-95 shrink-0"
                >
                  Sincronizar
                </button>
              )}
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs">Carregando histórico...</div>
          ) : sessions.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center">
              <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-white mb-1">Nenhum treino registrado ainda</h3>
              <p className="text-xs text-slate-400">
                Assim que você finalizar seu primeiro treino na aba <strong>"Treinar"</strong>, ele aparecerá aqui com todos os detalhes.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map(s => {
                const isExpanded = expandedSessionId === s.id;
                const dateObj = new Date(s.date);
                const formattedDate = dateObj.toLocaleDateString('pt-BR', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short'
                });
                const sets = sessionSets[s.id] || [];

                return (
                  <div
                    key={s.id}
                    className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-lg transition"
                  >
                    <div
                      onClick={() => toggleExpandSession(s.id)}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center justify-center text-emerald-400 font-bold">
                          <span className="text-[10px] uppercase leading-none">{dateObj.getDate()}</span>
                          <span className="text-[9px] uppercase leading-none mt-0.5">
                            {dateObj.toLocaleDateString('pt-BR', { month: 'short' }).slice(0, 3)}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-white text-sm">{s.name}</h4>
                            {s.is_pending && (
                              <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/25 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                <WifiOff className="w-2.5 h-2.5" /> Salvo no celular
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3 h-3 text-slate-500" />
                            {s.gyms?.name || 'Academia'} • {formattedDate}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleDeleteSession(s.id, e)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition"
                          title="Excluir treino"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="p-1 text-slate-400">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {/* Detalhes Expandidos */}
                    {isExpanded && (
                      <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-3">
                        {sets.length === 0 ? (
                          <p className="text-xs text-slate-500 text-center py-2">Carregando séries...</p>
                        ) : (
                          <>
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={(e) => handleCopySessionReport(s, sets, e)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 ${
                                  copiedSessionId === s.id
                                    ? 'bg-emerald-500 text-slate-950'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                                }`}
                              >
                                {copiedSessionId === s.id ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 stroke-[3]" /> Relatório Copiado!
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" /> Copiar Relatório (Treinador / IA)
                                  </>
                                )}
                              </button>
                            </div>

                            {groupSetsByExercise(sets).map((item, idx) => {
                              const exName = item.exercise?.name || 'Exercício';
                              return (
                                <div key={item.exercise?.id || idx} className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] font-bold text-slate-300 flex items-center justify-center shrink-0">
                                      {idx + 1}
                                    </span>
                                    <h5 className="font-bold text-xs text-slate-200">{exName}</h5>
                                  </div>
                                  <div className="flex flex-wrap gap-2 pl-7">
                                    {item.sets.map(st => {
                                      const isBw = item.exercise?.type === 'bodyweight';
                                      const displayWeight = isBw && (!st.weight_kg || parseFloat(st.weight_kg) === 0) ? 'Corpo' : `${st.weight_kg}kg`;
                                      return (
                                        <span
                                          key={st.id || `${idx}-${st.set_number}`}
                                          className="text-[11px] bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-xl text-slate-300 font-mono"
                                        >
                                          #{st.set_number}: <strong className="text-emerald-400">{displayWeight}</strong> × {st.reps} reps
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ----------------- SUB-ABA 2: GRÁFICOS DE FORÇA ----------------- */}
      {activeSubTab === 'charts' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Escolha o Exercício para ver a progressão de carga:
            </label>
            <select
              value={selectedExerciseId}
              onChange={e => setSelectedExerciseId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
            >
              {exercises.map(ex => (
                <option key={ex.id} value={ex.id}>
                  {ex.name} ({ex.muscle_group} - {ex.type === 'machine' ? '⚙️ Máquina' : ex.type === 'bodyweight' ? '🤸 Corporal' : '🏋️ Halter/Barra'})
                </option>
              ))}
            </select>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-white text-base">{selectedExercise?.name}</h3>
                <span className="text-[11px] text-slate-400">
                  {selectedExercise?.type === 'machine'
                    ? '⚙️ As cargas são medidas nas máquinas das academias registradas'
                    : selectedExercise?.type === 'bodyweight'
                    ? '🤸 Calistenia / Peso corporal'
                    : '🏋️ Peso livre (progressão geral)'}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>

            {loadingChart ? (
              <div className="py-16 text-center text-xs text-slate-500">Calculando histórico...</div>
            ) : chartData.length < 2 ? (
              <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                <Award className="w-8 h-8 text-slate-600 mx-auto" />
                <p>É necessário registrar este exercício em pelo menos 2 treinos para gerar a curva do gráfico.</p>
                <p className="text-[11px] text-slate-500">
                  Registros atuais: {chartData.length}
                </p>
              </div>
            ) : (
              <div>
                <div className="h-48 w-full relative mt-2">
                  {(() => {
                    const weights = chartData.map(d => d.weight);
                    const minW = Math.max(0, Math.min(...weights) - 5);
                    const maxW = Math.max(...weights) + 5;
                    const range = maxW - minW || 1;

                    const points = chartData.map((d, idx) => {
                      const x = (idx / (chartData.length - 1)) * 100;
                      const y = 100 - ((d.weight - minW) / range) * 80 - 10;
                      return `${x},${y}`;
                    }).join(' ');

                    return (
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                        <line x1="0" y1="20" x2="100" y2="20" stroke="#1e293b" strokeDasharray="2" vectorEffect="non-scaling-stroke" />
                        <line x1="0" y1="50" x2="100" y2="50" stroke="#1e293b" strokeDasharray="2" vectorEffect="non-scaling-stroke" />
                        <line x1="0" y1="80" x2="100" y2="80" stroke="#1e293b" strokeDasharray="2" vectorEffect="non-scaling-stroke" />

                        <polyline
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2.5"
                          points={points}
                          vectorEffect="non-scaling-stroke"
                        />

                        {chartData.map((d, idx) => {
                          const cx = (idx / (chartData.length - 1)) * 100;
                          const cy = 100 - ((d.weight - minW) / range) * 80 - 10;
                          return (
                            <circle
                              key={idx}
                              cx={cx}
                              cy={cy}
                              r="3"
                              className="fill-slate-950 stroke-emerald-400 stroke-2"
                              vectorEffect="non-scaling-stroke"
                            />
                          );
                        })}
                      </svg>
                    );
                  })()}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {chartData.slice().reverse().map((d, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 rounded-xl bg-slate-950">
                      <span className="text-slate-400">{d.date} • {d.gym}</span>
                      <span className="font-bold text-emerald-400 font-mono">
                        {d.weight} kg <span className="text-slate-500 font-normal">({d.reps} reps)</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
