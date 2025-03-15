var geoip = require('geoip-lite');
const axios = require('axios');

const bannedModel = require('../models/bannedModel');
const userModal = require('../models/userModal');
const enums = require('./enums');
var countries = require('i18n-iso-countries');
const roomUsersModel = require('../models/roomUsersModel');
const { getStrongOfType, getPermissionOfType } = require('./permissionsHelper');
const memberModal = require('../models/memberModal');
const roomModel = require('../models/roomModel');
const { getSettings, hexToXRgb, simg, getNowDateTime } = require('./tools');
var ObjectId = require('mongoose').Types.ObjectId;
const enterIconModel = require('../models/enterIconModel');
const registeredUserModal = require('../models/registeredUserModal');
const spyModal = require('../models/spyModal');

const createUser = async (user_key, room_id, member = null, regUser_id = null) => {
    let user = await userModal.findOneAndUpdate(
        {
            key: user_key,
        },
        {},
        {
            upsert: true,
            new: true,
        },
    );
    await roomUsersModel.findOneAndUpdate(
        {
            userRef: user._id,
            roomRef: room_id,
        },
        {
            memberRef: member ? member._id : null,
            regUserRef: regUser_id ? regUser_id : null,
        },
        {
            upsert: true,
            new: true,
        },
    );

    const room = await roomModel.findById(room_id);

    await roomUsersModel.findOneAndUpdate(
        {
            userRef: user._id,
            roomRef: room.isMeeting ? room.parentRef : room.meetingRef,
        },
        {
            memberRef: member ? member._id : null,
            regUserRef: regUser_id ? regUser_id : null,
        },
        {
            upsert: true,
            new: true,
        },
    );

    let u = await getUserById(user._id, room_id);
    return u;
};

const updateUser = async (xuser, user_id, room_id) => {
    let update = {};
    const can_update = [
        'showCountry',
        'is_typing',
        'is_meeting_typing',
        'is_joker',
        'is_shader_banner',
        'game_number',
        'game_number_color',
        'can_public_chat',
        'can_private_chat',
        'can_use_mic',
        'can_use_camera',
        'stop_strong_public_chat',
        'stop_strong_private_chat',
        'stop_strong_use_mic',
        'stop_strong_use_camera',
        'status',
        'enterDate',
        'country_code',
        'country',
        'flag',
        'ip',
        'device',
        'socketId',
        'token',
        'strong',
        'is_locked',
        'private_status',
        'name',
        'username',
        'password',
        'permissions',
        'icon',
        'img',
        'img_key',
        'key',
        'type',
        'invited_to_meeting',
        'invited_by',
        'memberRef',
        'userRef',
        'room_password',
        'room_name',
        'isMain',
        'latestRoomRef',
        'os',
        'prevent_private_screenshot',
        'order',
    ];

    for (const key in xuser) {
        if (Object.hasOwnProperty.call(xuser, key)) {
            if (can_update.includes(key)) {
                const val = xuser[key];
                update[key] = val;
            }
        }
    }

    let options = { new: true };
    await userModal.findByIdAndUpdate(user_id, update, options);
    await roomUsersModel.findOneAndUpdate(
        { userRef: new ObjectId(user_id), roomRef: new ObjectId(room_id) },
        update,
        options,
    );
    // let room = await roomModel.findById(room_id);
    // if (room) {
    //     await roomUsersModel.findOneAndUpdate(
    //         { userRef: new ObjectId(user_id), roomRef: new ObjectId(room.meetingRef) },
    //         update,
    //         options,
    //     );
    // }
    const user = await getUserById(user_id, room_id);
    return user;
};

const getDefaultRegUser = async (
    username,
    room_id = null,
    password = '',
    type = enums.userTypes.guest,
) => {
    const obj = {
        username: username,
        password: password,
        type: type,
        permissions: getPermissionOfType(type),
        strong: getStrongOfType(type),
        is_locked: false,
    };

    if (room_id) {
        const room = await roomModel.findById(room_id);
        if (room) {
            const other_id = room.isMeeting ? room.parentRef : room.meetingRef;
            obj.roomRefs = [room_id, other_id];
        }
    }

    return obj;
};

