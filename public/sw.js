// Service Worker - Meu Treino (PWA Offline)
const CACHE_NAME = 'meu-treino-cache-v2';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './pwa-192x192.png',
  './pwa-512x512.png',
  './apple-touch-icon.png',
  './icon.svg'
];

// Instalação: baixa os arquivos fundamentais para a memória
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('Aviso: Falha ao pré-carregar alguns recursos estáticos:', err);
      });
    })
  );
  self.skipWaiting();
});

// Ativação: limpa versões antigas do cache e assume o controle imediatamente
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interceptador de requisições: fornece arquivos do cache quando offline
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Ignora requisições que não sejam GET (POST, PUT, DELETE)
  if (request.method !== 'GET') {
    return;
  }

  // Ignora requisições externas para o Supabase (tratadas via offlineStorage do app) ou extensões do Chrome
  const url = new URL(request.url);
  if (url.origin.includes('supabase.co') || !url.protocol.startsWith('http')) {
    return;
  }

  // 1. Navegação (Abrir página / dar F5): Tenta rede primeiro; se estiver offline, entrega o index.html em cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match('./index.html').then((cached) => cached || caches.match('./'));
        })
    );
    return;
  }

  // 2. Arquivos Estáticos (Scripts JS, CSS, Imagens, Fontes): Cache Primeiro com atualização em segundo plano (Stale-While-Revalidate)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch((err) => {
          // Se estiver offline e não tinha no cache
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
