const express = require('express');
const router = express.Router();
var ObjectId = require('mongoose').Types.ObjectId;
const helpers = require('../../helpers/helpers');
const privateChatModel = require('../../models/privateChatModel');
const privateMessageModel = require('../../models/privateMessageModel');
const roomModel = require('../../models/roomModel');
const enums = require('../../helpers/enums');
const {
    deleteMyChat,
    getMyPrivateChats,
    canStartPrivateChat,
} = require('../../helpers/privateChatHelpers');
const { getUserById, public_user } = require('../../helpers/userHelpers');

router.get('/all/:room_id', async (req, res) => {
    try {
        let xuser = await helpers.getUserByToken(req.headers.token);

        if (xuser) {
            const private_chats = await getMyPrivateChats(req.params.room_id, xuser._id, false);
            res.status(200).send({
                ok: true,
                chats: private_chats,
            });
        }
    } catch (e) {
        console.log(e);
        res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.post('/create', async (req, res) => {
    try {
        let xuser = await helpers.getUserByToken(req.headers.token);
        let room = await roomModel.findById(req.headers.room_id);
        console.log('private room id ', room._id);
        if (xuser && room) {
            //let otherUser = await getUserById(req.body.to, room._id);
            const { allowed, msg_en, msg_ar } = await canStartPrivateChat(xuser, room);
            if (!allowed) {
                console.log('not allowed');
                return res.status(200).send({ ok: false, msg_en, msg_ar });
            }
            // if (room.private_status == 0) {
            //     return res.status(200).send({
            //         ok: false,
            //         msg_en: 'Private chat is not available in this room',
            //         msg_ar: 'الرسائل الخاصة معطلة في هذه الغرفة للجميع',
            //     });
            // }

            // const tempUser = await public_user(xuser);
            // if (room.private_status == 2) {
            //     if (tempUser.type.toString() == enums.userTypes.guest.toString()) {
            //         return res.status(200).send({
            //             ok: false,
            //             msg_en: 'Private chat is available for members and admins only',
            //             msg_ar: 'الرسائل الخاصة في هذه الغرفة متاحة للمشرفين والأعضاء فقط',
            //         });
            //     }
            // }

            // if (room.private_status == 3) {
            //     if (
            //         ![
            //             enums.userTypes.mastermain.toString(),
            //             enums.userTypes.chatmanager.toString(),
            //             enums.userTypes.root.toString(),
            //             enums.userTypes.master.toString(),
            //             enums.userTypes.mastergirl.toString(),
            //         ].includes(tempUser.type.toString())
            //     ) {
            //         return res.status(200).send({
            //             ok: false,
            //             msg_en: 'Private chat is available for admins only',
            //             msg_ar: 'الرسائل الخاصة في هذه الغرفة متاحة للمشرفين فقط',
            //         });
            //     }
            // }

            // if (!xuser.can_private_chat || !xuser.server_can_private_chat) {
            //     return res.status(200).send({
            //         ok: false,
            //         msg_en: 'You are banned to use private chat',
            //         msg_ar: 'أنت ممنوع من استقبال وارسال المحادثات الخاصة',
            //     });
            // }

            // if (!otherUser.can_private_chat || !otherUser.server_can_private_chat) {
            //     return res.status(200).send({
            //         ok: false,
            //         msg_en: 'This user has been banned to use private chat',
            //         msg_ar: 'هذا المستخدم ممنوع من استقبال وارسال المحادثات الخاصة',
            //     });
            // }

            // if (otherUser.private_status == 0) {

            //         global.io.to(otherUser.socketId).emit(room._id, {
            //             type: 'admin-changes',
            //             target: room._id,
            //             data: {
            //                 ar: xuser.name + ' يحاول إرسال رسالة خاصة لك',
            //                 en: xuser.name + ' is trying to send a private message',
            //             },
            //         });

            //     return res.status(200).send({
            //         ok: false,
            //         msg_en: "This user doesn't receive private chats",
            //         msg_ar: 'هذا المستخدم لا يستقبل الرسائل الخاصة ',
            //     });
            // }

            const myChats = await privateChatModel.find({
                $or: [
                    {
                        user1Ref: new ObjectId(xuser._id),
                        roomRef: new ObjectId(room._id),
                    },
                    {
                        user2Ref: new ObjectId(xuser._id),
                        roomRef: new ObjectId(room._id),
                    },
                ],
            });

            if (myChats.length >= 10) {
                return res.status(200).send({
                    ok: false,
                    msg_en: 'You cannot start more than 10 private chats',
                    msg_ar: 'يسمح لك فقط بالدردشة  الخاصة 10 مستخدمين الرجاء اغلاق محادثه خاصه واحده او اكثر ليتسنى ارسال محادثة أخرى  جديدة',
                });
            }

            let chat = null;

            let filters = [
                {
                    user1Ref: new ObjectId(xuser._id),
                    user2Ref: new ObjectId(req.body.to),
                    roomRef: new ObjectId(room._id),
                },
                {
                    user1Ref: new ObjectId(req.body.to),
                    user2Ref: new ObjectId(xuser._id),
                    roomRef: new ObjectId(room._id),
                },
            ];

            if (!room.isMeeting) {
                filters.push({
                    user1Ref: new ObjectId(req.body.to),
                    user2Ref: new ObjectId(xuser._id),
                    roomRef: new ObjectId(room.parentRef),
                });
            } else {
                filters.push({
                    user1Ref: new ObjectId(req.body.to),
                    user2Ref: new ObjectId(xuser._id),
                    roomRef: new ObjectId(room.meetingRef),
                });
            }

            const old = await privateChatModel
                .find({
                    $or: filters,
                })
                .populate(['user1Ref', 'user2Ref']);

            if (old.length > 0) {
                chat = old[0];
                chat.isUser1Deleted = false;
                chat.isUser2Deleted = false;
                chat.save();
            } else {
                const key = helpers.generateKey(10);
                chat = await privateChatModel.create({
                    user1Ref: xuser._id,
                    user2Ref: req.body.to,
                    roomRef: room._id,
                    key: key,
                });
            }
            let u1 = await getUserById(xuser._id, room._id);
            let u2 = await getUserById(req.body.to, room._id);

            u1 = await public_user(u1);
            u2 = await public_user(u2);

            chat = { ...JSON.parse(JSON.stringify(chat)) };
            chat.user1Ref = u1;
            chat.user2Ref = u2;

            const fieldName =
                chat.user1Ref._id.toString() == xuser._id.toString()
                    ? 'isUser1Deleted'
                    : 'isUser2Deleted';

            const msgs = await privateMessageModel.find({
                chatRef: new ObjectId(chat._id),
                [fieldName]: false,
            });

            res.status(200).send({
                ok: true,
                chat: {
                    ...JSON.parse(JSON.stringify(chat)),
                    msgs: msgs,
                },
            });
        } else {
            console.log('wrong room or user');
        }
    } catch (e) {
        console.error(e);
        res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.get('/get-msgs/:key', async (req, res) => {
    try {
        console.log('/get-msgs/:key', req.params.key);
        let xuser = await helpers.getUserByToken(req.headers.token);

        if (xuser) {
            let pc = await privateChatModel.find({ key: req.params.key });
            if (pc.length > 0) {
                pc = pc[0];
                await privateMessageModel.updateMany(
                    {
                        chatRef: new ObjectId(pc._id),
                        userRef: { $ne: new ObjectId(xuser._id) },
                    },
                    {
                        $set: {
                            isRead: true,
                        },
                    },
                    {
                        multi: true,
                    },
                );

                const fieldName =
                    pc.user1Ref._id.toString() == xuser._id.toString()
                        ? 'isUser1Deleted'
                        : 'isUser2Deleted';

                const msgs = await privateMessageModel.find({
                    chatRef: new ObjectId(pc._id),
                    [fieldName]: false,
                });

                res.status(200).send({
                    ok: true,
                    msgs: msgs,
                });
            } else {
                console.log('private chat not found');
            }
        } else {
            console.log('user not found');
        }
    } catch (e) {
        console.log(e);
        res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.get('/read-all/:key', async (req, res) => {
    try {
        console.log('/read-all/:key');
        let xuser = await helpers.getUserByToken(req.headers.token);

        if (xuser) {
            const pc = await privateChatModel.find({ key: req.params.key });
            if (pc.length > 0) {
                await privateMessageModel.updateMany(
                    {
                        chatRef: new ObjectId(pc[0]._id),
                        userRef: { $ne: new ObjectId(xuser._id) },
                    },
                    {
                        $set: {
                            isRead: true,
                        },
                    },
                    {
                        multi: true,
                    },
                );

                res.status(200).send({
                    ok: true,
                });
            }
        }
    } catch (e) {
        res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.delete('/delete/:key', async (req, res) => {
    try {
        let xuser = await helpers.getUserByToken(req.headers.token);

        if (xuser) {
            await deleteMyChat(xuser, req.params.key);

            res.status(200).send({
                ok: true,
            });
        }
    } catch (e) {
        res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

module.exports = router;
