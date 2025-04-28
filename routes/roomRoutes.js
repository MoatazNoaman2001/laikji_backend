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
    const settings = await getSettings();
    try {
        var grbs = await groupModel.find().sort({ order: 'descending' });
        var allRooms = await roomModel.find({
            groupRef: { $in: grbs.map((g) => g._id) },
        });

        var response = [];

        const golden_rooms = [];
        let golden_rooms_users_count = 0;
        const special_rooms = [];
        let special_rooms_users_count = 0;
        const meeting_rooms = [];
        let meeting_rooms_users_count = 0;
        const all_rooms = [];
        let all_rooms_users_count = 0;

        await Promise.all(
            grbs.map(async (group) => {
                var groupRooms = allRooms.filter(
                    (r) => r.groupRef.toString() === group._id.toString(),
                );

                var res_item = {
                    _id: group._id,
                    name: group.name,
                    type: group.type,
                    icon: group.icon ? process.env.mediaUrl + group.icon : null,
                    background: group.background,
                    inside_style: group.inside_style,
                    order: group.order,
                    users_count: 0,
                    rooms: [],
                };

                for (const room of groupRooms) {
                    const r = await helpers.get_room_small(room, group, settings);

                    if (!r.isMeeting) {
                        var u_in_room = global.rooms_users[r._id];
                        r.users_count = u_in_room ? u_in_room.length : 0;

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
                        res_item.rooms.push(r);
                    } else {
                        meeting_rooms.push(r);
                        meeting_rooms_users_count += r.users_count;
                    }
                }

                res_item.font = getGroupFontColor(group, settings);
                res_item.background = getGroupBackground(group, settings);

                response.push(res_item);
            }),
        );

        const updateGroupRooms = (type, roomsList, usersCount) => {
            let gr = response.find((g) => g.type == type);
            if (gr) {
                gr.rooms = roomsList;
                gr.users_count = usersCount;
            }
        };

        updateGroupRooms(enums.groupsTypes.gold, golden_rooms, golden_rooms_users_count);
        updateGroupRooms(enums.groupsTypes.special, special_rooms, special_rooms_users_count);
        updateGroupRooms(enums.groupsTypes.meeting, meeting_rooms, meeting_rooms_users_count);
        updateGroupRooms(enums.groupsTypes.all, all_rooms, all_rooms_users_count);

        var ordered = response.sort((a, b) => {
            if (b.order !== a.order) {
                return b.order - a.order;
            }
            return b.users_count - a.users_count;
        });

        res.status(200).send({
            ok: true,
            data: ordered,
        });
    } catch (e) {
        res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

function getGroupFontColor(group, settings) {
    let color = '255|255|255';
    switch (group.type) {
        case enums.groupsTypes.gold:
            color = hexToXRgb(settings.rgb_gold_group_fnt) || '255|255|255';
            break;
        case enums.groupsTypes.special:
            color = hexToXRgb(settings.rgb_special_group_fnt) || '255|255|255';
            break;
        case enums.groupsTypes.meeting:
            color = hexToXRgb(settings.rgb_meet_group_fnt) || '255|255|255';
            break;
        case enums.groupsTypes.all:
            color = hexToXRgb(settings.rgb_all_group_fnt) || '255|255|255';
            break;
        case enums.groupsTypes.country:
            color = hexToXRgb(settings.rgb_country_group_fnt) || '255|255|255';
            break;
        case enums.groupsTypes.support:
            color = hexToXRgb(settings.rgb_support_group_fnt) || '255|255|255';
            break;
        case enums.groupsTypes.learning:
            color = hexToXRgb(settings.rgb_learning_group_fnt) || '255|255|255';
            break;
    }
    return color;
}

function getGroupBackground(group, settings) {
    let background = group.background;
    switch (group.type) {
        case enums.groupsTypes.gold:
            background = hexToXRgb(settings.rgb_gold_group_bg) || background;
            break;
        case enums.groupsTypes.special:
            background = hexToXRgb(settings.rgb_special_group_bg) || background;
            break;
        case enums.groupsTypes.meeting:
            background = hexToXRgb(settings.rgb_meet_group_bg) || background;
            break;
        case enums.groupsTypes.all:
            background = hexToXRgb(settings.rgb_all_group_bg) || background;
            break;
        case enums.groupsTypes.country:
            background = hexToXRgb(settings.rgb_country_group_bg) || background;
            break;
        case enums.groupsTypes.support:
            background = hexToXRgb(settings.rgb_support_group_bg) || background;
            break;
        case enums.groupsTypes.learning:
            background = hexToXRgb(settings.rgb_learning_group_bg) || background;
            break;
    }
    return background;
}

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
