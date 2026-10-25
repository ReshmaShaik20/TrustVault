from fastapi.testclient import TestClient
from main import app



def register_user(client, username, password):
    return client.post(
        "/auth/register",
        json={"username": username,
              "email": f"{username}@example.com",
              "password": password},
    )


def login_user(client, username, password):
    return client.post(
        "/auth/login",
        data={"username": username, "password": password},
    )


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_documents_require_authentication(client):
    response = client.get("/documents")
    assert response.status_code == 401


def test_user_can_register(client):
    response = register_user(
        client, "alice_test", "AliceSecurePass123!"
    )

    assert response.status_code == 201
    assert response.json()["username"] == "alice_test"
    assert response.json()["role"] == "user"


def test_duplicate_username_is_rejected(client):
    password = "AliceSecurePass123!"

    register_user(client, "alice_test", password)
    response = register_user(client, "alice_test", password)

    assert response.status_code == 409


def test_user_can_login(client):
    password = "AliceSecurePass123!"

    register_user(client, "alice_test", password)
    response = login_user(client, "alice_test", password)

    assert response.status_code == 200
    assert response.json()["token_type"] == "bearer"
    assert response.json()["access_token"]


def test_wrong_password_is_rejected(client):
    register_user(
        client, "alice_test", "AliceSecurePass123!"
    )

    response = login_user(
        client, "alice_test", "WrongPassword123!"
    )

    assert response.status_code == 401

def get_auth_headers(client, username, password):
    response = login_user(client, username, password)
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def get_user_id_for_test(db, username):
    import models

    user = (
        db.query(models.User)
        .filter(models.User.username == username)
        .first()
    )
    assert user is not None
    return user.id


def test_user_cannot_download_another_users_document(client, tmp_path):
    from pathlib import Path

    from main import app
    from storage import STORAGE_DIR

    alice_password = "AliceSecurePass123!"
    charlie_password = "CharlieSecurePass123!"

    register_user(client, "alice_test", alice_password)
    register_user(client, "charlie_test", charlie_password)

    alice_headers = get_auth_headers(
        client, "alice_test", alice_password
    )
    charlie_headers = get_auth_headers(
        client, "charlie_test", charlie_password
    )

    upload = client.post(
        "/documents/upload",
        headers=alice_headers,
        files={"file": ("private.txt", b"secret test content", "text/plain")},
        data={"category": "Test"},
    )
    assert upload.status_code == 201
    document_id = upload.json()["id"]

    response = client.get(
        f"/documents/{document_id}/download",
        headers=charlie_headers,
    )
    assert response.status_code == 403
     # Verify that the denied download was recorded.
    from database import SessionLocal
    import models

    with SessionLocal() as db:
        denied_event = (
            db.query(models.AuditEvent)
            .filter(
                models.AuditEvent.action == "document_download",
                models.AuditEvent.outcome == "denied",
                models.AuditEvent.actor_id== get_user_id_for_test(db, "charlie_test"),
            )
            .order_by(models.AuditEvent.id.desc())
            .first()
        )

        assert denied_event is not None


def upload_test_document(client, headers):
    response = client.post(
        "/documents/upload",
        headers=headers,
        files={
            "file": (
                "private.txt",
                b"TrustVault automated test content",
                "text/plain",
            )
        },
        data={"category": "Test"},
    )
    assert response.status_code == 201
    return response.json()["id"]


def share_document(client, headers, document_id, username, permission="read"):
    return client.post(
        f"/documents/{document_id}/share",
        headers=headers,
        json={
            "username": username,
            "permission": permission,
        },
    )

def test_shared_user_can_download_document(client):
    alice_password = "AliceSecurePass123!"
    bob_password = "BobSecurePass123!"

    register_user(client, "alice_test", alice_password)
    register_user(client, "bob_test", bob_password)

    alice_headers = get_auth_headers(
        client, "alice_test", alice_password
    )
    bob_headers = get_auth_headers(
        client, "bob_test", bob_password
    )

    document_id = upload_test_document(client, alice_headers)

    share_response = share_document(
        client, alice_headers, document_id, "bob_test", "read"
    )
    assert share_response.status_code == 200

    download_response = client.get(
        f"/documents/{document_id}/download",
        headers=bob_headers,
    )
    assert download_response.status_code == 200
    assert download_response.content == b"TrustVault automated test content"

