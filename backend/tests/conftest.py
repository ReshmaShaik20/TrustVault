
import pytest
from fastapi.testclient import TestClient

import models
from database import Base, engine
from main import app
import storage


@pytest.fixture
def client(tmp_path, monkeypatch):
    # Safety check: never reset tables in the development database.
    if engine.url.database != "trustvault_test":
        pytest.fail(
            "Tests must use the separate trustvault_test database."
        )

    # Give tests their own temporary file-storage directory.
    test_storage = tmp_path / "private_storage"
    monkeypatch.setattr(storage, "STORAGE_DIR", test_storage)

    # Create a clean test database for each test.
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    with TestClient(app) as test_client:
        yield test_client

    Base.metadata.drop_all(bind=engine)
