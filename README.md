# [moz-rewrite](https://github.com/warren-bank/moz-rewrite)

Firefox add-on that functions as a light-weight (pseudo) rules-engine for easily modifying HTTP headers in either direction

## Summary

* Swiss Army knife for anyone interested in writing rules to intercept and conditionally modify HTTP traffic
* a distinct set of rules are written for each:
  * (outbound) requests
  * (inbound) responses
* rules can:
  * add/edit/remove HTTP headers
  * cancel the request
  * redirect the request

## Features

* regex patterns are used to match rules against the requested URL
* rules are applied incrementally, until either:
  * all rules have been processed
  * a rule is marked as being final
* rules are declared within a well-defined data structure.<br>
  this data isn't JSON; it is evaluated as javascript.<br>
  as such, the following are allowed:
  * comments
  * regex patterns (shorthand syntax `//` or `new RegExp`)
  * functions
  * "immediately-invoked function expressions" (aka: "self-executing anonymous functions")
* where a function is present, it will be called each time the rule is evaluated.
  * rules are evaluated for every request and/or response.
  * when functions are called, there will be contextual variables as well as helper functions in scope.
  * the contextual variables will allow the function to return a value that is dependent upon the state of the request/response.
  * the helper functions provide a library for tasks that are commonly used to generate HTTP header values.
* where an "immediately-invoked function expression" is present, the javascript will only be evaluated once.
  * this occurs when the rules are read from an external file and evaluated into a javascript array of rule objects.
  * when this evaluation occurs, there is no contextual request or response.. so there are no contextual variables in scope.
  * however, the same helper functions that are always available to functions (that are defined within the rules data set) will also be available at the time that the rules data set is initialized/evaluated.

## Contextual Variables <sub>(in scope when functions are called)</sub>

  * _both requests and responses_
    * `request.original_uri` = {}<br>
      keys:
      * `href`: [string] full URI
      * `protocol`: [string] examples: [`http:`,`https:`,`file:`]
      * `username`: [string]
      * `password`: [string]
      * `host`: [string]
      * `port`: [string]
      * `path`: [string]
      * `query`: [string]
      * `hash`: [string]
      * `file_ext`: [string]
    * `request.uri` = {}

        >  <sub>same keys as: `request.original_uri`</sub>
    * `request.referrer` = {}

        >  <sub>same keys as: `request.original_uri`</sub>
    * `request.method` [string]
    * `request.headers` = {}
    * `request.headers.unmodified` = {}<br>
      hash of all HTTP headers in original/unmodified request
    * `request.headers.updated` = {}<br>
      hash of all HTTP headers that the rules array data set (for requests) has incrementally modified at the current point of rules processing.
      * this hash is empty before any rules are processed.
      * as rules are processed in sequential order, any rule that matches the requested URL may specify updated HTTP headers which will be applied to this hash object.
      * when rule processing is completed, the final state of this hash will be applied to the HTTP request.
        * a `string` value will set/update the HTTP header corresponding to its hash key.
        * a `boolean` __false__ value will be ignored.
        * a __null__ value will remove the HTTP header corresponding to its hash key (if originally present).

  * _request only_

  * _response only_
    * `response.headers` = {}
    * `response.headers.unmodified` = {}<br>
      hash of all HTTP headers in original/unmodified response
    * `response.headers.updated` = {}<br>
      hash of all HTTP headers that the rules array data set (for responses) has incrementally modified at the current point of rules processing.

        >  <sub>see additional notes under: `request.headers.updated`</sub>
    * `response.status_code` [integer]
    * `response.charset` [string]
    * `response.content_length` [integer]
    * `response.content_type` [string]

## Helper Functions <sub>(in scope when functions are called)</sub>

  * _always available_
    * `atob(string_base64_encoded)`<br>
      decodes a string of data which has been encoded using base-64 encoding.
    * `base64_decode(string_base64_encoded)`

        >  <sub>alias for: `atob`</sub>
    * `btoa(string_value)`<br>
      creates a base-64 encoded ASCII string from a "string" of binary data.
    * `base64_encode(string_value)`

        >  <sub>alias for: `btoa`</sub>
    * `md2(string_value)`<br>
      returns the result of hashing the input string using the `md2` crypto hash function
    * `md5(string_value)`<br>
      returns the result of hashing the input string using the `md5` crypto hash function
    * `sha1(string_value)`<br>
      returns the result of hashing the input string using the `sha1` crypto hash function
    * `sha256(string_value)`<br>
      returns the result of hashing the input string using the `sha256` crypto hash function
    * `sha384(string_value)`<br>
      returns the result of hashing the input string using the `sha384` crypto hash function
    * `sha512(string_value)`<br>
      returns the result of hashing the input string using the `sha512` crypto hash function

  * _request only_
    * `redirectTo(string_URI)`
    * `cancel()`

  * _response only_

