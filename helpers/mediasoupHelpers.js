const mediasoup = require('mediasoup');

let worker;
const routers = new Map();

async function createWorker() {
    if (worker) return worker;
    worker = await mediasoup.createWorker({
        logLevel: 'warn',
        rtcMinPort: 10000,
        rtcMaxPort: 10100,
    });
    console.log('mediasoup Worker created');
    return worker;
}

// In-memory storage for room data
const roomData = new Map();

function getRoomData(roomId) {
    if (!roomData.has(roomId)) {
        roomData.set(roomId, {
            speakers: new Set(),
            listeners: new Set(),
            micQueue: new Array(),
            youtubeLink: { userId: '', link: '', paused: false },
            spotifyTrack: { userId: '', uri: '', paused: false },
            holdMic: new Set(),
        });
    }
    return roomData.get(roomId);
}

async function createRouter(roomId) {
    if (routers.has(roomId)) return routers.get(roomId);

    const worker = await createWorker();
    const router = await worker.createRouter({
        mediaCodecs: [
            {
                kind: 'audio',
                mimeType: 'audio/opus',
                clockRate: 48000,
                channels: 2,
            },
        ],
    });
    routers.set(roomId, router);
    return router;
}

async function createWebRtcTransport(roomId) {
    const router = await createRouter(roomId);
    const transport = await router.createWebRtcTransport({
        listenIps: [
            {
                ip: '0.0.0.0',
                announcedIp: process.env.ANNOUNCED_IP || '127.0.0.1',
            },
        ],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
    });

    return {
        transport,
        params: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
        },
    };
}

async function createProducer(roomId, transportId, rtpParameters) {
    const router = await createRouter(roomId);
    const transport = router.getTransport(transportId);
    if (!transport) throw new Error('Transport not found');

    const producer = await transport.produce({ kind: 'audio', rtpParameters });
    return producer;
}

async function createConsumer(roomId, transportId, producerId, rtpCapabilities) {
    const router = await createRouter(roomId);
    const transport = router.getTransport(transportId);
    if (!transport) throw new Error('Transport not found');

    if (!router.canConsume({ producerId, rtpCapabilities })) {
        throw new Error('Cannot consume');
    }

    const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: true, // start paused
    });

    return {
        consumer,
        params: {
            producerId: producerId,
            id: consumer.id,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
            type: consumer.type,
            producerPaused: consumer.producerPaused,
        },
    };
}

async function closeTransport(roomId, transportId) {
    const router = routers.get(roomId);
    if (!router) return;

    const transport = router.getTransport(transportId);
    if (!transport) return;

    await transport.close();
}

async function closeProducer(roomId, producerId) {
    const router = routers.get(roomId);
    if (!router) return;

    const producer = router.getProducer(producerId);
    if (!producer) return;

    await producer.close();
}

async function closeConsumer(roomId, consumerId) {
    const router = routers.get(roomId);
    if (!router) return;

    const consumer = router.getConsumer(consumerId);
    if (!consumer) return;

    await consumer.close();
}

module.exports = {
    createWebRtcTransport,
    createProducer,
    createConsumer,
    closeTransport,
    closeProducer,
    closeConsumer,
    getRoomData,
};