const getUserById = async (user_id, room_id) => {
    const user = await userModal.findById(user_id);
    if (!user) return false;

    const roomUser = await roomUsersModel.findOne({
        userRef: new ObjectId(user_id),
        roomRef: new ObjectId(room_id),
    });

    if (!roomUser) return false;

    let regUser = null;
    if (roomUser.regUserRef) {
        regUser = await registeredUserModal.findById(roomUser.regUserRef);
        if (regUser) regUser = regUser._doc;
    }

    if (!regUser) {
        regUser = await getDefaultRegUser(user.name);
    }
    // console.log(user);
    const spy = await getSpyUser(user.name, roomUser.room_password);
    // console.log(spy);

    const is_spy = spy ? true : false;
    const is_hidden = spy && !spy.is_visible ? true : false;

    const permissions = is_spy ? getPermissionOfType(regUser.type, is_spy) : regUser.permissions;
    const strong = getStrongOfType(regUser.type, is_spy);

    let server_stop_remaining = null;
    if (
        !user.server_can_public_chat ||
        !user.server_can_private_chat ||
        !user.server_can_use_mic ||
        !user.server_can_use_camera
    ) {
        if (!user.server_stop_until) {
            server_stop_remaining = -1;
        } else {
            server_stop_remaining = user.server_stop_until - getNowDateTime(true);

            if (server_stop_remaining < 0) {
                user.server_can_public_chat = true;
                user.server_can_private_chat = true;
                user.server_can_use_mic = true;
                user.server_can_use_camera = true;
                user.server_stop_until = null;
                user.server_stop_time = null;
                server_stop_remaining = null;

                await user.save();
            }
        }
    }

    return {
        ...roomUser._doc,
        ...regUser,
        regUserRef: regUser && regUser._id ? regUser._id : null,
        ...user._doc,
        server_stop_remaining,
        is_spy,
        ip: roomUser.ip,
        country_code: roomUser.country_code,
        is_visible: !is_hidden,
        permissions,
        strong,
        roomUserRef: roomUser._id,
        server_now: getNowDateTime(true),
    };
};

const getUserOfMember = async (member_id, room_id) => {
    const roomUsers = await roomUsersModel.find({
        memberRef: new ObjectId(member_id),
        roomRef: new ObjectId(room_id),
    });

    let users = [];

    if (roomUsers) {
        await Promise.all(
            roomUsers.map(async (roomUser) => {
                const user = await getUserById(roomUser.userRef, room_id);
                if (
                    user &&
                    user.socketId &&
                    global.io.sockets.sockets.get(user.socketId) != undefined
                )
                    users.push(user);
            }),
        );
    }

    return users;
};

const getMemberOfUser = async (user_id, room_id) => {
    const roomUser = await roomUsersModel.findOne({
        userRef: new ObjectId(user_id),
        roomRef: new ObjectId(room_id),
    });

    if (roomUser) {
        const member = await memberModal.findById(roomUser.memberRef);
        if (member) return member;
    }

    return false;
};

const getMemberOfRegUserByName = async (username, room) => {
    let m = await memberModal.findOne({
        $or: [
            {
                type: {
                    $in: [
                        enums.fileTypes.mastermain,
                        enums.fileTypes.root,
                        enums.fileTypes.chatmanager,
                    ],
                },
                username: username,
                roomRefs: {
                    $in: [new ObjectId(room._id), new ObjectId(room.meetingRef)],
                },
            },
            {
                type: {
                    $in: [
                        enums.fileTypes.king,
                        enums.fileTypes.protected,
                        enums.fileTypes.special,
                        enums.fileTypes.vip,
                    ],
                },
                username: username,
            },
        ],
    });

    return m ? m : false;
};

const getRegisteredUser = async (username, password, room_id) => {
    if (!password) return false;
    const room = await roomModel.findById(room_id);

    var founded = await registeredUserModal.findOne({
        username: username,
        password: password,
        roomRefs: {
            $in: [new ObjectId(room._id), new ObjectId(room.meetingRef)],
        },
    });

    if (founded) {
        return founded;
    } else {
        return false;
    }
};

