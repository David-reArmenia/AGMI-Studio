
import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-border-dark py-10 px-6 bg-[#0a0f14]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="size-8 rounded bg-surface-dark flex items-center justify-center border border-border-dark">
            <span className="material-symbols-outlined text-[#5a7187]">shield</span>
          </div>
          <div className="text-xs uppercase tracking-wider font-bold">
            <p className="text-[#93adc8]">AGMI Localization Hub</p>
            <p className="text-[#5a7187] mt-0.5">© 2026 reARMENIA Academy AI Transformation Squad for Armenian Genocide Museum Institute Foundation. All Rights Reserved.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[#5a7187] font-bold uppercase tracking-widest">
          <img src="/reArmenia-AI-Transformation_logo.png" alt="reArmenia AI Transformation" className="h-6 w-auto" />
          <span>Powered by <span className="text-primary">reARMENIA Academy</span></span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
