// Utilitário para Cache Local e Sincronização Offline do "Meu Treino"

const QUEUE_KEY = 'meu_treino_offline_queue';

/**
 * Lê dados do cache local (localStorage) de forma segura
 */
export function getCachedData(key, fallback = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    console.error('Erro ao ler do cache local:', key, e);
    return fallback;
  }
}

/**
 * Salva dados no cache local (localStorage)
 */
export function setCachedData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Erro ao salvar no cache local:', key, e);
  }
}

/**
 * Retorna se o navegador está atualmente com conexão à internet
 */
export function isOnline() {
  return typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' 
    ? navigator.onLine 
    : true;
}

/**
 * Obtém todos os treinos que foram finalizados offline e estão aguardando envio
 */
export function getPendingWorkouts() {
  return getCachedData(QUEUE_KEY, []);
}

/**
 * Salva um treino na fila offline para sincronizar quando a internet voltar
 */
export function queueOfflineWorkout(sessionData, setsData) {
  try {
    const queue = getPendingWorkouts();
    const offlineId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const pendingItem = {
      id: offlineId,
      session: {
        ...sessionData,
        id: offlineId,
        is_offline: true,
      },
      sets: setsData,
      queuedAt: new Date().toISOString()
    };

    queue.push(pendingItem);
    setCachedData(QUEUE_KEY, queue);

    // Dispara evento para que a interface saiba que há itens pendentes
    window.dispatchEvent(new CustomEvent('meu-treino-offline-updated', { detail: { count: queue.length } }));

    return pendingItem;
  } catch (e) {
    console.error('Erro ao enfileirar treino offline:', e);
    return null;
  }
}

/**
 * Remove um treino da fila após ser enviado com sucesso para o Supabase
 */
export function removePendingWorkout(offlineId) {
  try {
    const queue = getPendingWorkouts().filter(item => item.id !== offlineId);
    setCachedData(QUEUE_KEY, queue);
    window.dispatchEvent(new CustomEvent('meu-treino-offline-updated', { detail: { count: queue.length } }));
  } catch (e) {
    console.error('Erro ao remover treino da fila offline:', e);
  }
}

/**
 * Sincroniza todos os treinos pendentes na nuvem (Supabase)
 * Retorna a quantidade de treinos sincronizados com sucesso
 */
export async function syncPendingWorkouts(supabase) {
  if (!isOnline() || !supabase) return 0;

  const queue = getPendingWorkouts();
  if (queue.length === 0) return 0;

  let syncedCount = 0;

  for (const item of queue) {
    try {
      // 1. Prepara dados da sessão para envio (removendo id offline e flags temporárias)
      const sessionPayload = {
        profile_id: item.session.profile_id,
        gym_id: item.session.gym_id || null,
        template_id: item.session.template_id || null,
        name: item.session.name,
        date: item.session.date || new Date().toISOString(),
      };

      const { data: createdSession, error: sessionErr } = await supabase
        .from('workout_sessions')
        .insert([sessionPayload])
        .select()
        .single();

      if (sessionErr) throw sessionErr;

      // 2. Prepara e insere as séries com o novo session_id real gerado pelo Supabase
      if (item.sets && item.sets.length > 0) {
        const setsPayload = item.sets.map(s => ({
          session_id: createdSession.id,
          exercise_id: s.exercise_id,
          set_number: s.set_number,
          weight_kg: s.weight_kg,
          reps: s.reps,
          created_at: s.created_at || new Date().toISOString()
        }));

        const { error: setsErr } = await supabase
          .from('workout_sets')
          .insert(setsPayload);

        if (setsErr) throw setsErr;
      }

      // 3. Remove com segurança da fila
      removePendingWorkout(item.id);
      syncedCount++;
    } catch (err) {
      console.error('Falha ao sincronizar treino pendente:', item, err);
      // Se der erro de rede no meio, para a fila para tentar novamente depois
      break;
    }
  }

  return syncedCount;
}
