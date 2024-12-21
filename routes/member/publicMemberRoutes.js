const express = require('express');
const router = express.Router();
const memberModal = require('../../models/memberModal');
var ObjectId = require('mongoose').Types.ObjectId;
const helpers = require('../../helpers/helpers');
const memberPhotoModel = require('../../models/memberPhotoModel');
const likeModel = require('../../models/likeModel');
const {
    getUserById,
    public_user,
    getUserOfMember,
    getMemberRemainingTime,
    getMemberSettings,
} = require('../../helpers/userHelpers');
const userModal = require('../../models/userModal');
const viewModel = require('../../models/viewModel');
const multer = require('multer');
const path = require('path');
const commentModel = require('../../models/commentModel');
const memberPhotoCommentModel = require('../../models/memberPhotoCommentModel');
const { intToString } = require('../../helpers/tools');

var storage = multer.diskStorage({
    destination: 'public/member/',
    filename: function (req, file, cb) {
        cb(null, helpers.generateKey(8) + '-' + Date.now() + path.extname(file.originalname));
    },
});

const img_uploader = multer({
    storage: storage,
});

router.get('/info', async (req, res) => {
    try {
        let member = req.member;
        let item = await memberModal.findById(member._id).select('-password');

        let users_of_mem = await getUserOfMember(member._id, req.room._id);

        const photos = await memberPhotoModel.find({
            memberRef: new ObjectId(item._id),
            is_approved: true,
        });

        photos.forEach(async (photo) => {
            photo.comments_count = await memberPhotoCommentModel.count({
                photoRef: new ObjectId(photo._id),
            });
        });

        const old_viewed = await viewModel.find({
            memberRef: new ObjectId(item._id),
            key: req.user.key,
        });

        if (!req.user.is_spy) {
            users_of_mem.forEach(async (user_of_mem) => {
                if (user_of_mem && user_of_mem._id.toString() != req.user._id.toString()) {
                    if (old_viewed.length == 0) {
                        item.views++;
                        await item.save();

                        const view = new viewModel({
                            memberRef: new ObjectId(item._id),
                            key: req.user.key,
                        });
                        await view.save();
                    }

                    if (user_of_mem.socketId) {
                        global.io.to(user_of_mem.socketId).emit(req.room._id, {
                            type: 'view-msg',
                            data: {
                                from: req.user.name,
                                text: 'شاهد ملفك',
                            },
                        });
                    }
                }
            });
        }

        const old_liked = await likeModel.find({
            memberRef: new ObjectId(item._id),
            key: req.user.key,
        });

        item = JSON.parse(JSON.stringify(item));

        if (old_liked.length > 0) {
            item.is_liked = true;
        } else {
            item.is_liked = false;
        }

        item.time_to_end = getMemberRemainingTime(item);

        item.comments_count = await commentModel.count({
            memberRef: new ObjectId(item._id),
        });

        item.flag = item.showCountry ? users_of_mem[users_of_mem.length - 1].flag : '';

        item.login_time = intToString(item.login_time);
        item.mic_time = intToString(item.mic_time);
        item.banned = intToString(item.banned);
        item.likes = intToString(item.likes);
        item.views = intToString(item.views);

        item.settings = { ...(await getMemberSettings(item)) };

        res.status(200).send({
            ok: true,
            data: item,
            photos: photos,
        });
    } catch (e) {
        console.error(e);
        res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.get('/like', async (req, res) => {
    try {
        let member = req.member;
        const item = await memberModal.findById(member._id).select('-password');

        const old_query = {
            memberRef: new ObjectId(item._id),
            key: req.user.ip,
        };

        const old = await likeModel.find(old_query);

        if (old.length === 0) {
            item.likes++;

            let likes_level = Math.ceil(item.likes / 50);
            likes_level = likes_level > 10 ? 10 : likes_level;
            likes_level = likes_level <= 0 ? 1 : likes_level;
            item.like_level = likes_level;
            item.save();
            const like = new likeModel({
                memberRef: new ObjectId(item._id),
                key: req.user.key,
            });
            like.save();

            let users_of_mem = await getUserOfMember(member._id, req.room._id);

            users_of_mem.forEach(async (user_of_mem) => {
                if (user_of_mem && user_of_mem.socketId) {
                    global.io.to(user_of_mem.socketId).emit(req.room._id, {
                        type: 'like-msg',
                        data: {
                            from: req.user.name,
                            text: 'أعجب بملفك',
                        },
                    });

                    global.io.emit(req.room._id, {
                        type: 'info-change',
                        data: await public_user(user_of_mem),
                    });
                }
            });

            res.status(200).send({
                ok: true,
                liked: true,
            });
        } else {
            // await likeModel.find(old_query).remove();
            // item.likes--;
            // item.likes = item.likes < 0 ? 0: item.likes;
            // item.save();
            res.status(200).send({
                ok: true,
                liked: false,
            });
        }
    } catch (e) {
        console.error(e);
        res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.post('/report', async (req, res) => {
    try {
        let member = req.member;
        const item = await memberModal.findById(member._id).select('-password');

        res.status(200).send({
            ok: true,
        });
    } catch (e) {
        res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.post('/upload-img', img_uploader.single('img'), async (req, res) => {
    try {
        let member = req.member;
        if (!member.accept_photos) {
            return res.status(200).send({
                ok: false,
                msg: {
                    ar: 'هذا الملف لا يستقبل صور',
                    en: "this member doesn't accept photos",
                },
            });
        }

        if (req.file && req.file.filename) {
            helpers.resizeImage('member/' + req.file.filename, true, 900);
        }

        let path = req.file && req.file.filename ? 'member/' + req.file.filename : null;

        let item = new memberPhotoModel({
            title: req.body.title,
            senderRef: req.user._id,
            path: path,
            is_approved: false,
            memberRef: member._id,
        });

        await item.save();

        let users_of_mem = await getUserOfMember(member._id, req.room._id);
        users_of_mem.forEach(async (user_of_mem) => {
            console.log(user_of_mem.socketId, user_of_mem.username);
            if (user_of_mem && user_of_mem.socketId) {
                global.io.to(user_of_mem.socketId).emit(req.room._id, {
                    type: 'photo-request',
                    user: await public_user(req.user),
                    data: item,
                });
            }
        });
        res.status(200).send({
            ok: true,
        });
    } catch (e) {
        console.error(e);
        res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.post('/comment', async (req, res) => {
    try {
        let member = req.member;

        if (!req.body.body) {
            res.status(200).send({
                ok: false,
                msg: {
                    ar: 'التعليق غير صالح',
                    en: 'comment invalid',
                },
            });
        }

        let item = new commentModel({
            body: req.body.body,
            memberRef: member._id,
            userRef: req.user._id,
        });

        await item.save();

        let users_of_mem = await getUserOfMember(member._id, req.room._id);
        users_of_mem.forEach(async (user_of_mem) => {
            if (user_of_mem && user_of_mem.socketId) {
                global.io.to(user_of_mem.socketId).emit(req.room._id, {
                    type: 'new-comment',
                    data: {
                        from: req.user.name,
                        text: 'قام بالتعليق على صورتك الشخصية',
                    },
                });
            }
        });

        res.status(200).send({
            ok: true,
        });
    } catch (e) {
        console.log(e);
        res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.post('/comment/:photo_id', async (req, res) => {
    try {
        let member = req.member;

        if (!req.body.body) {
            res.status(200).send({
                ok: false,
                msg: {
                    ar: 'التعليق غير صالح',
                    en: 'comment invalid',
                },
            });
        }

        let item = new memberPhotoCommentModel({
            body: req.body.body,
            memberRef: member._id,
            photoRef: req.params.photo_id,
            userRef: req.user._id,
        });

        await item.save();

        let users_of_mem = await getUserOfMember(member._id, req.room._id);
        users_of_mem.forEach((user_of_mem) => {
            if (user_of_mem && user_of_mem.socketId) {
                global.io.to(user_of_mem.socketId).emit(req.room._id, {
                    type: 'new-comment',
                    data: {
                        from: req.user.name,
                        text: 'قام بالتعليق على صورة الألبوم',
                    },
                });
            }
        });

        await memberPhotoModel.findByIdAndUpdate(req.params.photo_id, {
            has_new_comments: true,
        });

        res.status(200).send({
            ok: true,
        });
    } catch (e) {
        console.log(e);
        res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.get('/comments', async (req, res) => {
    try {
        let member = req.member;
        let comments = [];
        const comments_all = await commentModel.find({
            memberRef: new ObjectId(member._id),
        });

        await Promise.all(
            comments_all.map(async (com) => {
                const u = await public_user(
                    await getUserById(com.userRef.toString(), req.room._id),
                );
                comments.push({
                    _id: com._id,
                    body: com.body,
                    userRef: u,
                    creationDate: com.creationDate,
                });
            }),
        );

        res.status(200).send({
            ok: true,
            data: comments,
        });
    } catch (e) {
        console.error(e);
        res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.get('/comments/:photo_id', async (req, res) => {
    try {
        let member = req.member;

        let users_of_mem = await getUserOfMember(member._id, req.room._id);

        let comments = [];
        const comments_all = await memberPhotoCommentModel.find({
            memberRef: new ObjectId(member._id),
            photoRef: new ObjectId(req.params.photo_id),
        });

        await Promise.all(
            comments_all.map(async (com) => {
                const u = await public_user(
                    await getUserById(com.userRef.toString(), req.room._id),
                );
                comments.push({
                    _id: com._id,
                    body: com.body,
                    userRef: u,
                    creationDate: com.creationDate,
                });
            }),
        );
        users_of_mem.forEach(async (user_of_mem) => {
            if (user_of_mem && user_of_mem._id.toString() == req.user._id.toString()) {
                await memberPhotoModel.findByIdAndUpdate(req.params.photo_id, {
                    has_new_comments: false,
                });
            }
        });

        res.status(200).send({
            ok: true,
            data: comments,
        });
    } catch (e) {
        console.error(e);
        res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

module.exports = router;
