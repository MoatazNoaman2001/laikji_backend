const enums = require('../helpers/enums');
const roomModel = require('../models/roomModel');
const { getRoomData } = require('./mediasoupHelpers');
const { updateUser, getUserById } = require('./userHelpers');

let micAssigning = false; // Flag to prevent concurrent mic assignments
let activeTimers = new Map();
let currentSession = null;

function convertToMilliseconds(time) {
    const timeStr = time.toString();
    const length = timeStr.length;

    if (length >= 3) {
        const seconds = parseInt(timeStr.slice(-2)) || 0;
        const minutes = parseInt(timeStr.slice(0, -2)) || 0;
        return (minutes * 60 + seconds) * 1000;
    } else {
        return time * 1000;
    }
}
const getUserTimeLeft = (userType, xroom) => {
    const talk_dur = xroom.mic.talk_dur;
    switch (userType) {
        case enums.userTypes.guest:
            return convertToMilliseconds(talk_dur[0]);
        case enums.userTypes.member:
            return convertToMilliseconds(talk_dur[1]);
        case enums.userTypes.admin:
            return convertToMilliseconds(talk_dur[2]);
        case enums.userTypes.superadmin:
            return convertToMilliseconds(talk_dur[3]);
        case enums.userTypes.master:
            return convertToMilliseconds(talk_dur[4]);
        case enums.userTypes.mastermain:
            return convertToMilliseconds(talk_dur[4]);
        case enums.userTypes.mastergirl:
            return convertToMilliseconds(talk_dur[4]);
        case enums.userTypes.chatmanager:
            return convertToMilliseconds(talk_dur[4]);
        case enums.userTypes.root:
            return convertToMilliseconds(talk_dur[4]);
        default:
            return 0;
    }
};

const clearActiveTimers = (xroomId) => {
    console.log(`Clearing timers for room: ${xroomId}`);
    if (!activeTimers.has(xroomId)) {
        console.log('not found');
        return;
    }

    const roomTimers = activeTimers.get(xroomId);
    for (let [sessionId, { timer, interval }] of roomTimers.entries()) {
        clearTimeout(timer);
        clearInterval(interval);
    }
    activeTimers.delete(xroomId); // Remove all timers for the room
    currentSession = null;
    console.log(`Timers cleared for room: ${xroomId}`);
};

const releaseMic = async (roomInfo, userId, xroomId) => {
    try {
        if (roomInfo.speakers.has(userId)) {
            roomInfo.speakers.delete(userId);

            global.io.to(xroomId).emit('update-speakers', Array.from(roomInfo.speakers));

            console.log('Mic released. Attempting to assign to next user.');
            if (Array.from(roomInfo.speakers).length === 0) {
                assignMic(xroomId, roomInfo);
            }
        }
    } catch (err) {
        console.log('error from release mic ' + err.toString());
    }
};
const startInterval = async (time, xroomId, roomInfo) => {
    clearActiveTimers(xroomId);
    if (time > 0) {
        const timer = setTimeout(() => {
            console.log(`Time's up for user`);
            global.io.to(xroomId).emit('speaker-time-update', {
                userId: Array.from(roomInfo.speakers)[0],
                time: "Time's up",
            });
            for (const speakerId of Array.from(roomInfo.speakers)) {
                releaseMic(roomInfo, speakerId, xroomId);
            }
            console.log('clear timer from start interval *2');

            clearActiveTimers(xroomId);
        }, time * 1000);
        // Emit time updates every second
        const interval = setInterval(() => {
            time -= 1000;
            global.io.to(xroomId).emit('speaker-time-update', {
                userId: Array.from(roomInfo.speakers)[0],
                timeLeft: time / 1000,
            });
            if (time <= 0) {
                for (const speakerId of Array.from(roomInfo.speakers)) {
                    releaseMic(roomInfo, speakerId, xroomId);
                    console.log('clear timer from start interval *3');
                    clearActiveTimers(xroomId);
                }
            }
        }, 1000);
        if (!activeTimers.has(xroomId)) {
            activeTimers.set(xroomId, new Map());
        }
        activeTimers.get(xroomId).set(currentSession, { timer, interval });
    } else if (time == 0o0) {
        global.io.to(xroomId).emit('speaker-time-update', {
            userId: Array.from(roomInfo.speakers)[0],
            timeLeft: 'You have an open time',
        });
        if (!activeTimers.has(xroomId)) {
            activeTimers.set(xroomId, new Map());
        }
        activeTimers.get(xroomId).set(currentSession, 'open time');
    }
};

