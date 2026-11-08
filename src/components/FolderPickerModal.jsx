/**
 * Folder Picker & Landing Modal Component
 * Allows directory selection via File System Access API or standard webkitdirectory fallback.
 */

import React, { useState } from 'react';
import { FolderOpen, UploadCloud, Info, AlertTriangle, Disc, Film, Sparkles, DownloadCloud } from 'lucide-react';
import { scanDirectoryHandle, scanFileInput } from '../utils/fileScanner';

export function FolderPickerModal({ onScanComplete, onOpenRedGifsDownloader }) {
  const [errorMsg, setErrorMsg] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Native File System Access API (showDirectoryPicker)
  const handleNativeDirectoryPicker = async () => {
    setErrorMsg(null);
    if (!window.showDirectoryPicker) {
      setErrorMsg("Tu navegador no soporta showDirectoryPicker. Usa el botón de carga secundaria.");
      return;
    }

    try {
      setIsLoading(true);
      const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
      const result = await scanDirectoryHandle(dirHandle);

      if (!result.tags || result.tags.length === 0) {
        setErrorMsg("La carpeta seleccionada no contiene clips de video (.mp4, .webm) o GIFs (.gif) organizados en subcarpetas.");
        setIsLoading(false);
        return;
      }

      onScanComplete(result);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error("Error al abrir directorio:", err);
        setErrorMsg("Ocurrió un error al leer la carpeta. Verifica los permisos de archivo.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Webkitdirectory fallback input change
  const handleFallbackInputChange = (e) => {
    setErrorMsg(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsLoading(true);
      const result = scanFileInput(files);

      if (!result.tags || result.tags.length === 0) {
        setErrorMsg("No se encontraron clips (.mp4, .webm, .gif) válidos en la estructura de la carpeta.");
        setIsLoading(false);
        return;
      }

      onScanComplete(result);
    } catch (err) {
      console.error("Error al procesar archivos:", err);
      setErrorMsg("Error al procesar la lista de archivos.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div>
          <h1 className="brand-title">BMO Session Player</h1>
          <p className="brand-description">
            Plataforma local inmersiva de reproducción multimedia y audio dual inteligente.
          </p>
        </div>

        {errorMsg && (
          <div className="empty-warning" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="picker-actions">
          <button 
            className="btn-primary" 
            onClick={handleNativeDirectoryPicker} 
            disabled={isLoading}
          >
            <FolderOpen size={20} />
            <span>{isLoading ? 'Escaneando Carpeta...' : 'Cargar Carpeta Raíz (API Nativa)'}</span>
          </button>

          <label className="btn-secondary" style={{ cursor: 'pointer' }}>
            <UploadCloud size={18} />
            <span>Cargar Carpeta (Fallback Navegador)</span>
            <input 
              type="file" 
              webkitdirectory="true" 
              directory="true" 
              multiple 
              onChange={handleFallbackInputChange} 
              style={{ display: 'none' }}
            />
          </label>

          <button 
            className="btn-redgifs-landing"
            onClick={onOpenRedGifsDownloader}
            type="button"
          >
            <DownloadCloud size={18} color="#f43f5e" />
            <span>Descargar Videos de RedGifs</span>
          </button>
        </div>

        <div className="folder-tree-guide">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: '#c7d2fe', fontWeight: 600 }}>
            <Info size={14} /> Estructura Recomendada de Archivos:
          </div>
          <pre>
{`Mi_Coleccion_Raiz/
 ├── 01_anal/        -> clips (.mp4, .gif, [music].mp4)
 ├── 02_lesbian/     -> clips (.mp4, _voice.mp4)
 ├── 03_dolls/       -> clips (.gif)
 └── Audio_Tracks/   -> musica/pistas (.mp3, .wav)`}
          </pre>
        </div>

        <div className="controls-grid">
          <div className="control-item">
            <span>Siguiente / Previo Video</span>
            <span className="key-badge">← / →</span>
          </div>
          <div className="control-item">
            <span>Cambiar Tag (Categoría)</span>
            <span className="key-badge">N / B (Mando A/B)</span>
          </div>
          <div className="control-item">
            <span>Cambiar Pista de Audio</span>
            <span className="key-badge">PgDn / PgUp</span>
          </div>
          <div className="control-item">
            <span>Ocultar / Mostrar HUD</span>
            <span className="key-badge">H</span>
          </div>
        </div>
      </div>
    </div>
  );
}
