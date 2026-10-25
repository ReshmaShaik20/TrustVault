from database import SessionLocal
from audit import canonical_json
import models
import hashlib
from datetime import timezone


def main():
    with SessionLocal() as db:
        events = (
            db.query(models.AuditEvent)
            .order_by(models.AuditEvent.id.asc())
            .all()
        )

        expected_previous_hash = None

        for event in events:
            if event.previous_hash != expected_previous_hash:
                print(f"BROKEN LINK at event ID {event.id}")
                print(f"Action: {event.action}")
                print(f"Expected previous hash: {expected_previous_hash}")
                print(f"Stored previous hash:   {event.previous_hash}")
                print(f"Stored event hash:      {event.event_hash}")
                return

            event_data = {
                "actor_id": event.actor_id,
                "document_id": event.document_id,
                "action": event.action,
                "outcome": event.outcome,
                "details": event.details or {},
                "created_at": event.created_at.astimezone(
                    timezone.utc
                ).isoformat(),
                "previous_hash": event.previous_hash,
            }

            calculated_hash = hashlib.sha256(
                canonical_json(event_data).encode("utf-8")
            ).hexdigest()

            if calculated_hash != event.event_hash:
                print(f"HASH MISMATCH at event ID {event.id}")
                print(f"Action: {event.action}")
                print(f"Stored hash:     {event.event_hash}")
                print(f"Calculated hash: {calculated_hash}")
                return

            expected_previous_hash = event.event_hash

        print(f"All {len(events)} audit events passed verification.")


if __name__ == "__main__":
    main()