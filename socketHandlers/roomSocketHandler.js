// import { v4 as uuidv4, v6 as uuidv6 } from 'uuid';
const helpers = require('../helpers/helpers');
const enums = require('../helpers/enums');
const roomModel = require('../models/roomModel');
const { v4: uuidv4 } = require('uuid');

const { public_room } = require('../helpers/helpers');
const { addEntryLog, addAdminLog } = require('../helpers/Logger');
const {
    releaseMic,
    assignSpeaker,
    clearActiveTimers,
    getUserTimeLeft,
    startInterval,
} = require('../helpers/micHelpers');
const memberModal = require('../models/memberModal');
const { filterMsg } = require('../helpers/filterHelpers');
const { getMyPrivateChats, deleteMyChat, ignoredUsers } = require('../helpers/privateChatHelpers');
const {
    getFlagAndCountryCode,
    getUsersInRoom,
    getNameInRoom,
    getRegisteredUser,
    isRegisteredName,
    isBanned,
    removeUserFromRoom,
    addUserToRoom,
    createUser,
    updateUser,
    getUserById,
    public_user,
    isInvited,
    getUsersInWaiting,
    addUserToWaiting,
    removeUserFromWaiting,
    getMemberRemainingTime,
    isMemberStarted,
    getEnterIcon,
    getSpyUser,
    isBannedFromServer,
    notifyUserChanged,
} = require('../helpers/userHelpers');
const privateChatModel = require('../models/privateChatModel');
const privateMessageModel = require('../models/privateMessageModel');
var ObjectId = require('mongoose').Types.ObjectId;
const moment = require('moment/moment');
const { getNowDateTime } = require('../helpers/tools');
const registeredUserModal = require('../models/registeredUserModal');
const roomUsersModel = require('../models/roomUsersModel');
const { getRoomData } = require('../helpers/mediasoupHelpers');

