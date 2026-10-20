
import os
import uuid
from pathlib import Path

# Resolve the storage directory relative to this Python file.
STORAGE_DIR = Path(__file__).resolve().parent / "private_storage"


def save_upload(file_content: bytes) -> str:
    """
    Save document bytes under a random, server-generated filename.
    Returns the storage key, not a public URL.
    """
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)

    storage_key = uuid.uuid4().hex
    file_path = STORAGE_DIR / storage_key

    # Exclusive creation prevents accidentally overwriting an existing file.
    with file_path.open("xb") as stored_file:
        stored_file.write(file_content)

    return storage_key


def get_storage_path(storage_key: str) -> Path:
    """
    Resolve a storage key safely.
    Reject anything that is not a generated UUID-style hex key.
    """
    if (
        len(storage_key) != 32
        or any(char not in "0123456789abcdef" for char in storage_key)
    ):
        raise ValueError("Invalid storage key")

    path = (STORAGE_DIR / storage_key).resolve()

    if path.parent != STORAGE_DIR.resolve():
        raise ValueError("Invalid storage path")

    return path


def delete_stored_file(storage_key: str) -> None:
    """Delete a stored file if it exists."""
    path = get_storage_path(storage_key)

    if path.exists():
        path.unlink()
