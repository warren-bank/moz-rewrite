# [moz-rewrite](https://github.com/warren-bank/moz-rewrite)

Firefox add-on that functions as a light-weight (pseudo) rules-engine for easily modifying HTTP headers in either direction

## Summary

* Swiss Army knife for anyone interested in writing rules to intercept and conditionally modify HTTP traffic
* a distinct set of rules are written for each:
  * (outbound) requests
  * (inbound) responses
* rule sets are described using a JSON format
* rule sets are stored in external files, and specified by path
* paths may be specified relative to "special directories" to enable portability<br>
  <sub>(refer to __Comments / Implementation Notes__ for documentation)</sub>
* external rules files can (optionally) be watched for updates

## Data Structure

* the same data structure (JSON schema) applies to both requests and responses
* the data structure is an array of objects
* each object represents a rule,<br>
  and may include the following attributes:
  * `url` (required, `string`)
    * contains a regular expression pattern
  * `headers` (required, `object`):
    * key = name of HTTP header
    * value = determines what action to take
      * [`string`]:<br>
        new value of HTTP header
      * [`boolean`, value === __false__]:<br>
        ignore all previous rules for this HTTP header,<br>
        and leave the original value unmodified
      * [`object`, value === __null__]:<br>
        remove HTTP header from request/response
  * `stop` (optional, `boolean`):<br>
    when:
    * the `url` pattern of this rule matches the requested URL, _and_
    * processing of this rule is complete

    then:
    * [__false__, default]: process next rule (in array)
    * [__true__]: do not process any additional rules
* while rules are being processed, an internal list of updates is being created and incrementally updated.
* when the processing of rules is complete, this internal list of updates are applied to the request/response.

## Simple Examples

