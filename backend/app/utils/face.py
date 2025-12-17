import json
import os
from pathlib import Path
from typing import List, Optional

import face_recognition
from fastapi import HTTPException, UploadFile

from app.config import get_settings

settings = get_settings()


def ensure_upload_dir() -> Path:
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


def extract_face_embedding(file: UploadFile) -> tuple[str, str]:
    upload_dir = ensure_upload_dir()
    file_path = upload_dir / file.filename
    with open(file_path, "wb") as buffer:
        buffer.write(file.file.read())

    image = face_recognition.load_image_file(str(file_path))
    encodings = face_recognition.face_encodings(image)
    if not encodings:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail="No face detected")
    embedding = encodings[0]
    return str(file_path), json.dumps(embedding.tolist())


def match_embedding(known_embeddings: List[str], frame_embedding: List[float], tolerance: float = 0.6) -> Optional[int]:
    known_vectors = [json.loads(item) for item in known_embeddings]
    matches = face_recognition.compare_faces(known_vectors, frame_embedding, tolerance=tolerance)
    for idx, matched in enumerate(matches):
        if matched:
            return idx
    return None

