import React from 'react';
import { Project, Stage, SourceAsset, Term, TranslationData, AudioOutput } from '../types';
import SourceStage from './stages/SourceStage';
import TranslationStage from './stages/TranslationStage';
import AudioStage from './stages/AudioStage';
import LoadingOverlay from './LoadingOverlay';

interface ProjectEditorProps {
  project: Project;
  activeStage: Stage;
  isProcessing: boolean;
  onStageChange: (stage: Stage) => void;
  onAddAsset: (asset: SourceAsset) => void;
  onRemoveAsset: (assetId: string) => void;
  onUpdateAssetContent: (assetId: string, content: string) => void;
  onUpdateTerms: (terms: Term[]) => void;
  onUpdateTranslations: (translations: Record<string, TranslationData>) => void;
  onUpdateAudioOutputs: (outputs: AudioOutput[]) => void;
  onSubmitToTranslation: () => void;
}

const ProjectEditor: React.FC<ProjectEditorProps> = ({
  project,
  activeStage,
  isProcessing,
  onStageChange,
  onAddAsset,
  onRemoveAsset,
  onUpdateAssetContent,
  onUpdateTerms,
  onUpdateTranslations,
  onUpdateAudioOutputs,
  onSubmitToTranslation
}) => {

  const handleExport = () => {
    const data = project.terms || [];
    if (data.length === 0) {
      alert("No terms available to export.");
      return;
    }
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', `${project.name.replace(/\s+/g, '_')}_Glossary.json`);
    linkElement.click();
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Project Header and Tabs */}
      <div className="bg-surface-dark border-b border-border-dark shrink-0">
        <div className="px-6 pt-4 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-museum-gold tracking-widest uppercase py-1 px-2 bg-museum-gold/10 rounded border border-museum-gold/20">
                {project.id}
              </span>
              <h2 className="text-xl font-medium text-white tracking-tight">{project.name}</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[11px] text-[#93adc8] font-bold uppercase tracking-wider">
                <span className={`h-2 w-2 rounded-full ${isProcessing ? 'animate-pulse bg-primary' : (activeStage === Stage.AUDIO_PRODUCTION ? 'bg-emerald-500' : 'bg-primary')}`}></span>
                <span>{isProcessing ? 'Processing AI Data...' : `Stage ${activeStage + 1}: ${Stage[activeStage].replace('_', ' ')}`}</span>
              </div>
              <button
                onClick={handleExport}
                className="text-xs font-bold text-[#93adc8] hover:text-white flex items-center gap-1 uppercase tracking-widest"
              >
                <span className="material-symbols-outlined text-sm">share</span> Export
              </button>
            </div>
          </div>

          <div className="flex gap-8">
            <button
              onClick={() => onStageChange(Stage.SOURCE_MATERIALS)}
              className={`pb-3 text-[11px] font-black tracking-widest flex items-center gap-2 uppercase transition-all ${activeStage === Stage.SOURCE_MATERIALS ? 'border-b-2 border-primary text-white' : 'text-[#93adc8] hover:text-white border-b-2 border-transparent'}`}
            >
              <span className="material-symbols-outlined text-[18px]">description</span>
              SOURCE MATERIALS
            </button>
            <button
              onClick={() => onStageChange(Stage.TRANSLATION)}
              className={`pb-3 text-[11px] font-black tracking-widest flex items-center gap-2 uppercase transition-all ${activeStage === Stage.TRANSLATION ? 'border-b-2 border-primary text-white' : 'text-[#93adc8] hover:text-white border-b-2 border-transparent'}`}
            >
              <span className="material-symbols-outlined text-[18px]">translate</span>
              TRANSLATION
            </button>
            <button
              onClick={() => onStageChange(Stage.AUDIO_PRODUCTION)}
              className={`pb-3 text-[11px] font-black tracking-widest flex items-center gap-2 uppercase transition-all ${activeStage === Stage.AUDIO_PRODUCTION ? 'border-b-2 border-primary text-white' : 'text-[#93adc8] hover:text-white border-b-2 border-transparent'}`}
            >
              <span className="material-symbols-outlined text-[18px]">graphic_eq</span>
              AUDIO PRODUCTION
            </button>
          </div>
        </div>
      </div>

      {/* Stage Viewport */}
      <div className="flex-1 overflow-hidden relative">
        {/* Translation Processing Overlay */}
        <LoadingOverlay
          isVisible={isProcessing}
          message="Translating Content"
          subMessage={`Generating ${project.targetLangs.filter(l => l !== project.sourceLang).join(', ')} translations with AI`}
        />

        {activeStage === Stage.SOURCE_MATERIALS && (
          <SourceStage
            assets={project.assets}
            onAddAsset={onAddAsset}
            onRemoveAsset={onRemoveAsset}
            onUpdateAssetContent={onUpdateAssetContent}
            onSubmit={onSubmitToTranslation}
          />
        )}
        {activeStage === Stage.TRANSLATION && (
          <TranslationStage
            project={project}
            onUpdateTranslations={onUpdateTranslations}
            onUpdateTerms={onUpdateTerms}
            onProceed={() => onStageChange(Stage.AUDIO_PRODUCTION)}
          />
        )}
        {activeStage === Stage.AUDIO_PRODUCTION && (
          <AudioStage
            project={project}
            onUpdateOutputs={onUpdateAudioOutputs}
            onUpdateTranslations={onUpdateTranslations}
          />
        )}
      </div>
    </div>
  );
};

export default ProjectEditor;

