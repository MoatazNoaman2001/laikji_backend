const express = require('express');
const roomModel = require('../../models/roomModel');
const router = express.Router();
const helpers = require('../../helpers/helpers');
const multer = require('multer');
const path = require('path');
const enums = require('../../helpers/enums');
const chatModel = require('../../models/chatModel');
const memberModal = require('../../models/memberModal');
const { generateRoomSerial } = require('../../helpers/tools');
const registeredUserModal = require('../../models/registeredUserModal');
const entryLogModel = require('../../models/entryLogModel');
const adminLogModel = require('../../models/adminLogModel');
const bannedModel = require('../../models/bannedModel');
const authCheckMiddleware = require('../../middlewares/authCheckMiddleware');
const roomsBackup = require('../../models/roomsBackup');
var ObjectId = require('mongoose').Types.ObjectId;

var storage = multer.diskStorage({
    destination: 'public/rooms/',
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
    var isMeeting = req.query.isMeeting && req.query.isMeeting == '1';
    var isGold = req.query.isGold && req.query.isGold == '1';
    var isSpecial = req.query.isSpecial && req.query.isSpecial == '1';
    var in_page = 10000;
    try {
        let query = {
            isMeeting: isMeeting,
        };

        if (isGold) {
            query.isGold = 1;
        }

        if (isSpecial) {
            query.isSpecial = 1;
        }

        if (req.query.group_id) {
            query.groupRef = new ObjectId(req.query.group_id);
        }

        var rooms = await roomModel.find(query);

        rooms.map(async (item) => {
            var u_in_room = global.rooms_users[item._id];
            let users_count = 0;

            if (u_in_room) {
                users_count = global.rooms_users[item._id].length;
            }

            var res_item = {
                _id: item._id,
                name: item.name,
                serial: item.serial,
                isGold: item.isGold,
                isSpecial: item.isSpecial,
                icon: item.icon ? process.env.mediaUrl + item.icon : null,
                endDate: item.endDate,
                remainingTime: helpers.getRoomRemainingTime(item),
                users_count: users_count,
            };

            response.push(res_item);
        });

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

    let item = await roomModel
        .find({
            _id: new ObjectId(id),
        })
        .populate('groupRef');

    if (item.length > 0) {
        item = JSON.parse(JSON.stringify(item[0]));
        item.icon = item.icon ? process.env.mediaUrl + item.icon : null;
        item.welcome.img = item.welcome.img ? process.env.mediaUrl + item.welcome.img : null;
        item.group = item.groupRef;
        item.groupRef = item.groupRef._id;

        const member_query = {
            type: enums.fileTypes.mastermain,
            username: 'MASTER',
            roomRefs: { $in: [new ObjectId(id)] },
        };
        master_mem = await memberModal.findOne(member_query);

        if (master_mem) {
            item.master = master_mem;
            item.master_code = master_mem.code;
            item.master_password = master_mem.password;
        }
    }

    res.status(200).send({
        ok: true,
        data: item,
    });
});

router.post(
    '/',
    img_uploader.fields([
        { name: 'icon', maxCount: 1 },
        { name: 'welcome_img', maxCount: 1 },
    ]),
    authCheckMiddleware,
    async (req, res) => {
        const same_name_count = await roomModel.count({
            name: req.body.name,
        });

        if (same_name_count > 0) {
            return res.status(200).send({
                ok: false,
                msg: 'اسم الغرفة موجود مسبقاً',
            });
        }
        const endDate = new Date(req.body.endDate).toISOString();
        const startDate = new Date(req.body.startDate).toISOString();
        const insert = {
            name: req.body.name,
            description: req.body.description,
            groupRef: req.body.groupRef,
            isGold: req.body.type == '1',
            isSpecial: req.body.type == '2',
            icon: req.file ? 'rooms/' + req.file.filename : '',
            endDate: endDate,
            startDate: startDate,
            o_name: req.body.o_name,
            o_phone: req.body.o_phone,
            o_email: req.body.o_email,
            o_address: req.body.o_address,
            o_other: req.body.o_other,
            master_count: req.body.master_count,
            super_admin_count: req.body.super_admin_count,
            admin_count: req.body.admin_count,
            member_count: req.body.member_count,
            capacity: req.body.capacity,
            allow_send_imgs: req.body.allow_send_imgs,
            serial: await generateRoomSerial(),
            owner: {
                name: req.body.owner_name,
                email: req.body.owner_email,
            },
            welcome: {
                img:
                    req.file && req.file.filename
                        ? 'rooms/' + req.file.filename
                        : req.body.welcome && req.body.welcome.img,
                text: req.body.welcome_text ?? '',
                direction: 'center',
                color: '0|0|0',
            },
            outside_style: {
                background: '255|255|255',
                font_color: '0|0|0',
            },
            inside_style: {
                background_1: '61|147|185',
                background_2: '72|170|211',
                border_1: '255|255|255',
                font_color: '255|255|255',
            },
        };

        var item = new roomModel(insert);

        item.save().then(async (doc) => {
            var c1 = new chatModel({
                name: '',
                roomRef: doc._id,
                isMain: true,
            });
            c1.save();

            var meeting_room = new roomModel({
                ...insert,
                parentRef: doc._id,
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
                meetingPassword: '0000',
            });
            await meeting_room.save();

            doc.meetingRef = meeting_room._id;
            await doc.save();

            var c2 = new chatModel({
                name: '',
                roomRef: meeting_room._id,
                isMain: true,
            });
            c2.save();

            var master = new registeredUserModal({
                username: 'MASTER',
                type: enums.userTypes.mastermain,
                password: req.body.master_password,
                roomRefs: [doc._id, doc.meetingRef],
                type: enums.userTypes.mastermain,
                permissions: '11111111111111111',
                strong: 90000,
                is_locked: false,
            });
            await master.save();

            var master_mem = new memberModal({
                username: 'MASTER',
                password: req.body.master_password,
                type: enums.fileTypes.mastermain,
                roomRefs: [doc._id, meeting_room._id],
                regUserRef: master._id,
                isMain: true,
                code: req.body.master_code,
                endDate: endDate,
                startDate: startDate,
            });
            await master_mem.save();

            helpers.resizeImage(item.icon);

            global.home_io.emit('groups_refresh', {});

            res.status(200).send({
                ok: true,
            });
        });
    },
);

// dashboard update
router.put(
    '/:id',
    img_uploader.fields([
        { name: 'icon', maxCount: 1 },
        { name: 'welcome_img', maxCount: 1 },
    ]),
    authCheckMiddleware,
    async (req, res) => {
        try {
            const id = req.params.id;

            // Check for duplicate names
            const same_name_count = await roomModel.count({
                name: req.body.name,
                _id: { $ne: new ObjectId(id) },
                isMeeting: false,
            });

            if (same_name_count > 0) {
                return res.status(200).send({
                    ok: false,
                    msg: 'اسم الغرفة موجود مسبقاً',
                });
            }

            // Prepare the update object dynamically
            const update = {};

            const fieldsToUpdate = [
                'name',
                'description',
                'groupRef',
                'type',
                'endDate',
                'startDate',
                'o_name',
                'o_phone',
                'o_email',
                'o_address',
                'o_other',
                'master_count',
                'super_admin_count',
                'admin_count',
                'member_count',
                'capacity',
                'owner_name',
                'owner_email',
                'mic_permission',
                'talk_dur',
                'mic_setting',
                'shared_mic_capacity',
                'welcome_text',
                'allow_send_imgs',
            ];

            fieldsToUpdate.forEach((field) => {
                if (req.body[field] !== undefined) {
                    // Special handling for nested structures or transformations
                    if (field === 'endDate' || field === 'startDate') {
                        update[field] = new Date(req.body[field]).toISOString();
                    } else if (field === 'type') {
                        update.isGold = req.body.type === '1';
                        update.isSpecial = req.body.type === '2';
                    } else if (field === 'owner_name' || field === 'owner_email') {
                        update.owner = {
                            ...(update.owner || {}),
                            [field === 'owner_name' ? 'name' : 'email']: req.body[field],
                        };
                    } else if (field === 'welcome_text') {
                        update.welcome = {
                            ...(update.welcome || {}),
                            text: req.body[field],
                            direction: 'center',
                            color: '0|0|0',
                        };
                    } else if (
                        field === 'mic_permission' ||
                        field === 'talk_dur' ||
                        field === 'mic_setting' ||
                        field === 'shared_mic_capacity'
                    ) {
                        update.mic = {
                            ...(update.mic || {}),
                            [field]: req.body[field],
                        };
                    } else {
                        update[field] = req.body[field];
                    }
                }
            });
            if (req.body.icon === '') {
                update.icon = null;
            }
            if (req.files && req.files.icon) {
                update.icon = 'rooms/' + req.files.icon[0].filename;

                helpers.resizeImage(update.icon);
            }

            const currentRoom = await roomModel.findById(id);
            if (req.body.welcome_img === '') {
                update.welcome = {
                    ...(update.welcome || {}),
                    img: null,
                };
            } else if (req.files && req.files.welcome_img) {
                const welcomeImgFile = req.files.welcome_img[0];
                update.welcome = {
                    ...(update.welcome || {}),
                    img: 'rooms/' + welcomeImgFile.filename,
                };
                helpers.resizeImage(update.welcome.img);
            } else if (currentRoom && currentRoom.welcome && currentRoom.welcome.img) {
                update.welcome = {
                    ...(update.welcome || {}),
                    img: currentRoom.welcome.img,
                };
            }

            // Update meeting
            await roomModel.findOneAndUpdate(
                { parentRef: new ObjectId(id), isMeeting: true },
                {
                    ...update,
                    parentRef: id,
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
                    meetingPassword: '0000',
                },
            );

            // Update room
            await roomModel.findOneAndUpdate({ _id: new ObjectId(id) }, update);

            // Update master member details if applicable
            const query = {
                type: enums.fileTypes.mastermain,
                username: 'MASTER',
                roomRefs: { $in: [new ObjectId(id)] },
            };

            const master_mem = await memberModal.findOne(query);
            if (master_mem) {
                master_mem.password = req.body.master_password;
                master_mem.code = req.body.master_code;
                master_mem.endDate = update.endDate;
                await master_mem.save();
            }

            const regUser = await registeredUserModal.findOne(master_mem.regUserRef);
            if (regUser) {
                regUser.password = req.body.master_password;
                await regUser.save();
            }

            // Notify and emit refresh event
            await helpers.notifyRoomChanged(id, true, false);
            global.home_io.emit('groups_refresh', {});

            res.status(200).send({ ok: true });
        } catch (err) {
            console.log('error from update room admin route ' + err.toString());
            res.status(500).send({ ok: false, error: 'Something went wrong.' });
        }
    },
);

router.put('/reset/:id', authCheckMiddleware, async (req, res) => {
    const id = req.params.id;
    console.log('reset room ', req.body);
    try {
        const room = await roomModel.findById(id);
        if (!room) {
            throw new Error('Room not found');
        }

        const defaultRoom = new roomModel();
        const unReset = [
            'name',
            '_id',
            '__v',
            'serial',
            'groupRef',
            'parentRef',
            'meetingRef',
            'code',
            'isMeeting',
            'isGold',
            'isSpecial',
            'startDate',
            'endDate',
        ];
        for (const key in roomModel.schema.obj) {
            if (!unReset.includes(key)) {
                room[key] = defaultRoom[key];
            }
        }
        // var meeting_room = new roomModel({
        //     ...room,
        //     parentRef: room._id,
        //     isMeeting: true,
        //     isGold: false,
        //     isSpecial: false,
        //     groupRef: '606b8f8844e78f128ecbfac2',
        //     description: '',
        //     outside_style: {
        //         background: '255|255|255',
        //         font_color: '0|0|0',
        //     },
        //     inside_style: {
        //         background_1: '61|147|185',
        //         background_2: '72|170|211',
        //         border_1: '72|170|211',
        //         font_color: '255|255|255',
        //     },
        //     meetingPassword: '0000',
        // });
        // await meeting_room.save();

        // // doc.meetingRef = meeting_room._id;
        // // await doc.save();

        // var c2 = new chatModel({
        //     name: '',
        //     roomRef: meeting_room._id,
        //     isMain: true,
        // });
        // c2.save();

        // delete admin logs
        await adminLogModel.deleteMany({
            roomRef: id,
        });
        // delete logs
        await entryLogModel.deleteMany({
            roomRef: id,
        });
        // delete users
        await registeredUserModal.deleteMany({
            roomRefs: id,
            type: {
                $nin: [
                    enums.userTypes.mastermain,
                    enums.userTypes.chatmanager,
                    enums.userTypes.root,
                ],
            },
        });
        await memberModal.deleteMany({
            roomRefs: id,
            type: {
                $nin: [
                    enums.userTypes.mastermain,
                    enums.userTypes.chatmanager,
                    enums.userTypes.root,
                ],
            },
        });
        //delete blocked
        await bannedModel.deleteMany({
            roomRef: id,
            type: enums.banTypes.room,
        });
        await room.save();
        return res.status(200).send({ ok: true, data: room });
    } catch (error) {
        console.error(`Error resetting room data: ${error.message}`);
        throw error;
    }
});
router.delete('/:id', authCheckMiddleware, async (req, res) => {
    const id = req.params.id;

    let rooms = await roomModel.find({
        _id: new ObjectId(id),
    });

    let room = await roomModel.findById(id);

    if (room) {
        await chatModel
            .find({
                roomRef: new ObjectId(room._id),
            })
            .deleteMany();

        await roomModel.findById(room.meetingRef).deleteMany();

        await chatModel
            .find({
                roomRef: new ObjectId(room.meetingRef),
            })
            .deleteMany();

        const members = await memberModal.find({
            roomRefs: {
                $in: [new ObjectId(room._id), new ObjectId(room.meetingRef)],
            },
        });

        await Promise.all(
            members.map(async (mem) => {
                if (mem.regUserRef) {
                    await registeredUserModal.findByIdAndDelete(mem.regUserRef);
                }

                await mem.delete();
            }),
        );

        await room.delete();
    }

    global.home_io.emit('groups_refresh', {});

    res.status(200).send({
        ok: true,
    });
});
router.get('/backupone/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const room = await roomModel.findById(id);
        if (room) {
            const query = { roomRef: id };
            await roomsBackup.deleteOne(query);

            const backup = room.toObject();
            backup.roomRef = room._id;
            const newDoc = new roomsBackup(backup);

            await newDoc.save();

            return res.status(200).json({ message: 'Room backed up successfully', room: newDoc });
        } else {
            return res.status(404).json({ message: 'Room not found' });
        }
    } catch (err) {
        console.error('Error during backup:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/retrieve/:id', async (req, res) => {
    const roomId = req.params.id;

    try {
        const latestBackup = await roomsBackup.findOne({ roomRef: roomId }).sort({ createdAt: -1 });
        if (!latestBackup) {
            return res
                .status(200)
                .json({ ok: false, message: 'لا يوجد نسخة احتياطية لهذه الغرفة' });
        }
        const backupDate = new Date(latestBackup.createdAt).toISOString();
        const insert = {
            name: latestBackup.name,
            description: latestBackup.description,
            groupRef: latestBackup.groupRef,
            isGold: latestBackup.isGold,
            isSpecial: latestBackup.isSpecial,
            icon: latestBackup.icon,
            endDate: latestBackup.endDate,
            startDate: latestBackup.startDate,
            o_name: latestBackup.o_name,
            o_phone: latestBackup.o_phone,
            o_email: latestBackup.o_email,
            o_address: latestBackup.o_address,
            o_other: latestBackup.o_other,
            master_count: latestBackup.master_count,
            super_admin_count: latestBackup.super_admin_count,
            admin_count: latestBackup.admin_count,
            member_count: latestBackup.member_count,
            capacity: latestBackup.capacity,
            serial: latestBackup.serial,
            owner: {
                name: latestBackup.owner_name,
                email: latestBackup.owner_email,
            },
            welcome: {
                img: latestBackup.welcome.img,
                text: latestBackup.welcome.text,
                direction: latestBackup.welcome.direction,
                color: latestBackup.welcome.color,
            },
            outside_style: {
                background: latestBackup.outside_style.background,
                font_color: latestBackup.outside_style.font_color,
            },
            inside_style: {
                background_1: latestBackup.inside_style.background_1,
                background_2: latestBackup.inside_style.background_2,
                border_1: latestBackup.inside_style.border_1,
                font_color: latestBackup.inside_style.font_color,
            },
        };

        const updatedRoom = await roomModel.findByIdAndUpdate(roomId, insert, { new: true });

        const updatedMeeting = await roomModel.findByIdAndUpdate(updatedRoom.meetingRef, {
            ...insert,
            parentRef: updatedRoom._id,
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
            meetingPassword: '0000',
        });

        if (!updatedRoom) {
            return res.status(200).json({ ok: false, message: 'Room not found.' });
        }
        if (!updatedMeeting) {
            return res.status(200).json({ ok: false, message: 'Meeting Room not found.' });
        }
        return res.status(200).json({
            ok: true,
            message: ` تمت استعادة آخر نسخة احتياطية للغرفة بتاريخ: ${backupDate} بنجاح`,
            updatedRoom,
        });
    } catch (error) {
        console.error('Error retrieving and updating room:', error);
        return res.status(200).json({
            ok: false,
            message: 'لم نتمكن من استعادة الغرفة الاحتياطية لوجود خطأ, يرجى المحاولة لاحقاً',
        });
    }
});

module.exports = router;
