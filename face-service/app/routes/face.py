from fastapi import APIRouter

from ..models.schemas import FaceEnrolRequest, FaceIdentifyRequest, FaceQualityRequest, FaceVerifyRequest
from ..services.face_service import check_quality, get_face_profile, identify_face, register_faces, remove_employee_face, verify_face

router = APIRouter(prefix='/face', tags=['face'])


@router.post('/enrol')
def enrol_face(payload: FaceEnrolRequest):
    return register_faces(payload)


@router.post('/verify')
def verify_employee_face(payload: FaceVerifyRequest):
    return verify_face(payload)


@router.post('/identify')
def identify_employee_face(payload: FaceIdentifyRequest):
    return identify_face(payload)


@router.post('/check-quality')
def check_face_quality(payload: FaceQualityRequest):
    return check_quality(payload)


@router.get('/{employee_id}')
def get_employee_face(employee_id: str):
    return get_face_profile(employee_id)


@router.delete('/{employee_id}')
def delete_employee_face(employee_id: str):
    return remove_employee_face(employee_id)
