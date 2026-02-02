
import React, { useState } from 'react';
import { Project, WorkflowStatus } from '../types';

interface DashboardProps {
  projects: Project[];
  onOpenProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
  onAddProject: (project: Omit<Project, 'id' | 'lastModified' | 'status' | 'progress'>) => Promise<Project | undefined>;
}

const Dashboard: React.FC<DashboardProps> = ({ projects, onOpenProject, onDeleteProject, onAddProject }) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  // Form State
  const [newName, setNewName] = useState('');
  const [newSourceLang, setNewSourceLang] = useState('AUTO');
  const [newTargetLangs, setNewTargetLangs] = useState<string[]>([]);

  const availableLangs = [
    { code: 'EN-US', name: 'English (US)' },
    { code: 'EN-GB', name: 'English (GB)' },
    { code: 'HY', name: 'Armenian' },
    { code: 'RU', name: 'Russian' },
    { code: 'FR', name: 'French' },
    { code: 'DE', name: 'German' },
    { code: 'ES', name: 'Spanish (Int)' },
    { code: 'ES-LA', name: 'Spanish (LatAm)' },
    { code: 'IT', name: 'Italian' },
    { code: 'TR', name: 'Turkish' },
    { code: 'AR', name: 'Arabic' },
    { code: 'ZH', name: 'Chinese' },
    { code: 'JA', name: 'Japanese' }
  ];

  const sourceLangOptions = [
    { code: 'AUTO', name: '🔍 Auto-Detect' },
    ...availableLangs
  ];

  const getStatusColor = (status: WorkflowStatus) => {
    switch (status) {
      case WorkflowStatus.READY: return 'text-emerald-500';
      case WorkflowStatus.TTS_GENERATING: return 'text-primary';
      case WorkflowStatus.TRANSLATING: return 'text-amber-500';
      default: return 'text-slate-400';
    }
  };

  const getBarColor = (status: WorkflowStatus) => {
    switch (status) {
      case WorkflowStatus.READY: return 'bg-emerald-500';
      case WorkflowStatus.TTS_GENERATING: return 'bg-primary';
      case WorkflowStatus.TRANSLATING: return 'bg-amber-500';
      default: return 'bg-slate-700';
    }
  };

  // Calculate progress based on actual project phase completion
  const calculateProgress = (proj: Project): number => {
    let progress = 0;

    // Phase 1: Source Materials (0-33%)
    // Has assets = 33%
    if (proj.assets && proj.assets.length > 0) {
      const parsedAssets = proj.assets.filter(a => a.status === 'PARSED').length;
      const assetProgress = proj.assets.length > 0 ? (parsedAssets / proj.assets.length) * 33 : 0;
      progress = Math.round(assetProgress);
    }

    // Phase 2: Translation (34-66%)
    // Has translations for target languages
    if (proj.translations && Object.keys(proj.translations).length > 0) {
      const completedTranslations = Object.values(proj.translations).filter(
        t => t.status === 'COMPLETED' || (t.content && t.content.length > 0)
      ).length;
      const translationProgress = proj.targetLangs.length > 0
        ? (completedTranslations / proj.targetLangs.length) * 33
        : 0;
      progress = 33 + Math.round(translationProgress);
    }

    // Phase 3: Audio Production (67-100%)
    // Has generated audio outputs
    if (proj.audioOutputs && proj.audioOutputs.length > 0) {
      const completedAudios = proj.audioOutputs.filter(a => a.status === 'completed').length;
      // Consider 1 audio per target language as 100%
      const expectedAudios = proj.targetLangs.length || 1;
      const audioProgress = Math.min((completedAudios / expectedAudios) * 34, 34);
      progress = 66 + Math.round(audioProgress);
    }

    return Math.min(progress, 100);
  };

  const triggerDelete = (project: Project) => {
    setProjectToDelete(project);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (projectToDelete) {
      onDeleteProject(projectToDelete.id);
      setShowDeleteModal(false);
      setProjectToDelete(null);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const newProject = await onAddProject({
      name: newName,
      sourceLang: newSourceLang,
      targetLangs: newTargetLangs.length > 0 ? newTargetLangs : ['EN-US']
    });
    setShowCreateModal(false);
    resetForm();
    // Immediately open the new project
    if (newProject) {
      onOpenProject(newProject);
    }
  };

  const resetForm = () => {
    setNewName('');
    setNewSourceLang('AUTO');
    setNewTargetLangs([]);
  };

  const toggleTargetLang = (code: string) => {
    setNewTargetLangs(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 relative h-full flex flex-col">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">Project Dashboard</h1>
          <p className="text-slate-500 mt-1">Manage multi-language audio guide production</p>
        </div>
        {/* reArmenia Academy branding */}
        <div className="flex items-center gap-4 text-sm text-[#93adc8] font-bold uppercase tracking-wide">
          <img src="/reArmenia-AI-Transformation_logo.png" alt="reArmenia AI Transformation" className="h-14 w-auto" />
          <span>Powered by <span className="text-primary font-black">reARMENIA Academy</span></span>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-bold rounded hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
        >
          <span className="material-symbols-outlined text-xl">add_circle</span>
          <span>Create New Project</span>
        </button>
      </div>

      <div className="bg-surface-dark border border-border-dark rounded-xl overflow-hidden shadow-2xl flex-1 flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-background-dark/90 backdrop-blur border-b border-border-dark">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#5a7187]">Project Details</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#5a7187]">Source</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#5a7187]">Targets</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#5a7187]">Last Modified</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#5a7187]">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#5a7187]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-dark/30">
              {projects.map((proj) => (
                <tr key={proj.id} className="hover:bg-primary/5 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="font-bold text-white group-hover:text-primary transition-colors">{proj.name}</span>
                      <span className="text-[10px] text-[#5a7187] uppercase tracking-tighter">ID: {proj.id}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="px-2 py-1 bg-background-dark border border-border-dark text-[#93adc8] rounded text-[10px] font-bold uppercase tracking-wider">{proj.sourceLang}</span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {proj.targetLangs.map(lang => (
                        <span key={lang} className="px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-[10px] font-bold uppercase">
                          {lang}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-xs text-[#93adc8]">{proj.lastModified}</td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-1.5 min-w-[140px]">
                      <div className={`flex items-center justify-between text-[9px] font-black uppercase tracking-widest ${getStatusColor(proj.status)}`}>
                        <span>{proj.status.replace('_', ' ')}</span>
                        <span>{calculateProgress(proj)}%</span>
                      </div>
                      <div className="h-1 w-full bg-border-dark rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ${getBarColor(proj.status)}`} style={{ width: `${calculateProgress(proj)}%` }}></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onOpenProject(proj)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-background-dark hover:bg-primary hover:text-white border border-border-dark text-[#93adc8] rounded text-[10px] font-bold uppercase tracking-widest transition-all"
                      >
                        Open
                        <span className="material-symbols-outlined text-xs">arrow_forward</span>
                      </button>
                      <button
                        onClick={() => triggerDelete(proj)}
                        className="p-1.5 text-[#5a7187] hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
                        title="Delete Project"
                      >
                        <span className="material-symbols-outlined text-xl">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 bg-background-dark/30 border-t border-border-dark flex items-center justify-between shrink-0">
          <span className="text-[10px] text-[#5a7187] font-bold uppercase">Showing {projects.length} of 24 projects</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 border border-border-dark rounded text-[10px] font-bold text-[#93adc8] hover:bg-surface-dark transition-colors uppercase">Previous</button>
            <button className="px-3 py-1 border border-border-dark rounded text-[10px] font-bold text-[#93adc8] hover:bg-surface-dark transition-colors uppercase">Next</button>
          </div>
        </div>
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-surface-dark border border-border-dark rounded-xl max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden">
            <div className="px-8 pt-8 pb-4">
              <div className="size-12 rounded bg-primary/10 flex items-center justify-center text-primary mb-6 border border-primary/20">
                <span className="material-symbols-outlined text-2xl">folder_zip</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-1 uppercase tracking-tight">Create New Project</h3>
              <p className="text-[#93adc8] text-[11px] font-medium uppercase tracking-widest">Localization & Production Suite</p>
            </div>

            <form onSubmit={handleCreateProject} className="px-8 pb-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#5a7187]">Project Title</label>
                <input
                  autoFocus
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-white placeholder:text-slate-600"
                  placeholder="e.g. Hall 4: Post-War Narratives"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#5a7187]">Source Language</label>
                  <select
                    value={newSourceLang}
                    onChange={(e) => setNewSourceLang(e.target.value)}
                    className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-white"
                  >
                    {sourceLangOptions.map(lang => (
                      <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#5a7187]">Target Languages</label>
                  <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
                    {availableLangs.map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => toggleTargetLang(lang.code)}
                        className={`py-2 px-3 rounded border text-[11px] font-bold text-left transition-all flex items-center gap-2 ${newTargetLangs.includes(lang.code)
                          ? 'bg-primary border-primary text-white'
                          : 'bg-background-dark border-border-dark text-[#5a7187] hover:border-[#93adc8]'
                          }`}
                      >
                        <span className={`w-3 h-3 rounded border flex items-center justify-center text-[8px] ${newTargetLangs.includes(lang.code) ? 'border-white bg-white/20' : 'border-[#5a7187]'
                          }`}>
                          {newTargetLangs.includes(lang.code) && '✓'}
                        </span>
                        {lang.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 bg-background-dark border border-border-dark text-[#93adc8] font-black text-[10px] uppercase tracking-widest rounded hover:bg-surface-dark hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-primary text-white font-black text-[10px] uppercase tracking-widest rounded hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-surface-dark border border-red-500/30 rounded-xl max-w-md w-full p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="size-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-6 border border-red-500/20">
              <span className="material-symbols-outlined text-2xl font-bold">warning</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-tight">Confirm Project Deletion</h3>
            <p className="text-[#93adc8] text-sm leading-relaxed mb-8">
              Are you sure you want to delete <span className="text-white font-bold">{projectToDelete?.name}</span>? This action is permanent and will remove all source documents, translations, and generated audio artifacts from the museum repository.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 bg-background-dark border border-border-dark text-[#93adc8] font-black text-[10px] uppercase tracking-widest rounded hover:bg-surface-dark hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-600 text-white font-black text-[10px] uppercase tracking-widest rounded hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
              >
                Purge All Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
