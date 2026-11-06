"""Self-hosted Virtual Try-On FastAPI worker.

Without a GPU model configured this returns clearly labelled stub composites.
It never claims commercial-quality AI results.
"""

from __future__ import annotations

import io
import os
import time
import uuid
from enum import Enum
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from PIL import Image, ImageDraw, ImageFont

STORAGE_DIR = Path(os.getenv("STORAGE_DIR", "/agent/saree-tryon-saas/uploads"))
WATERMARK = os.getenv("DEMO_WATERMARK", "SELF-HOSTED STUB — not commercial AI")

app = FastAPI(title="Saree Try-On AI Worker", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class JobStatus(str, Enum):
    queued = "queued"
    processing = "processing"
    succeeded = "succeeded"
    failed = "failed"
    cancelled = "cancelled"


class TryOnRequest(BaseModel):
    job_id: str
    person_image_path: str
    saree_image_path: str
    store_id: str


class JobRecord(BaseModel):
    job_id: str
    status: JobStatus
    person_image_path: str
    saree_image_path: str
    store_id: str
    result_path: str | None = None
    is_demo: bool = True
    label: str = WATERMARK
    error: str | None = None
    progress: int = 0
    duration_ms: int | None = None
    started_at: float = Field(default_factory=time.time)


JOBS: dict[str, JobRecord] = {}


def resolve_upload(rel: str) -> Path:
    p = (STORAGE_DIR / rel).resolve()
    if not str(p).startswith(str(STORAGE_DIR.resolve())):
        raise HTTPException(400, "Invalid path")
    return p


def compose_stub(person_path: Path, saree_path: Path, out_path: Path) -> None:
    person = Image.open(person_path).convert("RGBA")
    saree = Image.open(saree_path).convert("RGBA")
    w, h = min(person.width, 900), min(person.height, 1400)
    person = person.resize((w, h))
    sw, sh = int(w * 0.45), int(h * 0.55)
    saree = saree.resize((sw, sh))
    person.paste(saree, (w - sw - 20, h - sh - 40), saree)
    draw = ImageDraw.Draw(person)
    draw.rectangle((0, 0, w, 54), fill=(107, 30, 46, 220))
    draw.text((16, 14), WATERMARK, fill=(245, 230, 200, 255))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    person.convert("RGB").save(out_path, format="JPEG", quality=88)


def process_job(job_id: str) -> None:
    job = JOBS.get(job_id)
    if not job or job.status == JobStatus.cancelled:
        return
    job.status = JobStatus.processing
    job.progress = 40
    try:
        person = resolve_upload(job.person_image_path)
        saree = resolve_upload(job.saree_image_path)
        if not person.exists() or not saree.exists():
            raise FileNotFoundError("Input image missing on worker storage")
        rel = f"results/{job.store_id}/selfhost_{uuid.uuid4().hex}.jpg"
        out = resolve_upload(rel)
        compose_stub(person, saree, out)
        job.result_path = rel
        job.status = JobStatus.succeeded
        job.progress = 100
        job.duration_ms = int((time.time() - job.started_at) * 1000)
        job.is_demo = True
        job.label = WATERMARK
    except Exception as exc:  # noqa: BLE001
        job.status = JobStatus.failed
        job.error = str(exc)
        job.progress = 100


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "gpu": False, "mode": "stub"}


@app.post("/v1/tryon")
def create_tryon(body: TryOnRequest) -> dict[str, Any]:
    job_id = body.job_id or uuid.uuid4().hex
    record = JobRecord(
        job_id=job_id,
        status=JobStatus.queued,
        person_image_path=body.person_image_path,
        saree_image_path=body.saree_image_path,
        store_id=body.store_id,
    )
    JOBS[job_id] = record
    # Synchronous stub processing keeps local demo simple; still returns queued first then updates.
    process_job(job_id)
    return {"job_id": job_id, "status": JOBS[job_id].status.value}


@app.get("/v1/tryon/{job_id}")
def get_tryon(job_id: str) -> dict[str, Any]:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job.model_dump()


@app.post("/v1/tryon/{job_id}/cancel")
def cancel_tryon(job_id: str) -> dict[str, Any]:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status not in (JobStatus.succeeded, JobStatus.failed):
        job.status = JobStatus.cancelled
    return {"job_id": job_id, "status": job.status.value}
