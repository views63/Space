const CJKSpace = require('./index.js');
var fs = require("fs");

let data = fs.readFileSync("2.txt", "utf-8");
console.log(data);
data = CJKSpace.MarkdownCJKSpace(data)
console.log(data);