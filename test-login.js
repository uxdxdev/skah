const robot = require('./robot');
const { authenticate } = robot;

const test = async () => {
    console.log('authenticating...')
    authenticate();
    console.log('authenticated')
}

test();