def test_revoked_user_cannot_download_document(client):
    alice_password = "AliceSecurePass123!"
    bob_password = "BobSecurePass123!"

    register_user(client, "alice_test", alice_password)
    register_user(client, "bob_test", bob_password)

    alice_headers = get_auth_headers(
        client, "alice_test", alice_password
    )
    bob_headers = get_auth_headers(
        client, "bob_test", bob_password
    )

    document_id = upload_test_document(client, alice_headers)

    share_response = share_document(
        client, alice_headers, document_id, "bob_test", "read"
    )
    assert share_response.status_code == 200

    # Bob can download before revocation.
    before_revoke = client.get(
        f"/documents/{document_id}/download",
        headers=bob_headers,
    )
    assert before_revoke.status_code == 200

    # Alice revokes Bob's access.
    revoke_response = client.delete(
        f"/documents/{document_id}/share/bob_test",
        headers=alice_headers,
    )
    assert revoke_response.status_code == 200
    assert revoke_response.json()["revoked"] is True

    # Bob must immediately lose access.
    after_revoke = client.get(
        f"/documents/{document_id}/download",
        headers=bob_headers,
    )
    assert after_revoke.status_code == 403

def test_viewer_cannot_share_another_users_document(client):
    from database import SessionLocal
    import models
    from audit import verify_audit_chain

    alice_password = "AliceSecurePass123!"
    bob_password = "BobSecurePass123!"
    charlie_password = "CharlieSecurePass123!"

    register_user(client, "alice_test", alice_password)
    register_user(client, "bob_test", bob_password)
    register_user(client, "charlie_test", charlie_password)

    alice_headers = get_auth_headers(
        client, "alice_test", alice_password
    )
    bob_headers = get_auth_headers(
        client, "bob_test", bob_password
    )

    document_id = upload_test_document(client, alice_headers)

    share_response = share_document(
        client, alice_headers, document_id, "bob_test", "read"
    )
    assert share_response.status_code in (200, 201)

    # Bob can read the shared document, but cannot share it with Charlie.
    response = share_document(
        client, bob_headers, document_id, "charlie_test", "read"
    )
    assert response.status_code == 403

    # Verify that the denied sharing attempt was audited.
    db = SessionLocal()
    try:
        bob_id = get_user_id_for_test(db, "bob_test")

        event = (
            db.query(models.AuditEvent)
            .filter(
                models.AuditEvent.actor_id == bob_id,
                models.AuditEvent.document_id == document_id,
                models.AuditEvent.action == "document_share",
                models.AuditEvent.outcome == "denied",
            )
            .order_by(models.AuditEvent.id.desc())
            .first()
        )

        assert event is not None
        assert event.details["reason"] == "not_document_owner"
        assert verify_audit_chain(db) is True
    finally:
        db.close()
def test_viewer_cannot_revoke_another_users_permission(client):
    from database import SessionLocal
    import models
    from audit import verify_audit_chain

    alice_password = "AliceSecurePass123!"
    bob_password = "BobSecurePass123!"
    charlie_password = "CharlieSecurePass123!"

    register_user(client, "alice_test", alice_password)
    register_user(client, "bob_test", bob_password)
    register_user(client, "charlie_test", charlie_password)

    alice_headers = get_auth_headers(
        client, "alice_test", alice_password
    )
    bob_headers = get_auth_headers(
        client, "bob_test", bob_password
    )

    document_id = upload_test_document(client, alice_headers)

    share_response = share_document(
        client, alice_headers, document_id, "bob_test", "read"
    )
    assert share_response.status_code in (200, 201)

    # Bob cannot revoke access to Alice's document.
    response = client.delete(
        f"/documents/{document_id}/share/bob_test",
        headers=bob_headers,
    )
    assert response.status_code == 403

    # Verify the denied revocation was audited.
    db = SessionLocal()
    try:
        bob_id = get_user_id_for_test(db, "bob_test")

        event = (
            db.query(models.AuditEvent)
            .filter(
                models.AuditEvent.actor_id == bob_id,
                models.AuditEvent.document_id == document_id,
                models.AuditEvent.action == "permission_revoke",
                models.AuditEvent.outcome == "denied",
            )
            .order_by(models.AuditEvent.id.desc())
            .first()
        )

        assert event is not None
        assert event.details["reason"] == "not_document_owner"
        assert verify_audit_chain(db) is True
    finally:
        db.close()

