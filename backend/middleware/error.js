export function notFoundHandler(request, response) {
    response.status(404).json({ message: 'Route not found' });
}

export function errorHandler(error, request, response, next) {
    const statusCode = error.statusCode || 500;
    response.status(statusCode).json({
        message: error.message || 'Internal server error'
    });
}
