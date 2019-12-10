const robot = require("./robot");
const { cancelBuyOrder, idle, buyInput, buyIncrement, buyPost, sellIncrement, sellInput, sellPost, refreshPage, cancelSellOrder } = robot;

idle();
buyInput("7890");
buyInput("0");
buyPost();

sellInput("8324");
sellInput("0");
sellPost();

refreshPage();
idle();
