import { validationResult } from 'express-validator';

export function validateRequest(request, response, next) {
    const result = validationResult(request);
    if (!result.isEmpty()) {
        return response.status(422).json({
            message: 'Validation failed',
            errors: result.array()
        });
    }

    return next();
}
