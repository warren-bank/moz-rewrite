[
    {
        "url" : /\.(?:mp4|mp4v|mpv|m1v|m4v|mpg|mpg2|mpeg|xvid|webm|3gp|avi|mov|mkv|ogv|ogm|m3u8|mpd|ism(?:[vc]|\/manifest)?)(?:[\?#].*)?$/i,
        "headers" : function(){
            var url = request.uri.href
            log(url)
            log('https://warren-bank.github.io/crx-webcast-reloaded/external_website/index.html#/watch/' + base64_encode(url))
        }
    }
]
