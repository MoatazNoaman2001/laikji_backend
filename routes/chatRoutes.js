const express = require('express');
const helpers = require('../helpers/helpers');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const privateChatModel = require('../models/privateChatModel');
const privateMessageModel = require('../models/privateMessageModel');
const { public_user, getUserById } = require('../helpers/userHelpers');
var ObjectId = require('mongoose').Types.ObjectId;

var storage = multer.diskStorage({
    destination: 'public/uploads/',
    filename: function (req, file, cb) {
        cb(null, helpers.generateKey(8) + '-' + Date.now() + path.extname(file.originalname));
    },
});

const img_uploader = multer({
    storage: storage,
});

router.post('/send-img', img_uploader.single('img'), async (req, res) => {
    try {
        let xuser = await helpers.getUserByToken(req.headers.token);
        let img_url = process.env.mediaUrl + 'uploads/' + req.file.filename;
        let chat_id = req.body.chat_id;
        let is_private = req.body.is_private == '1' ? true : false;
        if (is_private) {
            let pc = await privateChatModel
                .find({
                    key: chat_id,
                })
                .populate(['user1Ref', 'user2Ref']);

            pc = pc[0];

            let body = {
                type: 'img',
                msg: img_url,
                style: req.body.style,
                user: await public_user(xuser),
                replay: null,
            };

            const msg = new privateMessageModel({
                chatRef: pc._id,
                userRef: xuser._id,
                body: body,
            });

            await msg.save();

            let otherUser =
                pc.user1Ref._id.toString() == xuser._id.toString() ? pc.user2Ref : pc.user1Ref;
            otherUser = await getUserById(otherUser._id, xroomId);

            pc = { ...pc._doc };

            pc.user1Ref = await public_user(pc.user1Ref);
            pc.user2Ref = await public_user(pc.user2Ref);

            const unReadMsgsCount = await privateMessageModel.countDocuments({
                chatRef: new ObjectId(pc._id),
                userRef: new ObjectId(xuser._id),
                isRead: false,
            });

            console.log(`other user socker id: ${otherUser.socketId}, new image : ${msg}`);

            global.io.to(otherUser.socketId).emit('new-private-msg', {
                chat: {
                    ...pc,
                    last: msg,
                    newMsgs: unReadMsgsCount,
                },
                msg: msg,
            });

            global.io.to(xuser.socketId).emit('new-private-msg', {
                chat: {
                    ...pc,
                    last: msg,
                    newMsgs: 0,
                },
                msg: msg,
            });
        } else {
            global.io.emit(chat_id, {
                key: req.body.key,
                type: 'img',
                msg: img_url,
                style: req.body.style,
                chat: chat_id,
                user: await public_user(xuser),
            });
        }

        res.status(200).send({
            ok: true,
            data: img_url,
        });
    } catch (e) {
        console.log('error from send img ', e.toString());
        res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

module.exports = router;
