import express from 'express';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { Readable, PassThrough } from 'stream';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

const router = express.Router();

// POST /api/audio/convert
// Converts raw PCM audio to the requested format (mp3, ogg, wav)
router.post('/convert', express.raw({ type: '*/*', limit: '50mb' }), async (req, res) => {
    const { format = 'mp3', sampleRate = '24000', channels = '1' } = req.query;

    if (!req.body || req.body.length === 0) {
        return res.status(400).json({ error: 'No audio data provided' });
    }

    const validFormats = ['mp3', 'wav', 'ogg'];
    if (!validFormats.includes(format)) {
        return res.status(400).json({ error: `Invalid format. Supported: ${validFormats.join(', ')}` });
    }

    console.log(`[Audio Convert] Converting ${req.body.length} bytes to ${format}`);

    try {
        // Create temp files for input/output
        const tempDir = os.tmpdir();
        const inputPath = path.join(tempDir, `agmi-input-${Date.now()}.raw`);
        const outputPath = path.join(tempDir, `agmi-output-${Date.now()}.${format}`);

        // Write input data
        fs.writeFileSync(inputPath, req.body);

        // Configure output settings based on format
        const outputOptions = {
            mp3: ['-codec:a', 'libmp3lame', '-b:a', '192k'],
            ogg: ['-codec:a', 'libvorbis', '-q:a', '5'],
            wav: ['-codec:a', 'pcm_s16le'],
        };

        // Convert using ffmpeg
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .inputOptions([
                    '-f', 's16le',           // Raw PCM signed 16-bit little-endian
                    '-ar', String(sampleRate), // Sample rate
                    '-ac', String(channels),   // Channels
                ])
                .outputOptions(outputOptions[format])
                .output(outputPath)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });

        // Read output file
        const outputBuffer = fs.readFileSync(outputPath);

        // Cleanup temp files
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);

        // Set content type
        const contentTypes = {
            mp3: 'audio/mpeg',
            ogg: 'audio/ogg',
            wav: 'audio/wav',
        };

        console.log(`[Audio Convert] Conversion complete: ${outputBuffer.length} bytes`);

        res.set('Content-Type', contentTypes[format]);
        res.set('Content-Length', outputBuffer.length);
        res.send(outputBuffer);

    } catch (error) {
        console.error('[Audio Convert] Error:', error);
        res.status(500).json({ error: 'Audio conversion failed', details: String(error) });
    }
});

// GET /api/audio/formats
// Returns supported output formats
router.get('/formats', (req, res) => {
    res.json({
        formats: [
            { id: 'mp3', name: 'MP3', mimeType: 'audio/mpeg', description: 'Compressed audio, widely compatible' },
            { id: 'wav', name: 'WAV', mimeType: 'audio/wav', description: 'Uncompressed audio, highest quality' },
            { id: 'ogg', name: 'OGG', mimeType: 'audio/ogg', description: 'Open format, good compression' },
        ]
    });
});

export default router;
