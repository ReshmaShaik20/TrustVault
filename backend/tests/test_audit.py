
from audit import log_audit_event, verify_audit_chain
import models


def test_valid_audit_chain_passes(client):
    from database import SessionLocal

    with SessionLocal() as db:
        log_audit_event(
            db,
            actor_id=None,
            action="test_event_one",
            outcome="success",
            details={"message": "first event"},
        )
        log_audit_event(
            db,
            actor_id=None,
            action="test_event_two",
            outcome="success",
            details={"message": "second event"},
        )
        db.commit()

    with SessionLocal() as db:
        assert verify_audit_chain(db) is True


def test_modified_audit_details_are_detected(client):
    from database import SessionLocal

    with SessionLocal() as db:
        event = log_audit_event(
            db,
            actor_id=None,
            action="test_tampering",
            outcome="success",
            details={"message": "original"},
        )
        db.commit()
        event_id = event.id

    with SessionLocal() as db:
        event = db.get(models.AuditEvent, event_id)
        event.details = {"message": "tampered"}
        db.commit()

    with SessionLocal() as db:
        assert verify_audit_chain(db) is False


def test_broken_previous_hash_is_detected(client):
    from database import SessionLocal

    with SessionLocal() as db:
        log_audit_event(
            db,
            actor_id=None,
            action="test_chain_one",
            outcome="success",
            details={"number": 1},
        )
        log_audit_event(
            db,
            actor_id=None,
            action="test_chain_two",
            outcome="success",
            details={"number": 2},
        )
        db.commit()

    with SessionLocal() as db:
        events = (
            db.query(models.AuditEvent)
            .order_by(models.AuditEvent.id.asc())
            .all()
        )
        assert len(events) >= 2

        events[1].previous_hash = "0" * 64
        db.commit()

    with SessionLocal() as db:
        assert verify_audit_chain(db) is False
