import express, { Express } from 'express'
import * as bodyParser from 'body-parser'
import session from 'express-session'
import { MultiDbORM } from 'multi-db-orm'
import { Utils } from '../../utils/Utils'
import { ApiResponse } from './model'
import _ from 'lodash'
import { AuthUser } from './model'

export * from './model'

export function createAuthMiddleware(
    db: MultiDbORM,
    app: Express,
    skipAuthRoutes: string[] = [],
    loginUser?: (email: string, password: string, id?: string) => Promise<AuthUser | undefined>,
    saveUser?: (user: AuthUser, req: Express.Request, res: Express.Response) => Promise<AuthUser>,
    logLevel: 0 | 1 | 2 | 3 | 4 = 0) {
    if (!db) {
        throw new Error('db must not be non-null')
    }

    const authApp = express.Router()

    let secret = Utils.getKeySync('auth.secret')
    if (!secret) {
        secret = Utils.generateRandomID()
        Utils.logPlain(`"auth.secret" used by jwt signing and session signing not found in config.json. Using random: ${secret}`)
    }

    function isSessionInitialized() {
        const middleware = app._router.stack;
        for (const layer of middleware) {
            if (layer.handle && layer.handle.name === 'session') {
                return true;
            }
        }
        return false;
    }

    if (!isSessionInitialized()) {
        app.use(session({
            secret: secret,
            resave: false,
            saveUninitialized: false
        }));
    }


    skipAuthRoutes.push('/auth/login')
    authApp.use(bodyParser.urlencoded())
    authApp.use(bodyParser.json())
    authApp.use((req, res, next) => {
        if (skipAuthRoutes?.some((route) => { return req.path.match(route) })) {
            if (logLevel > 4) {
                Utils.logPlain('Skipping auth check for ', req.path)
            }
        } else {
            let authorization: string = (req.headers['authorization'] || req.query.authorization) as string
            if (authorization) {
                authorization = authorization.split(" ")[0]
                //todo auth
                next()
            } else {
                res.status(401).send(ApiResponse.notOk(`Missing authorization in headers`))
            }

        }
    })


    const TABLE_USER = 'users'
    const PASSWORD_HASH_LEN = 20
    const hashPasswords = Utils.getKeySync('auth.plain_text_password')


    loginUser = loginUser || async function loginUser(email: string, password: string, id?: string): Promise<AuthUser | undefined> {
        let hashPassword = Utils.generateHash(password, PASSWORD_HASH_LEN)
        if (hashPasswords) {
            hashPassword = password
        }
        let filter: any = {
            password: hashPassword
        }
        if (email) {
            filter.email = email
        }
        if (id) {
            filter.id = id
        }
        const user = await db.getOne(TABLE_USER, filter)
        if (user != undefined) {
            return user
        }
        return undefined
    }

    authApp.post('/auth/signup', async (req, res) => {
        const [email, password, id] = [req.body.email, req.body.password, req.body.id]
        //@ts-ignore
        let user: any = await loginUser(email, password, id)
        if (user) {
            Object.assign(user, req.body)
        } else {
            user = req.body
            if (_.isEmpty(user.email) || _.isEmpty(user.password)) {
                return res.send(ApiResponse.notOk('email, password cannot be empty'))
            }
            if (!user.id) {
                user.id = Utils.generateUID(user.email)
            }
        }
        if (user.password && !hashPasswords) {
            user.password = Utils.generateHash(user.password, PASSWORD_HASH_LEN)
        }
        if (saveUser) {
            saveUser(user, req, res)
        } else {
            await db.insert(TABLE_USER, user)
            delete user.password
            res.send(ApiResponse.ok(user))
        }
    })

    authApp.post('/auth/login', async (req, res) => {
        const [email, password, id] = [req.body.email, req.body.password, req.body.id]
        //@ts-ignore
        let user = await loginUser(email, password, id)
        if (user) {
            res.send(ApiResponse.ok(user))
        } else {
            res.status(401).send(ApiResponse.notOk('User not found or the credentials are incorrect'))
        }
    })


    return authApp
}