
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import models
import database
import storage
from main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    # Tests must use the dedicated test database.
    test_database_url = os.getenv("TEST_DATABASE_URL")

    if not test_database_url:
        pytest.fail(
            "Set TEST_DATABASE_URL to the trustvault_test database."
        )

    test_engine = create_engine(test_database_url)

    if test_engine.url.database != "trustvault_test":
        test_engine.dispose()
        pytest.fail(
            "Tests must use the separate trustvault_test database."
        )

    TestSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=test_engine,
    )

    def override_get_db():
        db = TestSessionLocal()
        try:
            yield db
        finally:
            db.close()

    # Use the test database for API requests.
    app.dependency_overrides[database.get_db] = override_get_db
    monkeypatch.setattr(database, "SessionLocal", TestSessionLocal)
    # Store uploaded files in a temporary test directory.
    test_storage = tmp_path / "private_storage"
    test_storage.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(storage, "STORAGE_DIR", test_storage)

    try:
        models.Base.metadata.drop_all(bind=test_engine)
        models.Base.metadata.create_all(bind=test_engine)

        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        models.Base.metadata.drop_all(bind=test_engine)
        test_engine.dispose()
