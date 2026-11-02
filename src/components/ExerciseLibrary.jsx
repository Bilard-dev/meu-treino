import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Plus, Edit2, Trash2, Search, Dumbbell, History, 
  Sparkles, Check, X, ChevronDown, ChevronUp, Award, Layers, AlertCircle 
} from 'lucide-react';

const DEFAULT_MOCK_NAMES = [
  'Supino Reto Barra',
  'Crucifixo na Máquina',
  'Puxada Alta (Polia)',
  'Remada Curvada Halter',
  'Leg Press 45',
  'Agachamento Livre',
  'Desenvolvimento Máquina',
  'Elevação Lateral Halter',
  'Tríceps Polia Corda',
  'Rosca Direta Halter'
];

export default function ExerciseLibrary({ profile }) {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('Todos');

  // Modal de Criar/Editar
  const [showModal, setShowModal] = useState(false);
  const [editingEx, setEditingEx] = useState(null);
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('Peito');
  const [type, setType] = useState('free_weight');
  const [saving, setSaving] = useState(false);
  const [cleaningDefaults, setCleaningDefaults] = useState(false);

  // Histórico expandido por exercício
  const [expandedExId, setExpandedExId] = useState(null);
  const [exHistory, setExHistory] = useState({}); // { [exId]: [ { weight_kg, reps, date, gymName } ] }
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    loadExercises();
  }, [profile.id]);

  async function loadExercises() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('profile_id', profile.id)
        .order('name', { ascending: true });

      if (error) throw error;
      setExercises(data || []);
    } catch (err) {
      console.error('Erro ao buscar exercícios:', err);
    } finally {
      setLoading(false);
    }
  }

  // Remove apenas os exercícios que vieram de exemplo na criação do app
  async function handleRemoveDefaultExercises() {
    if (!confirm('Deseja apagar os 10 exercícios que vieram de exemplo e manter somente os que você criou?')) return;
    setCleaningDefaults(true);
    try {
      const idsToDelete = exercises
        .filter(e => DEFAULT_MOCK_NAMES.includes(e.name))
        .map(e => e.id);

      if (idsToDelete.length > 0) {
        const { error } = await supabase
          .from('exercises')
          .delete()
          .in('id', idsToDelete);

        if (error) throw error;
      }

      await loadExercises();
      alert('Exercícios de exemplo removidos com sucesso! Ficaram apenas os seus.');
    } catch (err) {
      console.error('Erro ao remover exemplos:', err);
      alert('Erro ao remover exercícios de exemplo.');
    } finally {
      setCleaningDefaults(false);
    }
  }

  function handleOpenCreate() {
    setEditingEx(null);
    setName('');
    setMuscleGroup('Peito');
    setType('free_weight');
    setShowModal(true);
  }

  function handleOpenEdit(ex) {
    setEditingEx(ex);
    setName(ex.name);
    setMuscleGroup(ex.muscle_group);
    setType(ex.type || 'free_weight');
    setShowModal(true);
  }

  async function handleSaveExercise(e) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      if (editingEx) {
        // Atualizar
        const { error } = await supabase
          .from('exercises')
          .update({
            name: name.trim(),
            muscle_group: muscleGroup,
            type: type
          })
          .eq('id', editingEx.id);

        if (error) throw error;
      } else {
        // Criar novo
        const { error } = await supabase
          .from('exercises')
          .insert([{
            profile_id: profile.id,
            name: name.trim(),
            muscle_group: muscleGroup,
            type: type
          }]);

        if (error) throw error;
      }

      setShowModal(false);
      loadExercises();
    } catch (err) {
      console.error('Erro ao salvar exercício:', err);
      alert('Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteExercise(id, exName) {
    if (!confirm(`Deseja realmente excluir o exercício "${exName}"?`)) return;
    try {
      await supabase.from('exercises').delete().eq('id', id);
      setExercises(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      console.error('Erro ao excluir exercício:', err);
    }
  }

  // Carregar histórico de cargas deste exercício
  async function toggleHistory(exId) {
    if (expandedExId === exId) {
      setExpandedExId(null);
      return;
    }

    setExpandedExId(exId);
    if (!exHistory[exId]) {
      setLoadingHistory(true);
      try {
        const { data } = await supabase
          .from('workout_sets')
          .select(`
            weight_kg, reps, created_at,
            workout_sessions!inner(date, gym_id, gyms(name))
          `)
          .eq('exercise_id', exId)
          .order('created_at', { ascending: false });

        setExHistory(prev => ({
          ...prev,
          [exId]: data || []
        }));
      } catch (err) {
        console.error('Erro ao carregar histórico do exercício:', err);
      } finally {
        setLoadingHistory(false);
      }
    }
  }

  const muscleFilters = ['Todos', 'Peito', 'Costas', 'Pernas', 'Ombros', 'Bíceps', 'Tríceps', 'Abdômen'];

  const filteredExercises = exercises.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase());
    const matchesMuscle = selectedMuscle === 'Todos' || e.muscle_group === selectedMuscle;
    return matchesSearch && matchesMuscle;
  });

  const hasMockExercises = exercises.some(e => DEFAULT_MOCK_NAMES.includes(e.name));

  return (
    <div className="pb-28 pt-2 px-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-black text-white">Seus Exercícios</h2>
          <p className="text-xs text-slate-400">Edite nomes, tipos e consulte o histórico</p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 transition"
        >
          <Plus className="w-4 h-4" /> Novo Exercício
        </button>
      </div>

      {/* Banner de limpeza de exercícios padrão (se existirem na conta) */}
      {hasMockExercises && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Há exercícios que vieram de exemplo na criação inicial.</span>
          </div>
          <button
            onClick={handleRemoveDefaultExercises}
            disabled={cleaningDefaults}
            className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-[11px] shrink-0 active:scale-95 transition"
          >
            {cleaningDefaults ? 'Limpando...' : 'Apagar Exemplos'}
          </button>
        </div>
      )}

      {/* Barra de Pesquisa */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Buscar exercício pelo nome..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Filtro por Músculo (Chips) */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {muscleFilters.map(m => (
          <button
            key={m}
            type="button"
            onClick={() => setSelectedMuscle(m)}
            className={`px-3 py-1 rounded-xl text-xs font-semibold shrink-0 transition ${
              selectedMuscle === m
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Lista de Exercícios */}
      {loading ? (
        <div className="py-12 text-center text-slate-500 text-xs">Carregando seus exercícios...</div>
      ) : filteredExercises.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center">
          <Dumbbell className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white mb-1">
            {search || selectedMuscle !== 'Todos' ? 'Nenhum exercício encontrado com esses filtros' : 'Nenhum exercício cadastrado ainda'}
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Você tem total liberdade para criar seus exercícios do zero, com o nome e grupo que preferir.
          </p>
          <button
            onClick={handleOpenCreate}
            className="px-5 py-2.5 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl shadow-md"
          >
            Cadastrar Exercício
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredExercises.map(ex => {
            const isExpanded = expandedExId === ex.id;
            const history = exHistory[ex.id] || [];
            const maxWeight = history.reduce((max, h) => Math.max(max, parseFloat(h.weight_kg) || 0), 0);

            return (
              <div key={ex.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-lg transition">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                        {ex.muscle_group}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        ex.type === 'machine'
                          ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                          : ex.type === 'bodyweight'
                          ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                          : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                      }`}>
                        {ex.type === 'machine' ? '⚙️ Máquina' : ex.type === 'bodyweight' ? '🤸 Corporal' : '🏋️ Peso Livre'}
                      </span>
                    </div>

                    <h4 className="font-bold text-white text-base">{ex.name}</h4>

                    {maxWeight > 0 && (
                      <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 mt-1">
                        <Award className="w-3.5 h-3.5" /> Recorde: {maxWeight} kg
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(ex)}
                      className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 transition"
                      title="Editar exercício"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteExercise(ex.id, ex.name)}
                      className="p-2 text-slate-500 hover:text-rose-400 rounded-xl bg-slate-800/80 transition"
                      title="Excluir exercício"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => toggleHistory(ex.id)}
                      className="p-2 text-slate-400 hover:text-emerald-400 rounded-xl bg-slate-800/80 transition"
                      title="Ver histórico de cargas"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <History className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Histórico Expandido do Exercício */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-800 space-y-2 animate-in fade-in">
                    <span className="text-[11px] font-bold text-slate-400 block">Histórico de Séries Anotadas:</span>
                    {loadingHistory ? (
                      <p className="text-xs text-slate-500 py-2 text-center">Buscando histórico...</p>
                    ) : history.length === 0 ? (
                      <p className="text-xs text-slate-500 py-1">Nenhum treino salvo com este exercício ainda.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {history.map((h, hIdx) => {
                          const dateStr = new Date(h.workout_sessions?.date || h.created_at).toLocaleDateString('pt-BR');
                          const gymName = h.workout_sessions?.gyms?.name || 'Academia';
                          return (
                            <div key={hIdx} className="bg-slate-950 px-3 py-2 rounded-xl flex items-center justify-between text-xs">
                              <span className="text-slate-400 font-mono text-[11px]">
                                {dateStr} • {gymName}
                              </span>
                              <span className="font-bold text-emerald-400 font-mono">
                                {ex.type === 'bodyweight' && (!h.weight_kg || parseFloat(h.weight_kg) === 0) ? 'Corpo' : `${h.weight_kg}kg`} × {h.reps} reps
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Criar / Editar Exercício */}
      {showModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">
              {editingEx ? 'Editar Exercício' : 'Novo Exercício'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">Defina o nome, músculo e forma de peso.</p>

            <form onSubmit={handleSaveExercise} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nome do Exercício</label>
                <input
                  type="text"
                  placeholder="Ex: Supino Inclinado Halter"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Grupo Muscular</label>
                <select
                  value={muscleGroup}
                  onChange={e => setMuscleGroup(e.target.value)}
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tipo de Carga</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="free_weight">🏋️ Peso Livre (Halter / Barra - geral)</option>
                  <option value="machine">⚙️ Máquina / Polia (lembra por academia)</option>
                  <option value="bodyweight">🤸 Peso Corporal (Calistenia - ex: paralelas)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 text-xs text-slate-400 bg-slate-800 rounded-xl hover:bg-slate-700 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-950 bg-emerald-500 rounded-xl hover:bg-emerald-400 transition"
                >
                  {saving ? 'Salvando...' : 'Salvar Exercício'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
