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
                    key: user.key,
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
                    key: user.key,
                    roomRef: room._id,
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
                user_id: user._id,
                name: user.name,
                from: !req.user.is_spy ? req.user.name : 'سيرفر',
            },
        });

        global.io.emit(room.isMeeting ? room.parentRef : room.meetingRef, {
            type: 'command-ban',
            data: {
                user_id: user._id,
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

router.post('/ban-entry', async (req, res) => {
    try {
        let room = req.room;

        const entry = await entryLogModel.findById(req.body.entry_id);

        if (!entry) {
            return res.status(200).send({
                ok: true,
            });
        }

        let bb = await bannedModel.findOneAndUpdate(
            {
                key: entry.key,
                roomRef: room._id,
            },
            {
                roomRef: room._id,
                userRef: entry.userRef,
                memberRef: entry.memberRef ? entry.memberRef : null,
                name: entry.name,
                country: entry.country,
                ip: entry.ip,
                key: entry.key,
                banner_strong: req.user.strong,
            },
            { upsert: true, new: true },
        );

        global.io.emit(room._id, {
            type: 'command-ban',
            data: {
                user_id: entry.userRef,
                name: entry.name,
                from: !req.user.is_spy ? req.user.name : 'سيرفر',
            },
        });

        global.io.emit(room.isMeeting ? room.parentRef : room.meetingRef, {
            type: 'command-ban',
            data: {
                user_id: user ? user._id : null,
                name: entry.name,
                from: !req.user.is_spy ? req.user.name : 'سيرفر',
            },
        });

        addAdminLog(req.user, room._id, `قام بحظر عضو`, `has banned a user`, entry.name);

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
            _id: new ObjectId(req.body._id),
        });

        if (banned) {
            await bannedModel.deleteOne({
                _id: new ObjectId(req.body._id),
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

        let isStoppedBefore = false;
        let isStoppedAfter = false;

        if (req.user.is_spy) {
            let until = -1;

            if (
                !req.body.public_chat &&
                !req.body.private_chat &&
                !req.body.mic &&
                !req.body.camera
            ) {
                until = null;
            }

            await userModal.findByIdAndUpdate(user._id, {
                server_can_public_chat: !req.body.public_chat,
                server_can_private_chat: !req.body.private_chat,
                server_can_use_mic: !req.body.mic,
                server_can_use_camera: !req.body.camera,
                server_stop_until: until == -1 ? null : until,
                server_stop_time: null,
            });

            user = await getUserById(user._id, room._id);
        } else {
            if (
                !user.can_private_chat ||
                !user.can_public_chat ||
                !user.can_use_camera ||
                !user.can_use_mic
            ) {
                isStoppedBefore = true;
            }

            if (req.user.strong >= user.stop_strong_public_chat) {
                if (req.body.public_chat == true) {
                    user.can_public_chat = false;
                    user.stop_strong_public_chat = req.user.strong;
                } else if (req.body.public_chat == false) {
                    user.can_public_chat = true;
                    user.stop_strong_public_chat = 0;
                }
            }

            if (req.user.strong >= user.stop_strong_private_chat) {
                if (req.body.private_chat == true) {
                    user.can_private_chat = false;
                    user.stop_strong_private_chat = req.user.strong;
                } else if (req.body.private_chat == false) {
                    user.can_private_chat = true;
                    user.stop_strong_private_chat = 0;
                }
            }

            if (req.user.strong >= user.stop_strong_use_mic) {
                if (req.body.mic == true) {
                    user.can_use_mic = false;
                    user.stop_strong_use_mic = req.user.strong;
                } else if (req.body.mic == false) {
                    user.can_use_mic = true;
                    user.stop_strong_use_mic = 0;
                }
            }

            if (req.user.strong >= user.stop_strong_use_camera) {
                if (req.body.camera == true) {
                    user.can_use_camera = false;
                    user.stop_strong_use_camera = req.user.strong;
                } else if (req.body.camera == false) {
                    user.can_use_camera = true;
                    user.stop_strong_use_camera = 0;
                }
            }

            await updateUser(user, user._id, room._id);

            if (
                !user.can_private_chat ||
                !user.can_public_chat ||
                !user.can_use_camera ||
                !user.can_use_mic
            ) {
                isStoppedAfter = true;
            }
        }

        const meeting_user = await getUserById(
            req.body.user_id,
            room.isMeeting ? room.parentRef : room.meetingRef,
        );

        global.io.emit(room._id, {
            type: 'info-change',
            data: await public_user(user),
            from: !req.user.is_spy ? req.user.name : 'سيرفر',
        });

        global.io.emit(room._id, {
            type: 'command-stop',
            data: {
                user_id: req.body.user_id,
                user: await public_user(user),
                from: !req.user.is_spy ? req.user.name : 'سيرفر',
            },
        });

        global.io.emit(room.isMeeting ? room.parentRef : room.meetingRef, {
            type: 'info-change',
            data: await public_user(meeting_user),
            from: !req.user.is_spy ? req.user.name : 'سيرفر',
        });

        global.io.emit(room.isMeeting ? room.parentRef : room.meetingRef, {
            type: 'command-stop',
            data: {
                user_id: req.body.user_id,
                user: await public_user(meeting_user),
                from: !req.user.is_spy ? req.user.name : 'سيرفر',
            },
        });
        global.io.emit(room.isMeeting ? room.parentRef : room.meetingRef, {
            type: 'stop-mic',
            data: {
                userId: req.body.user_id,
            },
        });

        let msg_ar = `قام بإيقاف عضو`;
        let msg_en = `has stopped a user`;

        if (isStoppedBefore && isStoppedAfter) {
            msg_ar = `قام بتعديل إيقاف عضو`;
            msg_en = `has edited stop a user`;
        } else if (isStoppedBefore && !isStoppedAfter) {
            msg_ar = `قام بإلغاء إيقاف عضو`;
            msg_en = `has unstopped a user`;
        } else if (!isStoppedBefore && isStoppedAfter) {
            msg_ar = `قام بإيقاف عضو`;
            msg_en = `has stopped a user`;
        }

        addAdminLog(req.user, room._id, msg_ar, msg_en, user.name);

        if (!user.can_private_chat || !user.server_can_private_chat) {
            let condition = [
                {
                    user1Ref: new ObjectId(user._id),
                },
                {
                    user2Ref: new ObjectId(user._id),
                },
            ];
            let pcs = await privateChatModel.find({
                $or: condition,
            });

            if (pcs.length > 0) {
                for (let i = 0; i < pcs.length; i++) {
                    const pc = pcs[i];
                    await privateChatModel.findByIdAndDelete(pc._id);
                    await privateMessageModel.deleteMany({
                        chatRef: new ObjectId(pc._id),
                    });
                }
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

router.post('/unstop', userInRoomMiddleware, async (req, res) => {
    try {
        let room = req.room;

        const user = await getUserById(req.body.user_id, room._id);

        await updateUser(
            {
                can_public_chat: true,
                can_private_chat: true,
                can_use_mic: true,
                can_use_camera: true,
                stop_strong_public_chat: 0,
                stop_strong_private_chat: 0,
                stop_strong_use_mic: 0,
                stop_strong_use_camera: 0,
            },
            user._id,
            room._id,
        );

        const meeting_user = await getUserById(
            req.body.user_id,
            room.isMeeting ? room.parentRef : room.meetingRef,
        );

        global.io.emit(room._id, {
            type: 'info-change',
            data: await public_user(user),
            from: !req.user.is_spy ? req.user.name : 'سيرفر',
        });

        global.io.emit(room._id, {
            type: 'command-stop',
            data: {
                user_id: req.body.user_id,
                user: await public_user(user),
                from: !req.user.is_spy ? req.user.name : 'سيرفر',
            },
        });

        global.io.emit(room.isMeeting ? room.parentRef : room.meetingRef, {
            type: 'info-change',
            data: await public_user(meeting_user),
            from: !req.user.is_spy ? req.user.name : 'سيرفر',
        });

        global.io.emit(room.isMeeting ? room.parentRef : room.meetingRef, {
            type: 'command-stop',
            data: {
                user_id: req.body.user_id,
                user: await public_user(meeting_user),
                from: !req.user.is_spy ? req.user.name : 'سيرفر',
            },
        });

        addAdminLog(req.user, room._id, `قام بإلغاء إيقاف عضو`, `has unstopped a user`, user.name);

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
