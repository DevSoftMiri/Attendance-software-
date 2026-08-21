import axios from 'axios';
import { config } from '../config/env.js';

const faceApi = axios.create({
    baseURL: config.faceServiceUrl,
    timeout: 30000
});

function rethrowFaceServiceError(error) {
    const statusCode = error?.response?.status || 500;
    const upstreamMessage =
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        error?.message ||
        'Face service request failed';

    const wrappedError = new Error(upstreamMessage);
    wrappedError.statusCode = statusCode;
    throw wrappedError;
}

export async function verifyFace(payload) {
    try {
        const { data } = await faceApi.post('/face/verify', payload);
        return data;
    } catch (error) {
        rethrowFaceServiceError(error);
    }
}

export async function identifyFace(payload) {
    try {
        const { data } = await faceApi.post('/face/identify', payload);
        return data;
    } catch (error) {
        rethrowFaceServiceError(error);
    }
}

export async function enrolFace(payload) {
    try {
        const { data } = await faceApi.post('/face/enrol', payload);
        return data;
    } catch (error) {
        rethrowFaceServiceError(error);
    }
}

export async function checkFaceQuality(payload) {
    try {
        const { data } = await faceApi.post('/face/check-quality', payload);
        return data;
    } catch (error) {
        rethrowFaceServiceError(error);
    }
}

export async function removeFaceProfile(employeeId) {
    try {
        const { data } = await faceApi.delete(`/face/${employeeId}`);
        return data;
    } catch (error) {
        rethrowFaceServiceError(error);
    }
}

export async function getFaceProfile(employeeId) {
    try {
        const { data } = await faceApi.get(`/face/${employeeId}`);
        return data;
    } catch (error) {
        rethrowFaceServiceError(error);
    }
}
