import { useState, useEffect } from 'react';
import { useBlade } from '../context/BladeContext';

export default function JsonImportModal({ isOpen, onClose }) {
  const { bladeParams, setBladeParams, designWindSpeed, setDesignWindSpeed, designTsr, setDesignTsr } = useBlade();

  const [jsonText, setJsonText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Pre-fill with current config when opened
  useEffect(() => {
    if (isOpen) {
      const currentConfig = {
        version: '1.0',
        name: 'AeroBlade 3D Pro Design',
        timestamp: new Date().toISOString(),
        windSpeed: designWindSpeed,
        tsr: designTsr,
        bladeParams: bladeParams,
      };
      setJsonText(JSON.stringify(currentConfig, null, 2));
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen, bladeParams, designWindSpeed, designTsr]);

  if (!isOpen) return null;

  const handleApply = () => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (!jsonText.trim()) {
        setErrorMsg('Please paste a valid JSON code snippet.');
        return;
      }
      const data = JSON.parse(jsonText.trim());

      let newParams = null;
      let newWind = null;
      let newTsr = null;

      if (data.bladeParams && typeof data.bladeParams === 'object') {
        newParams = data.bladeParams;
        if (data.windSpeed) newWind = parseFloat(data.windSpeed);
        if (data.tsr) newTsr = parseFloat(data.tsr);
      } else if (data.radiusMm && data.root && data.mid && data.tip) {
        newParams = data;
      } else {
        setErrorMsg('JSON structure must include "bladeParams" or "radiusMm", "root", "mid", and "tip" keys.');
        return;
      }

      // Validate required subfields
      if (!newParams.root || !newParams.mid || !newParams.tip) {
        setErrorMsg('Missing root, mid, or tip stations in blade configuration.');
        return;
      }

      setBladeParams(prev => ({
        ...prev,
        ...newParams,
        root: { ...prev.root, ...(newParams.root || {}) },
        mid: { ...prev.mid, ...(newParams.mid || {}) },
        tip: { ...prev.tip, ...(newParams.tip || {}) },
        carbonRodPosPct: newParams.carbonRodPosPct ?? prev.carbonRodPosPct ?? 30,
        carbonRodYOffsetMm: newParams.carbonRodYOffsetMm ?? prev.carbonRodYOffsetMm ?? 0,
      }));
      if (newWind && !isNaN(newWind)) setDesignWindSpeed(newWind);
      if (newTsr && !isNaN(newTsr)) setDesignTsr(newTsr);

      setSuccessMsg('✨ Configuration successfully applied to 3D CAD and BEM aerodynamic model!');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setErrorMsg(`JSON Syntax Error: ${err.message}`);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setJsonText(text);
        setErrorMsg('');
        setSuccessMsg('📋 Pasted from clipboard!');
      }
    } catch {
      setErrorMsg('Could not read from clipboard. Please paste manually into the editor.');
    }
  };

  const handleCopyClipboard = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      setSuccessMsg('📋 JSON copied to clipboard!');
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch {
      setErrorMsg('Could not copy to clipboard.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-secondary, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 680,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color, #334155)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-primary, #0f172a)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🤖</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main, #f8fafc)' }}>
                Import / Export JSON Design Code
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
                Paste AI-generated blade JSON from ChatGPT, Claude, Gemini, or DeepSeek
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #94a3b8)',
              fontSize: 22,
              cursor: 'pointer',
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        {/* Action Toolbar */}
        <div
          style={{
            padding: '10px 20px',
            display: 'flex',
            gap: 10,
            background: 'rgba(0, 0, 0, 0.2)',
            borderBottom: '1px solid var(--border-subtle, #1e293b)',
          }}
        >
          <button
            type="button"
            className="cp-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              padding: '6px 12px',
              borderRadius: 6,
              background: 'var(--bg-card, #334155)',
              color: 'var(--text-main, #f8fafc)',
              border: '1px solid var(--border-color, #475569)',
              cursor: 'pointer',
            }}
            onClick={handlePasteClipboard}
          >
            <span>📋</span> Paste from Clipboard
          </button>
          <button
            type="button"
            className="cp-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              padding: '6px 12px',
              borderRadius: 6,
              background: 'var(--bg-card, #334155)',
              color: 'var(--text-main, #f8fafc)',
              border: '1px solid var(--border-color, #475569)',
              cursor: 'pointer',
            }}
            onClick={handleCopyClipboard}
          >
            <span>📄</span> Copy Current JSON
          </button>
          <button
            type="button"
            className="cp-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              padding: '6px 12px',
              borderRadius: 6,
              background: 'transparent',
              color: 'var(--text-muted, #94a3b8)',
              border: '1px solid transparent',
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
            onClick={() => setJsonText('')}
          >
            <span>🗑️</span> Clear
          </button>
        </div>

        {/* Text Area Code Editor */}
        <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 300 }}>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder={`Paste your JSON configuration code here...\n\nExample:\n{\n  "windSpeed": 3.6,\n  "tsr": 4.5,\n  "bladeParams": {\n    "radiusMm": 400,\n    "numBlades": 3,\n    "root": { "chordMm": 68, "twistDeg": 18.5, "thicknessPct": 14, "airfoil": "SG6043" },\n    "mid":  { "chordMm": 46, "twistDeg": 8.2,  "thicknessPct": 10, "airfoil": "SG6043" },\n    "tip":  { "chordMm": 22, "twistDeg": 1.5,  "thicknessPct": 10, "airfoil": "SG6043" }\n  }\n}`}
            style={{
              flex: 1,
              width: '100%',
              minHeight: 280,
              backgroundColor: 'var(--bg-primary, #0f172a)',
              color: '#38bdf8',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              fontSize: 13,
              lineHeight: 1.5,
              padding: 14,
              borderRadius: 8,
              border: '1px solid var(--border-color, #334155)',
              outline: 'none',
              resize: 'vertical',
            }}
            spellCheck="false"
          />

          {errorMsg && (
            <div
              style={{
                marginTop: 10,
                padding: '8px 12px',
                borderRadius: 6,
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                fontSize: 12,
              }}
            >
              ⚠️ {errorMsg}
            </div>
          )}

          {successMsg && (
            <div
              style={{
                marginTop: 10,
                padding: '8px 12px',
                borderRadius: 6,
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#34d399',
                fontSize: 12,
              }}
            >
              {successMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-color, #334155)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            background: 'var(--bg-primary, #0f172a)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              background: 'transparent',
              border: '1px solid var(--border-color, #475569)',
              color: 'var(--text-muted, #94a3b8)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            style={{
              padding: '8px 20px',
              borderRadius: 6,
              background: 'linear-gradient(135deg, #3b82f6, #10b981)',
              border: 'none',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
            }}
          >
            🚀 Apply JSON Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
