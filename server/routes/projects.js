import express from 'express';
import db from '../db/database.js';

const router = express.Router();

// GET /api/projects - List all projects
router.get('/', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
        const projects = rows.map(row => ({
            id: row.id,
            name: row.name,
            sourceLang: row.source_lang,
            targetLangs: JSON.parse(row.target_langs),
            status: row.status,
            progress: row.progress,
            assets: JSON.parse(row.assets),
            terms: JSON.parse(row.terms),
            translations: JSON.parse(row.translations),
            lastModified: row.last_modified,
            createdAt: row.created_at
        }));
        res.json(projects);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// GET /api/projects/:id - Get single project
router.get('/:id', (req, res) => {
    try {
        const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
        if (!row) {
            return res.status(404).json({ error: 'Project not found' });
        }
        const project = {
            id: row.id,
            name: row.name,
            sourceLang: row.source_lang,
            targetLangs: JSON.parse(row.target_langs),
            status: row.status,
            progress: row.progress,
            assets: JSON.parse(row.assets),
            terms: JSON.parse(row.terms),
            translations: JSON.parse(row.translations),
            lastModified: row.last_modified,
            createdAt: row.created_at
        };
        res.json(project);
    } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({ error: 'Failed to fetch project' });
    }
});

// POST /api/projects - Create project
router.post('/', (req, res) => {
    try {
        const { id, name, sourceLang, targetLangs, status, progress, assets, terms, translations, lastModified } = req.body;

        const stmt = db.prepare(`
      INSERT INTO projects (id, name, source_lang, target_langs, status, progress, assets, terms, translations, last_modified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        stmt.run(
            id,
            name,
            sourceLang,
            JSON.stringify(targetLangs || []),
            status || 'DRAFT',
            progress || 0,
            JSON.stringify(assets || []),
            JSON.stringify(terms || []),
            JSON.stringify(translations || {}),
            lastModified || new Date().toISOString()
        );

        res.status(201).json({ id, message: 'Project created' });
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
});

// PUT /api/projects/:id - Update project
router.put('/:id', (req, res) => {
    try {
        const { name, sourceLang, targetLangs, status, progress, assets, terms, translations, lastModified } = req.body;

        const stmt = db.prepare(`
      UPDATE projects 
      SET name = ?, source_lang = ?, target_langs = ?, status = ?, progress = ?, 
          assets = ?, terms = ?, translations = ?, last_modified = ?
      WHERE id = ?
    `);

        const result = stmt.run(
            name,
            sourceLang,
            JSON.stringify(targetLangs || []),
            status || 'DRAFT',
            progress || 0,
            JSON.stringify(assets || []),
            JSON.stringify(terms || []),
            JSON.stringify(translations || {}),
            lastModified || new Date().toISOString(),
            req.params.id
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.json({ message: 'Project updated' });
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ error: 'Failed to update project' });
    }
});

// DELETE /api/projects/:id - Delete project
router.delete('/:id', (req, res) => {
    try {
        const result = db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.json({ message: 'Project deleted' });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

export default router;
