import axios from 'axios';
import { config } from '../config/env.js';

const faceApi = axios.create({
    baseURL: config.faceServiceUrl,
    timeout: 30000
});

export async function verifyFace(payload) {
    const { data } = await faceApi.post('/face/verify', payload);
    return data;
}

export async function identifyFace(payload) {
    const { data } = await faceApi.post('/face/identify', payload);
    return data;
}

export async function enrolFace(payload) {
    const { data } = await faceApi.post('/face/enrol', payload);
    return data;
}

export async function checkFaceQuality(payload) {
    const { data } = await faceApi.post('/face/check-quality', payload);
    return data;
}

export async function removeFaceProfile(employeeId) {
    const { data } = await faceApi.delete(`/face/${employeeId}`);
    return data;
}

export async function getFaceProfile(employeeId) {
    const { data } = await faceApi.get(`/face/${employeeId}`);
    return data;
}
