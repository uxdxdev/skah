const robot = require("robotjs");
const screen = robot.getScreenSize();

const LOGIN_PAGE = {
    top: 558,
    left: 1252,
    width: 57,
    height: 50
}

const MARKET_PRICE_PAGE = {
    top: 404,
    left: 1142,
    width: 470,
    height: 154
}

// const LOGIN_BUTTON_WIDTH = 58;
// const LOGIN_BUTTON_HEIGHT = 50;

// const LOGIN_PAGE = {
//     top: screen.height / 2,
//     left: screen.width / 2 - LOGIN_BUTTON_WIDTH / 2,
//     width: LOGIN_BUTTON_WIDTH,
//     height: LOGIN_BUTTON_HEIGHT
// }

module.exports = {
    MARKET_PRICE_PAGE,
    LOGIN_PAGE
}