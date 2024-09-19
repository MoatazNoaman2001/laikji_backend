const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const enums = require('../helpers/enums');
const { getNowDateTime } = require('../helpers/tools');

const schema = Schema({
    userRef: {
        type: Schema.Types.ObjectId,
        ref: 'Users',
    },
    regUserRef: {
        type: Schema.Types.ObjectId,
        ref: 'RegUsers',
    },
    roomRef: {
        type: Schema.Types.ObjectId,
        ref: 'Rooms',
    },
    memberRef: {
        type: Schema.Types.ObjectId,
        ref: 'members',
    },
    socketId: String,
    room_password: String,
    room_name: String,
    os: String,
    showCountry: {
        type: Boolean,
        default: false,
    },
    ip: String,
    country_code: String,
    flag: String,
    is_typing: {
        type: Boolean,
        default: false,
    },
    token: {
        type: String,
        // select: false,
    },
    status: {
        type: String,
        default: enums.statusTypes.empty.toString(),
    },
    invited_to_meeting: {
        type: Boolean,
        default: false,
    },
    invited_by: String,
    private_status: {
        type: Number,
        default: 1, // 1: true; 0: false
    },
    can_public_chat: {
        type: Boolean,
        default: true,
    },
    can_private_chat: {
        type: Boolean,
        default: true,
    },
    can_use_mic: {
        type: Boolean,
        default: true,
    },
    can_use_camera: {
        type: Boolean,
        default: true,
    },
    stop_strong_public_chat: {
        type: Number,
        default: 0,
    },
    stop_strong_private_chat: {
        type: Number,
        default: 0,
    },
    stop_strong_use_mic: {
        type: Number,
        default: 0,
    },
    stop_strong_use_camera: {
        type: Number,
        default: 0,
    },
    prevent_private_screenshot: {
        type: Boolean,
        default: false,
    },
    order: {
        type: Number,
        default: 0,
    },
    is_joker: {
        type: Boolean,
        default: false,
    },
    game_number: {
        type: String,
        default: '',
    },
    game_number_color: {
        type: String,
        default: '255|255|255',
    },
    enterDate: {
        type: Date,
        default: getNowDateTime,
    },
});

module.exports = mongoose.model('RoomUsers', schema);
