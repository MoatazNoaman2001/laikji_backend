const express = require('express');
const { getSettings, hexToXRgb, simg } = require('../helpers/tools');
const enterIconModel = require('../models/enterIconModel');
const reportModel = require('../models/reportModel');
const roomModel = require('../models/roomModel');
const { getUserById } = require('../helpers/userHelpers');
const { getUserByToken, notifyReportChanged } = require('../helpers/helpers');
const emojisModel = require('../models/emojisModel');
const router = express.Router();
var ObjectId = require('mongoose').Types.ObjectId;

router.get('/app-info', async (req, res) => {
    try {
        const response = await getSettings();
        for (const key in response) {
            if (Object.hasOwnProperty.call(response, key)) {
                const val = response[key];
                if (val.length == 7 && val.startsWith('#')) {
                    response[key] = hexToXRgb(val);
                }
            }
        }

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

router.get('/enter-icons', async (req, res) => {
    try {
        const icons = await enterIconModel.find({}).sort('order').exec();
        let response = [];
        icons.forEach((icon) => {
            response.push({
                _id: icon._id,
                key: icon.key,
                path: simg(icon.path),
            });
        });

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

router.get('/emojis', async (req, res) => {
    try {
        const emojis = await emojisModel.find({}).sort('order').exec();
        let response = [];
        emojis.forEach((emoji) => {
            response.push({
                _id: emoji._id,
                key: emoji.key,
                category: emoji.category,
                path: simg(emoji.path),
            });
        });

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

router.get('/image', async (req, res) => {
    const root = __dirname.replace('/routes', '');
    try {
        const name = req.query.name;
        const settings = await getSettings();
        switch (name) {
            case 'welcome':
                return res.sendFile(`${root}/public/${settings.img_welcome}`);
                break;

            case 'logo':
                return res.sendFile(`${root}/public/${settings.img_logo}`);
                break;

            case 'splash':
                return res.sendFile(`${root}/public/${settings.img_splash}`);

            case 'appbg':
                return res.sendFile(`${root}/public/${settings.img_appbg}`);

            case 'terms':
                return res.sendFile(`${root}/public/${settings.img_terms}`);
        }

        return res.sendFile(root + '/public/ui/empty.jpg');
    } catch (e) {
        return res.sendFile(root + '/public/ui/empty.jpg');
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
            key = user.key.replace(/[{}]/g, '');
            item.userRef = user;
            item.ip = user.ip;
            item.country = user.country_code;
            item.key = key;
            if (req.body.member_id) {
                item.memberRef = user.memberRef;
                item.ip = user.ip;
                item.country = user.country_code;
            }
        }

        await item.save();

        await notifyReportChanged();

        return res.status(200).send({
            ok: true,
            report: item,
        });
    } catch (e) {
        console.log(e);
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});
module.exports = router;