## Data Structure

* the same data structure (schema) applies to both requests and responses
* request and response data are defined separately
* the data structure is an array of objects, where each object represents a rule.
* each rule can have the following attributes:
  * `url` (required, `RegExp`)
  * `headers` (required, `object` or `function`):
    * key = name of HTTP header
    * value = determines what action to take
      * [`string`]:<br>
        new value of HTTP header
      * [`boolean`, value === __false__]:<br>
        ignore all previous rules for this HTTP header,<br>
        and leave the original value unmodified
      * [`object`, value === __null__]:<br>
        remove HTTP header from request/response
  * `stop` (optional, `boolean` or `function`):<br>
    when:
    * the `url` pattern of this rule matches the requested URL, _and_
    * processing of this rule is complete

    then:
    * [__false__, default]: process next rule (in array)
    * [__true__]: do not process any additional rules
* while each request/response is processed by its corresponding rules data set,<br>
  when a `url` pattern match occurs for a rule,<br>
  when either the `headers` or `stop` attribute of the matching rule object is declared as a javascript function:
  * contextual variables will be constructed and made availabe to the function that will convey information about the particular request/response being processed.
  * the function is expected to return the proper data type; otherwise, its output will be ignored.
* while rules are being processed, an internal list of updates is being created and incrementally updated.
* when the processing of rules is complete, this internal list of updates are applied to the request/response.

## Examples

1. sample _response_ rules data set:
  >
    ```javascript
[
    {
        "url" : /^.*$/,
        "headers" : {
            "Content-Security-Policy" : "default-src * 'self' data: mediastream:;frame-ancestors *",
            "X-Content-Security-Policy" : null,
            "X-Frame-Options" : null
        }
    },
    {
        "url" : new RegExp('^(file://|https?://localhost/).*$', 'i'),
        "headers" : {
            "Access-Control-Allow-Origin" : "*",
            "Access-Control-Allow-Methods" : "GET,POST"
        },
        "stop": true
    },
    {
        "url" : new RegExp('^https?://api\\.github\\.com/.*$', 'i'),
        "headers" : {
            "Content-Security-Policy" : null
        },
        "stop": true
    },
    {
        "url" : new RegExp('^https://.*(bank|billpay|checking).*$', 'i'),
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

  > #### notes:
  > * this example is applicable to a response data specification,<br>
      only because these particular HTTP headers are meaningful to the client (ie: browser) rather than the server.
  > * the syntax used to declare the regex patterns is inconsistent.
      * it uses shorthand when the pattern doesn't contain forward slash `/` characters, which would otherwise need to be escaped.
      * however, using the `RegExp` constructor means that the pattern needs to be passed as a string;
        and this would require that backslashes `\` be escaped.
      * so, do whatever you find is best for you.. just make sure that your code produces a valid javascript `RegExp` object after evaluation.
  > * usage pattern:
      * begins by setting rules that apply global defaults
      * then adds rules that apply special-case exceptions
      * finishes by setting rules that apply global exceptions

2. sample _response_ rules data set:
  >
    ```javascript
