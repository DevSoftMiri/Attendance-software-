from __future__ import annotations

import base64
import hashlib
import io
import os
import shutil
import tempfile
from pathlib import Path
from typing import Iterable

from PIL import Image

try:
    from supabase import Client, create_client
except Exception:  # pragma: no cover - optional dependency until configured
    Client = None  # type: ignore[assignment]
    create_client = None  # type: ignore[assignment]

ROOT_DIR = Path(__file__).resolve().parents[2]
REGISTERED_FACES_DIR = ROOT_DIR / 'registered_faces'
LOCAL_CACHE_DIR = Path(tempfile.gettempdir()) / 'attendance-face-cache'
TRANSIENT_DIRECTORIES = {'identify-check', 'quality-check', 'verify-check'}

_supabase_client: Client | None = None


def _supabase_url() -> str:
    return os.getenv('SUPABASE_URL', '').strip()


def _supabase_key() -> str:
    return os.getenv('SUPABASE_SERVICE_ROLE_KEY', '').strip() or os.getenv('SUPABASE_KEY', '').strip()


def _supabase_bucket_name() -> str:
    return os.getenv('SUPABASE_BUCKET', 'face-profiles').strip() or 'face-profiles'


def use_supabase_storage() -> bool:
    return bool(_supabase_url() and _supabase_key())


def _is_transient_employee(employee_id: str) -> bool:
    return str(employee_id) in TRANSIENT_DIRECTORIES


def _get_supabase_client() -> Client:
    global _supabase_client

    if not use_supabase_storage():
        raise RuntimeError('Supabase storage is not configured')

    if create_client is None:
        raise RuntimeError('supabase package is not installed')

    if _supabase_client is None:
        _supabase_client = create_client(_supabase_url(), _supabase_key())

    return _supabase_client


def _storage_bucket():
    return _get_supabase_client().storage.from_(_supabase_bucket_name())


def _storage_object_path(employee_id: str, file_name: str) -> str:
    return f'{employee_id}/{file_name}'


def _ensure_local_cache_dir(employee_id: str) -> Path:
    base_dir = REGISTERED_FACES_DIR if not use_supabase_storage() else LOCAL_CACHE_DIR
    employee_dir = base_dir / str(employee_id)
    employee_dir.mkdir(parents=True, exist_ok=True)
    return employee_dir


def _write_local_cache_file(employee_id: str, file_name: str, file_bytes: bytes) -> Path:
    employee_dir = _ensure_local_cache_dir(employee_id)
    local_path = employee_dir / file_name
    local_path.write_bytes(file_bytes)
    return local_path


def _list_storage_entries(path: str = '') -> list[dict]:
    response = _storage_bucket().list(
        path,
        {
            'limit': 1000,
            'offset': 0,
            'sortBy': {'column': 'name', 'order': 'asc'}
        }
    )
    return response if isinstance(response, list) else []


def _storage_entry_name(entry: object) -> str | None:
    if isinstance(entry, dict):
        return entry.get('name')
    return getattr(entry, 'name', None)


def _upload_bytes(employee_id: str, file_name: str, file_bytes: bytes, content_type: str) -> None:
    _storage_bucket().upload(
        path=_storage_object_path(employee_id, file_name),
        file=file_bytes,
        file_options={
            'content-type': content_type,
            'upsert': 'true'
        }
    )


def _download_bytes(employee_id: str, file_name: str) -> bytes:
    return _storage_bucket().download(_storage_object_path(employee_id, file_name))


def ensure_employee_directory(employee_id: str) -> Path:
    return _ensure_local_cache_dir(employee_id)


def decode_base64_image(image_payload: str) -> bytes:
    if ',' in image_payload:
        image_payload = image_payload.split(',', 1)[1]
    return base64.b64decode(image_payload)


def encode_image_to_data_url(path: Path) -> str:
    image_bytes = path.read_bytes()
    encoded = base64.b64encode(image_bytes).decode('utf-8')
    return f'data:image/jpeg;base64,{encoded}'


