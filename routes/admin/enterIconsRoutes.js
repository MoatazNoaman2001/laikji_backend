const express = require('express');
const router = express.Router();
var ObjectId = require('mongoose').Types.ObjectId;
const helpers = require('../../helpers/helpers');
const multer = require('multer');
const enterIconModel = require('../../models/enterIconModel');
const authCheckMiddleware = require('../../middlewares/authCheckMiddleware');

router.get('/', async (req, res) => {
    try {
        const response = await enterIconModel.find({}).sort('order').exec();
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

router.post('/', multer().any(), authCheckMiddleware, async (req, res) => {
    await Promise.all(
        req.files.map(async (file) => {
            let key = '';
            let same_key = null;
            do {
                key = helpers.generateKey(4);
                same_key = await enterIconModel.find({
                    key: key,
                });
            } while (same_key.length > 0);
            const p = await helpers.saveMulterFile(file, 'entericons', key);

            // const old = await settingModel.findOne({ key: file.fieldname });
            // if (old) await helpers.removeFile(old.val);

            let ei = new enterIconModel({
                key: key,
                path: p,
                order: 9999999,
            });

            return await ei.save();
        }),
    );

    const all = await enterIconModel.find({}).sort('order').exec();
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

router.post('/ordering', multer().any(), authCheckMiddleware, async (req, res) => {
    for (const key in req.body.orderingData) {
        if (Object.hasOwnProperty.call(req.body.orderingData, key)) {
            const order = req.body.orderingData[key];
            const item = await enterIconModel.findById(key);
            item.order = order;
            await item.save();
        }
    }

    res.status(200).send({
        ok: true,
    });
});

router.delete('/:id', multer().any(), authCheckMiddleware, async (req, res) => {
    const id = req.params.id;
    await enterIconModel
        .find({
            _id: new ObjectId(id),
        })
        .deleteMany();

    const all = await enterIconModel.find({}).sort('order').exec();
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