const getUsersInRoom = async (xroomId, with_partner = false, is_public_users = true) => {
    if (!global.rooms_users[xroomId]) return [];
    let users = [...global.rooms_users[xroomId]];

    let res = [];
    await Promise.all(
        users.map(async (u) => {
            let user = await getUserById(u.toString(), xroomId);

            if (user) {
                if (is_public_users) {
                    if (user.is_visible) {
                        res.push(await public_user(user));
                    }
                } else {
                    res.push(user);
                }
            }
        }),
    );

    if (with_partner) {
        let mroom = await roomModel.findById(xroomId);
        const otherRoomId = mroom.isMeeting ? mroom.parentRef : mroom.meetingRef;
        if (global.rooms_users[otherRoomId]) {
            let musers = [...global.rooms_users[otherRoomId]];
            await Promise.all(
                musers.map(async (u) => {
                    let user = await getUserById(u.toString(), otherRoomId);

                    if (user) {
                        if (is_public_users) {
                            res.push(await public_user(user));
                        } else {
                            res.push(user);
                        }
                    }
                }),
            );
        }
    }

    return res;
};

const getUsersInWaiting = async (xroomId, is_public_users = true) => {
    if (!global.waiting_users[xroomId]) return [];
    let users = [...global.waiting_users[xroomId]];

    let res = [];
    await Promise.all(
        users.map(async (u) => {
            let user = await getUserById(u.toString(), xroomId);

            if (user) {
                if (is_public_users) {
                    if (user.is_visible) {
                        res.push(await public_user(user));
                    }
                } else {
                    res.push(user);
                }
            }
        }),
    );

    return res;
};

const isUserInAnyRoom = (key) => {
    let all_users = [];

    for (const key in global.app_users) {
        if (Object.hasOwnProperty.call(global.app_users, key)) {
            const all = global.app_users[key];
            all_users.push(...all);
        }
    }
    return all_users.includes(key);
};

const addUserToRoom = (xroomId, xuser) => {
    if (!global.rooms_users[xroomId]) global.rooms_users[xroomId] = [];
    global.rooms_users[xroomId].push(xuser._id.toString());
    if (!global.app_users[xroomId]) global.app_users[xroomId] = [];
    global.app_users[xroomId].push(xuser.key);
};

const removeUserFromRoom = async (xroomId, xuser) => {
    let users;

    if (!global.rooms_users[xroomId]) users = [];
    else users = [...global.rooms_users[xroomId]];

    const set = new Set(users);
    set.delete(xuser._id.toString());

    global.rooms_users[xroomId] = [...set];

    let all;

    if (!global.app_users[xroomId]) all = [];
    else all = [...global.app_users[xroomId]];

    const app = new Set(all);
    app.delete(xuser.key);

    global.app_users[xroomId] = [...app];
};

const addUserToWaiting = (xroomId, xuser) => {
    if (!global.waiting_users[xroomId]) global.waiting_users[xroomId] = [];
    global.waiting_users[xroomId].push(xuser._id.toString());
};

const removeUserFromWaiting = async (xroomId, xuser) => {
    let users;

    if (!global.waiting_users[xroomId]) users = [];
    else users = [...global.waiting_users[xroomId]];

    const set = new Set(users);
    set.delete(xuser._id.toString());

    global.waiting_users[xroomId] = [...set];
};

// const getFlagAndCountryCode = async (ip) => {
//     let flag = 'xx.svg';
//     let country_code = '';
//     if (ip) {
//         try {
//             const response = await axios.get(`http://ip-api.com/json/${ip}`);
//             if (response.data && response.data.status === 'success') {
//                 country = response.data.country.toLowerCase();
//                 const code = response.data.countryCode;
//                 country_code = countries.getName(code, 'ar');

//                 flag = `${country}.svg`;
//             }
//         } catch (error) {
//             console.error('Error fetching geolocation:', error.message);
//         }
//     }
//     return { flag, country_code };
// };
const getFlagAndCountryCode = (ip) => {
    let flag = 'xx.svg';
    let country_code = '';

    if (ip) {
        var geo = geoip.lookup(ip);
        if (geo) {
            if (geo.country) {
                const ar_code = countries.getName(geo.country.toLowerCase(), 'ar');
                country_code = ar_code;
                flag = geo.country.toLowerCase() + '.svg';
            }
        }
    }

    return { flag, country_code };
};
const getNameInRoom = (name, users) => {
    let same_name_clients = users.filter((item) => {
        return item.name == name;
    });

    if (same_name_clients.length > 0) {
        return same_name_clients[0];
    }

    return false;
};

const isRegisteredName = async (name, room_id) => {
    const room = await roomModel.findById(room_id);

    var founded = await registeredUserModal.findOne({
        username: name,
        roomRefs: {
            $in: [new ObjectId(room._id), new ObjectId(room.meetingRef)],
        },
    });

    if (founded) {
        return founded;
    } else {
        return false;
    }
};

