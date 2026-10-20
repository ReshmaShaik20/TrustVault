from sqlalchemy import create_engine, inspect, text
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not configured")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

CONSTRAINT_NAME = "audit_events_document_id_fkey"


def main():
    inspector = inspect(engine)
    print("Connected database:", engine.url.database)
    print("Available tables:", inspector.get_table_names())
    with engine.begin() as connection:
        constraint = connection.execute(
            text(
                """
                SELECT conname
                FROM pg_constraint
                WHERE conrelid = 'audit_events'::regclass
                  AND conname = :constraint_name
                  AND contype = 'f'
                """
            ),
            {"constraint_name": CONSTRAINT_NAME},
        ).scalar_one_or_none()

        if constraint is None:
            print("Migration already applied; nothing to change.")
            return

        connection.execute(
            text(
                """
                ALTER TABLE audit_events
                DROP CONSTRAINT audit_events_document_id_fkey
                """
            )
        )

    print("Migration complete: audit document IDs are preserved.")


if __name__ == "__main__":
    try:
        main()
    finally:
        engine.dispose()
