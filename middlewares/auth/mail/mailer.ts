//@ts-ignore
import fs from 'fs';
import { EMAIL_TEMPLATE } from './email_template'
var nodemailer;
const replaceAll = function (str: string, match: string, replace: string) {
    return str.replace(new RegExp(match, 'g'), () => replace);
}

export type MailerConfig = {
    host: string;
    port: number;
    secure: boolean;
    service: string;
    senderName: string;
    email: string;
    password: string;
    resetlinkvalidityhrs: number;
    app?: string;
    company?: string;
    website?: string;
    privacy?: string;
    logo?: string;
    terms?: string;
    instagram?: string;
    cdn?: string;
    emailTemplateHtmlFile?: string;
}

export class Mailer {

    emailTransporter
    emailTemplateHtml: any
    config: MailerConfig
    constructor(mailConfig: MailerConfig) {
        if (!nodemailer) {
            nodemailer = require('nodemailer')
        }
        this.config = mailConfig
        this.emailTransporter = nodemailer.createTransport({
            host: mailConfig.host,
            port: mailConfig.port,
            // service: mailConfig.service,
            secure: mailConfig.secure,
            auth: {
                user: mailConfig.email,
                pass: mailConfig.password
            },
            debug: false,
            logger: false,
            tls: {
                rejectUnauthorized: false
            }
        });
    }

    getConfig(req?: any): MailerConfig {
        return this.config;
    }

    getEmailTemplate(req?: any) {
        if (this.emailTemplateHtml)
            return this.emailTemplateHtml
        this.emailTemplateHtml = this.getConfig(req).emailTemplateHtmlFile ? fs.readFileSync(this.getConfig(req).emailTemplateHtmlFile, 'utf-8') : EMAIL_TEMPLATE;
        this.emailTemplateHtml = this.emailTemplateHtml
            .replaceAll("{{email}}", this.getConfig(req).email)
            .replaceAll("{{appname}}", this.getConfig(req).app)
            .replaceAll("{{logo}}", this.getConfig(req).logo)
            .replaceAll("{{host}}", this.getConfig(req).website)
            .replaceAll("{{companyname}}", this.getConfig(req).company)
            .replaceAll("{{privacy}}", this.getConfig(req).privacy || (this.getConfig(req).website + "/toc.html"))
            .replaceAll("{{toc}}", this.getConfig(req).terms || (this.getConfig(req).website + "/privacy.html"))
            .replaceAll("{{terms}}", this.getConfig(req).terms || (this.getConfig(req).website + "/privacy.html"))
            .replaceAll("{{instagram}}", this.getConfig(req).instagram)
            .replaceAll("{{cdn}}", this.getConfig(req).cdn)

        this.emailTemplateHtml = this.emailTemplateHtml.split("{{body}}")

        return this.emailTemplateHtml;
    }

    async sendTextEmail(to: string, title: string, body: string, cc?: string, req?: any) {
        // If the body already contains HTML tags, don't convert newlines to <br>
        const hasHtml = /<[^>]+>/.test(body);
        const processedBody = hasHtml ? body : replaceAll(body, '\n', '<br>');
        let htmlBody = this.getEmailTemplate(req).join(processedBody);

        let mailOptions = {
            from: `'${this.getConfig(req).senderName}' <${this.getConfig(req).email}>`,
            to: to,
            subject: title,
            html: htmlBody,
            cc: cc
        };

        //send mail using below code
        await this.emailTransporter.sendMail(mailOptions)
            .then(info => {
                console.log('Mail sent: ' + info.response)
            })
            .catch(err => {
                console.log('Mail send failed', err)
            });

    }

    async sendWelcomeMail(to: string, req?: any) {

        await this.sendTextEmail(to,
            `Welcome to ${this.getConfig(req).app} !`,
            'Hope you have a great time !', undefined, req)
    }


    async sendResetPasswordMail(to: string, toName?: string, link?: string, req?: any) {

        await this.sendTextEmail(to,
            `Reset ${this.getConfig(req).app} Password link`,
            `<p>Dear ${toName},<br>
            We received request to reset your password. Click the link below to reset it.</p>
            <a href="${link}" target="_blank" rel="noopener noreferrer" style="display:block; padding:10px 16px; color:#ffffff; background-color:#2563EB; text-decoration:none; border-radius:6px; font-weight:600; font-family:Arial, Helvetica, sans-serif; width:max-content; margin:12px 0;">Reset Password</a>
            <p>If you did not request a password reset, please immediately report this email to us or contact support if you have questions.
            For further assistance, please reach out to via <a href="${this.getConfig(req).website}" target="_blank">our website</a></p>
            `, undefined, req)
    }

    async sendVerificationMail(to: string, toName?: string, link?: string, req?: any) {

        await this.sendTextEmail(to,
            `Verify your ${this.getConfig(req).app} account`,
            `<p>Dear ${toName},<br>
            Please verify your email address by clicking the link below:
            <a href="${link}" class="button">Verify Email</a>
            If you did not create an account with us, you can ignore this email.
            For further assistance, please reach out to via <a href="${this.getConfig(req).website}" target="_blank">our website</a></p>
            `, undefined, req)
    }

}
