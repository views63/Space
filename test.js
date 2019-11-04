const CJKSpace = require('./index.js');
var fs = require("fs");

let data = fs.readFileSync("2.txt", "utf-8");

// let s= data.split("\n")
// console.log(data);
data = CJKSpace.MarkdownCJKSpace(data)
console.log(data);