const express = require('express');
const groupModel = require('../../models/groupModel');
const roomModel = require('../../models/roomModel');
const router = express.Router();
const helpers = require('../../helpers/helpers');
const enums = require('../../helpers/enums');
const multer = require('multer');
const path = require('path');
const chatModel = require('../../models/chatModel');
var ObjectId = require('mongoose').Types.ObjectId;

var storage = multer.diskStorage({
    destination: 'public/groups/',
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
    var type = req.query.type ? req.query.type : null;
    var in_page = 10000;
    try {
        let query = {};
        if (type) {
            query.type = { $in: type.split(',') };
        }
        var grbs = await groupModel.find(query).sort({
            order: 'descending',
        });

        const golden_rooms = [];
        let golden_rooms_users_count = 0;
        const special_rooms = [];
        let special_rooms_users_count = 0;
        const all_rooms = [];
        let all_rooms_users_count = 0;

        await Promise.all(
            grbs.map(async (item) => {
                var rooms = await roomModel.find({
                    groupRef: item._id,
                });

                var res_item = {
                    _id: item._id,
                    name: item.name,
                    type: item.type,
                    icon: item.icon ? process.env.mediaUrl + item.icon : null,
                    background: item.background,
                    order: item.order,
                    users_count: 0,
                };

                let group_rooms = [];

                rooms.map(async (element) => {
                    var r = await helpers.public_room_small(element, item);
                    if (!r.isMeeting) {
                        var u_in_room = global.rooms_users[r._id];

                        if (u_in_room) {
                            r.users_count = global.rooms_users[r._id].length;
                        } else {
                            r.users_count = 0;
                        }

                        res_item.users_count += r.users_count;
                        all_rooms_users_count += r.users_count;

                        if (r.isSpecial) {
                            special_rooms.push(r);
                            special_rooms_users_count += r.users_count;
                        }

                        if (r.isGold) {
                            golden_rooms.push(r);
                            golden_rooms_users_count += r.users_count;
                        }

                        all_rooms.push(r);
                        group_rooms.push(r);
                    }
                });

                res_item.rooms = group_rooms;

                response.push(res_item);
            }),
        );

        let golden_gr = response.find((g) => g.type == enums.groupsTypes.gold);

        if (golden_gr) {
            golden_gr.rooms = golden_rooms;
            golden_gr.users_count = golden_rooms_users_count;
        }

        let special_gr = response.find((g) => g.type == enums.groupsTypes.special);
        if (special_gr) {
            special_gr.rooms = special_rooms;
            special_gr.users_count = special_rooms_users_count;
        }

        let all_gr = response.find((g) => g.type == enums.groupsTypes.all);
        if (all_gr) {
            all_gr.rooms = all_rooms;
            all_gr.users_count = all_rooms_users_count;
        }

        res.status(200).send({
            ok: true,
            page: page,
            in_page: in_page,
            all_pages: 10,
            data: response,
        });
    } catch (e) {
        res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.get('/:id', async (req, res) => {
    const id = req.params.id;

    let item = await groupModel.find({
        _id: new ObjectId(id),
    });

    if (item.length > 0) {
        item = item[0];
        item.icon = item.icon ? process.env.mediaUrl + item.icon : null;
    }

    res.status(200).send({
        ok: true,
        data: item,
    });
});

router.post('/', img_uploader.single('icon'), async (req, res) => {
    console.log('req is ', JSON.stringify(req.body));
    const admin = await helpers.getAdminByToken(req.body.token);
    if (!admin) {
        console.log('admin not found');
        return res.status(403).json({
            ok: false,
            data: 'Wrong token',
        });
    }
    if (admin.permissions[0] == '1') {
        var g1 = new groupModel({
            name: req.body.name,
            icon: 'groups/' + req.file.filename,
        });
        g1.save();

        helpers.resizeImage(g1.icon);

        global.home_io.emit('groups_refresh', {});

        res.status(200).send({
            ok: true,
            id: g1._id,
        });
    } else {
        res.status(403).json({
            ok: false,
            message: 'لا تملك الصلاحية للقيام بهذا الاجراء',
        });
    }
});

router.put('/:id', img_uploader.single('icon'), async (req, res) => {
    const id = req.params.id;
    let update = {
        name: req.body.name,
    };

    if (req.file && req.file.filename) {
        update.icon = 'groups/' + req.file.filename;
        helpers.resizeImage(update.icon);

        const old_item = await groupModel.find({
            _id: new ObjectId(id),
        });

        if (old_item.length > 0) {
            old_icon = old_item[0].icon;
            helpers.removeFile(old_icon);
        }
    }

    await groupModel.findOneAndUpdate(
        {
            _id: new ObjectId(id),
        },
        update,
    );

    global.home_io.emit('groups_refresh', {});

    res.status(200).send({
        ok: true,
    });
});

router.delete('/:id', async (req, res) => {
    const id = req.params.id;

    await groupModel
        .find({
            _id: new ObjectId(id),
        })
        .deleteMany();

    let rooms = await roomModel.find({
        groupRef: new ObjectId(id),
    });

    rooms.forEach(async (room) => {
        await chatModel
            .find({
                roomRef: new ObjectId(room._id),
            })
            .deleteMany();
    });

    await roomModel
        .find({
            groupRef: new ObjectId(id),
        })
        .deleteMany();

    global.home_io.emit('groups_refresh', {});

    res.status(200).send({
        ok: true,
    });
});

module.exports = router;
