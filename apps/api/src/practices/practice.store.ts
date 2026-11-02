import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Injectable } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import Database from 'better-sqlite3';
import type { Practice, PracticeHistoryResponse, SubmitAttemptResponse, Topic } from '@expression/shared';
import { ApiConfig } from '../config.js';

interface PracticeRow {
  id: string;
  topic_json: string;
  results_json: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class PracticeStore implements OnModuleDestroy {
  private readonly database: Database.Database;

  constructor(config: ApiConfig) {
    mkdirSync(dirname(config.databasePath), { recursive: true });
    this.database = new Database(config.databasePath);
    this.database.exec(`CREATE TABLE IF NOT EXISTS practices (
      id TEXT PRIMARY KEY,
      topic_json TEXT NOT NULL,
      results_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
  }

  find(id: string): Practice | null {
    const row = this.database.prepare('SELECT * FROM practices WHERE id = ?').get(id) as PracticeRow | undefined;
    if (!row) return null;
    return {
      id: row.id, topic: JSON.parse(row.topic_json), results: JSON.parse(row.results_json),
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }

  list(offset: number): PracticeHistoryResponse {
    const rows = this.database.prepare('SELECT * FROM practices ORDER BY updated_at DESC, rowid DESC LIMIT 20 OFFSET ?').all(offset) as PracticeRow[];
    const { total } = this.database.prepare('SELECT COUNT(*) AS total FROM practices').get() as { total: number };
    return {
      total,
      items: rows.map((row) => ({
        id: row.id, topicTitle: (JSON.parse(row.topic_json) as Topic).title,
        attemptCount: (JSON.parse(row.results_json) as SubmitAttemptResponse[]).length,
        createdAt: row.created_at, updatedAt: row.updated_at,
      })),
    };
  }

  save(id: string, topic: Topic, result: SubmitAttemptResponse): void {
    const previous = this.find(id);
    const results = [...(previous?.results ?? []).filter((item) => item.attempt.round !== result.attempt.round), result]
      .sort((a, b) => a.attempt.round - b.attempt.round);
    const now = new Date().toISOString();
    this.database.prepare(`INSERT INTO practices (id, topic_json, results_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET results_json = excluded.results_json, updated_at = excluded.updated_at`)
      .run(id, JSON.stringify(topic), JSON.stringify(results), previous?.createdAt ?? now, now);
  }

  onModuleDestroy() {
    this.database.close();
  }
}