var allMutedList = new Map(); // list for users whom muted all participarates
var mutedSpeakers = new Map();
module.exports = (io) => {
    io.use(async (socket, next) => {
        socket.handshake.query.name = socket.handshake.query.name.trim();
        let name = socket.handshake.query.name;
        let room_id = socket.handshake.query.roomId;
        let user_key = socket.handshake.query.key;
        let device = socket.handshake.query.device;
        let ip = socket.request.connection.remoteAddress;
        let rp = socket.handshake.query.rp;
        let fp = socket.handshake.query.fp;
        let mp = socket.handshake.query.mp;
        let inv = socket.handshake.query.inv;
        socket.handshake.query.icon = '0.png';

        console.log(
            'new client room:',
            name,
            'for room:',
            room_id,
            'IP:',
            ip,
            'KEY:',
            user_key,
            'DEVICE: ',
            device,
        );

        if (ip) {
            ip = ip.split(':').pop();
        }

        if (!room_id) {
            return next(
                new Error(
                    JSON.stringify({
                        error_code: 1,
                        msg_ar: 'no room id',
                        msg_en: 'no room id',
                    }),
                ),
            );
        }

        let room = await roomModel.findById(room_id);
        if (!room) {
            return next(
                new Error(
                    JSON.stringify({
                        error_code: 1,
                        msg_ar: 'no room founded',
                        msg_en: 'no room founded',
                    }),
                ),
            );
        }

        if (!helpers.isRoomStarted(room)) {
            return next(
                new Error(
                    JSON.stringify({
                        error_code: 6,
                        msg_ar:
                            'لم يبدأ تفعيل الغرفة بعد، سيتم تفعيلها ' +
                            moment(room.startDate).format('L'),
                        msg_en:
                            'This room has not been started yet, it will be started at ' +
                            moment(room.startDate).format('L'),
                    }),
                ),
            );
        }

        if (helpers.isRoomEnded(room)) {
            return next(
                new Error(
                    JSON.stringify({
                        error_code: 6,
                        msg_ar: 'الغرفة غير متوفرة تم انتهاء الاشتراك يرجى المحاولة في وقت لاحق',
                        msg_en: 'This room is not available at this time',
                    }),
                ),
            );
        }

        if (await isBannedFromServer(device)) {
            return next(
                new Error(
                    JSON.stringify({
                        error_code: 3,
                        msg_ar: 'أنت محضور سيرفر من ملتقى لأيك جي شات',
                        msg_en: "Sorry, You're banned from the server",
                    }),
                ),
            );
        }

        const spyUser = await getSpyUser(name, rp);

        if (spyUser == false) {
            return next(
                new Error(
                    JSON.stringify({
                        error_code: 7,
                        msg_ar: 'الاسم محمي ومسجل بالسيرفر يرجى اختيار اسم آخر',
                        msg_en: 'This name is protected and registered in the server, please choose another name',
                    }),
                ),
            );
        }

        const { flag, country_code } = getFlagAndCountryCode(ip);
        socket.handshake.query.country_code = country_code;
        socket.handshake.query.flag = flag;
        socket.handshake.query.ip = helpers.ip2num(ip);

        var users_in_room = await getUsersInRoom(room_id, true, false);
        var users_in_waiting = await getUsersInWaiting(room_id, true);

        if (users_in_room.length >= room.capacity) {
            return next(
                new Error(
                    JSON.stringify({
                        error_code: 16,
                        msg_ar: 'الغرفة ممتلئة يرجى محاولة الدخول في وقت لاحق',
                        msg_en: 'Room is full, please try again later',
                    }),
                ),
            );
        }

        users_in_room = [...users_in_room, ...users_in_waiting];

        let is_error = false;

        const same_user_name = getNameInRoom(name, users_in_room);

        if (same_user_name) {
            const sc = io.sockets.sockets.get(same_user_name.socketId);

            if (same_user_name.key == user_key && same_user_name.roomRef == room_id) {
                await removeUserFromRoom(room_id, same_user_name);
                if (sc) sc.disconnect();
            } else if (same_user_name.key != user_key || same_user_name.roomRef == room_id) {
                return next(
                    new Error(
                        JSON.stringify({
                            error_code: 1,
                            msg_ar: 'الاسم موجود بالغرفة، يرجى اختيار اسم آخر',
                            msg_en: 'Name Already Exists',
                        }),
                    ),
                );
            }
        }

        if (name != 'MASTER' && !room.isMeeting) {
            const same_member_name = await memberModal.findOne({
                username: name,
            });

            if (same_member_name) {
                if (!same_member_name.isMain && !same_member_name.roomRefs.includes(room_id)) {
                    if (same_member_name && same_member_name.password != fp) {
                        return next(
                            new Error(
                                JSON.stringify({
                                    error_code: 2,
                                    msg_ar: 'الاسم محمي ومسجل بالسيرفر يرجى اختيار اسم آخر',
                                    msg_en: 'This name is protected and registered in the server, please choose another name',
                                }),
                            ),
                        );
                    }
                }

                if (
                    same_member_name &&
                    (same_member_name.password == fp ||
                        (same_member_name.isMain && same_member_name.password == rp))
                ) {
                    if (!isMemberStarted(same_member_name)) {
                        return next(
                            new Error(
                                JSON.stringify({
                                    error_code: 4,
                                    msg_ar:
                                        'لم يبدأ تفعيل ملفك بعد، سيتم تفعيله بتاريخ ' +
                                        moment(same_member_name.startDate).format('L'),
                                    msg_en:
                                        'This file has not been started yet, it will be started at ' +
                                        moment(same_member_name.startDate).format('L'),
                                }),
                            ),
                        );
                    }

                    const remaining_time = getMemberRemainingTime(same_member_name);
                    if (remaining_time < 10000) {
                        return next(
                            new Error(
                                JSON.stringify({
                                    error_code: 5,
                                    msg_ar: 'تم انتهاء اشتراك هذه الملف يرجى مراجعة فريق الدعم',
                                    msg_en: 'This file has been expired, please contact support',
                                }),
                            ),
                        );
                    }
                }
            }
        }

        const registeredUser = await getRegisteredUser(name, rp, room_id);
        if (registeredUser) {
            if (registeredUser.is_locked === true) {
                if (registeredUser.locked_key && registeredUser.locked_key != device) {
                    return next(
                        new Error(
                            JSON.stringify({
                                error_code: 2,
                                msg_ar: 'الاسم مقفل ومسجل بالغرفة يرجى اختيار اسم آخر',
                                msg_en: 'This name has been registered and locked, please choose another name',
                            }),
                        ),
                    );
                }
                registeredUser.locked_key = device;
                await registeredUser.save();
            }

            socket.handshake.query.registeredUserId = registeredUser._id;

            if (
                (registeredUser.type == enums.userTypes.mastermain ||
                    registeredUser.type == enums.userTypes.root ||
                    registeredUser.type == enums.userTypes.chatmanager) &&
                !room.isMeeting
            ) {
                socket.handshake.query.isMain = true;
                socket.handshake.query.fp = rp;
                fp = rp;
                return next();
            }

            if (registeredUser.type == enums.userTypes.mastermain && room.isMeeting) {
                socket.handshake.query.isMain = true;
                socket.handshake.query.fp = rp;
                fp = rp;

                return next();
            }
        }

        if (room.isMeeting) {
            if (spyUser) {
                return next();
            }

            let is_invited = await isInvited(user_key, room);

            if (inv && is_invited) {
                return next();
            }

            if (!mp || room.meetingPassword != mp) {
                console.log('mp :', mp, 'room mp ', room.meetingPassword);
                return next(
                    new Error(
                        JSON.stringify({
                            error_code: 1,
                            msg_ar: 'كلمة مرور غرفة الاجتماعات خاطئة',
                            msg_en: 'Password is incorrect',
                        }),
                    ),
                );
                // io.to(socket.request.connection.socketId).emit('new-alert', {
                //     msg_ar: 'كلمة مرور غرفة الاجتماعات خاطئة',
                //     msg_en: 'Password is incorrect',
                // });
            }
        }

        if (await isBanned(device, room)) {
            return next(
                new Error(
                    JSON.stringify({
                        error_code: 3,
                        msg_ar: 'عذراً أنت محظور من دخول هذا الروم',
                        msg_en: "Sorry, You're banned",
                    }),
                ),
            );
        }

        if (!registeredUser) {
            if (await isRegisteredName(name, room_id)) {
                return next(
                    new Error(
                        JSON.stringify({
                            error_code: 3,
                            msg_ar: 'هذا الاسم مسجل بالغرفة، يرجى اختيار اسم آخر',
                            msg_en: 'This name has been registered, please choose another name',
                        }),
                    ),
                );
            }
        }

        if (!is_error) {
            next();
        }
        // console.log('cant reach here')
    }).on('connection', async (xclient) => {
        var xroomId;
        var key = xclient.handshake.query.key;
        var loginTime = xclient.handshake.query.time;

        console.log('on connection');
        // get room
        var room = await roomModel.findById(xclient.handshake.query.roomId);
        if (!room) {
            xclient.disconnect();
            return;
        }
        ////////////////// START ROOM LOGIN FUNCTIONS///////////////////////
        xroomId = room._id.toString();

        var member;
        var member_query = {
            password: xclient.handshake.query.fp,
            username: xclient.handshake.query.name,
        };

        if (xclient.handshake.query.isMain) {
            member_query.roomRefs = { $in: [new ObjectId(xroomId)] };
        }

        if (xclient.handshake.query.fp) {
            member = await memberModal.findOne(member_query);

            if (member) {
                if (!member.isMain || (member.isMain && xclient.handshake.query.isMain)) {
                    member = {
                        ...member._doc,
                        roomRef: room._id,
                    };
                } else {
                    member = null;
                }
            } else {
                member = null;
            }
        }

        var xuser;

        let regUser_id = null;
        if (xclient.handshake.query.registeredUserId) {
            regUser_id = xclient.handshake.query.registeredUserId;
        }

        if (!xuser) {
            xuser = await createUser(key, xroomId, member, regUser_id);
        }

        let os = xclient.handshake.query.os;
        if (
            !os ||
            os != enums.osTypes.android ||
            os != enums.osTypes.ios ||
            os != enums.osTypes.desktop
        )
            os = enums.osTypes.desktop;

        let update = {};
        if (member && member.type == enums.fileTypes.mastermain) {
            update.can_public_chat = true;
            update.can_private_chat = true;
            update.can_use_mic = true;
            update.can_use_camera = true;
            update.stop_strong_public_chat = 0;
            update.stop_strong_private_chat = 0;
            update.stop_strong_use_mic = 0;
            update.stop_strong_use_camera = 0;
        }

        var token = helpers.generateToken(xuser.roomUserRef);
        xuser = await updateUser(
            {
                name: xclient.handshake.query.name,
                icon: xclient.handshake.query.icon,
                img_key: xclient.handshake.query.img,
                os: xclient.handshake.query.os,
                img: await getEnterIcon(xclient.handshake.query.img),
                is_typing: false,
                is_meeting_typing: false,
                ip: xclient.handshake.query.ip,
                device: xclient.handshake.query.device ?? xclient.handshake.query.key,
                private_status:
                    xclient.handshake.query.ps == '1' || xclient.handshake.query.ps == '0'
                        ? parseInt(xclient.handshake.query.ps)
                        : 1,
                flag: process.env.mediaUrl + 'flags/' + xclient.handshake.query.flag,
                country_code: xclient.handshake.query.country_code,
                token: token,
                socketId: xclient.id,
                invited_to_meeting: false,
                room_password: xclient.handshake.query.rp ?? null,
                room_name: xclient.handshake.query.name,
                memberRef: member ? member._id : null,
                latestRoomRef: xroomId,
                isMain: xclient.handshake.query.isMain,
                userRef: xuser._id,
                ...update,
            },
            xuser._id,
            xroomId,
        );

        /////////////// ROOM LOGIN SUCCESS CASE ///////////////////
        const roomInfo = await getRoomData(xroomId);

        if (!allMutedList[xroomId]) {
            allMutedList[xroomId] = [];
        }
        if (!mutedSpeakers[xroomId]) {
            mutedSpeakers[xroomId] = [];
        }
        const continue_to_room = async () => {
            // add user to room
            xclient.join(xroomId);
            addUserToRoom(xroomId, xuser);
            await removeUserFromWaiting(xroomId, xuser);
            enterDate = getNowDateTime(true);

            console.info('[client accepted] id:', xuser.name, xuser._id, 'socketId:', xclient.id);
            xuser = await getUserById(xuser._id, xroomId);
            await helpers.notifyRoomChanged(xroomId, false, true);

            let users_in_room = await getUsersInRoom(xroomId, false, true);
            let users_in_waiting = [];

            if (xuser.permissions && xuser.permissions[6] == 1) {
                users_in_waiting = await getUsersInWaiting(xroomId, true);
            }

            if (!room.isMeeting) {
                await deleteMyChat(xuser);
            }

            const current_joker = await helpers.getJokerInRoom(room);
            if (current_joker && current_joker._id.toString() != xuser._id.toString()) {
                xuser.order = 0;
                xuser.is_joker = false;
            }

            if (!current_joker) {
                xuser.game_number = '';
                xuser.game_number_color = '255|255|255';
            }

            await updateUser(xuser, xuser._id, xroomId);

            const private_chats = await getMyPrivateChats(xroomId, xuser._id, true);
            console.log('started ' + JSON.stringify(roomInfo?.youtubeLink, null, 2));
            xclient.emit('started', {
                ok: true,
                user: xuser,
                member: member,
                room: await public_room(room),
                users: users_in_room,
                private_chats: private_chats,
                waiting_users: users_in_waiting,
                'muted-list': allMutedList[xroomId],
                micQueue: roomInfo != null ? roomInfo.micQueue : [],
                speakers: roomInfo != null ? Array.from(roomInfo.speakers) : {},
                link: roomInfo != null ? roomInfo.youtubeLink : {},
            });
            if (xuser.is_visible) {
                io.emit(xroomId, {
                    type: 'new-user',
                    data: await public_user(xuser),
                });
            }

            setInterval(async () => {
                const m = await memberModal.findOne(member_query);
                if (m) {
                    m.login_time += 1;
                    m.save();
                }
            }, 60 * 60 * 1000 * 9);

            xclient.on('send-msg', async (data) => {
                if (!xuser) return;
                xuser = await getUserById(xuser._id, xroomId);

                let res = {
                    key: uuidv4(),
                    type: data.type,
                    msg: filterMsg(data.msg, xroomId),
                    style: data.style,
                    chat: data.chat,
                    user: await public_user(xuser),
                    replay: null,
                };

                if (data.replay) {
                    res.replay = {
                        type: data.replay.type,
                        msg: data.replay.msg,
                        style: data.replay.style,
                        user: data.replay.user,
                    };
                }

                io.emit(data.chat, res);
            });

            xclient.on('ignore-user', async (data) => {
                if (!xuser) return;

                const userId = data.userId;
                const myId = data.myId;

                // Initialize an array for myId if it doesn't exist
                if (!ignoredUsers.has(myId)) {
                    ignoredUsers.set(myId, []);
                }

                const userIgnoreList = ignoredUsers.get(myId);
                const userIndex = userIgnoreList.indexOf(userId);

                if (userIndex !== -1) {
                    // User is already in the list, so remove them
                    userIgnoreList.splice(userIndex, 1);
                } else {
                    // User is not in the list, so add them
                    userIgnoreList.push(userId);
                }

                io.to(xuser.socketId).emit('new-toast', {
                    msg_ar: 'تم تجاهل المستخدم',
                    msg_en: 'User ignored successfully',
                    msg_fr: `Utilisateur ignoré avec succès`,
                });
            });

            xclient.on('private-screenshot-taken', async (data) => {
                const userId = data.userId;
                xuser = await getUserById(xuser._id, xroomId);

                const key = data.key;

                let pc = await privateChatModel
                    .find({
                        key: key,
                    })
                    .populate(['user1Ref', 'user2Ref']);

                pc = pc[0];

                let otherUser =
                    pc.user1Ref._id.toString() == xuser._id.toString() ? pc.user2Ref : pc.user1Ref;

                io.to(otherUser.socketId).emit('new-alert', {
                    msg_ar: `السيد ${xuser.name} يحاول التقاط الشاشة `,
                    msg_en: `Mr ${xuser.name} try to capture screenShot`,
                });
            });

            xclient.on('send-msg-private', async (data) => {
                try {
                    if (!xuser) return;

                    xuser = await getUserById(xuser._id, xroomId);

                    const key = data.key;
                    console.log('data key is ' + key);

                    let pc = await privateChatModel
                        .find({
                            key: key,
                        })
                        .populate(['user1Ref', 'user2Ref']);

                    pc = pc[0];

                    let otherUser =
                        pc.user1Ref._id.toString() == xuser._id.toString()
                            ? pc.user2Ref
                            : pc.user1Ref;

                    otherUser = await getUserById(otherUser._id, xroomId);
                    const room = await roomModel.findById(xroomId);

                    if (!otherUser.can_private_chat || !otherUser.server_can_private_chat) {
                        io.to(xuser.socketId).emit('new-alert', {
                            msg_en: 'This user is banned from using private chats',
                            msg_ar: 'هذا المستخدم محظور من أرسال واستقبال الرسائل الخاصة',
                        });
                        return;
                    }

                    if (!xuser.can_private_chat || !xuser.server_can_private_chat) {
                        io.to(xuser.socketId).emit('new-alert', {
                            msg_en: 'you are banned from using private chats',
                            msg_ar: 'أنت محظور من أرسال واستقبال الرسائل الخاصة',
                        });
                        return;
                    }

                    if (otherUser.private_status == 0) {
                        if (
                            (otherUser._id == pc.user1Ref._id.toString() && pc.isUser1Deleted) ||
                            (otherUser._id == pc.user2Ref._id.toString() && pc.isUser2Deleted)
                        ) {
                            io.to(xuser.socketId).emit('new-alert', {
                                msg_en: "This user doesn't receive private chats",
                                msg_ar: 'هذا المستخدم لا يستقبل الرسائل الخاصة',
                            });
                            return;
                        }
                    }

                    if (room.private_status == 3) {
                        console.log('user has deleted his messages');
                        if (
                            (otherUser._id == pc.user1Ref._id.toString() && pc.isUser1Deleted) ||
                            (otherUser._id == pc.user2Ref._id.toString() &&
                                pc.isUser2Deleted &&
                                ![
                                    enums.userTypes.mastermain.toString(),
                                    enums.userTypes.chatmanager.toString(),
                                    enums.userTypes.root.toString(),
                                    enums.userTypes.master.toString(),
                                    enums.userTypes.mastergirl.toString(),
                                ].includes(xuser.type.toString()))
                        ) {
                            io.to(xuser.socketId).emit('new-alert', {
                                ok: false,
                                msg_en: 'Private chat is available for admins only',
                                msg_ar: 'الرسائل الخاصة في هذه الغرفة متاحة للمشرفين فقط',
                            });
                            return;
                        }
                    }
                    if (room.private_status == 2) {
                        console.log('user has deleted his messages');
                        if (
                            (otherUser._id == pc.user1Ref._id.toString() && pc.isUser1Deleted) ||
                            (otherUser._id == pc.user2Ref._id.toString() &&
                                pc.isUser2Deleted &&
                                xuser.type.toString() === enums.userTypes.guest.toString())
                        ) {
                            io.to(xuser.socketId).emit('new-alert', {
                                ok: false,
                                msg_en: 'Private chat is available for admins only',
                                msg_ar: 'الرسائل الخاصة في هذه الغرفة متاحة للمشرفين والأعضاء فقط',
                            });
                            return;
                        }
                    }

                    pc.isUser1Deleted = false;
                    pc.isUser2Deleted = false;
                    pc.save();

                    let body = {
                        key: uuidv4(),
                        type: data.type,
                        msg: filterMsg(data.msg, xroomId),
                        style: data.style,
                        user: await public_user(xuser),
                        replay: null,
                    };

                    if (data.replay) {
                        body.replay = {
                            type: data.replay.type,
                            msg: data.replay.msg,
                            style: data.replay.style,
                            user: data.replay.user,
                        };
                    }

                    const msg = new privateMessageModel({
                        chatRef: pc._id,
                        userRef: xuser._id,
                        body: body,
                    });

                    await msg.save();

                    pc = { ...pc._doc };

                    let u1 = await getUserById(pc.user1Ref._id, xroomId);
                    let u2 = await getUserById(pc.user2Ref._id, xroomId);
                    pc = { ...JSON.parse(JSON.stringify(pc)) };
                    u1 = await public_user(u1);
                    u2 = await public_user(u2);
                    pc.user1Ref = u1;
                    pc.user2Ref = u2;

                    const unReadMsgsCount = await privateMessageModel.countDocuments({
                        chatRef: new ObjectId(pc._id),
                        userRef: new ObjectId(xuser._id),
                        isRead: false,
                    });

                    const otherRoom = await roomModel.findById(
                        room.isMeeting ? room.meetingRef : room.parentRef,
                    );

                    let otherUserInOtherRoom = null;
                    let xuserInOtherRoom = null;

                    if (otherRoom) {
                        otherUserInOtherRoom = await getUserById(otherUser._id, otherRoom._id);
                        xuserInOtherRoom = await getUserById(xuser._id, otherRoom._id);
                    }

                    io.to(otherUser.socketId).emit('new-private-msg', {
                        chat: {
                            ...pc,
                            last: msg,
                            newMsgs: unReadMsgsCount,
                        },
                        msg: msg,
                    });
                    console.log('private message .1');

                    if (otherUserInOtherRoom) {
                        console.log('private message .2');

                        io.to(otherUserInOtherRoom.socketId).emit('new-private-msg', {
                            chat: {
                                ...pc,
                                last: msg,
                                newMsgs: unReadMsgsCount,
                            },
                            msg: msg,
                        });
                    }

                    io.to(xuser.socketId).emit('new-private-msg', {
                        chat: {
                            ...pc,
                            last: msg,
                            newMsgs: 0,
                        },
                        msg: msg,
                    });
                    console.log('private message .3 ');

                    if (xuserInOtherRoom) {
                        console.log('private message .4');

                        io.to(xuserInOtherRoom.socketId).emit('new-private-msg', {
                            chat: {
                                ...pc,
                                last: msg,
                                newMsgs: 0,
                            },
                            msg: msg,
                        });
                    }
                } catch (err) {
                    console.error('Error in send-msg-private:', err);
                    io.to(xuser?.socketId).emit('new-alert', {
                        msg_en: 'An error occurred. Please try again later.',
                        msg_ar: 'حدث خطأ. الرجاء المحاولة لاحقًا.',
                    });
                }
            });
            xclient.on('change-user', async (data) => {
                if (!xuser) return;
                xuser = await getUserById(xuser._id, xroomId);
                switch (data.type) {
                    case 'info-change':
                        if (data.user.hasOwnProperty('status')) {
                            if (
                                data.user.status == enums.statusTypes.out &&
                                !roomInfo.micQueue.includes(xuser._id.toString())
                            ) {
                                xuser.status = enums.statusTypes.empty.toString();
                            } else {
                                xuser.status = data.user.status;
                            }

                            if (
                                data.user.status != enums.statusTypes.f1 &&
                                data.user.status != enums.statusTypes.f2 &&
                                data.user.status != enums.statusTypes.f3
                            ) {
                                xuser.order = 0;
                                xuser.game_number = '';
                                xuser.game_number_color = '255|255|255';
                            }
                        }

                        if (data.user.hasOwnProperty('icon')) xuser.icon = data.user.icon;

                        if (data.user.hasOwnProperty('img_key')) {
                            xuser.img_key = data.user.img_key;
                            xuser.img = await getEnterIcon(data.user.img_key);
                        }

                        if (data.user.hasOwnProperty('is_typing')) {
                            xuser.is_typing = data.user.is_typing;
                        }
                        if (data.user.hasOwnProperty('is_meeting_typing')) {
                            xuser.is_meeting_typing = data.user.is_meeting_typing;
                        }
                        if (data.user.hasOwnProperty('showCountry')) {
                            xuser.showCountry = data.user.showCountry;
                        }

                        if (data.user.hasOwnProperty('private_status')) {
                            if (data.user.private_status == 1 || data.user.private_status == 0)
                                xuser.private_status = data.user.private_status;
                        }

                        if (data.user.hasOwnProperty('prevent_private_screenshot')) {
                            xuser.prevent_private_screenshot = data.user.prevent_private_screenshot;
                        }

                        xuser = await updateUser(xuser, xuser._id, xroomId);
                        break;

                    default:
                        break;
                }

                // ack('done');

                if (xuser.is_visible) {
                    io.emit(xroomId, {
                        type: data.type,
                        data: await public_user(xuser),
                    });
                }
            });

            xclient.on('public-msg', async (data) => {
                if (!xuser) return;
                if (!data.text) return;

                if (data.is_admins) {
                    const admins = await registeredUserModal.find({
                        roomRefs: { $in: [new ObjectId(xroomId)] },
                        $or: [
                            {
                                type: enums.userTypes.mastermain,
                            },
                            {
                                type: enums.userTypes.chatmanager,
                            },
                            {
                                type: enums.userTypes.root,
                            },
                            {
                                type: enums.userTypes.superadmin,
                            },
                            {
                                type: enums.userTypes.admin,
                            },
                            {
                                type: enums.userTypes.master,
                            },
                            {
                                type: enums.userTypes.mastergirl,
                            },
                            {
                                type: enums.userTypes.member,
                            },
                        ],
                    });

                    admins.forEach(async (adm) => {
                        const rus = await roomUsersModel.find({
                            regUserRef: new ObjectId(adm._id),
                            roomRef: new ObjectId(xroomId),
                        });
                        rus.forEach((ru) => {
                            if (ru && ru.socketId) {
                                if (data.is_alert) {
                                    io.to(ru.socketId).emit(xroomId, {
                                        type: 'alert-msg',
                                        data: {
                                            from: `رسالة للمشرفين من ${xuser.name}`,
                                            text: data.text,
                                        },
                                    });
                                }

                                io.to(ru.socketId).emit(xroomId, {
                                    type: 'public-msg',
                                    data: {
                                        from: `للمشرفين من ${xuser.name}`,
                                        text: data.text,
                                    },
                                });
                            }
                        });
                    });
                } else {
                    if (data.is_alert) {
                        io.emit(xroomId, {
                            type: 'alert-msg',
                            data: {
                                from: xuser.name,
                                text: data.text,
                            },
                        });
                    }

                    io.emit(xroomId, {
                        type: 'public-msg',
                        data: {
                            from: xuser.name,
                            text: data.text,
                        },
                    });
                }
            });

            xclient.on('set-user-game', async (data) => {
                if (!xuser) return;

                xuser = await getUserById(xuser._id, xroomId);
                if (
                    !xuser.is_joker ||
                    !data.user_id ||
                    !data.game_number ||
                    !data.game_number_color
                )
                    return;
                let target = await getUserById(data.user_id, xroomId);
                if (!target) return;

                target = await updateUser(
                    {
                        ...target,
                        game_number: data.game_number,
                        game_number_color: data.game_number_color,
                    },
                    data.user_id,
                    xroomId,
                );
                await notifyUserChanged(target._id);
            });

            xclient.on('remove-joker', async (data) => {
                if (!xuser) return;
                xuser = await getUserById(xuser._id, xroomId);
                if (!xuser.is_joker) return;
                xuser.is_joker = false;
                xuser = await updateUser(xuser, xuser._id, xroomId);

                helpers.endJokerInRoom(room);

                io.emit(xroomId, {
                    type: 'info-change',
                    data: await public_user(xuser),
                });
            });

            xclient.on('invite-meeting', async (data) => {
                if (!xuser) return;
                if (!data.user_id) return;

                let target = await getUserById(data.user_id, xroomId);
                if (!target) return;
                target = await updateUser(
                    {
                        ...target,
                        invited_to_meeting: true,
                        invited_by: xuser._id,
                    },
                    data.user_id,
                    xroomId,
                );

                io.to(target.socketId).emit('invited_to_meeting', {
                    ok: true,
                });
            });

            xclient.on('invite-response', async (data) => {
                if (!xuser) return;

                xuser = await getUserById(xuser._id, xroomId);
                if (xuser.invited_by && xuser.invited_to_meeting) {
                    let inviter = await getUserById(xuser.invited_by, xroomId);
                    if (data.value == 1) {
                        io.to(inviter.socketId).emit('new-toast', {
                            msg_en: `${xuser.name} has accepted the invitation`,
                            msg_ar: `${xuser.name} قام بقبول الدعوة`,
                        });
                    }

                    if (data.value == 0) {
                        io.to(inviter.socketId).emit('new-toast', {
                            msg_en: `${xuser.name} has accepted the invitation`,
                            msg_ar: `${xuser.name} قام يرفض الدعوة`,
                        });

                        xuser = await updateUser(
                            {
                                ...xuser,
                                invited_to_meeting: false,
                            },
                            xuser._id,
                            xroomId,
                        );
                    }
                }
            });

            xclient.on('delete-img', async (data) => {
                if (!xuser) return;

                io.emit(xroomId, {
                    type: 'delete-img',
                    data: {
                        key: data.key,
                        user: await public_user(xuser),
                    },
                });
            });

            xclient.on('delete-private-msg', async (data) => {
                if (!xuser) return;

                const key = data.chat_key;
                const msg_id = data.msg_id;

                let pc_res = await privateChatModel
                    .find({
                        key: key,
                    })
                    .populate(['user1Ref', 'user2Ref']);

                var pc = pc_res[0];
                //const id = mongoose.Types.ObjectId(msg_id.trim());
                const msg = await privateMessageModel.find({
                    _id: msg_id,
                    chatRef: pc._id,
                });

                if (msg.length > 0) {
                    msg[0].delete();
                }

                let otherUser =
                    pc.user1Ref._id.toString() == xuser._id.toString() ? pc.user2Ref : pc.user1Ref;

                otherUser = await getUserById(otherUser._id, xroomId);

                io.to(otherUser.socketId).emit('delete-private-msg', {
                    chat_key: key,
                    msg_id: msg_id,
                });

                io.to(xuser.socketId).emit('delete-private-msg', {
                    chat_key: key,
                    msg_id: msg_id,
                });
            });

            xclient.on('accept-waiting', async (data) => {
                if (!xuser) return;

                if (data.user) {
                    const acpt_usr = await getUserById(data.user, xroomId);
                    if (acpt_usr) {
                        const sc = io.sockets.sockets.get(acpt_usr.socketId);
                        sc._events['enter-room']({ passcode: enums.passcodes.enterLock });

                        io.emit(xroomId, {
                            type: 'responded-waiting',
                            data: await public_user(acpt_usr),
                        });

                        addAdminLog(
                            xuser,
                            xroomId,
                            `قام بقبول دخول العضو`,
                            `has accepted user`,
                            acpt_usr.name,
                            true,
                        );
                    }
                }
            });

            xclient.on('reject-waiting', async (data) => {
                if (!xuser) return;

                if (data.user) {
                    const rjct_usr = await getUserById(data.user, xroomId);
                    if (rjct_usr) {
                        const sc = io.sockets.sockets.get(rjct_usr.socketId);
                        if (sc) {
                            let msg = {
                                message: {
                                    msg_en: 'sorry, admin rejected your request',
                                    msg_ar: 'عذرا, مشرف الغرفة لم يوافق على طلبك بالدخول للغرفة',
                                },
                            };
                            // if (room.lock_msg) {
                            //     msg = {
                            //         message: {
                            //             msg_en: room.lock_msg,
                            //             msg_ar: room.lock_msg,
                            //         },
                            //     };
                            // }

                            io.to(rjct_usr.socketId).emit('rejected', msg);

                            io.emit(xroomId, {
                                type: 'responded-waiting',
                                data: await public_user(rjct_usr),
                            });

                            // setTimeout(() => {
                            //     sc.disconnect();
                            // }, 1500);
                        }
                    }
                }
            });
            ///////////////////////////// MIC SOCKET HANDLER //////////////////////////
            // 185.203.118.57:9600?name=MASTER&rp=1234&roomId=6789285b0d67595e1177d70d&key=02218e5d-0128-40a8-a315-4d7cfc0f9f50

            // Function to handle mic request
            xclient.on('request-mic', async (data) => {
                try {
                    console.log(`Mic request received from user ${xuser._id}`);
                    // if (!xuser) return;
                    const user = await getUserById(data.userId, xroomId);
                    const newRoom = await roomModel.findById(xroomId);

                    if (user && user.can_use_mic) {
                        if (
                            newRoom.mic.mic_permission !== 0 &&
                            (newRoom.mic.mic_permission === 1 ||
                                (newRoom.mic.mic_permission === 2 &&
                                    user.type !== enums.userTypes.guest) ||
                                (newRoom.mic.mic_permission === 3 &&
                                    user.type === enums.userTypes.root) ||
                                user.type === enums.userTypes.chatmanager ||
                                user.type === enums.userTypes.master ||
                                user.type === enums.userTypes.mastergirl ||
                                user.type === enums.userTypes.mastermain)
                        ) {
                            console.log('speakers length' + Array.from(roomInfo.speakers).length);
                            if (Array.from(roomInfo.speakers).length === 0) {
                                assignSpeaker(
                                    roomInfo,
                                    user._id.toString(),
                                    user,
                                    newRoom,
                                    xroomId,
                                );
                            } else {
                                if (roomInfo.speakers.has(user._id.toString())) {
                                    releaseMic(roomInfo, user._id.toString(), xroomId);
                                    if (Array.from(roomInfo.speakers).length == 0) {
                                        console.log('clear timer from request mic');
                                        clearActiveTimers(xroomId);
                                    }
                                    if (mutedSpeakers[xroomId].includes(xuser._id.toString())) {
                                        mutedSpeakers[xroomId] = mutedSpeakers[xroomId].filter(
                                            (id) => id !== xuser._id.toString(),
                                        );
                                        io.to(xroomId).emit('speaker-muted', {
                                            mutedSpeakers: mutedSpeakers[xroomId],
                                        });
                                    }
                                    console.log('after delete user id', roomInfo.speakers);

                                    console.log(
                                        `User ${user._id.toString()} has declined the mic.`,
                                    );
                                } else if (
                                    roomInfo.micQueue &&
                                    !roomInfo.micQueue.includes(user._id.toString())
                                ) {
                                    // Add user to the queue if there's an active speaker
                                    roomInfo.micQueue.push(user._id.toString());
                                    console.log(
                                        `User ${user._id} added to the queue. Queue length: ${roomInfo.micQueue.length}`,
                                    );
                                    io.to(xroomId).emit('mic-queue-update', roomInfo.micQueue);
                                } else if (
                                    roomInfo.micQueue &&
                                    roomInfo.micQueue.includes(user._id.toString())
                                ) {
                                    console.log(`User ${xuser._id} is already in the queue.`);
                                    roomInfo.micQueue = roomInfo.micQueue.filter(
                                        (id) => id !== user._id.toString(),
                                    );
                                    io.to(xroomId).emit('mic-queue-update', roomInfo.micQueue);
                                    return;
                                }
                            }
                            console.log('speakers on mic are: ' + Array.from(roomInfo.speakers));
                        } else {
                            if (newRoom.mic.mic_permission === 2) {
                                io.to(user.socketId).emit('alert-msg', {
                                    msg_en: `mic is allowed only to this room's members and admins`,
                                    msg_ar: 'التحدث في هذه الغرفة متاح فقط للمشرفين والأعضاء.',
                                });
                            } else if (newRoom.mic.mic_permission === 3) {
                                io.to(user.socketId).emit('alert-msg', {
                                    msg_en: `mic is allowed only to this room's admins`,
                                    msg_ar: 'التحدث في هذه الغرفة متاح  للمشرفين فقط',
                                });
                            } else if (newRoom.mic.mic_permission === 0) {
                                io.to(user.socketId).emit('alert-msg', {
                                    msg_en: 'mic is not allowed in this room',
                                    msg_ar: 'التحدث معطل في هذه الغرفة للجميع',
                                });
                            }
                        }
                    }
                } catch (err) {
                    console.log('error from request mic ' + err.toString());
                }
            });

            xclient.on('share-youtube-link', (data) => {
                try {
                    if (
                        xuser.type === enums.userTypes.root ||
                        xuser.type === enums.userTypes.chatmanager ||
                        xuser.type === enums.userTypes.master ||
                        xuser.type === enums.userTypes.mastergirl ||
                        xuser.type === enums.userTypes.mastermain ||
                        member
                    ) {
                        if (!xuser || !xuser._id) {
                            console.log('Invalid xuser or xuser._id');
                            return;
                        }

                        const userId = xuser._id.toString();

                        if (roomInfo.speakers.has(userId)) {
                            roomInfo.youtubeLink = {
                                userId: userId,
                                link: data.link,
                                paused: false,
                            };
                            console.log(
                                'Sending YouTube link',
                                JSON.stringify(roomInfo.youtubeLink, null, 2),
                            );

                            io.to(xroomId).emit('youtube-link-shared', {
                                link: roomInfo.youtubeLink,
                            });
                        }
                    }
                } catch (err) {
                    console.log('Error from share YouTube link:', err.message);
                }
            });

            xclient.on('pause-youtube', (data) => {
                try {
                    const userId = xuser._id.toString();
                    console.log('pause or resume video');
                    console.log(`current video state ${roomInfo.youtubeLink}`);

                    if (roomInfo.youtubeLink && roomInfo.youtubeLink.userId === userId) {
                        console.log(`Pausing YouTube for room ${xroomId}`);
                        roomInfo.youtubeLink.paused = !roomInfo.youtubeLink.paused;
                        roomInfo.youtubeLink.timestamp = data.timestamp;
                        console.log(`current video state ${roomInfo.youtubeLink}`);

                        io.to(xroomId).emit('youtube-paused', {
                            link: roomInfo.youtubeLink,
                        });
                    }
                } catch (err) {
                    console.log('Error from pause YouTube event:', err.message);
                }
            });

            // سحب المايك
            xclient.on('disable-mic', async (data) => {
                try {
                    if (
                        !xuser ||
                        (xuser.type !== enums.userTypes.root &&
                            xuser.type !== enums.userTypes.chatmanager &&
                            xuser.type !== enums.userTypes.master &&
                            xuser.type !== enums.userTypes.mastermain &&
                            xuser.type !== enums.userTypes.mastergirl &&
                            0)
                    )
                        return;
                    if (xuser.permissions[10] == 0) {
                        io.to(xuser.socketId).emit('new-alert', {
                            msg_en: `you don't have a permission to do this action`,
                            msg_ar: 'أنت لا تملك الصلاحية للقيام بهذا الإجراء',
                        });
                        return;
                    }
                    const newRoom = await roomModel.findById(xroomId);

                    if (newRoom.mic.mic_setting[0] === false) {
                        io.to(xuser.socketId).emit('new-alert', {
                            msg_en: 'Disable mic is not allowed in this room',
                            msg_ar: 'سحب المايك غير مسموح في هذه الغرفة',
                        });
                        return;
                    }

                    const userId = data.userId;
                    const user = await getUserById(userId, xroomId);
                    if (roomInfo.speakers.has(user._id.toString())) {
                        releaseMic(roomInfo, user._id.toString(), xroomId);
                        if (Array.from(roomInfo.speakers).length == 0) {
                            console.log('clear timer from admin disable mic');
                            clearActiveTimers(xroomId);
                        }
                        console.log('after delete user id', roomInfo.speakers);

                        console.log(`User ${user._id.toString()} has declined the mic.`);
                        addAdminLog(
                            xuser,
                            xroomId,
                            `قام بسحب المايك من الاسم ${user.name}`,
                            `has disabled mic for ${user.name}`,
                        );
                    }
                } catch (err) {
                    console.log('error from disable mic  ' + err.toString());
                }
            });
            // سحب المايك من الجميع
            xclient.on('disable-mic-for-all', async (data) => {
                try {
                    if (
                        !xuser ||
                        (xuser.type !== enums.userTypes.root &&
                            xuser.type !== enums.userTypes.chatmanager &&
                            xuser.type !== enums.userTypes.master &&
                            xuser.type !== enums.userTypes.mastermain &&
                            xuser.type !== enums.userTypes.mastergirl &&
                            0)
                    )
                        return;
                    if (xuser.permissions[10] == 0) {
                        io.to(xuser.socketId).emit('new-alert', {
                            msg_en: `you don't have a permission to do this action`,
                            msg_ar: 'أنت لا تملك الصلاحية للقيام بهذا الإجراء',
                        });
                        return;
                    }
                    const newRoom = await roomModel.findById(xroomId);
                    if (newRoom.mic.mic_setting[0] === false) {
                        io.to(xuser.socketId).emit('new-alert', {
                            msg_en: 'Disable mic is not allowed in this room',
                            msg_ar: 'سحب المايك غير مسموح في هذه الغرفة',
                        });
                    }
                    if (Array.from(roomInfo.speakers).length !== 0) {
                        for (const speakerId of roomInfo.speakers) {
                            releaseMic(roomInfo, speakerId, xroomId);

                            clearActiveTimers(xroomId);

                            console.log('after disable mic for all ', roomInfo.speakers);
                        }
                        addAdminLog(
                            xuser,
                            xroomId,
                            `قام بسحب المايك من الجميع `,
                            `has disabled mic for all`,
                        );
                    }
                } catch (err) {
                    console.log('error from disable mic for all ' + err.toString());
                }
            });

            // سحب المايك من الجميع إلا هذا
            xclient.on('disable-mic-but-user', async (data) => {
                try {
                    if (
                        !xuser ||
                        (xuser.type !== enums.userTypes.root &&
                            xuser.type !== enums.userTypes.chatmanager &&
                            xuser.type !== enums.userTypes.master &&
                            xuser.type !== enums.userTypes.mastermain &&
                            xuser.type !== enums.userTypes.mastergirl &&
                            0)
                    )
                        return;
                    if (xuser.permissions[10] == 0) {
                        io.to(xuser.socketId).emit('new-alert', {
                            msg_en: `you don't have a permission to do this action`,
                            msg_ar: 'أنت لا تملك الصلاحية للقيام بهذا الإجراء',
                        });
                        return;
                    }
                    const newRoom = await roomModel.findById(xroomId);
                    if (newRoom.mic.mic_setting[0] === false) {
                        io.to(xuser.socketId).emit('new-alert', {
                            msg_en: 'Disable mic is not allowed in this room',
                            msg_ar: 'سحب المايك غير مسموح في هذه الغرفة',
                        });
                    }
                    const userId = data.userId;
                    const user = await getUserById(userId, xroomId);
                    const speakers = Array.from(roomInfo.speakers).filter((id) => id !== userId);
                    if (speakers.length !== 0) {
                        for (const speakerId of speakers) {
                            releaseMic(roomInfo, speakerId, xroomId);
                        }
                        console.log('diabled mic for all users ', speakers);

                        addAdminLog(
                            xuser,
                            xroomId,
                            `قام بسحب المايك من الجميع إلا من ${user.name}`,
                            `has disabled mic for all except ${user.name}`,
                        );
                    }
                } catch (err) {
                    console.log('error from disable mic but user ' + err.toString());
                }
            });

            // سحب من دور المايك
            // data = {userId}
            xclient.on('remove-from-mic-queue', async (data) => {
                console.log('remove from mic queue');
                try {
                    if (
                        !xuser ||
                        (xuser.type !== enums.userTypes.root &&
                            xuser.type !== enums.userTypes.chatmanager &&
                            xuser.type !== enums.userTypes.master &&
                            xuser.type !== enums.userTypes.mastermain &&
                            xuser.type !== enums.userTypes.mastergirl &&
                            0)
                    )
                        return;
                    const userId = data.userId;
                    const user = await getUserById(userId, xroomId);

                    if (roomInfo.micQueue && roomInfo.micQueue.includes(userId)) {
                        console.log(`User ${userId} is already in the queue.`);
                        var index = roomInfo.micQueue.indexOf(userId);
                        if (index > -1) {
                            roomInfo.micQueue.splice(index, 1);
                        }
                        //roomInfo.micQueue = roomInfo.micQueue.filter((id) => id !== userId);
                        io.to(xroomId).emit('mic-queue-update', roomInfo.micQueue);
                        addAdminLog(
                            xuser,
                            xroomId,
                            ` قام بسحب دور المايك من الاسم ${user.name}`,
                            ` has removed ${user.name} from mic queue`,
                        );
                    }
                } catch (err) {
                    console.log('error from remove from mic queue ' + err.toString());
                }
            });

            // سحب الجميع من دور المايك إلا هذ الاسم
            // data = {userId}
            xclient.on('remove-all-from-mic-queue-but-user', async (data) => {
                try {
                    if (
                        !xuser ||
                        (xuser.type !== enums.userTypes.root &&
                            xuser.type !== enums.userTypes.chatmanager &&
                            xuser.type !== enums.userTypes.master &&
                            xuser.type !== enums.userTypes.mastermain &&
                            xuser.type !== enums.userTypes.mastergirl &&
                            0)
                    )
                        return;
                    const userId = data.userId;
                    const user = await getUserById(userId, xroomId);

                    if (roomInfo.micQueue && roomInfo.micQueue.includes(userId)) {
                        roomInfo.micQueue = roomInfo.micQueue.filter((id) => id === userId);
                        io.to(xroomId).emit('mic-queue-update', roomInfo.micQueue);
                        addAdminLog(
                            xuser,
                            xroomId,
                            ` قام بسحب دور المايك من الجميع إلا من الاسم ${user.name}`,
                            ` has removed all from mic queue except ${user.name}`,
                        );
                    }
                } catch (err) {
                    console.log('error from romve all but user from mic queue ' + err.toString());
                }
            });

            // سحب الجميع من دور المايك إلا انا
            // no data
            xclient.on('remove-all-from-mic-queue', async () => {
                try {
                    if (
                        !xuser ||
                        (xuser.type !== enums.userTypes.root &&
                            xuser.type !== enums.userTypes.chatmanager &&
                            xuser.type !== enums.userTypes.master &&
                            xuser.type !== enums.userTypes.mastermain &&
                            xuser.type !== enums.userTypes.mastergirl &&
                            0)
                    )
                        return;
                    if (roomInfo.micQueue && roomInfo.micQueue.length !== 0) {
                        for (const id of roomInfo.micQueue) {
                        }
                        roomInfo.micQueue = roomInfo.micQueue.filter(
                            (id) => id === xuser._id.toString(),
                        );
                        io.to(xroomId).emit('mic-queue-update', roomInfo.micQueue);
                        addAdminLog(
                            xuser,
                            xroomId,
                            ` قام بسحب دور المايك من الجميع`,
                            ` has removed all from mic queue`,
                        );
                    }
                } catch (err) {
                    console.log('error from remove all from mic queue ' + err.toString());
                }
            });

            // اعطاء المايك لهذا الاسم
            // data = {userId}
            xclient.on('enable-mic-for-user', async (data) => {
                try {
                    if (
                        !xuser ||
                        (xuser.type !== enums.userTypes.root &&
                            xuser.type !== enums.userTypes.chatmanager &&
                            xuser.type !== enums.userTypes.master &&
                            xuser.type !== enums.userTypes.mastermain &&
                            xuser.type !== enums.userTypes.mastergirl &&
                            0)
                    )
                        return;
                    const userId = data.userId;
                    if (roomInfo.micQueue && roomInfo.micQueue.includes(userId)) {
                        const user = await getUserById(userId, xroomId);

                        const newRoom = await roomModel.findById(xroomId);
                        for (const speakerId of Array.from(roomInfo.speakers)) {
                            releaseMic(roomInfo, speakerId, xroomId);
                            console.log('clear timer from start interval *3');
                            clearActiveTimers(xroomId);
                        }
                        if (Array.from(roomInfo.speakers).length === 0) {
                            assignSpeaker(roomInfo, user._id.toString(), user, newRoom, xroomId);
                        }
                        addAdminLog(
                            xuser,
                            xroomId,
                            ` قام بإعطاء المايك للاسم ${user.name}`,
                            ` has enabled mic for ${user.name}`,
                        );
                    }
                } catch (err) {
                    console.log('error from enable mic for user ' + err.toString());
                }
            });

            xclient.on('renew-mic-time', async (data) => {
                try {
                    const newRoom = await roomModel.findById(xroomId);

                    if (newRoom.mic.mic_setting[1] === true) {
                        if (
                            !xuser ||
                            (xuser.type !== enums.userTypes.root &&
                                xuser.type !== enums.userTypes.chatmanager &&
                                xuser.type !== enums.userTypes.master &&
                                xuser.type !== enums.userTypes.mastermain &&
                                0)
                        )
                            return; // Ensure only admins can renew time
                        if (xuser.permissions[10] == 0) {
                            io.to(xuser.socketId).emit('new-alert', {
                                msg_en: `you don't have a permission to do this action`,
                                msg_ar: 'أنت لا تملك الصلاحية للقيام بهذا الإجراء',
                            });
                            return;
                        }
                        const { userId } = data;
                        const speaker = await getUserById(userId, xroomId);
                        if (speaker) {
                            const timeLeft = getUserTimeLeft(speaker.type, newRoom);
                            startInterval(timeLeft, xroomId, roomInfo);
                            addAdminLog(
                                xuser,
                                xroomId,
                                `قام بتحديث وقت التكلم لـ ${speaker.name}`,
                                `has renewed mic time for ${speaker.name}`,
                            );
                        }
                    } else {
                        io.to(xuser.socketId).emit('new-alert', {
                            msg_en: 'renew time is not allowed in this room',
                            msg_ar: 'تجديد الوقت غير مسموح في هذه الغرفة',
                        });
                        console.log('not allowed to renew mic time');
                    }
                } catch (err) {
                    console.log('error from renew mic time' + err.toString());
                }
            });
            xclient.on('enable-open-mic', async (data) => {
                try {
                    const newRoom = await roomModel.findById(xroomId);

                    if (newRoom.mic.mic_setting[2] === true) {
                        if (
                            !xuser ||
                            (xuser.type !== enums.userTypes.root &&
                                xuser.type !== enums.userTypes.chatmanager &&
                                xuser.type !== enums.userTypes.master &&
                                xuser.type !== enums.userTypes.mastermain &&
                                0)
                        )
                            return; // Ensure only admins can renew time
                        if (xuser.permissions[10] == 0) {
                            io.to(xuser.socketId).emit('new-alert', {
                                msg_en: `you don't have a permission to do this action`,
                                msg_ar: 'أنت لا تملك الصلاحية للقيام بهذا الإجراء',
                            });
                            return;
                        }
                        const { userId } = data;
                        const speaker = await getUserById(userId, xroomId);

                        if (speaker) {
                            startInterval(0o0, xroomId, roomInfo);
                            addAdminLog(
                                xuser,
                                xroomId,
                                `قام بإعطاء وقت تحدث مفتوح لـ ${speaker.name}`,
                                `has gave an open mic time for ${speaker.name}`,
                            );
                        }
                    } else {
                        io.to(xuser.socketId).emit('new-alert', {
                            msg_en: 'open time is not allowed in this room',
                            msg_ar: 'اعطاء وقت مفتوح غير مسموح في هذه الغرفة',
                        });
                        console.log('not allowed to give open mic time');
                    }
                } catch (err) {
                    console.log('error from renew mic time' + err.toString());
                }
            });
            xclient.on('temp-disconnect', async (data) => {
                console.log('temp-disconnect called');
                const date = new Date(loginTime);

                // Add 6 seconds
                date.setSeconds(date.getSeconds() + 6);

                // Convert the updated date back to ISO string
                const time = date.toISOString();
                setInterval(() => {
                    time -= 1000;
                    if (time <= 0) {
                        disconnectFromRoom(data);
                    }
                }, 1000);
            });
            // Add mic sharing feature
            xclient.on('share-mic', async (data) => {
                try {
                    if (Array.from(roomInfo.speakers)[0] === xuser._id.toString()) {
                        const newRoom = await roomModel.findById(xroomId);

                        if (newRoom.mic.mic_setting[3] === true) {
                            if (
                                Array.from(roomInfo.speakers).length <
                                newRoom.mic.shared_mic_capacity
                            ) {
                                //  if (!xuser || !xuser.can_use_mic) return; // Ensure the current user has the mic

                                let { userId } = data;
                                const userToShareWith = await getUserById(userId, xroomId);

                                if (userToShareWith) {
                                    if (
                                        roomInfo.micQueue.includes(userToShareWith._id.toString())
                                    ) {
                                        if (userToShareWith.status == enums.statusTypes.out) {
                                            io.to(xuser.socketId).emit('new-alert', {
                                                msg_en: 'user is not available for shared mic right now',
                                                msg_ar: 'المستخدم غير متاح الآن للتحدث المشترك',
                                            });
                                            console.log('error from share mi');
                                        } else {
                                            roomInfo.micQueue = roomInfo.micQueue.filter(
                                                (id) => id !== userToShareWith._id.toString(),
                                            );
                                            io.to(xroomId).emit(
                                                'mic-queue-update',
                                                roomInfo.micQueue,
                                            );

                                            if (
                                                !roomInfo.speakers.has(
                                                    userToShareWith._id.toString(),
                                                )
                                            ) {
                                                roomInfo.speakers.add(
                                                    userToShareWith._id.toString(),
                                                );
                                                io.to(xroomId).emit(
                                                    'update-speakers',
                                                    Array.from(roomInfo.speakers),
                                                );
                                            }
                                            addAdminLog(
                                                xuser,
                                                xroomId,
                                                `قام بعمل تحدث مشترك مع  ${userToShareWith.name}`,
                                                `has shared mic with ${userToShareWith.name}`,
                                            );
                                        }
                                    }
                                }
                            } else {
                                io.to(xuser.socketId).emit('new-alert', {
                                    msg_en: 'shared mic capacity has reached the limit',
                                    msg_ar: 'التحدث المشترك وصل إلى الحد الأقصى',
                                });
                            }
                        } else {
                            io.to(xuser.socketId).emit('new-alert', {
                                msg_en: 'share mic is not allowed in this room',
                                msg_ar: 'مشاركة المايك غير مسموح في هذه الغرفة',
                            });
                        }
                    }
                } catch (err) {
                    console.log('error from share mic ' + err.toString());
                }
            });

            // end test mic features

            // mute speaker
            // no data
            xclient.on('mute-speaker', () => {
                try {
                    if (!xuser) return;

                    if (!mutedSpeakers[xroomId].includes(xuser._id.toString())) {
                        mutedSpeakers[xroomId].push(xuser._id.toString());
                        io.to(xroomId).emit('speaker-muted', {
                            mutedSpeakers: mutedSpeakers[xroomId],
                        });
                    } else {
                        mutedSpeakers[xroomId] = mutedSpeakers[xroomId].filter(
                            (id) => id !== xuser._id.toString(),
                        );
                        io.to(xroomId).emit('speaker-muted', {
                            mutedSpeakers: mutedSpeakers[xroomId],
                        });
                    }
                } catch (err) {
                    console.log('error from mute speaker ' + err.toString());
                }
            });
            xclient.on('mute-all', async () => {
                try {
                    console.log('all muted list started', xuser.name);
                    if (!xuser) return;

                    if (!allMutedList[xroomId].includes(xuser._id.toString())) {
                        allMutedList[xroomId].push(xuser._id.toString());
                        io.to(xroomId).emit('muted-list', { 'muted-list': allMutedList[xroomId] });
                    } else {
                        allMutedList[xroomId] = allMutedList[xroomId].filter(
                            (id) => id !== xuser._id.toString(),
                        );
                        io.to(xroomId).emit('muted-list', { 'muted-list': allMutedList[xroomId] });
                    }
                } catch (err) {
                    console.log('error from mute all ' + err.toString());
                }
            });
        };

        const disconnectFromRoom = async (data) => {
            console.log(
                'disconnected client:',
                xuser._id.toString(),
                xuser.name,
                'from:',
                xroomId,
                data,
            );

            xclient.leave(xroomId);
            if (!xuser) return;
            xuser = await getUserById(xuser._id, xroomId);
            await removeUserFromRoom(xroomId, xuser);
            await removeUserFromWaiting(xroomId, xuser);

            if (!xuser || !xroomId) return;
            // Clear the timer if it exists
            releaseMic(roomInfo, xuser._id.toString(), xroomId);
            if (Array.from(roomInfo.speakers).length == 0) {
                console.log('clear timer from disconnect');

                clearActiveTimers(xroomId);
            }

            if (roomInfo.micQueue && roomInfo.micQueue.includes(xuser._id.toString())) {
                roomInfo.micQueue = roomInfo.micQueue.filter((id) => id !== xuser._id.toString());
                io.to(xroomId).emit('mic-queue-update', roomInfo.micQueue);
            }

            if (allMutedList[xroomId].includes(xuser._id.toString())) {
                allMutedList[xroomId] = allMutedList[xroomId].filter(
                    (id) => id !== xuser._id.toString(),
                );
                io.to(xroomId).emit('muted-list', { 'muted-list': allMutedList[xroomId] });
            }
            if (roomInfo.youtubeLink && roomInfo.youtubeLink.userId == xuser._id.toString()) {
                roomInfo.youtubeLink = {};
            }

            io.to(xroomId).emit('user-left', xuser._id.toString());

            if (enterDate) {
                await addEntryLog(xuser, xroomId, enterDate, 0); // 0 for normal disconnect
            }

            console.log('User disconnected:', xuser._id.toString(), xuser.name, 'from:', xroomId);

            await helpers.notifyRoomChanged(xroomId, false, true);

            if (xuser.is_visible) {
                const room = await roomModel.findById(xroomId);

                io.emit(xroomId, {
                    type: 'dis-user',
                    data: await public_user(xuser),
                });

                io.emit(xroomId, {
                    type: 'responded-waiting',
                    data: await public_user(xuser),
                });

                if (!room.isMeeting) {
                    io.emit(room.meetingRef, {
                        type: 'dis-user',
                        data: await public_user(xuser),
                    });
                }

                let reason = 0;
                switch (data) {
                    case 'transport close':
                        reason = 0;
                        break;

                    case 'ping timeout':
                        reason = 1;
                        break;

                    default:
                        break;
                }

                if (enterDate) {
                    await addEntryLog(xuser, xroomId, enterDate, reason);
                }

                if (reason == 0) {
                    xuser.order = 0;
                    xuser.game_number = '';
                    xuser.game_number_color = '255|255|255';
                    if (xuser.is_joker) {
                        await helpers.endJokerInRoom(room);
                        xuser.is_joker = false;
                    }
                    await updateUser(xuser, xuser._id, xroomId);
                }
            }
        };

        /////////////// CHECk ROOM LOCK CASES //////////////////
        if (
            room.lock_status == 0 ||
            xuser.type == enums.userTypes.mastermain ||
            !xuser.is_visible
        ) {
            continue_to_room();
        } else if (room.lock_status === 2 && xuser.type && xuser.type != enums.userTypes.guest) {
            continue_to_room();
        } else {
            addUserToWaiting(xroomId, xuser);
            xclient.on('enter-room', async (data) => {
                if (!xuser) return;
                if (data.passcode != enums.passcodes.enterLock) return;

                continue_to_room();
            });

            xclient.emit('room-wait', {
                ok: true,
                room: await public_room(room),
            });

            let pub_usr = await public_user(xuser);

            pub_usr = {
                ...pub_usr,
                location: xuser.country_code + ' ' + xuser.ip,
            };

            const all_in_room = await getUsersInRoom(xroomId, false, false);
            all_in_room.forEach((u) => {
                if (u.permissions && u.permissions[6] == 1) {
                    io.to(u.socketId).emit('knock-room', {
                        data: pub_usr,
                    });
                }
            });
        }

        ////////////////// DISCONNECT CLIENT /////////////////////////
        xclient.on('reconnect', () => {
            io.to(xuser.socketId).emit('update-speakers', Array.from(roomInfo.speakers));

            io.to(xuser.socketId).emit('mic-queue-update', roomInfo.micQueue);
            io.to(xuser.socketId).emit('muted-list', { 'muted-list': allMutedList[xroomId] });
        });

        xclient.on('disconnect', async (data) => {
            console.log('disconnect socket called');
            //disconnectFromRoom(data);
        });
    });
};
