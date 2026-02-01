
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MOCK_TERMS } from '../../constants.tsx';
import { SourceAsset, Term, TermCategory } from '../../types';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { GoogleGenAI, Type, Modality } from "@google/genai";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.mjs`;

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

interface SourceStageProps {
  assets: SourceAsset[];
  existingTerms?: Term[];
  onAddAsset: (asset: SourceAsset) => void;
  onRemoveAsset: (assetId: string) => void;
  onUpdateTerms: (terms: Term[]) => void;
  onSubmit: () => void;
}

const SourceStage: React.FC<SourceStageProps> = ({ assets, existingTerms, onAddAsset, onRemoveAsset, onUpdateTerms, onSubmit }) => {
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(assets.length > 0 ? assets[0].id : null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [detectedTerms, setDetectedTerms] = useState<Term[]>(existingTerms || []);
  const [editingTermId, setEditingTermId] = useState<string | null>(null);
  const [playingTermId, setPlayingTermId] = useState<string | null>(null);
  
  const logEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedAsset = assets.find(a => a.id === selectedAssetId);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    if (selectedAssetId && !assets.find(a => a.id === selectedAssetId)) {
      setSelectedAssetId(assets.length > 0 ? assets[0].id : null);
    } else if (!selectedAssetId && assets.length > 0) {
      setSelectedAssetId(assets[0].id);
    }
  }, [assets, selectedAssetId]);

  const extractText = async (file: File): Promise<string> => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension === 'txt' || extension === 'md') {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsText(file);
      });
    }

    if (extension === 'docx') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    }

    if (extension === 'pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n\n';
      }
      return fullText;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string || "Unsupported binary content.");
      reader.readAsText(file);
    });
  };

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      const type = (['pdf', 'docx', 'txt', 'md', 'doc'].includes(extension || '')) 
        ? (extension as any) 
        : 'txt';

      const content = await extractText(file);

      const newAsset: SourceAsset = {
        id: `ASSET-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        name: file.name,
        type: type,
        status: 'PENDING',
        lastModified: 'Just now',
        author: 'Current Staff',
        content: content || "Document is empty or unreadable."
      };

      onAddAsset(newAsset);
      setSelectedAssetId(newAsset.id);
    } catch (err) {
      console.error("File processing error:", err);
      alert("Failed to process document.");
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const runTermDetection = async () => {
    if (!selectedAsset || !selectedAsset.content) return;
    
    setIsDetecting(true);
    setProgress(10);
    setLogs(['> Initializing AGMI Neural Lexicon Engine v5.1...', '> Accessing Gemini Pro for historical analysis...']);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze text from Armenian Genocide Museum archives. Extract glossary terms: toponym, figure, ethnonym, historical_term, or date. Provide text, type, ipa, matches, confidence.
        
        Text:
        ${selectedAsset.content.substring(0, 5000)}`,
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
      setProgress(70);
      setLogs(prev => [...prev, '> Mapping complete.', `> Found ${extracted.length} markers.`]);
      
      const finalTerms: Term[] = extracted.map((t, idx) => ({
        ...t,
        id: `term-${idx}-${Date.now()}`,
        status: t.confidence > 80 ? 'verified' : 'warning'
      }));

      setDetectedTerms(finalTerms);
      onUpdateTerms(finalTerms);
      setProgress(100);
      setLogs(prev => [...prev, `> Analysis complete.`]);
    } catch (err) {
      console.error("Detection Error:", err);
      setLogs(prev => [...prev, '> Error. Using fallback.']);
      setDetectedTerms(MOCK_TERMS);
      onUpdateTerms(MOCK_TERMS);
    } finally {
      setIsDetecting(false);
    }
  };

  const handlePlayIpa = async (term: Term) => {
    if (!term.ipa || playingTermId) return;
    setPlayingTermId(term.id);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Pronounce: ${term.ipa}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } }
        },
      });
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
        const audioBuffer = await decodeAudioData(decode(base64Audio), audioCtx, 24000, 1);
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.onended = () => { setPlayingTermId(null); audioCtx.close(); };
        source.start();
      } else setPlayingTermId(null);
    } catch { setPlayingTermId(null); }
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

  const renderHighlightedText = (text: string) => {
    if (!detectedTerms.length) return text;
    const sortedTerms = [...detectedTerms].sort((a, b) => b.text.length - a.text.length);
    const escapedTerms = sortedTerms.map(t => t.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
    return text.split(regex).map((part, i) => {
      const match = sortedTerms.find(t => t.text.toLowerCase() === part.toLowerCase());
      if (match) return <span key={i} className={`term-${match.type} transition-all duration-300 hover:brightness-125 cursor-help`}>{part}</span>;
      return part;
    });
  };

  const activeEditingTerm = detectedTerms.find(t => t.id === editingTermId);

  return (
    <div className="h-full flex overflow-hidden relative">
      <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.docx,.txt,.md,.doc" onChange={handleFileChange} />
      {editingTermId && activeEditingTerm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-surface-dark border border-border-dark rounded-xl max-w-md w-full shadow-2xl p-8">
               <h3 className="text-xl font-bold text-white mb-6 uppercase tracking-tight">Edit Term</h3>
               <div className="space-y-4">
                  <input className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-3 text-white outline-none" value={activeEditingTerm.text} onChange={(e) => setDetectedTerms(prev => prev.map(t => t.id === editingTermId ? {...t, text: e.target.value} : t))} />
                  <input className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-3 text-primary font-mono outline-none" value={activeEditingTerm.ipa || ''} onChange={(e) => setDetectedTerms(prev => prev.map(t => t.id === editingTermId ? {...t, ipa: e.target.value} : t))} />
                  <button onClick={() => { setEditingTermId(null); onUpdateTerms(detectedTerms); }} className="w-full py-3 bg-primary text-white font-black text-[10px] uppercase tracking-widest rounded hover:bg-primary/90 transition-all">Save & Close</button>
               </div>
          </div>
        </div>
      )}
      <aside className="w-72 border-r border-border-dark flex flex-col bg-background-dark shrink-0">
        <div className="p-4 border-b border-border-dark">
          <div className="flex items-center justify-between mb-3"><h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-[#5a7187]">Source Assets</h3><span onClick={handleFileUploadClick} className="material-symbols-outlined text-sm cursor-pointer hover:text-white">add_circle</span></div>
          <div onClick={handleFileUploadClick} className="border border-dashed border-border-dark p-4 flex flex-col items-center justify-center gap-2 hover:border-primary/50 cursor-pointer bg-surface-dark/20 group"><span className="material-symbols-outlined text-[#5a7187] group-hover:text-primary">upload_file</span><span className="text-[10px] font-bold uppercase tracking-widest text-[#93adc8]">Upload Script</span></div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {assets.map((asset) => (
            <div key={asset.id} onClick={() => setSelectedAssetId(asset.id)} className={`p-3 group relative cursor-pointer rounded transition-all ${selectedAssetId === asset.id ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-surface-dark border-l-2 border-transparent'}`}>
              <div className="flex items-start gap-3"><span className="material-symbols-outlined text-[#93adc8]">{['pdf', 'docx'].includes(asset.type) ? 'article' : 'description'}</span><p className="text-xs font-bold truncate uppercase tracking-wider text-[#93adc8]">{asset.name}</p></div>
              <button onClick={(e) => { e.stopPropagation(); onRemoveAsset(asset.id); }} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-[#5a7187] hover:text-red-500 rounded"><span className="material-symbols-outlined text-sm">close</span></button>
            </div>
          ))}
        </div>
      </aside>
      <section className="flex-1 flex flex-col bg-[#080c10] overflow-hidden border-r border-border-dark">
        <div className="h-10 border-b border-border-dark flex items-center justify-between px-4 bg-surface-dark/40 shrink-0">
          <div className="flex items-center gap-4 text-[#93adc8]"><button className="p-1"><span className="material-symbols-outlined text-[18px]">format_bold</span></button></div>
          <div className="text-[10px] text-[#5a7187] font-mono tracking-widest font-bold uppercase">Words: {selectedAsset?.content?.split(/\s+/).filter(Boolean).length || 0}</div>
        </div>
        <div className="flex-1 overflow-y-auto p-12 flex justify-center bg-[#0d141b]/50 custom-scrollbar">
          {selectedAsset ? (
            <div className="max-w-[720px] w-full bg-[#111820] p-16 shadow-2xl border border-border-dark/20 font-serif leading-relaxed text-[#b0bac5]">
              {selectedAsset.content?.split('\n').map((line, idx) => <p key={idx} className="mb-6">{renderHighlightedText(line)}</p>)}
            </div>
          ) : <div className="flex flex-col items-center justify-center h-full opacity-20"><span className="material-symbols-outlined text-[64px]">upload_file</span><h2 className="text-xl font-black uppercase tracking-widest">No Asset</h2></div>}
        </div>
        <footer className="h-12 border-t border-border-dark bg-[#0a0f14] flex items-center justify-between px-6 shrink-0">
          <div className="flex -space-x-1.5 font-bold text-[10px]"><div className="size-6 rounded-full bg-blue-900 flex items-center justify-center">MK</div></div>
          <button onClick={onSubmit} disabled={!selectedAsset} className={`px-6 py-2 font-black text-[10px] uppercase tracking-[0.2em] rounded flex items-center gap-2 transition-all ${!selectedAsset ? 'bg-border-dark text-[#5a7187] cursor-not-allowed' : 'bg-primary hover:bg-primary/90 text-white'}`}>Submit to Translation <span className="material-symbols-outlined text-sm">arrow_right_alt</span></button>
        </footer>
      </section>
      <aside className="w-96 border-l border-border-dark flex flex-col bg-background-dark shrink-0">
        <div className="p-4 border-b border-border-dark bg-surface-dark/10">
          <button onClick={runTermDetection} disabled={isDetecting || !selectedAsset} className={`w-full font-black py-2.5 text-[10px] uppercase tracking-[0.2em] rounded flex items-center justify-center gap-2 ${isDetecting ? 'bg-border-dark text-[#5a7187]' : 'bg-museum-gold text-black shadow-lg shadow-museum-gold/10'}`}>{isDetecting ? <span className="material-symbols-outlined animate-spin">refresh</span> : <span className="material-symbols-outlined">cognition</span>} {isDetecting ? 'Processing...' : 'Run Term Detection'}</button>
          <div className="p-3 bg-[#05080b] border border-border-dark font-mono text-[9px] text-[#4a6b8c] h-32 mt-4 overflow-y-auto rounded custom-scrollbar">{logs.map((log, i) => <div key={i} className="mb-0.5">{log}</div>)}</div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-8 custom-scrollbar">
          {/* Fix: Casting Object.entries(groupedTerms) as [TermCategory, Term[]][] to resolve 'unknown' type inference for 'terms' to allow .length and .map access. */}
          {(Object.entries(groupedTerms) as [TermCategory, Term[]][]).map(([category, terms]) => (
            <div key={category}>
              <div className={`flex items-center justify-between mb-4 border-b pb-1 ${categoryColors[category as TermCategory]}`}><h4 className="text-[10px] font-black uppercase tracking-widest">{categoryLabels[category as TermCategory]}</h4><span className="text-[9px] font-bold opacity-60 uppercase">{terms.length}</span></div>
              <div className="space-y-3">
                {terms.map(term => (
                  <div key={term.id} className="bg-surface-dark border border-border-dark/60 rounded-lg p-3 group/term hover:border-primary/40 transition-all">
                    <div className="flex justify-between items-start mb-3"><div className="min-w-0 flex-1"><span className="text-[12px] font-bold text-white tracking-wide uppercase truncate block">{term.text}</span></div><div className="flex items-center gap-1"><button onClick={() => setEditingTermId(term.id)} className="p-1 hover:bg-primary/10 rounded text-[#5a7187] hover:text-primary"><span className="material-symbols-outlined text-[16px]">edit</span></button></div></div>
                    <div className="flex justify-between items-center"><span className="text-[10px] text-primary font-mono">{term.ipa}</span><button onClick={() => handlePlayIpa(term)} className={`material-symbols-outlined text-sm ${playingTermId === term.id ? 'text-primary animate-pulse' : 'text-[#5a7187] hover:text-white'}`}>{playingTermId === term.id ? 'graphic_eq' : 'volume_up'}</button></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
};

export default SourceStage;
