const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config();
function generateVerificationToken(userId) {
    const token = jwt.sign({ userId }, 'catsandogs', { expiresIn: '1h' });
    return token;
}

async function sendPasswordResetEmail(email, token) {
    const resetUrl = `http://185.203.118.57:3000#/reset-password?token=${token}`;
    const transporter = nodemailer.createTransport({
        host: 'smtp.hostinger.com',
        port: 587,
        secure: false,
        auth: {
            user: 'joker@laikji.com',
            pass: '#2000Aammer',
        },
    });

    await transporter.sendMail({
        from: 'joker@laikji.com',
        to: email,
        subject: 'إعادة تعيين كلمة المرور',
        html: `
            <p>مرحبًا،</p>
            <p>الرجاء الضغط على الرابط أدناه لإعادة تعيين كلمة المرور:</p>
            <a href="${resetUrl}">إعادة تعيين كلمة المرور</a>
            <p>إذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذا البريد.</p>
        `,
    });
}
module.exports = { generateVerificationToken, sendPasswordResetEmail };
