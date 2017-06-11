const Config = require('config'),
    debug = require('debug')('main'),
    currencies = require('./currencies'),
    request = require('superagent'),
    Promise = require('bluebird'),
    nonce = require('nonce')(),
    crypto = require('crypto');

const getBalances = function () {
    const parameters = { command: 'returnBalances', nonce: nonce() };
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
                return resolve(res.body);
            })
    });
}


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

const sell = function (currency, bid, amount) {
    debug(`sell currency:${currency}, bid:${bid}, amount:${amount}`);
    const parameters = { command: 'sell', currencyPair: currency, rate: bid, amount: amount, nonce: nonce() };
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


Promise.all([
    getBalances(),
    getTicker()
]).then(function ([balances, ticker]) {
    return Promise.map(currencies, function(currency) {
        const ask = Number(ticker[currency].lowestAsk);
        const amount = balances[currency.match(/^BTC_(.+)$/)[1]];
        return sell(currency, ask, amount);
    }, { concurrency: 6 })
});