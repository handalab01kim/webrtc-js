import mediasoup from 'mediasoup';
export default async function createRouter() {
    let worker = await mediasoup.createWorker({});

    let router = await worker.createRouter({
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

    // console.log("worker":worker);
    // console.log("router":router);
    return router;
}