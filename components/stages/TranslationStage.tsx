
import React, { useState } from 'react';
import { Project, TranslationData, Term } from '../../types';

interface TranslationStageProps {
  project: Project;
  onUpdateTranslations: (translations: Record<string, TranslationData>) => void;
  onProceed: () => void;
}

const TranslationStage: React.FC<TranslationStageProps> = ({ project, onUpdateTranslations, onProceed }) => {
  const [activeLang, setActiveLang] = useState<string>(project.targetLangs[0] || '');

  const currentTranslation = project.translations?.[activeLang];

  const handleTextChange = (newVal: string) => {
    if (!currentTranslation) return;
    const updated = { ...project.translations };
    updated[activeLang] = { ...currentTranslation, content: newVal };
    onUpdateTranslations(updated);
  };

  const handleTermIPAChange = (termId: string, newIPA: string) => {
    if (!currentTranslation) return;
    const updatedTerms = currentTranslation.terms.map(t => t.id === termId ? { ...t, ipa: newIPA } : t);
    const updated = { ...project.translations };
    updated[activeLang] = { ...currentTranslation, terms: updatedTerms };
    onUpdateTranslations(updated);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Language Selector Bar */}
      <div className="flex bg-[#0a0f14] border-b border-border-dark px-6 overflow-x-auto whitespace-nowrap">
        {project.targetLangs.map(lang => (
          <button 
            key={lang}
            onClick={() => setActiveLang(lang)}
            className={`flex items-center gap-2 px-6 py-3 border-b-2 font-black text-[10px] uppercase tracking-widest transition-all ${activeLang === lang ? 'border-primary text-primary' : 'border-transparent text-[#5a7187] hover:text-white'}`}
          >
            <span className={`w-2 h-2 rounded-full ${project.translations?.[lang]?.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            {lang}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Source Text Column */}
        <div className="w-[45%] flex flex-col border-r border-border-dark">
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
        <div className="w-[45%] flex flex-col border-r border-border-dark bg-[#0a0f14]/50">
          <div className="px-6 py-2 bg-background-dark/50 border-b border-border-dark flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5a7187]">{activeLang} Script Editor</span>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {!currentTranslation ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20 text-center">
                <span className="material-symbols-outlined text-[64px] mb-4">translate</span>
                <p className="uppercase font-black text-sm tracking-widest">No Translation Data Yet</p>
                <p className="text-[10px] mt-2">Go back to Source and click 'Submit'</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#5a7187]">Full Text Segment</span>
                </div>
                <textarea 
                  className="w-full bg-surface-dark/40 border border-border-dark rounded-lg p-5 text-lg leading-relaxed min-h-[500px] focus:ring-1 focus:ring-primary outline-none transition-all text-white font-serif"
                  value={currentTranslation.content}
                  onChange={(e) => handleTextChange(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Mapped Glossary Sidebar */}
        <aside className="w-80 flex flex-col bg-background-dark">
          <div className="px-5 py-3 border-b border-border-dark bg-[#0a0f14]">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5a7187]">Target Glossary (IPA)</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
            {currentTranslation?.terms.map(term => (
              <div key={term.id} className="bg-surface-dark p-3 rounded border border-border-dark/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-white uppercase">{term.text}</span>
                  <span className={`text-[8px] px-1 rounded bg-background-dark text-[#5a7187] uppercase`}>{term.type}</span>
                </div>
                <input 
                  className="w-full bg-[#0a0f14] border border-border-dark text-[10px] py-1 px-2 text-primary font-mono rounded"
                  value={term.ipa || ''}
                  onChange={(e) => handleTermIPAChange(term.id, e.target.value)}
                  placeholder="Target IPA..."
                />
                <div className="mt-1 text-[8px] text-[#5a7187] flex justify-between italic">
                  <span>From: {project.terms?.find(t => t.id.split('-')[0] === term.id.split('-')[0])?.text || '-'}</span>
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
          Proceed to Audio Production
          <span className="material-symbols-outlined text-lg">keyboard_double_arrow_right</span>
        </button>
      </footer>
    </div>
  );
};

export default TranslationStage;
