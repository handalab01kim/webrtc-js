const { getWorker } = require('./workerManager');

let router = null;

/**
 * Create and initialize a mediasoup router
 * @returns {Promise<Object>} The created mediasoup router
 */
async function createRouter() {
    if (router) return router;
    
    const worker = getWorker();
    if (!worker) {
        throw new Error('Worker not initialized. Call createWorker first.');
    }
    
    router = await worker.createRouter({
        mediaCodecs: [
            {
                kind: 'video',
                mimeType: 'video/VP8',
                clockRate: 90000,
                parameters: {},
            },
            {
                kind: 'audio',
                mimeType: 'audio/opus',
                clockRate: 48000,
                channels: 2,
                parameters: {},
            },
        ],
    });

    console.log('Mediasoup router created');
    
    return router;
}

/**
 * Get the current router instance
 * @returns {Object|null} The current router instance or null if not created
 */
function getRouter() {
    return router;
}

module.exports = {
    createRouter,
    getRouter
};