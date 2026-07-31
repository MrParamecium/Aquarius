#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const LEGACY_FIELDS = [
    'quiz',
    'quizResetAt',
    'preferenceProfile',
    'inferredStyle',
    'knownConcepts',
    'weakConcepts',
    'sessionSummaries',
];

function parseArgs(argv) {
    const options = { dryRun: false, apply: false, backupDir: '', usersDir: '' };
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--dry-run') options.dryRun = true;
        else if (arg === '--apply') options.apply = true;
        else if (arg === '--backup-dir') options.backupDir = argv[++index] || '';
        else if (arg === '--users-dir') options.usersDir = argv[++index] || '';
        else throw new Error(`Unknown argument: ${arg}`);
    }
    if (options.dryRun === options.apply) {
        throw new Error('Specify exactly one of --dry-run or --apply');
    }
    if (options.apply && !options.backupDir) {
        throw new Error('--apply requires an explicit --backup-dir');
    }
    return options;
}

function stripLegacyFields(memory) {
    const cleaned = memory && typeof memory === 'object' && !Array.isArray(memory)
        ? { ...memory }
        : {};
    const removed = [];
    for (const field of LEGACY_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(cleaned, field)) continue;
        delete cleaned[field];
        removed.push(field);
    }
    return { cleaned, removed };
}

function listLocalMemoryRecords(usersDir) {
    if (!fs.existsSync(usersDir)) return [];
    return fs.readdirSync(usersDir, { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((entry) => {
            const file = path.join(usersDir, entry.name);
            const raw = fs.readFileSync(file, 'utf8');
            let data;
            try {
                data = JSON.parse(raw);
            } catch (error) {
                throw new Error(`Local user memory is not valid JSON: ${file} (${error.message})`);
            }
            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                throw new Error(`Local user memory must be a JSON object: ${file}`);
            }
            const { cleaned, removed } = stripLegacyFields(data);
            return { file, name: entry.name, raw, data, cleaned, removed };
        });
}

function ensureExternalBackupDir(backupDir) {
    const resolved = path.resolve(backupDir);
    const relative = path.relative(REPO_ROOT, resolved);
    if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
        throw new Error(`Backup directory must be outside the Git repository: ${resolved}`);
    }
    fs.mkdirSync(resolved, { recursive: true });
    return resolved;
}

function writeLocalBackups(records, backupDir) {
    const localBackupDir = path.join(backupDir, 'local-users');
    fs.mkdirSync(localBackupDir, { recursive: true });
    for (const record of records) {
        const target = path.join(localBackupDir, record.name);
        fs.writeFileSync(target, record.raw, { encoding: 'utf8', flag: 'wx' });
    }
}

function applyLocalMigration(records) {
    let changed = 0;
    for (const record of records) {
        if (!record.removed.length) continue;
        const temporary = `${record.file}.tmp-${process.pid}-${Date.now()}`;
        try {
            fs.writeFileSync(temporary, `${JSON.stringify(record.cleaned, null, 2)}\n`, 'utf8');
            const verified = JSON.parse(fs.readFileSync(temporary, 'utf8'));
            const remaining = LEGACY_FIELDS.filter(field => Object.prototype.hasOwnProperty.call(verified, field));
            if (remaining.length) throw new Error(`Temporary file still contains legacy fields: ${remaining.join(', ')}`);
            fs.renameSync(temporary, record.file);
            changed += 1;
        } catch (error) {
            try { fs.unlinkSync(temporary); } catch (_) {}
            throw new Error(`Local user memory migration failed: ${record.file} (${error.message})`);
        }
    }
    return changed;
}

function toNdjson(rows) {
    return rows.map(row => JSON.stringify({
        uid: row.uid,
        data: row.data,
        updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    })).join('\n') + (rows.length ? '\n' : '');
}

async function inspectNeon(pool) {
    const result = await pool.query('SELECT uid, data, updated_at FROM user_memory ORDER BY uid');
    return result.rows.map((row) => {
        const { cleaned, removed } = stripLegacyFields(row.data);
        return { ...row, cleaned, removed };
    });
}

