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
 * Converts expressiveness (0.0-1.0) to SSML emphasis level
 */
const getExpressivenessLevel = (expressiveness: number): string => {
    if (expressiveness <= 0.2) return 'none';
    if (expressiveness <= 0.5) return 'reduced';
    if (expressiveness <= 0.8) return 'moderate';
    return 'strong';
};

/**
 * Converts pacing value (0.5-1.5) to SSML rate percentage
 */
const getPacingRate = (pacing: number): string => {
    // 0.5 = 75%, 1.0 = 100%, 1.5 = 125%
    // Mapping: 0.5->-25%, 1.5->+25% roughly?
    // Let's use simple percentage: 1.0 = 100%. 0.5 = 50% (too slow?).
    // User requested "20-25% slower/faster".
    // Slider 0.5 .. 1.5. Normal=1.0.
    // Let's map 0.5 -> 80%, 1.5 -> 120%.
    // Formula: 80 + (val-0.5)*40 ?
    // 0.5 -> 80. 1.0 -> 100. 1.5 -> 120.
    const percentage = Math.round(80 + (pacing - 0.5) * 40);
    return `${percentage}%`;
};

/**
 * Converts pitch value (0.5-1.5) to semitones
 */
const getPitchShift = (pitch: number): string => {
    // 1.0 = 0st.
    // 0.5 = -4st (Deeper).
    // 1.5 = +4st (Brighter).
    const semitones = Math.round((pitch - 1.0) * 8); // +/- 4st range
    if (semitones > 0) return `+${semitones}st`;
    return `${semitones}st`;
};

/**
 * Converts ambience (0.0-1.0) to pitch range (dynamic vs flat)
 * Calm (0.0) -> Less dynamic range?
 * Dramatic (1.0) -> Higher dynamic range?
 * Google doesn't strictly support 'range' in prosody everywhere, but works in some cases.
 * Alternatively, we map Ambience to 'contour' or just ignore if not supported.
 * For now, we'll map it to nothing standard for Google unless we use 'style' which is unstable.
 * We can map it to 'loudness' or Volume?
 * Or we can leave it as a placeholder or map it to Pitch Variance if we can.
 * Let's skip mapping Ambience to output for now to act as "Neutral" unless we find a tag.
 * Wait, user prompt said: "Tone/Ambience... cool, collected... vs bright tone".
 * Maybe we mix Pitch adjustment?
 * Actually, let's just use it to drive Emphasis strength slightly if we want?
 * For now, we'll omit explicit Ambience-to-SSML tag to ensure safety, or maybe map to Volume?
 * Let's map it to volume: Calm = -1dB (softer), Dramatic = +2dB (louder)?
 */
const getAmbienceVolume = (ambience: number): string => {
    // 0.0 -> -2dB, 1.0 -> +2dB
    const db = Math.round((ambience - 0.5) * 4);
    if (db > 0) return `+${db}dB`;
    return `${db}dB`;
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
        } else {
            // Others
            // result = result;
        }
    }

    return vendor === TTSVendor.GOOGLE ? result : escapeXml(result);
};

/**
 * Modifies pausing by inserting breaks at punctuation
 */
const insertPausing = (content: string, pausing: number): string => {
    // pausing: 0.0 (Minimal) to 1.0 (Dramatic)
    // Minimal: No extra breaks.
    // Dramatic: Add breaks.

    if (pausing <= 0.2) return content; // Minimal/Normal linkage

    // Calculate break time. 
    // 0.3 -> 200ms
    // 1.0 -> 800ms
    const commaTime = Math.round(200 + (pausing - 0.2) * 300); // 200-440ms
    const sentenceTime = Math.round(400 + (pausing - 0.2) * 600); // 400-880ms

    // Replace punctuation with break tags
    // NOTE: This assumes 'content' already has XML escaped or phonemes inserted?
    // We should run this AFTER phonemes/escape?
    // Wait, insertPhonemes returns escaped content (mostly).
    // If we replace '.' with tags, we must be careful not to break tags.
    // But 'insertPhonemes' replaces text with tags. Punctuation is usually outside terms.
    // We'll simplisticly replace '.', ',', '!', '?' outside of tags?
    // Regex lookbehind/ahead is safer.

    // Simple approach: Replace literal ". " with ". <break time.../> "
    let result = content;

    // Sentence endings (. ? !)
    const sentenceBreak = `<break time="${sentenceTime}ms"/>`;
    result = result.replace(/([.?!])\s+/g, `$1 ${sentenceBreak} `);

    // Commas
    if (pausing > 0.5) {
        const commaBreak = `<break time="${commaTime}ms"/>`;
        result = result.replace(/(,)\s+/g, `$1 ${commaBreak} `);
    }

    return result;
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
    const { vendor, ambience, pitch, pacing, expressiveness, pausing } = settings;

    // 1. Process terms & escape
    let processedContent = insertPhonemes(content, terms, vendor);

    // 2. Apply Pausing (on top of processed content)
    // Only if Google (supports breaks well)
    if (vendor === TTSVendor.GOOGLE) {
        processedContent = insertPausing(processedContent, pausing);
    }

    // 3. Get Prosody Params
    const rate = getPacingRate(pacing);
    const pitchVal = getPitchShift(pitch);
    const volume = getAmbienceVolume(ambience); // Use ambience for volume for now
    const emphasisLevel = getExpressivenessLevel(expressiveness);

    // Build SSML based on vendor support
    if (vendor === TTSVendor.GOOGLE) {
        // Use prosody and emphasis
        return `<speak version="1.0" xml:lang="${language.toLowerCase()}">
  <prosody rate="${rate}" pitch="${pitchVal}" volume="${volume}">
    <emphasis level="${emphasisLevel}">
      ${processedContent}
    </emphasis>
  </prosody>
</speak>`;
    }

    // Fallback/Others
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
