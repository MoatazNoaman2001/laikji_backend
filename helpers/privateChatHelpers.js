const privateChatModel = require('../models/privateChatModel');
const privateMessageModel = require('../models/privateMessageModel');
const roomModel = require('../models/roomModel');
const { public_user } = require('./userHelpers');
var ObjectId = require('mongoose').Types.ObjectId;
const enums = require('./enums');
const getMyPrivateChats = async (room_id, user_id, only_meeting = true) => {
    let room = await roomModel.findById(room_id);

    if (!room.isMeeting && only_meeting) return [];

    let filter = [
        {
            user1Ref: new ObjectId(user_id),
            isUser1Deleted: false,
            roomRef: new ObjectId(room_id),
        },
        {
            user2Ref: new ObjectId(user_id),
            isUser2Deleted: false,
            roomRef: new ObjectId(room_id),
        },
        {
            user1Ref: new ObjectId(user_id),
            isUser1Deleted: false,
            roomRef: new ObjectId(room.parentRef),
        },
        {
            user2Ref: new ObjectId(user_id),
            isUser2Deleted: false,
            roomRef: new ObjectId(room.parentRef),
        },
    ];

    const private_chats = await privateChatModel
        .find({
            $or: filter,
        })
        .populate(['user1Ref', 'user2Ref']);

    let res = [];
    await Promise.all(
        private_chats.map(async (pc, i) => {
            let npc = { ...pc._doc };
            npc.user1Ref = await public_user(npc.user1Ref);
            npc.user2Ref = await public_user(npc.user2Ref);

            const last = await privateMessageModel
                .find({
                    chatRef: new ObjectId(npc._id),
                })
                .sort('-creationDate')
                .limit(1);

            const unReadMsgsCount = await privateMessageModel.countDocuments({
                chatRef: new ObjectId(npc._id),
                userRef: { $ne: new ObjectId(user_id) },
                isRead: false,
            });

            npc.newMsgs = unReadMsgsCount;

            res.push({ ...npc, last: last.length > 0 ? last[0] : null });

            return pc;
        }),
    );

    return res;
};

const deleteMyChat = async (xuser, key = null, room_id = null) => {
    let condition = [
        {
            user1Ref: new ObjectId(xuser._id),
        },
        {
            user2Ref: new ObjectId(xuser._id),
        },
    ];

    if (key) {
        condition[0].key = key;
        condition[1].key = key;
    }

    if (room_id) {
        condition[0].roomRef = new ObjectId(room_id);
        condition[1].roomRef = new ObjectId(room_id);
    }

    let pcs = await privateChatModel
        .find({
            $or: condition,
        })
        .populate(['user1Ref', 'user2Ref']);

    if (pcs.length > 0) {
        for (let i = 0; i < pcs.length; i++) {
            const pc = pcs[i];

            const fieldName =
                pc.user1Ref._id.toString() == xuser._id.toString()
                    ? 'isUser1Deleted'
                    : 'isUser2Deleted';

            pc[fieldName] = true;
            if (pc.isUser1Deleted && pc.isUser2Deleted) {
                await privateChatModel.findByIdAndDelete(pc._id);
            } else {
                await privateChatModel.findByIdAndUpdate(pc._id, {
                    [fieldName]: true,
                });
            }

            await privateMessageModel.updateMany(
                {
                    chatRef: new ObjectId(pc._id),
                },
                {
                    $set: {
                        [fieldName]: true,
                    },
                },
                {
                    multi: true,
                },
            );
        }
    }

    await privateMessageModel.deleteMany({
        isUser1Deleted: true,
        isUser2Deleted: true,
    });
};