def save_base64_image(employee_id: str, image_payload: str, index: int, *, persist: bool = True) -> Path:
    image_bytes = decode_base64_image(image_payload)
    file_name = f'image_{index:02d}.jpg'

    if persist and use_supabase_storage() and not _is_transient_employee(employee_id):
        _upload_bytes(employee_id, file_name, image_bytes, 'image/jpeg')

    return _write_local_cache_file(employee_id, file_name, image_bytes)


def list_reference_images(employee_id: str) -> list[Path]:
    if use_supabase_storage() and not _is_transient_employee(employee_id):
        local_paths: list[Path] = []
        for entry in _list_storage_entries(str(employee_id)):
            file_name = _storage_entry_name(entry)
            if not file_name:
                continue
            local_paths.append(_write_local_cache_file(employee_id, file_name, _download_bytes(employee_id, file_name)))
        return sorted(local_paths)

    employee_dir = REGISTERED_FACES_DIR / str(employee_id)
    if not employee_dir.exists():
        return []
    return sorted([path for path in employee_dir.glob('*') if path.is_file()])


def list_registered_employee_ids() -> list[str]:
    if use_supabase_storage():
        employee_ids: list[str] = []
        for entry in _list_storage_entries():
            name = _storage_entry_name(entry)
            if name and name not in TRANSIENT_DIRECTORIES:
                employee_ids.append(str(name))
        return sorted(employee_ids)

    ensure_registered_face_dir()
    return sorted(
        [
            path.name for path in REGISTERED_FACES_DIR.iterdir()
            if path.is_dir() and path.name not in TRANSIENT_DIRECTORIES
        ]
    )


def delete_employee_directory(employee_id: str) -> None:
    if use_supabase_storage() and not _is_transient_employee(employee_id):
        object_paths = [
            _storage_object_path(employee_id, file_name)
            for file_name in [_storage_entry_name(entry) for entry in _list_storage_entries(str(employee_id))]
            if file_name
        ]
        if object_paths:
            _storage_bucket().remove(object_paths)

        shutil.rmtree(LOCAL_CACHE_DIR / str(employee_id), ignore_errors=True)
        return

    employee_dir = REGISTERED_FACES_DIR / str(employee_id)
    if employee_dir.exists():
        for path in employee_dir.glob('*'):
            if path.is_file():
                path.unlink()
        employee_dir.rmdir()


def save_text_file(employee_id: str, file_name: str, content: str, *, content_type: str = 'application/json') -> Path:
    content_bytes = content.encode('utf-8')

    if use_supabase_storage() and not _is_transient_employee(employee_id):
        _upload_bytes(employee_id, file_name, content_bytes, content_type)

    return _write_local_cache_file(employee_id, file_name, content_bytes)


def read_text_file(employee_id: str, file_name: str) -> str | None:
    if use_supabase_storage() and not _is_transient_employee(employee_id):
        try:
            content_bytes = _download_bytes(employee_id, file_name)
            _write_local_cache_file(employee_id, file_name, content_bytes)
            return content_bytes.decode('utf-8')
        except Exception:
            return None

    local_path = REGISTERED_FACES_DIR / str(employee_id) / file_name
    if not local_path.exists():
        return None
    return local_path.read_text(encoding='utf-8')


def stored_file_exists(employee_id: str, file_name: str) -> bool:
    if use_supabase_storage() and not _is_transient_employee(employee_id):
        return any(_storage_entry_name(entry) == file_name for entry in _list_storage_entries(str(employee_id)))

    return (REGISTERED_FACES_DIR / str(employee_id) / file_name).exists()


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_image(path: Path) -> Image.Image:
    return Image.open(io.BytesIO(path.read_bytes())).convert('RGB')


def image_quality(path: Path) -> dict:
    image = load_image(path)
    width, height = image.size
    return {
        'width': width,
        'height': height,
        'sharpness': round(min(width, height) / max(width, height), 3),
        'brightness': round(sum(image.convert('L').resize((1, 1)).getpixel((0, 0)) for _ in range(1)) / 255, 3)
    }


def ensure_registered_face_dir() -> None:
    target_dir = LOCAL_CACHE_DIR if use_supabase_storage() else REGISTERED_FACES_DIR
    target_dir.mkdir(parents=True, exist_ok=True)
