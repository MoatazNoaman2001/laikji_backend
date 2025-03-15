const express = require('express');
const multer = require('multer');
const router = express.Router();
const memberModal = require('../../models/memberModal');
var ObjectId = require('mongoose').Types.ObjectId;
const helpers = require('../../helpers/helpers');
const path = require('path');
const memberPhotoModel = require('../../models/memberPhotoModel');
const enums = require('../../helpers/enums');
const { public_user, getUserById } = require('../../helpers/userHelpers');
const memberPhotoCommentModel = require('../../models/memberPhotoCommentModel');
const commentModel = require('../../models/commentModel');
const registeredUserModal = require('../../models/registeredUserModal');

var storage = multer.diskStorage({
    destination: 'public/member/',
    filename: function (req, file, cb) {
        cb(null, helpers.generateKey(8) + '-' + Date.now() + path.extname(file.originalname));
    },
});

const img_uploader = multer({
    storage: storage,
});

router.post('/update', async (req, res) => {
    try {
        
        let member = req.member;

        const item = await memberModal.findById(member._id);
        item.liveAddress = req.body.liveAddress;
        item.birthAddress = req.body.birthAddress;
        item.relationship = req.body.relationship;
        item.birthDate = req.body.birthDate;
        item.bio = req.body.bio;
        item.job = req.body.job;
        item.about = req.body.about;
        item.gender = req.body.gender;
        item.name_color = req.body.name_color;
        item.bg_color = req.body.bg_color;
        item.img_color = req.body.img_color;
        item.nickname = req.body.nickname;
        item.is_flash = req.body.is_flash;
        item.is_animated_text = req.body.is_animated_text;
        item.is_girl = req.body.is_girl;
        item.is_full_bg = req.body.is_full_bg;
        item.screenshot = req.body.screenshot;
        item.accept_photos = req.body.accept_photos;
        item.showCountry = req.body.showCountry;
        item.is_shader_banner = req.body.is_shader_banner;
        
        console.log(`item isShaderBanner: ${item.is_shader_banner}`);
        console.log(`room: ${req.room}`);
        

        item.save();

        if (req.room) {
            global.io.emit(req.room._id, {
                type: 'info-change',
                data: await public_user(req.user),
            });
        }

        return res.status(200).send({
            ok: true,
        });
    } catch (e) {
        return res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.post('/update-img', img_uploader.single('img'), async (req, res) => {
    try {
        let member = req.member;

        var update = {};

        if (req.body.delete == 'YES') {
            update = {
                img: null,
            };
        } else {
            if (req.file && req.file.filename) {
                helpers.resizeImage('member/' + req.file.filename, true, 900);
            }

            update = {
                img: req.file && req.file.filename ? 'member/' + req.file.filename : member.img,
                imageUpdatedDate: Date.now(),
            };
        }

        member = await memberModal.findOneAndUpdate(
            {
                _id: new ObjectId(member._id),
            },
            update,
            {
                new: true,
            },
        );

        if (req.room) {
            global.io.emit(req.room._id, {
                type: 'info-change',
                data: await public_user(req.user),
                // toast: {
                //     ar: 'تم تحديث بياناتك',
                //     en: 'Your information has been updated',
                // },
            });
        }

        res.status(200).send({
            ok: true,
            data: member,
        });
    } catch (e) {
        res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

router.post('/update-background', img_uploader.single('img'), async (req, res) => {
    try {
        let member = req.member;

        var update = {};

        if (req.body.delete == 'YES') {
            update = {
                background: null,
            };
        } else {
            if (req.file && req.file.filename) {
                helpers.resizeImage('member/' + req.file.filename, true, 900);
            }

            update = {
                background:
                    req.file && req.file.filename
                        ? 'member/' + req.file.filename
                        : member.background,
            };
        }

        member = await memberModal.findOneAndUpdate(
            {
                _id: new ObjectId(member._id),
            },
            update,
            {
                new: true,
            },
        );

        if (req.room) {
            global.io.emit(req.room._id, {
                type: 'info-change',
                data: await public_user(req.user),
                // toast: {
                //     ar: 'تم تحديث بياناتك',
                //     en: 'Your information has been updated',
                // },
            });
        }

        res.status(200).send({
            ok: true,
            data: member,
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

        if (req.file && req.file.filename) {
            helpers.resizeImage('member/' + req.file.filename, true, 900);
        }

        let path = req.file && req.file.filename ? 'member/' + req.file.filename : null;

        if (req.body._id) {
            let update = {
                title: req.body.title,
            };

            if (path) {
                update.path = path;
            }

            await memberPhotoModel.findOneAndUpdate(
                {
                    _id: new ObjectId(req.body._id),
                },
                update,
                {
                    new: true,
                },
            );
        } else {
            let item = new memberPhotoModel({
                title: req.body.title,
                path: path,
                is_approved: true,
                memberRef: member._id,
            });

            await item.save();
        }

        if (req.room) {
            global.io.emit(req.room._id, {
                type: 'info-change',
                data: await public_user(req.user),
                toast: {
                    ar: 'تم تحديث بياناتك',
                    en: 'Your information has been updated',
                },
            });
        }

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

router.get('/action-img/:id/:val', async (req, res) => {
    try {
        let member = req.member;
        console.log(req.params);
        let sender_user = null;

        let photo = await memberPhotoModel.find({
            _id: new ObjectId(req.params.id),
            memberRef: new ObjectId(member._id),
        });

        if (photo.length > 0) {
            sender_user = await getUserById(photo[0].senderRef, req.room._id);
        }

        if (req.params.val == 1) {
            await memberPhotoModel.findOneAndUpdate(
                {
                    _id: new ObjectId(req.params.id),
                    memberRef: new ObjectId(member._id),
                },
                {
                    is_approved: 1,
                },
            );

            global.io.emit(req.room._id, {
                type: 'info-change',
                data: await public_user(req.user),
                toast: {
                    ar: 'تم قبول الصورة',
                    en: 'photo accepted',
                },
            });

            if (sender_user && sender_user.socketId) {
                global.io.to(sender_user.socketId).emit(req.room._id, {
                    type: 'popup-msg',
                    data: {
                        from: member.username,
                        text: 'قام بقبول الصورة',
                    },
                });
            }
        }

        if (req.params.val == 0) {
            await memberPhotoModel
                .find({
                    _id: new ObjectId(req.params.id),
                    memberRef: new ObjectId(member._id),
                })
                .remove();

            global.io.emit(req.room._id, {
                type: 'info-change',
                data: await public_user(req.user),
                toast: {
                    ar: 'تم رفض الصورة',
                    en: 'photo rejected',
                },
            });

            if (sender_user && sender_user.socketId) {
                global.io.to(sender_user.socketId).emit(req.room._id, {
                    type: 'popup-msg',
                    data: {
                        from: member.username,
                        text: 'قام برفض الصورة',
                    },
                });
            }
        }

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

router.delete('/upload-img/:id', async (req, res) => {
    try {
        let member = req.member;

        if (req.params.id) {
            await memberPhotoModel
                .find({
                    _id: new ObjectId(req.params.id),
                    memberRef: new ObjectId(member._id),
                })
                .remove();
        }

        if (req.room) {
            global.io.emit(req.room._id, {
                type: 'info-change',
                data: await public_user(req.user),
                toast: {
                    ar: 'تم تحديث بياناتك',
                    en: 'Your information has been updated',
                },
            });
        }

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

router.post('/update-password', async (req, res) => {
    try {
        let member = req.member;

        // if (
        //     member.type == enums.fileTypes.mastermain ||
        //     member.type == enums.fileTypes.chatmanager ||
        //     member.type == enums.fileTypes.root
        // ) {
        //     return res.status(200).send({
        //         ok: true,
        //     });
        // }

        const item = await memberModal.findById(member._id);

        if (item.code != req.body.code) {
            return res.status(200).send({
                ok: false,
                error_code: 22,
                msg_ar: 'الكود خاطئ',
                msg_en: 'code is incorrect',
            });
        }

        if (item.password == req.body.old_password) {
            item.password = req.body.new_password;
            await item.save();

            if (item.isMain && item.regUserRef) {
                await registeredUserModal.findByIdAndUpdate(item.regUserRef, {
                    password: req.body.new_password ?? xuser.password,
                });
            }

            return res.status(200).send({
                ok: true,
            });
        }

        return res.status(200).send({
            ok: false,
            error_code: 21,
            msg_ar: 'كلمة السر القديمة خاطئة',
            msg_en: 'Old password is incorrect',
        });
    } catch (e) {
        console.error(500, e);
        return res.status(200).send({
            ok: false,
            error: e.message,
        });
    }
});

router.delete('/comment/:id', async (req, res) => {
    try {
        let member = req.member;

        if (req.params.id) {
            await memberPhotoCommentModel
                .find({
                    _id: new ObjectId(req.params.id),
                    memberRef: new ObjectId(member._id),
                })
                .remove();

            await commentModel
                .find({
                    _id: new ObjectId(req.params.id),
                    memberRef: new ObjectId(member._id),
                })
                .remove();
        }

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

module.exports = router;
