const express = require('express');
const helpers = require('../helpers/helpers');
const enums = require('../helpers/enums');
const groupModel = require('../models/groupModel');
const roomModel = require('../models/roomModel');
const { getSettings, hexToXRgb } = require('../helpers/tools');
const router = express.Router();

router.get('/all', async (req, res) => {
    var response = [];
    const settings = await getSettings();
    try {
        var grbs = await groupModel.find().sort({
            order: 'descending',
        });
        const golden_rooms = [];
        const special_rooms = [];
        const all_rooms = [];
        await Promise.all(
            grbs.map(async (item) => {
                var rooms = await roomModel.find({
                    groupRef: item._id,
                });

                var res_rooms = [];
                rooms.map(async (element) => {
                    const r = await helpers.get_room_small(element, item, settings);

                    if (r.isSpecial) {
                        special_rooms.push(r);
                    } else if (r.isGold) {
                        golden_rooms.push(r);
                    }

                    if (!r.isMeeting) {
                        all_rooms.push(r);
                    }

                    res_rooms.push(r);
                });

                let g_bg = item.background;
                let g_fnt = '255|255|255';
                if (item.type == enums.groupsTypes.gold) {
                    g_bg = hexToXRgb(settings.rgb_gold_group_bg) || item.background;
                    g_fnt = hexToXRgb(settings.rgb_gold_group_fnt) || '255|255|255';
                }

                if (item.type == enums.groupsTypes.special) {
                    g_bg = hexToXRgb(settings.rgb_special_group_bg) || item.background;
                    g_fnt = hexToXRgb(settings.rgb_special_group_fnt) || '255|255|255';
                }

                if (item.type == enums.groupsTypes.meeting) {
                    g_bg = hexToXRgb(settings.rgb_meet_group_bg) || item.background;
                    g_fnt = hexToXRgb(settings.rgb_meet_group_fnt) || '255|255|255';
                }

                if (item.type == enums.groupsTypes.all) {
                    g_bg = hexToXRgb(settings.rgb_all_group_bg) || item.background;
                    g_fnt = hexToXRgb(settings.rgb_all_group_fnt) || '255|255|255';
                }

                if (item.type == enums.groupsTypes.country) {
                    g_bg = hexToXRgb(settings.rgb_country_group_bg) || item.background;
                    g_fnt = hexToXRgb(settings.rgb_country_group_fnt) || '255|255|255';
                }

                if (item.type == enums.groupsTypes.support) {
                    g_bg = hexToXRgb(settings.rgb_support_group_bg) || item.background;
                    g_fnt = hexToXRgb(settings.rgb_support_group_fnt) || '255|255|255';
                }

                if (item.type == enums.groupsTypes.learning) {
                    g_bg = hexToXRgb(settings.rgb_learning_group_bg) || item.background;
                    g_fnt = hexToXRgb(settings.rgb_learning_group_fnt) || '255|255|255';
                }

                var res_item = {
                    _id: item._id,
                    name: item.name,
                    type: item.type,
                    icon: item.icon ? process.env.mediaUrl + item.icon : null,
                    background: g_bg,
                    font: g_fnt,
                    inside_style: item.inside_style,
                    rooms: res_rooms,
                    order: item.order,
                };

                response.push(res_item);
            }),
        );

        let golden_gr = response.find((g) => g.type == enums.groupsTypes.gold);
        if (golden_gr) {
            golden_gr.rooms = golden_rooms;
        }

        let special_gr = response.find((g) => g.type == enums.groupsTypes.special);
        if (special_gr) {
            special_gr.rooms = special_rooms;
        }

        let all_gr = response.find((g) => g.type == enums.groupsTypes.all);
        if (all_gr) {
            all_gr.rooms = all_rooms;
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

module.exports = router;
