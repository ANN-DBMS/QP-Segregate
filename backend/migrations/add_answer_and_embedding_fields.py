"""
Migration script to add answer fields, embedding support, and answer_assets table
Run this script to update the database schema

Usage:
    cd backend
    python migrations/add_answer_and_embedding_fields.py
"""
import sys
import os

# Add parent directory to path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import engine
from sqlalchemy import text

def _run_step(conn, step_name, sql, ok_msg, skip_msg=None, warn_only=False):
    """Run one migration step; commit on success, rollback on error."""
    try:
        if isinstance(sql, str):
            conn.execute(text(sql))
        else:
            for s in sql:
                conn.execute(text(s))
        conn.commit()
        print(ok_msg)
        return True
    except Exception as e:
        conn.rollback()
        err_lower = str(e).lower()
        if skip_msg and ("already exists" in err_lower or "duplicate" in err_lower):
            print(skip_msg)
            return True
        if warn_only:
            print(f"[WARN] {step_name}: {e}")
            return False
        raise


def add_answer_and_embedding_fields():
    """Add answer fields, embedding support, and answer_assets table"""
    with engine.connect() as conn:
        # Enable pgvector extension if not already enabled
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.commit()
            print("[OK] Enabled pgvector extension")
        except Exception as e:
            conn.rollback()
            if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                print("[SKIP] pgvector extension already exists")
            else:
                print(f"[WARN] Could not enable pgvector extension: {e}")
                print("   Make sure pgvector is installed in your PostgreSQL database")

        # Add answer_text column to questions table
        _run_step(
            conn, "answer_text",
            "ALTER TABLE questions ADD COLUMN answer_text TEXT",
            "[OK] Added answer_text column to questions table",
            skip_msg="[SKIP] answer_text column already exists",
        )

        # Add question_embedding column to questions table (vector type)
        try:
            conn.execute(text("ALTER TABLE questions ADD COLUMN question_embedding vector(384)"))
            conn.commit()
            print("[OK] Added question_embedding column to questions table")
        except Exception as e:
            conn.rollback()
            if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                print("[SKIP] question_embedding column already exists")
            else:
                try:
                    conn.execute(text("ALTER TABLE questions ADD COLUMN question_embedding vector"))
                    conn.commit()
                    print("[OK] Added question_embedding column (without dimension)")
                except Exception as e2:
                    conn.rollback()
                    print(f"[WARN] Could not add question_embedding column: {e2}")
                    print("   This may require manual pgvector installation")

        # Create index on question_embedding for similarity search (only if column exists)
        try:
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_questions_embedding
                ON questions USING ivfflat (question_embedding vector_cosine_ops)
                WITH (lists = 100)
            """))
            conn.commit()
            print("[OK] Created index on question_embedding")
        except Exception as e:
            conn.rollback()
            print(f"[WARN] Could not create index on question_embedding: {e}")
            print("   You may need to create this index manually after adding data")

        # Add answer_key_path column to question_papers table
        _run_step(
            conn, "answer_key_path",
            "ALTER TABLE question_papers ADD COLUMN answer_key_path VARCHAR(500)",
            "[OK] Added answer_key_path column to question_papers table",
            skip_msg="[SKIP] answer_key_path column already exists",
        )

        # Create answer_assets table
        _run_step(
            conn, "answer_assets",
            """
            CREATE TABLE IF NOT EXISTS answer_assets (
                answer_asset_id SERIAL PRIMARY KEY,
                question_id INTEGER NOT NULL REFERENCES questions(question_id) ON DELETE CASCADE,
                file_path VARCHAR(500) NOT NULL,
                caption TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
            """,
            "[OK] Created answer_assets table",
            skip_msg="[SKIP] answer_assets table already exists",
        )

        # Create index on answer_assets.question_id
        try:
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_answer_assets_question_id
                ON answer_assets(question_id)
            """))
            conn.commit()
            print("[OK] Created index on answer_assets.question_id")
        except Exception as e:
            conn.rollback()
            if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                print("[SKIP] Index on answer_assets.question_id already exists")
            else:
                print(f"[WARN] Could not create index: {e}")

        print("\n[OK] Migration completed successfully!")

if __name__ == "__main__":
    add_answer_and_embedding_fields()

