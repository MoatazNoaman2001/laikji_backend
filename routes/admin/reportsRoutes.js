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
                    const isBanned = await isBannedFromServer(item.device, item.ip);
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
