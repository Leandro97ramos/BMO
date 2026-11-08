/**
 * RedGifs API Service & Video Downloader Engine for BMO
 * Handles URL parsing, token management, metadata querying, streaming download with progress,
 * and File System Access API writing into tag-based directories.
 */

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Extract RedGifs IDs from multi-line text, URLs, or space/comma-separated strings
 */
export function extractRedGifsIds(input) {
  if (!input || typeof input !== 'string') return [];

  // Match URLs or standalone tokens
  const linesAndTokens = input.split(/[\s,\n\r\t]+/).filter(Boolean);
  const ids = [];

  for (const item of linesAndTokens) {
    const trimmed = item.trim();
    if (!trimmed) continue;

    // Pattern 1: https://www.redgifs.com/watch/<id> or /ifr/<id>
    const urlMatch = trimmed.match(/redgifs\.com\/(?:watch|ifr|media)\/([a-zA-Z0-9]+)/i);
    if (urlMatch && urlMatch[1]) {
      ids.push(urlMatch[1].toLowerCase());
      continue;
    }

    // Pattern 2: media.redgifs.com/<id>.mp4 or <id>-mobile.mp4
    const mediaMatch = trimmed.match(/media\.redgifs\.com\/([a-zA-Z0-9]+)(?:-[a-zA-Z0-9]+)?\.mp4/i);
    if (mediaMatch && mediaMatch[1]) {
      ids.push(mediaMatch[1].toLowerCase());
      continue;
    }

    // Pattern 3: Standalone alphanumeric ID (at least 3 chars, not a full url)
    if (/^[a-zA-Z0-9]{3,}$/.test(trimmed) && !trimmed.includes('.') && !trimmed.includes('/')) {
      ids.push(trimmed.toLowerCase());
    }
  }

  // Return unique IDs in original discovered order
  return [...new Set(ids)];
}

/**
 * Obtain a temporary auth token from RedGifs via local proxy
 */
export async function getRedGifsToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  try {
    const res = await fetch('/api/redgifs/auth');
    if (!res.ok) {
      throw new Error(`Error al autenticar con RedGifs: ${res.statusText}`);
    }
    const data = await res.json();
    if (data.token) {
      cachedToken = data.token;
      // Tokens usually last 24h, cache for 12 hours
      tokenExpiresAt = now + 12 * 3600 * 1000;
      return cachedToken;
    }
    throw new Error('Respuesta de autenticación inválida');
  } catch (err) {
    console.error('Error al obtener token de RedGifs:', err);
    throw err;
  }
}

/**
 * Fetch video metadata from RedGifs API
 */
export async function fetchGifMetadata(id) {
  const token = await getRedGifsToken();
  const cleanId = id.trim().toLowerCase();

  const res = await fetch(`/api/redgifs/detail?id=${encodeURIComponent(cleanId)}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Video no encontrado (${cleanId}). Es posible que haya sido eliminado.`);
    }
    throw new Error(`Error al consultar video (${cleanId}): ${res.statusText}`);
  }

  const data = await res.json();
  if (!data.gif) {
    throw new Error(`No se encontraron datos para el video: ${cleanId}`);
  }

  const gif = data.gif;
  return {
    id: gif.id,
    cleanId,
    title: gif.id,
    urls: gif.urls || {},
    hdUrl: gif.urls?.hd || gif.urls?.sd || null,
    sdUrl: gif.urls?.sd || null,
    thumbnail: gif.urls?.thumbnail || gif.urls?.poster || null,
    poster: gif.urls?.poster || null,
    duration: Math.round(gif.duration || 0),
    hasAudio: Boolean(gif.hasAudio),
    tags: Array.isArray(gif.tags) ? gif.tags : [],
    userName: gif.userName || 'Anónimo',
    likes: gif.likes || 0,
    views: gif.views || 0
  };
}

/**
 * Download video stream as Blob reporting progress
 */
export async function downloadVideoBlob(videoUrl, onProgress) {
  if (!videoUrl) throw new Error('URL de video no proporcionada');

  const proxyUrl = `/api/redgifs/download?url=${encodeURIComponent(videoUrl)}`;
  const response = await fetch(proxyUrl);

  if (!response.ok) {
    throw new Error(`Fallo en la descarga: ${response.statusText}`);
  }

  const contentLengthHeader = response.headers.get('content-length');
  const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

  if (!response.body) {
    const blob = await response.blob();
    if (onProgress) onProgress(100, blob.size, blob.size);
    return blob;
  }

  const reader = response.body.getReader();
  let receivedBytes = 0;
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    receivedBytes += value.length;

    if (onProgress && totalBytes > 0) {
      const percent = Math.min(100, Math.round((receivedBytes / totalBytes) * 100));
      onProgress(percent, receivedBytes, totalBytes);
    }
  }

  const blob = new Blob(chunks, { type: 'video/mp4' });
  if (onProgress) {
    onProgress(100, receivedBytes, receivedBytes);
  }
  return blob;
}

/**
 * Build standardized BMO filename with intensity rate and optional voice ducking
 * Format: <id>_[int-<level>].mp4 or <id>_[int-<level>]_[voice].mp4
 */
export function buildBmoFilename(cleanId, intensity = 3, hasAudio = false) {
  const safeId = cleanId.replace(/[^a-zA-Z0-9_-]/g, '');
  const intensityTag = `[int-${intensity || 3}]`;
  const audioSuffix = hasAudio ? '_[voice]' : '';
  return `${safeId}_${intensityTag}${audioSuffix}.mp4`;
}

/**
 * Sanitize folder/tag names to be safe across Windows and POSIX filesystems
 */
export function sanitizeFolderName(name) {
  if (!name) return '00_General';
  // Strip characters not allowed in Windows folder names: \ / : * ? " < > |
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim();
  return cleaned || '00_General';
}

/**
 * Save video Blob into File System Access API directory handle inside the tag subfolder
 */
export async function saveVideoToDirectory(rootDirHandle, tagName, filename, blob) {
  if (!rootDirHandle) {
    throw new Error('No se ha especificado un directorio de destino.');
  }

  // 1. Verify readwrite permission
  const options = { mode: 'readwrite' };
  try {
    const currentPerm = await rootDirHandle.queryPermission(options);
    if (currentPerm !== 'granted') {
      const requested = await rootDirHandle.requestPermission(options);
      if (requested !== 'granted') {
        throw new Error('Permiso de escritura denegado para la carpeta de destino.');
      }
    }
  } catch (err) {
    console.warn('Error al verificar permisos del directorio:', err);
  }

  // 2. Get or create tag subfolder
  const safeTag = sanitizeFolderName(tagName);
  const tagFolderHandle = await rootDirHandle.getDirectoryHandle(safeTag, { create: true });

  // 3. Create file handle and write blob
  const fileHandle = await tagFolderHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();

  return {
    success: true,
    folderName: safeTag,
    filename,
    relativePath: `${safeTag}/${filename}`
  };
}

/**
 * Browser fallback download if File System Access API is not supported or not selected
 */
export function triggerBrowserDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
