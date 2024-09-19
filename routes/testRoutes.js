const express = require('express');
const helpers = require('../helpers/helpers');
const chatModel = require('../models/chatModel');
const groupModel = require('../models/groupModel');
const roomModel = require('../models/roomModel');
const userModal = require('../models/userModal');
const router = express.Router();
const enums = require('../helpers/enums');
const memberModal = require('../models/memberModal');
const roomUsersModel = require('../models/roomUsersModel');
const { getUserById } = require('../helpers/userHelpers');
const entryLogModel = require('../models/entryLogModel');
const adminLogModel = require('../models/adminLogModel');
const bannedModel = require('../models/bannedModel');
const memberPhotoModel = require('../models/memberPhotoModel');
const privateChatModel = require('../models/privateChatModel');
const privateMessageModel = require('../models/privateMessageModel');
const commentModel = require('../models/commentModel');
const likeModel = require('../models/likeModel');
const memberPhotoCommentModel = require('../models/memberPhotoCommentModel');
const wordFilterModel = require('../models/wordFilterModel');
const registeredUserModal = require('../models/registeredUserModal');
var ObjectId = require('mongoose').Types.ObjectId;

router.get('/token/:token', (req, res) => {
    res.status(200).send(helpers.generateToken(req.params.token));
});

router.get('/test', (req, res) => {
    res.status(200).send({
        ok: 'ues2',
    });
});

// router.get('/delall1', async (req, res) => {
//     await userModal.deleteMany({});
//     await roomUsersModel.deleteMany({});
//     await roomModel.deleteMany({});
//     await registeredUserModal.deleteMany({});
//     await entryLogModel.deleteMany({});
//     await bannedModel.deleteMany({});
//     await adminLogModel.deleteMany({});
//     await chatModel.deleteMany({});
//     await commentModel.deleteMany({});
//     await likeModel.deleteMany({});
//     await privateChatModel.deleteMany({});
//     await privateMessageModel.deleteMany({});
//     await memberModal.deleteMany({});
//     await memberPhotoModel.deleteMany({});
//     await memberPhotoCommentModel.deleteMany({});
//     await wordFilterModel.deleteMany({});
//     res.status(200).send({
//         ok: 'del',
//     });
// });

// router.get('/add_all_rooms_group', async (req, res) => {
//     var g1 = new groupModel({
//         name: 'كل الغرف (لايك جي)',
//         background: '60|60|60',
//         order: 9800,
//         type: enums.groupsTypes.all,
//     });
//     const g = await g1.save();
//     res.status(200).send({
//         ok: '334gf',
//         g,
//     });
// });

// router.get('/mm', async (req, res) => {
//     res.status(200).send({
//         ok: 'ues2',
//         data: await memberModal.find({})
//     });
// });

router.get('/get', async (req, res) => {
    // var pipeline = [
    //     {
    //         $lookup: {
    //             from: 'users',
    //             localField: 'userRef',
    //             foreignField: '_id',
    //             as: 'user',
    //         },
    //     },
    //     {
    //         $match: {
    //             'user.name': 'ROOT',
    //         },
    //     },
    //     {
    //         $sort: {
    //             'user.creationDate': -1.0,
    //         },
    //     },
    //     {
    //         $skip: 1.0,
    //     },
    //     {
    //         $limit: 1.0,
    //     },
    // ];

    // const s = await roomUsersModel.aggregate(pipeline);

    res.status(200).send({
        ok: 'ues2',
        // s: s,
    });
});

// router.get('/fix-meeting', async (req, res) => {
//     const rooms = await roomModel.find({ isMeeting: false });

//     rooms.forEach(async (room) => {
//         let mroom = await roomModel.findById(room.meetingRef);
//         mroom.welcome = {
//             img: '',
//             text: 'أهلا وسهلا بك بغرفة الاجتماعات',
//             direction: 'center',
//             color: '0|0|0',
//         };

//         mroom.outside_style = {
//             background: '255|255|255',
//             font_color: '0|0|0',
//         };

//         mroom.inside_style = {
//             background_1: '61|147|185',
//             background_2: '72|170|211',
//             font_color: '255|255|255',
//         };

//         await mroom.save();
//     });

//     res.status(200).send({
//         ok: 'meet',
//     });
// });

