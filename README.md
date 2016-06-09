# o-chat [![Build Status](https://travis-ci.org/Financial-Times/o-chat.svg?branch=master)](https://travis-ci.org/Financial-Times/o-chat)

A simple chat client integrated with FT's membership systems. If you simply wish to add a chat client to some content this is the component to use.

## Contents

 * <a href="#prereq">Prerequisites</a>
 * <a href="#product">Adding chat to your product</a>
     * <a href="#decl">Declaratively</a>
     * <a href="#imper">Imperatvely</a>
 * <a href="#login">Login integration</a>
 * <a href="#events">Events</a>
 * <a href="#configuration">Global configuration</a>
     * <a href="#confdecl">Declaratively</a>
     * <a href="#confimper">Imperatively</a>
 * <a href="#jsapi">API</a>
     * <a href="#logging">Logging</a>
 * <a href="#sassapi">Sass API</a>
     * <a href="#fontfamily">Font family</a>
 * <a href="#browser">Browser support</a>
 * <a href="#core">Core/enhanced experience</a>

## <div id="prereq"></div> Prerequisites

* You must be on an FT.com domain or sub-domain for authentication to work

## <div id="product"></div> Adding chat to your product 
### <div id="decl"></div> Declaratively 
Use the following markup to enable chat:

```html
<div data-o-component="o-chat"
    id="{idOfTheElement}" 
    data-o-chat-auto-init="true|false" 
    data-o-chat-config-title="{article-title}" 
    data-o-chat-config-url="{page-url}" 
    data-o-chat-config-article-id="{article-id}">

        <div class="o--if-no-js">To participate in this chat, you need to upgrade to a newer web browser. <a href="http://help.ft.com/tools-services/browser-compatibility/">Learn more.</a></div>
</div>
```

 * `data-o-chat-config-title` the title of your article/post/thing
 * `data-o-chat-config-article-id` a unique id for your content, ideally a UUID for FT content
 * `data-o-chat-config-url` The canonical URL for your article/page/thing
 * `data-o-chat-config-{key}` for any other configuration
 * `data-o-chat-auto-init="false"` a module which has this attribute with a `false` value will not be initialized on the `o.DOMContentLoaded` event. This allows you to defer component initialisation.
 * `id` preferable to be set, but if missing it will be generated

If you defer initialising oChat by using `data-o-chat-auto-init="false"` then you can initialise the component by calling

```javascript
oChat.init();
```

### <div id="imper"></div> Imperatively 
Create an instance of the component with the parameters that are available:

```javascript
var oChatComponent = new oChat(document.querySelector('.chat'), {
    title: document.title,
    url: document.location.href,
    articleId: 'article-id',
    initExtension: {
        datetimeFormat: {
            minutesUntilAbsoluteTime: -1,
            absoluteFormat: 'MMM dd hh:mm a'
        }
    }
});
```

*The widget is automatically initialized, unless you specify in the configuration `autoInit: false`. In this case you can initialize this particular object at a later time by calling the following:*

```javascript
oChatComponent.init();
```


#### More about the constructor config object
The configuration object which is passed to the contructor can/should have the following fields:

###### Mandatory fields:

 - articleId: ID of the article, any string
 - url: canonical URL of the page
 - title: Title of the page
    
###### Optional fields:

 - order: This specifies how the widget is built. It can have two values:
    + normal: the commenting box is placed on top of the comment stream, and the comments are ordered as newest on top.
    + inverted: the commenting box is placed at the bottom of the comment stream, and the comments are ordered newest on bottom.
    
    Default value is 'normal'.
 - layout: Specifies the layout style of the widget. It can have two values:
    + normal: When placed in the main area of the page.
    + side: When placed in the side area of the page.
    
    Default value is 'side'.
 - datetimeFormat: How to format the timestamps. This is an object and has two fields:
    + minutesUntilAbsoluteTime: specifies after how many minutes to switch from relative time to absolute. If -1 is specified, the timestamps will be in the absolute format immediately. By default it is set to -1.
    + absoluteFormat: specifies the format with which the absolute timestamp is rendered. The default value `hh:mm a`. For more information about the possible values please visit: https://github.com/Financial-Times/o-date#o-dateformatdate-tpl
 - autoInit: if this is set to false, the object will be created, but it will not be initialized automatically (the DOM will not be populated, call to backend services will not be made). In this case you should call the `init` method on the instance when you want to initialize it.


