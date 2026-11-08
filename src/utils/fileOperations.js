/**
 * File Operations Utility for BMO Local Media Management
 * Handles renaming media files, updating embedded intensity tags,
 * and moving files across tag subdirectories using File System Access API.
 */

import { sanitizeFolderName } from './redgifsService.js';

/**
 * Parses a media filename to extract its clean base name, extension,
 * audio ducking flags, and current intensity.
 */
export function parseMediaFilename(filename) {
  if (!filename) return { baseName: '', ext: '', isVoice: false, isMusic: false, intensity: null };

  const lastDotIndex = filename.lastIndexOf('.');
  const ext = lastDotIndex !== -1 ? filename.slice(lastDotIndex) : '';
  let nameWithoutExt = lastDotIndex !== -1 ? filename.slice(0, lastDotIndex) : filename;

  // Detect and remove audio flags
  const isVoice = /\[voice\]|_voice/i.test(nameWithoutExt);
  const isMusic = /\[music\]|_music/i.test(nameWithoutExt);

  nameWithoutExt = nameWithoutExt
    .replace(/\[voice\]|_voice/gi, '')
    .replace(/\[music\]|_music/gi, '');

  // Detect and remove intensity tag [int-X] or [intensity-X] or _intX
  const intMatch = nameWithoutExt.match(/\[(?:int|intensity)-?(\d+)\]|_int(\d+)/i);
  const intensity = intMatch ? parseInt(intMatch[1] || intMatch[2], 10) : null;

  let cleanBase = nameWithoutExt
    .replace(/\[(?:int|intensity)-?\d+\]|_int\d+/gi, '')
    .replace(/[_\s-]+$/, '') // trim trailing separators
    .trim();

  return {
    baseName: cleanBase || nameWithoutExt.trim(),
    ext,
    isVoice,
    isMusic,
    intensity
  };
}

/**
 * Computes a standardized BMO filename based on new base name, intensity,
 * preserving existing audio flags and extension.
 */
export function computeNewFilename(originalFilename, newBaseName, newIntensity) {
  const parsed = parseMediaFilename(originalFilename);
  
  // Sanitize base name (remove illegal filesystem characters)
  const safeBase = (newBaseName || parsed.baseName || 'video')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim();

  // Audio tag suffix
  let audioSuffix = '';
  if (parsed.isVoice) audioSuffix = '_[voice]';
  else if (parsed.isMusic) audioSuffix = '_[music]';

  // Intensity tag suffix
  let intensitySuffix = '';
  if (newIntensity && !isNaN(newIntensity) && newIntensity >= 1 && newIntensity <= 10) {
    intensitySuffix = `_[int-${newIntensity}]`;
  }

  const ext = parsed.ext || '.mp4';
  return `${safeBase}${intensitySuffix}${audioSuffix}${ext}`;
}

/**
 * Renames and/or moves a media file to a new tag folder on the local disk.
 */
export async function renameAndMoveMediaFile({
  rootDirHandle,
  currentFolderHandle,
  fileHandle,
  currentFileName,
  newBaseName,
  currentTagName,
  newTagName,
  newIntensity
}) {
  if (!rootDirHandle) {
    throw new Error('No se ha proporcionado el directorio raíz de la colección.');
  }

  // 1. Verify readwrite permission on root
  const options = { mode: 'readwrite' };
  try {
    const perm = await rootDirHandle.queryPermission(options);
    if (perm !== 'granted') {
      const requested = await rootDirHandle.requestPermission(options);
      if (requested !== 'granted') {
        throw new Error('Permiso de escritura denegado en el directorio.');
      }
    }
  } catch (err) {
    console.warn('Verificación de permisos:', err);
  }

  // 2. Compute clean new filename
  const finalFilename = computeNewFilename(currentFileName, newBaseName, newIntensity);
  const targetTagClean = sanitizeFolderName(newTagName || currentTagName || '00_General');
  const sourceTagClean = sanitizeFolderName(currentTagName || '00_General');

  const isMovingFolder = targetTagClean !== sourceTagClean;
  const isRenaming = finalFilename !== currentFileName;

  // If nothing changed, return early
  if (!isMovingFolder && !isRenaming) {
    return {
      success: true,
      noOp: true,
      finalFilename,
      finalTagName: sourceTagClean
    };
  }

  // 3. Resolve target directory handle
  let targetDirHandle = currentFolderHandle;
  if (isMovingFolder) {
    targetDirHandle = await rootDirHandle.getDirectoryHandle(targetTagClean, { create: true });
  } else if (!targetDirHandle) {
    // If not moving and currentFolderHandle not supplied, get from root
    targetDirHandle = await rootDirHandle.getDirectoryHandle(sourceTagClean, { create: true });
  }

  // 4. Try native FileSystemFileHandle.move() (Chromium 111+)
  if (fileHandle && typeof fileHandle.move === 'function') {
    try {
      if (isMovingFolder) {
        await fileHandle.move(targetDirHandle, finalFilename);
      } else {
        await fileHandle.move(finalFilename);
      }
      return {
        success: true,
        finalFilename,
        finalTagName: targetTagClean
      };
    } catch (moveErr) {
      console.warn('fileHandle.move() no soportado o falló, utilizando copia segura:', moveErr);
    }
  }

  // 5. Fallback: Copy content to target handle, then delete source
  const sourceDir = currentFolderHandle || (await rootDirHandle.getDirectoryHandle(sourceTagClean, { create: false }));
  const sourceFileHandle = fileHandle || (await sourceDir.getFileHandle(currentFileName));
  const fileData = await sourceFileHandle.getFile();

  const newFileHandle = await targetDirHandle.getFileHandle(finalFilename, { create: true });
  const writable = await newFileHandle.createWritable();
  await writable.write(fileData);
  await writable.close();

  // Delete old entry
  await sourceDir.removeEntry(currentFileName);

  return {
    success: true,
    finalFilename,
    finalTagName: targetTagClean,
    newFileHandle
  };
}
