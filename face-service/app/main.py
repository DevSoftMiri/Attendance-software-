from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .routes.face import router as face_router

load_dotenv(Path(__file__).resolve().parents[1] / '.env')

app = FastAPI(title='Attendance Face Service', version='1.0.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*']
)

app.include_router(face_router)


def health_payload():
    return {'status': 'ok', 'service': 'face-service'}


@app.get('/')
def root_health_check():
    return health_payload()


@app.get('/health')
def health_check():
    return health_payload()
