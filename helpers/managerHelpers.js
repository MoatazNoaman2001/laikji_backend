const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config();
function generateVerificationToken(userId) {
    const token = jwt.sign({ userId }, 'catsandogs', { expiresIn: '1h' });
    return token;
}

async function sendPasswordResetEmail(email, token) {
    console.log('sendeing reset password');
    const resetUrl = `http://185.203.118.57:3000/#/reset-password?token=${token}`;
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: 'ameera.gharibeh@gmail.com',
            pass: 'hwlt zzld osep tvew',
        },
    });

    await transporter.sendMail({
        from: 'ameera.gharibeh@gmail.com',
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
