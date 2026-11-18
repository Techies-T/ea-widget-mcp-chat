const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'mcp_chat.db');
const db = new sqlite3.Database(DB_PATH);

function initDb() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS mcp_tasks (
                id TEXT PRIMARY KEY,
                user_id INTEGER,
                server_id TEXT,
                prompt TEXT,
                status TEXT NOT NULL,
                progress_message TEXT,
                current_turn INTEGER DEFAULT 0,
                result TEXT,
                error TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });
}

module.exports = {
    db,
    initDb,
    DB_PATH
};
