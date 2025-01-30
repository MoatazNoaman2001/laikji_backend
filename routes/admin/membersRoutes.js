const express = require('express');
const router = express.Router();
const memberModal = require('../../models/memberModal');
var ObjectId = require('mongoose').Types.ObjectId;
const helpers = require('../../helpers/helpers');
const multer = require('multer');
const path = require('path');
const roomModel = require('../../models/roomModel');
const { adminPermissionCheck } = require('../../middlewares/authCheckMiddleware');

const { getMemberRemainingTime, getDefaultRegUser } = require('../../helpers/userHelpers');
const registeredUserModal = require('../../models/registeredUserModal');
const { getStrongOfType, getPermissionOfType } = require('../../helpers/permissionsHelper');

var storage = multer.diskStorage({
    destination: 'public/member/',
    filename: function (req, file, cb) {
        cb(null, helpers.generateKey(8) + '-' + Date.now() + path.extname(file.originalname));
    },
});

const img_uploader = multer({
    storage: storage,
});

router.get('/', async (req, res) => {
    var response = [];
    var page = req.query.page ? req.query.page : 1;
    var room_id = req.query.room_id ? req.query.room_id : null;
    var in_page = 10000;
    try {
        const query = {};

        if (room_id) {
            query.roomRefs = { $in: [new ObjectId(room_id)] };
            query.isMain = true;
        } else {
            query.isMain = { $ne: true };
        }

        response = [];
        var items = await memberModal.find(query);
        items = items.map((item) => {
            item = JSON.parse(JSON.stringify(item));
            item.time_to_end = getMemberRemainingTime(item);
            response.push(item);
            return item;
        });

        res.status(200).send({
            ok: true,
            page: page,
            in_page: in_page,
            all_pages: 10,
            data: response,
        });
    } catch (e) {
        console.log(e);
        res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.get('/:id', async (req, res) => {
    const id = req.params.id;

    let item = await memberModal.find({
        _id: new ObjectId(id),
    });

    res.status(200).send({
        ok: true,
        data: item[0],
    });
});

router.post(
    '/',
    img_uploader.fields([
        { name: 'img', maxCount: 1 },
        { name: 'special_shield', maxCount: 1 },
        { name: 'special_text_shield', maxCount: 1 },
    ]),
    adminPermissionCheck,
    async (req, res) => {
        const same_username_count = await memberModal.count({
            username: req.body.username,
        });

        if (same_username_count > 0) {
            return res.status(200).send({
                ok: false,
                msg: 'اسم العضو موجود مسبقاً',
            });
        }

        let likes_level = Math.ceil(parseInt(req.body.likes) / 50);
        likes_level = likes_level > 10 ? 10 : likes_level;
        likes_level = likes_level <= 0 ? 1 : likes_level;

        const endDate = new Date(req.body.endDate).toISOString();
        const startDate = new Date(req.body.startDate).toISOString();

        const insert = {
            username: req.body.username,
            nickname: req.body.nickname,
            password: req.body.password,
            code: req.body.code,
            likes: req.body.likes,
            views: req.body.views,
            banned: req.body.banned,
            login_time: req.body.login_time,
            bio: req.body.bio,
            about: req.body.about,
            birthAddress: req.body.birthAddress,
            job: req.body.job,
            birthDate: req.body.birthDate,
            liveAddress: req.body.liveAddress,
            gender: req.body.gender,
            relationship: req.body.relationship,
            type: req.body.type,
            like_level: likes_level,
            o_name: req.body.o_name,
            o_phone: req.body.o_phone,
            o_email: req.body.o_email,
            o_address: req.body.o_address,
            o_other: req.body.o_other,
            endDate: endDate,
            startDate: startDate,
            is_special_color: req.body.is_special_color,
            is_special_shield: req.body.is_special_shield,
            is_special_text_shield: req.body.is_special_text_shield,
            special_color: req.body.is_special_color ? req.body.special_color : null,
        };

        if (
            req.files &&
            'img' in req.files &&
            req.files.img.length > 0 &&
            req.files.img[0].filename
        ) {
            insert.img = 'member/' + req.files.img[0].filename;
            helpers.resizeImage(insert.img);
        }

        if (
            req.body.is_special_shield &&
            req.files &&
            'special_shield' in req.files &&
            req.files.special_shield.length > 0 &&
            req.files.special_shield[0].filename
        ) {
            insert.special_shield = 'member/' + req.files.special_shield[0].filename;
        }

        if (
            req.body.is_special_text_shield &&
            req.files &&
            'special_text_shield' in req.files &&
            req.files.special_text_shield.length > 0 &&
            req.files.special_text_shield[0].filename
        ) {
            insert.special_text_shield = 'member/' + req.files.special_text_shield[0].filename;
        }

        var item = new memberModal(insert);

        await item.save();

        if (req.body.roomRefs && req.body.roomRefs.length > 0) {
            const room_id =
                typeof req.body.roomRefs == 'string' ? req.body.roomRefs : req.body.roomRefs[0];
            const room = await roomModel.findById(room_id);
            if (room) {
                item.roomRefs = [room._id, room.meetingRef];
                item.isMain = true;

                const regUserData = await getDefaultRegUser(
                    req.body.username,
                    room._id,
                    req.body.password,
                    req.body.type,
                );

                var regUser = new registeredUserModal(regUserData);
                await regUser.save();
                item.regUserRef = regUser._id;

                await item.save();
            } else {
                return res.send({
                    ok: false,
                    msg: 'no room',
                });
            }
        }

        res.status(200).send({
            ok: true,
        });
    },
);

router.put(
    '/:id',
    img_uploader.fields([
        { name: 'img', maxCount: 1 },
        { name: 'special_shield', maxCount: 1 },
        { name: 'special_text_shield', maxCount: 1 },
        { name: 'background', maxCount: 1 },
    ]),
    adminPermissionCheck,
    async (req, res) => {
        const id = req.params.id;
        const same_username_count = await memberModal.count({
            username: req.body.username,
            isMain: false,
            _id: { $ne: new ObjectId(id) },
        });

        if (same_username_count > 0) {
            return res.status(200).send({
                ok: false,
                msg: 'اسم العضو موجود مسبقاً',
            });
        }

        let likes_level = Math.ceil(parseInt(req.body.likes) / 50);
        likes_level = likes_level > 10 ? 10 : likes_level;
        likes_level = likes_level <= 0 ? 1 : likes_level;

        let item = await memberModal.findById(id);

        if (!item) {
            return res.send({
                ok: false,
                msg: 'no member found',
            });
        }

        const endDate = new Date(req.body.endDate).toISOString();
        const startDate = new Date(req.body.startDate).toISOString();

        let update = {
            username: req.body.username ?? item.username,
            nickname: req.body.nickname ?? item.nickname,
            password: req.body.password ?? item.password,
            code: req.body.code ?? item.code,
            likes: req.body.likes ?? item.likes,
            views: req.body.views ?? item.views,
            banned: req.body.banned ?? item.banned,
            login_time: req.body.login_time ?? item.login_time,
            bio: req.body.bio ?? item.bio,
            about: req.body.about ?? item.about,
            birthAddress: req.body.birthAddress ?? item.birthAddress,
            job: req.body.job ?? item.job,
            birthDate: req.body.birthDate ?? item.birthDate,
            liveAddress: req.body.liveAddress ?? item.liveAddress,
            gender: req.body.gender ?? item.gender,
            relationship: req.body.relationship ?? item.relationship,
            type: req.body.type ?? item.type,
            like_level: likes_level ?? item.likes_level,
            o_name: req.body.o_name ?? item.o_name,
            o_phone: req.body.o_phone ?? item.o_phone,
            o_email: req.body.o_email ?? item.o_email,
            o_address: req.body.o_address ?? item.o_address,
            o_other: req.body.o_other ?? item.o_other,
            is_girl: req.body.is_girl ?? false,
            endDate: endDate ?? item.endDate,
            startDate: startDate ?? item.startDate,
            is_special_color: req.body.is_special_color ?? item.is_special_color,
            is_special_shield: req.body.is_special_shield ?? item.is_special_shield,
            is_special_text_shield: req.body.is_special_text_shield ?? item.is_special_text_shield,
            special_color: req.body.is_special_color ? req.body.special_color : null,
        };

        if (
            req.files &&
            'img' in req.files &&
            req.files.img.length > 0 &&
            req.files.img[0].filename
        ) {
            update.img = 'member/' + req.files.img[0].filename;
            helpers.resizeImage(update.img);
            helpers.removeFile(item.img);
        }
        if (
            req.files &&
            'background' in req.files &&
            req.files.background.length > 0 &&
            req.files.background[0].filename
        ) {
            update.background = 'member/' + req.files.background[0].filename;
            helpers.resizeImage(update.background, true, 900);
            helpers.removeFile(item.background);
        }

        if (
            req.body.is_special_shield &&
            req.files &&
            'special_shield' in req.files &&
            req.files.special_shield.length > 0 &&
            req.files.special_shield[0].filename
        ) {
            update.special_shield = 'member/' + req.files.special_shield[0].filename;
        }

        if (
            req.body.is_special_text_shield &&
            req.files &&
            'special_text_shield' in req.files &&
            req.files.special_text_shield.length > 0 &&
            req.files.special_text_shield[0].filename
        ) {
            update.special_text_shield = 'member/' + req.files.special_text_shield[0].filename;
        }
        if (req.body.delete_background === 'yes') {
            update.background = null;
        }
        if (req.body.delete_img == 'yes') {
            update.img = null;
        }

        const mem = await memberModal.findOneAndUpdate(
            {
                _id: new ObjectId(id),
            },
            update,
            {
                new: true,
            },
        );

        if (req.body.roomRefs && req.body.roomRefs.length > 0) {
            const room_id =
                typeof req.body.roomRefs == 'string' ? req.body.roomRefs : req.body.roomRefs[0];
            const room = await roomModel.findById(room_id);
            if (mem.isMain && mem.regUserRef && room) {
                mem.roomRefs = [room._id, room.meetingRef];
                await mem.save();

                const regUser = await registeredUserModal.findById(mem.regUserRef);
                regUser.username = update.username;
                regUser.roomRefs = [room._id, room.meetingRef];
                regUser.password = update.password;
                regUser.type = update.type;
                regUser.strong = getStrongOfType(update.type);
                regUser.permissions = getPermissionOfType(update.type);
                await regUser.save();
            }
        }

        res.status(200).send({
            ok: true,
        });
    },
);

router.delete('/:id', adminPermissionCheck, async (req, res) => {
    const id = req.params.id;
    const member = await memberModal.findById(id);

    if (member.regUserRef) {
        await registeredUserModal.findByIdAndDelete(member.regUserRef);
    }

    member.delete();

    res.status(200).send({
        ok: true,
    });
});

module.exports = router;
