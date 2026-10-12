import os

import pytest
from database import Base, get_db
from fastapi.testclient import TestClient
from models import User
from server import app
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_engine(DATABASE_URL)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


@pytest.fixture(scope="session", autouse=True)
def create_test_schema():
    """
    Create a clean PostgreSQL schema for the integration test session,
    then remove it after all integration tests finish.
    """
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    yield

    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    """
    Open a database transaction for each integration test and roll it back
    afterward so tests do not leave persistent data behind.
    """
    connection = engine.connect()
    transaction = connection.begin()

    session = TestingSessionLocal(bind=connection)

    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(db):
    """
    Override FastAPI's get_db dependency so requests made by TestClient use
    the same PostgreSQL transaction as the integration test.
    """

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def seeded_user(db):
    """
    Create a minimal user required by Post.user_id foreign-key constraints.
    This fixture intentionally avoids authentication logic because the
    representative smoke test focuses on API/database/serialization flow.
    """
    user = User(
        username="integration_user",
        email="integration@example.com",
        hashed_password="integration-placeholder",
    )

    db.add(user)
    db.flush()

    return user
