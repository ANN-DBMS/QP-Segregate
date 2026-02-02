"""
Add content_type to question_papers: "question_paper" (questions only) or "answer_scheme" (questions with answers).
Run from backend: python migrations/add_content_type_to_question_papers.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import engine
from sqlalchemy import text

def run():
    with engine.connect() as conn:
        try:
            conn.execute(text(
                "ALTER TABLE question_papers ADD COLUMN IF NOT EXISTS content_type VARCHAR(20) NOT NULL DEFAULT 'question_paper'"
            ))
            conn.commit()
            print("[OK] Added content_type to question_papers")
        except Exception as e:
            conn.rollback()
            if "already exists" in str(e).lower():
                print("[SKIP] content_type already exists")
            else:
                raise

if __name__ == "__main__":
    run()
