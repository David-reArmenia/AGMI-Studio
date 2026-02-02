
import React, { useState } from 'react';
import { Project, Stage, WorkflowStatus, SourceAsset, Term, TranslationData } from './types';
import Dashboard from './components/Dashboard';
import ProjectEditor from './components/ProjectEditor';
import Header from './components/Header';
import Footer from './components/Footer';
// MOCK_PROJECTS available in constants.tsx if needed for testing
import { GoogleGenAI, Type } from "@google/genai";

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentView, setCurrentView] = useState<'dashboard' | 'editor'>('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState<Stage>(Stage.SOURCE_MATERIALS);
  const [isTranslating, setIsTranslating] = useState(false);

  const selectedProject = projects.find(p => p.id === selectedProjectId) || null;

  const handleOpenProject = (project: Project) => {
    setSelectedProjectId(project.id);
    setCurrentView('editor');
    setCurrentStage(Stage.SOURCE_MATERIALS);
  };

  const handleUpdateProject = (projectId: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...updates } : p));
  };

  const handleTranslateProject = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project || !project.assets.length) return;

    // Check for same language skip
    if (project.targetLangs.length === 1 && project.sourceLang === project.targetLangs[0]) {
      setCurrentStage(Stage.AUDIO_PRODUCTION);
      return;
    }

    setIsTranslating(true);
    setCurrentStage(Stage.TRANSLATION);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const sourceText = project.assets[0].content || "";
      const sourceTerms = project.terms || [];

      // Translate into all target languages
      const newTranslations: Record<string, TranslationData> = { ...project.translations };

      for (const lang of project.targetLangs) {
        if (lang === project.sourceLang) continue;

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Translate this museum script from ${project.sourceLang} to ${lang}. 
          Also translate the provided glossary terms while maintaining their types and generating new IPA transcriptions for the target language.
          Return a JSON object with 'translatedContent' (string) and 'translatedTerms' (array of term objects).
          
          TEXT: ${sourceText.substring(0, 3000)}
          GLOSSARY: ${JSON.stringify(sourceTerms)}`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                translatedContent: { type: Type.STRING },
                translatedTerms: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      text: { type: Type.STRING },
                      type: { type: Type.STRING },
                      ipa: { type: Type.STRING },
                      matches: { type: Type.INTEGER },
                      confidence: { type: Type.INTEGER },
                      status: { type: Type.STRING }
                    }
                  }
                }
              }
            }
          }
        });

        const result = JSON.parse(response.text || "{}");
        newTranslations[lang] = {
          content: result.translatedContent || "",
          terms: result.translatedTerms || [],
          status: 'COMPLETED'
        };
      }

      handleUpdateProject(projectId, {
        translations: newTranslations,
        status: WorkflowStatus.TRANSLATING,
        progress: 50
      });

    } catch (err) {
      console.error("Translation error:", err);
      alert("AI translation failed. Please check your connection.");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setSelectedProjectId(null);
  };

  return (
    <div className="h-screen flex flex-col bg-background-dark text-[#e1e1e1]">
      <Header
        view={currentView}
        onDashboardClick={handleBackToDashboard}
        project={selectedProject}
      />

      <main className="flex-1 overflow-hidden">
        {currentView === 'dashboard' ? (
          <Dashboard
            projects={projects}
            onOpenProject={handleOpenProject}
            onDeleteProject={(id) => setProjects(prev => prev.filter(p => p.id !== id))}
            onAddProject={(data) => {
              const p: Project = {
                ...data,
                id: `PRJ-${Date.now()}`,
                lastModified: 'Just now',
                status: WorkflowStatus.DRAFT,
                progress: 0,
                assets: []
              };
              setProjects(prev => [p, ...prev]);
            }}
          />
        ) : (
          selectedProject && (
            <ProjectEditor
              project={selectedProject}
              activeStage={currentStage}
              isProcessing={isTranslating}
              onStageChange={setCurrentStage}
              onAddAsset={(asset) => handleUpdateProject(selectedProject.id, { assets: [asset, ...selectedProject.assets] })}
              onRemoveAsset={(id) => handleUpdateProject(selectedProject.id, { assets: selectedProject.assets.filter(a => a.id !== id) })}
              onUpdateTerms={(terms) => handleUpdateProject(selectedProject.id, { terms })}
              onUpdateTranslations={(translations) => handleUpdateProject(selectedProject.id, { translations })}
              onSubmitToTranslation={() => handleTranslateProject(selectedProject.id)}
            />
          )
        )}
      </main>

      {currentView === 'dashboard' && <Footer />}
    </div>
  );
};

export default App;
