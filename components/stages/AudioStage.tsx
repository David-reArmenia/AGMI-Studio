import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Project, TTSVendor, TTSSettings, VoiceProfile, AudioOutput, Term } from '../../types';
import { TTS_VENDORS, VOICE_PROFILES, getVoicesForVendor, getVendorConfig } from '../../constants/tts';
import { generateSSMLPreview, getSSMLWarnings, vendorSupportsSSML } from '../../utils/ssml';
import { GoogleGenAI, Modality } from "@google/genai";
import { convertAudio } from '../../utils/api';
import LoadingOverlay from '../LoadingOverlay';

interface AudioStageProps {
  project: Project;
  onUpdateOutputs: (outputs: AudioOutput[]) => void;
}

// Helper to decode base64 audio
function decodeBase64(base64: string): Uint8Array {
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

// Helper to create WAV file with proper headers from raw PCM data
function createWavFile(pcmData: Uint8Array, sampleRate: number, numChannels: number): ArrayBuffer {
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataLength = pcmData.length;
  const headerLength = 44;
  const totalLength = headerLength + dataLength;

  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalLength - 8, true); // File size minus RIFF header
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1 size (16 for PCM)
  view.setUint16(20, 1, true); // Audio format (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Write PCM data
  const pcmView = new Uint8Array(buffer, headerLength);
  pcmView.set(pcmData);

  return buffer;
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

const AudioStage: React.FC<AudioStageProps> = ({ project, onUpdateOutputs }) => {
  // Language state
  const [activeLang, setActiveLang] = useState(project.targetLangs[0] || 'EN');

  // TTS Settings state
  const [settings, setSettings] = useState<TTSSettings>({
    vendor: TTSVendor.GOOGLE,
    voiceId: 'Charon',
    emphasis: 0.85,
    solemnity: 1.2,
    pacing: 0.95,
    format: 'mp3',
  });

  // Audio output state - use project's persisted outputs
  const outputs = project.audioOutputs || [];
  const outputsRef = useRef(outputs);
  outputsRef.current = outputs; // Keep ref in sync

  const setOutputs = useCallback((updater: AudioOutput[] | ((prev: AudioOutput[]) => AudioOutput[])) => {
    const currentOutputs = outputsRef.current;
    const newOutputs = typeof updater === 'function' ? updater(currentOutputs) : updater;
    onUpdateOutputs(newOutputs);
  }, [onUpdateOutputs]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [playingOutputId, setPlayingOutputId] = useState<string | null>(null);

  // Refs for audio playback control
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const generatingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get current translation
  const currentTranslation = project.translations?.[activeLang];
  const currentTerms = currentTranslation?.terms || project.terms || [];

  // Filter voices by selected vendor
  const availableVoices = useMemo(() => {
    return getVoicesForVendor(settings.vendor);
  }, [settings.vendor]);

  // Get selected voice
  const selectedVoice = useMemo(() => {
    return availableVoices.find(v => v.id === settings.voiceId) || availableVoices[0];
  }, [availableVoices, settings.voiceId]);

  // Generate SSML preview
  const ssmlPreview = useMemo(() => {
    if (!currentTranslation?.content) return '';
    return generateSSMLPreview(currentTranslation.content, currentTerms, settings, activeLang);
  }, [currentTranslation, currentTerms, settings, activeLang]);

  // Get SSML warnings
  const ssmlWarnings = useMemo(() => {
    const hasIPA = currentTerms.some(t => t.ipa);
    return getSSMLWarnings(settings.vendor, hasIPA);
  }, [settings.vendor, currentTerms]);

  // Handle vendor change
  const handleVendorChange = useCallback((vendor: TTSVendor) => {
    const voices = getVoicesForVendor(vendor);
    setSettings(prev => ({
      ...prev,
      vendor,
      voiceId: voices[0]?.id || '',
    }));
  }, []);

  // Handle slider changes
  const handleSliderChange = useCallback((key: 'emphasis' | 'solemnity' | 'pacing', value: number) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  // Stop audio playback
  const stopAudio = useCallback(() => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {
        // Ignore if already stopped
      }
      audioSourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  // Handle audio preview using Gemini TTS
  const handlePreview = useCallback(async () => {
    // If already playing, stop the audio
    if (isPlaying) {
      stopAudio();
      return;
    }

    if (!currentTranslation?.content) return;

    setIsPlaying(true);

    // Show "Generating..." after 1 second if still loading
    generatingTimeoutRef.current = setTimeout(() => {
      setIsGeneratingPreview(true);
    }, 1000);

    try {
      console.log('[TTS Preview] === DEBUG START ===');
      console.log('[TTS Preview] API Key present:', !!process.env.API_KEY);
      console.log('[TTS Preview] Voice:', settings.voiceId);

      // Check if vendor supports streaming
      const vendorConfig = getVendorConfig(settings.vendor);
      const useStreaming = vendorConfig?.supportsStreaming ?? false;
      console.log('[TTS Preview] Streaming supported:', useStreaming);

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Use shorter text for preview to reduce latency
      const previewText = currentTranslation.content.substring(0, 300);
      let prompt = previewText;

      // Add pronunciation guidance for terms
      const termsWithIPA = currentTerms.filter(t => t.ipa);
      if (termsWithIPA.length > 0) {
        const pronunciationGuide = termsWithIPA
          .slice(0, 5) // Limit to 5 terms for faster generation
          .map(t => `"${t.text}" should be pronounced as "${t.ipa}"`)
          .join(', ');
        prompt = `${previewText}\n\n[Pronunciation guide: ${pronunciationGuide}]`;
      }

      console.log('[TTS Preview] Prompt length:', prompt.length);

      const requestConfig = {
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: settings.voiceId }
            }
          }
        },
      };

      let base64Audio: string | undefined;

      if (useStreaming) {
        // Use streaming API for faster time-to-first-audio
        console.log('[TTS Preview] Using streaming API...');
        const stream = await ai.models.generateContentStream(requestConfig);

        // Collect audio chunks
        const audioChunks: string[] = [];
        for await (const chunk of stream) {
          const chunkAudio = chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (chunkAudio) {
            audioChunks.push(chunkAudio);
            console.log('[TTS Preview] Received chunk, total chunks:', audioChunks.length);
          }
        }

        // Combine all chunks (for TTS, usually comes as one chunk but streaming reduces TTFB)
        base64Audio = audioChunks.join('');
        console.log('[TTS Preview] Streaming complete, total audio length:', base64Audio?.length);
      } else {
        // Use regular API for non-streaming vendors
        console.log('[TTS Preview] Using regular API...');
        const response = await ai.models.generateContent(requestConfig);
        base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      }

      console.log('[TTS Preview] Audio data received:', !!base64Audio, 'Length:', base64Audio?.length);

      if (base64Audio) {
        // Clear generating state immediately when audio is ready
        if (generatingTimeoutRef.current) {
          clearTimeout(generatingTimeoutRef.current);
          generatingTimeoutRef.current = null;
        }
        setIsGeneratingPreview(false);

        console.log('[TTS Preview] Creating AudioContext...');
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioContextRef.current = audioCtx;
        console.log('[TTS Preview] Decoding audio...');
        const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), audioCtx, 24000, 1);
        console.log('[TTS Preview] Audio buffer created, duration:', audioBuffer.duration);
        const source = audioCtx.createBufferSource();
        audioSourceRef.current = source;
        source.buffer = audioBuffer;
        source.playbackRate.value = settings.pacing;
        source.connect(audioCtx.destination);
        source.onended = () => {
          console.log('[TTS Preview] Playback ended');
          setIsPlaying(false);
          audioSourceRef.current = null;
          if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
          }
        };
        console.log('[TTS Preview] Starting playback...');
        source.start();
        console.log('[TTS Preview] === DEBUG END (Success) ===');
      } else {
        console.warn('[TTS Preview] No audio data received');
        setIsPlaying(false);
      }
    } catch (error: any) {
      console.error('[TTS Preview] === ERROR ===');
      console.error('[TTS Preview] Error name:', error?.name);
      console.error('[TTS Preview] Error message:', error?.message);
      console.error('[TTS Preview] Full error:', error);
      setIsPlaying(false);
    } finally {
      // Clear the generating timeout and state
      if (generatingTimeoutRef.current) {
        clearTimeout(generatingTimeoutRef.current);
        generatingTimeoutRef.current = null;
      }
      setIsGeneratingPreview(false);
    }
  }, [isPlaying, currentTranslation, currentTerms, settings, stopAudio]);

  // Handle full audio generation
  const handleGenerate = useCallback(async () => {
    if (!currentTranslation?.content || isGenerating) return;

    const outputId = `output-${Date.now()}`;
    // Local timezone timestamp
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
    const projectName = project.name.replace(/\s+/g, '_');
    const vendorName = settings.vendor.toUpperCase();
    const settingsStr = `${vendorName},${settings.voiceId},e${(settings.emphasis * 100).toFixed(0)},s${(settings.solemnity * 100).toFixed(0)},p${(settings.pacing * 100).toFixed(0)}`;
    const fileName = `${projectName}_(${settingsStr})_${timestamp}.${settings.format}`;

    const newOutput: AudioOutput = {
      id: outputId,
      language: activeLang,
      fileName,
      status: 'generating',
      progress: 0,
      createdAt: new Date().toISOString(),
    };

    setOutputs(prev => [newOutput, ...prev]);
    setIsGenerating(true);
    setGenerationProgress(0);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // For demo purposes, generate full content
      const content = currentTranslation.content;

      // Add pronunciation guidance
      const termsWithIPA = currentTerms.filter(t => t.ipa);
      let prompt = content;
      if (termsWithIPA.length > 0) {
        const pronunciationGuide = termsWithIPA
          .map(t => `"${t.text}" should be pronounced as "${t.ipa}"`)
          .join(', ');
        prompt = `${content}\n\n[Pronunciation guide: ${pronunciationGuide}]`;
      }

      // Simulate progress
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      console.log('[TTS Generate] Starting generation for', activeLang);

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: settings.voiceId }
            }
          }
        },
      });

      clearInterval(progressInterval);

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        // Create audio file with proper format
        const audioBytes = decodeBase64(base64Audio);

        let blob: Blob;

        if (settings.format === 'wav') {
          // WAV: Handle locally with proper headers
          const wavBuffer = createWavFile(audioBytes, 24000, 1);
          blob = new Blob([wavBuffer], { type: 'audio/wav' });
          console.log('[TTS Generate] Created WAV file locally');
        } else {
          // MP3/OGG: Use server-side ffmpeg conversion
          console.log(`[TTS Generate] Converting to ${settings.format} via server...`);
          try {
            blob = await convertAudio(audioBytes, settings.format as 'mp3' | 'ogg', 24000, 1);
            console.log(`[TTS Generate] Server conversion to ${settings.format} complete`);
          } catch (conversionError) {
            console.warn('[TTS Generate] Server conversion failed, falling back to WAV:', conversionError);
            // Fallback to WAV if conversion fails
            const wavBuffer = createWavFile(audioBytes, 24000, 1);
            blob = new Blob([wavBuffer], { type: 'audio/wav' });
          }
        }

        const audioUrl = URL.createObjectURL(blob);

        setOutputs(prev => prev.map(o =>
          o.id === outputId
            ? { ...o, status: 'completed', progress: 100, audioUrl }
            : o
        ));
        setGenerationProgress(100);
        console.log('[TTS Generate] Completed successfully, audio size:', blob.size);
      } else {
        throw new Error('No audio data received');
      }
    } catch (error) {
      console.error('[TTS Generate] Error:', error);
      setOutputs(prev => prev.map(o =>
        o.id === outputId
          ? { ...o, status: 'error', error: String(error) }
          : o
      ));
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  }, [currentTranslation, currentTerms, settings, activeLang, project.name, isGenerating]);

  // Handle download
  const handleDownload = useCallback((output: AudioOutput) => {
    if (!output.audioUrl) return;
    const a = document.createElement('a');
    a.href = output.audioUrl;
    a.download = output.fileName;
    a.click();
  }, []);

  // Handle delete output
  const handleDeleteOutput = useCallback((outputId: string) => {
    // Stop if this output is playing
    if (playingOutputId === outputId) {
      setPlayingOutputId(null);
    }
    // Revoke blob URL to free memory
    const output = outputs.find(o => o.id === outputId);
    if (output?.audioUrl) {
      URL.revokeObjectURL(output.audioUrl);
    }
    setOutputs(prev => prev.filter(o => o.id !== outputId));
  }, [outputs, setOutputs, playingOutputId]);

  // Ref to track current audio element for stopping
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Handle play output from list
  const handlePlayOutput = useCallback((output: AudioOutput) => {
    if (!output.audioUrl) return;

    if (playingOutputId === output.id) {
      // Stop current playback immediately
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current = null;
      }
      setPlayingOutputId(null);
      return;
    }

    // Stop any existing playback
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
    }

    // Play the audio
    setPlayingOutputId(output.id);
    const audio = new Audio(output.audioUrl);
    currentAudioRef.current = audio;
    audio.onended = () => {
      setPlayingOutputId(null);
      currentAudioRef.current = null;
    };
    audio.onerror = () => {
      setPlayingOutputId(null);
      currentAudioRef.current = null;
    };
    audio.play().catch(() => {
      setPlayingOutputId(null);
      currentAudioRef.current = null;
    });
  }, [playingOutputId]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Target Lang Switcher */}
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

      <main className="flex flex-1 overflow-hidden relative">
        {/* Loading Overlay for generation */}
        <LoadingOverlay
          isVisible={isGenerating}
          message="Generating Audio"
          progress={generationProgress}
          subMessage={`Processing ${activeLang} narration with ${selectedVoice?.name || 'selected'} voice`}
        />

        {/* Left Panel: Vendor & Voice Selection */}
        <aside className="w-80 border-r border-border-dark flex flex-col bg-background-dark/50 overflow-hidden shrink-0">
          {/* Vendor Selector */}
          <div className="p-4 border-b border-border-dark">
            <h3 className="text-white font-black text-[10px] uppercase tracking-widest mb-3">TTS Provider</h3>
            <select
              value={settings.vendor}
              onChange={(e) => handleVendorChange(e.target.value as TTSVendor)}
              className="w-full bg-surface-dark border border-border-dark rounded px-3 py-2 text-white text-xs uppercase font-bold outline-none focus:border-primary"
            >
              {TTS_VENDORS.map(vendor => (
                <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
              ))}
            </select>
            <p className="text-[9px] text-[#5a7187] mt-2">
              {getVendorConfig(settings.vendor)?.description}
            </p>
          </div>

          {/* Voice Profiles */}
          <div className="p-4 border-b border-border-dark flex-1 overflow-y-auto custom-scrollbar">
            <h3 className="text-white font-black text-[10px] uppercase tracking-widest mb-3">Voice Models</h3>
            <div className="space-y-2">
              {availableVoices.map(voice => (
                <div
                  key={voice.id}
                  onClick={() => setSettings(prev => ({ ...prev, voiceId: voice.id }))}
                  className={`p-3 rounded border cursor-pointer transition-all ${settings.voiceId === voice.id
                    ? 'border-primary/50 bg-primary/10'
                    : 'border-border-dark hover:border-primary/30'
                    }`}
                >
                  <p className="text-white text-xs font-black uppercase tracking-wider">{voice.name}</p>
                  <p className="text-[9px] text-[#93adc8] mt-0.5">{voice.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {voice.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 rounded bg-background-dark text-[8px] font-black text-white/70 uppercase">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Format Selection */}
          <div className="p-4 border-t border-border-dark">
            <h3 className="text-white font-black text-[10px] uppercase tracking-widest mb-3">Output Format</h3>
            <div className="flex gap-2">
              {['mp3', 'wav', 'ogg'].map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setSettings(prev => ({ ...prev, format: fmt as any }))}
                  className={`flex-1 py-2 rounded text-[10px] font-black uppercase border transition-all ${settings.format === fmt
                    ? 'bg-primary border-primary text-white'
                    : 'border-border-dark text-[#5a7187] hover:border-white'
                    }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Center Panel: Content (Text, SSML, terms) */}
        <section className="flex-1 flex flex-col bg-background-dark overflow-hidden">
          {/* Upper Part: Final Text (70%) */}
          <div className="flex-[0.7] border-b border-border-dark p-6 flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-black text-white tracking-tight uppercase">Narration Script</h2>
              <span className="text-[10px] text-[#5a7187] bg-surface-dark px-2 py-1 rounded border border-border-dark uppercase tracking-wider">
                {activeLang}
              </span>
            </div>
            <div className="flex-1 bg-surface-dark/30 rounded-xl border border-border-dark/50 p-6 overflow-y-auto custom-scrollbar shadow-inner">
              <p className="text-[#e1e1e1] text-sm leading-relaxed whitespace-pre-wrap font-serif">
                {currentTranslation?.content || <span className="text-[#5a7187] italic">No translation content available.</span>}
              </p>
            </div>
          </div>

          {/* Lower Part: Split SSML & Terms (30%) */}
          <div className="flex-[0.3] flex border-t border-border-dark min-h-0">
            {/* Left: SSML Preview */}
            <div className="w-1/2 border-r border-border-dark flex flex-col overflow-hidden bg-[#05080b]">
              <div className="p-3 border-b border-border-dark flex items-center justify-between bg-surface-dark/50">
                <h3 className="text-white font-black text-[10px] uppercase tracking-[0.2em]">SSML Preview</h3>
                {vendorSupportsSSML(settings.vendor) ? (
                  <span className="text-[8px] px-2 py-0.5 bg-green-900/50 text-green-400 rounded uppercase font-bold">Enabled</span>
                ) : (
                  <span className="text-[8px] px-2 py-0.5 bg-yellow-900/50 text-yellow-400 rounded uppercase font-bold">Limited</span>
                )}
              </div>

              {/* SSML Warnings */}
              {ssmlWarnings.length > 0 && (
                <div className="px-3 py-1 bg-yellow-900/20 border-b border-yellow-900/50">
                  {ssmlWarnings.map((warning, i) => (
                    <p key={i} className="text-[8px] text-yellow-400 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[10px]">warning</span>
                      {warning}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex-1 p-3 font-mono text-[9px] leading-relaxed overflow-y-auto custom-scrollbar">
                <pre className="text-[#93adc8] whitespace-pre-wrap break-words">
                  {ssmlPreview || '<No content available>'}
                </pre>
              </div>
            </div>

            {/* Right: Glossary Terms */}
            <div className="w-1/2 flex flex-col overflow-hidden bg-[#05080b]">
              <div className="p-3 border-b border-border-dark bg-surface-dark/50">
                <h3 className="text-white font-black text-[10px] uppercase tracking-[0.2em] flex justify-between items-center">
                  Glossary Terms
                  <span className="opacity-60">{currentTerms.length}</span>
                </h3>
              </div>
              <div className="flex-1 p-3 overflow-y-auto custom-scrollbar space-y-1">
                {currentTerms.map(t => (
                  <div key={t.id} className="text-[9px] bg-surface-dark/50 border border-border-dark/30 rounded p-2 flex justify-between items-center group hover:border-border-dark">
                    <span className="text-white font-medium truncate flex-1">{t.text}</span>
                    <span className="font-mono text-primary ml-2 opacity-80 group-hover:opacity-100">{t.ipa || '—'}</span>
                  </div>
                ))}
                {currentTerms.length === 0 && (
                  <p className="text-[9px] text-[#5a7187] italic text-center mt-4">No glossary terms detected</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Right Panel: Controls & Generation */}
        <aside className="w-80 border-l border-border-dark flex flex-col bg-background-dark/50 overflow-hidden shrink-0">
          <div className="p-6 border-b border-border-dark">
            <h2 className="text-lg font-black text-white tracking-tight uppercase mb-1">Engineering</h2>
            <p className="text-[9px] text-[#93adc8] uppercase">Vocal Parameters</p>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
            {/* Sliders */}
            <div className="space-y-6">
              {/* Emphasis Slider */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-white uppercase">Emphasis</label>
                  <span className="px-1.5 py-0.5 bg-surface-dark rounded font-mono text-primary text-[9px] border border-border-dark">
                    {settings.emphasis.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={settings.emphasis}
                  onChange={(e) => handleSliderChange('emphasis', parseFloat(e.target.value))}
                  className="w-full h-1 bg-border-dark rounded-full appearance-none accent-primary cursor-pointer"
                />
              </div>

              {/* Solemnity Slider */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-white uppercase">Solemnity</label>
                  <span className="px-1.5 py-0.5 bg-surface-dark rounded font-mono text-primary text-[9px] border border-border-dark">
                    {settings.solemnity.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={settings.solemnity}
                  onChange={(e) => handleSliderChange('solemnity', parseFloat(e.target.value))}
                  className="w-full h-1 bg-border-dark rounded-full appearance-none accent-primary cursor-pointer"
                />
              </div>

              {/* Pacing Slider */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-white uppercase">Pacing</label>
                  <span className="px-1.5 py-0.5 bg-surface-dark rounded font-mono text-primary text-[9px] border border-border-dark">
                    {settings.pacing.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.05"
                  value={settings.pacing}
                  onChange={(e) => handleSliderChange('pacing', parseFloat(e.target.value))}
                  className="w-full h-1 bg-border-dark rounded-full appearance-none accent-primary cursor-pointer"
                />
              </div>
            </div>

            {/* Generation Buttons */}
            <div className="pt-6 border-t border-border-dark/50 space-y-4">
              <button
                onClick={handlePreview}
                disabled={!currentTranslation?.content}
                className={`w-full py-3 font-black uppercase tracking-widest rounded text-[10px] transition-all flex items-center justify-center gap-2 ${isPlaying && !isGeneratingPreview
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : isGeneratingPreview
                    ? 'bg-yellow-500 text-black cursor-wait'
                    : 'bg-surface-dark border border-border-dark text-white hover:bg-surface-dark/80 hover:border-primary/50'
                  } ${!currentTranslation?.content ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className="material-symbols-outlined text-sm">
                  {isGeneratingPreview ? 'hourglass_top' : isPlaying ? 'stop_circle' : 'play_circle'}
                </span>
                {isGeneratingPreview ? 'Generating...' : isPlaying ? 'Stop Preview' : 'Preview Segment'}
              </button>

              <button
                onClick={handleGenerate}
                disabled={isGenerating || !currentTranslation?.content}
                className={`w-full py-4 font-black uppercase tracking-widest rounded text-[11px] transition-all flex items-center justify-center gap-2 ${isGenerating
                  ? 'bg-orange-500/50 text-white cursor-wait'
                  : 'bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-500/20'
                  } ${!currentTranslation?.content ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className="material-symbols-outlined text-sm">{isGenerating ? 'hourglass_top' : 'record_voice_over'}</span>
                {isGenerating ? `${generationProgress}%` : 'Generate Full'}
              </button>
            </div>

            {/* Generated Outputs List */}
            <div className="pt-6 border-t border-border-dark/50">
              <p className="text-[10px] font-black text-white uppercase mb-4">Output Library</p>
              <div className="space-y-2">
                {outputs.length === 0 ? (
                  <p className="text-[9px] text-[#5a7187] italic text-center py-4 bg-surface-dark/30 rounded border border-border-dark/30">No audio generated</p>
                ) : (
                  outputs.map(output => (
                    <div
                      key={output.id}
                      className="p-3 bg-surface-dark rounded border border-border-dark flex items-center justify-between group hover:border-border-dark/80"
                    >
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="text-[9px] text-white font-bold truncate" title={output.fileName}>{output.fileName}</p>
                        <p className="text-[8px] text-[#5a7187] uppercase mt-0.5">
                          {output.status === 'completed' ? <span className="text-emerald-500">Ready</span> : output.status === 'error' ? <span className="text-red-500">Failed</span> : 'Processing...'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {output.status === 'completed' && output.audioUrl && (
                          <>
                            <button
                              onClick={() => handlePlayOutput(output)}
                              className={`p-1.5 rounded transition-all ${playingOutputId === output.id ? 'bg-primary text-white' : 'text-[#5a7187] hover:text-primary hover:bg-primary/10'}`}
                              title={playingOutputId === output.id ? 'Stop' : 'Play'}
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                {playingOutputId === output.id ? 'stop' : 'play_arrow'}
                              </span>
                            </button>
                            <button
                              onClick={() => handleDownload(output)}
                              className="p-1.5 rounded text-[#5a7187] hover:text-white hover:bg-white/10 transition-all"
                              title="Download"
                            >
                              <span className="material-symbols-outlined text-[14px]">download</span>
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteOutput(output.id)}
                          className="p-1.5 rounded text-[#5a7187] hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                          title="Delete"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default AudioStage;