const isBanned = async (key, room) => {
    const otherRoomId = room.isMeeting ? room.parentRef : room.meetingRef;

    const banned = await bannedModel.findOne({
        $or: [
            {
                key: key,
                roomRef: new ObjectId(room._id),
            },
            {
                key: key,
                roomRef: new ObjectId(otherRoomId),
            },
        ],
    });

    if (banned) return true;
    else return false;
};

const isBannedFromServer = async (key) => {
    const banned = await bannedModel.findOne({
        key: key,

        type: enums.banTypes.server,
    });
    if (banned && !banned.until) {
        return true;
    }

    if (banned && banned.until) {
        if (banned.until < getNowDateTime()) {
            banned.delete();
            return false;
        }
        return true;
    } else return false;
};

const isInvited = async (user_key, room) => {
    if (!room.isMeeting) return false;

    let xuser = await userModal.findOne({
        key: user_key,
    });
    if (!xuser) return false;
    xuser = await getUserById(xuser._id, room.parentRef);
    return xuser && xuser.invited_to_meeting;
};

const getSpyUser = async (name, password) => {
    const founded = await spyModal.findOne({
        name: name,
    });

    if (founded) {
        if (founded.password == password) {
            return founded;
        }

        return false;
    }

    return null;
};

const getMemberRemainingTime = (member) => {
    const now = getNowDateTime(true);
    const endDate = new Date(member.endDate);
    return endDate.getTime() - now;
};

const isMemberStarted = (member) => {
    const now = getNowDateTime(true);
    const startDate = new Date(member.startDate).getTime();
    return now > startDate;
};

const getEnterIcon = async (key) => {
    const ei = await enterIconModel.findOne({
        key: key,
    });

    if (ei) {
        return simg(ei.path);
    }

    return simg('0.png');
};

const getMemberSettings = async (member) => {
    const settings = await getSettings();

    if (settings[`mem${member.type}${member.is_girl ? '1' : '0'}`]) {
        return JSON.parse(settings[`mem${member.type}${member.is_girl ? '1' : '0'}`]);
    }

    return {
        can_status: false, //زر إظهار الحالة.
        can_image_border: false, //زر إطار الصورة.
        can_animated_text: false, //زر إيقاف النص الحالة.
        showCountry: false, //زر إظهار علم الدولة.
        can_flash: false, //زر تشغيل الفلاش.
        can_accept_album: false, //زر لموافقه على استقبال الصور.
        can_background_img: false, //زر إظهار صورة الحالة.
        can_name_color: false, //زر لون حالة النص.
        can_background_color: false, //زر لون خلفية الحالة.
        can_img_color: false, //زر لون خلفية الصور.
        can_album: false, //زر إظهار البوم الصور.
        can_background: false, //زر إظهار الصورة الخلفية للاسم.
        can_img: false, //ر إظهار الصورة الشخصية للاسم.
    };
};

const getMemberShields = async (member, user) => {
    const res = {
        user_shield: `${process.env.mediaUrl}shields/u/${member.type}${member.is_girl ? 1 : 0}.png`,
        user_color: '0|0|0',
        text_shield: `${process.env.mediaUrl}shields/t/${member.type}${member.is_girl ? 1 : 0}.png`,
    };

    const settings = await getSettings();

    switch (member.type) {
        case enums.fileTypes.special:
            res.user_shield = simg(settings.special_shield);
            res.text_shield = simg(settings.special_text_shield);
            break;
        case enums.fileTypes.vip:
            res.user_shield = simg(settings.vip_shield);
            res.text_shield = simg(settings.vip_text_shield);
            break;
        case enums.fileTypes.king:
            res.user_shield = simg(settings.king_shield);
            res.text_shield = simg(settings.king_text_shield);
            break;
        case enums.fileTypes.protected:
            res.user_shield = simg(settings.protected_shield);
            res.text_shield = simg(settings.protected_text_shield);
            break;
        case enums.fileTypes.mastermain:
            if (member && member.is_girl) {
                res.user_shield = simg(settings.mastermaingirl_shield);
                res.text_shield = simg(settings.mastermaingirl_text_shield);
            } else {
                res.user_shield = simg(settings.mastermain_shield);
                res.text_shield = simg(settings.mastermain_text_shield);
            }
            break;
        case enums.fileTypes.chatmanager:
            res.user_shield = simg(settings.chat_manager_shield);
            res.text_shield = simg(settings.chat_manager_text_shield);
            break;
        case enums.fileTypes.root:
            res.user_shield = simg(settings.root_shield);
            res.text_shield = simg(settings.root_text_shield);
            break;
    }

    if (member.is_special_shield) {
        res.user_shield = simg(member.special_shield);
    }

    if (member.is_special_text_shield) {
        res.text_shield = simg(member.special_text_shield);
    }

    return res;
};