// router.get('/fix-users', async (req, res) => {
//     await userModal.deleteMany({});
//     await roomUsersModel.deleteMany({});
//     await memberModal.deleteMany({});
//     await entryLogModel.deleteMany({});
//     await adminLogModel.deleteMany({});
//     await bannedModel.deleteMany({});
//     await memberPhotoModel.deleteMany({});
//     await privateChatModel.deleteMany({});
//     await privateMessageModel.deleteMany({});
//     await roomModel.deleteMany({
//         isMeeting: true,
//     });

//     const rooms = await roomModel.find({});

//     rooms.forEach(async (room) => {
//         var meeting_room = new roomModel({
//             name: room.name,
//             icon: room.icon,
//             parentRef: room._id,
//             description: '',
//             isMeeting: true,
//             meetingPassword: '0000',
//             groupRef: '606b8f8844e78f128ecbfac2',
//             welcome: {
//                 img: '',
//                 text: 'أهلا وسهلا بك بغرفة الاجتماعات',
//                 direction: 'center',
//                 color: '0|0|0',
//             },
//             outside_style: {
//                 background: '255|255|255',
//                 font_color: '0|0|0',
//             },
//             inside_style: {
//                 background_1: '61|147|185',
//                 background_2: '72|170|211',
//                 font_color: '255|255|255',
//             },
//         });

//         await meeting_room.save();

//         var c1 = new chatModel({
//             name: '',
//             roomRef: meeting_room._id,
//             isMain: true,
//         });
//         c1.save();

//         room.meetingRef = meeting_room._id;
//         await room.save();

//         var master_mem = new memberModal({
//             username: 'MASTER',
//             password: '1234',
//             type: enums.fileTypes.mastermain,
//             roomRefs: [room._id, meeting_room._id],
//             isMain: true,
//         });
//         await master_mem.save();

//         var master = new userModal({
//             name: 'MASTER',
//             username: 'MASTER',
//             type: enums.userTypes.mastermain,
//             password: '1234',
//             memberRef: master_mem._id,
//         });
//         await master.save();

//         var master_room = new roomUsersModel({
//             userRef: master._id,
//             roomRef: room._id,
//         });
//         await master_room.save();

//         var master_room_meeeting = new roomUsersModel({
//             userRef: master._id,
//             roomRef: meeting_room._id,
//         });
//         await master_room_meeeting.save();

//         var cm_mem = new memberModal({
//             username: 'CHAT MANAGER',
//             password: '1234',
//             type: enums.fileTypes.chatmanager,
//             roomRefs: [room._id, meeting_room._id],
//             isMain: true,
//         });
//         await cm_mem.save();

//         var cm = new userModal({
//             name: 'CHAT MANAGER',
//             username: 'CHAT MANAGER',
//             type: enums.userTypes.chatmanager,
//             password: '1234',
//             memberRef: cm_mem._id,
//         });
//         await cm.save();

//         var cm_room = new roomUsersModel({
//             userRef: cm._id,
//             roomRef: room._id,
//         });
//         await cm_room.save();

//         var cm_room_meeeting = new roomUsersModel({
//             userRef: cm._id,
//             roomRef: meeting_room._id,
//         });
//         await cm_room_meeeting.save();

//         var root_mem = new memberModal({
//             username: 'ROOT',
//             password: '1234',
//             type: enums.fileTypes.root,
//             roomRefs: [room._id, meeting_room._id],
//             isMain: true,
//         });
//         await root_mem.save();

//         var root = new userModal({
//             name: 'ROOT',
//             username: 'ROOT',
//             type: enums.userTypes.root,
//             password: '1234',
//             memberRef: root_mem._id,
//         });
//         await root.save();

//         var root_room = new roomUsersModel({
//             userRef: root._id,
//             roomRef: room._id,
//         });
//         await root_room.save();

//         var root_room_meeeting = new roomUsersModel({
//             userRef: root._id,
//             roomRef: meeting_room._id,
//         });
//         await root_room_meeeting.save();
//     });
//     return res.status(200).send({
//         ok: 'OK',
//     });
// });

// router.get('/fix-rooms', async (req, res) => {
//     let rooms = await roomModel.find();
//     rooms.forEach(async (room) => {
//         var r = new roomModel({
//             name: room.name,
//             icon: room.icon,
//             parentRef: room._id,
//             description: '',
//             isMeeting: true,
//             groupRef: '606b8f8844e78f128ecbfac2',
//         });

