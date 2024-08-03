//@ts-ignore
import { auth } from '@googleapis/drive';
import { Utils } from '../../';
import express from 'express'
//@ts-ignore
import jwt from 'jsonwebtoken'
import { AuthUser } from './model';

export type GoogleSigninConfig = {
    web: {
        client_id: string,
        project_id: string,
        client_secret: string,
        redirect_uris: string[],
        scopes: string[],

        private_key?: string
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

    function generateGoogleAuthUrl(authCallback: string, signin_callback?: string) {
        let scopesString = scopes.join(" ")
        let authUrl = oAuth2Client.generateAuthUrl({
            access_type: "offline",
            scope: scopesString,
            include_granted_scopes: true,
            redirect_uri: authCallback,
            state: Utils.encodeBase64(JSON.stringify({
                signin_callback
            }))
        });
        return authUrl
    }


    const router = express.Router()

    router.get('/signin', (req, res) => {
        const cbUrl = req.query.callback_url || req.query.signin_callback || req.query.returnUrl
        if (req.query.callback_url) {
            //@ts-ignore
            req.session.signin_callback = cbUrl
        }
        let googleAuthUrl = generateGoogleAuthUrl(callbackUrl, cbUrl as string)
        res.redirect(googleAuthUrl)
    })

    router.get('/callback', async (req, res) => {
        let code = req.query.code as string
        let state = JSON.parse(Utils.decodeBase64(req.query.state as string || '') || '{}')
        //@ts-ignore
        const returnUrl = state.signin_callback || req.session.signin_callback || default_signin_callback
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