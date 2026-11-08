import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { 
  X, Calendar, Building2, Dumbbell, Plus, Trash2, 
  Check, Save, Sparkles, AlertCircle 
} from 'lucide-react';
import { 
  isOnline, 
  getPendingWorkouts, 
  setCachedData, 
  getCachedData 
} from '../offlineStorage';

function formatDateForInput(dateStr) {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function WorkoutEditorModal({
  session,
  initialSets = [],
  gyms = [],
  allExercises = [],
  profile,
  onSave,
  onClose
}) {
  const [name, setName] = useState(session.name || 'Treino');
  const [date, setDate] = useState(() => formatDateForInput(session.date));
  const [gymId, setGymId] = useState(session.gym_id || (gyms[0]?.id || ''));
  const [saving, setSaving] = useState(false);
  const [showAddExModal, setShowAddExModal] = useState(false);

  // Agrupa as séries por exercício
  const [exerciseGroups, setExerciseGroups] = useState(() => {
    const map = new Map();
    (initialSets || []).forEach(st => {
      const exId = st.exercises?.id || st.exercise_id || 'unknown';
      if (!map.has(exId)) {
        map.set(exId, {
          exercise: st.exercises || { id: exId, name: 'Exercício', type: 'free_weight' },
          sets: []
        });
      }
      map.get(exId).sets.push({
        id: st.id,
        set_number: st.set_number,
        weight_kg: st.weight_kg !== undefined ? String(st.weight_kg) : '',
        reps: st.reps !== undefined ? String(st.reps) : ''
      });
    });
    for (const item of map.values()) {
      item.sets.sort((a, b) => a.set_number - b.set_number);
    }
    return Array.from(map.values());
  });

  // Atualiza campo de uma série
  function handleUpdateSet(grpIdx, setIdx, field, value) {
    setExerciseGroups(prev => {
      const copy = [...prev];
      const grp = { ...copy[grpIdx] };
      const sets = [...grp.sets];
      sets[setIdx] = { ...sets[setIdx], [field]: value };
      grp.sets = sets;
      copy[grpIdx] = grp;
      return copy;
    });
  }

  // Adicionar série no exercício
  function handleAddSet(grpIdx) {
    setExerciseGroups(prev => {
      const copy = [...prev];
      const grp = { ...copy[grpIdx] };
      const sets = [...grp.sets];
      const last = sets[sets.length - 1];
      const isBw = grp.exercise?.type === 'bodyweight';

      sets.push({
        id: `new_${Date.now()}_${Math.random()}`,
        set_number: sets.length + 1,
        weight_kg: last ? last.weight_kg : (isBw ? '0' : ''),
        reps: last ? last.reps : ''
      });
      grp.sets = sets;
      copy[grpIdx] = grp;
      return copy;
    });
  }

  // Remover série
  function handleRemoveSet(grpIdx, setIdx) {
    setExerciseGroups(prev => {
      const copy = [...prev];
      const grp = { ...copy[grpIdx] };
      if (grp.sets.length <= 1) return prev; // Mantém pelo menos 1 série
      const sets = [...grp.sets];
      sets.splice(setIdx, 1);
      sets.forEach((s, idx) => { s.set_number = idx + 1; });
      grp.sets = sets;
      copy[grpIdx] = grp;
      return copy;
    });
  }

  // Remover exercício completo do treino
  function handleRemoveExercise(grpIdx) {
    if (exerciseGroups.length <= 1) {
      alert('O treino deve ter pelo menos um exercício.');
      return;
    }
    setExerciseGroups(prev => prev.filter((_, idx) => idx !== grpIdx));
  }

  // Adicionar novo exercício avulso no treino
  function handleAddExerciseToWorkout(exercise) {
    const isBw = exercise.type === 'bodyweight';
    setExerciseGroups(prev => [
      ...prev,
      {
        exercise: exercise,
        sets: [
          { id: `new_${Date.now()}_1`, set_number: 1, weight_kg: isBw ? '0' : '', reps: '' },
          { id: `new_${Date.now()}_2`, set_number: 2, weight_kg: isBw ? '0' : '', reps: '' },
          { id: `new_${Date.now()}_3`, set_number: 3, weight_kg: isBw ? '0' : '', reps: '' }
        ]
      }
    ]);
    setShowAddExModal(false);
  }

  // Salvar alterações
  async function handleSaveWorkout() {
    if (!name.trim()) {
      alert('Informe o nome do treino.');
      return;
    }

    if (exerciseGroups.length === 0) {
      alert('Adicione pelo menos um exercício ao treino.');
      return;
    }

    setSaving(true);
    try {
      // Formata a data mantendo o dia selecionado exato (ao meio-dia UTC)
      const [y, m, d] = date.split('-').map(Number);
      const updatedIsoDate = new Date(Date.UTC(y, m - 1, d, 15, 0, 0)).toISOString();

      const isOfflineSession = session.is_pending || String(session.id).startsWith('offline_');

      if (isOfflineSession) {
        // Atualiza na fila offline local
        const queue = getPendingWorkouts();
        const updatedQueue = queue.map(item => {
          if (item.id === session.id) {
            const updatedSets = [];
            let orderOffset = 0;
            const baseTime = new Date(updatedIsoDate).getTime();
            exerciseGroups.forEach(grp => {
              grp.sets.forEach(s => {
                orderOffset++;
                updatedSets.push({
                  exercise_id: grp.exercise.id,
                  exercises: grp.exercise,
                  set_number: s.set_number,
                  weight_kg: parseFloat(s.weight_kg) || 0,
                  reps: parseInt(s.reps, 10) || 0,
                  created_at: new Date(baseTime + orderOffset * 1000).toISOString()
                });
              });
            });

            return {
              ...item,
              session: {
                ...item.session,
                name: name.trim(),
                date: updatedIsoDate,
                gym_id: gymId || null
              },
              sets: updatedSets
            };
          }
          return item;
        });

        setCachedData('meu_treino_offline_queue', updatedQueue);
      } else {
        // Treino na nuvem (Supabase)
        if (!isOnline()) {
          alert('Você está offline no momento. Conecte-se à internet para salvar alterações em treinos da nuvem.');
          setSaving(false);
          return;
        }

        // 1. Atualiza dados da sessão no Supabase
        const { error: sessionError } = await supabase
          .from('workout_sessions')
          .update({
            name: name.trim(),
            date: updatedIsoDate,
            gym_id: gymId || null
          })
          .eq('id', session.id);

        if (sessionError) throw sessionError;

        // 2. Apaga as séries antigas e insere as atualizadas
        await supabase
          .from('workout_sets')
          .delete()
          .eq('session_id', session.id);

        const setsToInsert = [];
        let orderOffset = 0;
        const baseTime = new Date(updatedIsoDate).getTime();

        exerciseGroups.forEach(grp => {
          grp.sets.forEach(s => {
            orderOffset++;
            setsToInsert.push({
              session_id: session.id,
              exercise_id: grp.exercise.id,
              set_number: s.set_number,
              weight_kg: parseFloat(s.weight_kg) || 0,
              reps: parseInt(s.reps, 10) || 0,
              created_at: new Date(baseTime + orderOffset * 1000).toISOString()
            });
          });
        });

        if (setsToInsert.length > 0) {
          const { error: setsError } = await supabase
            .from('workout_sets')
            .insert(setsToInsert);

          if (setsError) throw setsError;
        }

        // 3. Atualiza cache local das sessões
        const cachedSessions = getCachedData(`meu_treino_sessions_${profile.id}`, []);
        const nextCached = cachedSessions.map(cs => {
          if (cs.id === session.id) {
            return {
              ...cs,
              name: name.trim(),
              date: updatedIsoDate,
              gym_id: gymId,
              gyms: gyms.find(g => g.id === gymId) || cs.gyms
            };
          }
          return cs;
        });
        setCachedData(`meu_treino_sessions_${profile.id}`, nextCached);
      }

      onSave();
    } catch (err) {
      console.error('Erro ao salvar treino editado:', err);
      alert('Erro ao salvar alterações no treino.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Cabeçalho do Modal */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90">
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-emerald-400" /> Editar Treino
            </h3>
            <p className="text-xs text-slate-400">Modifique a data, nome, cargas e repetições</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo com Scroll */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* 1. Campos Básicos: Data, Nome, Academia */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Data do Treino:
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Você pode retroagir a data se esqueceu de registrar no dia correto.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nome do Treino:
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Treino A"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-400" /> Academia:
                </label>
                <select
                  value={gymId}
                  onChange={(e) => setGymId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-emerald-500"
                >
                  {gyms.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 2. Lista de Exercícios e Séries */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Exercícios Realizados ({exerciseGroups.length})
              </h4>
              <button
                type="button"
                onClick={() => setShowAddExModal(true)}
                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Exercício
              </button>
            </div>

            {exerciseGroups.map((grp, grpIdx) => {
              const isBw = grp.exercise?.type === 'bodyweight';
              return (
                <div key={grp.exercise?.id || grpIdx} className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] font-bold text-slate-300 flex items-center justify-center">
                        {grpIdx + 1}
                      </span>
                      <div>
                        <h5 className="font-bold text-xs text-white">{grp.exercise?.name}</h5>
                        <span className="text-[10px] text-slate-400">
                          {grp.exercise?.muscle_group} • {isBw ? '🤸 Corporal' : grp.exercise?.type === 'machine' ? '⚙️ Máquina' : '🏋️ Livre'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveExercise(grpIdx)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-900 transition"
                      title="Excluir exercício deste treino"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Séries do Exercício */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
                      <span className="w-6 text-center">#</span>
                      <span className="flex-1 text-center">{isBw ? '+Kg (opcional)' : 'Carga (Kg)'}</span>
                      <span className="flex-1 text-center">Reps</span>
                      {grp.sets.length > 1 && <span className="w-6" />}
                    </div>

                    {grp.sets.map((st, setIdx) => (
                      <div key={st.id || setIdx} className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800/80">
                        <span className="w-6 text-center font-bold text-xs text-slate-400">
                          #{st.set_number}
                        </span>

                        <div className="flex-1 min-w-0">
                          <input
                            type="number"
                            inputMode="decimal"
                            value={st.weight_kg}
                            placeholder={isBw ? "0" : "0"}
                            onChange={(e) => handleUpdateSet(grpIdx, setIdx, 'weight_kg', e.target.value)}
                            className="w-full text-center bg-slate-950 border border-slate-700 rounded-lg py-1.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <input
                            type="number"
                            inputMode="numeric"
                            value={st.reps}
                            placeholder="0"
                            onChange={(e) => handleUpdateSet(grpIdx, setIdx, 'reps', e.target.value)}
                            className="w-full text-center bg-slate-950 border border-slate-700 rounded-lg py-1.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        {grp.sets.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSet(grpIdx, setIdx)}
                            className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-rose-400 transition"
                            title="Excluir série"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddSet(grpIdx)}
                    className="w-full py-1.5 text-[11px] font-semibold text-slate-400 hover:text-white bg-slate-900/60 border border-dashed border-slate-800 rounded-xl flex items-center justify-center gap-1 transition"
                  >
                    <Plus className="w-3 h-3" /> Adicionar Série
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rodapé Fixo do Modal */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition active:scale-95"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSaveWorkout}
            disabled={saving}
            className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 transition disabled:opacity-50"
          >
            {saving ? (
              <span>Salvando...</span>
            ) : (
              <>
                <Save className="w-4 h-4" /> Salvar Alterações
              </>
            )}
          </button>
        </div>

      </div>

      {/* Modal para Escolher Exercício e Adicionar neste treino */}
      {showAddExModal && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-5 space-y-4 shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-white text-sm">Adicionar Exercício</h4>
              <button onClick={() => setShowAddExModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-1.5 flex-1 pr-1">
              {allExercises.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">Nenhum exercício cadastrado.</p>
              ) : (
                allExercises.map(ex => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => handleAddExerciseToWorkout(ex)}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800/50 transition flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-white">{ex.name}</div>
                      <div className="text-[10px] text-slate-400">{ex.muscle_group}</div>
                    </div>
                    <Plus className="w-4 h-4 text-emerald-400" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
