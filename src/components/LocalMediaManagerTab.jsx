/**
 * Local Media Manager Tab Component for BMO
 * Allows viewing all videos in the loaded root directory, inspecting previews,
 * modifying clip names, moving them across tag subfolders, and adjusting intensity levels.
 */

import React, { useState, useMemo, useRef } from 'react';
import { 
  Search, 
  Filter, 
  Folder, 
  FolderOpen, 
  Tag, 
  Flame, 
  Play, 
  Pause, 
  Save, 
  Check, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  RefreshCw, 
  Layers, 
  Film, 
  Volume2, 
  VolumeX, 
  Edit2, 
  ArrowUpDown,
  Sparkles
} from 'lucide-react';
import { parseMediaFilename, renameAndMoveMediaFile } from '../utils/fileOperations.js';

const INTENSITY_OPTIONS = [
  { level: 1, label: '1 - Suave', color: '#10b981' },
  { level: 2, label: '2 - Moderado', color: '#06b6d4' },
  { level: 3, label: '3 - Intermedio', color: '#f59e0b' },
  { level: 4, label: '4 - Intenso', color: '#f97316' },
  { level: 5, label: '5 - Extremo', color: '#f43f5e' }
];

export function LocalMediaManagerTab({
  tagsList = [],
  rootDirHandle = null,
  dirName = '',
  onSelectDirectory,
  onRefreshLibrary
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('ALL');
  const [intensityFilter, setIntensityFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('name_asc');

  // Pending edits map: clipKey -> { baseName, tagName, customNewTag, intensity }
  const [edits, setEdits] = useState({});
  // Saving states map: clipKey -> { isSaving: bool, success: bool, error: string }
  const [savingStates, setSavingStates] = useState({});
  // Playing preview clipKey
  const [playingPreviewKey, setPlayingPreviewKey] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Flatten all clips into a unified array
  const allClips = useMemo(() => {
    if (!tagsList || tagsList.length === 0) return [];
    const list = [];
    for (const tagObj of tagsList) {
      if (tagObj.clips) {
        for (const clip of tagObj.clips) {
          list.push({
            ...clip,
            key: `${tagObj.tagName}/${clip.name}`
          });
        }
      }
    }
    return list;
  }, [tagsList]);

  // Unique list of tag names
  const availableTags = useMemo(() => {
    return tagsList.map(t => t.tagName);
  }, [tagsList]);

  // Filter and sort clips
  const filteredClips = useMemo(() => {
    return allClips.filter(clip => {
      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = clip.name.toLowerCase().includes(query);
        const matchesTag = clip.tagName.toLowerCase().includes(query);
        if (!matchesName && !matchesTag) return false;
      }

      // Tag filter
      if (tagFilter !== 'ALL' && clip.tagName !== tagFilter) {
        return false;
      }

      // Intensity filter
      if (intensityFilter !== 'ALL') {
        if (intensityFilter === 'NONE') {
          if (clip.intensity !== null && clip.intensity !== undefined) return false;
        } else {
          const targetLevel = parseInt(intensityFilter, 10);
          if (clip.intensity !== targetLevel) return false;
        }
      }

      return true;
    }).sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return a.name.localeCompare(b.name, undefined, { numeric: true });
        case 'name_desc':
          return b.name.localeCompare(a.name, undefined, { numeric: true });
        case 'intensity_desc':
          return (b.intensity || 0) - (a.intensity || 0);
        case 'intensity_asc':
          return (a.intensity || 0) - (b.intensity || 0);
        case 'tag':
          return a.tagName.localeCompare(b.tagName, undefined, { numeric: true });
        default:
          return 0;
      }
    });
  }, [allClips, searchQuery, tagFilter, intensityFilter, sortBy]);

  // Get current editing state for a clip
  const getClipEditState = (clip) => {
    const edit = edits[clip.key];
    const parsed = parseMediaFilename(clip.name);

    const baseName = edit?.baseName !== undefined ? edit.baseName : parsed.baseName;
    const tagName = edit?.tagName !== undefined ? edit.tagName : clip.tagName;
    const customNewTag = edit?.customNewTag !== undefined ? edit.customNewTag : '';
    const intensity = edit?.intensity !== undefined ? edit.intensity : clip.intensity;

    const effectiveTargetTag = tagName === '__NEW__' ? customNewTag.trim() : tagName;
    const isModified = (
      baseName !== parsed.baseName ||
      (effectiveTargetTag && effectiveTargetTag !== clip.tagName) ||
      intensity !== clip.intensity
    );

    return {
      baseName,
      ext: parsed.ext,
      isVoice: parsed.isVoice,
      isMusic: parsed.isMusic,
      tagName,
      customNewTag,
      effectiveTargetTag: effectiveTargetTag || clip.tagName,
      intensity,
      isModified
    };
  };

  // Update specific edit field
  const handleFieldChange = (clipKey, field, value) => {
    setEdits(prev => ({
      ...prev,
      [clipKey]: {
        ...prev[clipKey],
        [field]: value
      }
    }));
  };

  // Save changes for a single clip
  const handleSaveClip = async (clip) => {
    if (!rootDirHandle) {
      alert('Debes seleccionar o cargar una carpeta raíz para guardar cambios.');
      return;
    }

    const editState = getClipEditState(clip);
    if (!editState.isModified) return;

    const clipKey = clip.key;
    setSavingStates(prev => ({
      ...prev,
      [clipKey]: { isSaving: true, success: false, error: null }
    }));

    try {
      const result = await renameAndMoveMediaFile({
        rootDirHandle,
        currentFolderHandle: clip.folderHandle,
        fileHandle: clip.handle,
        currentFileName: clip.name,
        newBaseName: editState.baseName,
        currentTagName: clip.tagName,
        newTagName: editState.effectiveTargetTag,
        newIntensity: editState.intensity
      });

      // Clear edit cache for this clip
      setEdits(prev => {
        const next = { ...prev };
        delete next[clipKey];
        return next;
      });

      setSavingStates(prev => ({
        ...prev,
        [clipKey]: { isSaving: false, success: true, error: null }
      }));

      // Refresh BMO library
      if (onRefreshLibrary) {
        await onRefreshLibrary(rootDirHandle);
      }

      // Clear success message after 2.5s
      setTimeout(() => {
        setSavingStates(prev => ({
          ...prev,
          [clipKey]: { isSaving: false, success: false, error: null }
        }));
      }, 2500);

    } catch (err) {
      console.error(`Error guardando clip ${clip.name}:`, err);
      setSavingStates(prev => ({
        ...prev,
        [clipKey]: { isSaving: false, success: false, error: err.message || 'Error al guardar cambios' }
      }));
    }
  };

  // Delete clip from disk
  const handleDeleteClip = async (clip) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar "${clip.name}" del disco? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      if (clip.folderHandle) {
        await clip.folderHandle.removeEntry(clip.name);
      } else if (rootDirHandle) {
        const folder = await rootDirHandle.getDirectoryHandle(clip.tagName, { create: false });
        await folder.removeEntry(clip.name);
      }
      if (onRefreshLibrary && rootDirHandle) {
        await onRefreshLibrary(rootDirHandle);
      }
    } catch (err) {
      console.error('Error al eliminar archivo:', err);
      alert(`No se pudo eliminar el archivo: ${err.message}`);
    }
  };

  // Manual refresh button
  const handleManualRefresh = async () => {
    if (!rootDirHandle || !onRefreshLibrary) return;
    setIsRefreshing(true);
    try {
      await onRefreshLibrary(rootDirHandle);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="media-manager-container">
      {/* Top Directory & Filter Controls Bar */}
      <div className="manager-toolbar">
        {/* Directory Selector / Indicator */}
        <div className="manager-dir-indicator">
          <Folder size={16} color="#818cf8" />
          <div className="manager-dir-text">
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Carpeta Raíz Activa:</span>
            <strong className="dir-name-truncate" style={{ fontSize: '0.84rem', color: '#f8fafc' }}>
              {dirName ? `📂 ${dirName}` : 'Ninguna carpeta seleccionada'}
            </strong>
          </div>
          {onSelectDirectory && (
            <button 
              className="btn-select-dir-mini" 
              onClick={onSelectDirectory}
              title="Cambiar carpeta raíz"
            >
              <FolderOpen size={14} />
              <span>Cambiar</span>
            </button>
          )}
          {rootDirHandle && (
            <button
              className="btn-refresh-mini"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              title="Volver a escanear carpeta"
            >
              <RefreshCw size={14} className={isRefreshing ? 'spin-icon' : ''} />
            </button>
          )}
        </div>

        {/* Search & Filters */}
        <div className="manager-filters-row">
          {/* Search box */}
          <div className="manager-search-box">
            <Search size={14} color="#94a3b8" />
            <input 
              type="text" 
              placeholder="Buscar por nombre o tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="manager-search-input"
            />
            {searchQuery && (
              <button className="btn-clear-search" onClick={() => setSearchQuery('')}>×</button>
            )}
          </div>

          {/* Filter by Tag */}
          <div className="manager-filter-select-wrapper">
            <Tag size={13} color="#a855f7" />
            <select
              className="manager-filter-select"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
            >
              <option value="ALL">Todos los Tags ({availableTags.length})</option>
              {availableTags.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Filter by Intensity */}
          <div className="manager-filter-select-wrapper">
            <Flame size={13} color="#f43f5e" />
            <select
              className="manager-filter-select"
              value={intensityFilter}
              onChange={(e) => setIntensityFilter(e.target.value)}
            >
              <option value="ALL">Toda Intensidad</option>
              <option value="NONE">Sin calificar</option>
              <option value="1">Nivel 1 - Suave</option>
              <option value="2">Nivel 2 - Moderado</option>
              <option value="3">Nivel 3 - Intermedio</option>
              <option value="4">Nivel 4 - Intenso</option>
              <option value="5">Nivel 5 - Extremo</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="manager-filter-select-wrapper">
            <ArrowUpDown size={13} color="#06b6d4" />
            <select
              className="manager-filter-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="name_asc">Nombre (A-Z)</option>
              <option value="name_desc">Nombre (Z-A)</option>
              <option value="intensity_desc">Mayor Intensidad</option>
              <option value="intensity_asc">Menor Intensidad</option>
              <option value="tag">Por Carpeta / Tag</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats line */}
      <div className="manager-stats-bar">
        <span>Mostrando <strong>{filteredClips.length}</strong> de <strong>{allClips.length}</strong> videos</span>
        {filteredClips.length < allClips.length && (
          <span style={{ color: '#06b6d4', fontSize: '0.75rem' }}>(Filtros activos)</span>
        )}
      </div>

      {/* Video Cards Grid / List */}
      <div className="manager-clips-scroll-area">
        {allClips.length === 0 ? (
          <div className="queue-empty-state">
            <FolderOpen size={36} color="#64748b" style={{ marginBottom: '8px' }} />
            <div style={{ fontWeight: 600, color: '#e2e8f0' }}>No se encontraron videos en la carpeta actual.</div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>
              Carga una carpeta con subcarpetas de videos o utiliza la pestaña de descarga de RedGifs.
            </div>
          </div>
        ) : filteredClips.length === 0 ? (
          <div className="queue-empty-state">
            <Filter size={32} color="#64748b" style={{ marginBottom: '8px' }} />
            <div>No hay videos que coincidan con la búsqueda o filtros seleccionados.</div>
          </div>
        ) : (
          filteredClips.map((clip) => {
            const editState = getClipEditState(clip);
            const savingState = savingStates[clip.key] || {};
            const isPlayingPreview = playingPreviewKey === clip.key;

            return (
              <div 
                key={clip.key} 
                className={`manager-clip-card ${editState.isModified ? 'card-modified' : ''}`}
              >
                {/* Video Preview Box */}
                <div className="manager-preview-col">
                  {clip.type === 'video' ? (
                    <div className="manager-video-thumb-container">
                      <video
                        src={clip.url}
                        className="manager-video-preview"
                        muted
                        loop
                        playsInline
                        ref={(el) => {
                          if (el) {
                            if (isPlayingPreview) el.play().catch(() => {});
                            else el.pause();
                          }
                        }}
                      />
                      <button
                        className="btn-toggle-preview"
                        onClick={() => setPlayingPreviewKey(isPlayingPreview ? null : clip.key)}
                        title={isPlayingPreview ? 'Pausar vista previa' : 'Reproducir vista previa'}
                      >
                        {isPlayingPreview ? <Pause size={13} /> : <Play size={13} />}
                      </button>
                    </div>
                  ) : (
                    <img src={clip.url} alt={clip.name} className="manager-video-preview" />
                  )}

                  {/* Audio flag badge */}
                  <div className="manager-audio-flags">
                    {editState.isVoice && (
                      <span className="queue-audio-pill with-audio" title="Audio ducking de voz activado">
                        <Volume2 size={10} /> Voz
                      </span>
                    )}
                    {editState.isMusic && (
                      <span className="queue-audio-pill with-audio" title="Pausa la música de fondo">
                        <Volume2 size={10} /> Música
                      </span>
                    )}
                    {!editState.isVoice && !editState.isMusic && (
                      <span className="queue-audio-pill silent">
                        <VolumeX size={10} /> Sin etiqueta
                      </span>
                    )}
                  </div>
                </div>

                {/* Edit Fields Column */}
                <div className="manager-fields-col">
                  {/* Row 1: File Name Edit */}
                  <div className="manager-field-row">
                    <label className="manager-field-label">
                      <Edit2 size={12} color="#818cf8" />
                      <span>Nombre:</span>
                    </label>
                    <div className="manager-name-input-group">
                      <input
                        type="text"
                        className="manager-name-input"
                        value={editState.baseName}
                        onChange={(e) => handleFieldChange(clip.key, 'baseName', e.target.value)}
                        placeholder="Nombre del archivo..."
                      />
                      <span className="manager-ext-badge">{editState.ext}</span>
                    </div>
                  </div>

                  {/* Row 2: Tag / Folder Move Edit */}
                  <div className="manager-field-row">
                    <label className="manager-field-label">
                      <Tag size={12} color="#a855f7" />
                      <span>Carpeta / Tag:</span>
                    </label>
                    <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
                      <select
                        className="manager-tag-select"
                        value={editState.tagName}
                        onChange={(e) => handleFieldChange(clip.key, 'tagName', e.target.value)}
                      >
                        {availableTags.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                        <option value="__NEW__">+ Mover a nueva subcarpeta...</option>
                      </select>

                      {editState.tagName === '__NEW__' && (
                        <input
                          type="text"
                          className="manager-custom-tag-input"
                          placeholder="Nombre de la nueva carpeta..."
                          value={editState.customNewTag}
                          onChange={(e) => handleFieldChange(clip.key, 'customNewTag', e.target.value)}
                          autoFocus
                        />
                      )}
                    </div>
                  </div>

                  {/* Row 3: Intensity Rate Selector (1-5) */}
                  <div className="manager-field-row">
                    <label className="manager-field-label">
                      <Flame size={12} color="#f43f5e" />
                      <span>Intensidad:</span>
                    </label>
                    <div className="manager-intensity-chips">
                      {INTENSITY_OPTIONS.map(opt => {
                        const isSelected = editState.intensity === opt.level;
                        return (
                          <button
                            key={opt.level}
                            type="button"
                            className={`manager-intensity-chip ${isSelected ? 'active' : ''}`}
                            style={{
                              borderColor: isSelected ? opt.color : 'rgba(255,255,255,0.1)',
                              backgroundColor: isSelected ? `${opt.color}28` : 'rgba(255,255,255,0.03)',
                              color: isSelected ? '#ffffff' : '#94a3b8'
                            }}
                            onClick={() => handleFieldChange(clip.key, 'intensity', isSelected ? null : opt.level)}
                            title={opt.label}
                          >
                            <Flame size={11} color={opt.color} />
                            <span>{opt.level}</span>
                          </button>
                        );
                      })}

                      {editState.intensity && (
                        <button
                          type="button"
                          className="btn-clear-intensity"
                          onClick={() => handleFieldChange(clip.key, 'intensity', null)}
                          title="Quitar calificación de intensidad"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions Column (Save & Delete) */}
                <div className="manager-actions-col">
                  {savingState.isSaving ? (
                    <div className="manager-status-saving">
                      <RefreshCw size={15} className="spin-icon" color="#06b6d4" />
                      <span>Guardando...</span>
                    </div>
                  ) : savingState.success ? (
                    <div className="manager-status-success">
                      <CheckCircle2 size={16} color="#10b981" />
                      <span>¡Actualizado!</span>
                    </div>
                  ) : savingState.error ? (
                    <div className="manager-status-error" title={savingState.error}>
                      <AlertCircle size={15} color="#f43f5e" />
                      <span className="error-text-truncate">Error al guardar</span>
                    </div>
                  ) : (
                    <button
                      className={`btn-save-clip ${editState.isModified ? 'modified-ready' : 'disabled'}`}
                      onClick={() => handleSaveClip(clip)}
                      disabled={!editState.isModified}
                      title={editState.isModified ? 'Guardar cambios en el archivo' : 'Sin cambios pendientes'}
                    >
                      <Save size={14} />
                      <span>Guardar</span>
                    </button>
                  )}

                  <button
                    className="btn-delete-clip"
                    onClick={() => handleDeleteClip(clip)}
                    title="Eliminar este video del disco"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
