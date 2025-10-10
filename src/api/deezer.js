// JSONP helper
export function getJSONP(url, timeout = 2000) {
    return new Promise((resolve, reject) => {
        const callbackName = "jsonp_callback_" + Math.round(100000 * Math.random());
        const timeoutId = setTimeout(() => {
            reject(new Error('JSONP request timed out'));
        }, timeout);

        window[callbackName] = function(data) {
            clearTimeout(timeoutId);
            resolve(data);
            delete window[callbackName];
            document.body.removeChild(script);
        };

        const script = document.createElement("script");
        script.src = `${url}&callback=${callbackName}`;
        document.body.appendChild(script);
    });
}