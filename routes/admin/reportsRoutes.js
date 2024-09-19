const express = require('express');
const router = express.Router();
var ObjectId = require('mongoose').Types.ObjectId;
const reportModel = require('../../models/reportModel');
const { notifyReportChanged } = require('../../helpers/helpers');
const { isBannedFromServer } = require('../../helpers/userHelpers');

router.get('/', async (req, res) => {
    try {
        response = [];
        var items = await reportModel.find({}).populate(['ownerRef', 'userRef', 'memberRef']);
        await Promise.all(
            items.map(async (item) => {
                item = JSON.parse(JSON.stringify(item));
                const isBanned = await isBannedFromServer(item.userRef.key);
                const res_item = {
                    ...item,
                    isBanned,
                };

                response.push(res_item);
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

router.delete('/:id', async (req, res) => {
    const id = req.params.id;
    const item = await reportModel.findById(id);

    item && item.delete();

    await notifyReportChanged();

    res.status(200).send({
        ok: true,
    });
});

module.exports = router;
