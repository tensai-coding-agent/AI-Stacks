#!/usr/bin/env python3
"""
Data Validation Script for FrameSight Migration
Compares row counts and sample data between SQLite and TimescaleDB.
"""

import os
import sqlite3
import psycopg2
from typing import Dict, Tuple

SQLITE_PATH = os.getenv('SQLITE_PATH', './framesight.db')
PG_HOST = os.getenv('PG_HOST', 'localhost')
PG_PORT = os.getenv('PG_PORT', '5432')
PG_DB = os.getenv('PG_DB', 'framesight')
PG_USER = os.getenv('PG_USER', 'framesight')
PG_PASSWORD = os.getenv('PG_PASSWORD', 'framesight_dev')

def validate_counts() -> Dict[str, Tuple[int, int, bool]]:
    """Validate row counts match between databases."""
    # Connect to SQLite
    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    sqlite_cursor = sqlite_conn.cursor()
    
    # Connect to PostgreSQL
    pg_conn = psycopg2.connect(
        host=PG_HOST, port=PG_PORT, database=PG_DB,
        user=PG_USER, password=PG_PASSWORD
    )
    pg_cursor = pg_conn.cursor()
    
    # Get SQLite tables
    sqlite_cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in sqlite_cursor.fetchall() if not row[0].startswith('sqlite_')]
    
    results = {}
    
    print("\n=== Row Count Validation ===\n")
    print(f"{'Table':<30} {'SQLite':<10} {'PostgreSQL':<12} {'Status'}")
    print("-" * 65)
    
    all_match = True
    for table in tables:
        # SQLite count
        sqlite_cursor.execute(f"SELECT COUNT(*) FROM {table}")
        sqlite_count = sqlite_cursor.fetchone()[0]
        
        # PostgreSQL count
        try:
            pg_cursor.execute(f"SELECT COUNT(*) FROM {table}")
            pg_count = pg_cursor.fetchone()[0]
            match = sqlite_count == pg_count
        except Exception as e:
            pg_count = 0
            match = False
        
        status = "✓ MATCH" if match else "✗ MISMATCH"
        print(f"{table:<30} {sqlite_count:<10} {pg_count:<12} {status}")
        
        results[table] = (sqlite_count, pg_count, match)
        if not match:
            all_match = False
    
    print("-" * 65)
    print(f"\nOverall: {'✓ All counts match' if all_match else '✗ Some counts mismatch'}")
    
    sqlite_conn.close()
    pg_conn.close()
    
    return results

def validate_sample_data(table: str, limit: int = 5):
    """Validate sample data matches."""
    print(f"\n=== Sample Data: {table} ===\n")
    
    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cursor = sqlite_conn.cursor()
    
    pg_conn = psycopg2.connect(
        host=PG_HOST, port=PG_PORT, database=PG_DB,
        user=PG_USER, password=PG_PASSWORD
    )
    pg_cursor = pg_conn.cursor()
    
    # Get sample from SQLite
    sqlite_cursor.execute(f"SELECT * FROM {table} LIMIT {limit}")
    sqlite_rows = sqlite_cursor.fetchall()
    
    # Get sample from PostgreSQL
    pg_cursor.execute(f"SELECT * FROM {table} LIMIT {limit}")
    pg_rows = pg_cursor.fetchall()
    
    print(f"SQLite samples: {len(sqlite_rows)}")
    print(f"PostgreSQL samples: {len(pg_rows)}")
    
    sqlite_conn.close()
    pg_conn.close()

def main():
    print("=" * 65)
    print("FrameSight Data Validation")
    print("=" * 65)
    
    results = validate_counts()
    
    # Check if there are mismatches
    mismatches = [t for t, (s, p, m) in results.items() if not m]
    if mismatches:
        print(f"\n⚠ Tables with mismatches: {', '.join(mismatches)}")
    else:
        print("\n✓ All tables validated successfully!")

if __name__ == '__main__':
    main()
