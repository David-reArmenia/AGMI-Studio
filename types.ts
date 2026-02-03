
export enum WorkflowStatus {
  READY = 'READY',
  TTS_GENERATING = 'TTS_GENERATING',
  TRANSLATING = 'TRANSLATING',
  DRAFT = 'DRAFT'
}

export enum Stage {
  SOURCE_MATERIALS = 0,
  TRANSLATION = 1,
  AUDIO_PRODUCTION = 2
}

export interface SourceAsset {
  id: string;
  name: string;
  type: 'docx' | 'pdf' | 'txt' | 'md' | 'doc';
  status: 'PARSED' | 'PENDING' | 'PROCESSING';
  lastModified: string;
  author: string;
  content?: string;
}

export interface TranslationData {
  content: string;
  terms: Term[];
  status: 'DRAFT' | 'COMPLETED' | 'IN_PROGRESS';
  ssml?: string; // Manual SSML override
}

export interface Project {
  id: string;
  name: string;
  sourceLang: string;
  targetLangs: string[];
  lastModified: string;
  status: WorkflowStatus;
  progress: number;
  assets: SourceAsset[];
  terms?: Term[];
  translations?: Record<string, TranslationData>; // Lang code -> Data
  audioOutputs?: AudioOutput[]; // Persisted audio generation results
}

export type TermCategory = 'toponym' | 'figure' | 'ethnonym' | 'historical_term' | 'date';

export interface Term {
  id: string;
  text: string;
  type: TermCategory;
  ipa?: string;
  matches: number;
  confidence: number;
  status: 'verified' | 'warning' | 'unresolved';
}

// TTS Types
export enum TTSVendor {
  GOOGLE = 'google',
  ELEVENLABS = 'elevenlabs',
  OPENAI = 'openai'
}

export interface VoiceProfile {
  id: string;
  name: string;
  vendor: TTSVendor;
  tags: string[];
  languages: string[];
  sampleUrl?: string;
  description?: string;
}

export interface TTSSettings {
  vendor: TTSVendor;
  voiceId: string;
  // Engineering Sliders
  ambience: number;       // 0.0 (Calm) - 1.0 (Dramatic)
  pacing: number;         // 0.5 (Slow) - 1.5 (Fast)
  pitch: number;          // 0.5 (Deep) - 1.5 (High)
  expressiveness: number; // 0.0 (Flat) - 1.0 (Lively)
  pausing: number;        // 0.0 (Minimal) - 1.0 (Dramatic)
  format: 'mp3' | 'wav' | 'ogg';
}

export interface AudioOutput {
  id: string;
  language: string;
  fileName: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
  progress: number;
  audioUrl?: string;
  error?: string;
  createdAt: string;
}
