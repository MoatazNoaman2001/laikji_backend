const mongoose = require('mongoose');
const { getNowDateTime } = require('../helpers/tools');
const Schema = mongoose.Schema;

const schema = Schema({
    serial: {
        type: String,
        default: '',
    },
    groupRef: {
        type: Schema.Types.ObjectId,
        ref: 'Groups',
    },
    parentRef: {
        type: Schema.Types.ObjectId,
        ref: 'Rooms',
    },
    meetingRef: {
        type: Schema.Types.ObjectId,
        ref: 'Rooms',
    },
    active: {
        type: Boolean,
        default: true,
    },
    name: String,
    code: String,
    title: {
        type: String,
        default: '',
    },
    description: {
        type: String,
        default: '',
    },
    ad_text: {
        type: String,
        default: 'هنا يوجد اعلان نصي',
    },
    welcome: {
        type: Object,
        default: {
            img: '',
            text: 'welcome',
            direction: 'center',
            color: '0|0|0',
        },
    },
    mic: {
        mic_permission: { type: Number, default: 0 },
        talk_dur: { type: [Number], default: [300, 300, 300, 300, 300] },
        mic_setting: { type: [Boolean], default: [false, true, true, false] },
        shared_mic_capacity: { type: Number, default: 3 },
    },
    owner: {
        type: Object,
        default: {
            name: 'no name',
            email: 'no email',
        },
    },
    icon: {
        type: String,
        default: '',
    },
    isGold: {
        type: Boolean,
        default: false,
    },
    isSpecial: {
        type: Boolean,
        default: false,
    },
    isMeeting: {
        type: Boolean,
        default: false,
    },
    meetingPassword: {
        type: String,
        default: '0000',
    },
    outside_style: {
        type: Object,
        default: {
            background: '255|255|255',
            font_color: '0|0|0',
        },
    },
    private_status: {
        type: Number,
        default: 1, //(0: none;) (1: all;) (2: members & admins;) (3: admins only;)
    },
    lock_status: {
        type: Number,
        default: 0, //(0: none;) (1: all;) (2: members & admins;)
    },
    allow_send_imgs: {
        type: Number,
        default: 0, // 0 false 1 true
    },
    lock_msg: String,
    inside_style: {
        type: Object,
        default: {
            background_1: '56|70|20',
            background_2: '55|60|30',
            border_1: '0|0|0',
            font_color: '0|0|0',
        },
    },
    startDate: {
        type: Date,
        default: getNowDateTime,
    },
    endDate: {
        type: Date,
        default: getNowDateTime,
    },
    latestBackup: String,
    o_name: String,
    o_phone: String,
    o_email: String,
    o_address: String,
    o_other: String,
    capacity: {
        type: Number,
        default: 10,
    },
    master_count: {
        type: Number,
        default: 0,
    },
    super_admin_count: {
        type: Number,
        default: 0,
    },
    admin_count: {
        type: Number,
        default: 0,
    },
    member_count: {
        type: Number,
        default: 0,
    },
    max_speakers_count: {
        type: Number,
        default: 1,
    },
    max_speaker_time: {
        type: Number,
        default: 10,
    },
    max_speaker_count: {
        type: Number,
        default: 2,
    },
    hold_mic: {
        type: Boolean,
        default: false,
    },
    update_time: {
        type: Boolean,
        default: true,
    },
    opened_time: {
        type: Boolean,
        default: true,
    },
});

module.exports = mongoose.model('Rooms', schema);
