from fastapi.middleware.cors import CORSMiddleware
from audit import log_audit_event
from audit import verify_audit_chain
import os
from pathlib import Path

from fastapi import UploadFile, File, Form
from fastapi import HTTPException, Query
from sqlalchemy.exc import SQLAlchemyError

from fastapi.responses import FileResponse
from storage import get_storage_path

from storage import save_upload, delete_stored_file
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from auth import decode_access_token
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import date, datetime, time, timedelta, timezone
import models
from database import Base, engine, get_db
from auth import (
    hash_password,
    verify_password,
    create_access_token,
)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except (JWTError, ValueError, KeyError, TypeError):
        raise credentials_error

    user = db.get(models.User, user_id)

    if user is None:
        raise credentials_error

    return user
app = FastAPI(
    title="TrustVault API",
    description="Secure document sharing and audit platform",
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=12, max_length=128)

class ShareRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    permission: str
class DocumentUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    category: str = Field(min_length=1, max_length=100)

@app.get("/health")
def health_check():
    return {"status": "ok", "project": "TrustVault"}


@app.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(
    request: RegisterRequest,
    db: Session = Depends(get_db),
):
    username = request.username.strip()

    if len(username) < 3:
        raise HTTPException(
            status_code=400,
            detail="Username must contain at least 3 characters",
        )

    user = models.User(
        username=username,
        password_hash=hash_password(request.password),
        role="user",
    )

    db.add(user)

    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Username is already registered",
        )

    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
    }



