
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
const sellPriceIncrement = 0.0005;

let isBuying = false;
let buyOrderConfirmed = false;
let buyOrderExists = false;
let isSelling = false;
let sellOrderConfirmed = false;
let sellOrderExists = false;
let buyPrice = 0;
let sellPrice = 0;
let minSellPrice = 0;
let profit = 0
let totalProfit = 0;
let invalidScrape = 0;
let noChange = 0;
let transactionInProgress = true;

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
            .resize(1600, null)
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

        if (imagesAreSame && transactionInProgress && noChange < 60) {
            noChange += 1;
            transactionInProgress = true;
            await sleep(500);
            continue;
        }

        noChange = 0;
        idle();

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

            if (!buyOrderExists) {
                console.log(chalk.green('BUY ORDER COMPLETE'))
                console.log(chalk.red(`SELL ORDER SUBMITTED ${sellPrice}`))
                isBuying = false;
                buyOrderConfirmed = false;
                isSelling = true;
                sellOrderConfirmed = true;
                sellInput(sellPrice.toString());
                // sellIncrement();
                sellPost();
                idle();
                await sleep(2000);
                continue;
            }

            // if the buy order has been pushed down the queue cancel and start again.
            // or if the max sell price is now below the min sell price for the buy order, start again.
            buyOrderPosition = buyOffers.indexOf(buyPrice);
            const quantity = buyOfferQuantity[buyOrderPosition];

            if (buyOrderExists) {
                const currentSellPrice = Math.round(sellOffers[0] * (1.0 - sellPriceIncrement));
                if (sellPrice != currentSellPrice) {
                    sellPrice = currentSellPrice;
                    profit = Math.round(sellPrice - buyPrice);
                    console.log(chalk.green(`Profit is now ${profit}`))
                }
            }

            if (buyOrderExists && (buyOrderPosition != 0 || sellPrice <= minSellPrice || (quantity && quantity != 1))) {
                console.log(chalk.magenta(`BUY ORDER CANCELLED.`));
                cancelBuyOrder();
                isBuying = false;
                buyOrderConfirmed = false;
            }

            if (buyOrderExists && buyOrderPosition == 0) {
                const closetOrderPrice = buyOffers[1];
                const percentageDiff = (buyPrice / closetOrderPrice) - 1.0;
                if (percentageDiff > 0.01) {
                    console.log(chalk.magenta(`BUY ORDER CANCELLED. BUYING FOR LOWER.`))
                    cancelBuyOrder();
                    isBuying = false;
                    buyOrderConfirmed = false;
                }
            }
        }


        if (valid && !isBuying && !isSelling) {
            const fees = 0.02;
            buyPrice = Math.round(buyOffers[0] * (1.0 + buyPriceIncrement));
            minSellPrice = Math.round(buyPrice * (1.0 + fees));
            sellPrice = Math.round(sellOffers[0] * (1.0 - sellPriceIncrement));
            profit = Math.round(sellPrice - buyPrice);
            console.log(chalk.grey(`Buy Offer ${buyOffers[0]} Sell offer ${sellOffers[0]}`))
            console.log(chalk.yellow(`Buy Price ${buyPrice} Sell Price ${sellPrice} Profit ${profit}`))

            if (profit > 0 && minSellPrice < sellPrice) {
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
            sellOrderExists = sellOffers.includes(sellPrice);

            if (!sellOrderExists) {
                console.log(chalk.red('SELL ORDER COMPLETE'))
                isBuying = false;
                buyOrderConfirmed = false;
                buyOrderExists = false;
                isSelling = false;
                sellOrderConfirmed = false;
                sellOrderExists = false;
                totalProfit += profit;
                transactionInProgress = false;
                console.log(chalk.magenta(`TOTAL PROFIT ${totalProfit}`))
                refreshPage();
                continue;
            }

            sellOrderPosition = sellOffers.indexOf(sellPrice);
            const quantity = sellOfferQuantity[sellOrderPosition]
            if (sellOrderExists && (sellOrderPosition != 0 || (quantity && quantity != 1))) {
                cancelSellOrder();
                isSelling = false;
                sellOrderConfirmed = false;
            }
        }

        idle();
    }
}
start();
