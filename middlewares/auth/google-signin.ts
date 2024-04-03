import { auth } from '@googleapis/drive';
import { Utils } from 'common-utils';
import express from 'express'
import jwt from 'jsonwebtoken'
import { AuthUser } from './model';

export type GoogleSigninConfig = {
    "web": {
        "client_id": string,
        "project_id": string,
        "client_secret": string,
        "redirect_uris": string[],
        "scopes": string[]
    }
}

/**
 * Returns the signin_result=success or failure and req.session.access_token saved
 * @param credsJson 
 * @param db 
 * @param app 
 * @param default_signin_callback 
 * @returns 
 */
export function GoogleSigninMiddleware(
    credsJson: GoogleSigninConfig,
    saveAndRedirectUser: (user: AuthUser, returnUrl: string, req: any, res: any) => void,
    default_signin_callback: string) {

    let { client_id, client_secret, project_id, scopes, redirect_uris } = credsJson.web
    let callbackUrl = process.env.NODE_ENV == 'development' ? redirect_uris[redirect_uris.length - 1] : redirect_uris[0]

    const oAuth2Client = new auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0]
    );

    function exchangeGoogleCode(uniqueCode: string) {
        let tokenResp = oAuth2Client.getToken(uniqueCode)
        return tokenResp
    }

    function generateGoogleAuthUrl(uniqueCode: string, callbackUrl: string) {
        let scopesString = scopes.join(" ")
        let authUrl = oAuth2Client.generateAuthUrl({
            access_type: "offline",
            scope: scopesString,
            include_granted_scopes: true,
            redirect_uri: callbackUrl,
            state: Utils.encodeBase64(JSON.stringify({
                project_id: project_id,
                uniqueCode: uniqueCode
            }))
        });
        return authUrl
    }


    const router = express.Router()

    router.get('/signin', (req, res) => {
        if (req.query.callback_url) {
            //@ts-ignore
            req.session.signin_callback = req.query.callback_url
        }
        let googleAuthUrl = generateGoogleAuthUrl(Utils.generateRandomID(), callbackUrl)
        res.redirect(googleAuthUrl)
    })

    router.get('/callback', async (req, res) => {
        let code = req.query.code as string
        //@ts-ignore
        const returnUrl = req.session.signin_callback || default_signin_callback
        try {
            let tokenresp = await exchangeGoogleCode(code)
            let idToken = tokenresp.tokens.id_token
            //@ts-ignore
            let { email, picture, name, sub } = jwt.decode(idToken)
            const usr = {
                name: name,
                avatar: picture,
                email: email
            }
            Utils.logPlainWithLevel(4, "Google signin success:", usr)
            saveAndRedirectUser(usr, returnUrl, req, res)
        } catch (e: any) {
            Utils.logPlainWithLevel(0, 'Error while exchanging google token.', e.message)
            let redr = Utils.appendQueryParam(returnUrl, 'result', 'failure')
            res.redirect(redr)
        }
    })

    return router

}