/**
 * File Scanner & Parsing Engine for BMO Media Session
 * Recursively parses root directory structure via File System Access API or webkitdirectory input.
 */

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mkv', '.mov', '.m4v'];
const GIF_EXTENSIONS = ['.gif'];
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'];

/**
 * Check file extension helper
 */
function getExtension(filename) {
  const parts = filename.split('.');
  return parts.length > 1 ? '.' + parts.pop().toLowerCase() : '';
}

/**
 * Extract intensity rating from filename (e.g. [int-4], [intensity-3], _int5)
 */
export function extractIntensity(filename) {
  if (!filename) return null;
  const match = filename.match(/\[(?:int|intensity)-?(\d+)\]|_int(\d+)/i);
  if (match) {
    const val = parseInt(match[1] || match[2], 10);
    if (!isNaN(val) && val >= 1 && val <= 10) return val;
  }
  return null;
}

/**
 * Scan directory using native File System Access API (showDirectoryPicker)
 */
export async function scanDirectoryHandle(rootDirHandle) {
  const tagMap = new Map(); // tagName -> Array of media clips
  const audioTracks = [];

  for await (const [entryName, entryHandle] of rootDirHandle.entries()) {
    if (entryHandle.kind === 'directory') {
      const folderNameLower = entryName.toLowerCase();
      
      // Reserved audio subfolder check
      if (folderNameLower === 'audio_tracks' || folderNameLower === 'audiotracks' || folderNameLower.includes('audio')) {
        await scanAudioDirectoryHandle(entryHandle, audioTracks);
      } else {
        // Tag Subfolder (e.g., 01_anal, 02_lesbian, 03_dolls)
        const mediaClips = [];
        await scanMediaDirectoryHandle(entryHandle, mediaClips, entryName);
        if (mediaClips.length > 0) {
          tagMap.set(entryName, mediaClips);
        }
      }
    } else if (entryHandle.kind === 'file') {
      // Loose files in root directory
      const ext = getExtension(entryName);
      if (AUDIO_EXTENSIONS.includes(ext)) {
        const file = await entryHandle.getFile();
        audioTracks.push({
          name: entryName,
          file,
          url: URL.createObjectURL(file)
        });
      } else if (VIDEO_EXTENSIONS.includes(ext) || GIF_EXTENSIONS.includes(ext)) {
        const file = await entryHandle.getFile();
        const isGif = GIF_EXTENSIONS.includes(ext);
        const nameLower = entryName.toLowerCase();
        
        if (!tagMap.has('00_General')) {
          tagMap.set('00_General', []);
        }
        tagMap.get('00_General').push({
          name: entryName,
          file,
          handle: entryHandle,
          folderHandle: rootDirHandle,
          url: URL.createObjectURL(file),
          type: isGif ? 'gif' : 'video',
          tagName: '00_General',
          isMusicTag: nameLower.includes('[music]') || nameLower.includes('_music'),
          isVoiceTag: nameLower.includes('[voice]') || nameLower.includes('_voice'),
          intensity: extractIntensity(entryName)
        });
      }
    }
  }

  return formatScanResult(tagMap, audioTracks, rootDirHandle);
}

/**
 * Scan media files inside a tag directory handle
 */
async function scanMediaDirectoryHandle(dirHandle, clipsArray, tagName) {
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind === 'file') {
      const ext = getExtension(name);
      const isVideo = VIDEO_EXTENSIONS.includes(ext);
      const isGif = GIF_EXTENSIONS.includes(ext);

      if (isVideo || isGif) {
        const file = await handle.getFile();
        const nameLower = name.toLowerCase();
        clipsArray.push({
          name,
          file,
          handle,
          folderHandle: dirHandle,
          url: URL.createObjectURL(file),
          type: isGif ? 'gif' : 'video',
          tagName,
          isMusicTag: nameLower.includes('[music]') || nameLower.includes('_music'),
          isVoiceTag: nameLower.includes('[voice]') || nameLower.includes('_voice'),
          intensity: extractIntensity(name)
        });
      }
    }
  }
}

/**
 * Scan audio files inside reserved Audio_Tracks handle
 */
async function scanAudioDirectoryHandle(dirHandle, audioArray) {
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind === 'file') {
      const ext = getExtension(name);
      if (AUDIO_EXTENSIONS.includes(ext)) {
        const file = await handle.getFile();
        audioArray.push({
          name,
          file,
          url: URL.createObjectURL(file)
        });
      }
    }
  }
}

/**
 * Fallback scanner for standard <input type="file" webkitdirectory />
 */
export function scanFileInput(fileList) {
  const tagMap = new Map();
  const audioTracks = [];

  Array.from(fileList).forEach((file) => {
    const relativePath = file.webkitRelativePath || file.name;
    const parts = relativePath.split('/');
    const fileName = file.name;
    const ext = getExtension(fileName);
    const nameLower = fileName.toLowerCase();

    // Check path hierarchy: Root/Subfolder/File
    let parentFolder = parts.length > 2 ? parts[1] : '00_General';
    const parentLower = parentFolder.toLowerCase();

    if (parentLower === 'audio_tracks' || parentLower === 'audiotracks' || parentLower.includes('audio')) {
      if (AUDIO_EXTENSIONS.includes(ext)) {
        audioTracks.push({
          name: fileName,
          file,
          url: URL.createObjectURL(file)
        });
      }
    } else {
      const isVideo = VIDEO_EXTENSIONS.includes(ext);
      const isGif = GIF_EXTENSIONS.includes(ext);

      if (AUDIO_EXTENSIONS.includes(ext)) {
        audioTracks.push({
          name: fileName,
          file,
          url: URL.createObjectURL(file)
        });
      } else if (isVideo || isGif) {
        if (!tagMap.has(parentFolder)) {
          tagMap.set(parentFolder, []);
        }
        tagMap.get(parentFolder).push({
          name: fileName,
          file,
          url: URL.createObjectURL(file),
          type: isGif ? 'gif' : 'video',
          tagName: parentFolder,
          isMusicTag: nameLower.includes('[music]') || nameLower.includes('_music'),
          isVoiceTag: nameLower.includes('[voice]') || nameLower.includes('_voice'),
          intensity: extractIntensity(fileName)
        });
      }
    }
  });

  return formatScanResult(tagMap, audioTracks, null);
}

/**
 * Format and sort final scan result
 */
function formatScanResult(tagMap, audioTracks, dirHandle = null) {
  // Sort tag names alphabetically
  const sortedTagNames = Array.from(tagMap.keys()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const tags = sortedTagNames.map((tagName) => ({
    tagName,
    clips: tagMap.get(tagName)
  }));

  // Sort audio tracks alphabetically
  audioTracks.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  let totalMediaCount = 0;
  tags.forEach(t => totalMediaCount += t.clips.length);

  return {
    tags,
    audioTracks,
    totalMediaCount,
    dirHandle
  };
}
