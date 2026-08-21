import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export function authenticateRequest(request, response, next) {
    const token = request.cookies?.token || request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return response.status(401).json({ message: 'Authentication required' });
    }

    try {
        request.user = jwt.verify(token, config.jwtSecret);
        return next();
    } catch (error) {
        return response.status(401).json({ message: 'Invalid or expired session' });
    }
}

export function requireRole(...allowedRoles) {
    return (request, response, next) => {
        const roleCode = request.user?.roleCode;
        if (!roleCode || !allowedRoles.includes(roleCode)) {
            return response.status(403).json({ message: 'Insufficient permission' });
        }

        return next();
    };
}
