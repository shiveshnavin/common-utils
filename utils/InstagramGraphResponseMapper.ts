//@ts-nocheck
// import Source from './source.json'
// import Target from './target.json'

import bigInt from "big-integer";


var lower = 'abcdefghijklmnopqrstuvwxyz';
var upper = lower.toUpperCase();
var numbers = '0123456789'
var ig_alphabet = upper + lower + numbers + '-_'
var bigint_alphabet = numbers + lower


export class InstagramGraphResponseMapper {

    public static toShortcode(longid: string) {
        var o = bigInt(longid).toString(64)
        return o.replace(/<(\d+)>|(\w)/g, (m, m1, m2) => {
            return ig_alphabet.charAt((m1)
                ? parseInt(m1)
                : bigint_alphabet.indexOf(m2))
        });
    }

    public static fromShortcode(shortcode: string) {
        var o = shortcode.replace(/\S/g, m => {
            var c = ig_alphabet.indexOf(m)
            var b = bigint_alphabet.charAt(c)
            return (b != "") ? b : `<${c}>`
        })
        return bigInt(o, 64).toString(10)
    }



    public static mapGraphResponseToUser(
        Source: any
    ) {

        let Target: any = {
            pk: Source.id,
            username: Source.username,
            full_name: Source.full_name,
            is_private: Source.is_private,
            profile_pic_url: Source.profile_pic_url,
            is_business: Source.is_business_account
        }
        Object.assign(Target, Source)
        Target.media_count = Source.edge_owner_to_timeline_media?.count
        Target.following_count = Source.edge_follow?.count
        Target.follower_count = Source.edge_followed_by?.count
        Target.account_type
        Target.hd_profile_pic_url_info = {
            url: Source.profile_pic_url_hd
        }

        return Target
    }

    public static mapGraphResponseToMedia(
        Source: any
    ) {
        let Target: any = {}
        let edge_media_to_caption = Source?.edge_media_to_caption?.edges.at(0)?.node
        Target.caption = {
            pk: Source.id,
            created_at: edge_media_to_caption?.created_at,
            text: edge_media_to_caption?.text
        }

        Target.code = Source.shortcode
        switch (Source.__typename) {
            case "GraphVideo":
                Target.media_type = 2;
                break;
            case "GraphImage":
                Target.media_type = 1
                break;
            case "GraphSidecar":
                Target.media_type = 8
                break
        }

        Target.comment_count = Source.edge_media_to_parent_comment?.count
        Target.like_count = Source.edge_media_preview_like?.count
        Target.image_versions2 = {
            candidates: Source.display_resources?.map((dp: any) => {
                return {
                    width: dp?.config_width,
                    height: dp?.config_height,
                    url: dp?.src
                }
            })
        }

        Target.video_duration = Source.video_duration
        if (Source.video_url) {
            Target.video_versions = [{
                "width": Source.dimensions?.width,
                "height": Source.dimensions?.height,
                "url": Source.video_url
            }]
        }

        Target.user = Source.owner
        Target.user.pk = Source.owner?.id
        Target.user.pk_id = Source.owner?.id

        return Target
    }

}