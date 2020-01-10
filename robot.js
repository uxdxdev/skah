const robot = require("robotjs");
// robot.setMouseDelay(300)
const screen = robot.getScreenSize();

const sharp = require('sharp')
sharp.cache(false);

const tesseract = require('tesseract.js')
const screenshot = require('screenshot-desktop')
const { LOGIN_PAGE } = require('./config');

exports.marketTab = (amount) => {
    robot.moveMouseSmooth(843, 399);
    robot.mouseClick('left');
}

exports.tradeTab = (amount) => {
    robot.moveMouseSmooth(843, 366);
    robot.mouseClick('left');
}

exports.cancelBuyOrder = (amount) => {
    robot.moveMouseSmooth(1289, 698);
    robot.mouseClick('left');
}

exports.idle = () => {
    robot.moveMouseSmooth(1350, 800);
    robot.mouseClick('left', true);
    robot.moveMouseSmooth(1450, 800);
    robot.mouseClick('left', true);
}

exports.buyInput = (amount) => {
    robot.moveMouseSmooth(1115, 640);
    robot.mouseClick('left');
    robot.mouseClick('left');
    robot.mouseClick('left');

    robot.keyTap("backspace");
    robot.keyTap("backspace");
    robot.keyTap("backspace");
    robot.keyTap("backspace");
    robot.typeString(amount);
}

exports.buyIncrement = (amount) => {
    robot.moveMouseSmooth(1253, 635);
    robot.mouseClick('left');
}

exports.buyPost = () => {
    robot.moveMouseSmooth(1345, 642);
    robot.mouseClick('left');
}


exports.sellInput = (amount) => {
    robot.moveMouseSmooth(1500, 640);
    robot.mouseClick('left');
    robot.mouseClick('left');
    robot.mouseClick('left');

    robot.keyTap("backspace");
    robot.keyTap("backspace");
    robot.keyTap("backspace");
    robot.keyTap("backspace");
    robot.typeString(amount);
}

exports.sellIncrement = (amount) => {
    robot.moveMouseSmooth(1619, 635);
    robot.mouseClick('left');
}

exports.sellPost = () => {
    robot.moveMouseSmooth(1716, 642);
    robot.mouseClick('left');
}

exports.refreshPage = () => {
    this.tradeTab();
    this.marketTab();
}

exports.cancelSellOrder = (amount) => {
    robot.moveMouseSmooth(1655, 698);
    robot.mouseClick('left');
}

exports.login = () => {
    // robot.moveMouseSmooth(screen.width / 2, screen.height / 2 + 20);
    robot.moveMouseSmooth(1276, 567);
    robot.mouseClick('left');
}

exports.selectCharacter = () => {
    robot.moveMouseSmooth(1015, 555);
    robot.mouseClick('left');
}

exports.goToHaven = () => {
    robot.moveMouseSmooth(1835, 240);
    robot.mouseClick('left');
}

exports.goToSupplyDepot = () => {
    robot.moveMouseSmooth(1840, 497);
    robot.mouseClick('left');
}

exports.sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

exports.authenticate = async () => {
    this.idle();

    const loginSnapshot = 'login.jpg'
    const loginSnapshotOutput = 'login_output.jpg'

    await screenshot({ filename: loginSnapshot });

    await sharp(loginSnapshot)
        .extract({
            left: LOGIN_PAGE.left,
            top: LOGIN_PAGE.top,
            width: LOGIN_PAGE.width,
            height: LOGIN_PAGE.height
        })
        .toColorspace('b-w')
        // .negate()
        .threshold(80)
        .resize(1000, null)
        .toFile(loginSnapshotOutput);

    let onLoginScreen = false;
    await tesseract.recognize(loginSnapshotOutput).then(({ data }) => {
        const { lines } = data;
        lines.forEach(line => {
            const { words } = line;
            words.forEach((entry, index) => {
                const { text } = entry || { text: '' };
                if (RegExp("[logon\/]").test(text.toLowerCase())) {
                    onLoginScreen = true;
                }
            })
        })
    });

    if (!onLoginScreen) {
        return;
    }

    this.login();

    await this.sleep(10000);

    this.selectCharacter();

    await this.sleep(10000);

    this.goToHaven();

    await this.sleep(60000);

    this.goToSupplyDepot();

    await this.sleep(5000);

    this.marketTab();

    await this.sleep(500);

    return new Promise(resolve => {
        resolve();
    })
}

