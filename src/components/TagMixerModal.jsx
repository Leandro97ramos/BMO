/**
 * Tag Mixer Modal Component
 * Slider configuration interface for custom tag percentage distribution.
 */

import React, { useState } from 'react';
import { Sliders, Shuffle, Check, RotateCcw, X, Info } from 'lucide-react';
import { getEqualWeights } from '../utils/playlistGenerator';

export function TagMixerModal({ tagsList, currentWeights, onSaveMix, onClose }) {
  const [weights, setWeights] = useState(() => {
    if (currentWeights && Object.keys(currentWeights).length > 0) {
      return { ...currentWeights };
    }
    return getEqualWeights(tagsList);
  });

  const handleSliderChange = (tagName, value) => {
    const val = parseInt(value, 10) || 0;
    setWeights(prev => ({
      ...prev,
      [tagName]: val
    }));
  };

  const handleEqualize = () => {
    setWeights(getEqualWeights(tagsList));
  };

  const handleReset = () => {
    const zeroWeights = {};
    tagsList.forEach(t => zeroWeights[t.tagName] = 0);
    setWeights(zeroWeights);
  };

  const totalSum = Object.values(weights).reduce((a, b) => a + b, 0);

  const handleSave = () => {
    onSaveMix(weights);
    onClose();
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 120 }}>
      <div className="modal-card" style={{ maxWidth: '680px', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders size={24} style={{ color: '#818cf8' }} />
            <h2 className="brand-title" style={{ fontSize: '1.6rem' }}>Configurar Mezcla de Tags</h2>
          </div>
          <button 
            onClick={onClose} 
            className="tag-scroll-btn"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            <X size={18} />
          </button>
        </div>

        <p className="brand-description" style={{ textAlign: 'left', marginTop: '-8px' }}>
          Asigna el porcentaje de frecuencia deseado a cada carpeta. El motor generará una lista unificada respetando estas proporciones.
        </p>

        {/* Action Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.4)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Suma Total:</span>
            <span style={{ 
              fontWeight: 700, 
              fontSize: '1rem',
              color: totalSum === 100 ? '#10b981' : totalSum > 0 ? '#f59e0b' : '#f43f5e',
              fontFamily: 'var(--font-mono)' 
            }}>
              {totalSum}%
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-secondary" onClick={handleEqualize} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
              <Shuffle size={14} /> Equilibrar (100%)
            </button>
            <button className="btn-secondary" onClick={handleReset} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
              <RotateCcw size={14} /> Poner a 0%
            </button>
          </div>
        </div>

        {/* Sliders Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', margin: '10px 0' }}>
          {tagsList.map(tagObj => {
            const val = weights[tagObj.tagName] || 0;
            return (
              <div 
                key={tagObj.tagName} 
                style={{ 
                  background: 'rgba(255, 255, 255, 0.03)', 
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.92rem' }}>
                    📁 {tagObj.tagName} <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 400 }}>({tagObj.clips.length} clips)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input 
                      type="number"
                      min="0"
                      max="100"
                      value={val}
                      onChange={(e) => handleSliderChange(tagObj.tagName, e.target.value)}
                      style={{
                        width: '56px',
                        background: 'rgba(0,0,0,0.5)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: '6px',
                        color: '#c7d2fe',
                        padding: '4px 6px',
                        textAlign: 'center',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.85rem'
                      }}
                    />
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>%</span>
                  </div>
                </div>

                {/* Range Slider */}
                <input 
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={val}
                  onChange={(e) => handleSliderChange(tagObj.tagName, e.target.value)}
                  style={{
                    width: '100%',
                    accentColor: 'var(--accent-primary)',
                    cursor: 'pointer'
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Footer Save Button */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
          <button className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={handleSave} style={{ flex: 2 }}>
            <Check size={18} /> Iniciar Mezcla Ponderada
          </button>
        </div>
      </div>
    </div>
  );
}
