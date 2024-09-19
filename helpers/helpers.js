const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const chatModel = require('../models/chatModel');
const secretKey = '@catsanddogs';
const Jimp = require('jimp');
const fs = require('fs');
const enums = require('./enums');
const ShortCrypt = require('short-crypt');
const roomUsersModel = require('../models/roomUsersModel');
const {
    getUserById,
    getAppUsersColors,
    getUsersInRoom,
    updateUser,
    notifyUserChanged,
} = require('./userHelpers');
var ObjectId = require('mongoose').Types.ObjectId;
var path = require('path');
const moment = require('moment/moment');
const { getNowDateTime, hexToXRgb, getSettings } = require('./tools');
const roomModel = require('../models/roomModel');
const groupModel = require('../models/groupModel');
const reportModel = require('../models/reportModel');

function generateKey(length = 32) {
    return crypto
        .randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length);
}

function generateToken(_id) {
    let payload = {
        id: _id,
    };

    return jwt.sign(payload, secretKey);
}

function verifyToken(req, res) {
    try {
        var token = jwt.verify(req.body.token, secretKey);
        if (!token) {
            res.status(200).send({
                ok: false,
                error: 'token not good',
            });
            return false;
        } else {
            return token;
        }
    } catch (e) {
        res.status(200).send({
            ok: false,
            error: e.message,
        });
        return false;
    }
}

function verifyTokenGet(t) {
    try {
        var token = jwt.verify(t, secretKey);
        if (!token) {
            return false;
        } else {
            return token;
        }
    } catch (e) {
        return false;
    }
}

async function getUserByToken(t) {
    try {
        var token_user = jwt.verify(t, secretKey);
        if (!token_user) return false;
        var ru = await roomUsersModel.findOne({
            _id: token_user.id,
        });

        var user = await getUserById(ru.userRef, ru.roomRef);

        return user;
    } catch (error) {
        return false;
    }
}

const getRoomRemainingTime = (room) => {
    const now = getNowDateTime(true);
    const endDate = new Date(room.endDate);
    return endDate.getTime() - now;
};

const isRoomStarted = (room) => {
    const now = getNowDateTime(true);
    const startDate = new Date(room.startDate).getTime();
    return now > startDate;
};

const isRoomEnded = (room) => {
    const remaining_time = getRoomRemainingTime(room);
    return remaining_time < 10000;
};

const getJokerInRoom = async (room) => {
    try {
        const users_in_room = await getUsersInRoom(room._id, false, false);
        const jokers = users_in_room.filter((u) => u.is_joker == true);
        return jokers.length > 0 ? jokers[0] : null;
    } catch (e) {
        console.error(e);
    }

    return false;
};

const endJokerInRoom = async (room) => {
    try {
        const users_in_room = await getUsersInRoom(room._id, false, false);
        users_in_room.forEach(async (u) => {
            u.order = 0;
            u.is_joker = false;
            u.game_number = '';
            u.game_number_color = '255|255|255';
            u = await updateUser(u, u._id, room._id);
            await notifyUserChanged(u._id);
        });
    } catch (e) {
        console.error(e);
    }
};

async function public_room(room) {
    const settings = await getSettings();
    var chats = await chatModel.find({
        roomRef: room._id,
    });

    var mainChat = chats.find((c) => c.isMain == true)._id;

    return {
        _id: room._id,
        serial: room.serial,
        parentRef: room.parentRef,
        meetingRef: room.meetingRef,
        name: room.name,
        title: room.title,
        ad_text: settings.ad_text,
        description: room.description,
        icon: simg(room.icon),
        mainChat: mainChat,
        chats: chats,
        isGold: room.isGold,
        isSpecial: room.isSpecial,
        isMeeting: room.isMeeting,
        type: room.isGold ? 'ذهبية' : room.isSpecial ? 'مميزة' : 'عادية',
        outside_style: room.outside_style,
        inside_style: room.inside_style,
        private_status: room.private_status,
        lock_status: room.lock_status,
        lock_msg: room.lock_msg,
        welcome: {
            img: room.welcome.img ? simg(room.welcome.img) : '',
            text: room.welcome.text,
            direction: room.welcome.direction,
            color: room.welcome.color,
        },
        colors: await getAppUsersColors(),
    };
}

async function public_room_small(room, group = null) {
    return {
        _id: room._id,
        serial: room.serial,
        parentRef: room.parentRef,
        meetingRef: room.meetingRef,
        name: room.name,
        icon: room.icon ? process.env.mediaUrl + room.icon : null,
        isGold: room.isGold,
        isSpecial: room.isSpecial,
        isMeeting: room.isMeeting,
        background: room.background,
        inside_style: room.inside_style,
        description: room.description,
        lock_status: room.lock_status,
        lock_msg: room.lock_msg,
        country_name: group ? group.name : null,
        country_icon: group && group.icon ? process.env.mediaUrl + group.icon : null,
    };
}

