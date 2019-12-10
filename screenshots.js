const screenshot = require('screenshot-desktop')

const input = 'shot_test.png'

exports.takeScreenshot = () => {
    console.log('taking screeshot')
    screenshot({ filename: input }).then(() => console.log('done')).catch(err => console.log(err));
}

