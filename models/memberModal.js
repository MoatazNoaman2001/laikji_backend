const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const enums = require('../helpers/enums');
const { getNowDateTime } = require('../helpers/tools');

const schema = Schema({
    username: String,
    nickname: String,
    password: String,
    code: {
        type: String,
        default: '',
    },
    roomRefs: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Rooms',
        },
    ],
    isMain: {
        type: Boolean,
        default: false,
    },
    type: {
        type: Number,
        default: enums.fileTypes.protected,
    },
    regUserRef: {
        type: Schema.Types.ObjectId,
        ref: 'RegUsers',
    },
    img: {
        type: String,
        default: '',
    },
    background: {
        type: String,
        default: '',
    },
    liveAddress: {
        type: String,
        default: '',
    },
    birthAddress: {
        type: String,
        default: '',
    },
    relationship: {
        type: String,
        default: '',
    },
    birthDate: {
        type: String,
        default: '',
    },
    bio: {
        type: String,
        default: '',
    },
    job: {
        type: String,
        default: '',
    },
    about: {
        type: String,
        default: '',
    },
    gender: {
        type: String,
        default: '',
    },
    name_color: {
        type: String,
        default: '0|0|0',
    },
    bg_color: {
        type: String,
        default: '255|255|255',
    },
    img_color: {
        type: String,
        default: '255|255|255',
    },
    is_full_bg: {
        type: Boolean,
        default: false,
    },
    screenshot: {
        type: Boolean,
        default: true,
    },
    is_girl: {
        type: Boolean,
        default: false,
    },
    showCountry: {
        type: Boolean,
        default: false,
    },
    views: {
        type: Number,
        default: 0,
    },
    likes: {
        type: Number,
        default: 0,
    },
    like_level: {
        type: Number,
        default: 1,
    },
    banned: {
        type: Number,
        default: 0,
    },
    mic_time: {
        type: Number,
        default: 0,
    },
    login_time: {
        type: Number,
        default: 0,
    },
    is_animated_text: {
        type: Boolean,
        default: true,
    },
    is_flash: {
        type: Boolean,
        default: false,
    },
    accept_photos: {
        type: Boolean,
        default: false,
    },
    validationDate: {
        type: Date,
        default: getNowDateTime,
    },
    imageUpdatedDate: {
        type: Date,
        default: getNowDateTime,
    },
    creationDate: {
        type: Date,
        default: getNowDateTime,
    },
    startDate: {
        type: Date,
        default: getNowDateTime,
    },
    endDate: {
        type: Date,
        default: getNowDateTime,
    },
    o_name: String,
    o_phone: String,
    o_email: String,
    o_address: String,
    o_other: String,
    is_special_color: {
        type: Boolean,
        default: false,
    },
    is_special_shield: {
        type: Boolean,
        default: false,
    },
    is_special_text_shield: {
        type: Boolean,
        default: false,
    },
    special_shield: String,
    special_text_shield: String,
    special_color: String,
    is_shader_banner: {
        type: Boolean,
        default: false
    }

});

module.exports = mongoose.model('Members', schema);