async function applyNeonMigration(pool, backupDir) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query('SELECT uid, data, updated_at FROM user_memory ORDER BY uid FOR UPDATE');
        const rows = result.rows.map((row) => {
            const { cleaned, removed } = stripLegacyFields(row.data);
            return { ...row, cleaned, removed };
        });

        fs.writeFileSync(path.join(backupDir, 'neon-user-memory.ndjson'), toNdjson(rows), {
            encoding: 'utf8',
            flag: 'wx',
        });

        let changed = 0;
        for (const row of rows) {
            if (!row.removed.length) continue;
            const update = await client.query(
                'UPDATE user_memory SET data = $2::jsonb, updated_at = now() WHERE uid = $1 RETURNING data',
                [row.uid, JSON.stringify(row.cleaned)]
            );
            if (update.rowCount !== 1) throw new Error(`Unexpected Neon update count: ${row.uid}`);
            const remaining = LEGACY_FIELDS.filter(field => (
                Object.prototype.hasOwnProperty.call(update.rows[0].data || {}, field)
            ));
            if (remaining.length) throw new Error(`Neon row still contains legacy fields: ${row.uid} / ${remaining.join(', ')}`);
            changed += 1;
        }

        const verification = await client.query('SELECT uid, data FROM user_memory ORDER BY uid');
        for (const row of verification.rows) {
            const remaining = LEGACY_FIELDS.filter(field => (
                Object.prototype.hasOwnProperty.call(row.data || {}, field)
            ));
            if (remaining.length) throw new Error(`Neon pre-commit verification failed: ${row.uid} / ${remaining.join(', ')}`);
        }
        await client.query('COMMIT');
        return { total: rows.length, changed };
    } catch (error) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        throw error;
    } finally {
        client.release();
    }
}

function loadLocalEnvFile() {
    const envPath = path.join(REPO_ROOT, 'app', '.env');
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const separator = trimmed.indexOf('=');
        if (separator < 1) continue;
        const key = trimmed.slice(0, separator).trim();
        if (process.env[key]) continue;
        let value = trimmed.slice(separator + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        process.env[key] = value;
    }
}

function summarizeRecords(records) {
    const byField = Object.fromEntries(LEGACY_FIELDS.map(field => [field, 0]));
    let changed = 0;
    for (const record of records) {
        if (record.removed.length) changed += 1;
        for (const field of record.removed) byField[field] += 1;
    }
    return { total: records.length, changed, byField };
}

async function main(argv = process.argv.slice(2)) {
    const options = parseArgs(argv);
    loadLocalEnvFile();
    const usersDir = path.resolve(options.usersDir || process.env.TUTOR_USERS_DIR || path.join(REPO_ROOT, 'app', 'users'));
    const localRecords = listLocalMemoryRecords(usersDir);
    const localSummary = summarizeRecords(localRecords);
    const databaseUrl = String(process.env.DATABASE_URL || '').trim();
    let pool = null;
    let neonRecords = [];

    try {
        if (databaseUrl) {
            const { Pool } = require('pg');
            pool = new Pool({ connectionString: databaseUrl, max: 1 });
            if (options.dryRun) neonRecords = await inspectNeon(pool);
        }

        if (options.dryRun) {
            const neonSummary = summarizeRecords(neonRecords);
            console.log(JSON.stringify({
                mode: 'dry-run',
                local: { usersDir, ...localSummary },
                neon: databaseUrl ? neonSummary : { configured: false, total: 0, changed: 0 },
            }, null, 2));
            return;
        }

        const backupRoot = ensureExternalBackupDir(options.backupDir);
        const runDir = path.join(backupRoot, `user-memory-${new Date().toISOString().replace(/[:.]/g, '-')}`);
        fs.mkdirSync(runDir, { recursive: false });
        writeLocalBackups(localRecords, runDir);
        const localChanged = applyLocalMigration(localRecords);
        const neonResult = pool
            ? await applyNeonMigration(pool, runDir)
            : { configured: false, total: 0, changed: 0 };
        fs.writeFileSync(path.join(runDir, 'migration-report.json'), `${JSON.stringify({
            mode: 'apply',
            local: { usersDir, total: localRecords.length, changed: localChanged },
            neon: neonResult,
            legacyFields: LEGACY_FIELDS,
        }, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
        console.log(JSON.stringify({ ok: true, backupDir: runDir, localChanged, neon: neonResult }, null, 2));
    } finally {
        if (pool) await pool.end();
    }
}

module.exports = {
    LEGACY_FIELDS,
    parseArgs,
    stripLegacyFields,
    listLocalMemoryRecords,
    ensureExternalBackupDir,
    writeLocalBackups,
    applyLocalMigration,
    inspectNeon,
    applyNeonMigration,
    summarizeRecords,
    main,
};

if (require.main === module) {
    main().catch((error) => {
        console.error(`[user-memory-migration] ${error.message}`);
        process.exit(1);
    });
}
