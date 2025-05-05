// JSONP helper
export function getJSONP(url) {
    return new Promise((resolve, reject) => {
        const callbackName = "jsonp_callback_" + Math.round(100000 * Math.random());
        const timeout = setTimeout(() => {
            reject(new Error('JSONP request timed out'));
            delete window[callbackName];
            document.removeChild(script);
        }, 5000);

        window[callbackName] = function(data) {
            clearTimeout(timeout);
            resolve(data);
            delete window[callbackName];
            document.body.removeChild(script);
        };

        const script = document.createElement("script");
        script.src = `${url}&callback=${callbackName}`;
        document.body.appendChild(script);
    });
}