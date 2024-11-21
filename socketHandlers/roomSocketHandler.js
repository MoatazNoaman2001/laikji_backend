const helpers = require('../helpers/helpers');
const enums = require('../helpers/enums');
const roomModel = require('../models/roomModel');

const { public_room } = require('../helpers/helpers');
const { addEntryLog, addAdminLog } = require('../helpers/Logger');
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
const {
    createWebRtcTransport,
    createProducer,
    createConsumer,
    getRoomData,
} = require('../helpers/mediasoupHelpers');

var micQueue = []; // Queue to hold mic requests
var allMutedList = []; // list for users whom muted all participarates
let currentSpeaker = null; // Tracks the current user who has the mic
let micAssigning = false; // Flag to prevent concurrent mic assignments
let userTimers = new Map();

module.exports = (io) => {
    io.use(async (socket, next) => {
        socket.handshake.query.name = socket.handshake.query.name.trim();
        let name = socket.handshake.query.name;
        let room_id = socket.handshake.query.roomId;
        let user_key = socket.handshake.query.key;
        let ip = socket.request.connection.remoteAddress;
        let rp = socket.handshake.query.rp;
        let fp = socket.handshake.query.fp;
        let mp = socket.handshake.query.mp;
        let inv = socket.handshake.query.inv;
        let socket_id = socket.request.connection.socketId;
        socket.handshake.query.icon = '0.png';

        // console.log(socket.handshake.query);
        console.log('new client room:', name, 'for room:', room_id, 'IP:', ip, 'KEY:', user_key);

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

        if (await isBannedFromServer(user_key)) {
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
                if (registeredUser.locked_key && registeredUser.locked_key != user_key) {
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
                registeredUser.locked_key = user_key;
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
                return next(
                    new Error(
                        JSON.stringify({
                            error_code: 1,
                            msg_ar: 'كلمة مرور غرفة الاجتماعات خاطئة',
                            msg_en: 'Password is incorrect',
                        }),
                    ),
                );
            }
        }

        if (await isBanned(user_key, room)) {
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
        var enterDate = null;
        var key = xclient.handshake.query.key;
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
                ip: xclient.handshake.query.ip,
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
                ...update,
            },
            xuser._id,
            xroomId,
        );

        /////////////// ROOM LOGIN SUCCESS CASE ///////////////////

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
            const roomInfo = await getRoomData(xroomId);

            const private_chats = await getMyPrivateChats(xroomId, xuser._id, true);
            // xuser = await updateUser({ enterDate: getNowDateTime(true), ...xuser }, xuser._id, xroomId);
            // return micQueue, speakersQueue at another event
            xclient.emit('started', {
                ok: true,
                user: xuser,
                member: member,
                room: await public_room(room),
                users: users_in_room,
                private_chats: private_chats,
                waiting_users: users_in_waiting,
                'muted-list': allMutedList,
                micQueue: micQueue,
                speakers: roomInfo != null ? Array.from(roomInfo.speakers) : {},
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
                if (!xuser) return;

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

                otherUser = await getUserById(otherUser._id, xroomId);

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

                pc.isUser1Deleted = false;
                pc.isUser2Deleted = false;
                pc.save();

                let body = {
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

                const room = await roomModel.findById(xroomId);
                const otherRoom = await roomModel.findById(
                    room.isMeeting ? room.parentRef : room.meetingRef,
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

                if (otherUserInOtherRoom) {
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

                if (xuserInOtherRoom) {
                    io.to(xuserInOtherRoom.socketId).emit('new-private-msg', {
                        chat: {
                            ...pc,
                            last: msg,
                            newMsgs: 0,
                        },
                        msg: msg,
                    });
                }
            });

            xclient.on('change-user', async (data) => {
                if (!xuser) return;
                xuser = await getUserById(xuser._id, xroomId);

                switch (data.type) {
                    case 'info-change':
                        if (data.user.hasOwnProperty('status')) {
                            xuser.status = data.user.status;

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

                let pc = await privateChatModel
                    .find({
                        key: key,
                    })
                    .populate(['user1Ref', 'user2Ref']);

                pc = pc[0];

                const msg = await privateMessageModel.find({
                    _id: new ObjectId(msg_id),
                    chatRef: new ObjectId(pc._id),
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
            // localhost:9500?name=test2&roomId=66f80aa1f67b8fe03bca0637&key=02218e5d-0128-40a8-a315-4d7cfc0f9f50

            // Function to handle mic request
            xclient.on('request-mic', async (data) => {
                try {
                    console.log(
                        `Mic request received from user ${xuser._id}. Current speaker: ${currentSpeaker}`,
                    );
                    // if (!xuser) return;
                    const user = await getUserById(data.userId, xroomId);
                    console.log('speakers length' + Array.from(roomInfo.speakers).length);
                    if (Array.from(roomInfo.speakers).length === 0) {
                        assignSpeaker(user._id.toString(), user);
                    } else {
                        if (roomInfo.speakers.has(user._id.toString())) {
                            clearUserTimers(user._id.toString());
                            releaseMic(user._id.toString());

                            console.log('User found in speakers some', roomInfo.speakers);
                            console.log('after delete user id', roomInfo.speakers);

                            console.log(`User ${user._id.toString()} has declined the mic.`);
                        } else if (!micQueue.includes(user._id.toString())) {
                            // Add user to the queue if there's an active speaker
                            micQueue.push(user._id.toString());
                            console.log(
                                `User ${user._id} added to the queue. Queue length: ${micQueue.length}`,
                            );
                            io.to(xroomId).emit('mic-queue-update', micQueue);
                        } else if (micQueue.includes(user._id.toString())) {
                            console.log(`User ${xuser._id} is already in the queue.`);
                            micQueue = micQueue.filter((id) => id !== user._id.toString());
                            io.to(xroomId).emit('mic-queue-update', micQueue);
                            return;
                        }
                    }
                } catch (err) {
                    console.log('error from request mic ' + err.toString());
                }
            });

            xclient.on('hold-mic', async (userId) => {
                if (
                    !xuser ||
                    (xuser.type !== enums.userTypes.root &&
                        xuser.type !== enums.userTypes.chatmanager &&
                        xuser.type !== enums.userTypes.master &&
                        xuser.type !== enums.userTypes.mastermain)
                )
                    return; // Ensure only admins can hold mic
                roomInfo.holdMic.add(userId);
                io.to(xroomId).emit('update-hold-mic', Array.from(roomInfo.holdMic));
            });
            //xclient instead of socket
            xclient.on('release-hold-mic', async (userId) => {
                if (!xuser || xuser.type !== enums.userTypes.admin) return; // Ensure only admins can release hold mic

                roomInfo.holdMic.delete(userId);
                io.to(xroomId).emit('update-hold-mic', Array.from(roomInfo.holdMic));
            });

            xclient.on('disable-mic-for-all', async (data) => {
                if (
                    !xuser ||
                    (xuser.type !== enums.userTypes.root &&
                        xuser.type !== enums.userTypes.chatmanager &&
                        xuser.type !== enums.userTypes.master &&
                        xuser.type !== enums.userTypes.mastermain &&
                        0)
                )
                    return;

                let { usersId, time } = data;
                time = time * 1000; // 'time' is the duration to mute the mic
                if (usersId) {
                    usersId.map(async (userId) => {
                        const user = await getUserById(userId, xroomId);
                        console.log(user, 'woooo');
                        if (user) {
                            // Disable mic for the user
                            user.can_use_mic = false;
                            await updateUser(user, user._id, xroomId);
                            io.to(user.socketId).emit('mic-disabled', {
                                message:
                                    'Your mic has been disabled by an admin for ' +
                                    time / 1000 +
                                    ' seconds.',
                            });
                            // Re-enable the mic after the specified time
                            setTimeout(async () => {
                                user.can_use_mic = true;
                                await updateUser(user, user._id, xroomId);
                                io.to(user.socketId).emit('mic-enabled', {
                                    message:
                                        'Your mic has been re-enabled after ' +
                                        time / 1000 +
                                        ' seconds.',
                                });
                            }, time);
                        }
                    });
                }
            });
            xclient.on('disable-mic-for-user', async (data) => {
                if (
                    !xuser ||
                    (xuser.type !== enums.userTypes.root &&
                        xuser.type !== enums.userTypes.chatmanager &&
                        xuser.type !== enums.userTypes.master &&
                        xuser.type !== enums.userTypes.mastermain &&
                        0)
                )
                    return;

                let { userId, time } = data;
                time = time * 1000; // 'time' is the duration to mute the mic
                const user = await getUserById(userId, xroomId);
                console.log(user, 'woooo');
                if (user) {
                    user.can_use_mic = false;
                    await updateUser(user, user._id, xroomId);
                    io.to(user.socketId).emit('mic-disabled', {
                        message:
                            'Your mic has been disabled by an admin for ' +
                            time / 1000 +
                            ' seconds.',
                    });
                    // Re-enable the mic after the specified time
                    setTimeout(async () => {
                        user.can_use_mic = true;
                        await updateUser(user, user._id, xroomId);
                        io.to(user.socketId).emit('mic-enabled', {
                            message:
                                'Your mic has been re-enabled after ' + time / 1000 + ' seconds.',
                        });
                    }, time);
                }
            });

            xclient.on('enable-mic-me-only', async (data) => {
                if (
                    !xuser ||
                    (xuser.type !== enums.userTypes.root &&
                        xuser.type !== enums.userTypes.chatmanager &&
                        xuser.type !== enums.userTypes.master &&
                        xuser.type !== enums.userTypes.mastermain)
                ) {
                    return;
                }

                let { usersId, time } = data;

                time = time * 1000; // Convert time to milliseconds

                if (usersId) {
                    // Filter out the user's own ID
                    const filteredUsers = usersId.filter(
                        (userId) => userId !== xuser._id.toString(),
                    );

                    filteredUsers.map(async (userId) => {
                        const user = await getUserById(userId, xroomId);
                        console.log(user, 'woooo');
                        if (user) {
                            user.can_use_mic = false;
                            await updateUser(user, user._id, xroomId);
                            io.to(user.socketId).emit('mic-disabled', {
                                message:
                                    'Your mic has been disabled by an admin for ' +
                                    time / 1000 +
                                    ' seconds.',
                            });

                            // Re-enable the mic after the specified time
                            setTimeout(async () => {
                                user.can_use_mic = true;
                                await updateUser(user, user._id, xroomId);
                                io.to(user.socketId).emit('mic-enabled', {
                                    message:
                                        'Your mic has been re-enabled after ' +
                                        time / 1000 +
                                        ' seconds.',
                                });
                            }, time);
                        }
                    });
                }
            });

            const assignMicWithTimeLimit = async (userId, timeLimit = 60) => {
                const user = await getUserById(userId, xroomId);
                // const timeLimit = micTimeLimits[user.type] || 60; // Default to 1 minute

                // Start the timer for the assigned user
                let timeLeft = timeLimit;
                const timer = setInterval(() => {
                    timeLeft--;
                    if (timeLeft <= 0) {
                        clearInterval(timer);
                        roomInfo.speakers.pop(userId);
                        assignMic(); // Assign mic to the next user
                    }
                }, 1000);
            };

            xclient.on('renew-mic-time', async (data) => {
                try {
                    if (
                        !xuser ||
                        (xuser.type !== enums.userTypes.root &&
                            xuser.type !== enums.userTypes.chatmanager &&
                            xuser.type !== enums.userTypes.master &&
                            xuser.type !== enums.userTypes.mastermain &&
                            0)
                    )
                        return; // Ensure only admins can renew time

                    const { userId } = data;
                    const speaker = await getUserById(userId, xroomId);

                    if (speaker) {
                        const timeLeft = getUserTimeLeft(speaker.type);
                        startSpeakerTimer(userId, timeLeft);
                    }
                } catch (err) {
                    console.log('error from renew mic time' + err.toString());
                }
            });

            // Add mic sharing feature
            xclient.on('share-mic', async (data) => {
                try {
                    if (!xuser || !xuser.can_use_mic) return; // Ensure the current user has the mic

                    let { userId } = data;
                    const userToShareWith = await getUserById(userId, xroomId);

                    if (userToShareWith) {
                        if (micQueue.includes(userToShareWith._id.toString())) {
                            micQueue = micQueue.filter(
                                (id) => id !== userToShareWith._id.toString(),
                            );
                            io.to(xroomId).emit('mic-queue-update', micQueue);
                            userToShareWith.can_use_mic = true;
                            await updateUser(userToShareWith, userToShareWith._id, xroomId);
                            io.to(userToShareWith.socketId).emit('mic-enabled', {
                                message: 'Your mic has been enabled temporarily.',
                            });
                            if (!roomInfo.speakers.has(userToShareWith._id.toString())) {
                                roomInfo.speakers.add(userToShareWith._id.toString());
                                io.to(xroomId).emit(
                                    'update-speakers',
                                    Array.from(roomInfo.speakers),
                                );
                                //  startSharedTimer(userToShareWith._id, xuser._id.toString());
                            }
                        }
                        // Retrieve the timer of the current speaker
                    }
                } catch (err) {
                    console.log('error from share mic ' + err.toString());
                }
            });

            const startSharedTimer = (userId, currentSpeaker) => {
                console.log('start shared timer');
                //clearUserTimers(userId);
                for (let [key, value] of userTimers.entries()) {
                    if (key === currentSpeaker) {
                        console.log('key === currentSpeaker');
                        const timer = value.timer;
                        const interval = value.interval;

                        userTimers.set(userId, { timer, interval });
                    }
                }
            };

            // end test mic features

            xclient.on('mute-all', async () => {
                try {
                    console.log('all muted list started', xuser.name);
                    if (!xuser) return;

                    if (!allMutedList.includes(xuser._id.toString())) {
                        allMutedList.push(xuser._id.toString());
                        io.to(xroomId).emit('muted-list', { 'muted-list': allMutedList });
                    } else {
                        allMutedList = allMutedList.filter((id) => id !== xuser._id.toString());
                        io.to(xroomId).emit('muted-list', { 'muted-list': allMutedList });
                    }
                } catch (err) {
                    console.log('error from mute all ' + err.toString());
                }
            });

            xclient.emit('mic-state', {
                speakers: Array.from(roomInfo.speakers),
                micQueue: micQueue,
                holdMic: Array.from(roomInfo.holdMic),
                openedTime: room.opened_time,
            });
        };
        const roomInfo = getRoomData(xroomId);

        function convertToMilliseconds(time) {
            const timeStr = time.toString();
            const length = timeStr.length;

            if (length >= 3) {
                const seconds = parseInt(timeStr.slice(-2)) || 0;
                const minutes = parseInt(timeStr.slice(0, -2)) || 0;
                return (minutes * 60 + seconds) * 1000;
            } else {
                return time * 1000;
            }
        }
        const getUserTimeLeft = (userType) => {
            console.log('room is ' + room.mic);

            const talk_dur = room.mic.talk_dur;
            switch (userType) {
                case enums.userTypes.guest:
                    return convertToMilliseconds(talk_dur[0]);
                case enums.userTypes.member:
                    return convertToMilliseconds(talk_dur[1]);
                case enums.userTypes.admin:
                    return convertToMilliseconds(talk_dur[2]);
                case enums.userTypes.superadmin:
                    return convertToMilliseconds(talk_dur[3]);
                case enums.userTypes.master:
                    return convertToMilliseconds(talk_dur[4]);
                default:
                    return 0;
            }
        };
        const startSpeakerTimer = (userId, timeLeft) => {
            try {
                if (timeLeft > 0) {
                    console.log(
                        `Starting timer for user ${userId}. Time left: ${timeLeft} seconds.`,
                    );
                    clearUserTimers(userId);
                    console.log(
                        `Starting timer for user ${userId}. Time left: ${timeLeft} seconds.`,
                    );
                    const timer = setTimeout(() => {
                        console.log(`Time's up for user ${userId}`);
                        io.to(xroomId).emit('speaker-time-update', {
                            userId: userId,
                            timeLeft: "Time's up",
                        });
                        clearUserTimers(userId);
                        releaseMic(userId);
                    }, timeLeft * 1000);
                    // Emit time updates every second
                    const interval = setInterval(() => {
                        timeLeft -= 1000;
                        io.to(xroomId).emit('speaker-time-update', {
                            userId: userId,
                            timeLeft: timeLeft / 1000,
                        });
                        if (timeLeft <= 0) {
                            //console.log('stop timer from interval');
                            for (const speakerId of roomInfo.speakers) {
                                clearUserTimers(speakerId);
                                releaseMic(speakerId);
                                console.log(`Cleared timer and released mic for user ${speakerId}`);
                            }
                        }
                    }, 1000);
                    userTimers.set(userId, { timer, interval, timeLeft });

                    console.log(
                        `Timer for user ${userId} is active. ` +
                            JSON.stringify(userTimers, null, 2),
                    );
                } else {
                    io.to(xroomId).emit('speaker-time-update', {
                        userId: userId,
                        timeLeft: 'You have an open mic',
                    });
                    userTimers.set(userId, 'open mic');
                }
            } catch (err) {
                console.log('error from start speaker timer ' + err.toString());
            }
        };

        const clearUserTimers = (userId) => {
            console.log('clear timer started');
            const updatedTimers = new Map();
            for (let [key, value] of userTimers.entries()) {
                if (key != userId) {
                    updatedTimers.set(key, value);
                } else {
                    console.log('Clearing timers for userId:', userId);
                    clearTimeout(value.timer);
                    clearInterval(value.interval);
                    const updatedSpeakers = Array.from(roomInfo.speakers).filter(
                        (speaker) => speaker !== userId,
                    );

                    if (updatedSpeakers.length > 0) {
                        startSpeakerTimer(updatedSpeakers[0], value.timeLeft);
                    }
                }
            }
            userTimers = updatedTimers;
            console.log('UserTimers after deletion:', userTimers);
        };
        const releaseMic = (userId) => {
            try {
                const updatedSpeakers = Array.from(roomInfo.speakers).filter(
                    (speaker) => speaker !== userId,
                );
                io.to(xroomId).emit('update-speakers', updatedSpeakers);
                // notify room that the speaker's time has been ended
                io.to(xroomId).emit('speaker-ended', userId);
                console.log('Mic released. Attempting to assign to next user.');
                assignMic();
            } catch (err) {
                console.log('error from release mic ' + err.toString());
            }
        };

        const assignMic = async () => {
            try {
                if (micAssigning /*|| currentSpeaker*/) {
                    console.log('Mic is currently in use or being assigned. Please wait.');
                    return;
                }

                micAssigning = true; // Lock mic assignment immediately
                try {
                    if (micQueue.length === 0) {
                        console.log('Mic queue is empty.');
                        micAssigning = false; // Unlock assignment
                        return;
                    }

                    const nextUserId = micQueue.shift(); // Get the next user from the queue
                    io.to(xroomId).emit('mic-queue-update', micQueue);

                    console.log(
                        `Assigning mic to user: ${nextUserId}. Queue length: ${micQueue.length}`,
                    );

                    const nextUser = await getUserById(nextUserId, xroomId);
                    if (!nextUser || roomInfo.speakers.has(nextUserId)) {
                        console.log(
                            `User ${nextUserId} is already a speaker or not found. Skipping...`,
                        );
                        micAssigning = false;
                        await assignMic(); // Recursively try the next user
                        return;
                    }

                    const room = await roomModel.findById(xroomId);
                    if (!room) return;

                    if (roomInfo.speakers.length < room.max_speakers_count || room.opened_time) {
                        await assignSpeaker(nextUserId, nextUser);
                    } else {
                        socket.emit('error', { message: 'Max speakers limit reached' });
                    }
                } catch (error) {
                    console.error(`Error in mic assignment: ${error.message}`);
                } finally {
                    micAssigning = false;
                    console.log('Mic assignment process completed.');
                }
            } catch (err) {
                console.log('error from assign mic ' + err.toString());
            }
        };

        const assignSpeaker = async (speakerId, speaker) => {
            try {
                //currentSpeaker = speakerId;
                roomInfo.speakers.add(speakerId);
                io.to(xroomId).emit('update-speakers', Array.from(roomInfo.speakers));

                // Remove user from micQueue after assigning mic to them
                if (micQueue.includes(speakerId)) {
                    micQueue = micQueue.filter((id) => id !== speakerId);
                    io.to(xroomId).emit('mic-queue-update', micQueue);
                }
                console.log(`Mic assigned to user: ${speakerId}`);
                await updateUser(speaker, speaker._id, xroomId);

                const timeLeft = getUserTimeLeft(speaker.type);
                startSpeakerTimer(speakerId, timeLeft);
            } catch (err) {
                console.log('error from assign speaker ' + err.toString());
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
        //  xclient.on('disconnect', function () {
        //      micQueue.pop(xuser._id.toString());
        //      roomInfo.speakers.pop(xuser._id.toString());
        //      clearUserTimers(xuser._id.toString());
        //  });

        xclient.on('disconnect', async (data) => {
            const roomInfo = getRoomData(xroomId);

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
            if (roomInfo.speakers.has(xuser._id.toString())) {
                clearUserTimers(xuser._id.toString());
                releaseMic(xuser._id.toString());

                xuser.speakTimer = null;
            }
            if (micQueue.includes(xuser._id.toString())) {
                micQueue = micQueue.filter((id) => id !== xuser._id.toString());
                io.to(xroomId).emit('mic-queue-update', micQueue);
            }

            if (allMutedList.includes(xuser._id.toString())) {
                allMutedList = allMutedList.filter((id) => id !== xuser._id.toString());
                io.to(xroomId).emit('muted-list', { 'muted-list': allMutedList });
            }

            // // Close all WebRTC stuff
            // if (xuser.transport) {
            //     await closeTransport(xroomId, xuser.transport);
            // }
            // if (xuser.producer) {
            //     await closeProducer(xroomId, xuser.producer);
            // }
            // if (xuser.consumers) {
            //     for (const consumerId of xuser.consumers) {
            //         await closeConsumer(xroomId, consumerId);
            //     }
            // }

            // io.to(xroomId).emit('update-listeners', Array.from(roomInfo.listeners));
            // io.to(xroomId).emit('update-hold-mic', Array.from(roomInfo.holdMic));

            // Notify others that the user has left
            io.to(xroomId).emit('user-left', xuser._id.toString());

            if (enterDate) {
                await addEntryLog(xuser, xroomId, enterDate, 0); // 0 for normal disconnect
            }

            console.log('User disconnected:', xuser._id.toString(), xuser.name, 'from:', xroomId);

            //     roomRef: new ObjectId(xroomId),
            // }, {
            //     socketId: null
            // });

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
        });
    });
};
