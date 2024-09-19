const privateChatModel = require('../models/privateChatModel');
const privateMessageModel = require('../models/privateMessageModel');
const roomModel = require('../models/roomModel');
const { public_user } = require('./userHelpers');
var ObjectId = require('mongoose').Types.ObjectId;
const ignoredUsers = new Map()

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

module.exports = {
    getMyPrivateChats,
    deleteMyChat,
    ignoredUsers
};
