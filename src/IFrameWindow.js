// Copyright (c) Brock Allen & Dominick Baier. All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

import Log from './Log';

const DefaultTimeout = 10000;

export default class IFrameWindow {

    constructor(params) {
        Log.debug("IFrameWindow.ctor");

        this._promise = new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });

        this._boundMessageEvent = this._message.bind(this);
        window.addEventListener("message", this._boundMessageEvent, false);
        
        this._frame = window.document.createElement("iframe");

        // shotgun approach
        this._frame.style.visibility = "hidden";
        this._frame.style.position = "absolute";
        this._frame.style.display = "none";
        this._frame.style.width = 0;
        this._frame.style.height = 0;
        if (params.originUrl) {
            this._frame.name = params.originUrl;
        }

        window.document.body.appendChild(this._frame);
    }

    navigate(params) {
        Log.debug("IFrameWindow.navigate");

        if (!params || !params.url) {
            this._error("No url provided");
        }
        else {
            let timeout = params.silentRequestTimeout || DefaultTimeout;
            Log.debug("Using timeout of:", timeout);
            this._timer = window.setTimeout(this._timeout.bind(this), timeout);
            this._frame.src = params.url;
        }
        
        return this.promise;
    }

    get promise() {
        return this._promise;
    }

    _success(data) {
        this._cleanup();

        Log.debug("Successful response from frame window");
        this._resolve(data);
    }
    _error(message) {
        this._cleanup();

        Log.error(message);
        this._reject(new Error(message));
    }

    close() {
        this._cleanup();
    }

    _cleanup() {
        if (this._frame) {
            Log.debug("IFrameWindow._cleanup");

            window.removeEventListener("message", this._boundMessageEvent, false);
            window.clearTimeout(this._timer);
            window.document.body.removeChild(this._frame);

            this._timer = null;
            this._frame = null;
            this._boundMessageEvent = null;
        }
    }

    _timeout() {
        Log.debug("IFrameWindow._timeout");
        this._error("Frame window timed out");
    }

    _message(e) {
        Log.debug("IFrameWindow._message");

        if (this._timer &&
            e.source === this._frame.contentWindow &&
            e.data.type && e.data.type === "signinSilentResponse"
        ) {
            let url = e.data.url;
            if (url) {
                this._success({ url: url });
            }
            else {
                this._error("Invalid response from frame");
            }
        }
    }

    get _origin() {
        return location.protocol + "//" + location.host;
    }

    static notifyParent(url) {
        Log.debug("IFrameWindow.notifyParent");

        if (window.parent && window !== window.parent) {
            url = url || window.location.href;
            if (url) {
                Log.debug("posting url message to parent");

                const originUrl = window.name;
                if (originUrl) {
                    window.parent.postMessage({type: 'signinSilentResponse', url: url}, `${originUrl}`);
                    return;    
                } 
              
                // protocol = document.referrer ? document.referrer.split('//')[0] : location.protocol;

                const protocol = location.protocol;
                const host = location.host;
                
                window.parent.postMessage({type: 'signinSilentResponse', url: url}, `${protocol}//${host}`);
            }
        }
    }
}
