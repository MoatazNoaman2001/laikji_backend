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
} = require('../../helpers/userHelpers');
const userModal = require('../../models/userModal');
const roomModel = require('../../models/roomModel');
const authCheckMiddleware = require('../../middlewares/authCheckMiddleware');
var ObjectId = require('mongoose').Types.ObjectId;

router.get('/entrylogs', async (req, res) => {
    var response = [];
    var page = req.query.page ? parseInt(req.query.page) - 1 : 0;
    var room_id = req.query.room_id ? req.query.room_id : null;
    var in_page = 1000;
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

        await Promise.all(
            items.map(async (item) => {
                item = JSON.parse(JSON.stringify(item));
                const isBanned = await isBannedFromServer(item.device, item.ip);
                const res_item = {
                    ...item,
                    isBanned,
                };

                response.push(res_item);
            }),
        );

        response = response.sort(
            (a, b) => Date.parse(new Date(b.exitDate)) - Date.parse(new Date(a.exitDate)),
        );

        res.status(200).send({
            ok: true,
            page: page,
            in_page: in_page,
            all_pages: 10,
            items: items,
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

router.post('/ban/:key', authCheckMiddleware, async (req, res) => {
    console.log('req params ' + JSON.stringify(req.params, null, 2));
    //const device = req.params.device.replace(/[{}]/g, '');

    try {
        let user = await userModal.findOne({
            key: req.params.key,
        });
        console.log('latest rooms ', JSON.stringify(user, null, 2));

        if (!user) {
            res.status(500).send({
                ok: false,
                error: 'user is not defined',
            });
        }

        if (user.latestRoomRef) {
            user = await getUserById(user._id, user.latestRoomRef);
        }

        let until = null;

        if (req.body.time && req.body.time != -1) {
            until = getNowDateTime();
            until = until.setHours(until.getHours() + parseInt(req.body.time));
        }

        await bannedModel.findOneAndUpdate(
            {
                device: user.device,
                key: user.key,
                type: enums.banTypes.server,
            },
            {
                name: user.name,
                // device: user.device,
                until: until,
                country: user.country_code ?? '',
                ip: user.ip ?? '',
                banner_strong: 100000,
            },
            { upsert: true, new: true },
        );

        if (user.latestRoomRef) {
            const room = await roomModel.findById(user.latestRoomRef);

            global.io.emit(room._id, {
                type: 'command-ban',
                data: {
                    user_id: user._id,
                    name: user.name,
                    from: 'سيرفر',
                },
            });

            global.io.emit(room.isMeeting ? room.parentRef : room.meetingRef, {
                type: 'command-ban',
                data: {
                    user_id: user._id,
                    name: user.name,
                    from: 'سيرفر',
                },
            });
        }

        return res.status(200).send({
            ok: true,
        });
    } catch (e) {
        console.log(e);
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.post('/ban/:ip', authCheckMiddleware, async (req, res) => {
    console.log('req params ' + JSON.stringify(req.params, null, 2));

    try {
        let user = await userModal.findOne({
            ip: req.params.ip,
        });
        console.log('latest rooms ', JSON.stringify(user, null, 2));

        if (!user) {
            res.status(500).send({
                ok: false,
                error: 'user is not defined',
            });
        }

        if (user.latestRoomRef) {
            user = await getUserById(user._id, user.latestRoomRef);
        }

        let until = null;

        if (req.body.time && req.body.time != -1) {
            until = getNowDateTime();
            until = until.setHours(until.getHours() + parseInt(req.body.time));
        }

        await bannedModel.findOneAndUpdate(
            {
                ip: user.ip,
                type: enums.banTypes.ip,
            },
            {
                name: user.name,
                until: until,
                country: user.country_code ?? '',
                ip: user.ip ?? '',
                banner_strong: 100000,
            },
            { upsert: true, new: true },
        );

        if (user.latestRoomRef) {
            const room = await roomModel.findById(user.latestRoomRef);

            global.io.emit(room._id, {
                type: 'command-ban',
                data: {
                    user_id: user._id,
                    name: user.name,
                    from: 'سيرفر',
                },
            });

            global.io.emit(room.isMeeting ? room.parentRef : room.meetingRef, {
                type: 'command-ban',
                data: {
                    user_id: user._id,
                    name: user.name,
                    from: 'سيرفر',
                },
            });
        }

        return res.status(200).send({
            ok: true,
        });
    } catch (e) {
        console.log(e);
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.get('/unban/:key', authCheckMiddleware, async (req, res) => {
    try {
        console.log('req ', req.params.key);
        const banneds = await bannedModel.find({
            key: req.params.key,
            type: enums.banTypes.server,
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
        console.log('set stop', req.params.key, req.body);
        //const device = req.params.device.replace(/[{}]/g, '');

        let until = -1;
        //console.log('stop ', device);
        if (req.body.time && req.body.time != -1) {
            until = getNowDateTime(true) + req.body.time * 3600 * 1000;
            console.log(
                getNowDateTime(true),
                req.body.time,
                req.body.time * 3600 * 1000,
                ':',
                until,
            );
        }

        if (
            !req.body.server_can_public_chat &&
            !req.body.server_can_private_chat &&
            !req.body.server_can_use_mic &&
            !req.body.server_can_use_camera
        ) {
            until = null;
        }
        const u = await userModal.findOne({ key: req.params.key });
        console.log('first ', u);
        const user = await userModal.findOneAndUpdate(
            {
                device: req.body.device,
                key: req.params.key,
            },
            {
                server_can_public_chat: !req.body.server_can_public_chat,
                server_can_private_chat: !req.body.server_can_private_chat,
                server_can_use_mic: !req.body.server_can_use_mic,
                server_can_use_camera: !req.body.server_can_use_camera,
                server_stop_until: until == -1 ? null : until,
                server_stop_time: until ? req.body.time : null,
            },
            {
                new: true,
                sort: { creationDate: -1 },
            },
        );

        await notifyUserChanged(user._id, {}, true);

        return res.status(200).send({
            ok: true,
        });
    } catch (e) {
        console.log(e);
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.get('/unstop/:key', authCheckMiddleware, async (req, res) => {
    try {
        const user = await userModal.findOneAndUpdate(
            {
                key: req.params.key,
            },
            {
                server_can_public_chat: true,
                server_can_private_chat: true,
                server_can_use_mic: true,
                server_can_use_camera: true,
                server_stop_until: null,
                server_stop_time: null,
            },
        );

        await notifyUserChanged(user._id);

        return res.status(200).send({
            ok: true,
        });
    } catch (e) {
        console.log(e);
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.get('/stoppeds', async (req, res) => {
    var page = req.query.page ? parseInt(req.query.page) - 1 : 0;
    var room_id = req.query.room_id ? req.query.room_id : null;
    var in_page = 10000;
    try {
        let query = {};
        if (room_id) {
            query.roomRef = new ObjectId(room_id);
        }

        let items = await userModal
            .find({
                server_stop_time: {
                    $ne: null,
                },
            })
            .sort('-creationDate')
            .skip(page * in_page)
            .limit(in_page)
            .exec();

        items = items.sort(
            (a, b) => Date.parse(new Date(b.exitDate)) - Date.parse(new Date(a.exitDate)),
        );

        const data = [];

        await Promise.all(
            items.map(async (item) => {
                if (item.latestRoomRef) {
                    const u = await getUserById(item._id, item.latestRoomRef);
                    data.push(u);
                } else {
                    data.push(item);
                }
            }),
        );

        res.status(200).send({
            ok: true,
            page: page,
            in_page: in_page,
            all_pages: 10,
            data: data,
        });
    } catch (e) {
        res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.get('/banneds', async (req, res) => {
    var page = req.query.page ? parseInt(req.query.page) - 1 : 0;
    var room_id = req.query.room_id ? req.query.room_id : null;
    var in_page = 1000;
    try {
        let query = {
            type: enums.banTypes.server,
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
                const isBanned = await isBannedFromServer(item.device, item.ip);
                const res_item = {
                    ...item,
                    isBanned,
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
