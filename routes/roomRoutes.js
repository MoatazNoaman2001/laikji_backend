const express = require('express');
const helpers = require('../helpers/helpers');
const enums = require('../helpers/enums');
const groupModel = require('../models/groupModel');
const roomModel = require('../models/roomModel');
const userModel = require('../models/userModal');
const { getSettings, hexToXRgb } = require('../helpers/tools');
const router = express.Router();
const mediasoup = require('mediasoup');
const memberModal = require('../models/memberModal');
const registeredUserModal = require('../models/registeredUserModal');
const roomUsersModel = require('../models/roomUsersModel');
var ObjectId = require('mongoose').Types.ObjectId;

router.get('/all', async (req, res) => {
    var response = [];
    const settings = await getSettings();
    try {
        var grbs = await groupModel.find().sort({
            order: 'descending',
        });
        const golden_rooms = [];
        let golden_rooms_users_count = 0;
        const special_rooms = [];
        let special_rooms_users_count = 0;
        const meeting_rooms = [];
        let meeting_rooms_users_count = 0;
        const all_rooms = [];
        let all_rooms_users_count = 0;

        await Promise.all(
            grbs.map(async (item) => {
                var rooms = await roomModel.find({
                    groupRef: item._id,
                });

                var res_item = {
                    _id: item._id,
                    name: item.name,
                    type: item.type,
                    icon: item.icon ? process.env.mediaUrl + item.icon : null,
                    background: item.background,
                    inside_style: item.inside_style,
                    order: item.order,
                    users_count: 0,
                };
                var res_rooms = [];
                rooms.map(async (element) => {
                    const r = await helpers.get_room_small(element, item, settings);

                    if (!r.isMeeting) {
                        var u_in_room = global.rooms_users[r._id];

                        if (u_in_room) {
                            r.users_count = global.rooms_users[r._id].length;
                        } else {
                            r.users_count = 0;
                        }

                        res_item.users_count += r.users_count;
                        all_rooms_users_count += r.users_count;

                        if (r.isSpecial) {
                            special_rooms.push(r);
                            special_rooms_users_count += r.users_count;
                        }

                        if (r.isGold) {
                            golden_rooms.push(r);
                            golden_rooms_users_count += r.users_count;
                        }

                        all_rooms.push(r);
                        res_rooms.push(r);
                    } else {
                        if (r.isMeeting) {
                            meeting_rooms.push(r);
                            meeting_rooms_users_count += r.users_count;
                        }
                    }
                });

                let g_bg = item.background;
                let g_fnt = '255|255|255';
                if (item.type == enums.groupsTypes.gold) {
                    g_bg = hexToXRgb(settings.rgb_gold_group_bg) || item.background;
                    g_fnt = hexToXRgb(settings.rgb_gold_group_fnt) || '255|255|255';
                }

                if (item.type == enums.groupsTypes.special) {
                    g_bg = hexToXRgb(settings.rgb_special_group_bg) || item.background;
                    g_fnt = hexToXRgb(settings.rgb_special_group_fnt) || '255|255|255';
                }

                if (item.type == enums.groupsTypes.meeting) {
                    g_bg = hexToXRgb(settings.rgb_meet_group_bg) || item.background;
                    g_fnt = hexToXRgb(settings.rgb_meet_group_fnt) || '255|255|255';
                }

                if (item.type == enums.groupsTypes.all) {
                    g_bg = hexToXRgb(settings.rgb_all_group_bg) || item.background;
                    g_fnt = hexToXRgb(settings.rgb_all_group_fnt) || '255|255|255';
                }

                if (item.type == enums.groupsTypes.country) {
                    g_bg = hexToXRgb(settings.rgb_country_group_bg) || item.background;
                    g_fnt = hexToXRgb(settings.rgb_country_group_fnt) || '255|255|255';
                }

                if (item.type == enums.groupsTypes.support) {
                    g_bg = hexToXRgb(settings.rgb_support_group_bg) || item.background;
                    g_fnt = hexToXRgb(settings.rgb_support_group_fnt) || '255|255|255';
                }

                if (item.type == enums.groupsTypes.learning) {
                    g_bg = hexToXRgb(settings.rgb_learning_group_bg) || item.background;
                    g_fnt = hexToXRgb(settings.rgb_learning_group_fnt) || '255|255|255';
                }
                res_item.font = g_fnt;
                res_item.background = g_bg;
                res_item.rooms = res_rooms;
                response.push(res_item);
            }),
        );

        let golden_gr = response.find((g) => g.type == enums.groupsTypes.gold);
        if (golden_gr) {
            golden_gr.rooms = golden_rooms;
            golden_gr.users_count = golden_rooms_users_count;
        }

        let special_gr = response.find((g) => g.type == enums.groupsTypes.special);
        if (special_gr) {
            special_gr.rooms = special_rooms;
            special_gr.users_count = special_rooms_users_count;
        }

        let meeting_gr = response.find((g) => g.type == enums.groupsTypes.meeting);
        if (meeting_gr_gr) {
            meeting_gr.rooms = meeting_rooms;
            meeting_gr.users_count = meeting_rooms_users_count;
        }

        let all_gr = response.find((g) => g.type == enums.groupsTypes.all);
        if (all_gr) {
            all_gr.rooms = all_rooms;
            all_gr.users_count = all_rooms_users_count;
        }

        var sorted = response.sort((a, b) => {
            return b.users_count - a.users_count;
        });
        var orderd = sorted.sort((a, b) => {
            return b.order - a.order;
        });
        res.status(200).send({
            ok: true,
            data: orderd,
        });
    } catch (e) {
        res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.put('/change-room-password', async (req, res) => {
    try {
        let room = await roomModel.findById(req.body.room_id);
        const query = {
            type: enums.fileTypes.mastermain,
            isMain: true,
            username: 'MASTER',
            roomRefs: { $all: [new ObjectId(room._id), new ObjectId(room.meetingRef)] },
        };
        const item = await memberModal.findOne(query);
        if (item) {
            if (room.code != req.body.code && item.code != req.body.code) {
                return res.status(403).send({
                    ok: false,
                    error_code: 22,
                    msg_ar: 'الكود خاطئ',
                    msg_en: 'code is incorrect',
                });
            }
            if (item.password == req.body.old_password) {
                item.password = req.body.new_password;
                await item.save();
                if (item.regUserRef) {
                    await registeredUserModal.findByIdAndUpdate(item.regUserRef, {
                        password: req.body.new_password,
                    });
                }
                const roomUsersList = await roomUsersModel.find({
                    room_name: 'MASTER',
                    isMain: true,
                    roomRef: new ObjectId(req.body.room_id),
                });
                console.log('lat item ', roomUsersList[roomUsersList.length - 1].userRef);
                if (roomUsersList.length > 0) {
                    const lastItem = roomUsersList[roomUsersList.length - 1];
                    global.io.emit(req.body.room_id, {
                        type: 'kick-master',
                        data: {
                            user_id: lastItem.userRef,
                            name: 'MASTER',
                            from: 'MASTER',
                        },
                    });
                }
                return res.status(200).send({
                    ok: true,
                    msg_ar: 'تم تغيير رمز الغرفة بنجاح',
                });
            }
            return res.status(403).send({
                ok: false,
                error_code: 21,
                msg_ar: 'كلمة السر القديمة خاطئة',
                msg_en: 'Old password is incorrect',
            });
        }
    } catch (e) {
        console.error('erro from change room password ' + e);
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.post('/:room_id/audio', async (req, res) => {
    const roomId = req.params.room_id;
    const user = await helpers.getUserByToken(req.headers.token);
    if (!user) {
        return res.status(401).send({ ok: false, error: 'Unauthorized' });
    }

    let room = await roomModel.findById(roomId);
    if (!room) {
        return res.status(404).send({ ok: false, error: 'Room not found' });
    }

    // Check if the user is allowed to join the room
    // TODO: Implement room access control logic here

    try {
        // Get or create Mediasoup worker
        const worker = await getOrCreateWorker(room);

        // Get or create Mediasoup router
        const router = await getOrCreateRouter(worker, room);

        // Create a WebRTC transport for the client
        const transport = await createWebRtcTransport(router);

        // Create an audio producer
        const producer = await transport.produce({
            kind: 'audio',
            rtpParameters: req.body.rtpParameters,
        });

        // Store the transport and producer IDs in the database
        room.transports = room.transports || {};
        room.transports[user._id] = transport.id;
        room.producers = room.producers || {};
        room.producers[user._id] = producer.id;
        await room.save();

        // Send the transport parameters back to the client
        res.status(200).send({
            ok: true,
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
        });
    } catch (error) {
        console.error('Error in WebRTC setup:', error);
        res.status(500).send({ ok: false, error: 'Internal server error' });
    }
});

// Helper functions for WebRTC setup
async function getOrCreateWorker(room) {
    if (!room.mediasoupWorkerId) {
        const worker = await mediasoup.createWorker({
            logLevel: 'warn',
            logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
        });
        room.mediasoupWorkerId = worker.id;
        await room.save();
        return worker;
    }
    return await mediasoup.getWorker(room.mediasoupWorkerId);
}

async function getOrCreateRouter(worker, room) {
    if (!room.mediasoupRouterId) {
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
        room.mediasoupRouterId = router.id;
        await room.save();
        return router;
    }
    return await worker.getRouter(room.mediasoupRouterId);
}

async function createWebRtcTransport(router) {
    return await router.createWebRtcTransport({
        listenIps: [
            {
                ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
                announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP,
            },
        ],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate: 1000000,
        minimumAvailableOutgoingBitrate: 600000,
        maxSctpMessageSize: 262144,
        maxIncomingBitrate: 1500000,
    });
}

module.exports = router;