@app.post("/auth/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    try:
        user = (
            db.query(models.User)
            .filter(models.User.username == form_data.username)
            .first()
        )

        if not user or not verify_password(
            form_data.password,
            user.password_hash,
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        token = create_access_token(user.id)

        return {
            "access_token": token,
            "token_type": "bearer",
        }

    except HTTPException:
        raise
    except Exception:
        import logging
        logging.exception("Unexpected error in /auth/login")
        raise HTTPException(
            status_code=500,
            detail="Login failed due to a server error. Check backend logs.",
        )

@app.get("/auth/me")
def get_my_profile(
    current_user: models.User = Depends(get_current_user),
):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "role": current_user.role,
    }

def log_rejected_upload(
    db: Session,
    actor_id: int,
    filename: str,
    reason: str,
):
    """Record a rejected upload in the audit chain."""
    log_audit_event(
        db=db,
        actor_id=actor_id,
        action="document_upload",
        outcome="denied",
        details={
            "filename": filename,
            "reason": reason,
        },
    )
    db.commit()

@app.post("/documents/upload", status_code=201)
def upload_document(
    file: UploadFile = File(...),
    category: str = Form(default="General"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
    ALLOWED_EXTENSIONS = {".pdf", ".txt", ".png", ".jpg", ".jpeg", ".docx"}

    original_name = Path(file.filename or "").name
    extension = Path(original_name).suffix.lower()

    if not original_name or extension not in ALLOWED_EXTENSIONS:
        log_rejected_upload(
            db, current_user.id, original_name, "unsupported_file_type"
        )
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type",
        )

    if not category.strip() or len(category) > 100:
        log_rejected_upload(
            db, current_user.id, original_name, "invalid_category"
        )
        raise HTTPException(
            status_code=400,
            detail="Category must contain 1–100 characters",
        )

    content = file.file.read(MAX_FILE_SIZE + 1)

    if len(content) > MAX_FILE_SIZE:
        log_rejected_upload(
            db, current_user.id, original_name, "file_too_large"
        )
        raise HTTPException(
            status_code=413,
            detail="File exceeds the 5 MB limit",
        )

    storage_key = save_upload(content)

    document = models.Document(
        name=original_name,
        category=category.strip(),
        storage_key=storage_key,
        owner_id=current_user.id,
    )

    try:
        db.add(document)
        db.flush()  # Generate the document ID without committing yet.

        log_audit_event(
            db=db,
            actor_id=current_user.id,
            action="document_upload",
            outcome="success",
            document_id=document.id,
            details={
                "filename": document.name,
                "category": document.category,
            },
        )

        db.commit()
        db.refresh(document)

    except SQLAlchemyError:
        db.rollback()
        delete_stored_file(storage_key)
        raise HTTPException(
            status_code=500,
            detail="Unable to save document metadata",
        )

    return {
        "id": document.id,
        "name": document.name,
        "category": document.category,
        "owner_id": document.owner_id,
        "created_at": document.created_at,
    }

from sqlalchemy import or_

@app.get("/documents")
def list_documents(
    name: str | None = None,
    category: str | None = None,
    owner_id: int | None = None,
    created_from: date | None = None,
    created_to: date | None = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Identify documents owned by the current user
    # or explicitly shared with them.
    shared_document_ids = (
        db.query(models.DocumentGrant.document_id)
        .filter(models.DocumentGrant.user_id == current_user.id)
        
    )

    query = db.query(models.Document).filter(
        or_(
            models.Document.owner_id == current_user.id,
            models.Document.id.in_(shared_document_ids),
        )
    )

    # Search by document name, ignoring letter case.
    if name and name.strip():
        query = query.filter(
            models.Document.name.ilike(f"%{name.strip()}%")
        )

    # Filter by category.
    if category and category.strip():
        query = query.filter(
            models.Document.category.ilike(category.strip())
        )

    # Filter by owner.
    if owner_id is not None:
        query = query.filter(models.Document.owner_id == owner_id)

    # Filter by inclusive creation-date range.
    if created_from is not None:
        start = datetime.combine(
            created_from, time.min, tzinfo=timezone.utc
        )
        query = query.filter(models.Document.created_at >= start)

    if created_to is not None:
        end_exclusive = datetime.combine(
            created_to + timedelta(days=1),
            time.min,
            tzinfo=timezone.utc,
        )
        query = query.filter(
            models.Document.created_at < end_exclusive
        )

    documents = query.order_by(
        models.Document.created_at.desc()
    ).all()

    return [
        {
            "id": document.id,
            "name": document.name,
            "category": document.category,
            "owner_id": document.owner_id,
            "created_at": document.created_at,
        }
        for document in documents
    ]
def log_denied_share(
    db: Session,
    actor_id: int,
    document_id: int,
    reason: str,
):
    log_audit_event(
        db=db,
        actor_id=actor_id,
        action="document_share",
        outcome="denied",
        document_id=document_id,
        details={"reason": reason},
    )
    db.commit()
@app.patch("/documents/{document_id}")
def update_document(
    document_id: int,
    request: DocumentUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = db.get(models.Document, document_id)

    if document is None:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    is_owner = document.owner_id == current_user.id

    grant = (
        db.query(models.DocumentGrant)
        .filter(
            models.DocumentGrant.document_id == document_id,
            models.DocumentGrant.user_id == current_user.id,
        )
        .first()
    )

    has_edit_permission = (
        grant is not None and grant.permission == "edit"
    )

    if not is_owner and not has_edit_permission:
        log_audit_event(
            db=db,
            actor_id=current_user.id,
            action="document_edit",
            outcome="denied",
            document_id=document_id,
            details={"reason": "insufficient_permission"},
        )
        db.commit()

        raise HTTPException(
            status_code=403,
            detail="You do not have permission to edit this document",
        )

    name = request.name.strip()
    category = request.category.strip()

    if not name or not category:
        raise HTTPException(
            status_code=400,
            detail="Name and category cannot be empty",
        )

    old_name = document.name
    old_category = document.category

    document.name = name
    document.category = category

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        action="document_edit",
        outcome="success",
        document_id=document_id,
        details={
            "old_name": old_name,
            "new_name": name,
            "old_category": old_category,
            "new_category": category,
        },
    )

    db.commit()
    db.refresh(document)

    return {
        "id": document.id,
        "name": document.name,
        "category": document.category,
        "owner_id": document.owner_id,
    }
@app.delete("/documents/{document_id}")
def delete_document(
    document_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = db.get(models.Document, document_id)

    if document is None:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    if document.owner_id != current_user.id:
        log_audit_event(
            db=db,
            actor_id=current_user.id,
            action="document_delete",
            outcome="denied",
            document_id=document_id,
            details={"reason": "not_document_owner"},
        )
        db.commit()

        raise HTTPException(
            status_code=403,
            detail="Only the document owner can delete it",
        )

    storage_key = document.storage_key
    document_name = document.name

    try:
        # Record the deletion and remove the database record atomically.
        log_audit_event(
            db=db,
            actor_id=current_user.id,
            action="document_delete",
            outcome="success",
            document_id=document_id,
            details={"filename": document_name},
        )

        # Remove associated grants before deleting the document.
        db.query(models.DocumentGrant).filter(
            models.DocumentGrant.document_id == document_id
        ).delete(synchronize_session=False)

        db.delete(document)
        db.commit()

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to delete document",
        )

    # Delete the private file only after the database transaction commits.
    try:
        delete_stored_file(storage_key)
    except OSError:
        # The DB record is deleted, but the file may need cleanup.
        # Do not claim the physical file was deleted successfully.
        raise HTTPException(
            status_code=500,
            detail="Document record deleted, but stored file cleanup failed",
        )

    return {
        "document_id": document_id,
        "deleted": True,
    }
@app.post("/documents/{document_id}/share")
def share_document(
    document_id: int,
    request: ShareRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if request.permission not in {"read", "edit"}:
        raise HTTPException(
            status_code=400,
            detail="Permission must be 'read' or 'edit'",
        )

    document = db.get(models.Document, document_id)

    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")

    if document.owner_id != current_user.id:
        log_denied_share(
            db=db,
            actor_id=current_user.id,
            document_id=document_id,
            reason="not_document_owner",
        )
        raise HTTPException(
            status_code=403,
            detail="Only the document owner can share it",
        )

    recipient = (
        db.query(models.User)
        .filter(models.User.username == request.username.strip())
        .first()
    )

    if recipient is None:
        raise HTTPException(status_code=404, detail="Recipient not found")

    if recipient.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot share a document with yourself",
        )

    grant = (
        db.query(models.DocumentGrant)
        .filter(
            models.DocumentGrant.document_id == document_id,
            models.DocumentGrant.user_id == recipient.id,
        )
        .first()
    )

    if grant:
        grant.permission = request.permission
    else:
        grant = models.DocumentGrant(
            document_id=document_id,
            user_id=recipient.id,
            permission=request.permission,
        )
        db.add(grant)
    log_audit_event(
    db=db,
    actor_id=current_user.id,
    action="document_share",
    outcome="success",
    document_id=document_id,
    details={
        "recipient_username": recipient.username,
        "permission": request.permission,
    },
    )
    db.commit()

    return {
        "document_id": document_id,
        "shared_with": recipient.username,
        "permission": request.permission,
    }

@app.get("/documents/{document_id}/shares")
def list_document_shares(
    document_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = db.get(models.Document, document_id)

    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")

    if document.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Only the document owner can view its shares",
        )

    grants = (
        db.query(models.DocumentGrant, models.User.username)
        .join(
            models.User,
            models.User.id == models.DocumentGrant.user_id,
        )
        .filter(models.DocumentGrant.document_id == document_id)
        .all()
    )

    return [
        {
            "username": username,
            "permission": grant.permission,
        }
        for grant, username in grants
    ]


@app.get("/documents/{document_id}/download")
def download_document(
    document_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = db.get(models.Document, document_id)

    if document is None:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    # Owners can download their own documents.
    allowed = document.owner_id == current_user.id

    # Other users need an explicit read or edit grant.
    if not allowed:
        grant = (
            db.query(models.DocumentGrant)
            .filter(
                models.DocumentGrant.document_id == document_id,
                models.DocumentGrant.user_id == current_user.id,
                models.DocumentGrant.permission.in_(["read", "edit"]),
            )
            .first()
        )
        allowed = grant is not None

    # Record denied attempts and commit before returning 403.
    if not allowed:
        log_audit_event(
            db=db,
            actor_id=current_user.id,
            action="document_download",
            outcome="denied",
            document_id=document_id,
            details={"reason": "insufficient_permission"},
        )
        db.commit()

        raise HTTPException(
            status_code=403,
            detail="You do not have permission to download this document",
        )

    try:
        file_path = get_storage_path(document.storage_key)
    except ValueError:
        raise HTTPException(
            status_code=500,
            detail="Invalid storage key",
        )

    if not file_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Stored file not found",
        )

    # Record successful authorization before serving the file.
    log_audit_event(
        db=db,
        actor_id=current_user.id,
        action="document_download",
        outcome="success",
        document_id=document_id,
        details={"filename": document.name},
    )
    db.commit()

    return FileResponse(
        path=file_path,
        filename=document.name,
        media_type="application/octet-stream",
    )

@app.delete("/documents/{document_id}/share/{username}")
def revoke_document_access(
    document_id: int,
    username: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = db.get(models.Document, document_id)

    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")

    if document.owner_id != current_user.id:
        log_audit_event(
            db=db,
            actor_id=current_user.id,
            action="permission_revoke",
            outcome="denied",
            document_id=document_id,
            details={"reason": "not_document_owner"},
        )
        db.commit()
        raise HTTPException(
            status_code=403,
            detail="Only the document owner can revoke access",
        )

    recipient = (
        db.query(models.User)
        .filter(models.User.username == username)
        .first()
    )

    if recipient is None:
        raise HTTPException(status_code=404, detail="User not found")

    grant = (
        db.query(models.DocumentGrant)
        .filter(
            models.DocumentGrant.document_id == document_id,
            models.DocumentGrant.user_id == recipient.id,
        )
        .first()
    )

    if grant is None:
        return {
            "document_id": document_id,
            "username": username,
            "revoked": False,
            "message": "No active permission was found",
        }

    db.delete(grant)

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        action="permission_revoke",
        outcome="success",
        document_id=document_id,
        details={
            "revoked_username": recipient.username,
            "revoked_user_id": recipient.id,
        },
    )

    db.commit()

    return {
        "document_id": document_id,
        "username": username,
        "revoked": True,
    }

@app.get("/admin/audit-events")
def get_audit_events(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Only administrators may inspect audit activity.
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Administrator access required",
        )

    events = (
        db.query(models.AuditEvent)
        .order_by(models.AuditEvent.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return [
        {
            "id": event.id,
            "actor_id": event.actor_id,
            "document_id": event.document_id,
            "action": event.action,
            "outcome": event.outcome,
            "details": event.details,
            "created_at": event.created_at,
            "previous_hash": event.previous_hash,
            "event_hash": event.event_hash,
        }
        for event in events
    ]

@app.get("/admin/audit-verify")
def audit_verify(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Administrator access required",
        )

    is_valid = verify_audit_chain(db)

    return {
        "valid": is_valid,
        "message": (
            "Audit chain is intact"
            if is_valid
            else "Audit chain integrity check failed"
        ),
    }
