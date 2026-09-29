import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["JWT_SECRET"] = "test-secret-key-for-ci-testing-123456789"

import pytest
from database import Base, get_db
from fastapi.testclient import TestClient
from models import User
from routes import hash_password
from server import app
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db():
    connection = engine.connect()
    transaction = connection.begin()

    session = TestingSessionLocal(bind=connection)

    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def pytest_runtest_makereport(item, call):
    """Print the linked Requirement ID when an automated test fails.

    Traces a failing test straight back to the requirement/acceptance
    criterion it verifies in 'QA standard.md', without needing to open
    the traceability matrix by hand.
    """
    if call.when == "call" and call.excinfo is not None:
        marker = item.get_closest_marker("requirement")
        if marker and marker.args:
            print(
                f"\n[traceability] {item.nodeid} FAILED "
                f"-> Requirement ID(s): {', '.join(marker.args)}"
            )


@pytest.fixture()
def seeded_user(db):
    user = User(
        username="testuser",
        email="test@example.com",
        hashed_password=hash_password("TestPassword123!"),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user
