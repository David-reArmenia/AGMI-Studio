import { Project } from '../types';

const API_BASE_URL = 'http://localhost:3001/api';

// Fetch all projects
export async function fetchProjects(): Promise<Project[]> {
    const response = await fetch(`${API_BASE_URL}/projects`);
    if (!response.ok) {
        throw new Error('Failed to fetch projects');
    }
    return response.json();
}

// Fetch single project
export async function fetchProject(id: string): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/projects/${id}`);
    if (!response.ok) {
        throw new Error('Failed to fetch project');
    }
    return response.json();
}

// Create new project
export async function createProject(project: Project): Promise<{ id: string }> {
    const response = await fetch(`${API_BASE_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
    });
    if (!response.ok) {
        throw new Error('Failed to create project');
    }
    return response.json();
}

// Update existing project
export async function updateProject(id: string, project: Partial<Project>): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
    });
    if (!response.ok) {
        throw new Error('Failed to update project');
    }
}

// Delete project
export async function deleteProject(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        throw new Error('Failed to delete project');
    }
}

// Health check
export async function checkApiHealth(): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        return response.ok;
    } catch {
        return false;
    }
}

// Convert audio from raw PCM to specified format
export async function convertAudio(
    pcmData: Uint8Array,
    format: 'mp3' | 'wav' | 'ogg',
    sampleRate: number = 24000,
    channels: number = 1
): Promise<Blob> {
    const response = await fetch(
        `${API_BASE_URL}/audio/convert?format=${format}&sampleRate=${sampleRate}&channels=${channels}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: pcmData.buffer.slice(pcmData.byteOffset, pcmData.byteOffset + pcmData.byteLength) as ArrayBuffer,
        }
    );

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Conversion failed' }));
        throw new Error(error.error || 'Audio conversion failed');
    }

    return response.blob();
}

// Get supported audio formats
export async function getAudioFormats(): Promise<{ formats: Array<{ id: string; name: string; mimeType: string }> }> {
    const response = await fetch(`${API_BASE_URL}/audio/formats`);
    if (!response.ok) {
        throw new Error('Failed to fetch audio formats');
    }
    return response.json();
}
