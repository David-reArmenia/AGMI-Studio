import React, { useState, useEffect, useRef } from 'react';
import { SourceAsset } from '../../types';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { GoogleGenAI } from "@google/genai";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.mjs`;

interface SourceStageProps {
  assets: SourceAsset[];
  onAddAsset: (asset: SourceAsset) => void;
  onRemoveAsset: (assetId: string) => void;
  onUpdateAssetContent: (assetId: string, content: string) => void;
  onSubmit: () => void;
}

const SourceStage: React.FC<SourceStageProps> = ({ assets, onAddAsset, onRemoveAsset, onUpdateAssetContent, onSubmit }) => {
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(assets.length > 0 ? assets[0].id : null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiAction, setAiAction] = useState<string | null>(null);
  const [editableContent, setEditableContent] = useState('');
  const [selectionInfo, setSelectionInfo] = useState<{ start: number, end: number } | null>(null);
  const [contentHistory, setContentHistory] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const MAX_HISTORY = 10;

  const selectedAsset = assets.find(a => a.id === selectedAssetId);

  // Sync editable content with selected asset
  useEffect(() => {
    if (selectedAsset?.content) {
      setEditableContent(selectedAsset.content);
    } else {
      setEditableContent('');
    }
  }, [selectedAsset?.id, selectedAsset?.content]);

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

  const handleContentChange = (newContent: string) => {
    setEditableContent(newContent);
    if (selectedAssetId) {
      onUpdateAssetContent(selectedAssetId, newContent);
    }
  };

  const handleAiAction = async (action: string) => {
    if (!editableContent.trim() || isAiProcessing) return;

    // Get current selection from textarea
    const textarea = textareaRef.current;
    let start = 0;
    let end = editableContent.length;
    let hasSelection = false;

    if (textarea) {
      const selStart = textarea.selectionStart;
      const selEnd = textarea.selectionEnd;
      // Only use selection if something is actually selected (not just cursor position)
      if (selStart !== selEnd) {
        start = selStart;
        end = selEnd;
        hasSelection = true;
      }
    }

    const textToProcess = hasSelection ? editableContent.substring(start, end) : editableContent;

    // Save current state to history before making changes
    setContentHistory(prev => {
      const newHistory = [...prev, editableContent];
      return newHistory.slice(-MAX_HISTORY); // Keep only last MAX_HISTORY entries
    });

    setIsAiProcessing(true);
    setAiAction(action);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const prompts: Record<string, string> = {
        summarize: `Summarize this text concisely while preserving key information:\n\n${textToProcess}`,
        rewrite: `Rewrite this text to be clearer and more engaging while preserving the meaning:\n\n${textToProcess}`,
        simplify: `Simplify this text to be more accessible and easier to understand. Use simpler words and shorter sentences:\n\n${textToProcess}`,
        merge: `Merge similar paragraphs and consolidate repeated ideas in this text:\n\n${textToProcess}`,
        dedupe: `Remove duplicate or redundant information from this text while keeping the content complete:\n\n${textToProcess}`,
        normalize: `Normalize the writing style of this text to be consistent in tone, tense, and formatting:\n\n${textToProcess}`
      };

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompts[action] || prompts.rewrite
      });

      const result = response.text || '';
      if (result) {
        if (hasSelection) {
          // Replace only the selected portion
          const newContent = editableContent.substring(0, start) + result + editableContent.substring(end);
          handleContentChange(newContent);
        } else {
          // Replace entire content
          handleContentChange(result);
        }
      }
    } catch (err) {
      console.error('AI Action error:', err);
    } finally {
      setIsAiProcessing(false);
      setAiAction(null);
    }
  };

  const handleUndo = () => {
    if (contentHistory.length === 0) return;
    const previousContent = contentHistory[contentHistory.length - 1];
    setContentHistory(prev => prev.slice(0, -1));
    setEditableContent(previousContent);
    if (selectedAssetId) {
      onUpdateAssetContent(selectedAssetId, previousContent);
    }
  };

  const aiTools = [
    { id: 'summarize', icon: 'summarize', label: 'Summarize', desc: 'Generate summary' },
    { id: 'rewrite', icon: 'edit_note', label: 'Rewrite', desc: 'Rephrase content' },
    { id: 'simplify', icon: 'compress', label: 'Simplify', desc: 'Simpler language' },
    { id: 'merge', icon: 'merge', label: 'Merge', desc: 'Combine paragraphs' },
    { id: 'dedupe', icon: 'filter_alt', label: 'Dedupe', desc: 'Remove duplicates' },
    { id: 'normalize', icon: 'format_paint', label: 'Normalize', desc: 'Consistent style' }
  ];

  return (
    <div className="h-full flex overflow-hidden relative">
      <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.docx,.txt,.md,.doc" onChange={handleFileChange} />

      {/* Left Sidebar - Source Files */}
      <aside className="w-72 border-r border-border-dark flex flex-col bg-background-dark shrink-0">
        <div className="p-4 border-b border-border-dark">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-[#5a7187]">Source Files</h3>
            <span onClick={handleFileUploadClick} className="material-symbols-outlined text-sm cursor-pointer hover:text-white">add_circle</span>
          </div>
          <div onClick={handleFileUploadClick} className="border border-dashed border-border-dark p-4 flex flex-col items-center justify-center gap-2 hover:border-primary/50 cursor-pointer bg-surface-dark/20 group">
            <span className="material-symbols-outlined text-[#5a7187] group-hover:text-primary">upload_file</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#93adc8]">Upload</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {assets.map((asset) => (
            <div key={asset.id} onClick={() => setSelectedAssetId(asset.id)} className={`p-3 group relative cursor-pointer rounded transition-all ${selectedAssetId === asset.id ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-surface-dark border-l-2 border-transparent'}`}>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[#93adc8]">{['pdf', 'docx'].includes(asset.type) ? 'article' : 'description'}</span>
                <p className="text-xs font-bold truncate uppercase tracking-wider text-[#93adc8]">{asset.name}</p>
              </div>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const content = asset.content || '';
                    const blob = new Blob([content], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${asset.name.replace(/\.[^/.]+$/, '')}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="p-1 text-[#5a7187] hover:text-primary rounded"
                  title="Download"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                </button>
                <button onClick={(e) => { e.stopPropagation(); onRemoveAsset(asset.id); }} className="p-1 text-[#5a7187] hover:text-red-500 rounded" title="Remove">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content - Editable Text */}
      <section className="flex-1 flex flex-col bg-[#080c10] overflow-hidden border-r border-border-dark">
        <div className="h-10 border-b border-border-dark flex items-center justify-between px-4 bg-surface-dark/40 shrink-0">
          <div className="flex items-center gap-2 text-[#93adc8]">
            <button className="p-1 hover:bg-primary/10 rounded" title="Bold"><span className="material-symbols-outlined text-[18px]">format_bold</span></button>
            <button className="p-1 hover:bg-primary/10 rounded" title="Italic"><span className="material-symbols-outlined text-[18px]">format_italic</span></button>
            <div className="w-px h-4 bg-border-dark mx-1"></div>
            <button className="p-1 hover:bg-primary/10 rounded" title="Heading"><span className="material-symbols-outlined text-[18px]">title</span></button>
            <button className="p-1 hover:bg-primary/10 rounded" title="List"><span className="material-symbols-outlined text-[18px]">format_list_bulleted</span></button>
          </div>
          <div className="text-[10px] text-[#5a7187] font-mono tracking-widest font-bold uppercase">
            Words: {editableContent.split(/\s+/).filter(Boolean).length || 0}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-12 flex justify-center bg-[#0d141b]/50 custom-scrollbar">
          {selectedAsset ? (
            <div className="max-w-[720px] w-full">
              <textarea
                ref={textareaRef}
                className="w-full h-full min-h-[600px] bg-[#111820] p-16 shadow-2xl border border-border-dark/20 font-serif leading-relaxed text-[#b0bac5] resize-none outline-none focus:ring-1 focus:ring-primary/30"
                value={editableContent}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Start typing or upload a document..."
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full opacity-20">
              <span className="material-symbols-outlined text-[64px]">upload_file</span>
              <h2 className="text-xl font-black uppercase tracking-widest">No Asset</h2>
            </div>
          )}
        </div>
        <footer className="h-12 border-t border-border-dark bg-[#0a0f14] flex items-center justify-between px-6 shrink-0">
          <div className="flex -space-x-1.5 font-bold text-[10px]">
            <div className="size-6 rounded-full bg-blue-900 flex items-center justify-center">MK</div>
          </div>
          <button onClick={onSubmit} disabled={!selectedAsset} className={`px-6 py-2 font-black text-[10px] uppercase tracking-[0.2em] rounded flex items-center gap-2 transition-all ${!selectedAsset ? 'bg-border-dark text-[#5a7187] cursor-not-allowed' : 'bg-primary hover:bg-primary/90 text-white'}`}>
            Go to Translation <span className="material-symbols-outlined text-sm">arrow_right_alt</span>
          </button>
        </footer>
      </section>

      {/* Right Sidebar - AI Assist */}
      <aside className="w-80 border-l border-border-dark flex flex-col bg-background-dark shrink-0">
        <div className="p-4 border-b border-border-dark bg-surface-dark/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-8 rounded bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-lg">auto_awesome</span>
            </div>
            <div>
              <h3 className="font-black text-[11px] uppercase tracking-widest text-white">AI Assist</h3>
              <p className="text-[9px] text-[#5a7187] uppercase tracking-wide">Powered by Gemini</p>
            </div>
          </div>
          {isAiProcessing && (
            <div className="bg-violet-500/10 border border-violet-500/30 rounded-lg p-3 flex items-center gap-3">
              <span className="material-symbols-outlined text-violet-400 animate-spin">progress_activity</span>
              <span className="text-[10px] text-violet-300 font-bold uppercase tracking-wide">Processing {aiAction}...</span>
            </div>
          )}
          {contentHistory.length > 0 && !isAiProcessing && (
            <button
              onClick={handleUndo}
              className="w-full mt-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-center gap-2 text-amber-400 hover:bg-amber-500/20 transition-all"
            >
              <span className="material-symbols-outlined text-sm">undo</span>
              <span className="text-[10px] font-bold uppercase tracking-wide">Undo ({contentHistory.length})</span>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="space-y-2">
            {aiTools.map(tool => (
              <button
                key={tool.id}
                onClick={() => handleAiAction(tool.id)}
                disabled={isAiProcessing || !editableContent.trim()}
                className={`w-full p-3 rounded-lg border transition-all flex items-center gap-3 group ${isAiProcessing || !editableContent.trim()
                  ? 'bg-surface-dark/30 border-border-dark/50 text-[#5a7187] cursor-not-allowed'
                  : 'bg-surface-dark border-border-dark hover:border-violet-500/50 hover:bg-violet-500/5'
                  }`}
              >
                <span className={`material-symbols-outlined text-lg ${isAiProcessing || !editableContent.trim() ? 'text-[#5a7187]' : 'text-violet-400 group-hover:text-violet-300'
                  }`}>{tool.icon}</span>
                <div className="text-left">
                  <p className={`text-[11px] font-bold uppercase tracking-wide ${isAiProcessing || !editableContent.trim() ? 'text-[#5a7187]' : 'text-white'
                    }`}>{tool.label}</p>
                  <p className="text-[9px] text-[#5a7187]">{tool.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-border-dark">
            <h4 className="text-[9px] font-black uppercase tracking-widest text-[#5a7187] mb-3">Quick Tips</h4>
            <div className="space-y-2 text-[10px] text-[#5a7187]">
              <p>• Select text before applying actions for targeted edits</p>
              <p>• Use <strong>Summarize</strong> to create concise versions</p>
              <p>• <strong>Normalize</strong> ensures consistent voice</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default SourceStage;