const get_room_small = async (rr, gg, settings = null) => {
    if (!settings) {
        settings = await getSettings();
    }

    var r = await public_room_small(rr, gg);

    var u_in_room = global.rooms_users[r._id];

    if (u_in_room) {
        r.users_count = global.rooms_users[r._id].length;
    } else {
        r.users_count = 0;
    }

    if (r.isSpecial) {
        r.background = hexToXRgb(settings.rgb_special_room_bg) || '166|176|191';
        r.font = hexToXRgb(settings.rgb_special_room_fnt) || '255|255|255';
    } else if (r.isGold) {
        r.background = hexToXRgb(settings.rgb_gold_room_bg) || '204|209|136';
        r.font = hexToXRgb(settings.rgb_gold_room_fnt) || '255|255|255';
    } else if (r.isMeeting) {
        r.users_count = 0;
        r.background = hexToXRgb(settings.rgb_meet_room_bg) || '80|80|80';
        r.font = hexToXRgb(settings.rgb_meet_room_fnt) || '255|255|255';
    } else {
        r.background = hexToXRgb(settings.rgb_normal_room_bg) || '255|255|255';
        r.font = hexToXRgb(settings.rgb_normal_room_fnt) || '0|0|0';
    }

    return r;
};

const notifyReportChanged = async () => {
    const reports = await reportModel.count();
    global.home_io.emit('reports_count', {
        count: reports,
    });
};

const notifyAllRoomsChanged = async () => {
    const rooms = await roomModel.find();
    await Promise.all(
        rooms.map(async (room) => {
            global.io.emit(room._id, {
                type: 'room-update',
                data: await public_room(room),
            });
        }),
    );
};

const notifyRoomChanged = async (room_id, noti_room = true, noti_home = false) => {
    let room = await roomModel
        .findOne({
            _id: new ObjectId(room_id),
        })
        .populate('groupRef');

    if (noti_room) {
        global.io.emit(room_id, {
            type: 'room-update',
            data: await public_room(room),
        });
    }

    if (noti_home) {
        global.home_io.emit('room_changed', {
            data: await get_room_small(room, room.groupRef),
        });
    }
};

function resizeImage(path, inPublic = true, width = 150) {
    const img_path = (inPublic ? 'public/' : '') + path;
    return new Promise((resolve) => {
        Jimp.read(img_path, (err, img) => {
            if (!err) {
                if (
                    ['jpg', 'jpeg', 'png'].includes(
                        img.getMIME().toLowerCase().replace('image/', ''),
                    )
                ) {
                    let aspect = 1;
                    let max_width = width,
                        max_height = 1;
                    if (img.getWidth() > max_width) {
                        aspect = img.getHeight() / img.getWidth();
                        max_height = max_width * aspect;
                        img.resize(max_width, max_height).quality(60).write(img_path);
                    }
                }
            }
            resolve();
        });
    });
}

async function saveMulterFile(file, folder, name = null) {
    const dest_file =
        'public/' +
        folder +
        '/' +
        (name ? name : generateKey(8) + '-' + Date.now()) +
        path.extname(file.originalname);

    await fs.writeFileSync(dest_file, file.buffer);

    return dest_file.replace('public/', '');
}

function removeFile(path, inPublic = true) {
    const file_path = (inPublic ? 'public/' : '') + path;
    return new Promise((resolve) => {
        try {
            if (!fs.lstatSync(file_path).isDirectory()) {
                fs.rmSync(file_path, {
                    force: true,
                });
            }
        } catch (e) {}
        resolve();
    });
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function simg(img) {
    return img ? process.env.mediaUrl + img : null;
}

function simpleEncString(text) {
    const sc = new ShortCrypt('4asf16ds5');
    const ss = sc.encryptToURLComponent(text);
    return ss;
}

function simpleDecString(text) {
    const sc = new ShortCrypt('4asf16ds5');
    const ss = sc.decryptURLComponent(text);
    return new Buffer(ss).toString('ascii');
}

function ip2num(ip) {
    var d = ip.split('.');

    var num = 0;
    num += Number(d[0]) * Math.pow(256, 3);
    num += Number(d[1]) * Math.pow(256, 2);
    num += Number(d[2]) * Math.pow(256, 1);
    num += Number(d[3]);

    return num;
}

function num2ip(num) {
    var ip = num % 256;

    for (var i = 3; i > 0; i--) {
        num = Math.floor(num / 256);
        ip = (num % 256) + '.' + ip;
    }

    return ip;
}

module.exports = {
    generateKey,
    generateToken,
    secretKey,
    verifyToken,
    verifyTokenGet,
    getUserByToken,
    public_room,
    public_room_small,
    get_room_small,
    sleep,
    resizeImage,
    removeFile,
    simg,
    simpleEncString,
    simpleDecString,
    ip2num,
    saveMulterFile,
    num2ip,
    isRoomStarted,
    isRoomEnded,
    getRoomRemainingTime,
    notifyRoomChanged,
    notifyAllRoomsChanged,
    notifyReportChanged,
    endJokerInRoom,
    getJokerInRoom,
};
