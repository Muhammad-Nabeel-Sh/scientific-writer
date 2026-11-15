#!/usr/bin/env python3
"""Build the normalized FTS5 index used by the Arabic dictionary search.

The app packages `src-tauri/db/dicts.sqlite` (git-ignored, ~165 MB). This
one-time script adds `word_norm`/`root_norm` columns and an external-content
FTS5 table per dictionary. It is idempotent: re-running drops and rebuilds the
indexes. The app still works without it via the LIKE fallback, just slower.

Usage (from the repository root):
    python scripts/build-dict-fts.py
    python scripts/build-dict-fts.py --db path/to/dicts.sqlite --bench
"""
from __future__ import annotations

import argparse
import re
import sqlite3
import time
from pathlib import Path

DICTS = [
    # (table, has a root column)
    ("lisanularab", False),
    ("mujamul_wasith", False),
    ("mujamul_shihah", False),
    ("maqayeesul_luga", False),
    ("mufradat_alfajul_quran", False),
    ("mujamul_ghoni", True),
    ("mujamul_muashiroh", False),
    ("mujamul_muhith", False),
    ("hanswehr", False),
    ("lanelexcon", False),
]

MARKS = re.compile("[\u064B-\u065F\u0670\u0640\u06D6-\u06ED]")
ALEF = re.compile("[إأآٱا]")


def normalize(value: str) -> str:
    """Must match normalize_arabic() in src-tauri/src/lib.rs."""
    value = MARKS.sub("", value or "")
    value = ALEF.sub("ا", value)
    value = value.replace("ى", "ي").replace("ة", "ه").replace("ئ", "ي").replace("ؤ", "و")
    return " ".join(value.lower().split())


def columns(conn: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in conn.execute(f'PRAGMA table_info("{table}")')}


def ensure_column(conn: sqlite3.Connection, table: str, name: str) -> None:
    if name not in columns(conn, table):
        conn.execute(f'ALTER TABLE "{table}" ADD COLUMN "{name}" TEXT')
        print(f"  + {table}.{name}")


def build_table(conn: sqlite3.Connection, table: str, has_root: bool) -> None:
    if not conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)
    ).fetchone():
        print(f"  ! {table} is missing; skipped")
        return

    ensure_column(conn, table, "word_norm")
    ensure_column(conn, table, "root_norm")

    source = f'id, word, root' if has_root else 'id, word, NULL'
    update = f'UPDATE "{table}" SET word_norm=?, root_norm=? WHERE id=?'
    count = 0
    batch: list[tuple[str, str | None, int]] = []
    for row_id, word, root in conn.execute(f'SELECT {source} FROM "{table}"'):
        batch.append((normalize(word), normalize(root) if root is not None else None, row_id))
        if len(batch) >= 2000:
            conn.executemany(update, batch)
            count += len(batch)
            batch.clear()
    if batch:
        conn.executemany(update, batch)
        count += len(batch)

    conn.execute(f'DROP TABLE IF EXISTS "{table}_fts"')
    conn.execute(
        f'CREATE VIRTUAL TABLE "{table}_fts" USING fts5('
        f'word_norm, root_norm, content="{table}", content_rowid="id")'
    )
    conn.execute(
        f"INSERT INTO \"{table}_fts\"(\"{table}_fts\") VALUES('rebuild')"
    )
    print(f"  {table}: {count} rows indexed")


def benchmark(conn: sqlite3.Connection, iterations: int = 20) -> None:
    """Search latency on a few typical queries (warm page cache)."""
    checks = [
        ("lisanularab", "word_norm", "علم"),
        ("mujamul_ghoni", "root_norm", "علم"),
        ("mujamul_wasith", "word_norm", "كتاب"),
        ("hanswehr", "word_norm", "كتب"),
    ]
    for table, column, query in checks:
        sql = (
            f'SELECT d.word FROM "{table}" d JOIN "{table}_fts" f ON f.rowid = d.id '
            f'WHERE f."{column}" MATCH ? LIMIT 30'
        )
        try:
            conn.execute(sql, (f'"{query}"*',)).fetchall()  # warm
        except sqlite3.OperationalError:
            print(f"  ! no index for {table}; run the build first")
            continue
        start = time.perf_counter()
        for _ in range(iterations):
            rows = conn.execute(sql, (f'"{query}"*',)).fetchall()
        elapsed = (time.perf_counter() - start) * 1000 / iterations
        print(f"  {table:24} {elapsed:6.2f} ms  ({len(rows)} hits for {query})")


def main() -> int:
    ap = argparse.ArgumentParser(description="Build dictionary FTS5 indexes")
    ap.add_argument(
        "--db",
        default="src-tauri/db/dicts.sqlite",
        help="path to dicts.sqlite (default: src-tauri/db/dicts.sqlite)",
    )
    ap.add_argument("--bench", action="store_true", help="benchmark after building")
    args = ap.parse_args()

    db = Path(args.db)
    if not db.exists():
        print(f"database not found: {db}")
        return 1

    started = time.perf_counter()
    print(f"Building FTS5 indexes in {db} …")
    conn = sqlite3.connect(db)
    try:
        with conn:
            for table, has_root in DICTS:
                build_table(conn, table, has_root)
            conn.execute("ANALYZE")
    finally:
        conn.close()
    print(f"Done in {time.perf_counter() - started:.1f}s")

    if args.bench:
        conn = sqlite3.connect(db)
        try:
            print("Benchmark:")
            benchmark(conn)
        finally:
            conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