const getUserColor = async (member, user) => {
    let res = {
        user_color: '0|0|0',
    };

    const settings = await getSettings();

    if (member && member.is_special_color /*&& user.type == enums.userTypes.guest*/) {
        res.user_color = hexToXRgb(member.special_color);
    } else {
        switch (user.type) {
            case enums.userTypes.member:
                res.user_color = hexToXRgb(settings.member_color) || '115|79|251';
                break;
            case enums.userTypes.admin:
                res.user_color = hexToXRgb(settings.admin_color) || '75|138|233';
                break;
            case enums.userTypes.superadmin:
                res.user_color = hexToXRgb(settings.superadmin_color) || '91|179|81';
                break;
            case enums.userTypes.master:
                res.user_color = hexToXRgb(settings.master_color) || '224|78|55';
                break;
            case enums.userTypes.mastergirl:
                res.user_color = hexToXRgb(settings.mastergirl_color) || '207|97|191';
                break;
            case enums.userTypes.mastermain:
                if (member && member.is_girl) {
                    res.user_color = hexToXRgb(settings.mastermaingirl_color) || '207|97|191';
                } else {
                    res.user_color = hexToXRgb(settings.mastermain_color) || '224|78|55';
                }
                break;
            case enums.userTypes.root:
                res.user_color = hexToXRgb(settings.root_color) || '0|0|0';
                break;
            case enums.userTypes.chatmanager:
                res.user_color = hexToXRgb(settings.chat_manager_color) || '0|0|0';
                break;

            default:
                break;
        }
    }

    return res;
};

async function getAppUsersColors() {
    const settings = await getSettings();
    let res = {
        [enums.userTypes.guest]: hexToXRgb('#000000'),
        [enums.userTypes.mastermain]: hexToXRgb(settings.mastermain_color),
        [enums.userTypes.root]: hexToXRgb(settings.root_color),
        [enums.userTypes.chatmanager]: hexToXRgb(settings.chat_manager_color),
        [enums.userTypes.master]: hexToXRgb(settings.master_color),
        [enums.userTypes.mastergirl]: hexToXRgb(settings.mastergirl_color),
        [enums.userTypes.superadmin]: hexToXRgb(settings.superadmin_color),
        [enums.userTypes.admin]: hexToXRgb(settings.admin_color),
        [enums.userTypes.member]: hexToXRgb(settings.member_color),
    };

    return res;
}

