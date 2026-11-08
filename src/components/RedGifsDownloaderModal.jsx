/**
 * RedGifs Batch Downloader Modal Component for BMO
 * Allows downloading multiple videos from RedGifs via URLs or IDs,
 * assigning destination tags (subfolders), configuring intensity ratings (1-5),
 * and directly saving files locally using the File System Access API.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Download, 
  DownloadCloud, 
  Flame, 
  Tag, 
  Folder, 
  FolderOpen, 
  Check, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  RefreshCw, 
  Trash2, 
  Volume2, 
  VolumeX, 
  Sparkles,
  ExternalLink,
  Plus,
  Film
} from 'lucide-react';
import { 
  extractRedGifsIds, 
  fetchGifMetadata, 
  downloadVideoBlob, 
  buildBmoFilename, 
  saveVideoToDirectory, 
  triggerBrowserDownload 
} from '../utils/redgifsService';
import { LocalMediaManagerTab } from './LocalMediaManagerTab';

const INTENSITY_LEVELS = [
  { level: 1, label: 'Suave', color: '#10b981', desc: 'Leve / Tease' },
  { level: 2, label: 'Moderado', color: '#06b6d4', desc: 'Medio / Casual' },
  { level: 3, label: 'Intermedio', color: '#f59e0b', desc: 'Estándar / Rítmico' },
  { level: 4, label: 'Intenso', color: '#f97316', desc: 'Fuerte / Alta energía' },
  { level: 5, label: 'Extremo', color: '#f43f5e', desc: 'Máxima intensidad' }
];

export function RedGifsDownloaderModal({ 
  existingTags = [], 
  activeDirHandle = null, 
  onClose, 
  onLibraryUpdated 
}) {
  const [activeTab, setActiveTab] = useState('DOWNLOADER'); // 'DOWNLOADER' | 'LIBRARY'
  const [urlInput, setUrlInput] = useState('');
  const [targetDirHandle, setTargetDirHandle] = useState(activeDirHandle);
  const [dirName, setDirName] = useState(activeDirHandle ? activeDirHandle.name : null);
  
  // Batch Defaults
  const [batchTag, setBatchTag] = useState(existingTags.length > 0 ? existingTags[0].tagName : '01_RedGifs');
  const [customTagInput, setCustomTagInput] = useState('');
  const [batchIntensity, setBatchIntensity] = useState(3);

  // Queue of items
  const [queue, setQueue] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [activeDownloadIndex, setActiveDownloadIndex] = useState(-1);
  const [downloadSuccessCount, setDownloadSuccessCount] = useState(0);
  const [generalError, setGeneralError] = useState(null);

  const abortControllerRef = useRef(null);

  // Sync if activeDirHandle changes
  useEffect(() => {
    if (activeDirHandle && !targetDirHandle) {
      setTargetDirHandle(activeDirHandle);
      setDirName(activeDirHandle.name);
    }
  }, [activeDirHandle]);

  // Handler to pick a custom destination directory
  const handleSelectDirectory = async () => {
    setGeneralError(null);
    if (!window.showDirectoryPicker) {
      setGeneralError('Tu navegador no soporta showDirectoryPicker. Las descargas usarán el método del navegador.');
      return;
    }

    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      setTargetDirHandle(handle);
      setDirName(handle.name);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error al seleccionar directorio:', err);
        setGeneralError('No se pudo acceder al directorio seleccionado.');
      }
    }
  };

  // Parse URLs and fetch metadata for queue
  const handleParseUrls = async () => {
    setGeneralError(null);
    const ids = extractRedGifsIds(urlInput);
    if (ids.length === 0) {
      setGeneralError('No se detectaron URLs o IDs válidos de RedGifs. Pega enlaces como https://www.redgifs.com/watch/id o el ID directo.');
      return;
    }

    setIsParsing(true);
    const existingIds = new Set(queue.map(q => q.id));
    const newIds = ids.filter(id => !existingIds.has(id));

    if (newIds.length === 0) {
      setGeneralError('Todos los videos ingresados ya están en la cola de descarga.');
      setIsParsing(false);
      return;
    }

    const newQueueItems = newIds.map(id => ({
      id,
      title: id,
      thumbnail: null,
      duration: null,
      hasAudio: false,
      redgifsTags: [],
      hdUrl: null,
      sdUrl: null,
      status: 'pending', // 'pending', 'fetching_info', 'ready', 'downloading', 'completed', 'error'
      progress: 0,
      assignedTag: customTagInput.trim() || batchTag,
      assignedIntensity: batchIntensity,
      errorMsg: null
    }));

    // Add them to state first
    setQueue(prev => [...prev, ...newQueueItems]);
    setUrlInput('');

    // Concurrently fetch metadata for newly added items
    for (const item of newQueueItems) {
      try {
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'fetching_info' } : q));
        const meta = await fetchGifMetadata(item.id);
        
        setQueue(prev => prev.map(q => {
          if (q.id === item.id) {
            return {
              ...q,
              title: meta.title,
              thumbnail: meta.thumbnail,
              duration: meta.duration,
              hasAudio: meta.hasAudio,
              redgifsTags: meta.tags,
              hdUrl: meta.hdUrl,
              sdUrl: meta.sdUrl,
              status: 'ready'
            };
          }
          return q;
        }));
      } catch (err) {
        console.warn(`Error obteniendo datos para ${item.id}:`, err);
        setQueue(prev => prev.map(q => {
          if (q.id === item.id) {
            return {
              ...q,
              status: 'error',
              errorMsg: err.message || 'Error al obtener información'
            };
          }
          return q;
        }));
      }
    }

    setIsParsing(false);
  };

  // Remove single item from queue
  const handleRemoveItem = (id) => {
    setQueue(prev => prev.filter(q => q.id !== id));
  };

  // Clear all completed
  const handleClearCompleted = () => {
    setQueue(prev => prev.filter(q => q.status !== 'completed'));
  };

  // Update item tag
  const handleUpdateItemTag = (id, newTag) => {
    setQueue(prev => prev.map(q => q.id === id ? { ...q, assignedTag: newTag } : q));
  };

  // Update item intensity
  const handleUpdateItemIntensity = (id, newIntensity) => {
    setQueue(prev => prev.map(q => q.id === id ? { ...q, assignedIntensity: newIntensity } : q));
  };

  // Start Batch Download process
  const handleStartDownloads = async () => {
    setGeneralError(null);
    const readyItems = queue.filter(q => q.status === 'ready' || q.status === 'pending');

    if (readyItems.length === 0) {
      setGeneralError('No hay videos listos para descargar en la cola.');
      return;
    }

    if (!targetDirHandle && window.showDirectoryPicker) {
      // Prompt user to pick destination if not chosen yet
      try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        setTargetDirHandle(handle);
        setDirName(handle.name);
      } catch (err) {
        if (err.name === 'AbortError') return;
        setGeneralError('Debes seleccionar una carpeta de destino para guardar los videos.');
        return;
      }
    }

    setIsDownloading(true);
    abortControllerRef.current = false;
    let successfulCount = 0;

    for (let i = 0; i < queue.length; i++) {
      if (abortControllerRef.current) break;

      const currentItem = queue[i];
      if (currentItem.status === 'completed') continue;

      setActiveDownloadIndex(i);

      try {
        let meta = currentItem;
        if (!meta.hdUrl) {
          // If metadata wasn't fetched yet
          setQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'fetching_info' } : q));
          const fetched = await fetchGifMetadata(currentItem.id);
          meta = { ...currentItem, ...fetched };
        }

        const downloadUrl = meta.hdUrl || meta.sdUrl;
        if (!downloadUrl) {
          throw new Error('No se encontró URL de video válida para descargar.');
        }

        // Set status to downloading
        setQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'downloading', progress: 0 } : q));

        const blob = await downloadVideoBlob(downloadUrl, (percent) => {
          setQueue(prev => prev.map((q, idx) => idx === i ? { ...q, progress: percent } : q));
        });

        // Generate filename with intensity and audio ducking tag
        const filename = buildBmoFilename(meta.id, meta.assignedIntensity, meta.hasAudio);
        const destinationTag = meta.assignedTag || batchTag || '00_General';

        // Save file
        if (targetDirHandle) {
          await saveVideoToDirectory(targetDirHandle, destinationTag, filename, blob);
        } else {
          triggerBrowserDownload(blob, filename);
        }

        setQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'completed', progress: 100 } : q));
        successfulCount++;
        setDownloadSuccessCount(prev => prev + 1);

      } catch (err) {
        console.error(`Error descargando ${currentItem.id}:`, err);
        setQueue(prev => prev.map((q, idx) => idx === i ? { 
          ...q, 
          status: 'error', 
          errorMsg: err.message || 'Error en la descarga' 
        } : q));
      }
    }

    setIsDownloading(false);
    setActiveDownloadIndex(-1);

    // If destination was the active BMO directory, refresh library
    if (successfulCount > 0 && targetDirHandle && onLibraryUpdated) {
      onLibraryUpdated(targetDirHandle);
    }
  };

  const handleCancelDownload = () => {
    abortControllerRef.current = true;
    setIsDownloading(false);
  };

  const selectedIntensityObj = INTENSITY_LEVELS.find(l => l.level === batchIntensity) || INTENSITY_LEVELS[2];

  const totalLocalClips = useMemo(() => {
    return existingTags.reduce((sum, t) => sum + (t.clips ? t.clips.length : 0), 0);
  }, [existingTags]);

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-card redgifs-modal-card">
        {/* Modal Header */}
        <div className="redgifs-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="redgifs-logo-icon">
              <DownloadCloud size={24} color="#f43f5e" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Gestor Multimedia & RedGifs
                <span className="redgifs-badge">BMO Session</span>
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                Descarga videos por lote, organiza en subcarpetas de tags y edita nombres e intensidad.
              </p>
            </div>
          </div>
          <button className="icon-btn-close" onClick={onClose} title="Cerrar ventana">
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="redgifs-tabs-bar">
          <button
            type="button"
            className={`redgifs-tab-btn ${activeTab === 'DOWNLOADER' ? 'active' : ''}`}
            onClick={() => setActiveTab('DOWNLOADER')}
          >
            <DownloadCloud size={16} />
            <span>Descargar de RedGifs</span>
          </button>
          <button
            type="button"
            className={`redgifs-tab-btn ${activeTab === 'LIBRARY' ? 'active' : ''}`}
            onClick={() => setActiveTab('LIBRARY')}
          >
            <Film size={16} />
            <span>Videos en Carpeta Raíz</span>
            {totalLocalClips > 0 && (
              <span className="tab-count-badge">{totalLocalClips}</span>
            )}
          </button>
        </div>

        {activeTab === 'LIBRARY' ? (
          <LocalMediaManagerTab
            tagsList={existingTags}
            rootDirHandle={targetDirHandle}
            dirName={dirName}
            onSelectDirectory={handleSelectDirectory}
            onRefreshLibrary={onLibraryUpdated}
          />
        ) : (
          <>
            {/* General Error Banner */}
            {generalError && (
              <div className="empty-warning" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <AlertCircle size={18} color="#f43f5e" />
                <span style={{ fontSize: '0.88rem' }}>{generalError}</span>
              </div>
            )}

            {/* Global Settings & Configuration Bar */}
            <div className="downloader-settings-grid">
          {/* 1. Destination Folder Selector */}
          <div className="setting-card">
            <div className="setting-card-title">
              <Folder size={16} style={{ color: '#818cf8' }} />
              <span>Lugar de Guardado</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button 
                className="btn-select-dir"
                onClick={handleSelectDirectory}
                disabled={isDownloading}
                title="Seleccionar carpeta donde se crearán las subcarpetas de tags"
              >
                <FolderOpen size={16} />
                <span className="dir-name-truncate">
                  {dirName ? `📂 ${dirName}` : 'Seleccionar Carpeta Destino'}
                </span>
              </button>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
              Los videos se guardarán en: <code>/{batchTag || 'tag'}/...</code>
            </div>
          </div>

          {/* 2. Destination Tag Selector */}
          <div className="setting-card">
            <div className="setting-card-title">
              <Tag size={16} style={{ color: '#a855f7' }} />
              <span>Tag / Subcarpeta Destino</span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {existingTags.length > 0 ? (
                <select 
                  className="tag-select-input"
                  value={batchTag}
                  onChange={(e) => {
                    setBatchTag(e.target.value);
                    setCustomTagInput('');
                  }}
                  disabled={isDownloading}
                >
                  {existingTags.map(t => (
                    <option key={t.tagName} value={t.tagName}>{t.tagName}</option>
                  ))}
                  <option value="__NEW__">+ Crear nueva subcarpeta...</option>
                </select>
              ) : null}

              {(existingTags.length === 0 || batchTag === '__NEW__') && (
                <input 
                  type="text" 
                  className="custom-tag-input"
                  placeholder="Ej: 01_anal, cosplay, etc."
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  disabled={isDownloading}
                />
              )}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
              Se creará la carpeta con este nombre si aún no existe.
            </div>
          </div>

          {/* 3. Intensity Rate Selector (1-5) */}
          <div className="setting-card">
            <div className="setting-card-title">
              <Flame size={16} style={{ color: selectedIntensityObj.color }} />
              <span>Nivel de Intensidad: <strong style={{ color: selectedIntensityObj.color }}>{batchIntensity} - {selectedIntensityObj.label}</strong></span>
            </div>
            <div className="intensity-buttons-row">
              {INTENSITY_LEVELS.map(lvl => {
                const isSelected = batchIntensity === lvl.level;
                return (
                  <button
                    key={lvl.level}
                    type="button"
                    className={`intensity-btn ${isSelected ? 'active' : ''}`}
                    style={{
                      borderColor: isSelected ? lvl.color : 'rgba(255,255,255,0.1)',
                      backgroundColor: isSelected ? `${lvl.color}33` : 'rgba(255,255,255,0.04)',
                      color: isSelected ? '#ffffff' : '#94a3b8'
                    }}
                    onClick={() => setBatchIntensity(lvl.level)}
                    disabled={isDownloading}
                    title={`${lvl.label}: ${lvl.desc}`}
                  >
                    <Flame size={13} style={{ color: lvl.color }} />
                    <span>{lvl.level}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
              Se grabará como <code>[int-{batchIntensity}]</code> en el archivo.
            </div>
          </div>
        </div>

        {/* URLs Multi-line Input Box */}
        <div className="url-input-container">
          <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>Pega las URLs de RedGifs (puedes pegar varias a la vez):</span>
            <span style={{ color: '#64748b' }}>Una por línea o separadas por espacios/comas</span>
          </label>
          <textarea
            className="url-textarea"
            rows={3}
            placeholder={`https://www.redgifs.com/watch/cleandecisivedingo\nhttps://www.redgifs.com/watch/giftedleftwaterstrider\n...`}
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            disabled={isDownloading || isParsing}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button
              className="btn-parse-urls"
              onClick={handleParseUrls}
              disabled={isParsing || isDownloading || !urlInput.trim()}
            >
              {isParsing ? <RefreshCw size={15} className="spin-icon" /> : <Plus size={15} />}
              <span>{isParsing ? 'Procesando Enlaces...' : 'Agregar a la Cola'}</span>
            </button>
          </div>
        </div>

        {/* Queue List Table / Items */}
        <div className="queue-container">
          <div className="queue-header">
            <span style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.85rem' }}>
              Cola de Descarga ({queue.length} videos)
            </span>
            {queue.some(q => q.status === 'completed') && (
              <button className="btn-clear-completed" onClick={handleClearCompleted} disabled={isDownloading}>
                <Trash2 size={13} />
                <span>Limpiar completados</span>
              </button>
            )}
          </div>

          <div className="queue-scroll-area">
            {queue.length === 0 ? (
              <div className="queue-empty-state">
                <Sparkles size={28} style={{ color: '#64748b', marginBottom: '6px' }} />
                <div>No hay videos en la cola.</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Pega una o más URLs de RedGifs arriba y haz clic en "Agregar a la Cola".
                </div>
              </div>
            ) : (
              queue.map((item, idx) => {
                const itemIntensityObj = INTENSITY_LEVELS.find(l => l.level === item.assignedIntensity) || selectedIntensityObj;

                return (
                  <div 
                    key={item.id} 
                    className={`queue-item-card ${activeDownloadIndex === idx ? 'downloading-active' : ''}`}
                  >
                    {/* Thumbnail */}
                    <div className="queue-thumb-wrapper">
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt={item.id} className="queue-thumb-img" />
                      ) : (
                        <div className="queue-thumb-placeholder">
                          <Film size={20} color="#64748b" />
                        </div>
                      )}
                      {item.duration ? (
                        <span className="queue-duration-badge">{item.duration}s</span>
                      ) : null}
                    </div>

                    {/* Metadata & Tag Info */}
                    <div className="queue-info-col">
                      <div className="queue-item-title-row">
                        <span className="queue-item-id">{item.id}</span>
                        {item.hasAudio ? (
                          <span className="queue-audio-pill with-audio" title="Contiene pista de audio (_[voice])">
                            <Volume2 size={12} /> Audio
                          </span>
                        ) : (
                          <span className="queue-audio-pill silent" title="Video silencioso">
                            <VolumeX size={12} /> Mudo
                          </span>
                        )}
                      </div>

                      {/* RedGifs Suggested Tags (Clickable to adopt) */}
                      {item.redgifsTags && item.redgifsTags.length > 0 && (
                        <div className="queue-tag-chips">
                          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Tags RedGifs:</span>
                          {item.redgifsTags.slice(0, 4).map(t => (
                            <button
                              key={t}
                              className="tag-chip-btn"
                              title={`Usar "${t}" como tag de destino`}
                              onClick={() => handleUpdateItemTag(item.id, t)}
                              disabled={isDownloading}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Destination and Intensity row */}
                      <div className="queue-item-controls-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Tag size={12} color="#a855f7" />
                          <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>Carpeta:</span>
                          <input
                            type="text"
                            className="queue-tag-inline-input"
                            value={item.assignedTag}
                            onChange={(e) => handleUpdateItemTag(item.id, e.target.value)}
                            disabled={isDownloading}
                          />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Flame size={12} color={itemIntensityObj.color} />
                          <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>Intensidad:</span>
                          <select
                            className="queue-intensity-select"
                            value={item.assignedIntensity}
                            onChange={(e) => handleUpdateItemIntensity(item.id, parseInt(e.target.value, 10))}
                            disabled={isDownloading}
                            style={{ color: itemIntensityObj.color }}
                          >
                            {INTENSITY_LEVELS.map(l => (
                              <option key={l.level} value={l.level}>{l.level} - {l.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Progress Bar if downloading */}
                      {item.status === 'downloading' && (
                        <div className="queue-progress-bar-container">
                          <div 
                            className="queue-progress-bar-fill" 
                            style={{ width: `${item.progress}%` }} 
                          />
                          <span className="queue-progress-text">{item.progress}%</span>
                        </div>
                      )}
                    </div>

                    {/* Status / Action Column */}
                    <div className="queue-status-col">
                      {item.status === 'completed' && (
                        <div className="status-badge-completed">
                          <CheckCircle2 size={18} color="#10b981" />
                          <span>Guardado</span>
                        </div>
                      )}
                      {item.status === 'downloading' && (
                        <div className="status-badge-downloading">
                          <RefreshCw size={16} className="spin-icon" color="#06b6d4" />
                          <span>Bajando</span>
                        </div>
                      )}
                      {item.status === 'fetching_info' && (
                        <div className="status-badge-fetching">
                          <RefreshCw size={14} className="spin-icon" color="#f59e0b" />
                          <span>Leyendo...</span>
                        </div>
                      )}
                      {item.status === 'ready' && (
                        <div className="status-badge-ready">
                          <span>Listo</span>
                        </div>
                      )}
                      {item.status === 'error' && (
                        <div className="status-badge-error" title={item.errorMsg}>
                          <AlertCircle size={16} color="#f43f5e" />
                          <span className="error-text-truncate">{item.errorMsg || 'Error'}</span>
                        </div>
                      )}

                      {!isDownloading && item.status !== 'downloading' && (
                        <button 
                          className="btn-remove-item"
                          onClick={() => handleRemoveItem(item.id)}
                          title="Quitar de la cola"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="redgifs-footer">
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            {downloadSuccessCount > 0 ? (
              <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Check size={14} /> {downloadSuccessCount} video(s) guardado(s) exitosamente.
              </span>
            ) : (
              <span>Configura los tags e inicia la descarga.</span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isDownloading ? (
              <button className="btn-secondary" onClick={handleCancelDownload}>
                <span>Detener Cola</span>
              </button>
            ) : (
              <button 
                className="btn-primary" 
                onClick={handleStartDownloads}
                disabled={queue.length === 0 || isParsing}
                style={{ 
                  background: 'linear-gradient(135deg, #f43f5e 0%, #a855f7 100%)',
                  boxShadow: '0 4px 15px rgba(244, 63, 94, 0.35)' 
                }}
              >
                <Download size={18} />
                <span>Iniciar Descarga Masiva ({queue.filter(q => q.status !== 'completed').length})</span>
              </button>
            )}
            <button className="btn-secondary" onClick={onClose} disabled={isDownloading}>
              <span>Cerrar</span>
            </button>
          </div>
        </div>
        </>
      )}
      </div>
    </div>
  );
}
