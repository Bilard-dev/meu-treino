import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Building2, Plus, Check, Trash2, X } from 'lucide-react';

export default function GymManager({ profileId, gyms, currentGym, onSelectGym, onGymsUpdated, onClose }) {
  const [newGymName, setNewGymName] = useState('');
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  async function handleAddGym(e) {
    e.preventDefault();
    if (!newGymName.trim()) return;
    setAdding(true);
    try {
      const { data, error } = await supabase
        .from('gyms')
        .insert([{ profile_id: profileId, name: newGymName.trim() }])
        .select()
        .single();
      if (error) throw error;
      setNewGymName('');
      onSelectGym(data);
      onGymsUpdated();
    } catch (err) {
      console.error('Erro ao adicionar academia:', err);
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteGym(id) {
    if (gyms.length <= 1) {
      alert('Você precisa ter pelo menos uma academia cadastrada.');
      return;
    }
    setDeletingId(id);
    try {
      await supabase.from('gyms').delete().eq('id', id);
      if (currentGym?.id === id) {
        const remaining = gyms.filter(g => g.id !== id);
        if (remaining.length > 0) onSelectGym(remaining[0]);
      }
      onGymsUpdated();
    } catch (err) {
      console.error('Erro ao deletar academia:', err);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border-t sm:border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Onde você está treinando?</h3>
              <p className="text-xs text-slate-400">Escolha ou cadastre suas academias</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Lista de Academias */}
        <div className="space-y-2 mb-5 max-h-60 overflow-y-auto pr-1">
          {gyms.map((gym) => {
            const isSelected = currentGym?.id === gym.id;
            return (
              <div
                key={gym.id}
                onClick={() => {
                  onSelectGym(gym);
                  onClose();
                }}
                className={`flex items-center justify-between p-3.5 rounded-2xl border transition cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                    isSelected ? 'border-emerald-500 bg-emerald-500 text-slate-950' : 'border-slate-700'
                  }`}>
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <span className="font-medium text-sm">{gym.name}</span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteGym(gym.id);
                  }}
                  disabled={deletingId === gym.id}
                  className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                  title="Excluir academia"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Adicionar Nova Academia */}
        <form onSubmit={handleAddGym} className="flex gap-2">
          <input
            type="text"
            placeholder="Nome da nova academia..."
            value={newGymName}
            onChange={(e) => setNewGymName(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={adding || !newGymName.trim()}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 shadow-md shadow-emerald-500/20 active:scale-95 transition"
          >
            <Plus className="w-4 h-4" /> {adding ? '...' : 'Adicionar'}
          </button>
        </form>
      </div>
    </div>
  );
}
