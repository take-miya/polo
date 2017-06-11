const Config = require('config'),
    debug = require('debug')('main'),
    currencies = require('./currencies'),
    request = require('superagent'),
    Promise = require('bluebird'),
    nonce = require('nonce')(),
    crypto = require('crypto');

const getTicker = function () {
    return new Promise(function (resolve, reject) {
        request.get(Config.api.url.public)
            .query({ command: 'returnTicker' })
            .end(function (err, res) {
                if (err) return reject(err);
                try {
                    return resolve(JSON.parse(res.text));
                } catch (err) {
                    return reject(err);
                }
            });
    });
}

const buy = function (currency, bid, amount) {
    debug(`buy currency:${currency}, bid:${bid}, amount:${amount}`);
    const parameters = { command: 'buy', currencyPair: currency, rate: bid, amount: amount, nonce: nonce() };
    let encodedData = '';
    const paramString = Object.keys(parameters).map(function (param) {
        return encodeURIComponent(param) + '=' + encodeURIComponent(parameters[param]);
    }).join('&');
    const sign = crypto.createHmac('sha512', Config.api.secret).update(paramString).digest('hex');
    debug('paramString', paramString);
    return new Promise(function (resolve, reject) {
        request.post(Config.api.url.trading)
            .set({ Key: Config.api.key, Sign: sign })
            .send(paramString)
            .end(function (err, res) {
                debug('err', err);
                if (err) return reject(err);
                debug('res', res.body);
                return resolve(res);
            })
    });
}

getTicker().then(function (ticker) {
    return Promise.map(currencies, function (currency) {
        const bid = Number(ticker[currency].highestBid);
        if (!bid) return Promise.reject(new Error(`Invalid bid, currency: ${currency}, ticker: ${JSON.stringify(ticker)}`));
        const amount = Config.params.totalBTC / bid;
        return buy(currency, bid.toFixed(6), amount.toFixed(6));
    }, { concurrency: 6 });
});

