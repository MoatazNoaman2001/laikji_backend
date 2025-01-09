const express = require('express');
const router = express.Router();
var ObjectId = require('mongoose').Types.ObjectId;
const helpers = require('../../helpers/helpers');
const multer = require('multer');
const emojisModel = require('../../models/emojisModel');

router.get('/', async (req, res) => {
    try {
        const response = await emojisModel.find({}).sort('order').exec();
        res.status(200).send({
            ok: true,
            data: response,
        });
    } catch (e) {
        res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.post('/', multer().any(), async (req, res) => {
    console.log('req is ' + JSON.stringify(req.body, null, 2));
    await Promise.all(
        req.files.map(async (file) => {
            let key = '';
            let same_key = null;
            do {
                key = helpers.generateKey(4);
                same_key = await emojisModel.find({
                    key: key,
                });
            } while (same_key.length > 0);
            const p = await helpers.saveMulterFile(file, 'emojis', key);

            let ei = new emojisModel({
                key: key,
                path: p,
                order: 9999999,
                category: req.body.category,
            });

            return await ei.save();
        }),
    );

    const all = await emojisModel.find({}).sort('order').exec();
    let order = 0;
    await Promise.all(
        all.map(async (item) => {
            item.order = order;
            order++;
            return await item.save();
        }),
    );

    res.status(200).send({
        ok: true,
    });
});

router.post('/ordering', multer().any(), async (req, res) => {
    for (const key in req.body.orderingData) {
        if (Object.hasOwnProperty.call(req.body.orderingData, key)) {
            const order = req.body.orderingData[key];
            const item = await emojisModel.findById(key);
            item.order = order + 1;
            await item.save();
        }
    }

    res.status(200).send({
        ok: true,
    });
});

router.delete('/:id', multer().any(), async (req, res) => {
    const id = req.params.id;
    await emojisModel
        .find({
            _id: new ObjectId(id),
        })
        .deleteMany();

    const all = await emojisModel.find({}).sort('order').exec();
    let order = 0;
    await Promise.all(
        all.map(async (item) => {
            item.order = order;
            order++;
            return await item.save();
        }),
    );

    res.status(200).send({
        ok: true,
    });
});

module.exports = router;
