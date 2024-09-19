const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { getNowDateTime } = require('../helpers/tools');

const schema = Schema({
    name: String,
    key: String,
    icon: String,
    img_key: String,
    img: String,
    latestRoomRef: {
        type: Schema.Types.ObjectId,
        ref: 'Rooms',
    },
    server_can_public_chat: {
        type: Boolean,
        default: true,
    },
    server_can_private_chat: {
        type: Boolean,
        default: true,
    },
    server_can_use_mic: {
        type: Boolean,
        default: true,
    },
    server_can_use_camera: {
        type: Boolean,
        default: true,
    },
    server_stop_until: Date,
    server_stop_time: Number,
    creationDate: {
        type: Date,
        default: getNowDateTime,
    },
});
module.exports = mongoose.model('Users', schema);