def test_document_search_matches_name(client):
    password = "AliceSecurePass123!"
    register_user(client, "alice_test", password)
    headers = get_auth_headers(client, "alice_test", password)

    upload = client.post(
        "/documents/upload",
        headers=headers,
        files={
            "file": (
                "project_report.txt",
                b"Report content",
                "text/plain",
            )
        },
        data={"category": "Reports"},
    )
    assert upload.status_code == 201

    response = client.get(
        "/documents",
        headers=headers,
        params={"name": "report"},
    )

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["name"] == "project_report.txt"


def test_document_search_filters_by_category(client):
    password = "AliceSecurePass123!"
    register_user(client, "alice_test", password)
    headers = get_auth_headers(client, "alice_test", password)

    upload = client.post(
        "/documents/upload",
        headers=headers,
        files={
            "file": ("notes.txt", b"Notes content", "text/plain")
        },
        data={"category": "Study"},
    )
    assert upload.status_code == 201

    response = client.get(
        "/documents",
        headers=headers,
        params={"category": "Study"},
    )

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["category"] == "Study"


def test_search_does_not_reveal_another_users_private_document(client):
    alice_password = "AliceSecurePass123!"
    bob_password = "BobSecurePass123!"

    register_user(client, "alice_test", alice_password)
    register_user(client, "bob_test", bob_password)

    alice_headers = get_auth_headers(
        client, "alice_test", alice_password
    )
    bob_headers = get_auth_headers(
        client, "bob_test", bob_password
    )

    upload = client.post(
        "/documents/upload",
        headers=bob_headers,
        files={
            "file": (
                "private_report.txt",
                b"Bob private content",
                "text/plain",
            )
        },
        data={"category": "Confidential"},
    )
    assert upload.status_code == 201
    bob_owner_id = upload.json()["owner_id"]

    response = client.get(
        "/documents",
        headers=alice_headers,
        params={
            "name": "private_report",
            "owner_id": bob_owner_id,
        },
    )

    assert response.status_code == 200
    assert response.json() == []

def test_regular_user_cannot_view_admin_audit_events(client):
    password = "AliceSecurePass123!"

    register_user(client, "alice_test", password)
    headers = get_auth_headers(
        client, "alice_test", password
    )

    response = client.get(
        "/admin/audit-events",
        headers=headers,
    )

    assert response.status_code == 403
def test_admin_can_view_audit_events(client):
    password = "AdminSecurePass123!"
    register_user(client, "admin_test", password)

    # Promote this test account only inside the isolated test database.
    from database import SessionLocal
    from models import User

    db = SessionLocal()
    try:
        user = db.query(User).filter_by(username="admin_test").first()
        assert user is not None
        user.role = "admin"
        db.commit()
    finally:
        db.close()

    headers = get_auth_headers(client, "admin_test", password)
    response = client.get(
        "/admin/audit-events",
        headers=headers,
    )

    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_admin_audit_events_rejects_invalid_limit(client):
    password = "AdminSecurePass123!"
    register_user(client, "admin_limit_test", password)

    from database import SessionLocal
    from models import User

    db = SessionLocal()
    try:
        user = db.query(User).filter_by(
            username="admin_limit_test"
        ).first()
        assert user is not None
        user.role = "admin"
        db.commit()
    finally:
        db.close()

    headers = get_auth_headers(
        client, "admin_limit_test", password
    )

    response = client.get(
        "/admin/audit-events?limit=101",
        headers=headers,
    )

    assert response.status_code == 422


def test_admin_audit_events_rejects_negative_offset(client):
    password = "AdminSecurePass123!"
    register_user(client, "admin_offset_test", password)

    from database import SessionLocal
    from models import User

    db = SessionLocal()
    try:
        user = db.query(User).filter_by(
            username="admin_offset_test"
        ).first()
        assert user is not None
        user.role = "admin"
        db.commit()
    finally:
        db.close()

    headers = get_auth_headers(
        client, "admin_offset_test", password
    )

    response = client.get(
        "/admin/audit-events?offset=-1",
        headers=headers,
    )

    assert response.status_code == 422

def test_regular_user_cannot_verify_audit_chain(client):
    password = "AliceSecurePass123!"
    register_user(client, "alice_verify_test", password)
    headers = get_auth_headers(
        client, "alice_verify_test", password
    )

    response = client.get(
        "/admin/audit-verify",
        headers=headers,
    )

    assert response.status_code == 403


