// const root = 'https://127.0.0.1:9601';
const root = 'https://185.203.118.57:9601';

//index.js
const io = require('socket.io-client');
const mediasoupClient = require('mediasoup-client');
const $ = require('jquery');
var ConsoleLogHTML = require('console-log-html');

const socket = io(root, {
    path: '/mic-io',
});

let device;
let rtpCapabilities;
let producerTransport;
let consumerTransport;
let producer;
let consumer;

let myProducerId = null;

let producersIds = [];

// https://mediasoup.org/documentation/v3/mediasoup-client/api/#ProducerOptions
// https://mediasoup.org/documentation/v3/mediasoup-client/api/#transport-produce
let params = {
    // mediasoup params
    encodings: [
        {
            rid: 'r0',
            maxBitrate: 100000,
            scalabilityMode: 'S1T3',
        },
        {
            rid: 'r1',
            maxBitrate: 300000,
            scalabilityMode: 'S1T3',
        },
        {
            rid: 'r2',
            maxBitrate: 900000,
            scalabilityMode: 'S1T3',
        },
    ],
    // https://mediasoup.org/documentation/v3/mediasoup-client/api/#ProducerCodecOptions
    //   codecOptions: {
    //     videoGoogleStartBitrate: 1000
    //   }
};

const streamSuccess = async (stream) => {
    localAudio.srcObject = stream;
    const track = stream.getAudioTracks()[0];
    params = {
        track,
        // ...params
    };
    createSendTransport();
};

const getLocalStream = () => {
    btnStartProduce.disabled = true;
    navigator.getUserMedia(
        {
            audio: true,
            video: false,
        },
        streamSuccess,
        (error) => {
            btnStartProduce.disabled = false;
            console.log(error.message);
        },
    );
};

// A device is an endpoint connecting to a Router on the
// server side to send/recive media
const createDevice = async () => {
    try {
        device = new mediasoupClient.Device();

        // https://mediasoup.org/documentation/v3/mediasoup-client/api/#device-load
        // Loads the device with RTP capabilities of the Router (server side)
        await device.load({
            // see getRtpCapabilities() below
            routerRtpCapabilities: rtpCapabilities,
        });

        console.log('RTP Capabilities', device.rtpCapabilities);

        btnStartProduce.disabled = false;

        loadExistRemoteProducers();
    } catch (error) {
        console.log(error);
        if (error.name === 'UnsupportedError') console.warn('browser not supported');
    }
};

const getRtpCapabilities = () => {
    // make a request to the server for Router RTP Capabilities
    // see server's socket.on('getRtpCapabilities', ...)
    // the server sends back data object which contains rtpCapabilities
    socket.emit('getRtpCapabilities', (data) => {
        console.log(`Router RTP Capabilities... ${data.rtpCapabilities}`);
        producersIds = data.producersIds;
        // we assign to local variable and will be used when
        // loading the client Device (see createDevice above)
        rtpCapabilities = data.rtpCapabilities;

        createDevice();
    });
};

const createSendTransport = () => {
    // see server's socket.on('createWebRtcTransport', sender?, ...)
    // this is a call from Producer, so sender = true
    socket.emit('createWebRtcTransport', { sender: true }, ({ params }) => {
        // The server sends back params needed
        // to create Send Transport on the client side
        if (params.error) {
            console.log(params.error);
            return;
        }

        console.log(params);

        // creates a new WebRTC Transport to send media
        // based on the server's producer transport params
        // https://mediasoup.org/documentation/v3/mediasoup-client/api/#TransportOptions
        producerTransport = device.createSendTransport(params);

        // https://mediasoup.org/documentation/v3/communication-between-client-and-server/#producing-media
        // this event is raised when a first call to transport.produce() is made
        // see connectSendTransport() below
        producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
            try {
                // Signal local DTLS parameters to the server side transport
                // see server's socket.on('transport-connect', ...)
                await socket.emit('transport-connect', {
                    dtlsParameters,
                });

                // Tell the transport that parameters were transmitted.
                callback();
            } catch (error) {
                errback(error);
            }
        });

        producerTransport.on('produce', async (parameters, callback, errback) => {
            console.log(parameters);

            try {
                // tell the server to create a Producer
                // with the following parameters and produce
                // and expect back a server side producer id
                // see server's socket.on('transport-produce', ...)
                await socket.emit(
                    'transport-produce',
                    {
                        kind: parameters.kind,
                        rtpParameters: parameters.rtpParameters,
                        appData: parameters.appData,
                    },
                    ({ id }) => {
                        // Tell the transport that parameters were transmitted and provide it with the
                        // server side producer's id.
                        callback({ id });
                        myProducerId = id;
                        socket.emit('producer-ready', {});
                    },
                );
            } catch (error) {
                errback(error);
            }
        });

        connectSendTransport();
    });
};

