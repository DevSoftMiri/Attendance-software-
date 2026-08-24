from __future__ import annotations

import json
import os
from datetime import datetime, UTC
from pathlib import Path
from typing import Any

import numpy as np

from ..models.schemas import FaceEnrolRequest, FaceIdentifyRequest, FaceQualityRequest, FaceVerifyRequest
from ..utils.files import (
    delete_employee_directory,
    encode_image_to_data_url,
    ensure_registered_face_dir,
    file_sha256,
    image_quality,
    list_reference_images,
    list_registered_employee_ids,
    load_image,
    read_text_file,
    save_base64_image,
    save_text_file,
    stored_file_exists,
)

try:
    from insightface.app import FaceAnalysis  # type: ignore
except Exception:  # pragma: no cover - optional locally
    FaceAnalysis = None

try:
    import cv2  # type: ignore
except Exception:  # pragma: no cover
    cv2 = None


EMBEDDINGS_FILE_NAME = 'embeddings.json'
TEMP_DIRECTORIES = {'identify-check', 'quality-check'}
DEFAULT_PROVIDER = 'CPUExecutionProvider'

_face_app: FaceAnalysis | None = None
_face_app_initialization_error: str | None = None


def _env_flag(name: str, default: bool) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {'1', 'true', 'yes', 'on'}


