const mediasoup = require('mediasoup');

let worker = null;

/**
 * Create and initialize a mediasoup worker
 * @returns {Promise<Object>} The created mediasoup worker
 */
async function createWorker() {
    if (worker) return worker;
    
    worker = await mediasoup.createWorker({
        logLevel: 'warn',
        rtcMinPort: 10000,
        rtcMaxPort: 10100,
    });

    console.log('Mediasoup worker created');
    
    // Handle worker exit
    worker.on('died', () => {
        console.error('Mediasoup worker died, exiting in 2 seconds...');
        setTimeout(() => process.exit(1), 2000);
    });
    
    return worker;
}

/**
 * Get the current worker instance
 * @returns {Object|null} The current worker instance or null if not created
 */
function getWorker() {
    return worker;
}

module.exports = {
    createWorker,
    getWorker
};