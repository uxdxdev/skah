
const sharp = require('sharp')
sharp.cache(false);

const tesseract = require('tesseract.js')
const screenshot = require('screenshot-desktop')
const chalk = require('chalk');
const fs = require('fs')

const robot = require("./robot");
const { marketTab, tradeTab, cancelBuyOrder, idle, buyInput, buyIncrement, buyPost, sellIncrement, sellInput, sellPost, refreshPage, cancelSellOrder, sleep, authenticate } = robot;

const { imgDiff } = require('img-diff-js');

const { MARKET_PRICE_PAGE } = require('./config');
const input = `shot.jpg`
const outputPrev = `shot_output_prev.jpg`
const output = `shot_output.jpg`
const buyPriceIncrement = 0.0002;
const sellPriceIncrement = 0.0002;

let isBuying = false;
let buyOrderConfirmed = false;
let buyOrderExists = false;
let isSelling = false;
let sellOrderConfirmed = false;
let sellOrderExists = false;
let buyPrice = 0;
let targetSellPrice = 0;
let minSellPrice = 0;
let totalProfit = 0;
let invalidScrape = 0;
let noChange = 0;
let currentSellPrice = 0;
let trades = 0;

const isOffersValid = offers => offers.length == 5 && offers.every((v, i, a) => !i || a[i - 1] >= v);

const reset = () => {
    isBuying = false;
    buyOrderConfirmed = false;
    buyOrderExists = false;
    isSelling = false;
    sellOrderConfirmed = false;
    sellOrderExists = false;
}

