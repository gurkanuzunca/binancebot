const binance = require('node-binance-api');
const prompt = require('prompt');
const moment = require('moment');
const fs = require('fs');

const config = require('./config.json');

let stream;
let currency;
let sign;
let prices = [];
let limit = 25;
let increase = 0;
let buyPrice = 0;
let sellPrice = 0;
let highestPrice = 0;
let lowestPrice = 0;
let sum;
let avg;
let rate = [];

binance.options({
    'APIKEY': config.binance.apikey,
    'APISECRET': config.binance.apisecret
});

prompt.start();

prompt.get(['Currency'], function (err, result) {
    currency = result.Currency.toUpperCase();

    if (! fs.existsSync(config.log)){
        fs.mkdirSync(config.log);
    }

    stream = fs.createWriteStream(config.log +'/'+ currency +'.'+ moment().format('X') +'.log');
    console.log('Currency:', currency);

    connect();
});

let buy = function (current) {
    buyPrice = current.price;
    stream.write("+"+ buyPrice.toFixed(8) + "\n");

    sellPrice = 0;
    increase = 0;
    console.log('BUY', buyPrice.toFixed(8));
};

let sell = function (current) {
    sellPrice = current.price;

    let diff = ((buyPrice-sellPrice)*-1);
    stream.write("-"+ sellPrice.toFixed(8) + "\n");
    stream.write((diff >= 0 ? '+' : '') + diff.toFixed(8) + "\n----\n");

    buyPrice = 0;
    increase = 0;
    console.log('SELL', sellPrice.toFixed(8));
};

let connect = function () {
    binance.websockets.prevDay(currency, function(response) {
        let current = {
            price: parseFloat(response.close),
            sell: parseFloat(response.bestBid),
            buy: parseFloat(response.bestAsk)
        };

        if (prices.length === limit) {
            prices.shift();
        }

        /** Limite erişildiyse işlemi yap */
        if (prices.length === (limit-1)) {
            let past = prices[prices.length-1];
            let first = prices[0];

            /** Güncel fiyat bir önceki fiyattan farklı ise devam */
            if (current.price !== past.price) {
                prices.push(current);

                sum = prices.reduce((sum, element) => element.price + sum, 0);
                avg = sum / prices.length;

                highestPrice = prices.reduce((price, element) => element.price > price ? element.price : price, 0);
                lowestPrice = prices.reduce((price, element) => element.price < price ? element.price : price, current.price);

                rate['CF'] = ((current.price - first.price) / first.price) * 100;
                rate['CP'] = ((current.price - past.price) / past.price) * 100;
                rate['CH'] = ((current.price - highestPrice) / highestPrice) * 100;
                rate['CL'] = ((current.price - lowestPrice) / lowestPrice) * 100;
                rate['HL'] = ((highestPrice - lowestPrice) / lowestPrice) * 100;
                rate['CB'] = buyPrice > 0 ? ((current.price - buyPrice) / buyPrice) * 100 : 0;


                /** Algo INTERVAL */
                if (current.price === highestPrice) {
                    increase++;
                    sign = '+';
                } else if (current.price === lowestPrice) {
                    increase--;
                    sign = '-';
                } else {
                    sign = '=';
                }

                if (increase > 25) {
                    if (buyPrice === 0) {
                        buy(current);
                    } else {
                        increase = 25;
                    }
                }

                /** Kar %5 ise sat. */
                if (buyPrice > 0 && rate['CB'] > 5) {
                    sell(current);
                }
                /** Zarar %5 ise sat. */
                if (buyPrice > 0 && rate['CB'] < -5) {
                    sell(current);
                }

                if (increase < -25) {
                    increase = -25;
                }

                console.log(
                    'Cur:', current.price.toFixed(8),
                    'First:', first.price.toFixed(8),
                    'High:', highestPrice.toFixed(8),
                    'Low:', lowestPrice.toFixed(8),
                    'C/F', (rate['CF'] >= 0 ? '+' : '') + rate['CF'].toFixed(2)+'%',
                    'C/P', (rate['CP'] >= 0 ? '+' : '') + rate['CP'].toFixed(2)+'%',
                    'C/H', (rate['CH'] >= 0 ? '+' : '') + rate['CH'].toFixed(2)+'%',
                    'C/L', (rate['CL'] >= 0 ? '+' : '') + rate['CL'].toFixed(2)+'%',
                    'H/L', (rate['HL'] >= 0 ? '+' : '') + rate['HL'].toFixed(2)+'%',
                    'C/B', (rate['CB'] >= 0 ? '+' : '') + rate['CB'].toFixed(2)+'%',
                    '-->', increase, '('+ sign +')'
                );
            }
        } else {
            prices.push(current);
        }
    });
};
