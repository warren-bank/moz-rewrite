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

## Data Structure <sub>(examples)</sub>

* sample _request_ rule(s):

  > analogous to:
  > * [this _moz-rewrite_ example](https://github.com/warren-bank/moz-rewrite#user-content-simple-examples)

```javascript
[
    {
        "url" : "^.*$",
        "headers" : {
            "X-Custom-Sample-Header-01" : "Foo",
            "X-Custom-Sample-Header-02" : "Bar",
            "X-Custom-Sample-Header-03" : "Baz"
        }
    },
    {
        "url" : "^https:",
        "headers" : {
            "X-Custom-Sample-Header-01" : false,
            "X-Custom-Sample-Header-02" : false,
            "X-Custom-Sample-Header-03" : false
        },
        "stop": true
    },
    {
        "url" : "^.*$",
        "headers" : {
            "X-Custom-Sample-Header-01" : "Hello",
            "X-Custom-Sample-Header-03" : false
        }
    }
]
```

* sample _response_ rule(s):

  > analogous to:
  > * [a portion of this _moz-rewrite_ recipe](https://github.com/warren-bank/moz-rewrite/blob/data/recipe-book/response/disable%20CSP.js)

  > mentioned as a solution to issue(s):
  > * [_HTTP Archive Viewer_ issue: 1](https://github.com/warren-bank/moz-harviewer/issues/1)
  > * [_JSON-DataView_ issue: 5](https://github.com/warren-bank/moz-json-data-view/issues/5#issuecomment-63533063)
  > * [_JSON-DataView_ issue: 7](https://github.com/warren-bank/moz-json-data-view/issues/7#issuecomment-64692997)

```javascript
[
    {
        "url" : "#(?:[^/,]+[/,])*(?:HTTP-Archive-Viewer|JSON-DataView)(?:[/,]|$)",
        "headers" : {
            "Content-Type"              : "application/json",
            "Content-Disposition"       : null,
            "Content-Security-Policy"   : null,
            "X-Content-Security-Policy" : null
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
