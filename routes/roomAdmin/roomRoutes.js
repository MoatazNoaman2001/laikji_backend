const express = require('express');
const helpers = require('../../helpers/helpers');
const enums = require('../../helpers/enums');
const groupModel = require('../../models/groupModel');
const roomModel = require('../../models/roomModel');
const entryLogModel = require('../../models/entryLogModel');
const wordFilterModel = require('../../models/wordFilterModel');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const bannedModel = require('../../models/bannedModel');
const { can, getStrongOfType } = require('../../helpers/permissionsHelper');
var ObjectId = require('mongoose').Types.ObjectId;
const { addAdminLog } = require('../../helpers/Logger');
const adminLogModel = require('../../models/adminLogModel');
const { refreshFilters } = require('../../helpers/filterHelpers');
const {
    getUserById,
    public_user,
    getAppUsersColors,
    getUserColor,
    getMemberOfRegUserByName,
    notifyUserChangedByName,
    getUsersInRoom,
} = require('../../helpers/userHelpers');
const roomUsersModel = require('../../models/roomUsersModel');
const { getNowDateTime, hexToXRgb } = require('../../helpers/tools');
const memberModal = require('../../models/memberModal');
const registeredUserModal = require('../../models/registeredUserModal');
const { getRoomData } = require('../../helpers/mediasoupHelpers');
var storage = multer.diskStorage({
    destination: 'public/rooms/',
    filename: function (req, file, cb) {
        cb(null, helpers.generateKey(8) + '-' + Date.now() + path.extname(file.originalname));
    },
});

const img_uploader = multer({
    storage: storage,
});

const getRoomInfo = async (room) => {
    console.log(`room allow_send_imgs: ${room.allow_send_imgs}`);
    
    return {
        name: room.name,
        serial: room.serial,
        title: room.title,
        description: room.description,
        group_name: room.groupRef.name,
        icon: helpers.simg(room.icon),
        type: room.isGold ? 'ذهبية' : room.isSpecial ? 'مميزة' : 'عادية',
        owner: room.owner,
        isGold: room.isGold,
        isSpecial: room.isSpecial,
        outside_style: room.outside_style,
        inside_style: room.inside_style,
        lock_status: room.lock_status,
        lock_msg: room.lock_msg,
        welcome: {
            img: room.welcome.img ? helpers.simg(room.welcome.img) : '',
            text: room.welcome.text,
            direction: room.welcome.direction,
            color: room.welcome.color,
        },
        mic: room.mic,
        startDate: room.startDate,
        endDate: room.endDate,
        subscribeDays: Math.round((room.endDate - room.startDate) / (1000 * 60 * 60 * 24)),
        remainingDays: Math.round((room.endDate - Date.now()) / (1000 * 60 * 60 * 24)),
        capacity: room.capacity,
        master_count: room.master_count,
        super_admin_count: room.super_admin_count,
        admin_count: room.admin_count,
        member_count: room.member_count,
        colors: await getAppUsersColors(),
        allow_send_imgs: room.allow_send_imgs,
    };
};

