import { TTSVendor, VoiceProfile } from '../types';

// TTS Vendor Configuration
export const TTS_VENDORS = [
    {
        id: TTSVendor.GOOGLE,
        name: 'Google (Gemini)',
        description: 'High-quality TTS using Google Gemini AI',
        envKey: 'GEMINI_API_KEY',
        supportsSSML: true,
        supportsStreaming: true,
        supportedFormats: ['mp3', 'wav'] as const,
    },
    {
        id: TTSVendor.ELEVENLABS,
        name: 'ElevenLabs',
        description: 'Premium AI voice synthesis',
        envKey: 'ELEVENLABS_API_KEY',
        supportsSSML: false,
        supportsStreaming: true,
        supportedFormats: ['mp3', 'wav', 'ogg'] as const,
    },
    {
        id: TTSVendor.OPENAI,
        name: 'OpenAI',
        description: 'OpenAI TTS voices',
        envKey: 'OPENAI_API_KEY',
        supportsSSML: false,
        supportsStreaming: false,
        supportedFormats: ['mp3', 'wav', 'ogg'] as const,
    },
];

// Voice profiles per vendor
export const VOICE_PROFILES: VoiceProfile[] = [
    // Google Gemini voices
    {
        id: 'Puck',
        name: 'Puck',
        vendor: TTSVendor.GOOGLE,
        tags: ['Male', 'Neutral', 'Clear'],
        languages: ['EN', 'HY', 'RU', 'FR', 'DE', 'ES'],
        description: 'Clear and neutral male voice',
    },
    {
        id: 'Charon',
        name: 'Charon',
        vendor: TTSVendor.GOOGLE,
        tags: ['Male', 'Deep', 'Somber'],
        languages: ['EN', 'HY', 'RU', 'FR', 'DE', 'ES'],
        description: 'Deep and somber male voice, suited for historical content',
    },
    {
        id: 'Kore',
        name: 'Kore',
        vendor: TTSVendor.GOOGLE,
        tags: ['Female', 'Warm', 'Gentle'],
        languages: ['EN', 'HY', 'RU', 'FR', 'DE', 'ES'],
        description: 'Warm and gentle female voice',
    },
    {
        id: 'Fenrir',
        name: 'Fenrir',
        vendor: TTSVendor.GOOGLE,
        tags: ['Male', 'Strong', 'Dramatic'],
        languages: ['EN', 'HY', 'RU', 'FR', 'DE', 'ES'],
        description: 'Strong and dramatic male voice',
    },
    {
        id: 'Aoede',
        name: 'Aoede',
        vendor: TTSVendor.GOOGLE,
        tags: ['Female', 'Expressive', 'Narrator'],
        languages: ['EN', 'HY', 'RU', 'FR', 'DE', 'ES'],
        description: 'Expressive female narrator voice',
    },

    // ElevenLabs voices
    {
        id: 'eleven_rachel',
        name: 'Rachel',
        vendor: TTSVendor.ELEVENLABS,
        tags: ['Female', 'American', 'Calm'],
        languages: ['EN'],
        description: 'Calm American female voice',
    },
    {
        id: 'eleven_adam',
        name: 'Adam',
        vendor: TTSVendor.ELEVENLABS,
        tags: ['Male', 'American', 'Deep'],
        languages: ['EN'],
        description: 'Deep American male voice',
    },
    {
        id: 'eleven_antoni',
        name: 'Antoni',
        vendor: TTSVendor.ELEVENLABS,
        tags: ['Male', 'British', 'Narrator'],
        languages: ['EN'],
        description: 'British narrator voice',
    },

    // OpenAI voices
    {
        id: 'alloy',
        name: 'Alloy',
        vendor: TTSVendor.OPENAI,
        tags: ['Neutral', 'Clear', 'Versatile'],
        languages: ['EN', 'ES', 'FR', 'DE', 'IT', 'PT', 'RU'],
        description: 'Neutral and versatile voice',
    },
    {
        id: 'echo',
        name: 'Echo',
        vendor: TTSVendor.OPENAI,
        tags: ['Male', 'Warm', 'Engaging'],
        languages: ['EN', 'ES', 'FR', 'DE', 'IT', 'PT', 'RU'],
        description: 'Warm and engaging male voice',
    },
    {
        id: 'fable',
        name: 'Fable',
        vendor: TTSVendor.OPENAI,
        tags: ['Female', 'Expressive', 'Storyteller'],
        languages: ['EN', 'ES', 'FR', 'DE', 'IT', 'PT', 'RU'],
        description: 'Expressive storyteller voice',
    },
    {
        id: 'onyx',
        name: 'Onyx',
        vendor: TTSVendor.OPENAI,
        tags: ['Male', 'Deep', 'Authoritative'],
        languages: ['EN', 'ES', 'FR', 'DE', 'IT', 'PT', 'RU'],
        description: 'Deep authoritative voice',
    },
    {
        id: 'nova',
        name: 'Nova',
        vendor: TTSVendor.OPENAI,
        tags: ['Female', 'Friendly', 'Natural'],
        languages: ['EN', 'ES', 'FR', 'DE', 'IT', 'PT', 'RU'],
        description: 'Friendly and natural female voice',
    },
];

// Get voices for a specific vendor
export const getVoicesForVendor = (vendor: TTSVendor): VoiceProfile[] => {
    return VOICE_PROFILES.filter(v => v.vendor === vendor);
};

// Get vendor config by ID
export const getVendorConfig = (vendor: TTSVendor) => {
    return TTS_VENDORS.find(v => v.id === vendor);
};
