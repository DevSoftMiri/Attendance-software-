import dotenv from 'dotenv';

dotenv.config();

export const config = {
    port: Number(process.env.PORT || 5000),
    databaseUrl: process.env.DATABASE_URL || '',
    jwtSecret: process.env.JWT_SECRET || 'replace-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    faceServiceUrl: process.env.FACE_SERVICE_URL || 'http://localhost:8001'
};
