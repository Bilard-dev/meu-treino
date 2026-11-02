import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { TrendingUp, Calendar, Building2, Dumbbell, ChevronRight, ChevronDown, Trash2, Award } from 'lucide-react';

export default function Evolution({ profile, gyms }) {
  const [activeSubTab, setActiveSubTab] = useState('history'); // 'history' | 'charts'
  const [sessions, setSessions] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);

  // Histórico expandido
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [sessionSets, setSessionSets] = useState({}); // { [sessionId]: [ { exercise, set_number, weight_kg, reps } ] }

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
    setLoading(true);
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
      setSessions(data || []);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadExercises() {
    try {
      const { data } = await supabase
        .from('exercises')
        .select('*')
        .eq('profile_id', profile.id)
        .order('name', { ascending: true });

      setExercises(data || []);
      if (data && data.length > 0 && !selectedExerciseId) {
        setSelectedExerciseId(data[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar exercícios:', err);
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
            id, set_number, weight_kg, reps, rest_seconds,
            exercises (id, name, muscle_group, type)
          `)
          .eq('session_id', sessionId)
          .order('set_number', { ascending: true });

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
      await supabase.from('workout_sessions').delete().eq('id', sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (err) {
      console.error('Erro ao excluir treino:', err);
    }
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
        // Agrupa por treino para pegar a carga máxima alcançada naquele dia
        const formatted = data.map(item => ({
          date: new Date(item.workout_sessions?.date || item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          weight: item.weight_kg,
          reps: item.reps,
          gym: item.workout_sessions?.gyms?.name || 'Geral'
        }));
        setChartData(formatted);
      }
    } catch (err) {
      console.error('Erro ao buscar evolução do exercício:', err);
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
          <p className="text-xs text-slate-400">Histórico de cargas e frequência</p>
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
                          <h4 className="font-bold text-white text-sm">{s.name}</h4>
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

                    {/* Detalhes Expandidos (Séries Feitas) */}
                    {isExpanded && (
                      <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-3">
                        {sets.length === 0 ? (
                          <p className="text-xs text-slate-500 text-center py-2">Carregando séries...</p>
                        ) : (
                          // Agrupa séries por exercício
                          Object.entries(
                            sets.reduce((acc, curr) => {
                              const exName = curr.exercises?.name || 'Exercício';
                              if (!acc[exName]) acc[exName] = [];
                              acc[exName].push(curr);
                              return acc;
                            }, {})
                          ).map(([exName, exerciseSets]) => (
                            <div key={exName} className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80">
                              <h5 className="font-bold text-xs text-slate-200 mb-1.5">{exName}</h5>
                              <div className="flex flex-wrap gap-2">
                                {exerciseSets.map(st => (
                                  <span
                                    key={st.id}
                                    className="text-[11px] bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-xl text-slate-300 font-mono"
                                  >
                                    #{st.set_number}: <strong className="text-emerald-400">{st.weight_kg}kg</strong> × {st.reps} reps
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))
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
          {/* Seletor de Exercício */}
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
                  {ex.name} ({ex.muscle_group} - {ex.type === 'machine' ? '⚙️ Máquina' : '🏋️ Halter/Barra'})
                </option>
              ))}
            </select>
          </div>

          {/* Card do Gráfico */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-white text-base">{selectedExercise?.name}</h3>
                <span className="text-[11px] text-slate-400">
                  {selectedExercise?.type === 'machine'
                    ? '⚙️ As cargas são medidas nas máquinas das academias registradas'
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
                {/* Gráfico SVG Responsivo e Limpo */}
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
                        {/* Linhas de grade suaves */}
                        <line x1="0" y1="20" x2="100" y2="20" stroke="#1e293b" strokeDasharray="2" vectorEffect="non-scaling-stroke" />
                        <line x1="0" y1="50" x2="100" y2="50" stroke="#1e293b" strokeDasharray="2" vectorEffect="non-scaling-stroke" />
                        <line x1="0" y1="80" x2="100" y2="80" stroke="#1e293b" strokeDasharray="2" vectorEffect="non-scaling-stroke" />

                        {/* Linha de Tendência */}
                        <polyline
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2.5"
                          points={points}
                          vectorEffect="non-scaling-stroke"
                        />

                        {/* Pontos */}
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

                {/* Tabela de Marcos Recentes */}
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