def test_admin_can_verify_audit_chain(client):
    password = "AdminVerifySecure123!"
    register_user(client, "admin_verify_test", password)

    from database import SessionLocal
    from models import User

    db = SessionLocal()
    try:
        user = (
            db.query(User)
            .filter_by(username="admin_verify_test")
            .first()
        )
        assert user is not None
        user.role = "admin"
        db.commit()
    finally:
        db.close()

    headers = get_auth_headers(
        client, "admin_verify_test", password
    )

    response = client.get(
        "/admin/audit-verify",
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["valid"] is True

def test_upload_rejects_unsupported_file_type(client):
    password = "AliceSecurePass123!"
    register_user(client, "alice_test", password)
    headers = get_auth_headers(client, "alice_test", password)

    response = client.post(
        "/documents/upload",
        headers=headers,
        files={"file": ("malware.exe", b"test content", "application/octet-stream")},
        data={"category": "Test"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Unsupported file type"


def test_upload_rejects_file_larger_than_5_mb(client):
    password = "AliceSecurePass123!"
    register_user(client, "alice_test", password)
    headers = get_auth_headers(client, "alice_test", password)

    oversized_content = b"x" * (5 * 1024 * 1024 + 1)

    response = client.post(
        "/documents/upload",
        headers=headers,
        files={"file": ("large.txt", oversized_content, "text/plain")},
        data={"category": "Test"},
    )

    assert response.status_code == 413
    assert response.json()["detail"] == "File exceeds the 5 MB limit"


def test_upload_rejects_empty_category(client):
    password = "AliceSecurePass123!"
    register_user(client, "alice_test", password)
    headers = get_auth_headers(client, "alice_test", password)

    response = client.post(
        "/documents/upload",
        headers=headers,
        files={"file": ("notes.txt", b"test content", "text/plain")},
        data={"category": "   "},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Category must contain 1–100 characters"
def test_rejected_upload_is_recorded_in_audit_log(client):
    password = "SecureTestPass123!"
    user = register_user(client, "audit_upload_user", password)
    headers = get_auth_headers(client, "audit_upload_user", password)
    response = client.post(
        "/documents/upload",
        headers=headers,
        files={"file": ("malware.exe", b"test content", "application/octet-stream")},
        data={"category": "General"},
    )

    assert response.status_code == 400

    from database import SessionLocal
    import models
    from audit import verify_audit_chain

    db = SessionLocal()
    try:
        event = (
            db.query(models.AuditEvent)
            .filter(
                models.AuditEvent.actor_id == get_user_id_for_test(db,"audit_upload_user"),
                models.AuditEvent.action == "document_upload",
                models.AuditEvent.outcome == "denied",
            )
            .order_by(models.AuditEvent.id.desc())
            .first()
        )

        assert event is not None
        assert event.details["reason"] == "unsupported_file_type"
        assert verify_audit_chain(db) is True
    finally:
        db.close()
def test_read_only_user_cannot_edit_document(client):
    from database import SessionLocal
    import models
    from audit import verify_audit_chain

    alice_password = "AliceSecurePass123!"
    bob_password = "BobSecurePass123!"

    register_user(client, "alice_edit_test", alice_password)
    register_user(client, "bob_edit_test", bob_password)

    alice_headers = get_auth_headers(
        client, "alice_edit_test", alice_password
    )
    bob_headers = get_auth_headers(
        client, "bob_edit_test", bob_password
    )

    document_id = upload_test_document(client, alice_headers)

    share_response = share_document(
        client, alice_headers, document_id, "bob_edit_test", "read"
    )
    assert share_response.status_code in (200, 201)

    response = client.patch(
        f"/documents/{document_id}",
        headers=bob_headers,
        json={
            "name": "unauthorized-change.pdf",
            "category": "Changed",
        },
    )

    assert response.status_code == 403

    db = SessionLocal()
    try:
        bob_id = get_user_id_for_test(db, "bob_edit_test")

        event = (
            db.query(models.AuditEvent)
            .filter(
                models.AuditEvent.actor_id == bob_id,
                models.AuditEvent.document_id == document_id,
                models.AuditEvent.action == "document_edit",
                models.AuditEvent.outcome == "denied",
            )
            .order_by(models.AuditEvent.id.desc())
            .first()
        )

        assert event is not None
        assert event.details["reason"] == "insufficient_permission"
        assert verify_audit_chain(db) is True
    finally:
        db.close()
def test_user_with_edit_permission_can_edit_document(client):
    alice_password = "AliceSecurePass123!"
    bob_password = "BobSecurePass123!"

    register_user(client, "alice_edit_owner", alice_password)
    register_user(client, "bob_edit_allowed", bob_password)

    alice_headers = get_auth_headers(
        client, "alice_edit_owner", alice_password
    )
    bob_headers = get_auth_headers(
        client, "bob_edit_allowed", bob_password
    )

    document_id = upload_test_document(client, alice_headers)

    share_response = share_document(
        client, alice_headers, document_id, "bob_edit_allowed", "edit"
    )
    assert share_response.status_code in (200, 201)

    response = client.patch(
        f"/documents/{document_id}",
        headers=bob_headers,
        json={
            "name": "updated-document.pdf",
            "category": "Updated",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "updated-document.pdf"
    assert data["category"] == "Updated"
def test_non_owner_cannot_delete_document(client):
    from database import SessionLocal
    import models
    from audit import verify_audit_chain

    alice_password = "AliceDeletePass123!"
    bob_password = "BobDeletePass123!"

    register_user(client, "alice_delete_test", alice_password)
    register_user(client, "bob_delete_test", bob_password)

    alice_headers = get_auth_headers(
        client, "alice_delete_test", alice_password
    )
    bob_headers = get_auth_headers(
        client, "bob_delete_test", bob_password
    )

    document_id = upload_test_document(client, alice_headers)

    response = client.delete(
        f"/documents/{document_id}",
        headers=bob_headers,
    )
    assert response.status_code == 403

    db = SessionLocal()
    try:
        bob_id = get_user_id_for_test(db, "bob_delete_test")

        event = (
            db.query(models.AuditEvent)
            .filter(
                models.AuditEvent.actor_id == bob_id,
                models.AuditEvent.document_id == document_id,
                models.AuditEvent.action == "document_delete",
                models.AuditEvent.outcome == "denied",
            )
            .order_by(models.AuditEvent.id.desc())
            .first()
        )

        assert event is not None
        assert event.details["reason"] == "not_document_owner"
        assert verify_audit_chain(db) is True

        # Confirm the owner's document still exists.
        assert db.get(models.Document, document_id) is not None
    finally:
        db.close()
def test_owner_can_delete_document_and_audit_it(client):
    from database import SessionLocal
    import models
    from audit import verify_audit_chain
    from storage import get_storage_path

    alice_password = "AliceDeletePass123!"
    bob_password = "BobDeletePass123!"

    register_user(client, "alice_delete_owner", alice_password)
    register_user(client, "bob_delete_shared", bob_password)

    alice_headers = get_auth_headers(
        client, "alice_delete_owner", alice_password
    )
    bob_headers = get_auth_headers(
        client, "bob_delete_shared", bob_password
    )

    document_id = upload_test_document(client, alice_headers)

    share_response = share_document(
        client, alice_headers, document_id, "bob_delete_shared", "read"
    )
    assert share_response.status_code in (200, 201)

    db = SessionLocal()
    try:
        document = db.get(models.Document, document_id)
        assert document is not None
        storage_path = get_storage_path(document.storage_key)
    finally:
        db.close()

    response = client.delete(
        f"/documents/{document_id}",
        headers=alice_headers,
    )

    assert response.status_code == 200
    assert response.json()["deleted"] is True

    db = SessionLocal()
    try:
        assert db.get(models.Document, document_id) is None

        remaining_grants = (
            db.query(models.DocumentGrant)
            .filter(models.DocumentGrant.document_id == document_id)
            .count()
        )
        assert remaining_grants == 0

        alice_id = get_user_id_for_test(db, "alice_delete_owner")
        event = (
            db.query(models.AuditEvent)
            .filter(
                models.AuditEvent.actor_id == alice_id,
                models.AuditEvent.document_id == document_id,
                models.AuditEvent.action == "document_delete",
                models.AuditEvent.outcome == "success",
            )
            .order_by(models.AuditEvent.id.desc())
            .first()
        )

        assert event is not None
        assert verify_audit_chain(db) is True
    finally:
        db.close()

    assert not storage_path.exists()