const connectSendTransport = async () => {
    // we now call produce() to instruct the producer transport
    // to send media to the Router
    // https://mediasoup.org/documentation/v3/mediasoup-client/api/#transport-produce
    // this action will trigger the 'connect' and 'produce' events above
    producer = await producerTransport.produce(params);

    producer.on('trackended', () => {
        console.log('track ended');

        // close video track
    });

    producer.on('transportclose', () => {
        console.log('transport ended');

        // close video track
    });
};

///
///
///
/// Receive
///
///
///

const createRecvTransport = async (producerId) => {
    // see server's socket.on('consume', sender?, ...)
    // this is a call from Consumer, so sender = false
    await socket.emit('createWebRtcTransport', { sender: false }, ({ params }) => {
        // The server sends back params needed
        // to create Send Transport on the client side
        if (params.error) {
            console.log(params.error);
            return;
        }

        console.log(params);

        // creates a new WebRTC Transport to receive media
        // based on server's consumer transport params
        // https://mediasoup.org/documentation/v3/mediasoup-client/api/#device-createRecvTransport
        consumerTransport = device.createRecvTransport(params);

        // https://mediasoup.org/documentation/v3/communication-between-client-and-server/#producing-media
        // this event is raised when a first call to transport.produce() is made
        // see connectRecvTransport() below
        consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
            try {
                // Signal local DTLS parameters to the server side transport
                // see server's socket.on('transport-recv-connect', ...)
                await socket.emit('transport-recv-connect', {
                    dtlsParameters,
                    transportId: params.id,
                });

                // Tell the transport that parameters were transmitted.
                callback();
            } catch (error) {
                // Tell the transport that something was wrong
                errback(error);
            }
        });

        consumerTransport.on('disconnect', async () => {
            alert('didid');
        });

        connectRecvTransport(params.id, producerId);
    });
};

const connectRecvTransport = async (transportId, producerId) => {
    // for consumer, we need to tell the server first
    // to create a consumer based on the rtpCapabilities and consume
    // if the router can consume, it will send back a set of params as below
    console.log('connectRecvTransport');
    await socket.emit(
        'consume',
        {
            rtpCapabilities: device.rtpCapabilities,
            transportId,
            producerId,
        },
        async ({ params }) => {
            if (params.error) {
                console.log('Cannot Consume');
                return;
            }

            console.log(params);
            // then consume with the local consumer transport
            // which creates a consumer
            consumer = await consumerTransport.consume({
                id: params.id,
                producerId: params.producerId,
                kind: params.kind,
                rtpParameters: params.rtpParameters,
            });

            // destructure and retrieve the video track from the producer
            const { track } = consumer;
            let audio = $(`<audio id="remote${producerId}" autoplay controls></audio>`);
            $('.remote-audio-box').append(audio);
            audio = $('.remote-audio-box').find(`#remote${producerId}`)[0];
            audio.srcObject = new MediaStream([track]);

            // the server consumer started with media paused
            // so we need to inform the server to resume
            socket.emit('consumer-resume', { transportId });
        },
    );
};

const startProduce = () => {
    getLocalStream();
};

const loadExistRemoteProducers = () => {
    producersIds.forEach((producerId) => {
        loadRemoteProducer(producerId);
    });
};

const loadRemoteProducer = (producerId) => {
    if (!device) return;
    if (producerId != myProducerId) createRecvTransport(producerId);
};

socket.on('new-user', ({ producerId }) => {
    console.log('new user', producerId);
    loadRemoteProducer(producerId);
});

socket.on('dis-user', ({ producerId }) => {
    console.log('dis user', producerId);
    $('.remote-audio-box').find(`#remote${producerId}`).remove();
});

btnStartProduce.addEventListener('click', startProduce);
btnStartProduce.disabled = true;

$(() => {
    console.log(`
    ---------------------------------
    ---------------------------------
    ${location.hash}
    ---------------------------------
    ---------------------------------
    `);
    getRtpCapabilities();

    ConsoleLogHTML.connect(document.getElementById('myULContainer'));
});
