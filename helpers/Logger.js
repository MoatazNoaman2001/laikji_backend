const adminLogModel = require('../models/adminLogModel');
const entryLogModel = require('../models/entryLogModel');
const roomModel = require('../models/roomModel');
const { getNowDateTime } = require('./tools');
const { getMemberOfUser, getUserColor } = require('./userHelpers');

const addEntryLog = async (user, room_id, enterDate, reason = 0) => {
    if (!user.is_visible) return;

    try {
        let member = await getMemberOfUser(user._id, room_id);

        let model = new entryLogModel({
            roomRef: room_id,
            userRef: user._id,
            memberRef: member ? member._id : null,
            name: user.name,
            user_color: (await getUserColor(member ? member : null, user)).user_color,
            reason: reason,
            ip: user.ip,
            country: user.country_code,
            enterDate: enterDate,
            type: user.type,
            strong: user.strong,
            permissions: user.permissions,
            key: user.key,
            exitDate: getNowDateTime(true),
            stayTime: getNowDateTime(true) - enterDate,
        });

        await model.save();
    } catch (e) {}
};

const addAdminLog = async (
    user,
    room_id,
    action_ar,
    action_en,
    affected = null,
    with_toast = true,
    only_target = false,
) => {
    if (!user.is_visible) return;

    try {
        let member = await getMemberOfUser(user._id, room_id);

        let model = new adminLogModel({
            roomRef: room_id,
            userRef: user._id,
            memberRef: member ? member._id : null,
            name: user.name,
            type: user.type,
            action_ar: action_ar,
            action_en: action_en,
            affected: affected,
        });

        await model.save();

        if (with_toast && user.is_visible) {
            global.io.emit(room_id, {
                type: 'admin-changes',
                target: room_id,
                data: {
                    ar: `${user.name} ${action_ar} ${affected ? affected : ''}`,
                    en: `${user.name} ${action_en} ${affected ? affected : ''}`,
                },
            });

            if (!only_target) {
                let room = await roomModel.findById(room_id);
                if (room && !room.isMeeting) {
                    global.io.emit(room.meetingRef, {
                        type: 'admin-changes',
                        target: room_id,
                        data: {
                            ar: `${user.name} ${action_ar} ${affected ? affected : ''}`,
                            en: `${user.name} ${action_en} ${affected ? affected : ''}`,
                        },
                    });
                }
            }
        }
    } catch (e) {
        console.log('EE', e);
    }
};

module.exports = {
    addEntryLog,
    addAdminLog,
};