def _env_int(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    try:
        return int(raw_value.strip())
    except ValueError:
        return default


def _insightface_model_name() -> str:
    return os.getenv('INSIGHTFACE_MODEL_NAME', 'buffalo_l').strip() or 'buffalo_l'


def _insightface_det_size() -> tuple[int, int]:
    edge = _env_int('INSIGHTFACE_DET_SIZE', 640)
    edge = max(160, min(edge, 640))
    return (edge, edge)


def _numpy_image(path: Path) -> np.ndarray:
    image = np.array(load_image(path))
    return image[:, :, ::-1] if image.shape[-1] == 3 else image


def _employee_directory(employee_id: str) -> Path:
    return Path(employee_id)


def _load_face_app() -> FaceAnalysis | None:
    global _face_app
    global _face_app_initialization_error

    if _face_app is not None:
        return _face_app

    if FaceAnalysis is None:
        return None

    if _face_app_initialization_error is not None:
        return None

    try:
        app = FaceAnalysis(name=_insightface_model_name(), providers=[DEFAULT_PROVIDER])
        app.prepare(ctx_id=0, det_size=_insightface_det_size())
        _face_app = app
        return _face_app
    except Exception as error:  # pragma: no cover - environment specific
        _face_app_initialization_error = str(error)
        return None


def _insightface_status_detail() -> str:
    if FaceAnalysis is None:
        return 'InsightFace is not installed in the face service environment.'

    if _face_app_initialization_error:
        return f'InsightFace failed to initialize: {_face_app_initialization_error}'

    return 'InsightFace is unavailable.'


def _cosine_distance(left: np.ndarray, right: np.ndarray) -> float:
    left_norm = np.linalg.norm(left)
    right_norm = np.linalg.norm(right)
    if left_norm == 0 or right_norm == 0:
        return 1.0

    similarity = float(np.dot(left, right) / (left_norm * right_norm))
    return max(0.0, min(2.0, 1.0 - similarity))


def _confidence_from_distance(distance: float) -> float:
    return round(max(0.0, min(1.0, 1.0 - distance)), 4)


def assess_quality(image_path: Path) -> dict[str, Any]:
    quality = image_quality(image_path)
    quality['faceCount'] = 1
    quality['isSharpEnough'] = quality['sharpness'] >= 0.45
    quality['isBrightEnough'] = quality['brightness'] >= 0.2
    quality['passed'] = quality['isSharpEnough'] and quality['isBrightEnough']
    return quality


def _extract_insightface_embedding(image_path: Path) -> dict[str, Any] | None:
    app = _load_face_app()
    if app is None:
        return None

    image = _numpy_image(image_path)
    faces = app.get(image)
    if not faces:
        return None

    best_face = max(faces, key=lambda face: float(getattr(face, 'det_score', 0.0)))
    embedding = np.asarray(best_face.embedding, dtype=np.float32)
    return {
        'embedding': embedding.tolist(),
        'detScore': round(float(getattr(best_face, 'det_score', 0.0)), 4),
        'bbox': [float(value) for value in getattr(best_face, 'bbox', [])],
    }


def _write_embedding_cache(employee_id: str, entries: list[dict[str, Any]]) -> None:
    save_text_file(employee_id, EMBEDDINGS_FILE_NAME, json.dumps(entries, indent=2))


def _read_embedding_cache(employee_id: str) -> list[dict[str, Any]]:
    content = read_text_file(employee_id, EMBEDDINGS_FILE_NAME)
    if not content:
        return []

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return []


def _build_embedding_cache(employee_id: str) -> list[dict[str, Any]]:
    references = [path for path in list_reference_images(employee_id) if path.name != EMBEDDINGS_FILE_NAME]
    entries: list[dict[str, Any]] = []

    for reference_path in references:
        extracted = _extract_insightface_embedding(reference_path)
        if extracted is None:
            continue

        entries.append({
            'imageName': reference_path.name,
            'embedding': extracted['embedding'],
            'detScore': extracted['detScore'],
            'sha256': file_sha256(reference_path)
        })

    if entries:
        _write_embedding_cache(employee_id, entries)

    return entries


def _load_or_create_embeddings(employee_id: str) -> list[dict[str, Any]]:
    cached_entries = _read_embedding_cache(employee_id)
    if cached_entries:
        return cached_entries

    return _build_embedding_cache(employee_id)


def register_faces(payload: FaceEnrolRequest) -> dict[str, Any]:
    ensure_registered_face_dir()
    saved_paths = []
    quality_scores = []
    embedding_references = []

    for index, image_payload in enumerate(payload.images, start=1):
        saved_path = save_base64_image(payload.employee_id, image_payload, index)
        saved_paths.append(saved_path)
        quality_scores.append(assess_quality(saved_path)['sharpness'])
        embedding_references.append(file_sha256(saved_path))

    cached_embeddings = _build_embedding_cache(payload.employee_id)
    app = _load_face_app()

    return {
        'employeeId': payload.employee_id,
        'registeredImages': len(saved_paths),
        'qualityScores': quality_scores,
        'embeddingReferences': embedding_references,
        'status': 'REGISTERED',
        'mode': 'insightface' if app is not None else 'fallback',
        'detail': (
            f'InsightFace profile registered with {len(cached_embeddings)} embedding(s).'
            if app is not None
            else 'InsightFace unavailable; stored reference images only.'
        )
    }


def _insightface_verification(reference_employee_id: str, live_path: Path, threshold: float) -> dict[str, Any] | None:
    embeddings = _load_or_create_embeddings(reference_employee_id)
    live_embedding = _extract_insightface_embedding(live_path)
    if not embeddings or live_embedding is None:
        return None

    live_vector = np.asarray(live_embedding['embedding'], dtype=np.float32)
    distances = [
        _cosine_distance(np.asarray(entry['embedding'], dtype=np.float32), live_vector)
        for entry in embeddings
    ]
    best_distance = min(distances)
    confidence = _confidence_from_distance(best_distance)

    return {
        'employeeId': reference_employee_id,
        'verified': best_distance <= threshold,
        'distance': round(best_distance, 4),
        'threshold': threshold,
        'confidence': confidence,
        'antiSpoofingPassed': True,
        'mode': 'insightface',
        'detail': 'InsightFace verification complete.',
        'metadata': {
            'matchedReferences': len(embeddings),
            'liveDetectionScore': live_embedding['detScore']
        }
    }


def verify_face(payload: FaceVerifyRequest) -> dict[str, Any]:
    ensure_registered_face_dir()
    references = [path for path in list_reference_images(payload.employee_id) if path.name != EMBEDDINGS_FILE_NAME]
    if not references:
        return {
            'employeeId': payload.employee_id,
            'verified': False,
            'distance': None,
            'threshold': payload.threshold,
            'confidence': 0.0,
            'antiSpoofingPassed': False,
            'mode': 'fallback',
            'detail': 'No registered reference images found.',
            'metadata': {}
        }

    live_path = save_base64_image('verify-check', payload.image, 1, persist=False)
    insightface_result = _insightface_verification(payload.employee_id, live_path, payload.threshold)
    if insightface_result is not None:
        return insightface_result

    reference_path = references[-1]
    fallback = _fallback_verification(reference_path, live_path, payload.threshold)
    fallback['detail'] = (
        'InsightFace unavailable or no face detected; used fallback comparison.'
        if _load_face_app() is None
        else fallback['detail']
    )
    return fallback


def identify_face(payload: FaceIdentifyRequest) -> dict[str, Any]:
    ensure_registered_face_dir()
    employee_ids = [employee_id for employee_id in list_registered_employee_ids() if employee_id not in TEMP_DIRECTORIES]
    if not employee_ids:
        return {
            'employeeId': None,
            'verified': False,
            'distance': None,
            'threshold': payload.threshold,
            'confidence': 0.0,
            'antiSpoofingPassed': False,
            'mode': 'fallback',
            'detail': 'No registered face profiles found.',
            'metadata': {}
        }

    live_path = save_base64_image('identify-check', payload.image, 1)
    live_embedding = _extract_insightface_embedding(live_path)

    if live_embedding is not None:
        live_vector = np.asarray(live_embedding['embedding'], dtype=np.float32)
        best_match: dict[str, Any] = {
            'employeeId': None,
            'verified': False,
            'distance': 1.0,
            'threshold': payload.threshold,
            'confidence': 0.0,
            'antiSpoofingPassed': True,
            'mode': 'insightface',
            'detail': 'No face matched.',
            'metadata': {}
        }

        for employee_id in employee_ids:
            entries = _load_or_create_embeddings(employee_id)
            if not entries:
                continue

            best_distance = min(
                _cosine_distance(np.asarray(entry['embedding'], dtype=np.float32), live_vector)
                for entry in entries
            )

            if best_distance < best_match['distance']:
                best_match = {
                    'employeeId': employee_id,
                    'verified': best_distance <= payload.threshold,
                    'distance': round(best_distance, 4),
                    'threshold': payload.threshold,
                    'confidence': _confidence_from_distance(best_distance),
                    'antiSpoofingPassed': True,
                    'mode': 'insightface',
                    'detail': 'InsightFace identification complete.',
                    'metadata': {
                        'matchedReferences': len(entries),
                        'liveDetectionScore': live_embedding['detScore']
                    }
                }

        if best_match['employeeId'] is not None and best_match['verified']:
            return best_match

        if best_match['employeeId'] is not None:
            return {
                **best_match,
                'employeeId': None,
                'verified': False,
                'detail': 'No enrolled face matched within the identification threshold.'
            }

    allow_fallback_identification = _env_flag('ALLOW_FALLBACK_IDENTIFICATION', False)
    if not allow_fallback_identification:
        return {
            'employeeId': None,
            'verified': False,
            'distance': None,
            'threshold': payload.threshold,
            'confidence': 0.0,
            'antiSpoofingPassed': False,
            'mode': 'fallback-disabled',
            'detail': (
                'Public face identification requires InsightFace. '
                f'{_insightface_status_detail()}'
            ),
            'metadata': {}
        }

    best_match = {
        'employeeId': None,
        'verified': False,
        'distance': 1.0,
        'threshold': payload.threshold,
        'confidence': 0.0,
        'antiSpoofingPassed': False,
        'mode': 'fallback',
        'detail': 'No face matched.',
        'metadata': {}
    }

    for employee_id in employee_ids:
        reference_images = [
            path for path in list_reference_images(employee_id)
            if path.is_file() and path.name != EMBEDDINGS_FILE_NAME
        ]
        if not reference_images:
            continue

        reference_path = reference_images[-1]
        candidate = _fallback_identity(reference_path, live_path, employee_id, payload.threshold)

        if candidate['verified'] and candidate['distance'] <= best_match['distance']:
            best_match = candidate

    if best_match['verified']:
        return best_match

    return {
        'employeeId': None,
        'verified': False,
        'distance': best_match['distance'],
        'threshold': payload.threshold,
        'confidence': best_match['confidence'],
        'antiSpoofingPassed': best_match['antiSpoofingPassed'],
        'mode': best_match['mode'],
        'detail': 'No enrolled face matched within the fallback identification threshold.',
        'metadata': best_match['metadata']
    }


def _fallback_verification(reference_path: Path, live_path: Path, threshold: float) -> dict[str, Any]:
    if cv2 is None:
        reference_hash = file_sha256(reference_path)
        live_hash = file_sha256(live_path)
        verified = reference_hash[:12] == live_hash[:12]
        distance = 0.0 if verified else 0.7
        confidence = 1.0 - distance
        return {
            'employeeId': reference_path.parent.name,
            'verified': verified,
            'distance': distance,
            'threshold': threshold,
            'confidence': confidence,
            'antiSpoofingPassed': True,
            'mode': 'hash-fallback',
            'detail': 'OpenCV unavailable; using hash fallback.',
            'metadata': {'referenceHash': reference_hash[:12], 'liveHash': live_hash[:12]}
        }

    reference = cv2.imread(str(reference_path), cv2.IMREAD_GRAYSCALE)
    live = cv2.imread(str(live_path), cv2.IMREAD_GRAYSCALE)
    if reference is None or live is None:
        return {
            'employeeId': reference_path.parent.name,
            'verified': False,
            'distance': 1.0,
            'threshold': threshold,
            'confidence': 0.0,
            'antiSpoofingPassed': False,
            'mode': 'fallback',
            'detail': 'Unable to read one of the images.',
            'metadata': {}
        }

    reference_hist = cv2.calcHist([reference], [0], None, [256], [0, 256])
    live_hist = cv2.calcHist([live], [0], None, [256], [0, 256])
    cv2.normalize(reference_hist, reference_hist)
    cv2.normalize(live_hist, live_hist)
    similarity = float(cv2.compareHist(reference_hist, live_hist, cv2.HISTCMP_CORREL))
    confidence = max(0.0, min(1.0, (similarity + 1.0) / 2.0))
    distance = 1.0 - confidence
    quality = assess_quality(live_path)
    return {
        'employeeId': reference_path.parent.name,
        'verified': distance <= threshold and quality['passed'],
        'distance': round(distance, 4),
        'threshold': threshold,
        'confidence': round(confidence, 4),
        'antiSpoofingPassed': quality['passed'],
        'mode': 'opencv-fallback',
        'detail': 'Fallback similarity comparison completed.',
        'metadata': quality
    }


def _fallback_identity(reference_path: Path, live_path: Path, employee_id: str, threshold: float) -> dict[str, Any]:
    if cv2 is None:
        reference_hash = file_sha256(reference_path)
        live_hash = file_sha256(live_path)
        verified = reference_hash[:12] == live_hash[:12]
        distance = 0.0 if verified else 0.7
        confidence = 1.0 - distance
        return {
            'employeeId': employee_id,
            'verified': verified,
            'distance': distance,
            'threshold': threshold,
            'confidence': confidence,
            'antiSpoofingPassed': True,
            'mode': 'hash-fallback',
            'detail': 'OpenCV unavailable; using hash fallback identity match.',
            'metadata': {'referenceHash': reference_hash[:12], 'liveHash': live_hash[:12]}
        }

    reference = cv2.imread(str(reference_path), cv2.IMREAD_GRAYSCALE)
    live = cv2.imread(str(live_path), cv2.IMREAD_GRAYSCALE)
    if reference is None or live is None:
        return {
            'employeeId': employee_id,
            'verified': False,
            'distance': 1.0,
            'threshold': threshold,
            'confidence': 0.0,
            'antiSpoofingPassed': False,
            'mode': 'fallback',
            'detail': 'Unable to read one of the images.',
            'metadata': {}
        }

    reference_hist = cv2.calcHist([reference], [0], None, [256], [0, 256])
    live_hist = cv2.calcHist([live], [0], None, [256], [0, 256])
    cv2.normalize(reference_hist, reference_hist)
    cv2.normalize(live_hist, live_hist)
    similarity = float(cv2.compareHist(reference_hist, live_hist, cv2.HISTCMP_CORREL))
    confidence = max(0.0, min(1.0, (similarity + 1.0) / 2.0))
    distance = 1.0 - confidence
    quality = assess_quality(live_path)
    return {
        'employeeId': employee_id,
        'verified': distance <= threshold and quality['passed'],
        'distance': round(distance, 4),
        'threshold': threshold,
        'confidence': round(confidence, 4),
        'antiSpoofingPassed': quality['passed'],
        'mode': 'opencv-fallback',
        'detail': 'Fallback identity comparison completed.',
        'metadata': quality
    }


def check_quality(payload: FaceQualityRequest) -> dict[str, Any]:
    ensure_registered_face_dir()
    temp_path = save_base64_image('quality-check', payload.image, 1)
    quality = assess_quality(temp_path)
    return {
        'faceCount': quality['faceCount'],
        'qualityScore': quality['sharpness'],
        'passed': quality['passed'],
        'mode': 'insightface' if _load_face_app() is not None else 'fallback',
        'detail': 'Quality check is based on local image inspection.'
    }


def remove_employee_face(employee_id: str) -> dict[str, Any]:
    delete_employee_directory(employee_id)
    return {
        'employeeId': employee_id,
        'status': 'DELETED'
    }


def get_face_profile(employee_id: str) -> dict[str, Any]:
    ensure_registered_face_dir()
    reference_images = [
        path for path in list_reference_images(employee_id)
        if path.name != EMBEDDINGS_FILE_NAME
    ]

    if not reference_images:
        return {
            'employeeId': employee_id,
            'exists': False,
            'registeredImages': 0,
            'embeddingCached': False,
            'updatedAt': None,
            'previews': []
        }

    latest_updated_at = max(path.stat().st_mtime for path in reference_images)

    return {
        'employeeId': employee_id,
        'exists': True,
        'registeredImages': len(reference_images),
        'embeddingCached': stored_file_exists(employee_id, EMBEDDINGS_FILE_NAME),
        'updatedAt': datetime.fromtimestamp(latest_updated_at, UTC).isoformat(),
        'previews': [encode_image_to_data_url(path) for path in reference_images[:3]]
    }