## <div id="login"></div> Login integration 
Users need to have a valid FT session in order to post comments. The default behavior for a user without a valid session is to redirect to the FT's login page (https://registration.ft.com). However you may wish to integrate with your product's authentication process for a slicker UX in which case you can override the default behaviour.

 1. Override the `auth.loginRequiredDefaultBehavior` function

```javascript
oChat.auth.loginRequiredDefaultBehavior = function (evt) {
    // do login in a nicer way

    if (success) {
        callback();
    } else {
        callback(new Error("Failed")); // provide an error as parameter
    }
}
```

**Important: if the log in needs a page reload, don't call the callback at all (there's no success/failure, it's still pending)!**

 2. Add an event handler and stop executing other handlers

Example:

```javascript
oChat.on('auth.loginRequired', function (evt) {
    // the user is not logged in, but an action was performed within the comment widget that requires the user to be logged in

    login();
    if (loggedIn) {
        evt.detail.callback();
    } else if (loginRefused) {
        evt.detail.callback(new Error("Refused")); // provide an error as parameter
    } else if (loginFailure) {
        evt.detail.callback(new Error("Failed")); // provide an error as parameter
    }

    evt.stopImmediatePropagation();
});
```

**Important: if the log in needs a page reload, don't call the failure function!**



## <div id="events"></div> Events 
### Local events
These events are triggered on the instance's DOM element. 
All events have a payload of data which helps getting the ID of the instance and the instance object itself:

```javascript
{
    detail: {
        id: "idOfTheComponent",
        instance: componentInstance,
        data: {...} //data specific to the event
    }
}
```

##### oChat.widget.timeout
Triggered when loading the widget exceeded a given time.

##### oChat.error.init
Error while loading the initialization data and the comments.
Event detail data: error object/message.

##### oChat.error.widget
Triggered when any error appear (triggered together with the above mentioned error events).
Event detail data: error object/message.

##### oChat.data.init
Loaded when the initialization is finished and the necessary data is obtained.
Event detail data: initialization data in the following form:

```javascript
{
    "collection": {
        "unclassified": false,
        "collectionId": "91440735",
        "lastEvent": 1411541039265900,
        "comments": [{
            "parentId": "",
            "author": {
                "displayName": "roli main",
                "tags": ["FT"],
                "type": 1
            },
            "content": "<p>comment</p>",
            "timestamp": 1411541039,
            "commentId": "216743299",
            "visibility": 1
        }],
        "totalPages": "6"
    }
}
```

##### oChat.data.auth
The first time the auth object is loaded, it is broadcasted using this event. Event detail data: authentication and user detail data in the following form:

```javascript
{
    "token": "eyJhbGciOiJIUzI1NiJ9.eyJkb21haW4iOiJmdC0xLmZ5cmUuY28iLCJleHBpcmVzIjoxNDE3MTE2Nzk5LCJ1c2VyX2lkIjoiODk0ODc0MzkiLCJkaXNwbGF5X25hbWUiOiJyb2xpIG1haW4ifQ.maN1bKWvDQLA-mvgNp9lSKdI9Izj9rmX3XrEaVwUTNY",
    "expires": 1417116799,
    "displayName": "user pseudonym",
    "settings": {
        "emailcomments": "never",
        "emailreplies": "never",
        "emaillikes": "never",
        "emailautofollow": "off"
    }
}
```

##### oChat.widget.ready
The widget is ready to be rendered, the initialization process has finished.

##### oChat.widget.renderComplete
The UI is fully rendered.

##### oChat.tracking.postComment
A comment is posted.
Event detail data: (evt.detail.data)

```javascript
{
    collectionId: "119988167",
    comment: {
        author: {
            displayName: "roli second"
        },
        bodyHtml: "<p>test1533</p>",
        id: "286069596"
    }
}
```

##### oChat.tracking.deleteComment
A comment is deleted.
Event detail data: (evt.detail.data)

```javascript
{
    collectionId: "119988167",
    comment: {
        id: "286069596"
    }
}
```


