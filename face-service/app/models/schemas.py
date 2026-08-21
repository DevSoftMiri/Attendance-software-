from pydantic import BaseModel, Field
from typing import List, Optional, Any


class FaceEnrolRequest(BaseModel):
    employee_id: str = Field(alias='employeeId')
    images: List[str] = Field(default_factory=list)
    detector: str = 'opencv'
    model_name: str = Field(default='Facenet512', alias='modelName')


class FaceVerifyRequest(BaseModel):
    employee_id: str = Field(alias='employeeId')
    image: str
    threshold: float = 0.4
    detector: str = 'opencv'
    model_name: str = Field(default='Facenet512', alias='modelName')


class FaceIdentifyRequest(BaseModel):
    image: str
    threshold: float = 0.4
    detector: str = 'opencv'
    model_name: str = Field(default='Facenet512', alias='modelName')


class FaceQualityRequest(BaseModel):
    image: str
    detector: str = 'opencv'


class FaceProfileResponse(BaseModel):
    employee_id: str
    registered_images: int
    quality_scores: List[float]
    embedding_references: List[str]
    status: str
    mode: str
    detail: Optional[str] = None


class FaceVerificationResponse(BaseModel):
    employee_id: str
    verified: bool
    distance: Optional[float] = None
    threshold: Optional[float] = None
    confidence: Optional[float] = None
    anti_spoofing_passed: bool = True
    mode: str = 'fallback'
    detail: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class FaceIdentificationResponse(BaseModel):
    employee_id: Optional[str] = None
    verified: bool
    distance: Optional[float] = None
    threshold: Optional[float] = None
    confidence: Optional[float] = None
    anti_spoofing_passed: bool = True
    mode: str = 'fallback'
    detail: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)
