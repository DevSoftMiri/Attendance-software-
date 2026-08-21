import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { config } from './config/env.js';

export function createApp() {
    const app = express();
    const allowedOrigins = String(config.frontendUrl || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

    app.use(helmet());
    app.use(
        cors({
            origin: allowedOrigins,
            credentials: true
        })
    );
    app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    app.use(cookieParser());

    app.use('/api', routes);
    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
