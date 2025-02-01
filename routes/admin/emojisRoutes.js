const express = require('express');
const router = express.Router();
var ObjectId = require('mongoose').Types.ObjectId;
const helpers = require('../../helpers/helpers');
const multer = require('multer');
const emojisModel = require('../../models/emojisModel');
const authCheckMiddleware = require('../../middlewares/authCheckMiddleware');

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

router.post('/', multer().any(), authCheckMiddleware, async (req, res) => {
    await Promise.all(
        req.files.map(async (file) => {
            let key = '';
            let same_key = null;
            do {
                key = helpers.generateKey(4);
                same_key = await emojisModel.find({ key: key });
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

    const allEmojis = await emojisModel.find({}).sort('order').exec();
    const categories = {};

    allEmojis.forEach((emoji) => {
        if (!categories[emoji.category]) {
            categories[emoji.category] = [];
        }
        categories[emoji.category].push(emoji);
    });

    for (const [category, emojis] of Object.entries(categories)) {
        let order = 1;
        for (const emoji of emojis) {
            emoji.order = order++;
            await emoji.save();
        }
    }

    res.status(200).send({
        ok: true,
    });
});

router.post('/ordering', multer().any(), authCheckMiddleware, async (req, res) => {
    for (const key in req.body.orderingData) {
        if (Object.hasOwnProperty.call(req.body.orderingData, key)) {
            const order = req.body.orderingData[key];
            const item = await emojisModel.findById(key);
            item.order = order + 1;
            await item.save();
        }
    }

    // Reorder categories
    const allEmojis = await emojisModel.find({}).sort('order').exec();
    const categories = {};

    allEmojis.forEach((emoji) => {
        if (!categories[emoji.category]) {
            categories[emoji.category] = [];
        }
        categories[emoji.category].push(emoji);
    });

    for (const [category, emojis] of Object.entries(categories)) {
        let order = 1;
        for (const emoji of emojis) {
            emoji.order = order++;
            await emoji.save();
        }
    }

    res.status(200).send({
        ok: true,
    });
});

router.delete('/:id', multer().any(), authCheckMiddleware, async (req, res) => {
    const id = req.params.id;
    await emojisModel.deleteMany({ _id: new ObjectId(id) });

    const allEmojis = await emojisModel.find({}).sort('order').exec();
    const categories = {};

    allEmojis.forEach((emoji) => {
        if (!categories[emoji.category]) {
            categories[emoji.category] = [];
        }
        categories[emoji.category].push(emoji);
    });

    for (const [category, emojis] of Object.entries(categories)) {
        let order = 1;
        for (const emoji of emojis) {
            emoji.order = order++;
            await emoji.save();
        }
    }

    res.status(200).send({
        ok: true,
    });
});

// router.delete('/all', async (req, res) => {
//     try {
//         // Delete all emojis
//         await emojisModel.deleteMany({});

//         res.status(200).send({
//             ok: true,
//             message: 'All emojis have been deleted successfully.',
//         });
//     } catch (error) {
//         res.status(500).send({
//             ok: false,
//             message: 'An error occurred while deleting all emojis.',
//             error: error.message,
//         });
//     }
// });

module.exports = router;
