const express = require('express');
const router = express.Router();
var ObjectId = require('mongoose').Types.ObjectId;
const reportModel = require('../../models/reportModel');
const { notifyReportChanged, getUserByToken } = require('../../helpers/helpers');
const { isBannedFromServer, getUserById } = require('../../helpers/userHelpers');
const authCheckMiddleware = require('../../middlewares/authCheckMiddleware');
const roomModel = require('../../models/roomModel');

router.get('/', async (req, res) => {
    try {
        response = [];
        var items = await reportModel.find({}).populate(['ownerRef', 'userRef', 'memberRef']);
        await Promise.all(
            items.map(async (item) => {
                result = {};
                if (item.type !== 1) {
                    item = JSON.parse(JSON.stringify(item));
                    const isBanned = await isBannedFromServer(item.key);
                    result = {
                        ...item,
                        isBanned,
                    };
                    response.push(result);
                } else {
                    response.push(item);
                }
            }),
        );
        res.status(200).send({
            ok: true,
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
router.post('/report', async (req, res) => {
    try {
        let xuser = await getUserByToken(req.headers.token);

        const room = await roomModel.findById(req.body.room_id);
        let user = null;
        let key = null;
        const item = new reportModel({
            ownerRef: xuser._id,
            roomRef: room._id,
            roomName: room.name,
            message: req.body.message,
            type: req.body.type,
        });
        if (req.body.user_id) {
            user = await getUserById(req.body.user_id, room._id);
            console.log('xxxxxxxxxxxreport user ', user);
            key = user.key.replace(/[{}]/g, '');
            item.userRef = user;

            item.key = key;
            if (req.body.member_id) {
                item.memberRef = user.memberRef;
            }
        }

        await item.save();

        await notifyReportChanged();

        return res.status(200).send({
            ok: true,
        });
    } catch (e) {
        console.log(e);
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});
router.get('/:id', async (req, res) => {
    const id = req.params.id;

    let item = await reportModel.find({
        _id: new ObjectId(id),
    });

    res.status(200).send({
        ok: true,
        data: item[0],
    });
});

router.delete('/:id', authCheckMiddleware, async (req, res) => {
    const id = req.params.id;
    const item = await reportModel.findById(id);

    item && item.delete();

    await notifyReportChanged();

    res.status(200).send({
        ok: true,
    });
});

module.exports = router;
