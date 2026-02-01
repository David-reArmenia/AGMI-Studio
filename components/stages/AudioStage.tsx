
import React, { useState } from 'react';
import { Project } from '../../types';

interface AudioStageProps {
  project: Project;
}

const AudioStage: React.FC<AudioStageProps> = ({ project }) => {
  const [activeLang, setActiveLang] = useState(project.targetLangs[0] || 'EN');
  
  const currentTranslation = project.translations?.[activeLang];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Target Lang Switcher for Audio */}
      <div className="flex bg-[#05080b] border-b border-border-dark px-6 py-2 gap-4 shrink-0">
         <span className="text-[10px] font-black text-[#5a7187] uppercase py-1">Target Language:</span>
         {project.targetLangs.map(lang => (
           <button 
             key={lang}
             onClick={() => setActiveLang(lang)}
             className={`px-3 py-1 rounded text-[10px] font-black uppercase border transition-all ${activeLang === lang ? 'bg-primary border-primary text-white' : 'border-border-dark text-[#5a7187] hover:border-white'}`}
           >
             {lang}
           </button>
         ))}
      </div>

      <main className="flex flex-1 overflow-hidden">
        {/* Voice Library Sidebar */}
        <aside className="w-80 border-r border-border-dark flex flex-col bg-background-dark/50">
          <div className="p-4 border-b border-border-dark">
            <h3 className="text-white font-black text-[10px] uppercase tracking-widest mb-3">Target Voice Models</h3>
            <div className="space-y-3">
              <div className="p-4 rounded border border-primary/50 bg-primary/10 cursor-pointer">
                <p className="text-white text-xs font-black uppercase tracking-wider">Antonian (AI-V3)</p>
                <p className="text-[9px] text-[#93adc8] mt-0.5">Primary {activeLang} Narrator</p>
                <div className="mt-3 flex gap-2">
                  <span className="px-2 py-0.5 rounded bg-background-dark text-[8px] font-black text-white/70 uppercase">High Fidelity</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Performance Tuning Section */}
        <section className="flex-1 flex flex-col bg-background-dark border-r border-border-dark overflow-y-auto custom-scrollbar">
          <div className="p-10 max-w-4xl mx-auto w-full">
            <div className="mb-12">
                <h2 className="text-2xl font-black text-white tracking-tight uppercase">Vocal Engineering</h2>
                <p className="text-[#93adc8] text-xs mt-2 uppercase">Fine-tuning {activeLang} output for museum exhibits</p>
            </div>

            <div className="space-y-12">
              {[
                { label: 'Emphasis', desc: 'Vocal stress on key exhibition terms', val: '0.85' },
                { label: 'Solemnity', desc: 'Emotional weight for sensitive history', val: '1.20' },
                { label: 'Pacing', desc: 'Clear speech rate for visitors', val: '0.95x' }
              ].map((ctrl, i) => (
                <div key={i} className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-white uppercase">{ctrl.label}</label>
                    <span className="px-2 py-1 bg-surface-dark rounded font-mono text-primary text-xs border border-border-dark">{ctrl.val}</span>
                  </div>
                  <input type="range" className="w-full h-1 bg-border-dark rounded-full appearance-none accent-primary" />
                </div>
              ))}
            </div>

            <div className="mt-16 p-8 rounded-xl bg-surface-dark/30 border border-border-dark border-dashed flex flex-col items-center gap-6">
              <div className="w-full h-16 flex items-end justify-center gap-1">
                {Array.from({length: 24}).map((_, i) => <div key={i} className="w-2 bg-primary/20 rounded-full h-1/2"></div>)}
              </div>
              <button className="flex items-center gap-3 px-10 py-3 bg-white text-black font-black uppercase tracking-widest rounded text-[11px] shadow-2xl hover:-translate-y-0.5 transition-all">
                <span className="material-symbols-outlined">play_circle</span> Preview {activeLang} Audio
              </button>
            </div>
          </div>
        </section>

        {/* SSML Sidebar */}
        <aside className="w-96 flex flex-col bg-[#05080b]">
          <div className="p-4 border-b border-border-dark flex items-center justify-between">
            <h3 className="text-white font-black text-[10px] uppercase tracking-[0.2em]">SSML Translation Preview</h3>
          </div>
          <div className="flex-1 p-6 font-mono text-[11px] leading-relaxed border-l border-border-dark overflow-y-auto custom-scrollbar">
            <div className="text-[#5a7187]">&lt;speak version="1.0" xml:lang="{activeLang.toLowerCase()}"&gt;</div>
            <div className="pl-4 mt-2">
              <span className="text-blue-500">&lt;prosody rate="0.95"&gt;</span>
              <div className="pl-4 text-slate-400 py-4 italic whitespace-pre-wrap">
                {currentTranslation?.content.substring(0, 500)}...
              </div>
              <span className="text-blue-500">&lt;/prosody&gt;</span>
            </div>
            <div className="text-[#5a7187] mt-2">&lt;/speak&gt;</div>
            
            <div className="mt-12 p-4 border border-primary/20 bg-primary/5 rounded">
              <p className="text-[10px] font-black text-primary uppercase mb-2">Glossary Overrides</p>
              <div className="space-y-2">
                {currentTranslation?.terms.slice(0, 5).map(t => (
                  <div key={t.id} className="text-[9px] text-slate-500 flex justify-between">
                    <span className="text-white">{t.text}</span>
                    <span className="font-mono">[{t.ipa}]</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default AudioStage;