[
    {
        "url" : /^.*$/,
        "headers" : function(){
            var $headers = {};
            if (response.headers.unmodified['content-type'] !== 'text/html'){
                $headers = {
                    "Content-Security-Policy" : null,
                    "X-Content-Security-Policy" : null
                };
            }
            return $headers;
        }
    }
]
    ```

  > #### notes:
  > * the only rule declared in this example uses a function that is called for every response.
      * it uses the contextual variable: `response.headers`.
      * it's important to remember that some variables are only available in certain contexts.
        * for example, `response.headers` wouldn't make any sense in the context of processing an (outbound) HTTP request..
          since we couldn't possibly know the answer to a question we haven't asked yet.
        * referencing a variable that's undefined will throw an exception.
        * this exception will be caught, and nothing bad will happen..<br>
          however, none of your rules (in that particular data set) will be applied.
        * since requests and responses use separate data sets, an error in one won't effect the other.

## User Preferences

  * _HTTP Requests (outbound)_:
    * on/off toggle

      on: intercept _HTTP Requests_ and apply its corresponding set of rules<br>
      off: disable this feature entirely

      > default: on

    * Path to Rules File

      >  <sub>refer to __Comments / Implementation Notes__ for advanced usage</sub>

      > default: ''

    * Watch Interval (ms, 0 to disable)

      useful while writing/testing new rules.<br>
      this feature will watch the rules file for changes, and reload its contents as needed.

      > default: 0 (off)

  * _HTTP Responses (inbound)_:
    * on/off toggle

      on: intercept _HTTP Responses_ and apply its corresponding set of rules<br>
      off: disable this feature entirely

      > default: on

    * Path to Rules File

      >  <sub>refer to __Comments / Implementation Notes__ for advanced usage</sub>

      > default: ''

    * Watch Interval (ms, 0 to disable)

      useful while writing/testing new rules.<br>
      this feature will watch the rules file for changes, and reload its contents as needed.

      > default: 0 (off)

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
      * so.. if portability is a concern, then the following file paths should work nicely:
        * `{ProfD}/moz-rewrite/requests.js`
        * `{ProfD}/moz-rewrite/responses.js`
  * the addon will (optionally) watch these files for updates.
  * when a file path is changed (in addon preferences),<br>
    or a watched file path has been updated (identified by its _last modification date_):
    * the file contents are read into a string
    * the string is evaluated as javascript
    * the return value is validated for having the proper schema
    * the rules array is stored (in memory)
  * when a request/response observer is notified:
    * the corresponding rules array is processed, sequentially until complete
    * the list of updates are applied to the request/response
  * the heavy lifting is converting the javascript entered by the user in the rules files into (in-memory) data objects.
    * this occurs infrequently, only as-needed.
    * the size of the (in-memory) data objects will be very small.
    * the performance cost of calling functions within these data objects is trivial.
    * this cost is farther reduced by using a strategy that counts the number of functions within the rules array data set during its validation.
    * if there are no functions, then there's no need to create the contextual variables that would normally be available (in scope) to functions;
    * when it's appropriate to do so, eliminating this step makes the performance cost (of processing the corresponding rules array data set) extremely low.

## Security Considerations / Vectors of Attack:

  * In order for a blackhat (nefarious individual) to exploit [this addon](https://github.com/warren-bank/moz-rewrite), the following would need to occur:
    1. install the addon
    2. gain access to and modify some browser preferences
    3. save a (javascript) file to a known path on the file system

  * If a blackhat were to accomplish these "3 steps", among other things&hellip; they would be capable of the following:
    * forward a message back to themself (into the cloud) that contains:
      * a record of all requested domains along with their associated cookies
      * contents of files that are accessible from the file system
    * add/edit/delete files that are accessible from the file system

  * Pretty scary stuff&hellip; can this really happen?
    * first I need to say upfront that I'm _**NO SECURITY EXPERT**_&hellip;<br>
      please take anything I say here as my own personal opinions, and nothing more.
    * I can only see two ways that these "3 steps" could all occur:
      1. evil addon:
         * you intentionally install this (good) addon [step 1], since this step cannot be done silently
         * you also intentionally install a different (bad) addon, which would be able to accomplish [steps 2-3]
      2. evil roommate:
         * if another person were able to:
           * log onto your computer
           * load Firefox using your profile<br>
            <sub>( Firefox [supports multiple user profiles](https://support.mozilla.org/en-US/kb/profile-manager-create-and-remove-firefox-profiles), but [doesn't natively support password protecting access to using them](https://support.mozilla.org/en-US/questions/807379) )</sub>

           then this person would be free to configure your environment in a way that allows them to spy. (ie: all "3 steps")

## A fork that isn't a fork&hellip;
##### a spoon, maybe?

This [spoon](https://github.com/warren-bank/moz-rewrite-amo) is for [AMO](https://addons.mozilla.org/en-US/firefox/addon/rewrite-http-headers/), as well as a specific subset of users.

  * I made a [one-off fork](https://github.com/warren-bank/moz-rewrite-amo) (from [v1.01](https://github.com/warren-bank/moz-rewrite/tree/v1.01)) that is __so__ intentionally crippled that it doesn't even belong in this repo.
  * The reason behind doing so was the desire to host a version on [AMO](https://addons.mozilla.org/en-US/firefox/addon/rewrite-http-headers/).
  * The coding methodology that makes this tool so very powerful is, fundamentally, the strategic usage of the javascript `eval` statement.
  * AMO doesn't accept/host addons that include `eval` for their own reasons, which are grounded in security concerns&hellip; including those discussed above.
  * A subset of (less technical) users would probably never make use of any advanced scripting features.
    This group would likely prefer a version that doesn't expose them to __any__ possible security risk.

## License
  > [GPLv2](http://www.gnu.org/licenses/gpl-2.0.txt)
  > Copyright (c) 2014, Warren Bank
