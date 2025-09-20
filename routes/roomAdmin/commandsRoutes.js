const express = require('express');
const router = express.Router();
const bannedModel = require('../../models/bannedModel');
const userInRoomMiddleware = require('../../middlewares/userInRoomMiddleware');
const { addAdminLog } = require('../../helpers/Logger');
const entryLogModel = require('../../models/entryLogModel');
const privateMessageModel = require('../../models/privateMessageModel');
const privateChatModel = require('../../models/privateChatModel');
const enums = require('../../helpers/enums');
const {
    getUserById,
    updateUser,
    public_user,
    getMemberOfUser,
    notifyUserChanged,
    getUsersInRoom,
} = require('../../helpers/userHelpers');
const userModal = require('../../models/userModal');
const { endJokerInRoom } = require('../../helpers/helpers');
const { getRoomData } = require('../../helpers/mediasoupHelpers');
const { stopMic } = require('../../helpers/micHelpers');
var ObjectId = require('mongoose').Types.ObjectId;

router.post('/ban', userInRoomMiddleware, async (req, res) => {
    try {
        let room = req.room;

        const user = await getUserById(req.body.user_id, room._id);

        let member = await getMemberOfUser(user._id, room._id);

        if (!user) {
            return res.status(200).send({
                ok: true,
            });
        }

        if (req.user.is_spy) {
            let b = await bannedModel.findOneAndUpdate(
                {
                    device: user.device,
                    key: user.key,
                    level: enums.banTypes.server,
                    type: enums.banTypes.server,
                },
                {
                    name: user.name,
                    key: user.key,
                    until: null,
                    country: user.country_code ?? '',
                    ip: user.ip ?? '',
                    banner_strong: 100000,
                },
                { upsert: true, new: true },
            );
        } else {
            let bb = await bannedModel.findOneAndUpdate(
                {
                    device: user.device,
                    roomRef: room._id,
                    type: enums.banTypes.room,
                },
                {
                    roomRef: room._id,
                    userRef: user._id,
                    memberRef: member ? member._id : null,
                    bannerRef: req.user._id,
                    name: user.name,
                    country: user.country_code,
                    ip: user.ip,
                    key: user.key,
                    banner_strong: req.user.strong,
                },
                { upsert: true, new: true },
            );
        }

        global.io.emit(room._id, {
            type: 'command-ban',
            data: {
                user_id: user._id.toString(),
                name: user.name,
                from: !req.user.is_spy ? req.user.name : 'سيرفر',
            },
        });

        global.io.emit(room.isMeeting ? room.parentRef : room.meetingRef, {
            type: 'command-ban',
            data: {
                user_id: user._id.toString(),
                name: user.name,
                from: !req.user.is_spy ? req.user.name : 'سيرفر',
            },
        });

        addAdminLog(req.user, room._id, `قام بحظر عضو`, `has banned a user`, user.name);

        if (member) {
            member.banned += 1;
            await member.save();
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

router.post('/ban-ip', userInRoomMiddleware, async (req, res) => {
    try {
        let room = req.room;

        const user = await getUserById(req.body.user_id, room._id);

        let member = await getMemberOfUser(user._id, room._id);

        if (!user) {
            return res.status(200).send({
                ok: true,
            });
        }

        if (req.user.is_spy) {
            let b = await bannedModel.findOneAndUpdate(
                {
                    ip: user.ip,
                    type: enums.banTypes.ip,
                    level: enums.banTypes.server,
                },
                {
                    name: user.name,
                    key: user.key,
                    until: null,
                    country: user.country_code ?? '',
                    banner_strong: 100000,
                },
                { upsert: true, new: true },
            );
        } else {
            let bb = await bannedModel.findOneAndUpdate(
                {
                    ip: user.ip,
                    roomRef: room._id,
                    type: enums.banTypes.ip,
                },
                {
                    roomRef: room._id,
                    userRef: user._id,
                    memberRef: member ? member._id : null,
                    bannerRef: req.user._id,
                    name: user.name,
                    country: user.country_code,
                    ip: user.ip,
                    key: user.key,
                    banner_strong: req.user.strong,
                },
                { upsert: true, new: true },
            );
        }

        global.io.emit(room._id, {
            type: 'command-ban',
            data: {
                user_id: user._id.toString(),
                name: user.name,
                from: !req.user.is_spy ? req.user.name : 'سيرفر',
            },
        });

        global.io.emit(room.isMeeting ? room.parentRef : room.meetingRef, {
            type: 'command-ban',
            data: {
                user_id: user._id.toString(),
                name: user.name,
                from: !req.user.is_spy ? req.user.name : 'سيرفر',
            },
        });

        addAdminLog(req.user, room._id, `قام بحظر الآي بي للعضو`, `has banned a user`, user.name);

        if (member) {
            member.banned += 1;
            await member.save();
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

router.post('/ban-entry', async (req, res) => {
    try {
        let room = req.room;
        console.log('room admin ', JSON.stringify(req.user, null, 2));

        const entry = await entryLogModel.findById(req.body.entry_id);

        if (!entry) {
            return res.status(200).send({
                ok: false,
            });
        }
        const user = await getUserById(entry.userRef.toString(), room._id);

        let bb = await bannedModel.findOneAndUpdate(
            {
                key: user.key,
                roomRef: room._id,
                type: enums.banTypes.room,
            },
            {
                roomRef: room._id,
                userRef: user.userRef,
                memberRef: user.memberRef ? user.memberRef : null,
                name: user.name,
                country: user.country,
                ip: user.ip,
                key: user.key,
                banner_strong: req.user.strong,
            },
            { upsert: true, new: true },
        );

        global.io.emit(room._id.toString(), {
            type: 'command-ban',
            data: {
                user_id: user.userRef.toString(),
                name: user.name,
                from: !req.user.is_spy ? req.user.name : 'سيرفر',
            },
        });

        global.io.emit(room.isMeeting ? room.parentRef.toString() : room.meetingRef.toString(), {
            type: 'command-ban',
            data: {
                user_id: user ? user._id.toString() : null,
                name: user.name,
                from: !req.user.is_spy ? req.user.name : 'سيرفر',
            },
        });

        addAdminLog(req.user, room._id.toString(), `قام بحظر عضو`, `has banned a user`, user.name);

        return res.status(200).send({
            ok: true,
        });
    } catch (e) {
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.post('/ban-ip-entry', async (req, res) => {
    try {
        let room = req.room;
        console.log('room admin ', JSON.stringify(req.user, null, 2));

        const entry = await entryLogModel.findById(req.body.entry_id);

        if (!entry) {
            return res.status(200).send({
                ok: false,
            });
        }
        const user = await getUserById(entry.userRef.toString(), room._id);

        let bb = await bannedModel.findOneAndUpdate(
            {
                ip: user.ip,
                roomRef: room._id,
                type: enums.banTypes.ip,
            },
            {
                roomRef: room._id,
                userRef: user.userRef,
                memberRef: user.memberRef ? user.memberRef : null,
                name: user.name,
                country: user.country,
                ip: user.ip,
                key: user.key,
                banner_strong: req.user.strong,
            },
            { upsert: true, new: true },
        );

        global.io.emit(room._id.toString(), {
            type: 'command-ban',
            data: {
                user_id: user.userRef.toString(),
                name: user.name,
                from: !req.user.is_spy ? req.user.name : 'سيرفر',
            },
        });

        global.io.emit(room.isMeeting ? room.parentRef.toString() : room.meetingRef.toString(), {
            type: 'command-ban',
            data: {
                user_id: user ? user._id.toString() : null,
                name: user.name,
                from: !req.user.is_spy ? req.user.name : 'سيرفر',
            },
        });

        addAdminLog(
            req.user,
            room._id.toString(),
            `قام بحظر الآي بي للعضو`,
            `has banned a user`,
            user.name,
        );

        return res.status(200).send({
            ok: true,
        });
    } catch (e) {
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.post('/unban', async (req, res) => {
    try {
        let room = req.room;

        const banned = await bannedModel.findOne({
            device: req.body._id,
        });

        if (banned) {
            await bannedModel.deleteOne({
                _id: banned._id,
                type: enums.banTypes.room,
            });

            global.io.emit(room._id, {
                type: 'command-unban',
                data: {
                    name: banned.name,
                    from: !req.user.is_spy ? req.user.name : 'سيرفر',
                },
            });

            global.io.emit(room.isMeeting ? room.parentRef : room.meetingRef, {
                type: 'command-unban',
                data: {
                    name: banned.name,
                    from: !req.user.is_spy ? req.user.name : 'سيرفر',
                },
            });

            addAdminLog(
                req.user,
                room._id,
                `قام بإلغاء حظر عضو`,
                `has unbanned a user`,
                banned.name,
            );
        } else {
            console.log('banned user not found');
        }

        return res.status(200).send({
            ok: true,
        });
    } catch (e) {
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});
router.post('/unban-ip', async (req, res) => {
    try {
        let room = req.room;

        const banned = await bannedModel.findOne({
            ip: req.body._id,
            type: enums.banTypes.ip,
        });

        if (banned) {
            await bannedModel.deleteOne({
                _id: banned._id,
            });

            global.io.emit(room._id, {
                type: 'command-unban',
                data: {
                    name: banned.name,
                    from: !req.user.is_spy ? req.user.name : 'سيرفر',
                },
            });

            global.io.emit(room.isMeeting ? room.parentRef : room.meetingRef, {
                type: 'command-unban',
                data: {
                    name: banned.name,
                    from: !req.user.is_spy ? req.user.name : 'سيرفر',
                },
            });

            addAdminLog(
                req.user,
                room._id,
                `قام بإلغاء حظر عضو`,
                `has unbanned a user`,
                banned.name,
            );
        }

        return res.status(200).send({
            ok: true,
        });
    } catch (e) {
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.post('/alert', userInRoomMiddleware, async (req, res) => {
    try {
        let room = req.room;
        const user = await getUserById(req.body.user_id, room._id);

        global.io.emit(room._id, {
            type: 'command-alert',
            data: {
                msg: req.body.msg,
                user_id: req.body.user_id,
                from: !req.user.is_spy ? req.user.name : 'سيرفر',
            },
        });

        global.io.emit(room.isMeeting ? room.parentRef : room.meetingRef, {
            type: 'command-alert',
            data: {
                msg: req.body.msg,
                user_id: req.body.user_id,
                from: !req.user.is_spy ? req.user.name : 'سيرفر',
            },
        });

        addAdminLog(req.user, room._id, `قام بتنبيه عضو`, `has alerted a user`, user.name, false);

        return res.status(200).send({
            ok: true,
        });
    } catch (e) {
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.post('/clear-all', async (req, res) => {
    try {
        let room = req.room;

        global.io.emit(room._id, {
            type: 'command-clear-all',
            data: {
                ok: true,
                from: !req.user.is_spy ? req.user.name : 'سيرفر',
            },
        });

        addAdminLog(
            req.user,
            room._id,
            `قام بمسح النص للجميع`,
            `has cleared the messages`,
            null,
            true,
            true,
        );

        return res.status(200).send({
            ok: true,
        });
    } catch (e) {
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.post('/kick', userInRoomMiddleware, async (req, res) => {
    try {
        let room = req.room;

        const user = await getUserById(req.body.user_id, room._id);

        global.io.emit(room._id, {
            type: 'command-kick',
            data: {
                user_id: user._id,
                name: user.name,
                from: !req.user.is_spy ? req.user.name : 'سيرفر',
            },
        });

        addAdminLog(req.user, room._id, `قام بطرد عضو`, `has Kicked-out a user`, user.name);

        return res.status(200).send({
            ok: true,
        });
    } catch (e) {
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.post('/stop', userInRoomMiddleware, async (req, res) => {
    try {
        let room = req.room;
        let user = await getUserById(req.body.user_id, room._id);

        let isStoppedBefore =
            !user.can_private_chat ||
            !user.can_public_chat ||
            !user.can_use_camera ||
            !user.can_use_mic;
        let isStoppedAfter = false;

        let updatedUser = {
            can_public_chat: !req.body.public_chat,
            can_private_chat: !req.body.private_chat,
            can_use_mic: !req.body.mic,
            can_use_camera: !req.body.camera,
            stop_strong_public_chat: req.body.public_chat ? req.user.strong : 0,
            stop_strong_private_chat: req.body.private_chat ? req.user.strong : 0,
            stop_strong_use_mic: req.body.mic ? req.user.strong : 0,
            stop_strong_use_camera: req.body.camera ? req.user.strong : 0,
        };

        await updateUser(updatedUser, user._id, room._id);
        if (room.isMeeting) {
            await updateUser(updatedUser, user._id, room.parentRef);
        } else {
            await updateUser(updatedUser, user._id, room.meetingRef);
        }

        let meetingUser = await getUserById(
            req.body.user_id,
            room.isMeeting ? room.parentRef : room.meetingRef,
        );
        isStoppedAfter =
            !meetingUser.can_private_chat ||
            !meetingUser.can_public_chat ||
            !meetingUser.can_use_camera ||
            !meetingUser.can_use_mic;

        let roomsToNotify = [room._id, room.isMeeting ? room.parentRef : room.meetingRef];
        roomsToNotify.forEach(async (roomId) => {
            global.io.emit(roomId, {
                type: 'info-change',
                data: await public_user(meetingUser),
                from: req.user.is_spy ? 'سيرفر' : req.user.name,
            });

            global.io.emit(roomId, {
                type: 'command-stop',
                data: {
                    user_id: req.body.user_id,
                    user: await public_user(meetingUser),
                    from: req.user.is_spy ? 'سيرفر' : req.user.name,
                },
            });

            if (req.body.mic) {
                stopMic(req.body.user_id, roomId.toString());
            }
        });

        let logMsgAr =
            isStoppedBefore && !isStoppedAfter ? `قام بإلغاء إيقاف عضو` : `قام بإيقاف عضو`;
        let logMsgEn =
            isStoppedBefore && !isStoppedAfter ? `has unstopped a user` : `has stopped a user`;
        addAdminLog(req.user, room._id, logMsgAr, logMsgEn, user.name);

        return res.status(200).send({ ok: true });
    } catch (e) {
        console.error(e);
        return res.status(500).send({ ok: false, error: e.message });
    }
});

router.post('/unstop', userInRoomMiddleware, async (req, res) => {
    try {
        let room = req.room;
        let user = await getUserById(req.body.user_id, room._id);

        let updatedUser = {
            can_public_chat: true,
            can_private_chat: true,
            can_use_mic: true,
            can_use_camera: true,
            stop_strong_public_chat: 0,
            stop_strong_private_chat: 0,
            stop_strong_use_mic: 0,
            stop_strong_use_camera: 0,
        };

        await updateUser(updatedUser, user._id, room._id);
        if (room.isMeeting) {
            await updateUser(updatedUser, user._id, room.parentRef);
        } else {
            await updateUser(updatedUser, user._id, room.meetingRef);
        }

        let meetingUser = await getUserById(
            req.body.user_id,
            room.isMeeting ? room.parentRef : room.meetingRef,
        );

        let roomsToNotify = [room._id, room.isMeeting ? room.parentRef : room.meetingRef];
        roomsToNotify.forEach(async (roomId) => {
            global.io.emit(roomId, {
                type: 'info-change',
                data: await public_user(meetingUser),
                from: req.user.is_spy ? 'سيرفر' : req.user.name,
            });

            global.io.emit(roomId, {
                type: 'command-stop',
                data: {
                    user_id: req.body.user_id,
                    user: await public_user(meetingUser),
                    from: req.user.is_spy ? 'سيرفر' : req.user.name,
                },
            });
        });

        addAdminLog(req.user, room._id, `قام بإلغاء إيقاف عضو`, `has unstopped a user`, user.name);

        return res.status(200).send({ ok: true });
    } catch (e) {
        console.error(e);
        return res.status(500).send({ ok: false, error: e.message });
    }
});

router.post('/set-joker', userInRoomMiddleware, async (req, res) => {
    try {
        let room = req.room;

        let user = await getUserById(req.body.user_id, room._id);

        const value = req.body.is_joker == true;

        const users_in_room = await getUsersInRoom(room._id, false, false);
        if (value) {
            let is_joker_exists = false;

            users_in_room.forEach((u) => {
                if (u.is_joker) is_joker_exists = true;
            });
            if (is_joker_exists || user.is_joker) {
                return res.status(400).send({
                    ok: false,
                    msg_ar: 'الحوكر موجود بالفعل',
                    msg_en: 'joker is already exist',
                });
            }
        }

        user.is_joker = value;
        user.order = user.is_joker ? 10 : 0;

        if (!user.is_joker) {
            await endJokerInRoom(room);
        }

        await updateUser(user, user._id, room._id);

        await notifyUserChanged(user._id);

        global.io.emit(room._id, {
            type: 'info-change',
            data: await public_user(user),
            toast: {
                ar:
                    (user.is_joker ? 'تم تعيينك جوكر' : 'تم إزالتك جوكر') +
                    ' من قبل ' +
                    req.user.name,
                en: (user.is_joker ? 'joker granted' : 'joker removed') + ' by ' + req.user.name,
            },
        });

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

module.exports = router;