const start = async () => {
    while (true) {

        await screenshot({ filename: input });

        await sharp(input)
            .extract({
                left: MARKET_PRICE_PAGE.left,
                top: MARKET_PRICE_PAGE.top,
                width: MARKET_PRICE_PAGE.width,
                height: MARKET_PRICE_PAGE.height
            })
            .toColorspace('b-w')
            .negate()
            .threshold(70)
            .resize(2200, null)
            .toFile(output);

        // check if file exists
        // if not create it
        try {
            if (!fs.existsSync(outputPrev)) {
                fs.copyFileSync(output, outputPrev);
            }
        } catch (err) {
            console.error(err)
        }

        const { imagesAreSame } = await imgDiff({
            actualFilename: outputPrev,
            expectedFilename: output,
            options: {
                threshold: 0.9
            }
        });

        fs.copyFileSync(output, outputPrev);

        if (noChange > 30) {
            noChange = 0;
            idle();
        }

        if (imagesAreSame && (isBuying || isSelling)) {
            noChange += 1;
            // console.log(chalk.yellow(`No change in ${noChange} checks`))
            await sleep(500);
            continue;
        }

        console.log(chalk.yellow('Change detected. Scanning...'))
        idle();
        noChange = 0;
        console.time('ocr');
        const { valid, buyOffers, buyOfferQuantity, sellOffers, sellOfferQuantity } = await tesseract.recognize(output).then(({ data }) => {
            const { lines } = data;
            let valid = false;
            let buyOffers = []
            let buyOfferQuantity = []
            let sellOffers = []
            let sellOfferQuantity = []
            lines.forEach(line => {
                const { words } = line;
                words.forEach((entry, index) => {
                    const { is_numeric: isNumber, text: numberStr } = entry || { is_numeric: false, text: '' };
                    if (isNumber && RegExp("[,\/]").test(numberStr)) {
                        const number = parseInt(numberStr.replace(/,/g, ''), 10);

                        // get quantity 
                        const quantityStrFirst = words[index + 1] && words[index + 1].text && words[index + 1].text.replace(/x/g, '') || '';
                        let quantity = undefined
                        if (quantityStrFirst != '') {
                            quantity = parseInt(quantityStrFirst, 10);
                        } else {
                            const quantityStrSecond = words[index + 2] && words[index + 2].text && words[index + 2].text.replace(/x/g, '') || '';
                            quantity = parseInt(quantityStrSecond, 10);
                        }


                        if (buyOffers.length <= sellOffers.length) {
                            buyOffers.push(number)
                            buyOfferQuantity.push(quantity)
                        } else {
                            sellOffers.push(number)
                            sellOfferQuantity.push(quantity)
                        }
                    }
                })
            })


            sellOffers.reverse()
            valid = isOffersValid(buyOffers) && isOffersValid(sellOffers)
            sellOffers.reverse()
            return { valid, buyOffers, buyOfferQuantity, sellOffers, sellOfferQuantity }
        });
        console.timeEnd('ocr');

        if (!valid) {
            console.log(chalk.gray('Error image data invalid', valid, sellOffers, buyOffers))
            invalidScrape += 1;
            if (invalidScrape > 1) {
                invalidScrape = 0;
                console.log(chalk.gray('May have been logged out, logging back in...'));
                await authenticate();
                console.log(chalk.gray('Authenticated.'));
            }
            continue;
        }

        invalidScrape = 0;
        currentSellPrice = Math.round(sellOffers[0] * (1.0 - sellPriceIncrement));

        // BUY
        if (valid && isBuying && buyOrderConfirmed) {
            buyOrderExists = buyOffers.includes(buyPrice)

            if (!buyOrderExists) {
                console.log(chalk.green('BUY ORDER COMPLETE'))
                isBuying = false;
                buyOrderConfirmed = false;

                // clear any sell orders that may have been made manually
                cancelSellOrder();

                // start selling
                isSelling = true;
                sellOrderConfirmed = true;
                sellInput(targetSellPrice.toString());
                // sellIncrement();
                sellPost();
                console.log(chalk.red(`SELL ORDER SUBMITTED ${targetSellPrice}`))
                idle();
                await sleep(2000);
                continue;
            }


            // update the target sell price while buying in progress
            if (buyOrderExists) {
                if (targetSellPrice != currentSellPrice) {
                    targetSellPrice = currentSellPrice;
                }
            }

            buyOrderPosition = buyOffers.indexOf(buyPrice);
            const quantity = buyOfferQuantity[buyOrderPosition];

            if (buyOrderExists && (buyOrderPosition != 0 || targetSellPrice <= minSellPrice || (quantity && quantity != 1))) {
                cancelBuyOrder();
                console.log(chalk.magenta(`BUY ORDER CANCELLED.`));
                isBuying = false;
                buyOrderConfirmed = false;
            }


            if (buyOrderExists && buyOrderPosition == 0) {
                const closetOrderPrice = buyOffers[1];
                const percentageDiff = (buyPrice / closetOrderPrice) - 1.0;
                if (percentageDiff > 0.01) {
                    cancelBuyOrder();
                    console.log(chalk.magenta(`BUY ORDER CANCELLED. BUYING FOR LOWER.`))
                    isBuying = false;
                    buyOrderConfirmed = false;
                    continue;
                }
            }
        }


        // SELL
        if (valid && isSelling && sellOrderConfirmed) {
            sellOrderExists = sellOffers.includes(targetSellPrice);

            if (!sellOrderExists) {
                const fees = 0.02;
                const returnOnSale = (targetSellPrice * (1.0 - fees));
                const profitThisTrade = Math.round(returnOnSale - buyPrice);
                console.log(chalk.red(`SELL ORDER COMPLETE. PROFIT ${profitThisTrade}`))
                trades += 1;
                reset();
                totalProfit += profitThisTrade;
                console.log(chalk.magenta(`# OF TRADES ${trades} TOTAL PROFIT ${totalProfit}`))

                // if (trades >= 50) {
                //     console.log('Max trades reached.');
                //     return;
                // }

                refreshPage();
                await sleep(500);
                continue;
            }

            sellOrderPosition = sellOffers.indexOf(targetSellPrice);
            const quantity = sellOfferQuantity[sellOrderPosition]
            if (sellOrderExists && targetSellPrice > minSellPrice && (sellOrderPosition != 0 || (quantity && quantity != 1))) {
                cancelSellOrder();
                console.log(chalk.magenta(`SELL ORDER CANCELLED.`));
                await sleep(1000);
                const updatedSellPrice = currentSellPrice > minSellPrice ? currentSellPrice : minSellPrice;
                targetSellPrice = updatedSellPrice;
                sellInput(updatedSellPrice.toString());
                // sellIncrement();
                sellPost();
                console.log(chalk.red(`SELL ORDER SUBMITTED ${updatedSellPrice}`))
                idle();
                await sleep(2000);
                continue;
            }

            if (sellOrderExists && sellOrderPosition == 0) {
                const closetOrderPrice = sellOffers[1];
                const percentageDiff = (targetSellPrice / closetOrderPrice) - 1.0;
                if (percentageDiff > 0.01) {
                    cancelSellOrder();
                    console.log(chalk.magenta(`SELL ORDER CANCELLED. SELLING FOR HIGHER.`))
                    await sleep(1000);
                    const updatedSellPrice = currentSellPrice > minSellPrice ? currentSellPrice : minSellPrice;
                    targetSellPrice = updatedSellPrice;
                    sellInput(updatedSellPrice.toString());
                    // sellIncrement();
                    sellPost();
                    idle();
                    await sleep(2000);
                    continue;
                }
            }
        }


        // INIT
        if (valid && !isBuying && !isSelling) {
            const fees = 0.02;
            buyPrice = Math.round(buyOffers[0] * (1.0 + buyPriceIncrement));
            minSellPrice = Math.round(buyPrice * (1.0 + fees));
            targetSellPrice = Math.round(sellOffers[0] * (1.0 - sellPriceIncrement));
            const returnOnSale = (targetSellPrice * (1.0 - fees));
            const profit = Math.round(returnOnSale - buyPrice);
            console.log(chalk.grey(`Buy Offer ${buyOffers[0]} Sell offer ${sellOffers[0]}`))
            console.log(chalk.yellow(`Buy Price ${buyPrice} Min Sell Price ${minSellPrice} Target Sell Price ${targetSellPrice} Profit ${profit}`))

            if (profit > 0 && minSellPrice < targetSellPrice) {
                // buy CE
                console.log(chalk.green(`BUY ORDER SUBMITTED ${buyPrice}`))
                isBuying = true;
                buyOrderConfirmed = true;
                buyInput(buyPrice.toString());
                // buyIncrement();
                buyPost();
                idle();
                await sleep(2000);
                continue;
            } else {
                console.log(chalk.magenta(`No profit or selling price is too low, searching...`))
            }
        }
    }
}
start();
