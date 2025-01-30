const express = require('express');
const router = express.Router();
var ObjectId = require('mongoose').Types.ObjectId;
const spyModal = require('../../models/spyModal');
const authCheckMiddleware = require('../../middlewares/authCheckMiddleware');

router.get('/', async (req, res) => {
    try {
        response = [];
        var items = await spyModal.find({});

        res.status(200).send({
            ok: true,
            data: items,
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

    let item = await spyModal.find({
        _id: new ObjectId(id),
    });

    res.status(200).send({
        ok: true,
        data: item[0],
    });
});

router.post('/', authCheckMiddleware, async (req, res) => {
    var item = new spyModal({
        name: req.body.name,
        password: req.body.password,
        is_visible: req.body.is_visible,
    });

    await item.save();

    res.status(200).send({
        ok: true,
    });
});

router.put('/:id', authCheckMiddleware, async (req, res) => {
    const id = req.params.id;
    let update = {
        name: req.body.name,
        password: req.body.password,
        is_visible: req.body.is_visible,
    };

    await spyModal.findOneAndUpdate(
        {
            _id: new ObjectId(id),
        },
        update,
    );

    res.status(200).send({
        ok: true,
    });
});

router.delete('/:id', authCheckMiddleware, async (req, res) => {
    const id = req.params.id;
    const item = await spyModal.findById(id);

    item && item.delete();

    res.status(200).send({
        ok: true,
    });
});

module.exports = router;