* sample _request_ rule(s):

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

  > _notes:_
  > * analogous to: [this _moz-rewrite_ example](https://github.com/warren-bank/moz-rewrite/tree/js/Cu.evalInSandbox/master#user-content-simple-examples), which includes javascript comments

* sample _response_ rule(s):

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

  > _notes:_
  > * analogous to: [a portion of this _moz-rewrite_ recipe](https://github.com/warren-bank/moz-rewrite/blob/js/data/recipe-book/response/disable%20CSP.js)
    * mentioned as a solution to issue(s):
      * [_HTTP Archive Viewer issue &#35;1_](https://github.com/warren-bank/moz-harviewer/issues/1)
      * [_JSON-DataView issue &#35;5_](https://github.com/warren-bank/moz-json-data-view/issues/5#issuecomment-63533063)
      * [_JSON-DataView issue &#35;7_](https://github.com/warren-bank/moz-json-data-view/issues/7#issuecomment-64692997)

## More Complicated Examples

* a collection of various interesting rules and useful examples has been dubbed the _recipe book_
* it can be found in its own branch of this repo, named: [_json/data/recipe-book_](https://github.com/warren-bank/moz-rewrite/tree/json/data/recipe-book)
* users are encouraged to contribute (via push request) additional _recipe_ examples

## User Preferences

* _HTTP Requests (outbound)_:
  * Enabled
    > default: on

    on/off toggle
    * on:<br>intercept _HTTP Requests_ and apply its corresponding set of rules
    * off:<br>disable this feature entirely

  * Path to Rules File
    > default: ''

    >  <sub>refer to __Comments / Implementation Notes__ for advanced usage</sub>

  * Watch Interval (ms, 0 to disable)
    > default: `0` (off)

    useful while writing/testing new rules.<br>
    this feature will watch the rules file for changes, and reload its contents as needed.

* _HTTP Responses (inbound)_:
  * Enabled
    > default: on

    on/off toggle
    * on:<br>intercept _HTTP Responses_ and apply its corresponding set of rules
    * off:<br>disable this feature entirely

  * Path to Rules File
    > default: ''

    >  <sub>refer to __Comments / Implementation Notes__ for advanced usage</sub>

  * Watch Interval (ms, 0 to disable)
    > default: `0` (off)

    useful while writing/testing new rules.<br>
    this feature will watch the rules file for changes, and reload its contents as needed.

## Hidden Preferences

* `extensions.Moz-Rewrite-JSON.debug`
  > default: `false`

  _boolean_
  * `true`:<br>enables debug log messages to be printed to the `Browser Console`
  * `false`:<br>suppresses these log messages

## Comments / Implementation Notes

  * data sets are stored in external files.<br>
    this allows them to be maintained using any text editor.

  * the addon asks to know the file path to each data set.<br>
    one for requests, one for responses.

  * there are two ways to specify a file path:
    * browse for file, which stores an absolute path.
    * manually enter the path, which is parsed in such a way that portable/relative paths are supported.<br>
      * when this path begins with one of the following special tokens,<br>
        the token will be replaced with the corresponding directory path.
      * the absolute path of these "special directories" may change from FF shutdown to startup,<br>
        but the relative path will remain valid.
      * these "special tokens/directories" include:
        * `{ProfD}`: <br>profile directory
        * `{CurProcD}`: <br>current working directory (usually the application's installation directory)
        * `{ProfDefNoLoc}`: <br>`%installation%/defaults/profile`
        * `{PrfDef}`: <br>`%installation%/defaults/pref`
        * `{Desk}`: <br>user's desktop directory
        * `{Home}`: <br>user's home directory
        * `{DfltDwnld}`: <br>default Downloads directory
        * `{TmpD}`: <br>operating system's temporary files directory
      * sample interpolation values:
        * Windows, [PortableApps](http://portableapps.com/apps/internet/firefox_portable):
          * `{ProfD}`: <br>`C:\PortableApps\Firefox\Data\profile`
          * `{CurProcD}`: <br>`C:\PortableApps\Firefox\App\firefox\browser`
          * `{ProfDefNoLoc}`: <br>`C:\PortableApps\Firefox\App\firefox\browser\defaults\profile`

              >  <sub>_(note: directory does not exist)_</sub>
          * `{PrfDef}`: <br>`C:\PortableApps\Firefox\App\firefox\defaults\pref`
          * `{Desk}`: <br>`REG QUERY "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders" /v Desktop`
          * `{Home}`: <br>`%USERPROFILE%`
          * `{DfltDwnld}`: <br>`%USERPROFILE%\Downloads`
          * `{TmpD}`: <br>`%TEMP%`
      * so.. if portability is a concern, then the following file/directory paths should work nicely:
          >  <sub>_(note: the specified paths must already exist; files/directories **won't** be created.)_</sub>

        * `{ProfD}/moz-rewrite-json/requests.json`
        * `{ProfD}/moz-rewrite-json/responses.json`

  * when enabled (in addon preferences), the addon will watch input data files for updates.
  * when the path to an input data file is changed (in addon preferences),<br>
    or an input data file having a watched path has been updated (identified by its _last modification date_):
    * the file contents are read into a string
    * the string is parsed as JSON
    * the return value is validated for having the proper schema
    * the rules array is stored (in memory)
  * when a request/response observer is notified:
    * the corresponding rules array is processed, sequentially until complete
    * the list of updates are applied to the request/response
  * the heavy lifting is converting the JSON entered by the user in the rules files into (in-memory) data objects.
    * this occurs infrequently, only as-needed.
    * the size of the (in-memory) data objects will be very small.

## Alternate Implementations / Branches

  * [`js/eval/master`](https://github.com/warren-bank/moz-rewrite/tree/js/eval/master):
    * rule data files contain javascript, and are evaluated using the `eval()` function
    * security context: _system_ principal
      * pros:
        * has the ability to run protected code from within user-defined functions
      * cons:
        * would (most likely) fail AMO review.<br>
          for security related considerations, they have a general policy to disallow any addon that uses the `eval()` function.

  * [`js/Cu.evalInSandbox/master`](https://github.com/warren-bank/moz-rewrite/tree/js/Cu.evalInSandbox/master) (_default_):
    * rule data files contain javascript, and are evaluated using the Mozilla `Cu.Sandbox` and `Cu.evalInSandbox` APIs
    * security context: _null_ principal
      * pros:
        * should pass AMO review
      * cons:
        * gives up the ability to run protected code from within user-defined functions

  * [`json/master`](https://github.com/warren-bank/moz-rewrite/tree/json/master) (_current_):
    * rule data files contain JSON, and are parsed using the native `JSON.parse()` function
      * pros:
        * would pass AMO review
      * cons:
        * gives up the ability to declare user-defined functions within the rules data sets
        * gives up the ability to perform actions:
          * that are conditional on the state of contextual variables
          * that are only available through helper functions

## AMO

  * currently, [v1.03](https://github.com/warren-bank/moz-rewrite/releases/tag/json%2Fv1.03) of the [`json/master`](https://github.com/warren-bank/moz-rewrite/tree/json/master) branch is available on [AMO &#40;<b>a</b>ddons.<b>m</b>ozilla.<b>o</b>rg&#41;](https://addons.mozilla.org/en-US/firefox/addon/moz-rewrite-json/)

## License
  > [GPLv2](http://www.gnu.org/licenses/gpl-2.0.txt)
  > Copyright (c) 2014, Warren Bank
