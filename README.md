# [moz-rewrite-amo](https://github.com/warren-bank/moz-rewrite-amo)

Firefox add-on that functions as a light-weight (pseudo) rules-engine for easily modifying HTTP headers in either direction

## Summary

* for security reasons, AMO (<b>a</b>ddons.<b>m</b>ozilla.<b>o</b>rg) generally won't accept an addon that uses the javascript `eval` statement
* [moz-rewrite](https://github.com/warren-bank/moz-rewrite) needs to use `eval`
  * conversion of the rules file contents into a data set
  * running functions within the data set (necessary for dynamic scoping)
* in order for other developers to know about this addon, it really needs to be hosted on AMO
* this project is a compromise
  * a slimmed-down version of [moz-rewrite](https://github.com/warren-bank/moz-rewrite)
  * most of its advanced functionality is removed
  * there's no potential for abuse, since the data will need to be proper JSON

## Contextual Variables

* none

## Helper Functions

* none

## Data Structure

* sample _request_ rules data set:

```javascript
[
{
    "url": "^.*$",
    "headers": {
        "X-Demo-Header-1": "Hello moz-safe-rewrite",
        "X-Demo-Header-2": "Goodbye moz-safe-rewrite"
    },
    "stop": true
}
]
```

* sample _response_ rules data set:

```javascript
[
{
    "url" : "^.*$",
    "headers" : {
        "Content-Security-Policy" : "default-src * 'self' data: mediastream:;frame-ancestors *",
        "X-Content-Security-Policy" : null,
        "X-Frame-Options" : null
    }
},
{
    "url" : "^(file://|https?://localhost/).*$",
    "headers" : {
        "Access-Control-Allow-Origin" : "*",
        "Access-Control-Allow-Methods" : "GET,POST"
    },
    "stop": true
},
{
    "url" : "^https?://api\\.github\\.com/.*$",
    "headers" : {
        "Content-Security-Policy" : null
    },
    "stop": true
},
{
    "url" : "^https://.*(bank|billpay|checking).*$",
    "headers" : {
        "Content-Security-Policy" : false,
        "X-Content-Security-Policy" : false,
        "X-Frame-Options" : false,
        "Access-Control-Allow-Origin" : false,
        "Access-Control-Allow-Methods" : false
    }
}
]
```

###### differences between this data structure and the format used by [moz-rewrite](https://github.com/warren-bank/moz-rewrite#user-content-data-structure):
  * the `url` regex pattern is stored in a string
  * `headers` is always a hash:

      >  [string] header name &rArr; [string, false, null] header value
  * `stop` (if present) must be a boolean

## License
  > [GPLv2](http://www.gnu.org/licenses/gpl-2.0.txt)
  > Copyright (c) 2014, Warren Bank
