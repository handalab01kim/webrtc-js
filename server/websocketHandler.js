const { getRouter } = require('./routerManager');
const { 
    createProducerTransport, 
    connectProducerTransport, 
    createProducer, 
    getProducer 
} = require('./producerTransportManager');
const { 
    createConsumerTransport, 
    connectConsumerTransport, 
    createConsumer, 
    resumeConsumer, 
    cleanupConsumer 
} = require('./consumerTransportManager');

/**
 * Initialize WebSocket handlers
 * @param {Object} io - Socket.io instance
 */
function initializeWebSocketHandlers(io) {
    io.on('connection', async (socket) => {
        console.log('Client connected:', socket.id);

        // Clean up on disconnect
        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
            cleanupConsumer(socket.id);
        });

        // Return router RTP capabilities
        socket.on('getRtpCapabilities', (callback) => {
            const router = getRouter();
            if (!router) {
                return callback({ error: 'Router not initialized' });
            }
            
            console.log('Get RTP Capabilities');
            callback(router.rtpCapabilities);
        });

        // Create producer transport
        socket.on('createProducerTransport', async (callback) => {
            try {
                const transport = await createProducerTransport();
                
                // Return transport parameters to client
                callback({
                    id: transport.id,
                    iceParameters: transport.iceParameters,
                    iceCandidates: transport.iceCandidates,
                    dtlsParameters: transport.dtlsParameters,
                });
            } catch (error) {
                console.error('Error creating producer transport:', error);
                callback({ error: error.message });
            }
        });

        // Connect producer transport
        socket.on('connectProducerTransport', async ({ dtlsParameters }, callback) => {
            try {
                await connectProducerTransport(dtlsParameters);
                callback({ success: true });
            } catch (error) {
                console.error('Error connecting producer transport:', error);
                callback({ error: error.message });
            }
        });

        // Start producing (sending media)
        socket.on('produce', async ({ kind, rtpParameters }, callback) => {
            try {
                const producer = await createProducer({ kind, rtpParameters });
                callback({ id: producer.id });
            } catch (error) {
                console.error('Error producing:', error);
                callback({ error: error.message });
            }
        });

        // Create consumer transport
        socket.on('createConsumerTransport', async (callback) => {
            try {
                const transport = await createConsumerTransport(socket.id);
                
                // Return transport parameters to client
                callback({
                    id: transport.id,
                    iceParameters: transport.iceParameters,
                    iceCandidates: transport.iceCandidates,
                    dtlsParameters: transport.dtlsParameters,
                });
            } catch (error) {
                console.error('Error creating consumer transport:', error);
                callback({ error: error.message });
            }
        });

        // Connect consumer transport
        socket.on('connectConsumerTransport', async ({ dtlsParameters }, callback) => {
            try {
                await connectConsumerTransport(socket.id, dtlsParameters);
                callback({ success: true });
            } catch (error) {
                console.error('Error connecting consumer transport:', error);
                callback({ error: error.message });
            }
        });

        // Start consuming (receiving media)
        socket.on('consume', async ({ rtpCapabilities }, callback) => {
            try {
                const consumer = await createConsumer(socket.id, rtpCapabilities);
                
                // Return consumer parameters to client
                callback({
                    id: consumer.id,
                    producerId: getProducer().id,
                    kind: consumer.kind,
                    rtpParameters: consumer.rtpParameters,
                });
                
                // Resume the consumer
                await resumeConsumer(socket.id);
                
            } catch (error) {
                console.error('Error consuming:', error);
                callback({ error: error.message });
            }
        });
    });
}

module.exports = {
    initializeWebSocketHandlers
};