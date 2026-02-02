import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'agmi-studio.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create projects table
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source_lang TEXT NOT NULL,
    target_langs TEXT NOT NULL,
    status TEXT DEFAULT 'DRAFT',
    progress INTEGER DEFAULT 0,
    assets TEXT DEFAULT '[]',
    terms TEXT DEFAULT '[]',
    translations TEXT DEFAULT '{}',
    last_modified TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

export default db;
