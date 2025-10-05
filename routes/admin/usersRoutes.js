const express = require('express');
const router = express.Router();
const enums = require('../../helpers/enums');
const entryLogModel = require('../../models/entryLogModel');
const bannedModel = require('../../models/bannedModel');
const { getNowDateTime } = require('../../helpers/tools');
const {
    isBannedFromServer,
    getUsersInRoom,
    notifyUserChanged,
    getUserById,
    isBannedByIp,
} = require('../../helpers/userHelpers');
const userModal = require('../../models/userModal');
const roomModel = require('../../models/roomModel');
const authCheckMiddleware = require('../../middlewares/authCheckMiddleware');
const stopModel = require('../../models/stopModel');
var ObjectId = require('mongoose').Types.ObjectId;

router.get('/entrylogs', async (req, res) => {
    let response = [];
    let page = req.query.page ? parseInt(req.query.page) - 1 : 0;
    let room_id = req.query.room_id ? req.query.room_id : null;
    let in_page = 1000;

    try {
        let query = {};

        if (room_id) {
            query.roomRef = new ObjectId(room_id);
        }

        let items = await entryLogModel
            .find(query)
            .populate(['roomRef', 'userRef'])
            .sort('-exitDate')
            .skip(page * in_page)
            .limit(in_page)
            .exec();

        response = await Promise.all(
            items.map(async (item) => {
                item = JSON.parse(JSON.stringify(item));

                const isServerBanned = await isBannedFromServer(item.userRef.device, false);

                const isIpBanned = await isBannedByIp(item.ip, false);

                return {
                    ...item,
                    isIpBanned,
                    isServerBanned,
                };
            }),
        );

        response = response.sort((a, b) => Date.parse(b.exitDate) - Date.parse(a.exitDate));

        res.status(200).send({
            ok: true,
            page,
            in_page,
            all_pages: 10,
            data: response,
        });
    } catch (e) {
        res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.get('/entrylogs/clear', authCheckMiddleware, async (req, res) => {
    try {
        var filters = {};
        if (req.query.id) {
            filters.roomRef = new ObjectId(req.query.id);
        }

        await entryLogModel.deleteMany(filters);

        res.status(200).send({
            ok: true,
        });
    } catch (e) {
        res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

// router.post('/ban/:key', authCheckMiddleware, async (req, res) => {
//     console.log('req params ' + JSON.stringify(req.params, null, 2));

//     try {
//         let user = await userModal.findOne({ key: req.params.key });
//         console.log('latest rooms ', JSON.stringify(user, null, 2));

//         if (!user) {
//             return res.status(500).send({
//                 ok: false,
//                 error: 'user is not defined',
//             });
//         }

//         if (user.latestRoomRef) {
//             user = await getUserById(user._id, user.latestRoomRef);
//         }

//         let until = null;

//         if (req.body.time && req.body.time != -1) {
//             until = getNowDateTime();
//             until = until.setHours(until.getHours() + parseInt(req.body.time));
//         }

//         await bannedModel.findOneAndUpdate(
//             {
//                 device: user.device,
//                 // key: user.key,
//                 type: enums.banTypes.server,
//                 level: enums.banTypes.server,
//             },
//             {
//                 name: user.name,
//                 until: until,
//                 country: user.country_code ?? '',
//                 ip: user.ip ?? '',
//                 banner_strong: 100000,
//             },
//             { upsert: true, new: true },
//         );

//         if (user.latestRoomRef) {
//             const room = await roomModel.findById(user.latestRoomRef);

//             global.io.emit(room._id, {
//                 type: 'command-ban',
//                 data: {
//                     user_id: user._id,
//                     name: user.name,
//                     from: 'سيرفر',
//                 },
//             });

//             global.io.emit(room.isMeeting ? room.parentRef : room.meetingRef, {
//                 type: 'command-ban',
//                 data: {
//                     user_id: user._id,
//                     name: user.name,
//                     from: 'سيرفر',
//                 },
//             });
//         }

//         return res.status(200).send({
//             ok: true,
//         });
//     } catch (e) {
//         console.log(e);
//         return res.status(500).send({
//             ok: false,
//             error: e.message,
//         });
//     }
// });
router.post('/ban/:key', authCheckMiddleware, async (req, res) => {
    try {
        let users = await userModal.find({ key: req.params.key });

        if (users.length <= 0) {
            return res.status(404).send({
                ok: false,
                error: 'User not found',
            });
        }

        for (const user of users) {
            let userData = user;

            if (user.latestRoomRef) {
                userData = await getUserById(user._id, user.latestRoomRef);
            }

            let until = null;
            if (req.body.time) {
                until = getNowDateTime();
                if (req.body.time != -1) {
                    until.setHours(until.getHours() + parseInt(req.body.time));
                } else {
                    until = new Date();
                    until.setFullYear(9999);
                }
            }

            await bannedModel.findOneAndUpdate(
                {
                    key: userData.key,
                    type: enums.banTypes.server,
                    level: enums.banTypes.server,
                },
                {
                    name: userData.name,
                    until: until,
                    device: userData.device,
                    country: userData.country_code ?? '',
                    ip: userData.ip ?? '',
                    banner_strong: 100000,
                },
                { upsert: true, new: true },
            );

            if (userData.latestRoomRef) {
                const room = await roomModel.findById(userData.latestRoomRef);

                global.io.emit(room._id, {
                    type: 'command-ban',
                    data: {
                        user_id: userData._id.toString(),
                        name: userData.name,
                        from: 'سيرفر',
                    },
                });

                global.io.emit(room.isMeeting ? room.parentRef : room.meetingRef, {
                    type: 'command-ban',
                    data: {
                        user_id: userData._id.toString(),
                        name: userData.name,
                        from: 'سيرفر',
                    },
                });
            }
        }

        return res.status(200).send({
            ok: true,
        });
    } catch (e) {
        console.error(e);
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.post('/banip/:ip', authCheckMiddleware, async (req, res) => {
    console.log('req params ' + JSON.stringify(req.params, null, 2));

    try {
        let users = await userModal.find({ ip: req.params.ip });

        if (users.length <= 0) {
            return res.status(404).send({
                ok: false,
                error: 'User not found',
            });
        }

        for (const user of users) {
            let userData = user;

            if (user.latestRoomRef) {
                userData = await getUserById(user._id, user.latestRoomRef);
            }

            let until = null;
            if (req.body.time) {
                until = getNowDateTime();
                if (req.body.time != -1) {
                    until.setHours(until.getHours() + parseInt(req.body.time));
                } else {
                    until = new Date();
                    until.setFullYear(9999);
                }
            }

            await bannedModel.findOneAndUpdate(
                {
                    ip: userData.ip,
                    type: enums.banTypes.ip,
                    level: enums.banTypes.server,
                },
                {
                    name: userData.name,
                    until: until,
                    country: userData.country_code ?? '',
                    ip: userData.ip ?? '',
                    banner_strong: 100000,
                    device: userData.device,
                },
                { upsert: true, new: true },
            );

            if (userData.latestRoomRef) {
                const room = await roomModel.findById(userData.latestRoomRef);

                global.io.emit(room._id, {
                    type: 'command-ban',
                    data: {
                        user_id: userData._id.toString(),
                        name: userData.name,
                        from: 'سيرفر',
                    },
                });

                global.io.emit(room.isMeeting ? room.parentRef : room.meetingRef, {
                    type: 'command-ban',
                    data: {
                        user_id: userData._id.toString(),
                        name: userData.name,
                        from: 'سيرفر',
                    },
                });
            }
        }

        return res.status(200).send({
            ok: true,
        });
    } catch (e) {
        console.error(e);
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.get('/unban/:device', authCheckMiddleware, async (req, res) => {
    try {
        console.log('req ', req.params.device);
        const banneds = await bannedModel.find({
            device: req.params.device,
            type: enums.banTypes.server,
        });
        if (banneds.length <= 0) {
            return res.status(500).send({
                ok: false,
                error: 'no banned users found',
            });
        }
        await Promise.all(
            banneds.forEach(async (b) => {
                await bannedModel.deleteOne({ _id: b._id });
                console.log('un banned ');
            }),
        );

        return res.status(200).send({
            ok: true,
        });
    } catch (e) {
        console.log('error from unban', e);
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.get('/unbanip/:ip', authCheckMiddleware, async (req, res) => {
    try {
        console.log('req ', req.params.ip);
        const banneds = await bannedModel.find({
            ip: req.params.ip,
            type: enums.banTypes.ip,
        });
        await Promise.all(
            banneds.forEach(async (b) => {
                await bannedModel.deleteOne({ _id: b._id });
                console.log('un banned ');
            }),
        );

        return res.status(200).send({
            ok: true,
        });
    } catch (e) {
        console.log('error from unban', e);
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.post('/set-stop/:key', authCheckMiddleware, async (req, res) => {
    try {
        let key = req.params.key.trim();
        console.log('set stop', key, req.body);

        let until = -1;
        if (req.body.time && req.body.time != -1) {
            until = getNowDateTime(true) + req.body.time * 3600 * 1000;
        }

        // If all are allowed, no stop
        const allAllowed =
            req.body.server_can_public_chat &&
            req.body.server_can_private_chat &&
            req.body.server_can_use_mic &&
            req.body.server_can_use_camera;

        if (allAllowed) {
            until = null;
        }

        // 🔹 Find initial user by key, ip or device
        const users = await userModal.find({
            $or: [{ key: key }, { ip: req.ip }, { device: req.body.device }],
        });

        if (!users || users.length === 0) {
            return res.status(404).send({ ok: false, error: 'User(s) not found' });
        }
        const u = users[0];

        if (allAllowed) {
            // remove stopModel if exists
            await stopModel.deleteOne({ device: u.device, ip: u.ip });
        } else {
            // Save/Update in stopModel
            await stopModel.findOneAndUpdate(
                {
                    device: u.device,
                    ip: u.ip,
                },
                {
                    device: u.device,
                    ip: u.ip,
                    key: u.key,
                    name: u.name,
                    country: u.country,
                    server_can_public_chat: !req.body.server_can_public_chat,
                    server_can_private_chat: !req.body.server_can_private_chat,
                    server_can_use_mic: !req.body.server_can_use_mic,
                    server_can_use_camera: !req.body.server_can_use_camera,
                    server_stop_until: until > 0 ? until : null,
                    server_stop_time: until > 0 ? req.body.time : null,
                    userRef: u._id,
                    roomRef: u.latestRoomRef || null,
                },
                { new: true, upsert: true },
            );
        }

        const allAffectedUsers = await userModal.find({
            $or: [{ device: u.device }, { ip: u.ip }, { key: u.key }],
        });

        await userModal.updateMany(
            {
                $or: [{ device: u.device }, { ip: u.ip }, { key: u.key }],
            },
            {
                server_can_public_chat: !req.body.server_can_public_chat,
                server_can_private_chat: !req.body.server_can_private_chat,
                server_can_use_mic: !req.body.server_can_use_mic,
                server_can_use_camera: !req.body.server_can_use_camera,
                server_stop_until: until > 0 ? until : null,
                server_stop_time: until > 0 ? req.body.time : null,
                device: u.device,
                ip: u.ip,
            },
        );

        await Promise.all(allAffectedUsers.map((user) => notifyUserChanged(user._id, {}, true)));

        return res.status(200).send({ ok: true });
    } catch (e) {
        console.error(e);
        return res.status(500).send({ ok: false, error: e.message });
    }
});

router.get('/unstop/:key', authCheckMiddleware, async (req, res) => {
    try {
        const u = await userModal.findOne({ key: req.params.key });
        if (!u) {
            return res.status(404).send({ ok: false, error: 'User not found' });
        }

        await stopModel.findOneAndDelete({
            device: u.device,
            ip: u.ip,
        });
        await userModal.findOneAndUpdate(
            { key: req.params.key },
            {
                server_can_public_chat: true,
                server_can_private_chat: true,
                server_can_use_mic: true,
                server_can_use_camera: true,
                server_stop_until: null,
                server_stop_time: null,
            },
        );
        await notifyUserChanged(u._id);

        return res.status(200).send({ ok: true });
    } catch (e) {
        console.log(e);
        return res.status(500).send({ ok: false, error: e.message });
    }
});

router.get('/stoppeds', async (req, res) => {
    var page = req.query.page ? parseInt(req.query.page) - 1 : 0;
    var room_id = req.query.room_id ? req.query.room_id : null;
    var in_page = 10000;
    try {
        let query = {
            $or: [
                { server_can_public_chat: false },
                { server_can_private_chat: false },
                { server_can_use_mic: false },
                { server_can_use_camera: false },
            ],
        };

        if (room_id) {
            query.roomRef = new ObjectId(room_id);
        }

        let items = await userModal
            .find(query)
            .sort('-creationDate')
            .skip(page * in_page)
            .limit(in_page)
            .exec();

        items = items.sort(
            (a, b) => Date.parse(new Date(b.exitDate)) - Date.parse(new Date(a.exitDate)),
        );

        const data = [];
        const currentTime = new Date();
        const idsToUpdate = [];

        await Promise.all(
            items.map(async (item) => {
                // Check if server stop time is up
                if (item.server_stop_until && new Date(item.server_stop_until) <= currentTime) {
                    idsToUpdate.push(item._id);
                } else {
                    // Only include items that haven't expired
                    if (item.latestRoomRef) {
                        const u = await getUserById(item._id, item.latestRoomRef);
                        data.push(u);
                    } else {
                        data.push(item);
                    }
                }
            }),
        );

        // Update expired documents to set all permissions to true
        if (idsToUpdate.length > 0) {
            await userModal.updateMany(
                { _id: { $in: idsToUpdate } },
                {
                    $set: {
                        server_can_public_chat: true,
                        server_can_private_chat: true,
                        server_can_use_mic: true,
                        server_can_use_camera: true,
                    },
                },
            );
            console.log(`Updated ${idsToUpdate.length} expired user document(s)`);
        }

        res.status(200).send({
            ok: true,
            page: page,
            in_page: in_page,
            all_pages: 10,
            data: data,
            updated_count: idsToUpdate.length,
        });
    } catch (e) {
        res.status(500).send({ ok: false, error: e.message });
    }
});
// router.post('/set-stop/:key', authCheckMiddleware, async (req, res) => {
//     try {
//         let key = req.params.key.trim();
//         console.log('set stop', key, req.body);

//         let until = -1;
//         //console.log('stop ', device);
//         if (req.body.time && req.body.time != -1) {
//             until = getNowDateTime(true) + req.body.time * 3600 * 1000;
//             console.log(
//                 getNowDateTime(true),
//                 req.body.time,
//                 req.body.time * 3600 * 1000,
//                 ':',
//                 until,
//             );
//         }

//         if (
//             !req.body.server_can_public_chat &&
//             !req.body.server_can_private_chat &&
//             !req.body.server_can_use_mic &&
//             !req.body.server_can_use_camera
//         ) {
//             until = null;
//         }
//         const u = await userModal.findOne({ key: key });
//         console.log('first ', u);
//         const user = await userModal.findOneAndUpdate(
//             {
//                 //device: u.device,
//                 key: key,
//             },
//             {
//                 server_can_public_chat: !req.body.server_can_public_chat,
//                 server_can_private_chat: !req.body.server_can_private_chat,
//                 server_can_use_mic: !req.body.server_can_use_mic,
//                 server_can_use_camera: !req.body.server_can_use_camera,
//                 server_stop_until: until == -1 ? null : until,
//                 server_stop_time: until ? req.body.time : null,
//                 device: u.device,
//                 ip: u.ip,
//             },
//             {
//                 new: true,
//                 sort: { creationDate: -1 },
//             },
//         );

//         await notifyUserChanged(user._id, {}, true);

//         return res.status(200).send({
//             ok: true,
//         });
//     } catch (e) {
//         console.log(e);
//         return res.status(500).send({
//             ok: false,
//             error: e.message,
//         });
//     }
// });

// router.get('/unstop/:key', authCheckMiddleware, async (req, res) => {
//     try {
//         const user = await userModal.findOneAndUpdate(
//             {
//                 key: req.params.key,
//             },
//             {
//                 server_can_public_chat: true,
//                 server_can_private_chat: true,
//                 server_can_use_mic: true,
//                 server_can_use_camera: true,
//                 server_stop_until: null,
//                 server_stop_time: null,
//             },
//         );

//         await notifyUserChanged(user._id);

//         return res.status(200).send({
//             ok: true,
//         });
//     } catch (e) {
//         console.log(e);
//         return res.status(500).send({
//             ok: false,
//             error: e.message,
//         });
//     }
// });

// router.get('/stoppeds', async (req, res) => {
//     var page = req.query.page ? parseInt(req.query.page) - 1 : 0;
//     var room_id = req.query.room_id ? req.query.room_id : null;
//     var in_page = 10000;
//     try {
//         let query = {};
//         if (room_id) {
//             query.roomRef = new ObjectId(room_id);
//         }

//         let items = await userModal
//             .find({
//                 server_stop_time: {
//                     $ne: null,
//                 },
//             })
//             .sort('-creationDate')
//             .skip(page * in_page)
//             .limit(in_page)
//             .exec();

//         items = items.sort(
//             (a, b) => Date.parse(new Date(b.exitDate)) - Date.parse(new Date(a.exitDate)),
//         );

//         const data = [];

//         await Promise.all(
//             items.map(async (item) => {
//                 if (item.latestRoomRef) {
//                     const u = await getUserById(item._id, item.latestRoomRef);
//                     data.push(u);
//                 } else {
//                     data.push(item);
//                 }
//             }),
//         );

//         res.status(200).send({
//             ok: true,
//             page: page,
//             in_page: in_page,
//             all_pages: 10,
//             data: data,
//         });
//     } catch (e) {
//         res.status(500).send({
//             ok: false,
//             error: e.message,
//         });
//     }
// });

router.get('/banneds', async (req, res) => {
    var page = req.query.page ? parseInt(req.query.page) - 1 : 0;
    var room_id = req.query.room_id ? req.query.room_id : null;
    var in_page = 1000;
    try {
        let query = {
            $or: [
                {
                    type: enums.banTypes.server,
                },
                {
                    type: enums.banTypes.ip,
                },
            ],
        };

        if (room_id) {
            query.roomRef = new ObjectId(room_id);
        }

        let items = await bannedModel
            .find(query)
            .sort('-creationDate')
            .skip(page * in_page)
            .limit(in_page)
            .exec();

        items = items.sort(
            (a, b) => Date.parse(new Date(b.exitDate)) - Date.parse(new Date(a.exitDate)),
        );

        res.status(200).send({
            ok: true,
            page: page,
            in_page: in_page,
            all_pages: 10,
            data: items,
        });
    } catch (e) {
        res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.get('/inroom', async (req, res) => {
    const room_id = req.query.room_id;
    let response = [];

    try {
        const items = await getUsersInRoom(room_id, false, false);

        await Promise.all(
            items.map(async (item) => {
                item = JSON.parse(JSON.stringify(item));
                const isServerBanned = await isBannedFromServer(item.device, false);
                const isIpBanned = await isBannedByIp(item.ip, false);
                const res_item = {
                    ...item,
                    isServerBanned,
                    isIpBanned,
                };

                response.push(res_item);
            }),
        );

        response = response.sort(
            (a, b) => Date.parse(new Date(b.enterDate)) - Date.parse(new Date(a.enterDate)),
        );

        res.status(200).send({
            ok: true,
            data: response,
        });
    } catch (e) {
        res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

module.exports = router;
