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

    getEmailTemplate() {
        if (this.emailTemplateHtml)
            return this.emailTemplateHtml
        this.emailTemplateHtml = EMAIL_TEMPLATE;
        this.emailTemplateHtml = this.emailTemplateHtml
            .replaceAll("{{email}}", this.config.email)
            .replaceAll("{{appname}}", this.config.app)
            .replaceAll("{{logo}}", this.config.logo)
            .replaceAll("{{host}}", this.config.website)
            .replaceAll("{{companyname}}", this.config.company)
            .replaceAll("{{privacy}}", this.config.privacy || (this.config.website + "/toc.html"))
            .replaceAll("{{toc}}", this.config.terms || (this.config.website + "/privacy-policy.html"))
            .replaceAll("{{terms}}", this.config.terms || (this.config.website + "/privacy-policy.html"))
            .replaceAll("{{instagram}}", this.config.instagram)
            .replaceAll("{{cdn}}", this.config.cdn)

        this.emailTemplateHtml = this.emailTemplateHtml.split("{{body}}")

        return this.emailTemplateHtml;
    }

    async sendTextEmail(to: string, title: string, body: string, cc?: string) {
        let htmlBody = this.getEmailTemplate().join(replaceAll(body, '\n', '<br>'));

        let mailOptions = {
            from: `'${this.config.senderName}' <${this.config.email}>`,
            to: to,
            subject: title,
            html: htmlBody,
            cc: cc
        };

        //send mail using below code
        await this.emailTransporter.sendMail(mailOptions).catch(err => {
            console.log('Mail send failed', err)
        });

    }

    async sendWelcomeMail(to: string) {

        await this.sendTextEmail(to,
            `Welcome to ${this.config.app} !`,
            'Hope you have a great time !')
    }


    async sendResetPasswordMail(to: string, toName?: string, link?: string) {

        await this.sendTextEmail(to,
            `Reset ${this.config.app} Password link`,
            `<p>Dear ${toName},<br>
            We received request to reset your password. Click the link below to reset it.
            <a href="${link}" class="button">Reset Password</a>
            If you did not request a password reset, please immediately report this email to us or contact support if you have questions.
            For further assistance, please reach out to via <a href="${this.config.website}" target="_blank">our website</a></p>
            `)
    }

}
