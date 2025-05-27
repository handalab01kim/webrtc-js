const { getRouter } = require('./routerManager');

let producerTransport = null;
let producer = null;

/**
 * Create a WebRTC transport for producers
 * @returns {Promise<Object>} The created producer transport
 */
async function createProducerTransport() {
    const router = getRouter();
    if (!router) {
        throw new Error('Router not initialized. Call createRouter first.');
    }
    
    // Create a new WebRTC transport
    const transport = await router.createWebRtcTransport({
        listenIps: [{ ip: '127.0.0.1', announcedIp: null }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
    });

    console.log('Producer transport created:', transport.id);

    // Store the transport
    producerTransport = transport;

    // Monitor transport state
    transport.on('dtlsstatechange', (dtlsState) => {
        console.log('Producer transport DTLS state changed to', dtlsState);
        if (dtlsState === 'closed') {
            transport.close();
        }
    });

    return transport;
}

/**
 * Connect the producer transport
 * @param {Object} dtlsParameters - DTLS parameters
 * @returns {Promise<void>}
 */
async function connectProducerTransport(dtlsParameters) {
    if (!producerTransport) {
        throw new Error('Producer transport not created');
    }
    
    await producerTransport.connect({ dtlsParameters });
    console.log('Producer transport connected');
}

/**
 * Create a producer for sending media
 * @param {Object} options - Producer options
 * @param {string} options.kind - Media kind (audio/video)
 * @param {Object} options.rtpParameters - RTP parameters
 * @returns {Promise<Object>} The created producer
 */
async function createProducer({ kind, rtpParameters }) {
    if (!producerTransport) {
        throw new Error('Producer transport not created');
    }
    
    // Create producer
    producer = await producerTransport.produce({ kind, rtpParameters });
    console.log('Producer created:', producer.id, 'kind:', kind);

    // Handle producer events
    producer.on('transportclose', () => {
        console.log('Producer transport closed');
        producer = null;
    });

    return producer;
}

/**
 * Get the current producer transport
 * @returns {Object|null} The current producer transport or null if not created
 */
function getProducerTransport() {
    return producerTransport;
}

/**
 * Get the current producer
 * @returns {Object|null} The current producer or null if not created
 */
function getProducer() {
    return producer;
}

module.exports = {
    createProducerTransport,
    connectProducerTransport,
    createProducer,
    getProducerTransport,
    getProducer
};