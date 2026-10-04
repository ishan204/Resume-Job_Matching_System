"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
function errorHandler(err, req, res, next) {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    console.error(`[API Error] ${req.method} ${req.url} - ${statusCode}: ${message}`, err.details || '');
    res.status(statusCode).json({
        success: false,
        error: {
            message,
            statusCode,
            details: err.details || null,
            path: req.originalUrl,
            timestamp: new Date().toISOString()
        }
    });
}
