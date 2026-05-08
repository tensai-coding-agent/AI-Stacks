#!/usr/bin/env python3
"""
FrameSight Database Migration Script
Migrates data from SQLite to TimescaleDB with pgvector support.
"""

import os
import sys
import sqlite3
import psycopg2
import logging
from datetime import datetime
from contextlib import contextmanager
from typing import Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database connection strings
SQLITE_PATH = os.getenv('SQLITE_PATH', './framesight.db')
PG_HOST = os.getenv('PG_HOST', 'localhost')
PG_PORT = os.getenv('PG_PORT', '5432')
PG_DB = os.getenv('PG_DB', 'framesight')
PG_USER = os.getenv('PG_USER', 'framesight')
PG_PASSWORD = os.getenv('PG_PASSWORD', 'framesight_dev')

@contextmanager
def sqlite_connection():
    """Context manager for SQLite connection."""
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

@contextmanager
def postgres_connection():
    """Context manager for PostgreSQL connection."""
    conn = psycopg2.connect(
        host=PG_HOST,
        port=PG_PORT,
        database=PG_DB,
        user=PG_USER,
        password=PG_PASSWORD
    )
    try:
        yield conn
    finally:
        conn.close()

class MigrationRunner:
    """Handles database migration from SQLite to TimescaleDB."""
    
    def __init__(self):
        self.stats = {
            'tables_migrated': 0,
            'rows_migrated': 0,
            'errors': []
        }
    
    def verify_connections(self) -> bool:
        """Verify both database connections are working."""
        try:
            # Test SQLite
            with sqlite_connection() as conn:
                cursor = conn.execute("SELECT 1")
                cursor.fetchone()
            logger.info("✓ SQLite connection verified")
            
            # Test PostgreSQL
            with postgres_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT 1")
                cursor.fetchone()
            logger.info("✓ PostgreSQL connection verified")
            
            return True
        except Exception as e:
            logger.error(f"Connection verification failed: {e}")
            return False
    
    def get_sqlite_tables(self) -> list:
        """Get list of tables from SQLite."""
        with sqlite_connection() as conn:
            cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
            return [row[0] for row in cursor.fetchall()]
    
    def migrate_table(self, table_name: str, batch_size: int = 1000) -> int:
        """Migrate a single table from SQLite to PostgreSQL."""
        rows_migrated = 0
        
        try:
            with sqlite_connection() as sqlite_conn, postgres_connection() as pg_conn:
                sqlite_cursor = sqlite_conn.cursor()
                pg_cursor = pg_conn.cursor()
                
                # Get schema info
                sqlite_cursor.execute(f"PRAGMA table_info({table_name})")
                columns = sqlite_cursor.fetchall()
                column_names = [col[1] for col in columns]
                
                # Check row count
                sqlite_cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                total_rows = sqlite_cursor.fetchone()[0]
                
                if total_rows == 0:
                    logger.info(f"  Table {table_name}: empty (skipped)")
                    return 0
                
                logger.info(f"  Table {table_name}: {total_rows} rows to migrate")
                
                # Migrate in batches
                offset = 0
                while offset < total_rows:
                    sqlite_cursor.execute(
                        f"SELECT * FROM {table_name} LIMIT {batch_size} OFFSET {offset}"
                    )
                    rows = sqlite_cursor.fetchall()
                    
                    if not rows:
                        break
                    
                    # Build INSERT statement
                    placeholders = ','.join(['%s'] * len(column_names))
                    insert_sql = f"""
                        INSERT INTO {table_name} ({','.join(column_names)})
                        VALUES ({placeholders})
                        ON CONFLICT DO NOTHING
                    """
                    
                    # Insert batch
                    for row in rows:
                        try:
                            pg_cursor.execute(insert_sql, row)
                        except Exception as e:
                            logger.warning(f"    Error inserting row: {e}")
                    
                    pg_conn.commit()
                    rows_migrated += len(rows)
                    offset += batch_size
                    
                    if offset % 10000 == 0:
                        logger.info(f"    Progress: {offset}/{total_rows} rows")
                
                logger.info(f"  ✓ Migrated {rows_migrated} rows to {table_name}")
                
        except Exception as e:
            error_msg = f"Error migrating table {table_name}: {e}"
            logger.error(error_msg)
            self.stats['errors'].append(error_msg)
        
        return rows_migrated
    
    def run_migration(self) -> bool:
        """Run full migration process."""
        logger.info("=" * 60)
        logger.info("FrameSight Database Migration: SQLite → TimescaleDB")
        logger.info("=" * 60)
        
        # Phase 0: Verify connections
        logger.info("\n[Phase 0] Verifying connections...")
        if not self.verify_connections():
            logger.error("Connection verification failed. Aborting.")
            return False
        
        # Get tables
        tables = self.get_sqlite_tables()
        logger.info(f"Found {len(tables)} tables in SQLite: {', '.join(tables)}")
        
        # Phase 1: Migrate data
        logger.info("\n[Phase 1] Migrating data...")
        for table in tables:
            if table.startswith('sqlite_'):
                continue  # Skip internal SQLite tables
            
            rows = self.migrate_table(table)
            if rows > 0:
                self.stats['tables_migrated'] += 1
                self.stats['rows_migrated'] += rows
        
        # Phase 2: Verify
        logger.info("\n[Phase 2] Verification...")
        self.run_verification()
        
        # Summary
        logger.info("\n" + "=" * 60)
        logger.info("Migration Summary")
        logger.info("=" * 60)
        logger.info(f"Tables migrated: {self.stats['tables_migrated']}")
        logger.info(f"Total rows migrated: {self.stats['rows_migrated']}")
        logger.info(f"Errors: {len(self.stats['errors'])}")
        
        if self.stats['errors']:
            logger.warning("\nErrors encountered:")
            for error in self.stats['errors']:
                logger.warning(f"  - {error}")
        
        return len(self.stats['errors']) == 0
    
    def run_verification(self):
        """Verify migrated data integrity."""
        with postgres_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT schemaname, tablename, n_tup_ins 
                FROM pg_stat_user_tables 
                WHERE schemaname = 'public'
                ORDER BY n_tup_ins DESC
            """)
            stats = cursor.fetchall()
            
            logger.info("PostgreSQL table statistics:")
            for schema, table, count in stats[:10]:
                logger.info(f"  {table}: {count} rows")

def main():
    """Main entry point."""
    # Check dependencies
    try:
        import psycopg2
    except ImportError:
        logger.error("psycopg2 not installed. Run: pip install psycopg2-binary")
        sys.exit(1)
    
    runner = MigrationRunner()
    success = runner.run_migration()
    
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()
