const sharp = require('sharp')

const input = 'shot.jpg'
const output = 'shot_output.jpg'

const top = 373, left = 756, width = 600, height = 200;

exports.processImage = () => {

    sharp(input)
        .extract({ left, top, width, height })
        .toColorspace('b-w')
        .negate()
        .threshold(110)
        .resize(1500, null)
        .toFile(output);
}