router.get('/info', async (req, res) => {
    var response = {};
    try {
        let room = req.room;
        response = await getRoomInfo(room);
        console.log(`room keys: ${Object.keys(response)}`);
        
        return res.status(200).send({
            ok: true,
            data: response,
        });
    } catch (e) {
        console.error(e);
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.get('/entry-logs', async (req, res) => {
    var response = {};
    var page = req.query.page ? parseInt(req.query.page) - 1 : 0;
    var limit = 20;

    try {
        let room = req.room;
        var itemsCount = await entryLogModel.count({
            roomRef: room._id,
        });

        var allPages = Math.ceil(itemsCount / limit);

        let logs = await entryLogModel
            .find({
                roomRef: room._id,
            })
            .sort('-exitDate')
            .skip(page * limit)
            .limit(limit)
            .exec();

        let data = [];

        await Promise.all(
            logs.map(async (log) => {
                if (log.userRef) {
                    let u = await getUserById(log.userRef, room._id);
                    let m = null;
                    if (log.memberRef) {
                        m = await memberModal.findById(log.memberRef);
                    }
                    if (u) {
                        u = await public_user(u);
                        data.push({
                            ...log._doc,
                            user: u,
                        });
                        return;
                    }
                }

                data.push({
                    ...log._doc,
                    user_color: hexToXRgb('#000000'),
                });
            }),
        );

        data = data.sort(
            (a, b) => Date.parse(new Date(b.exitDate)) - Date.parse(new Date(a.exitDate)),
        );

        response = {
            allPages: allPages == 0 ? 1 : allPages,
            currentPage: page + 1,
            itemsCount: itemsCount,
            data: data,
        };

        return res.status(200).send({
            ok: true,
            data: response,
        });
    } catch (e) {
        console.error(e);
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.delete('/entry-logs', async (req, res) => {
    try {
        let room = req.room;
        await entryLogModel.deleteMany({
            roomRef: room._id,
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

router.get('/admin-logs', async (req, res) => {
    var response = {};
    var page = req.query.page ? parseInt(req.query.page) - 1 : 0;
    var limit = 20;

    try {
        let room = req.room;
        var itemsCount = await adminLogModel.count({
            roomRef: room._id,
        });

        var allPages = Math.ceil(itemsCount / limit);

        let logs = await adminLogModel
            .find({
                roomRef: room._id,
            })
            .sort('-creationDate')
            .skip(page * limit)
            .limit(limit);

        let data = [];
        await Promise.all(
            logs.map(async (log) => {
                if (log.userRef) {
                    let u = await getUserById(log.userRef, room._id);
                    let m = null;
                    if (log.memberRef) {
                        m = await memberModal.findById(log.memberRef);
                    }
                    if (u) {
                        let user_color = (await getUserColor(m ? m : null, u)).user_color;
                        u = await public_user(u);
                        data.push({
                            ...log._doc,
                            user_color: user_color,
                        });
                        return;
                    }
                }

                data.push({
                    ...log._doc,
                    user_color: hexToXRgb('#000000'),
                });
            }),
        );

        data = data.sort(
            (a, b) => Date.parse(new Date(b.creationDate)) - Date.parse(new Date(a.creationDate)),
        );

        response = {
            allPages: allPages == 0 ? 1 : allPages,
            currentPage: page + 1,
            itemsCount: itemsCount,
            data: data,
        };

        return res.status(200).send({
            ok: true,
            data: response,
        });
    } catch (e) {
        console.error(e);
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.delete('/admin-logs', async (req, res) => {
    try {
        let room = req.room;
        await adminLogModel.deleteMany({
            roomRef: new ObjectId(room._id),
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

router.get('/banned', async (req, res) => {
    var response = {};
    var page = req.query.page ? parseInt(req.query.page) - 1 : 0;
    var limit = 20;

    try {
        let room = req.room;
        var itemsCount = await bannedModel.count({
            $or: [{ roomRef: room._id }, { roomRef: room.meetingRef }],
        });

        var allPages = Math.ceil(itemsCount / limit);

        let logs = await bannedModel
            .find({
                $or: [{ roomRef: room._id }, { roomRef: room.meetingRef }],
            })
            .populate('bannerRef', ['name', 'type', 'strong'])
            .skip(page * limit)
            .limit(limit);

        let data = [];
        await Promise.all(
            logs.map(async (log) => {
                if (log.userRef) {
                    let u = await getUserById(log.userRef, room._id);
                    let m = null;
                    if (log.memberRef) {
                        m = await memberModal.findById(log.memberRef);
                    }
                    if (u) {
                        let user_color = (await getUserColor(m ? m : null, u)).user_color;
                        u = await public_user(u);
                        data.push({
                            ...log._doc,
                            user_color: user_color,
                        });
                        return;
                    }
                }

                data.push({
                    ...log._doc,
                    user_color: hexToXRgb('#000000'),
                });
            }),
        );

        response = {
            allPages: allPages == 0 ? 1 : allPages,
            currentPage: page + 1,
            itemsCount: itemsCount,
            data: logs,
        };

        return res.status(200).send({
            ok: true,
            data: response,
        });
    } catch (e) {
        console.error(e);
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.get('/word-filters', async (req, res) => {
    var response = {};
    var page = req.query.page ? parseInt(req.query.page) - 1 : 0;
    var limit = 20;

    try {
        let room = req.room;

        var itemsCount = await wordFilterModel.count({
            roomRef: room._id,
        });

        var allPages = Math.ceil(itemsCount / limit);

        let logs = await wordFilterModel
            .find({
                roomRef: room._id,
            })
            .sort('-creationDate')
            .select('new_word old_word')
            .skip(page * limit)
            .limit(limit);

        response = {
            allPages: allPages == 0 ? 1 : allPages,
            currentPage: page + 1,
            itemsCount: itemsCount,
            data: logs,
        };

        return res.status(200).send({
            ok: true,
            data: response,
        });
    } catch (e) {
        console.error(e);
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.post('/word-filters', async (req, res) => {
    try {
        let room = req.room;

        let item = new wordFilterModel({
            roomRef: room._id,
            old_word: req.body.old_word,
            new_word: req.body.new_word,
        });

        await item.save();

        addAdminLog(req.user, room._id, `قام بإضافة فلتر`, `has created new filter`, item.old_word);

        refreshFilters(room._id);

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

router.put('/word-filters', async (req, res) => {
    try {
        let room = req.room;

        let item = await wordFilterModel.findOneAndUpdate(
            {
                roomRef: new ObjectId(room._id),
                _id: new ObjectId(req.body._id),
            },
            {
                old_word: req.body.old_word,
                new_word: req.body.new_word,
            },
            {
                new: true,
            },
        );

        addAdminLog(req.user, room._id, `قام بتعديل فلتر`, `has updated filter`, item.old_word);

        refreshFilters(room._id);

        return res.status(200).send({
            ok: true,
            item: item,
        });
    } catch (e) {
        console.error(e);
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.delete('/word-filters/:id', async (req, res) => {
    try {
        let room = req.room;

        let item = await wordFilterModel.findById(req.params.id);

        if (item) {
            await wordFilterModel.findByIdAndDelete(req.params.id);

            addAdminLog(req.user, room._id, `قام بحذف فلتر`, `has deleted filter`, item.old_word);

            refreshFilters(room._id);
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

// app update
router.post('/update', img_uploader.single('welcome_img'), async (req, res) => {
    try {
        let room = req.room;
        if (req.file && req.file.filename) {
            helpers.resizeImage('rooms/' + req.file.filename, true, 900);
        }
        let micObject = {};

        if (req.body.mic) {
            const micString = req.body.mic;
            const validJsonString = micString.replace(/(\w+):/g, '"$1":');
            micObject = JSON.parse(validJsonString);
        }
        var update = {
            mic: {
                mic_permission: micObject.mic_permission ?? room.mic.mic_permission,
                talk_dur: micObject.talk_dur ?? room.mic.talk_dur,
                mic_setting: micObject.mic_setting ?? room.mic.mic_setting,
                shared_mic_capacity: micObject.shared_mic_capacity ?? room.mic.shared_mic_capacity,
            },
            title: req.body.title ?? room.title,
            allow_send_imgs: req.body.allow_send_imgs ?? room.allow_send_imgs,
            description: req.body.description ?? room.description,
            lock_msg: req.body.lock_msg ?? room.lock_msg,
            private_status:
                req.body.private_status && req.body.private_status in ['0', '1', '2', '3']
                    ? parseInt(req.body.private_status)
                    : room.private_status,
            lock_status:
                req.body.lock_status && req.body.lock_status in [0, 1, 2]
                    ? parseInt(req.body.lock_status)
                    : room.lock_status,
            inside_style: {
                background_1: req.body.background_1 ?? room.inside_style.background_1,
                background_2: req.body.background_2 ?? room.inside_style.background_2,
                border_1: req.body.border_1 ?? room.inside_style.border_1,
                font_color: req.body.font_color ?? room.inside_style.font_color,
            },
            welcome: {
                img:
                    req.body.delete_welcome_img == 'yes'
                        ? null
                        : req.file && req.file.filename
                        ? 'rooms/' + req.file.filename
                        : room.welcome.img,
                text: req.body.welcome_text ?? room.welcome.text,
                direction: req.body.welcome_direction ?? room.welcome.direction,
                color: req.body.welcome_color ?? room.welcome.color,
            },
        };

        await roomModel.findOneAndUpdate(
            {
                _id: new ObjectId(room._id),
            },
            update,
        );

        let room_after_update = await roomModel.findOne({
            _id: new ObjectId(room._id),
        });

        global.io.emit(room._id, {
            type: 'room-update',
            data: await helpers.public_room(room_after_update),
        });

        await helpers.notifyRoomChanged(room._id, false, true);

        addAdminLog(req.user, room._id, `قام بتغيير إعدادات الروم`, `has changed room settings`);

        return res.status(200).send({
            ok: true,
            data: await getRoomInfo(room),
        });
    } catch (e) {
        console.error(e);
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.post('/update-icon', img_uploader.single('img'), async (req, res) => {
    try {
        let room = req.room;

        if (req.file && req.file.filename) {
            helpers.resizeImage('rooms/' + req.file.filename);
        }

        var update = {
            icon: req.file && req.file.filename ? 'rooms/' + req.file.filename : room.icon,
        };
        // Update meeting
        await roomModel.findOneAndUpdate(
            { parentRef: new ObjectId(room._id), isMeeting: true },
            {
                ...update,
                parentRef: room._id,
                isMeeting: true,
                isGold: false,
                isSpecial: false,
                groupRef: '606b8f8844e78f128ecbfac2',
                description: '',
                outside_style: {
                    background: '255|255|255',
                    font_color: '0|0|0',
                },
                inside_style: {
                    background_1: '61|147|185',
                    background_2: '72|170|211',
                    border_1: '72|170|211',
                    font_color: '255|255|255',
                },
                //  meetingPassword: '0000',
            },
        );

        await roomModel.findOneAndUpdate(
            {
                _id: new ObjectId(room._id),
            },
            update,
        );

        // Notify and emit refresh event
        global.home_io.emit('groups_refresh', {});

        await helpers.notifyRoomChanged(room._id, false, true);

        addAdminLog(req.user, room._id, `قام بتغيير صورة الروم`, `has changed room photo`);

        return res.status(200).send({
            ok: true,
            data: await getRoomInfo(room),
        });
    } catch (e) {
        console.error(e);
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.delete('/update-icon', async (req, res) => {
    try {
        let room = req.room;

        var update = {
            icon: null,
        };

        await roomModel.findOneAndUpdate(
            {
                _id: new ObjectId(room._id),
            },
            update,
        );

        await helpers.notifyRoomChanged(room._id, false, true);

        addAdminLog(req.user, room._id, `قام بحذف صورة الروم`, `has deleted room photo`);

        return res.status(200).send({
            ok: true,
            data: await getRoomInfo(room),
        });
    } catch (e) {
        console.error(e);
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.get('/users', async (req, res) => {
    var response = {};
    var page = req.query.page ? parseInt(req.query.page) - 1 : 0;
    var limit = 2000;

    try {
        let room = req.room;

        const query = {
            roomRefs: {
                $in: [new ObjectId(room._id), new ObjectId(room.meetingRef)],
            },
        };

        var itemsCount = await registeredUserModal.count(query);

        let logs = await registeredUserModal
            .find(query)
            .skip(page * limit)
            .limit(limit)
            .sort({
                creationDate: -1,
            })
            .exec();

        var allPages = Math.ceil(itemsCount / limit);

        let data = [];

        await Promise.all(
            logs.map(async (l) => {
                let u = { ...l._doc };

                if (
                    !(
                        req.user.type == enums.userTypes.mastermain ||
                        req.user.type == enums.userTypes.chatmanager ||
                        req.user.type == enums.userTypes.root ||
                        req.user.is_spy
                    )
                ) {
                    u.password = null;
                }

                let m = await getMemberOfRegUserByName(u.username, room);
                let user_color = '0|0|0';

                user_color = (await getUserColor(m ? m : null, u)).user_color;

                data.push({
                    ...u,
                    user_color: user_color,
                });
            }),
        );

        data = data.sort(
            (a, b) => Date.parse(new Date(b.creationDate)) - Date.parse(new Date(a.creationDate)),
        );

        response = {
            allPages: allPages == 0 ? 1 : allPages,
            currentPage: page + 1,
            itemsCount: itemsCount,
            data: data,
        };

        return res.status(200).send({
            ok: true,
            data: response,
        });
    } catch (e) {
        console.error(e);
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.get('/users/:id', async (req, res) => {
    try {
        let room = req.room;

        let user = await getUserById(req.params.id, room._id);

        if (user) {
            response = {
                _id: user._id,
                name: user.name,
                enterDate: user.enterDate,
                ip: user.ip,
                stayTime: getNowDateTime(true) - user.enterDate,
                country_code: user.country_code,
                device:
                    user.os == enums.osTypes.android
                        ? 'ANDROID'
                        : user.os == enums.osTypes.ios
                        ? 'IPHONE'
                        : 'DESKTOP',
            };

            return res.status(200).send({
                ok: true,
                data: response,
            });
        }

        return res.status(403).send({
            ok: false,
        });
    } catch (e) {
        console.error(e);
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.post('/users', async (req, res) => {
    try {
        let room = req.room;

        let old_same_type = await registeredUserModal.find({
            type: req.body.type,
            roomRefs: {
                $in: [new ObjectId(room._id), new ObjectId(room.meetingRef)],
            },
        });

        let isFull = false;
        switch (req.body.type) {
            case enums.userTypes.master:
                isFull = old_same_type.length >= room.master_count;
                break;

            case enums.userTypes.superadmin:
                isFull = old_same_type.length >= room.super_admin_count;
                break;

            case enums.userTypes.admin:
                isFull = old_same_type.length >= room.admin_count;
                break;

            case enums.userTypes.member:
                isFull = old_same_type.length >= room.member_count;
                break;
        }

        if (isFull) {
            return res.status(400).send({
                ok: false,
                error_code: 72,
                msg_ar: 'تم تجاوز الحد الأقصى لهذا الحساب؟ احذف عضو',
                msg_en: 'Maximum amount of this user Exceeded',
            });
        }

        let old = await registeredUserModal.find({
            username: req.body.username,
            roomRefs: {
                $in: [new ObjectId(room._id), new ObjectId(room.meetingRef)],
            },
        });

        if (old && old.length > 0) {
            return res.status(400).send({
                ok: false,
                error_code: 71,
                msg_ar: 'اسم المستخدم موجود بالغرفة، يرجى اختيار اسم آخر',
                msg_en: 'Username Already Exists',
            });
        }

        let permissions = req.body.permissions;

        const item = new registeredUserModal({
            roomRefs: [new ObjectId(room._id), new ObjectId(room.meetingRef)],
            username: req.body.username,
            type: req.body.type,
            strong: await getStrongOfType(req.body.type),
            permissions: permissions,
            password: req.body.password,
            is_locked: req.body.is_locked,
        });

        await item.save();

        await roomUsersModel.updateMany(
            {
                roomRef: new ObjectId(room._id),
                room_name: item.username,
            },
            {
                room_password: item.password,
                room_name: item.username,
                regUserRef: item._id,
            },
        );

        await notifyUserChangedByName(item.username, room._id, {
            toast: {
                ar: 'لقد تم تحديث معلومات حسابك',
                en: 'Your information has been updated',
            },
        });

        addAdminLog(
            req.user,
            room._id,
            `قام بإنشاء عضو جديد`,
            `has created an account`,
            item.username,
        );

        return res.status(200).send({
            ok: true,
            data: item,
        });
    } catch (e) {
        console.error(e);
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.put('/users', async (req, res) => {
    try {
        let room = req.room;

        let old = await registeredUserModal.findOne({
            username: req.body.username,
            roomRefs: {
                $in: [new ObjectId(room._id), new ObjectId(room.meetingRef)],
            },
        });

        if (old && old._id != req.body._id) {
            return res.status(400).send({
                ok: false,
                error_code: 71,
                msg_ar: 'اسم المستخدم موجود بالغرفة، يرجى اختيار اسم آخر',
                msg_en: 'Username Already Exists',
            });
        }

        let permissions = req.body.permissions;

        let user = await registeredUserModal.findById(req.body._id);

        let member = await getMemberOfRegUserByName(req.body.username, room);

        if (member) {
            if (req.body.username != user.username) {
                return res.status(400).send({
                    ok: false,
                    error_code: 71,
                    msg_ar: 'عذرا لا يمكن التغيير على اسم الملف',
                    msg_en: 'Sorry, you cannot update member username',
                });
            }
        }

        const old_name = user.username;

        user.type = req.body.type;
        user.strong = await getStrongOfType(req.body.type);
        user.permissions = permissions;
        user.password =
            req.body.password && req.body.password.length > 0 ? req.body.password : user.password;
        user.username = req.body.username;
        user.is_locked = req.body.is_locked;

        await user.save();

        await roomUsersModel.updateMany(
            {
                roomRef: new ObjectId(room._id),
                room_name: old_name,
            },
            {
                room_password: null,
                regUserRef: null,
            },
        );

        await roomUsersModel.updateMany(
            {
                roomRef: new ObjectId(room._id),
                room_name: user.username,
            },
            {
                room_password: user.password,
                room_name: user.username,
                regUserRef: user._id,
            },
        );

        addAdminLog(req.user, room._id, `قام بتعديل عضو`, `has Updated an account`, user.username);

        await notifyUserChangedByName(old_name, room._id, {
            toast: {
                ar: 'لقد تم تحديث معلومات حسابك',
                en: 'Your information has been updated',
            },
        });

        await notifyUserChangedByName(user.username, room._id, {
            toast: {
                ar: 'لقد تم تحديث معلومات حسابك',
                en: 'Your information has been updated',
            },
        });

        // global.io.emit(room._id, {
        //     type: 'info-change',
        //     data: await public_user(item),
        //     toast: {
        //         ar: 'لقد تم تحديث معلومات حسابك',
        //         en: 'Your information has been updated',
        //     },
        // });

        return res.status(200).send({
            ok: true,
            data: user,
        });
    } catch (e) {
        console.error(e);
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.delete('/users', async (req, res) => {
    try {
        let room = req.room;

        if (!can(0)) {
            return res.status(403).send({
                ok: false,
                error_code: 70,
                msg_ar: 'ليس لديك الصلاحية للقيام بذلك',
                msg_en: 'Access Denied',
            });
        }

        const user = await registeredUserModal.findOne({
            _id: new ObjectId(req.body.user_id),
            roomRefs: {
                $in: [new ObjectId(room._id), new ObjectId(room.meetingRef)],
            },
        });

        const name = user.username;

        if (!user || req.user.strong <= user.strong) {
            return res.status(403).send({
                ok: false,
                error_code: 70,
                msg_ar: 'ليس لديك الصلاحية للقيام بذلك',
                msg_en: 'Access Denied',
            });
        }

        await user.delete();

        await roomUsersModel.updateMany(
            {
                roomRef: new ObjectId(room._id),
                room_name: name,
            },
            {
                room_password: null,
                regUserRef: null,
            },
        );

        addAdminLog(req.user, room._id, `قام بحذف عضو`, `has deleted an account`, user.username);

        await notifyUserChangedByName(name, room._id, {
            toast: {
                ar: 'لقد تم تحديث معلومات حسابك',
                en: 'Your information has been updated',
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

router.put('/change-meeting-password', async (req, res) => {
    try {
        console.log('change-meeting-password ' + JSON.stringify(req.body, null, 2));
        if (req.user.type != enums.userTypes.mastermain) {
            return res.status(403).send({
                ok: false,
                error: 'you are not master',
            });
        }

        let room = await roomModel.findById(req.body.roomId);
        room.meetingPassword = req.body.password;
        room.save();

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

router.post('/:roomId/release-hold-mic', async (req, res) => {
    try {
        const roomId = req.room;
        const userId = req.body.userId;

        const roomInfo = getRoomData(roomId);
        roomInfo.holdMic.delete(userId);
        io.to(roomId).emit('update-hold-mic', Array.from(roomInfo.holdMic));

        res.json({ message: 'Mic released' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/:roomId/hold-mic', async (req, res) => {
    try {
        const roomId = req.room;
        const userId = req.body.userId;

        const roomInfo = getRoomData(roomId);
        roomInfo.holdMic.add(userId);
        io.to(roomId).emit('update-hold-mic', Array.from(roomInfo.holdMic));

        res.json({ message: 'Mic held' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
