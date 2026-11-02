import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Scale, Activity, Plus, TrendingDown, Trash2, Calendar, FileText, Check } from 'lucide-react';

export default function BodyMetrics({ profile }) {
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [entryMode, setEntryMode] = useState('quick'); // 'quick' | 'bioimpedance'

  // Formulário
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [muscleMass, setMuscleMass] = useState('');
  const [visceralFat, setVisceralFat] = useState('');
  const [waterPct, setWaterPct] = useState('');
  const [bmr, setBmr] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMetrics();
  }, [profile.id]);

  async function loadMetrics() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('body_metrics')
        .select('*')
        .eq('profile_id', profile.id)
        .order('date', { ascending: false });

      if (error) throw error;
      setMetrics(data || []);
    } catch (err) {
      console.error('Erro ao carregar medidas:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!weight) {
      alert('Informe o peso.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        profile_id: profile.id,
        date: date,
        type: entryMode,
        weight_kg: parseFloat(weight),
        height_cm: height ? parseFloat(height) : null,
        body_fat_pct: bodyFat ? parseFloat(bodyFat) : null,
        muscle_mass_kg: muscleMass ? parseFloat(muscleMass) : null,
        visceral_fat: visceralFat ? parseFloat(visceralFat) : null,
        water_pct: waterPct ? parseFloat(waterPct) : null,
        bmr_kcal: bmr ? parseFloat(bmr) : null,
        notes: notes.trim() || null
      };

      const { error } = await supabase.from('body_metrics').insert([payload]);
      if (error) throw error;

      setShowModal(false);
      resetForm();
      loadMetrics();
    } catch (err) {
      console.error('Erro ao salvar medidas:', err);
      alert('Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setDate(new Date().toISOString().split('T')[0]);
    setWeight('');
    setHeight('');
    setBodyFat('');
    setMuscleMass('');
    setVisceralFat('');
    setWaterPct('');
    setBmr('');
    setNotes('');
  }

  async function handleDelete(id) {
    if (!confirm('Deseja excluir este registro de medida?')) return;
    try {
      await supabase.from('body_metrics').delete().eq('id', id);
      setMetrics(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      console.error('Erro ao excluir medida:', err);
    }
  }

  const latestMetric = metrics[0];
  const sortedForChart = [...metrics].sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="pb-28 pt-2 px-4 max-w-lg mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-black text-white">Medidas Corporais</h2>
          <p className="text-xs text-slate-400">Peso do dia e exames de bioimpedância</p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 transition"
        >
          <Plus className="w-4 h-4" /> Novo Registro
        </button>
      </div>

      {/* Cartões Rápidos do Último Registro */}
      {latestMetric && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-md">
            <span className="text-[11px] text-slate-400 block mb-1">Último Peso</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-white">{latestMetric.weight_kg}</span>
              <span className="text-xs text-slate-400">kg</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Registrado em {new Date(latestMetric.date).toLocaleDateString('pt-BR')}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-md">
            <span className="text-[11px] text-slate-400 block mb-1">% de Gordura</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-emerald-400">
                {latestMetric.body_fat_pct ? `${latestMetric.body_fat_pct}%` : '--'}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              {latestMetric.type === 'bioimpedance' ? 'Exame de Bioimpedância' : 'Pesagem Rápida'}
            </span>
          </div>
        </div>
      )}

      {/* Gráfico de Tendência de Peso */}
      {sortedForChart.length >= 2 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-6 shadow-xl">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            Curva de Peso Corporal (kg)
          </h3>
          <div className="h-32 w-full relative">
            {(() => {
              const weights = sortedForChart.map(m => m.weight_kg);
              const minW = Math.min(...weights) - 2;
              const maxW = Math.max(...weights) + 2;
              const range = maxW - minW || 1;

              const points = sortedForChart.map((m, idx) => {
                const x = (idx / (sortedForChart.length - 1)) * 100;
                const y = 100 - ((m.weight_kg - minW) / range) * 80 - 10;
                return `${x},${y}`;
              }).join(' ');

              return (
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                  <polyline
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    points={points}
                    vectorEffect="non-scaling-stroke"
                  />
                  {sortedForChart.map((m, idx) => {
                    const cx = (idx / (sortedForChart.length - 1)) * 100;
                    const cy = 100 - ((m.weight_kg - minW) / range) * 80 - 10;
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
        </div>
      )}

      {/* Lista de Registros Anteriores */}
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
        Histórico de Medições
      </h3>

      {loading ? (
        <div className="py-10 text-center text-xs text-slate-500">Carregando medidas...</div>
      ) : metrics.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center">
          <Scale className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-white mb-1">Nenhum peso registrado</h4>
          <p className="text-xs text-slate-400">
            Clique no botão <strong>"Novo Registro"</strong> para anotar seu peso do dia ou seu primeiro exame de bioimpedância.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {metrics.map(m => (
            <div key={m.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-lg">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-slate-400">
                      {new Date(m.date).toLocaleDateString('pt-BR')}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      m.type === 'bioimpedance'
                        ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                        : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                    }`}>
                      {m.type === 'bioimpedance' ? 'Exame Completo' : 'Pesagem Simples'}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-black text-white">{m.weight_kg} kg</span>
                    {m.body_fat_pct && (
                      <span className="text-xs text-slate-300">
                        • {m.body_fat_pct}% gordura
                      </span>
                    )}
                    {m.muscle_mass_kg && (
                      <span className="text-xs text-slate-300">
                        • {m.muscle_mass_kg} kg massa magra
                      </span>
                    )}
                  </div>

                  {m.type === 'bioimpedance' && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                      {m.visceral_fat && <span>Gordura Visceral: <strong className="text-slate-200">{m.visceral_fat}</strong></span>}
                      {m.water_pct && <span>Água: <strong className="text-slate-200">{m.water_pct}%</strong></span>}
                      {m.bmr_kcal && <span>Metabolismo: <strong className="text-slate-200">{m.bmr_kcal} kcal</strong></span>}
                    </div>
                  )}

                  {m.notes && (
                    <p className="text-xs text-slate-400 italic mt-2">"{m.notes}"</p>
                  )}
                </div>

                <button
                  onClick={() => handleDelete(m.id)}
                  className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition"
                  title="Excluir medição"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Novo Registro (Rápido vs Bioimpedância) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <h3 className="text-base font-bold text-white mb-2">Registrar Medidas</h3>

            {/* Alternar modo */}
            <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 mb-4">
              <button
                type="button"
                onClick={() => setEntryMode('quick')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
                  entryMode === 'quick' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Pesagem do Dia (Rápido)
              </button>
              <button
                type="button"
                onClick={() => setEntryMode('bioimpedance')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
                  entryMode === 'bioimpedance' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Bioimpedância Completa
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto space-y-3 pr-1">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Data</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Peso (kg) *</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Ex: 78.5"
                  value={weight}
                  onChange={e => setWeight(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Campos Extras da Bioimpedância */}
              {entryMode === 'bioimpedance' && (
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Altura (cm)</label>
                      <input
                        type="number"
                        placeholder="Ex: 178"
                        value={height}
                        onChange={e => setHeight(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">% Gordura</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Ex: 15.2"
                        value={bodyFat}
                        onChange={e => setBodyFat(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Massa Magra (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Ex: 62.0"
                        value={muscleMass}
                        onChange={e => setMuscleMass(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Gordura Visceral</label>
                      <input
                        type="number"
                        step="0.5"
                        placeholder="Ex: 4"
                        value={visceralFat}
                        onChange={e => setVisceralFat(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">% Água Corporal</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Ex: 58.5"
                        value={waterPct}
                        onChange={e => setWaterPct(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Taxa Metabólica (kcal)</label>
                      <input
                        type="number"
                        placeholder="Ex: 1750"
                        value={bmr}
                        onChange={e => setBmr(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Observações (opcional)</label>
                    <input
                      type="text"
                      placeholder="Ex: Feito em jejum pela manhã"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 text-xs text-slate-400 bg-slate-800 rounded-xl hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 text-xs font-bold text-slate-950 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-500/20"
                >
                  {saving ? 'Salvando...' : 'Salvar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