### Global events
These events are triggered on the `body` element and are relevant to all oChat components on a page. They have the same format as the component level events: `oChat.nameOfTheEvent`, where `nameOfTheEvent` is one of the following below.

The payload data consists only of event specific data:

```javascript
{
    detail: {...} // event specific data
}
```

The events are the following:
##### oChat.auth.login
Triggered when a user is successfully logged in.
Payload is the jwt token with which the user is logged in.

##### oChat.auth.logout
Triggered when a user is logged out.

##### oChat.auth.loginRequired
Triggered on any activity which explicitly requires a logged in status. This could mean from the product perspective that the user is not logged in, or his/her login status expired (e.g. session expire).

The payload data contains an object with a callback function. Based on the outcome of the login process, one of these should be called by the handler.
**Important: if the log in needs a page reload, don't call the callback at all (there's no success/failure, it's still pending)!**

```javascript
oChat.on('auth.loginRequired', function (evt) {
    if (logInSuccess) {
        evt.detail.callback();
    }

    if (logInFails || logInRefused) {
        evt.detail.callback(new Error("Failed or cancelled."));
    }
});
```


## <div id="configuration"></div> Global configuration
This module uses global configuration. These are related configurations for Livefyre and authentication.

The default configuration is the production one:

```json
{
    "loginUrl": "https://accounts.ft.com/login",
    "livefyre": {
        "network": "ft.fyre.co"
    }
}
```

In order to change to the settings of the TEST environment, then this configuration should be used:

```json
{
    "loginUrl": "https://accounts-test.ft.com/login",
    "livefyre": {
        "network": "ft-1.fyre.co"
    }
}

```


There are two ways for changing the environment:

### <div id="confdecl"></div> Declaratively
In order to change the configuration, you can add a script tag in your page source with the format in the example below:

```javascript
<script data-o-chat-config type="application/json">
    {
        "loginUrl": "https://accounts-test.ft.com/login",
        "livefyre": {
            "network": "ft-1.fyre.co"
        }
    }
</script>
```

This configuration will be loaded on the `o.DOMContentLoaded` event.

**Also, don't forget to also add the configuration for `o-comment-api` (http://registry.origami.ft.com/components/o-comment-api#configuration).**



### <div id="confimper"></div> Imperatively
##### oChat.setConfig(config)
The configuration can be changed be using the `setConfig` static method. Calling this method with an object will merge the current configuration with the object specified (deep merge, primitive type values of the same key will be overwritten).

Example:

```javascript
oChat.setConfig({
    "loginUrl": "https://accounts-test.ft.com/login",
    "livefyre": {
        "network": "ft-1.fyre.co"
    }
});
```

*As on the event `o.DOMContentLoaded` the widgets declared in the DOM are automatically initialized, it is preferred to call this function **before** the `o.DOMContentLoaded` event is triggered.*


**Also, don't forget to also add the configuration for `o-comment-api` (http://registry.origami.ft.com/components/o-comment-api#configuration).**
The API of o-comment-api is available by using `oChat.dataService`.


## <div id="jsapi"></div> JavaScript API
### <div id="logging"></div> Logging
Logging can be enabled for debugging purposes. It logs using the global 'console' if available (if not, nothing happens and it degrades gracefully).
By default logging is disabled.

##### oChat.enableLogging()
This method enables logging of the module.

##### oChat.disableLogging()
This method disables logging of the module.

##### oChat.setLoggingLevel(level)
This method sets the logging level. This could be a number from 0 to 4 (where 0 is debug, 4 is error), or a string from the available methods of 'console' (debug, log, info, warn, error).
Default is 3 (warn).

## <div id="sassapi"></div> Sass API
### <div id="fontfamily"></div> Font-family
There is a default font-family set for o-chat: `BentonSans, sans-serif`
*Please note that the font itself is not loaded by this module, this should be done by the product.*

In order to override the default font, set a value for the following variable:

```scss
$o-chat-font-family: font1, font2;
```

## <div id="browser"></div> Browser support 
Works in accordance with our [support policy](https://docs.google.com/a/ft.com/document/d/1dX92MPm9ZNY2jqFidWf_E6V4S6pLkydjcPmk5F989YI/edit)

## <div id="core"></div> Core/Enhanced Experience
Only the enhanced experience offers any kind of commenting functionality. Core functionality will be added in due course.
