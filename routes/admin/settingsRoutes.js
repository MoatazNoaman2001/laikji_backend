const express = require('express');
const settingModel = require('../../models/settingModel');
const router = express.Router();
var ObjectId = require('mongoose').Types.ObjectId;
const helpers = require('../../helpers/helpers');
const path = require('path');
const multer = require('multer');
const { getSettings } = require('../../helpers/tools');
const { adminPermissionCheck } = require('../../middlewares/authCheckMiddleware');

router.get('/', async (req, res) => {
    try {
        const response = await getSettings();
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

router.post('/', multer().any(), adminPermissionCheck, async (req, res) => {
    for (const key in req.body) {
        if (Object.hasOwnProperty.call(req.body, key)) {
            const obj = req.body[key];
            await settingModel.findOneAndUpdate(
                {
                    key: key,
                },
                {
                    key: key,
                    val: obj,
                },
                {
                    upsert: true,
                },
            );
        }
    }

    for (const key in req.files) {
        if (Object.hasOwnProperty.call(req.files, key)) {
            const file = req.files[key];
            const name = await helpers.saveMulterFile(file, 'settings');
            const old = await settingModel.findOne({ key: file.fieldname });
            if (old) await helpers.removeFile(old.val);

            await settingModel.findOneAndUpdate(
                {
                    key: file.fieldname,
                },
                {
                    key: file.fieldname,
                    val: name,
                },
                {
                    upsert: true,
                },
            );
        }
    }

    await helpers.notifyAllRoomsChanged();

    global.home_io.emit('settings_refresh', {});

    res.status(200).send({
        ok: true,
    });
});

module.exports = router;