//         await r.save();

//         var c1 = new chatModel({
//             name: '',
//             roomRef: r._id,
//             isMain: true,
//         });
//         c1.save();

//         room.meetingRef = r._id;
//         await room.save();
//     });
//     res.status(200).send({
//         ok: 'fixed',
//     });
// });

// router.get("/fix-masters", async (req, res) => {
//     await userModal.updateMany({
//         type: 1,
//         username: "master"
//     }, {
//         username: "MASTER",
//         name: "MASTER",
//         type: enums.userTypes.mastermain
//     });
//     res.status(200).send({
//         ok: "ok"
//     })
// })

// router.get('/fix-rooms', async (req, res) => {
//     await userModal.deleteMany();
//     await memberModal.deleteMany();
//     let rooms = await roomModel.find();
//     rooms.forEach(async (room) => {
//         var master_mem = new memberModal({
//             username: 'MASTER',
//             password: '1234',
//             type: enums.fileTypes.mastermain,
//             roomRef: room._id,
//             isMain: true,
//         });
//         await master_mem.save();

//         var master = new userModal({
//             name: 'MASTER',
//             username: 'MASTER',
//             roomRef: room._id,
//             type: enums.userTypes.mastermain,
//             password: '1234',
//             memberRef: master_mem._id,
//         });
//         await master.save();

//         var cm_mem = new memberModal({
//             username: 'CHAT MANAGER',
//             password: '1234',
//             type: enums.fileTypes.chatmanager,
//             roomRef: room._id,
//             isMain: true,
//         });
//         await cm_mem.save();

//         var cm = new userModal({
//             name: 'CHAT MANAGER',
//             username: 'CHAT MANAGER',
//             roomRef: room._id,
//             type: enums.userTypes.chatmanager,
//             password: '1234',
//             memberRef: cm_mem._id,
//         });
//         await cm.save();

//         var root_mem = new memberModal({
//             username: 'ROOT',
//             password: '1234',
//             type: enums.fileTypes.root,
//             roomRef: room._id,
//             isMain: true,
//         });
//         await root_mem.save();

//         var root = new userModal({
//             name: 'ROOT',
//             username: 'ROOT',
//             roomRef: room._id,
//             type: enums.userTypes.root,
//             password: '1234',
//             memberRef: root_mem._id,
//         });
//         await root.save();
//     });
//     res.status(200).send({
//         ok: 'fixed',
//     });
// });

// router.get("/ssds", (req, res) => {
//     groupModel.find({}).remove().exec();
//     roomModel.find({}).remove().exec();
//     res.status(200).send({
//         ok: "t122"
//     })
// })

// router.get("/addGroups", async (req, res) => {

//     await groupModel.find({}).remove().exec();
//     await roomModel.find({}).remove().exec();

//     try {
//         var g1 = new groupModel({
//             _id: "606b8f8844e78f128ecbfac0",
//             name: "الغرف المميزة",
//             background: "60|60|60",
//             order: 10000,
//             type: enums.groupsTypes.special
//         });
//         g1.save();

//         var g1 = new groupModel({
//             _id: "606b8f8844e78f128ecbfac1",
//             name: "الغرف الذهبية",
//             background: "213|200|30",
//             order: 9900,
//             type: enums.groupsTypes.gold
//         });
//         g1.save();

//         var g1 = new groupModel({
//             _id: "606b8f8844e78f128ecbfac2",
//             name: "غرف الاجتماعات الخاصة",
//             background: "254|20|25",
//             order: -3,
//             type: enums.groupsTypes.meeting
//         });
//         g1.save();

//         var g1 = new groupModel({
//             _id: "606b8f8844e78f128ecbfac3",
//             name: "غرف الدعم الفني والمبيعات",
//             order: -2,
//             type: enums.groupsTypes.support
//         });
//         g1.save();

//         var g1 = new groupModel({
//             _id: "606b8f8844e78f128ecbfac4",
//             name: "الغرف التعليمية والدينية",

//             type: enums.groupsTypes.learning
//         });
//         g1.save();

//         g1 = new groupModel({
//             _id: "606b8f8844e78f128ecbfad0",
//             name: "العراق",

//         });
//         g1.save();

