import { Term, TTSSettings, TTSVendor } from '../types';

/**
 * Escapes special XML characters in text
 */
const escapeXml = (text: string): string => {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
};

/**
 * Converts emphasis value (0-2) to SSML emphasis level
 */
const getEmphasisLevel = (emphasis: number): string => {
    if (emphasis < 0.5) return 'reduced';
    if (emphasis < 1.0) return 'none';
    if (emphasis < 1.5) return 'moderate';
    return 'strong';
};

/**
 * Converts pacing value (0.5-2.0) to SSML rate percentage
 */
const getPacingRate = (pacing: number): string => {
    const percentage = Math.round(pacing * 100);
    return `${percentage}%`;
};

/**
 * Converts solemnity value (0-2) to pitch adjustment
 */
const getPitchFromSolemnity = (solemnity: number): string => {
    // Higher solemnity = lower pitch for gravitas
    const adjustment = Math.round((1 - solemnity) * 20);
    if (adjustment >= 0) return `+${adjustment}%`;
    return `${adjustment}%`;
};

/**
 * Inserts phoneme tags for terms with IPA in the content
 */
const insertPhonemes = (content: string, terms: Term[], vendor: TTSVendor): string => {
    if (!terms || terms.length === 0) return escapeXml(content);

    let result = content;

    // Sort terms by length (longest first) to avoid partial replacements
    const sortedTerms = [...terms]
        .filter(t => t.ipa && t.text)
        .sort((a, b) => b.text.length - a.text.length);

    for (const term of sortedTerms) {
        if (!term.ipa) continue;

        // Create regex for case-insensitive matching
        const regex = new RegExp(`\\b${escapeRegExp(term.text)}\\b`, 'gi');

        // Vendor-specific phoneme format
        if (vendor === TTSVendor.GOOGLE) {
            // Google supports standard SSML phoneme
            result = result.replace(regex, `<phoneme alphabet="ipa" ph="${term.ipa}">${term.text}</phoneme>`);
        } else if (vendor === TTSVendor.ELEVENLABS) {
            // ElevenLabs doesn't support SSML, so we leave text as-is for now
            // Future: could use their pronunciation dictionary API
            result = result;
        } else if (vendor === TTSVendor.OPENAI) {
            // OpenAI doesn't support SSML phonemes
            result = result;
        }
    }

    return vendor === TTSVendor.GOOGLE ? result : escapeXml(result);
};

/**
 * Escapes special regex characters
 */
const escapeRegExp = (string: string): string => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Generates SSML markup for the given content and settings
 */
export const generateSSML = (
    content: string,
    terms: Term[],
    settings: TTSSettings,
    language: string
): string => {
    const { vendor, emphasis, solemnity, pacing } = settings;

    // Process content with phonemes
    const processedContent = insertPhonemes(content, terms, vendor);

    // Get prosody values
    const rate = getPacingRate(pacing);
    const pitch = getPitchFromSolemnity(solemnity);
    const emphasisLevel = getEmphasisLevel(emphasis);

    // Build SSML based on vendor support
    if (vendor === TTSVendor.GOOGLE) {
        return `<speak version="1.0" xml:lang="${language.toLowerCase()}">
  <prosody rate="${rate}" pitch="${pitch}">
    <emphasis level="${emphasisLevel}">
      ${processedContent}
    </emphasis>
  </prosody>
</speak>`;
    }

    // For vendors without full SSML support, return simpler structure
    return `<speak version="1.0" xml:lang="${language.toLowerCase()}">
  <prosody rate="${rate}">
    ${escapeXml(content)}
  </prosody>
</speak>`;
};

/**
 * Generates a preview snippet of the SSML (first 500 chars)
 */
export const generateSSMLPreview = (
    content: string,
    terms: Term[],
    settings: TTSSettings,
    language: string
): string => {
    const truncatedContent = content.substring(0, 500) + (content.length > 500 ? '...' : '');
    return generateSSML(truncatedContent, terms, settings, language);
};

/**
 * Checks if a vendor supports SSML features
 */
export const vendorSupportsSSML = (vendor: TTSVendor): boolean => {
    return vendor === TTSVendor.GOOGLE;
};

/**
 * Generates SSML warnings for unsupported features
 */
export const getSSMLWarnings = (vendor: TTSVendor, hasIPA: boolean): string[] => {
    const warnings: string[] = [];

    if (!vendorSupportsSSML(vendor)) {
        warnings.push('This vendor has limited SSML support.');

        if (hasIPA) {
            warnings.push('IPA phoneme tags will be ignored for this vendor.');
        }
    }

    return warnings;
};
