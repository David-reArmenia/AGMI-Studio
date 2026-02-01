
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
