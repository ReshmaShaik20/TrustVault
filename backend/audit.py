
import hashlib
import json
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

import models


def canonical_json(data: dict) -> str:
    """Create a consistent JSON representation for hashing."""
    return json.dumps(
        data,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )


def log_audit_event(
    db: Session,
    actor_id: int | None,
    action: str,
    outcome: str,
    document_id: int | None = None,
    details: dict | None = None,
) -> models.AuditEvent:
    """
    Add one event to the audit hash chain.
    Call within the same transaction as the action being recorded.
    """

    # PostgreSQL transaction-level lock serializes audit-chain writers.
    db.execute(
        text("SELECT pg_advisory_xact_lock(:lock_id)"),
        {"lock_id": 73421001},
    )

    previous = (
        db.query(models.AuditEvent)
        .order_by(models.AuditEvent.id.desc())
        .first()
    )

    previous_hash = previous.event_hash if previous else None
    created_at = datetime.now(timezone.utc)
    safe_details = details or {}

    event_data = {
        "actor_id": actor_id,
        "document_id": document_id,
        "action": action,
        "outcome": outcome,
        "details": safe_details,
        "created_at": created_at.isoformat(),
        "previous_hash": previous_hash,
    }

    event_hash = hashlib.sha256(
        canonical_json(event_data).encode("utf-8")
    ).hexdigest()

    event = models.AuditEvent(
        actor_id=actor_id,
        document_id=document_id,
        action=action,
        outcome=outcome,
        details=safe_details,
        created_at=created_at,
        previous_hash=previous_hash,
        event_hash=event_hash,
    )

    db.add(event)
    db.flush()

    return event


def verify_audit_chain(db: Session) -> bool:
    """Return False if an event's contents or chain link was changed."""

    events = (
        db.query(models.AuditEvent)
        .order_by(models.AuditEvent.id.asc())
        .all()
    )

    expected_previous_hash = None

    for event in events:
        if event.previous_hash != expected_previous_hash:
            return False

        event_data = {
            "actor_id": event.actor_id,
            "document_id": event.document_id,
            "action": event.action,
            "outcome": event.outcome,
            "details": event.details or {},
            "created_at": event.created_at.astimezone(timezone.utc).isoformat(),
            "previous_hash": event.previous_hash,
        }

        calculated_hash = hashlib.sha256(
            canonical_json(event_data).encode("utf-8")
        ).hexdigest()

        if calculated_hash != event.event_hash:
            return False

        expected_previous_hash = event.event_hash

    return True
