from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["gpu"] is False
