const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

// function generateVerificationToken(userId) {
//     const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
//     return token;
// }

// async function sendVerificationEmail(email, token) {
//     const transporter = nodemailer.createTransport({
//         service: 'laikji', // or your email service
//         auth: {
//             user: process.env.EMAIL_USERNAME,
//             pass: process.env.EMAIL_PASSWORD,
//         },
//     });

//     const verificationUrl = `http://yourdomain.com/verify-email?token=${token}`;

//     await transporter.sendMail({
//         from: 'joker@laikji.com',
//         to: email,
//         subject: 'تأكيد بريدكم الإلكتروني ',
//         html: `<p>Please verify your email by clicking the link below:</p>
//            <a href="${verificationUrl}">Verify Email</a>`,
//     });
// }
// async function sendPasswordResetEmail(email, token) {
//     console.log('sendeing reset password');
//     const resetUrl = `http://localhost:9600.com/admin/auth/reset-password?token=${token}`;
//     const transporter = nodemailer.createTransport({
//         service: 'gmail',
//         host: 'smtp.gmail.com',
//         port: 587,
//         secure: false,
//         auth: {
//             user: process.env.EMAIL_USERNAME, // Your Hotmail email
//             pass: process.env.EMAIL_PASSWORD, // Your Hotmail password
//         },
//     });

//     await transporter.sendMail({
//         from: process.env.EMAIL_USERNAME,
//         to: email,
//         subject: 'إعادة تعيين كلمة المرور',
//         html: `
//             <p>مرحبًا،</p>
//             <p>الرجاء الضغط على الرابط أدناه لإعادة تعيين كلمة المرور:</p>
//             <a href="${resetUrl}">إعادة تعيين كلمة المرور</a>
//             <p>إذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذا البريد.</p>
//         `,
//     });
// }
module.exports = { generateVerificationToken, sendVerificationEmail, sendPasswordResetEmail };
