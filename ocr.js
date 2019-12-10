var Tesseract = require('tesseract.js')
var filename = "shot_output.jpg"

exports.ocr = () => {

    Tesseract.recognize(filename).then(({ data: { text } }) => {
        console.log(text);
    })
}