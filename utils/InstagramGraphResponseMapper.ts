
// import Source from './source.json'
// import Target from './target.json'

export class InstagramGraphResponseMapper {

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
                    width: dp.config_width,
                    height: dp.config_height,
                    url: dp.src
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
        Target.user.pk = Source.owner.id
        Target.user.pk_id = Source.owner.id

        return Target
    }

}