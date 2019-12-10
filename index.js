
const sharp = require('sharp')
sharp.cache(false);

const tesseract = require('tesseract.js')
const screenshot = require('screenshot-desktop')
const chalk = require('chalk');
const fs = require('fs')

const robot = require("./robot");
const { marketTab, tradeTab, cancelBuyOrder, idle, buyInput, buyIncrement, buyPost, sellIncrement, sellInput, sellPost, refreshPage, cancelSellOrder } = robot;

const { imgDiff } = require('img-diff-js');


const top = 404, left = 1142, width = 461, height = 154;
const input = `shot.jpg`
const outputPrev = `shot_output_prev.jpg`
const output = `shot_output.jpg`
const buyPriceIncrement = 0.0005;
const sellPriceIncrement = 0.005;

let isBuying = false;
let buyOrderConfirmed = false;
let buyOrderExists = false;
let isSelling = false;
let sellOrderConfirmed = false;
let sellOrderExists = false;
let buyPrice = 0;
let maxSellPrice = 0;
let minSellPrice = 0;
let profit = 0
let totalProfit = 0;
let invalidScrape = 0;
let noChange = 0;

const isOffersValid = offers => offers.length == 5 && offers.every((v, i, a) => !i || a[i - 1] >= v);

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const start = async () => {
    while (true) {

        await screenshot({ filename: input });

        await sharp(input)
            .extract({ left, top, width, height })
            .toColorspace('b-w')
            .negate()
            .threshold(110)
            .resize(1500, null)
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

        // copy to prev image
        fs.copyFileSync(output, outputPrev);

        if (imagesAreSame) {
            noChange += 1;
            if (noChange > 50) {
                idle();
                noChange = 0;
            }
            await sleep(1000);
            continue;
        }

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
                    const { is_numeric: isNumber, text: numberStr } = entry;
                    if (isNumber && RegExp("[,\/]").test(numberStr)) {
                        const number = parseInt(numberStr.replace(/,/g, ''), 10);

                        // get quantity
                        const quantityStrFirst = words[index + 1].text.replace(/x/g, '');
                        let quantity = undefined
                        if (quantityStrFirst != '') {
                            quantity = parseInt(quantityStrFirst, 10);
                        } else {
                            const quantityStrSecond = words[index + 2].text.replace(/x/g, '');
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

        if (!valid) {
            console.log(chalk.gray('Error image data invalid', valid, sellOffers, buyOffers))
            invalidScrape += 1;
            if (invalidScrape > 5) {
                console.log(chalk.gray('Exiting, too many invalid scrapes.'))
                return;
            }
            continue;
        }

        if (valid && buyOrderConfirmed) {
            buyOrderExists = buyOffers.includes(buyPrice)

            // if the buy order has been pushed down the queue cancel and start again.
            // or if the max sell price is now below the min sell price for the buy order, start again.
            buyOrderPosition = buyOffers.indexOf(buyPrice);
            const quantity = buyOfferQuantity[buyOrderPosition]
            if (buyOrderExists && (buyOrderPosition != 0 || maxSellPrice < minSellPrice || (quantity && quantity != 1))) {
                console.log(chalk.magenta(`BUY ORDER CANCELLED.`))
                cancelBuyOrder();
                isBuying = false;
                buyOrderConfirmed = false;
                continue;
            }

            if (buyOrderExists && buyOrderPosition == 0) {
                const closetOrderPrice = buyOffers[1];
                const percentageDiff = (buyPrice / closetOrderPrice) - 1.0;
                if (percentageDiff > 0.01) {
                    console.log(chalk.magenta(`BUY ORDER CANCELLED. BUYING FOR LOWER.`))
                    cancelBuyOrder();
                    isBuying = false;
                    buyOrderConfirmed = false;
                    // continue;
                }
            }


            if (!buyOrderExists) {
                console.log(chalk.green('BUY ORDER COMPLETE'))

                // sell CE for sell price
                console.log(chalk.red(`SELL ORDER SUBMITTED ${maxSellPrice}`))
                isBuying = false;
                buyOrderConfirmed = false;
                isSelling = true;
                sellOrderConfirmed = true;
                sellInput(maxSellPrice.toString());
                // sellIncrement();
                sellPost();
                idle();
                await sleep(2000);
                continue;
            }
        }


        if (valid && !isBuying && !isSelling) {
            const fees = 0.02;
            buyPrice = Math.round(buyOffers[0] * (1.0 + buyPriceIncrement));
            minSellPrice = Math.round(buyPrice * (1.0 + fees));
            maxSellPrice = Math.round(sellOffers[0] * (1.0 - sellPriceIncrement));
            const profitMargin = (maxSellPrice / buyPrice) - 1.0;

            profit = Math.round(maxSellPrice - buyPrice);
            console.log(chalk.grey(`Buy Offer ${buyOffers[0]} Sell offer ${sellOffers[0]}`))
            console.log(chalk.yellow(`Buy Price ${buyPrice} @ ${profitMargin.toFixed(2)} Sell Price ${maxSellPrice} : Profit ${profit}`))


            if (profit > 0 && minSellPrice < maxSellPrice) {
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


        if (valid && sellOrderConfirmed) {
            sellOrderExists = sellOffers.includes(maxSellPrice)
            sellOrderPosition = sellOffers.indexOf(maxSellPrice);
            const quantity = sellOfferQuantity[sellOrderPosition]
            if (sellOrderExists && (sellOrderPosition != 0 || (quantity && quantity != 1))) {
                cancelSellOrder();
                isSelling = false;
                sellOrderConfirmed = false;
                continue;
            }

            if (!sellOrderExists) {
                console.log(chalk.red('SELL ORDER COMPLETE'))
                isBuying = false;
                buyOrderConfirmed = false;
                buyOrderExists = false;
                isSelling = false;
                sellOrderConfirmed = false;
                sellOrderExists = false;
                totalProfit += profit;
                console.log(chalk.magenta(`TOTAL PROFIT ${totalProfit}`))
                refreshPage();
                console.log('Refreshing page...')
                await sleep(2000);
                console.log('Page refreshed.')
            }
        }

        idle();
    }
}
start();
