import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { models } from '../models/store.js';

function createToken(user) {
    return jwt.sign(
        {
            userId: user.id,
            employeeId: user.employeeId || null,
            roleCode: user.roleCode || 'STAFF',
            email: user.email
        },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn }
    );
}

export const login = asyncHandler(async (request, response) => {
    const { email, password } = request.body;

    const user = await models.User?.findOne({ where: { email } });
    if (user) {
        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) {
            return response.status(401).json({ message: 'Invalid credentials' });
        }

        const token = createToken(user);
        response.cookie('token', token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000
        });

        return response.json({
            token,
            user: {
                id: user.id,
                employeeId: user.employeeId,
                email: user.email,
                roleCode: user.roleCode || 'STAFF'
            }
        });
    }

    if (process.env.NODE_ENV !== 'production' && email === 'admin@local.dev' && password === 'Admin@123') {
        const demoUser = {
            id: 1,
            employeeId: 1,
            email,
            roleCode: 'SUPER_ADMIN'
        };

        const token = createToken(demoUser);
        response.cookie('token', token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
            maxAge: 24 * 60 * 60 * 1000
        });

        return response.json({ token, user: demoUser, demo: true });
    }

    return response.status(401).json({ message: 'Invalid credentials' });
});

export const logout = asyncHandler(async (request, response) => {
    response.clearCookie('token');
    return response.json({ message: 'Logged out successfully' });
});

export const me = asyncHandler(async (request, response) => {
    if (!request.user) {
        return response.status(401).json({ message: 'Authentication required' });
    }

    return response.json({ user: request.user });
});