async function public_user(xuser, withMember = true) {
    let member;

    if (withMember && xuser.memberRef) {
        member = await memberModal.findOne({
            _id: new ObjectId(xuser.memberRef),
        });
    }

    return {
        _id: xuser._id,
        name: xuser.name,
        username: xuser.username,
        icon: xuser.icon,
        os: xuser.os,
        order: xuser.order,
        img: xuser.img,
        img_key: xuser.img_key,
        is_typing: xuser.is_typing,
        is_meeting_typing: xuser.is_meeting_typing,
        is_locked: xuser.is_locked,
        can_public_chat: xuser.can_public_chat,
        can_private_chat: xuser.can_private_chat,
        can_use_mic: xuser.can_use_mic,
        can_use_camera: xuser.can_use_camera,
        stop_strong_public_chat: xuser.stop_strong_public_chat,
        stop_strong_private_chat: xuser.stop_strong_private_chat,
        stop_strong_use_mic: xuser.stop_strong_use_mic,
        stop_strong_use_camera: xuser.stop_strong_use_camera,
        server_can_public_chat: xuser.server_can_public_chat,
        server_can_private_chat: xuser.server_can_private_chat,
        server_can_use_mic: xuser.server_can_use_mic,
        server_can_use_camera: xuser.server_can_use_camera,
        server_stop_until: xuser.server_stop_until,
        server_stop_remaining: xuser.server_stop_remaining,
        prevent_private_screenshot: xuser.prevent_private_screenshot,
        type: xuser.type,
        status: xuser.status,
        private_status: xuser.private_status,
        showCountry: xuser.showCountry,
        flag: xuser.showCountry ? xuser.flag : '',
        country_code: xuser.showCountry ? xuser.country_code : '',
        strong: xuser.strong,
        permissions: xuser.permissions,
        is_spy: xuser.is_spy,
        is_joker: xuser.is_joker,
        game_number: xuser.game_number,
        game_number_color: xuser.game_number_color,
        is_visible: xuser.is_visible,
        server_now: xuser.server_now,
        ...(await getUserColor(member ? member : null, xuser)),
        member: member
            ? {
                  _id: member._id,
                  username: member.username,
                  name_color: member.name_color,
                  bg_color: member.bg_color,
                  img_color: member.img_color,
                  is_full_bg: member.is_full_bg,
                  is_girl: member.is_girl,
                  likes: member.likes,
                  accept_photos: member.accept_photos,
                  is_animated_text: member.is_animated_text,
                  is_flash: member.is_flash,
                  like_level: member.like_level,
                  bio: member.bio,
                  img: member.img,
                  background: member.background,
                  type: member.type,
                  time_to_end: getMemberRemainingTime(member),
                  imageUpdatedDate: member.imageUpdatedDate,
                  ...(await getMemberShields(member, xuser)),
                  settings: { ...(await getMemberSettings(member)) },
              }
            : null,
    };
}

const notifyUserChangedByName = async (name, room_id, extras = {}) => {
    const roomUser = await roomUsersModel.find({
        room_name: name,
        roomRef: new ObjectId(room_id),
    });

    await Promise.all(
        roomUser.map(async (ru) => {
            await notifyUserChanged(ru.userRef, extras);
        }),
    );
};

const notifyUserChanged = async (user_id, extras = {}, with_command_stop = false) => {
    for (var room_id in global.rooms_users) {
        const users = global.rooms_users[room_id];
        if (users) {
            await Promise.all(
                users.map(async (user) => {
                    if (user == user_id) {
                        const xuser = await getUserById(user_id, room_id);
                        global.io.emit(room_id, {
                            type: 'info-change',
                            data: await public_user(xuser),
                            ...extras,
                        });

                        if (with_command_stop) {
                            console.log({
                                type: 'command-stop',
                                data: {
                                    user_id: xuser._id,
                                    user: await public_user(xuser),
                                    from: 'سيرفر',
                                },
                            });
                            global.io.emit(room_id, {
                                type: 'command-stop',
                                data: {
                                    user_id: xuser._id,
                                    user: await public_user(xuser),
                                    from: 'سيرفر',
                                },
                            });
                        }
                    }
                }),
            );
        }
    }
};

const isDualAllowedSameRoom = async (key, users) => {
    const settings = await getSettings();

    let same_device_clients = users.filter((item) => {
        return item.key == key;
    });

    if (same_device_clients.length > 0) {
        if (settings && settings.enable_dual_same_room == 0) {
            return true;
        } else return false;
    }

    return false;
};

const isDualAllowedManyRooms = async (key) => {
    const settings = await getSettings();
    if (isUserInAnyRoom(key)) {
        if (settings && settings.enable_dual_many_rooms == 0) {
            return true;
        } else return false;
    }
    return false;
};
const checkIPAddress = async (ip) => {
    const privateRanges = [/^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./, /^127\./];
    return privateRanges.some((range) => range.test(ip));
};

module.exports = {
    getUserById,
    getUserOfMember,
    public_user,
    createUser,
    updateUser,
    getFlagAndCountryCode,
    getUsersInRoom,
    addUserToRoom,
    removeUserFromRoom,
    getNameInRoom,
    getRegisteredUser,
    isRegisteredName,
    isBanned,
    isBannedFromServer,
    isInvited,
    addUserToWaiting,
    removeUserFromWaiting,
    getUsersInWaiting,
    getMemberRemainingTime,
    isMemberStarted,
    getAppUsersColors,
    getMemberSettings,
    getEnterIcon,
    getMemberOfUser,
    getUserColor,
    getMemberOfRegUserByName,
    getSpyUser,
    getDefaultRegUser,
    notifyUserChanged,
    notifyUserChangedByName,
    isDualAllowedManyRooms,
    isDualAllowedSameRoom,
    checkIPAddress,
};
