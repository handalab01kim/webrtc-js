const { getRouter } = require('./routerManager');
const { getProducer } = require('./producerTransportManager');

// Store consumer transports and consumers
const consumerTransports = new Map();
const consumers = new Map();

/**
 * Create a WebRTC transport for a consumer
 * @param {string} socketId - The socket ID of the consumer
 * @returns {Promise<Object>} The created consumer transport
 */
async function createConsumerTransport(socketId) {
    const router = getRouter();
    if (!router) {
        throw new Error('Router not initialized. Call createRouter first.');
    }
    
    // Create a new WebRTC transport for this consumer
    const transport = await router.createWebRtcTransport({
        listenIps: [{ ip: '127.0.0.1', announcedIp: null }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
    });

    console.log('Consumer transport created:', transport.id, 'for client:', socketId);

    // Store the transport with the socket ID
    consumerTransports.set(socketId, transport);

    // Monitor transport state
    transport.on('dtlsstatechange', (dtlsState) => {
        console.log('Consumer transport DTLS state changed to', dtlsState);
        if (dtlsState === 'closed') {
            transport.close();
        }
    });

    return transport;
}

/**
 * Connect a consumer transport
 * @param {string} socketId - The socket ID of the consumer
 * @param {Object} dtlsParameters - DTLS parameters
 * @returns {Promise<void>}
 */
async function connectConsumerTransport(socketId, dtlsParameters) {
    const transport = consumerTransports.get(socketId);
    if (!transport) {
        throw new Error('Consumer transport not found');
    }

    await transport.connect({ dtlsParameters });
    console.log('Consumer transport connected for client:', socketId);
}

/**
 * Create a consumer for receiving media
 * @param {string} socketId - The socket ID of the consumer
 * @param {Object} rtpCapabilities - RTP capabilities
 * @returns {Promise<Object>} The created consumer
 */
async function createConsumer(socketId, rtpCapabilities) {
    const router = getRouter();
    if (!router) {
        throw new Error('Router not initialized');
    }
    
    // Check if producer exists
    const producer = getProducer();
    if (!producer) {
        throw new Error('No producer available');
    }

    // Check if router can consume the producer
    if (!router.canConsume({
        producerId: producer.id,
        rtpCapabilities,
    })) {
        throw new Error('Cannot consume with current RTP capabilities');
    }

    const transport = consumerTransports.get(socketId);
    if (!transport) {
        throw new Error('Consumer transport not found');
    }

    // Create consumer
    const consumer = await transport.consume({
        producerId: producer.id,
        rtpCapabilities,
        paused: true, // Start paused, resume after client setup
    });

    // Store the consumer
    consumers.set(socketId, consumer);

    console.log('Consumer created:', consumer.id, 'for client:', socketId);

    // Handle consumer events
    consumer.on('transportclose', () => {
        console.log('Consumer transport closed for consumer:', consumer.id);
        consumer.close();
        consumers.delete(socketId);
    });

    consumer.on('producerclose', () => {
        console.log('Producer closed for consumer:', consumer.id);
        consumer.close();
        consumers.delete(socketId);
    });

    return consumer;
}

/**
 * Resume a consumer
 * @param {string} socketId - The socket ID of the consumer
 * @returns {Promise<void>}
 */
async function resumeConsumer(socketId) {
    const consumer = consumers.get(socketId);
    if (!consumer) {
        throw new Error('Consumer not found');
    }
    
    await consumer.resume();
    console.log('Consumer resumed:', consumer.id);
}

/**
 * Clean up consumer resources when a client disconnects
 * @param {string} socketId - The socket ID of the consumer
 */
function cleanupConsumer(socketId) {
    // Close and remove consumer transport
    const transport = consumerTransports.get(socketId);
    if (transport) {
        transport.close();
        consumerTransports.delete(socketId);
    }

    // Close and remove consumer
    const consumer = consumers.get(socketId);
    if (consumer) {
        consumer.close();
        consumers.delete(socketId);
    }
}

/**
 * Get a consumer by socket ID
 * @param {string} socketId - The socket ID of the consumer
 * @returns {Object|undefined} The consumer or undefined if not found
 */
function getConsumer(socketId) {
    return consumers.get(socketId);
}

/**
 * Get a consumer transport by socket ID
 * @param {string} socketId - The socket ID of the consumer
 * @returns {Object|undefined} The consumer transport or undefined if not found
 */
function getConsumerTransport(socketId) {
    return consumerTransports.get(socketId);
}

module.exports = {
    createConsumerTransport,
    connectConsumerTransport,
    createConsumer,
    resumeConsumer,
    cleanupConsumer,
    getConsumer,
    getConsumerTransport
};