// const jwt = require('jsonwebtoken');
// const nodemailer = require('nodemailer');

// function generateVerificationToken(userId) {
//     const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
//     return token;
// }

// async function sendVerificationEmail(email, token) {
//     const transporter = nodemailer.createTransport({
//         service: 'Gmail', // or your email service
//         auth: {
//             user: process.env.EMAIL_USERNAME,
//             pass: process.env.EMAIL_PASSWORD,
//         },
//     });

//     const verificationUrl = `http://yourdomain.com/verify-email?token=${token}`;

//     await transporter.sendMail({
//         from: 'your-email@example.com',
//         to: email,
//         subject: 'Email Verification',
//         html: `<p>Please verify your email by clicking the link below:</p>
//            <a href="${verificationUrl}">Verify Email</a>`,
//     });
// }
// async function sendPasswordResetEmail(email, token) {
//     const resetUrl = `http://yourdomain.com/reset-password?token=${token}`;
//     const transporter = nodemailer.createTransport({
//         service: 'Gmail', // or your email service
//         auth: {
//             user: process.env.EMAIL_USERNAME,
//             pass: process.env.EMAIL_PASSWORD,
//         },
//     });

//     await transporter.sendMail({
//         from: 'your-email@example.com',
//         to: email,
//         subject: 'Password Reset',
//         html: `<p>You requested to reset your password. Click the link below to reset it:</p>
//            <a href="${resetUrl}">Reset Password</a>`,
//     });
// }
// module.exports = { generateVerificationToken, sendVerificationEmail, sendPasswordResetEmail };
