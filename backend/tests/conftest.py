import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import os

import pytest

os.environ.setdefault(
    "DATABASE_URL",
    "sqlite+pysqlite:///:memory:",
)
os.environ.setdefault(
    "JWT_SECRET",
    "test-only-secret-not-for-production",
)

from fastapi.testclient import TestClient
from server import app


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client