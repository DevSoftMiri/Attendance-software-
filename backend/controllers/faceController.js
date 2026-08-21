import { asyncHandler } from '../utils/asyncHandler.js';
import { enrolFace, checkFaceQuality, getFaceProfile, removeFaceProfile, verifyFace } from '../services/faceService.js';

export const enrol = asyncHandler(async (request, response) => {
    const result = await enrolFace(request.body);
    return response.status(201).json(result);
});

export const verify = asyncHandler(async (request, response) => {
    const result = await verifyFace(request.body);
    return response.json(result);
});

export const quality = asyncHandler(async (request, response) => {
    const result = await checkFaceQuality(request.body);
    return response.json(result);
});

export const profile = asyncHandler(async (request, response) => {
    const result = await getFaceProfile(request.params.employeeId);
    return response.json(result);
});

export const remove = asyncHandler(async (request, response) => {
    const result = await removeFaceProfile(request.params.employeeId);
    return response.json(result);
});