async function canStartPrivateChat(user, otherUser, room) {
    const tempUser = await public_user(user);
    const allowedTypes = [
        enums.userTypes.mastermain,
        enums.userTypes.chatmanager,
        enums.userTypes.root,
        enums.userTypes.master,
        enums.userTypes.mastergirl,
    ];
    // if (!user.can_private_chat || !user.server_can_private_chat) {
    //     return {
    //         allowed: false,
    //         msg_en: 'You are banned from using private chat.',
    //         msg_ar: 'أنت ممنوع من استخدام الرسائل الخاصة.',
    //     };
    // }

    if (room.private_status == 0) {
        console.log('not allowed 1');
        return {
            allowed: false,
            msg_en: 'Private chat is disabled in this room.',
            msg_ar: 'الرسائل الخاصة معطلة في هذه الغرفة.',
        };
    }

    if (room.private_status == 2 && tempUser.type.toString() == enums.userTypes.guest.toString()) {
        console.log('not allowed 2');

        return {
            allowed: false,
            msg_en: 'Only members and admins can use private chat in this room.',
            msg_ar: 'الرسائل الخاصة في هذه الغرفة متاحة للمشرفين والأعضاء فقط',
        };
    }

    if (room.private_status == 3 && !allowedTypes.includes(tempUser.type)) {
        console.log('not allowed 3', tempUser.type);
        return {
            allowed: false,
            msg_en: 'Only admins can use private chat in this room.',
            msg_ar: 'الرسائل الخاصة في هذه الغرفة متاحة للمشرفين فقط',
        };
    }
    if (!user.can_private_chat || !user.server_can_private_chat) {
        return {
            allowed: false,
            msg_en: 'You are banned to use private chat',
            msg_ar: 'أنت ممنوع من استقبال وارسال المحادثات الخاصة',
        };
    }
    if (!otherUser.can_private_chat || !otherUser.server_can_private_chat) {
        return {
            allowed: false,
            msg_en: 'This user has been banned to use private chat',
            msg_ar: 'هذا المستخدم ممنوع من استقبال وارسال المحادثات الخاصة',
        };
    }
    if (otherUser.private_status == 0) {
        global.io.to(otherUser.socketId).emit(room._id, {
            type: 'admin-changes',
            target: room._id,
            data: {
                ar: user.name + ' يحاول إرسال رسالة خاصة لك',
                en: user.name + ' is trying to send a private message',
            },
        });

        return {
            allowed: false,
            msg_en: "This user doesn't receive private chats",
            msg_ar: 'هذا المستخدم لا يستقبل الرسائل الخاصة ',
        };
    }
    return { allowed: true };
}

function validatePrivateMessageConditions(xuser, otherUser, room, pc) {
    const errors = [];
    const allowedTypes = [
        enums.userTypes.mastermain,
        enums.userTypes.chatmanager,
        enums.userTypes.root,
        enums.userTypes.master,
        enums.userTypes.mastergirl,
    ];
    if (!xuser.can_private_chat || !xuser.server_can_private_chat) {
        errors.push({
            key: 'new-alert',
            msg_en: 'You are banned from private chat.',
            msg_ar: 'أنت محظور من أرسال واستقبال الرسائل الخاصة',
        });
    }

    if (!otherUser.can_private_chat || !otherUser.server_can_private_chat) {
        errors.push({
            key: 'new-alert',
            msg_en: 'This user is banned from private chat.',
            msg_ar: 'هذا المستخدم محظور من أرسال واستقبال الرسائل الخاصة',
        });
    }

    const isDeleted = (userId) => {
        return (
            (userId == pc.user1Ref._id.toString() && pc.isUser1Deleted) ||
            (userId == pc.user2Ref._id.toString() && pc.isUser2Deleted)
        );
    };

    if (otherUser.private_status == 0 && isDeleted(otherUser._id)) {
        global.io.to(otherUser.socketId).emit(room._id, {
            type: 'admin-changes',
            target: room._id,
            data: {
                ar: xuser.name + ' يحاول إرسال رسالة خاصة لك',
                en: xuser.name + ' is trying to send a private message',
            },
        });

        errors.push({
            key: 'new-alert',
            msg_en: "This user doesn't receive private chats",
            msg_ar: 'هذا المستخدم لا يستقبل الرسائل الخاصة',
        });
    }
    if (
        room.private_status == 3 &&
        isDeleted(otherUser._id) &&
        !allowedTypes.includes(xuser.type)
    ) {
        errors.push({
            key: 'new-alert',
            msg_en: 'Only admins can use private chat in this room.',
            msg_ar: 'الرسائل الخاصة في هذه الغرفة متاحة للمشرفين فقط',
        });
    }
    if (room.private_status == 2 && isDeleted(otherUser._id)) {
        errors.push({
            key: 'new-alert',
            msg_en: 'Private chat is not available in this room',
            msg_ar: 'الرسائل الخاصة معطلة في هذه الغرفة للجميع',
        });
    }
    if (
        room.private_status == 3 &&
        isDeleted(otherUser._id) &&
        xuser.type.toString() == enums.userTypes.guest.toString()
    ) {
        errors.push({
            key: 'new-alert',
            msg_en: 'Private chat is available for admins only',
            msg_ar: 'الرسائل الخاصة في هذه الغرفة متاحة للمشرفين والأعضاء فقط',
        });
    }

    return errors;
}

module.exports = {
    getMyPrivateChats,
    deleteMyChat,
    canStartPrivateChat,
    validatePrivateMessageConditions,
};
