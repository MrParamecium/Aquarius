#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const migration = require('./migrate-user-memory');

function writeJson(file, value) {
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

(async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'user-memory-migration-'));
    const usersDir = path.join(root, 'users');
    const backupDir = path.join(root, 'backups');
    fs.mkdirSync(usersDir, { recursive: true });
    fs.mkdirSync(path.join(usersDir, 'sessions'), { recursive: true });

    const legacy = {
        uid: 'user_a',
        teachingInstructions: 'Start with intuition',
        preferenceProfile: { markdown: 'legacy' },
        quiz: { track: 'standard' },
        weakConcepts: ['sign'],
        customField: { keep: true },
    };
    writeJson(path.join(usersDir, 'user_a.json'), legacy);
    writeJson(path.join(usersDir, 'user_b.json'), { uid: 'user_b', teachingInstructions: '' });
    writeJson(path.join(usersDir, 'sessions', 'session.json'), { quiz: { mustStay: true } });

    try {
        assert.throws(() => migration.parseArgs([]), /exactly one/);
        assert.throws(() => migration.parseArgs(['--dry-run', '--apply']), /exactly one/);
        assert.throws(() => migration.parseArgs(['--apply']), /backup-dir/);

        const records = migration.listLocalMemoryRecords(usersDir);
        assert.strictEqual(records.length, 2);
        const preview = migration.summarizeRecords(records);
        assert.strictEqual(preview.changed, 1);
        assert.strictEqual(preview.byField.quiz, 1);
        assert.strictEqual(preview.byField.preferenceProfile, 1);

        const beforeDryRun = fs.readFileSync(path.join(usersDir, 'user_a.json'), 'utf8');
        assert.strictEqual(fs.readFileSync(path.join(usersDir, 'user_a.json'), 'utf8'), beforeDryRun);

        const resolvedBackup = migration.ensureExternalBackupDir(backupDir);
        migration.writeLocalBackups(records, resolvedBackup);
        assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(resolvedBackup, 'local-users', 'user_a.json'), 'utf8')), legacy);
        assert.strictEqual(migration.applyLocalMigration(records), 1);

        const migrated = JSON.parse(fs.readFileSync(path.join(usersDir, 'user_a.json'), 'utf8'));
        assert.strictEqual(migrated.teachingInstructions, 'Start with intuition');
        assert.deepStrictEqual(migrated.customField, { keep: true });
        for (const field of migration.LEGACY_FIELDS) assert(!Object.prototype.hasOwnProperty.call(migrated, field));
        assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(usersDir, 'sessions', 'session.json'), 'utf8')), { quiz: { mustStay: true } });

        const second = migration.listLocalMemoryRecords(usersDir);
        assert.strictEqual(migration.summarizeRecords(second).changed, 0);
        assert.strictEqual(migration.applyLocalMigration(second), 0);

        const neonRows = [{
            uid: 'user_neon',
            data: { teachingInstructions: 'Use diagrams', quiz: { track: 'cram' }, inferredStyle: ['visual'] },
            updated_at: new Date('2026-07-31T00:00:00.000Z'),
        }];
        const neonQueries = [];
        let released = false;
        const client = {
            async query(sql, params = []) {
                neonQueries.push(sql);
                if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [], rowCount: null };
                if (sql.includes('FOR UPDATE')) return { rows: neonRows.map(row => ({ ...row, data: { ...row.data } })) };
                if (sql.startsWith('UPDATE user_memory')) {
                    const row = neonRows.find(item => item.uid === params[0]);
                    row.data = JSON.parse(params[1]);
                    return { rows: [{ data: row.data }], rowCount: 1 };
                }
                if (sql === 'SELECT uid, data FROM user_memory ORDER BY uid') {
                    return { rows: neonRows.map(row => ({ uid: row.uid, data: row.data })) };
                }
                throw new Error(`unexpected query: ${sql}`);
            },
            release() { released = true; },
        };
        const neonBackupDir = path.join(root, 'neon-backup');
        fs.mkdirSync(neonBackupDir);
        const neonResult = await migration.applyNeonMigration({ connect: async () => client }, neonBackupDir);
        assert.deepStrictEqual(neonResult, { total: 1, changed: 1 });
        assert.strictEqual(neonRows[0].data.teachingInstructions, 'Use diagrams');
        assert(!Object.prototype.hasOwnProperty.call(neonRows[0].data, 'quiz'));
        assert(!Object.prototype.hasOwnProperty.call(neonRows[0].data, 'inferredStyle'));
        assert(neonQueries.includes('COMMIT'));
        assert.strictEqual(released, true);
        const backupLine = fs.readFileSync(path.join(neonBackupDir, 'neon-user-memory.ndjson'), 'utf8').trim();
        assert.deepStrictEqual(JSON.parse(backupLine).data.quiz, { track: 'cram' });

        const failureQueries = [];
        const failureClient = {
            async query(sql) {
                failureQueries.push(sql);
                if (sql.includes('FOR UPDATE')) {
                    return { rows: [{ uid: 'user_failure', data: { weakConcepts: ['x'] }, updated_at: new Date() }] };
                }
                if (sql.startsWith('UPDATE user_memory')) return { rows: [], rowCount: 0 };
                return { rows: [], rowCount: null };
            },
            release() {},
        };
        const failureBackupDir = path.join(root, 'neon-failure-backup');
        fs.mkdirSync(failureBackupDir);
        await assert.rejects(
            migration.applyNeonMigration({ connect: async () => failureClient }, failureBackupDir),
            /Unexpected Neon update count/
        );
        assert(failureQueries.includes('ROLLBACK'));
        console.log('[user-memory-migration] PASS');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
})().catch((error) => {
    console.error('[user-memory-migration] FAIL', error);
    process.exit(1);
});
