
import { Project, WorkflowStatus, Term, SourceAsset } from './types';

const DEFAULT_CONTENT = `Welcome to the Tsitsernakaberd Memorial Complex. This hallowed ground serves as a solemn introduction to the tragic history of the Armenian people during the early 20th century. 

The systematic campaign, orchestrated under the leadership of Talat Pasha, forever altered the cultural and physical geography of Western Armenia and Anatolia.

Personal archives from Van, Bitlis, and Erzurum provide an intimate view of the resilience found within these communities.

The narrative continues through the Syrian Desert towards Deir ez-Zor. Phonetic accuracy for these locations is paramount for the audio guide.`;

const DEFAULT_ASSETS: SourceAsset[] = [
  {
    id: 'ASSET-001',
    name: 'Main_Script_HY.docx',
    type: 'docx',
    status: 'PARSED',
    lastModified: '2h ago',
    author: 'Staff-01',
    content: DEFAULT_CONTENT
  },
  {
    id: 'ASSET-002',
    name: 'Reference_Docs.pdf',
    type: 'pdf',
    status: 'PENDING',
    lastModified: 'Oct 14, 2023',
    author: 'Admin',
    content: "This is a reference document with supplementary historical data regarding the 1915 events."
  }
];

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'AGMI-PRJ-2024-001',
    name: 'Genocide Gallery A-24',
    sourceLang: 'HY',
    targetLangs: ['EN', 'FR', 'RU'],
    lastModified: 'Oct 24, 2023',
    status: WorkflowStatus.READY,
    progress: 100,
    assets: [...DEFAULT_ASSETS]
  },
  {
    id: 'AGMI-PRJ-2024-002',
    name: 'Permanent Collection v2',
    sourceLang: 'HY',
    targetLangs: ['EN', 'DE'],
    lastModified: 'Oct 25, 2023',
    status: WorkflowStatus.TTS_GENERATING,
    progress: 75,
    assets: [DEFAULT_ASSETS[0]]
  },
  {
    id: 'AGMI-PRJ-2024-003',
    name: 'Temporary Exhibit: Survivors',
    sourceLang: 'HY',
    targetLangs: ['EN', 'ES', 'IT'],
    lastModified: 'Oct 26, 2023',
    status: WorkflowStatus.TRANSLATING,
    progress: 40,
    assets: []
  }
];

export const MOCK_TERMS: Term[] = [
  { id: '1', text: 'Tsitsernakaberd', type: 'toponym', ipa: 't͡sit͡sɛrnɑkɑˈbɛrt', matches: 3, confidence: 98, status: 'verified' },
  { id: '2', text: 'Talat Pasha', type: 'figure', matches: 4, confidence: 99, status: 'verified' },
  { id: '3', text: 'Deir ez-Zor', type: 'toponym', matches: 1, confidence: 85, status: 'warning' },
  { id: '4', text: 'Western Armenia', type: 'toponym', matches: 2, confidence: 95, status: 'verified' },
  { id: '5', text: 'April 24, 1915', type: 'date', matches: 1, confidence: 100, status: 'verified' },
  { id: '6', text: 'Young Turks', type: 'historical_term', matches: 2, confidence: 92, status: 'verified' },
  { id: '7', text: 'Armenian', type: 'ethnonym', matches: 12, confidence: 100, status: 'verified' }
];