//         var r1 = new roomModel({
//             name: "♥ڔۏمــٱنــڛــﯧْــاټ ♬ ٵهــڷ اڸــڠــڕام♥",
//             description: "♥❀ الاحترام دليل انت هنا في القلب❀♥",
//             groupRef: g1._id,
//             isGold: true
//         });

//         r1.save().then(doc => {
//             var c1 = new chatModel({
//                 name: "",
//                 roomRef: doc._id,
//                 isMain: true
//             });
//             c1.save();
//         });

//         var r1 = new roomModel({
//             name: "❤♔همسات ليالي الموصل♔❤",
//             description: "❤الإحترام تربية وليس خوف❤",
//             groupRef: g1._id
//         });
//         r1.save().then(doc => {
//             var c1 = new chatModel({
//                 name: "",
//                 roomRef: doc._id,
//                 isMain: true
//             });
//             c1.save();
//         });

//         var r1 = new roomModel({
//             name: " ٵهــڷ اڸــڠــڕام♥",
//             description: "❤❀لا تندم على نيه صادقه❀❤ ",
//             groupRef: g1._id,
//             isSpecial: true
//         });
//         r1.save().then(doc => {
//             var c1 = new chatModel({
//                 name: "",
//                 roomRef: doc._id,
//                 isMain: true
//             });
//             c1.save();
//         });

//         g1 = new groupModel({
//             _id: "606b8f8844e78f128ecbfad1",
//             name: "سوريا",

//         });
//         g1.save();

//         var r1 = new roomModel({
//             name: "❥⃝∗⁎.ʚجـلــســات عــربــيــةɞ.⁎∗❥⃝",
//             description: "♥❀ انت هنا في القلب❀♥",
//             groupRef: g1._id
//         });
//         r1.save().then(doc => {
//             var c1 = new chatModel({
//                 name: "",
//                 roomRef: doc._id,
//                 isMain: true
//             });
//             c1.save();
//         });

//         var r1 = new roomModel({
//             name: "♡ஜنـــــــــــآم وْآنـــــــآ آرتــبـلــگ آلــآح’ـلــآمஜ♡",
//             description: "أخـبـرو ألـجـميـع بـأن ألاصـيـل يبـقـى أصيـل",
//             groupRef: g1._id
//         });
//         r1.save().then(doc => {
//             var c1 = new chatModel({
//                 name: "",
//                 roomRef: doc._id,
//                 isMain: true
//             });
//             c1.save();
//         });

//         g1 = new groupModel({
//             _id: "606b8f8e44e78f128ecbfada",
//             name: "فلسطين",

//         });
//         g1.save();

//         g1 = new groupModel({
//             _id: "606b8f8844e78f128ecbfad3",
//             name: "مصر",

//         });
//         g1.save();

//         g1 = new groupModel({
//             _id: "606b8f8e44e78f128ecbfad4",
//             name: "الإمارات",

//         });
//         g1.save();

//         g1 = new groupModel({
//             _id: "606b8f8e44e78f128ecbfad5",
//             name: "البحرين",

//         });
//         g1.save();

//         g1 = new groupModel({
//             _id: "606b8f8e44e78f128ecbfad6",
//             name: "الكويت",

//         });
//         g1.save();

//         g1 = new groupModel({
//             _id: "606b8f8e44e78f128ecbfad7",
//             name: "قطر",

//         });
//         g1.save();

//         g1 = new groupModel({
//             _id: "606b8f8e44e78f128ecbfad8",
//             name: "ليبيا",

//         });
//         g1.save();

//         g1 = new groupModel({
//             _id: "606b8f8e44e78f128ecbfad9",
//             name: "الجزائر",

//         });
//         g1.save();

//         g1 = new groupModel({
//             _id: "606b8f8844e78f128ecbfad2",
//             name: "السودان",

//         });
//         g1.save();

//         g1 = new groupModel({
//             _id: "606b8f8e44e78f128ecbfadb",
//             name: "الصومال",

//         });
//         g1.save();

//         g1 = new groupModel({
//             _id: "606b8f8e44e78f128ecbfadc",
//             name: "السويد",

//         });
//         g1.save();

//         res.status(200).send({
//             ok: true
//         });
//     } catch (e) {
//         res.status(500).send({
//             ok: false
//         });
//     }
// });

module.exports = router;
