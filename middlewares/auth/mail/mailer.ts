import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

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
    instagram?: string;
    cdn?: string;
}

export class Mailer {

    emailTransporter
    emailTemplateHtml: any
    config: MailerConfig
    constructor(mailConfig: MailerConfig) {
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
        this.emailTemplateHtml = fs.readFileSync(path.join(__dirname, './email_template.html')).toString();
        this.emailTemplateHtml = this.emailTemplateHtml
            .replaceAll("{{email}}", this.config.email)
            .replaceAll("{{appname}}", this.config.app)
            .replaceAll("{{host}}", this.config.website)
            .replaceAll("{{companyname}}", this.config.company)
            .replaceAll("{{privacy}}", this.config.website + "/toc.html")
            .replaceAll("{{toc}}", this.config.website + "/privacy-policy.html")
            .replaceAll("{{instagram}}", this.config.instagram)
            .replaceAll("{{cdn}}", this.config.cdn)

        return this.emailTemplateHtml;
    }

    async sendTextEmail(to: string, title: string, body: string, cc?: string) {
        let htmlBody = this.getEmailTemplate();

        let mailOptions = {
            from: `'${this.config.senderName}' <${this.config.email}>`,
            to: to,
            subject: title,
            html: htmlBody.replace("{{body}}", replaceAll(body, '\n', '<br>')),
            cc: cc
        };
        //@ts-ignore
        var mailresult = await this.emailTransporter.sendMail(mailOptions);
    }

    async sendWelcomeMail(to: string) {

        await this.sendTextEmail(to,
            `Welcome to ${this.config.app} !`,
            'Hope you have a great time !')
    }


    async sendResetPasswordMail(to: string, toName?: string, link?: string) {

        await this.sendTextEmail(to,
            `Reset ${this.config.app} Password link`,
            `Hey ${toName} ! \n Please follow the link to reset your password. The link will expire in 24 hrs . ${link}`)
    }

}