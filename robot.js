const robot = require("robotjs");
// robot.setMouseDelay(300)

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
    robot.moveMouseSmooth(1337, 733);
    robot.mouseClick('left', true);
    robot.moveMouseSmooth(1500, 733);
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