const assignMic = async (xroomId, roomInfo) => {
    try {
        const processedUsers = new Set(); // Track users skipped in this cycle

        if (micAssigning) {
            console.log('Mic is currently in use or being assigned. Please wait.');
            return;
        }

        micAssigning = true; // Lock mic assignment immediately
        try {
            while (roomInfo.micQueue.length > 0) {
                console.log('mic queue ' + roomInfo.micQueue);

                let nextUserId = roomInfo.micQueue.shift();
                global.io.to(xroomId).emit('mic-queue-update', roomInfo.micQueue);

                // console.log(
                //     `Attempting to assign mic to user: ${nextUserId}. Queue length: ${roomInfo.micQueue.length}`,
                // );

                const nextUser = await getUserById(nextUserId, xroomId);
                if (!nextUser || roomInfo.speakers.has(nextUserId)) {
                    console.log(
                        `User ${nextUserId} is already a speaker or not found. Skipping...`,
                    );
                    micAssigning = false;

                    processedUsers.add(nextUserId);
                    continue; // Remove the user and proceed to the next
                }

                if (nextUser.status == enums.statusTypes.out) {
                    // // console.log(
                    // //     ` User ${nextUserId} has status 'out'. Moving to second position in the queue.,`,
                    // // );
                    micAssigning = false;
                    processedUsers.add(nextUserId);
                    //  Place nextUserId at index 1 of the queue
                    if (roomInfo.micQueue.length > processedUsers.length) {
                        roomInfo.micQueue.splice(1, 0, nextUserId); // Insert at index 1
                    } else if (roomInfo.micQueue.length === processedUsers.length) {
                        roomInfo.micQueue = [];
                    }
                    global.io.to(xroomId).emit('mic-queue-update', roomInfo.micQueue);

                    continue;
                } else {
                    const room = await roomModel.findById(xroomId);
                    if (!room) {
                        console.log('Room not found. Exiting mic assignment.');
                        break;
                    }
                    //roomInfo.micQueue.shift();
                    global.io.to(xroomId).emit('mic-queue-update', roomInfo.micQueue);

                    await assignSpeaker(roomInfo, nextUserId, nextUser, room, xroomId);
                    break; // Exit loop after successfully assigning the mic
                }
            }

            if (roomInfo.micQueue.length === 0) {
                //  console.log('Mic queue is empty after processing all users.');
                global.io.to(xroomId).emit('mic-queue-update', roomInfo.micQueue); // Emit updated queue
            }
        } catch (error) {
            console.error(`Error in mic assignment: ${error.message}`);
        } finally {
            micAssigning = false;
            //  console.log('Mic assignment process completed.');
        }
    } catch (err) {
        console.log('Error from assign mic: ' + err.toString());
    }
};

const assignSpeaker = async (roomInfo, speakerId, speaker, newRoom, xroomId) => {
    try {
        roomInfo.speakers.add(speakerId);
        global.io.to(xroomId).emit('update-speakers', Array.from(roomInfo.speakers));

        // Remove user from micQueue after assigning mic to them
        if (roomInfo.micQueue && roomInfo.micQueue.includes(speakerId)) {
            roomInfo.micQueue = roomInfo.micQueue.filter((id) => id !== speakerId);
            global.io.to(xroomId).emit('mic-queue-update', roomInfo.micQueue);
        }
        console.log(`Mic assigned to user: ${speakerId}`);
        await updateUser(speaker, speaker._id, xroomId);

        const timeLeft = getUserTimeLeft(speaker.type, newRoom);
        currentSession = speakerId;
        startInterval(timeLeft, xroomId, roomInfo);
    } catch (err) {
        console.log('error from assign speaker ' + err.toString());
    }
};
const stopMic = async (userId, xroomId) => {
    const roomInfo = await getRoomData(xroomId);

    if (roomInfo.speakers.has(userId)) {
        releaseMic(roomInfo, userId, xroomId);
        if (Array.from(roomInfo.speakers).length == 0) {
            console.log('clear timer from admin disable mic');
            clearActiveTimers(xroomId);
        }
    } else if (Array.from(roomInfo.micQueue) && Array.from(roomInfo.micQueue).includes(userId)) {
        console.log('condition is true for mic queue ' + roomInfo.micQueue.length);

        console.log(`User ${userId} is already in the queue.`);
        roomInfo.micQueue = roomInfo.micQueue.filter((id) => id !== userId);
        global.io.to(xroomId).emit('mic-queue-update', roomInfo.micQueue);
    }
};
module.exports = {
    releaseMic,
    stopMic,
    clearActiveTimers,
    assignSpeaker,
    getUserTimeLeft,
    startInterval,
};
