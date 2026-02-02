"""
Add processing_error_message to question_papers for failed processing details.
Run from backend: python migrations/add_processing_error_message.py
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
                "ALTER TABLE question_papers ADD COLUMN IF NOT EXISTS processing_error_message VARCHAR(1000)"
            ))
            conn.commit()
            print("[OK] Added processing_error_message to question_papers")
        except Exception as e:
            conn.rollback()
            if "already exists" in str(e).lower():
                print("[SKIP] processing_error_message already exists")
            else:
                raise

if __name__ == "__main__":
    run()
