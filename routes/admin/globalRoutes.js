const express = require('express');
const router = express.Router();
const multer = require('multer');
const groupModel = require('../../models/groupModel');
const memberModal = require('../../models/memberModal');
const roomModel = require('../../models/roomModel');
const { getSettings, millisecondsToDays } = require('../../helpers/tools');
const { getRoomRemainingTime } = require('../../helpers/helpers');
const enums = require('../../helpers/enums');
const { getMemberRemainingTime } = require('../../helpers/userHelpers');
const { adminPermissionCheck } = require('./authCheckMiddleware');

router.get('/dashboard', multer().any(), async (req, res) => {
    const settings = await getSettings();
    const count_groups = await groupModel.count();
    const count_rooms = await roomModel.count({
        isMeeting: false,
    });

    const count_members = await memberModal.count({
        $or: [
            {
                type: enums.fileTypes.king,
            },
            {
                type: enums.fileTypes.protected,
            },
            {
                type: enums.fileTypes.special,
            },
            {
                type: enums.fileTypes.vip,
            },
        ],
    });

    let count_connected = 0;

    for (const key in global.rooms_users) {
        if (Object.hasOwnProperty.call(global.rooms_users, key)) {
            const room_users = global.rooms_users[key];

            count_connected += room_users.length;
        }
    }

    let expired_rooms = [];
    let early_expired_rooms = [];

    var rooms = await roomModel.find({
        isMeeting: false,
    });

    rooms.map(async (item) => {
        var res_item = {
            _id: item._id,
            name: item.name,
            serial: item.serial,
            isGold: item.isGold,
            isSpecial: item.isSpecial,
            icon: item.icon ? process.env.mediaUrl + item.icon : null,
            endDate: item.endDate,
            remainingTime: getRoomRemainingTime(item),
        };

        if (res_item.remainingTime <= 0) expired_rooms.push(res_item);

        if (millisecondsToDays(res_item.remainingTime) <= 5 && res_item.remainingTime > 0)
            early_expired_rooms.push(res_item);
    });

    let expired_members = [];
    let early_expired_members = [];

    var items = await memberModal
        .find({
            $or: [
                {
                    type: enums.fileTypes.king,
                },
                {
                    type: enums.fileTypes.protected,
                },
                {
                    type: enums.fileTypes.special,
                },
                {
                    type: enums.fileTypes.vip,
                },
            ],
        })
        .populate('roomRefs')
        .exec();

    items = items.map((item) => {
        item = JSON.parse(JSON.stringify(item));
        item.time_to_end = getMemberRemainingTime(item);

        if (item.time_to_end <= 0) expired_members.push(item);

        if (millisecondsToDays(item.time_to_end) <= 5 && item.time_to_end > 0)
            early_expired_members.push(item);

        return item;
    });

    let expired_main_members = [];
    let early_expired_main_members = [];

    var main_items = await memberModal
        .find({
            $or: [
                {
                    type: enums.fileTypes.root,
                },
                {
                    type: enums.fileTypes.chatmanager,
                },
            ],
        })
        .populate('roomRefs')
        .exec();

    main_items = main_items.map((item) => {
        item = JSON.parse(JSON.stringify(item));
        item.time_to_end = getMemberRemainingTime(item);

        if (item.time_to_end <= 0) expired_main_members.push(item);

        if (millisecondsToDays(item.time_to_end) <= 5 && item.time_to_end > 0)
            early_expired_main_members.push(item);

        return item;
    });

    res.status(200).send({
        ok: true,
        count_groups,
        count_rooms,
        count_members,
        count_connected,
        settings,
        expired_rooms,
        early_expired_rooms,
        expired_members,
        early_expired_members,
        expired_main_members,
        early_expired_main_members,
    });
});

router.post('/broadcast', multer().any(), adminPermissionCheck, async (req, res) => {
    global.io.emit('broadcast-msg', {
        data: {
            type: req.body.type,
            title: req.body.title,
            body: req.body.body,
        },
    });

    res.status(200).send({
        ok: true,
    });
});

module.exports = router;
