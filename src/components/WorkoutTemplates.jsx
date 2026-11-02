import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Trash2, Edit2, ClipboardList, Dumbbell, Check, X } from 'lucide-react';

export default function WorkoutTemplates({ profile }) {
  const [templates, setTemplates] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal para criar/editar ficha
  const [showModal, setShowModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateExercises, setTemplateExercises] = useState([]); // [{ exercise_id, default_sets }]

  // Criar exercício novo rápido no modal
  const [showNewExerciseInput, setShowNewExerciseInput] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExMuscle, setNewExMuscle] = useState('Peito');
  const [newExType, setNewExType] = useState('free_weight');

  useEffect(() => {
    loadData();
  }, [profile.id]);

  async function loadData() {
    setLoading(true);
    try {
      const { data: tpls } = await supabase
        .from('workout_templates')
        .select(`
          id, name, created_at,
          workout_template_exercises (
            id, exercise_id, order_index, default_sets,
            exercises (id, name, muscle_group, type)
          )
        `)
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: true });

      setTemplates(tpls || []);

      const { data: exs } = await supabase
        .from('exercises')
        .select('*')
        .eq('profile_id', profile.id)
        .order('name', { ascending: true });

      setExercises(exs || []);
    } catch (err) {
      console.error('Erro ao carregar fichas:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreate() {
    setSelectedTemplate(null);
    setTemplateName('');
    setTemplateExercises([]);
    setShowModal(true);
  }

  function handleOpenEdit(tpl) {
    setSelectedTemplate(tpl);
    setTemplateName(tpl.name);
    const mapped = (tpl.workout_template_exercises || [])
      .sort((a, b) => a.order_index - b.order_index)
      .map(item => ({
        exercise_id: item.exercise_id,
        default_sets: item.default_sets || 4,
      }));
    setTemplateExercises(mapped);
    setShowModal(true);
  }

  async function handleDeleteTemplate(id) {
    if (!confirm('Deseja excluir esta ficha de treino?')) return;
    try {
      await supabase.from('workout_templates').delete().eq('id', id);
      loadData();
    } catch (err) {
      console.error('Erro ao excluir ficha:', err);
    }
  }

  function handleAddExerciseToForm(exerciseId) {
    if (!exerciseId) return;
    setTemplateExercises(prev => [
      ...prev,
      { exercise_id: exerciseId, default_sets: 4 }
    ]);
  }

  function handleRemoveExerciseFromForm(index) {
    setTemplateExercises(prev => prev.filter((_, idx) => idx !== index));
  }

  async function handleCreateNewExerciseDirectly(e) {
    e.preventDefault();
    if (!newExName.trim()) return;
    try {
      const { data, error } = await supabase
        .from('exercises')
        .insert([{
          profile_id: profile.id,
          name: newExName.trim(),
          muscle_group: newExMuscle,
          type: newExType
        }])
        .select()
        .single();
      if (error) throw error;
      setExercises(prev => [...prev, data]);
      handleAddExerciseToForm(data.id);
      setNewExName('');
      setShowNewExerciseInput(false);
    } catch (err) {
      console.error('Erro ao cadastrar exercício:', err);
    }
  }

  async function handleSaveTemplate(e) {
    e.preventDefault();
    if (!templateName.trim()) {
      alert('Digite o nome da ficha.');
      return;
    }

    try {
      let tplId = selectedTemplate?.id;

      if (selectedTemplate) {
        await supabase
          .from('workout_templates')
          .update({ name: templateName.trim() })
          .eq('id', tplId);

        await supabase
          .from('workout_template_exercises')
          .delete()
          .eq('template_id', tplId);
      } else {
        const { data: newTpl, error } = await supabase
          .from('workout_templates')
          .insert([{ profile_id: profile.id, name: templateName.trim() }])
          .select()
          .single();
        if (error) throw error;
        tplId = newTpl.id;
      }

      if (templateExercises.length > 0) {
        const rows = templateExercises.map((item, index) => ({
          template_id: tplId,
          exercise_id: item.exercise_id,
          order_index: index,
          default_sets: parseInt(item.default_sets, 10) || 4,
        }));

        await supabase.from('workout_template_exercises').insert(rows);
      }

      setShowModal(false);
      loadData();
    } catch (err) {
      console.error('Erro ao salvar ficha:', err);
      alert('Erro ao salvar ficha.');
    }
  }

  return (
    <div className="pb-28 pt-2 px-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-black text-white">Fichas de Treino</h2>
          <p className="text-xs text-slate-400">Monte seus modelos fixos de treino</p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 transition"
        >
          <Plus className="w-4 h-4" /> Nova Ficha
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 text-xs">Carregando fichas...</div>
      ) : templates.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center">
          <ClipboardList className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white mb-1">Nenhuma ficha criada ainda</h3>
          <p className="text-xs text-slate-400 mb-4">
            Crie seus treinos (ex: Treino A - Peito, Treino B - Costas) para carregar tudo pronto no dia a dia.
          </p>
          <button
            onClick={handleOpenCreate}
            className="px-5 py-2.5 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl shadow-md"
          >
            Criar Minha Primeira Ficha
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map(tpl => {
            const exList = (tpl.workout_template_exercises || []).sort((a, b) => a.order_index - b.order_index);
            return (
              <div key={tpl.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-base font-bold text-white">{tpl.name}</h3>
                    <span className="text-xs text-slate-400">{exList.length} exercícios configurados</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(tpl)}
                      className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-800 transition"
                      title="Editar ficha"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(tpl.id)}
                      className="p-2 text-slate-500 hover:text-rose-400 rounded-xl bg-slate-800/80 hover:bg-slate-800 transition"
                      title="Excluir ficha"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800/60">
                  {exList.map((item, idx) => {
                    const exType = item.exercises?.type;
                    return (
                      <div key={item.id} className="flex items-center justify-between text-xs py-1">
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-slate-500 font-mono w-4">{idx + 1}.</span>
                          <span className="font-semibold text-slate-200 truncate">{item.exercises?.name}</span>
                          <span className="text-[10px] text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 shrink-0">
                            {exType === 'machine' ? 'Máquina' : exType === 'bodyweight' ? 'Corporal' : 'Livre'}
                          </span>
                        </div>
                        <span className="text-slate-400 font-mono text-[11px] shrink-0 ml-2">
                          {item.default_sets} séries
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Criação / Edição de Ficha */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">
                {selectedTemplate ? 'Editar Ficha de Treino' : 'Nova Ficha de Treino'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nome da Ficha
                </label>
                <input
                  type="text"
                  placeholder="Ex: Treino A - Peito e Tríceps"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Lista de Exercícios na Ficha */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-300">
                    Exercícios desta Ficha ({templateExercises.length})
                  </label>
                </div>

                <div className="space-y-2 mb-3">
                  {templateExercises.map((item, idx) => {
                    const ex = exercises.find(e => e.id === item.exercise_id);
                    const exType = ex?.type;
                    return (
                      <div key={idx} className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-2">
                        <div className="flex-1 truncate">
                          <span className="font-bold text-xs text-white block truncate">{ex?.name || 'Exercício'}</span>
                          <span className="text-[10px] text-slate-400">
                            {ex?.muscle_group} • {exType === 'machine' ? 'Máquina' : exType === 'bodyweight' ? 'Corporal' : 'Livre'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="text-center">
                            <span className="block text-[9px] text-slate-400">Séries</span>
                            <input
                              type="number"
                              value={item.default_sets}
                              onChange={e => {
                                const val = e.target.value;
                                setTemplateExercises(prev => {
                                  const copy = [...prev];
                                  copy[idx].default_sets = val;
                                  return copy;
                                });
                              }}
                              className="w-14 text-center bg-slate-900 border border-slate-700 rounded-lg py-1 text-xs text-white"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveExerciseFromForm(idx)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Seletor para adicionar exercício à ficha */}
                <div className="space-y-2">
                  <select
                    onChange={e => {
                      handleAddExerciseToForm(e.target.value);
                      e.target.value = '';
                    }}
                    defaultValue=""
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="" disabled>+ Selecionar exercício para adicionar...</option>
                    {exercises.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.muscle_group} - {e.type === 'machine' ? 'Máquina' : e.type === 'bodyweight' ? 'Corporal' : 'Livre'})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setShowNewExerciseInput(!showNewExerciseInput)}
                    className="text-[11px] text-emerald-400 hover:underline block"
                  >
                    {showNewExerciseInput ? 'Fechar cadastro rápido' : '+ Criar um novo exercício que não está na lista'}
                  </button>

                  {/* Formulário para cadastrar novo exercício */}
                  {showNewExerciseInput && (
                    <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2 mt-2">
                      <input
                        type="text"
                        placeholder="Nome do novo exercício"
                        value={newExName}
                        onChange={e => setNewExName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={newExMuscle}
                          onChange={e => setNewExMuscle(e.target.value)}
                          className="bg-slate-900 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-white"
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
                          value={newExType}
                          onChange={e => setNewExType(e.target.value)}
                          className="bg-slate-900 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-white"
                        >
                          <option value="free_weight">🏋️ Peso Livre</option>
                          <option value="machine">⚙️ Máquina</option>
                          <option value="bodyweight">🤸 Peso Corporal</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={handleCreateNewExerciseDirectly}
                        className="w-full py-1.5 bg-emerald-500 font-bold text-slate-950 text-xs rounded-xl"
                      >
                        Salvar e Adicionar à Ficha
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 text-xs font-semibold text-slate-400 bg-slate-800 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 text-xs font-black text-slate-950 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-500/20"
                >
                  Salvar Ficha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
