
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Project, TranslationData, Term, TermCategory } from '../../types';
import { GoogleGenAI, Type, Modality } from "@google/genai";

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

interface TranslationStageProps {
  project: Project;
  onUpdateTranslations: (translations: Record<string, TranslationData>) => void;
  onUpdateTerms: (terms: Term[]) => void;
  onProceed: () => void;
}

const TranslationStage: React.FC<TranslationStageProps> = ({ project, onUpdateTranslations, onUpdateTerms, onProceed }) => {
  const [activeLang, setActiveLang] = useState<string>(project.targetLangs[0] || '');
  const [isDetecting, setIsDetecting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [detectedTerms, setDetectedTerms] = useState<Term[]>(project.terms || []);
  const [editingTermId, setEditingTermId] = useState<string | null>(null);
  const [playingTermId, setPlayingTermId] = useState<string | null>(null);

  const currentTranslation = project.translations?.[activeLang];

  // Check if active language matches source language (no translation needed)
  const isSourceLanguage = activeLang === project.sourceLang;

  const handleTextChange = (newVal: string) => {
    if (!currentTranslation) return;
    const updated = { ...project.translations };
    updated[activeLang] = { ...currentTranslation, content: newVal };
    onUpdateTranslations(updated);
  };

  const handleTermIPAChange = (termId: string, newIPA: string) => {
    const updatedTerms = detectedTerms.map(t => t.id === termId ? { ...t, ipa: newIPA } : t);
    setDetectedTerms(updatedTerms);
    onUpdateTerms(updatedTerms);
  };

  // Copy source content directly to target (for same language - skip translation)
  const handleUseSourceText = () => {
    const sourceContent = project.assets[0]?.content || '';
    const updated = { ...project.translations };
    updated[activeLang] = {
      content: sourceContent,
      terms: project.terms?.map(t => ({ ...t, id: `${t.id}-${activeLang}` })) || [],
      status: 'COMPLETED'
    };
    onUpdateTranslations(updated);
  };

  const runTermDetection = async () => {
    // Use the target language translation content instead of source
    const targetContent = currentTranslation?.content;
    if (!targetContent) return;

    setIsDetecting(true);
    setLogs(['> Initializing AGMI Neural Lexicon Engine v5.1...', `> Analyzing ${activeLang} translation content...`]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `Analyze this ${activeLang} text from Armenian Genocide Museum archives. Extract glossary terms: toponym, figure, ethnonym, historical_term, or date. Provide text, type, ipa (for ${activeLang} pronunciation), matches, confidence.
        
        Text:
        ${targetContent.substring(0, 5000)}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                type: { type: Type.STRING, enum: ["toponym", "figure", "ethnonym", "historical_term", "date"] },
                ipa: { type: Type.STRING },
                matches: { type: Type.INTEGER },
                confidence: { type: Type.INTEGER }
              },
              required: ["text", "type", "ipa", "matches", "confidence"]
            }
          }
        }
      });

      const extracted: any[] = JSON.parse(response.text || "[]");
      setLogs(prev => [...prev, '> Mapping complete.', `> Found ${extracted.length} markers.`]);

      const finalTerms: Term[] = extracted.map((t, idx) => ({
        ...t,
        id: `term-${idx}-${Date.now()}`,
        status: t.confidence > 80 ? 'verified' : 'warning'
      }));

      setDetectedTerms(finalTerms);
      onUpdateTerms(finalTerms);
      setLogs(prev => [...prev, `> Analysis complete.`]);
    } catch (err) {
      console.error("Detection Error:", err);
      setLogs(prev => [...prev, '> Error during detection.']);
    } finally {
      setIsDetecting(false);
    }
  };

  const handlePlayIpa = async (term: Term) => {
    if (playingTermId) return;
    if (!term.text && !term.ipa) return;

    setPlayingTermId(term.id);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const textToPronounce = term.text;
      const ipaHint = term.ipa ? ` (pronunciation: ${term.ipa})` : '';
      const prompt = `Say the word: "${textToPronounce}"${ipaHint}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } }
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const audioBuffer = await decodeAudioData(decode(base64Audio), audioCtx, 24000, 1);
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.onended = () => { setPlayingTermId(null); audioCtx.close(); };
        source.start();
      } else {
        setPlayingTermId(null);
      }
    } catch (error) {
      console.error('[TTS] Error:', error);
      setPlayingTermId(null);
    }
  };

  const groupedTerms = useMemo(() => {
    return detectedTerms.reduce((acc, term) => {
      if (!acc[term.type]) acc[term.type] = [];
      acc[term.type].push(term);
      return acc;
    }, {} as Record<TermCategory, Term[]>);
  }, [detectedTerms]);

  const categoryLabels: Record<TermCategory, string> = { toponym: 'Toponyms', figure: 'Historical Figures', ethnonym: 'Ethnonyms', historical_term: 'Historical Terms', date: 'Dates' };
  const categoryColors: Record<TermCategory, string> = { toponym: 'text-blue-400 border-blue-900/30', figure: 'text-emerald-400 border-emerald-900/30', ethnonym: 'text-purple-400 border-purple-900/30', historical_term: 'text-amber-400 border-amber-900/30', date: 'text-rose-400 border-rose-900/30' };
  const categoryHighlightColors: Record<TermCategory, string> = {
    toponym: 'bg-blue-500/20 text-blue-300 border-b border-blue-500/50',
    figure: 'bg-emerald-500/20 text-emerald-300 border-b border-emerald-500/50',
    ethnonym: 'bg-purple-500/20 text-purple-300 border-b border-purple-500/50',
    historical_term: 'bg-amber-500/20 text-amber-300 border-b border-amber-500/50',
    date: 'bg-rose-500/20 text-rose-300 border-b border-rose-500/50'
  };

  const renderHighlightedText = (text: string) => {
    if (!detectedTerms.length) return text;
    const sortedTerms = [...detectedTerms].sort((a, b) => b.text.length - a.text.length);
    const escapedTerms = sortedTerms.map(t => t.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
    return text.split(regex).map((part, i) => {
      const match = sortedTerms.find(t => t.text.toLowerCase() === part.toLowerCase());
      if (match) {
        return <span key={i} className={`${categoryHighlightColors[match.type]} px-0.5 rounded cursor-help transition-all hover:brightness-125`} title={`${match.type}: ${match.ipa || 'No IPA'}`}>{part}</span>;
      }
      return part;
    });
  };

  const activeEditingTerm = detectedTerms.find(t => t.id === editingTermId);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Edit Term Modal */}
      {editingTermId && activeEditingTerm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-surface-dark border border-border-dark rounded-xl max-w-md w-full shadow-2xl p-8">
            <h3 className="text-xl font-bold text-white mb-6 uppercase tracking-tight">Edit Term</h3>
            <div className="space-y-4">
              <input className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-3 text-white outline-none" value={activeEditingTerm.text} onChange={(e) => setDetectedTerms(prev => prev.map(t => t.id === editingTermId ? { ...t, text: e.target.value } : t))} />
              <input className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-3 text-primary font-mono outline-none" value={activeEditingTerm.ipa || ''} onChange={(e) => setDetectedTerms(prev => prev.map(t => t.id === editingTermId ? { ...t, ipa: e.target.value } : t))} />
              <button onClick={() => { setEditingTermId(null); onUpdateTerms(detectedTerms); }} className="w-full py-3 bg-primary text-white font-black text-[10px] uppercase tracking-widest rounded hover:bg-primary/90 transition-all">Save & Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Language Selector Bar */}
      <div className="flex bg-[#0a0f14] border-b border-border-dark px-6 overflow-x-auto whitespace-nowrap">
        {project.targetLangs.map(lang => (
          <button
            key={lang}
            onClick={() => setActiveLang(lang)}
            className={`flex items-center gap-2 px-6 py-3 border-b-2 font-black text-[10px] uppercase tracking-widest transition-all ${activeLang === lang ? 'border-primary text-primary' : 'border-transparent text-[#5a7187] hover:text-white'}`}
          >
            <span className={`w-2 h-2 rounded-full ${project.translations?.[lang]?.status === 'COMPLETED' ? 'bg-emerald-500' : lang === project.sourceLang ? 'bg-blue-500' : 'bg-amber-500'}`}></span>
            {lang}
            {lang === project.sourceLang && <span className="text-[8px] text-blue-400 ml-1">(Source)</span>}
          </button>
        ))}
      </div>

      {/* Same Language Notice */}
      {isSourceLanguage && (
        <div className="bg-blue-500/10 border-b border-blue-500/30 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-blue-400">info</span>
            <div>
              <p className="text-blue-300 font-bold text-sm">No Translation Needed</p>
              <p className="text-blue-400/70 text-[10px] uppercase tracking-wide">Target language matches source language</p>
            </div>
          </div>
          {!currentTranslation?.content && (
            <button
              onClick={handleUseSourceText}
              className="px-4 py-2 bg-blue-500 text-white font-black text-[10px] uppercase tracking-widest rounded hover:bg-blue-600 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">content_copy</span>
              Use Source Text
            </button>
          )}
          {currentTranslation?.content && (
            <span className="text-emerald-400 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              Ready for Audio
            </span>
          )}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Source Text Column */}
        <div className="w-[40%] flex flex-col border-r border-border-dark">
          <div className="px-6 py-2 bg-background-dark/50 border-b border-border-dark flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5a7187]">{project.sourceLang} Source Text</span>
          </div>
          <div className="flex-1 overflow-y-auto p-10 space-y-8 bg-[#080c10]/30 custom-scrollbar">
            <p className="text-xl leading-relaxed text-[#e1e1e1] font-medium opacity-60">
              {project.assets[0]?.content || "No content found."}
            </p>
          </div>
        </div>

        {/* Translation Editor Column */}
        <div className="w-[35%] flex flex-col border-r border-border-dark bg-[#0a0f14]/50">
          <div className="px-6 py-2 bg-background-dark/50 border-b border-border-dark flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5a7187]">{activeLang} Script Editor</span>
            {isSourceLanguage && <span className="text-[8px] text-blue-400 uppercase tracking-widest">Same as Source</span>}
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {!currentTranslation ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20 text-center">
                <span className="material-symbols-outlined text-[64px] mb-4">translate</span>
                <p className="uppercase font-black text-sm tracking-widest">No Translation Data Yet</p>
                <p className="text-[10px] mt-2">
                  {isSourceLanguage ? 'Click "Use Source Text" above' : "Go back to Source and click 'Submit'"}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#5a7187]">Full Text Segment</span>
                  {detectedTerms.length > 0 && <span className="text-[8px] text-emerald-400 uppercase">{detectedTerms.length} terms highlighted</span>}
                </div>
                {detectedTerms.length > 0 ? (
                  <div className="w-full bg-surface-dark/40 border border-border-dark rounded-lg p-5 text-lg leading-relaxed min-h-[400px] text-white font-serif">
                    {currentTranslation.content.split('\n').map((line, idx) => (
                      <p key={idx} className="mb-4">{renderHighlightedText(line)}</p>
                    ))}
                  </div>
                ) : (
                  <textarea
                    className="w-full bg-surface-dark/40 border border-border-dark rounded-lg p-5 text-lg leading-relaxed min-h-[500px] focus:ring-1 focus:ring-primary outline-none transition-all text-white font-serif"
                    value={currentTranslation.content}
                    onChange={(e) => handleTextChange(e.target.value)}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Term Detection Sidebar */}
        <aside className="w-[25%] flex flex-col bg-background-dark">
          <div className="p-4 border-b border-border-dark bg-surface-dark/10">
            <button
              onClick={runTermDetection}
              disabled={isDetecting || !currentTranslation?.content}
              className={`w-full font-black py-2.5 text-[10px] uppercase tracking-[0.2em] rounded flex items-center justify-center gap-2 ${isDetecting || !currentTranslation?.content ? 'bg-border-dark text-[#5a7187]' : 'bg-museum-gold text-black shadow-lg shadow-museum-gold/10'}`}
            >
              {isDetecting ? <span className="material-symbols-outlined animate-spin">refresh</span> : <span className="material-symbols-outlined">cognition</span>}
              {isDetecting ? 'Processing...' : 'Run Term Detection'}
            </button>
            <div className="p-3 bg-[#05080b] border border-border-dark font-mono text-[9px] text-[#4a6b8c] h-24 mt-4 overflow-y-auto rounded custom-scrollbar">
              {logs.map((log, i) => <div key={i} className="mb-0.5">{log}</div>)}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
            {(Object.entries(groupedTerms) as [TermCategory, Term[]][]).map(([category, terms]) => (
              <div key={category}>
                <div className={`flex items-center justify-between mb-3 border-b pb-1 ${categoryColors[category as TermCategory]}`}>
                  <h4 className="text-[10px] font-black uppercase tracking-widest">{categoryLabels[category as TermCategory]}</h4>
                  <span className="text-[9px] font-bold opacity-60 uppercase">{terms.length}</span>
                </div>
                <div className="space-y-2">
                  {terms.map(term => (
                    <div key={term.id} className="bg-surface-dark border border-border-dark/60 rounded-lg p-3 group/term hover:border-primary/40 transition-all">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[11px] font-bold text-white tracking-wide uppercase truncate">{term.text}</span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditingTermId(term.id)} className="p-1 hover:bg-primary/10 rounded text-[#5a7187] hover:text-primary">
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-primary font-mono">{term.ipa}</span>
                        <button onClick={() => handlePlayIpa(term)} className={`material-symbols-outlined text-sm ${playingTermId === term.id ? 'text-primary animate-pulse' : 'text-[#5a7187] hover:text-white'}`}>
                          {playingTermId === term.id ? 'graphic_eq' : 'volume_up'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <footer className="h-16 border-t border-border-dark bg-[#0a0f14] px-10 flex items-center justify-end shrink-0">
        <button
          onClick={onProceed}
          className="px-8 py-2.5 bg-primary text-white font-black text-[10px] uppercase tracking-[0.2em] rounded shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2"
        >
          Go to Audio Generation
          <span className="material-symbols-outlined text-lg">keyboard_double_arrow_right</span>
        </button>
      </footer>
    </div>
  );
};

export default TranslationStage;
