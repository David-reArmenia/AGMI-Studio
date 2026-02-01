
import React from 'react';
import { Project } from '../types';

interface HeaderProps {
  view: 'dashboard' | 'editor';
  onDashboardClick: () => void;
  project: Project | null;
}

const Header: React.FC<HeaderProps> = ({ view, onDashboardClick, project }) => {
  return (
    <header className="flex items-center justify-between border-b border-border-dark bg-[#0a0f14] px-6 py-2 shrink-0 z-50">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3 cursor-pointer" onClick={onDashboardClick}>
          <div className="size-7 bg-museum-gold rounded-sm flex items-center justify-center">
            <span className="material-symbols-outlined text-black text-[20px] font-bold">account_balance</span>
          </div>
          <h1 className="text-white text-sm font-black tracking-[0.1em] uppercase">AGM Studio</h1>
        </div>
        
        <nav className="flex items-center gap-6">
          <button 
            onClick={onDashboardClick}
            className={`text-xs font-semibold tracking-wide transition-colors ${view === 'dashboard' ? 'text-primary border-b-2 border-primary py-2' : 'text-[#93adc8] hover:text-white'}`}
          >
            DASHBOARD
          </button>
          {view === 'editor' && (
            <>
              <span className="text-border-dark">/</span>
              <span className="text-primary text-xs font-semibold tracking-wide border-b-2 border-primary py-2">
                PROJECTS
              </span>
            </>
          )}
          <button className="text-[#93adc8] hover:text-white text-xs font-semibold tracking-wide">ARCHIVE</button>
          <button className="text-[#93adc8] hover:text-white text-xs font-semibold tracking-wide">TEAM</button>
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-surface-dark border border-border-dark rounded">
          <span className="material-symbols-outlined text-[#93adc8] text-sm">search</span>
          <input 
            className="bg-transparent border-none p-0 text-xs w-48 focus:ring-0 placeholder:text-[#5a7187]" 
            placeholder={view === 'dashboard' ? "Search projects..." : "Search collection..."}
          />
        </div>
        <div className="flex items-center gap-2">
          <button className="p-1.5 hover:bg-surface-dark rounded transition-colors text-[#93adc8]">
            <span className="material-symbols-outlined text-[20px]">notifications</span>
          </button>
          <button className="p-1.5 hover:bg-surface-dark rounded transition-colors text-[#93adc8]">
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </button>
        </div>
        <div className="size-8 rounded bg-primary/20 border border-primary/30 flex items-center justify-center text-[10px] text-primary font-bold">
          JD
        </div>
      </div>
    </header>
  );
};

export default Header;
