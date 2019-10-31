const marked = require("marked-ast");
const { toMarkdown } = require("marked-ast-markdown");


const CharCatalog = {
    CJK: 0,
    Space: 1,
    CJK_SYMBOLS: 2,
    Others: 3
}

/** chinese special character */
const CJK = "\u2e80-\u2eff\u2f00-\u2fdf\u3040-\u309f\u30a0-\u30fa\u30fc-\u30ff\u3100-\u312f\u3200-\u32ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff";

/** chinese symbols */
const SYMBOLS = /[，。、？“”‘’：；【】（）￥！~·]/;

/** matching the spaces in HTML tags */
const HTML_STRING = /<\S.+?>/

class CJKSpace {
    constructor() {
        this.version = '1.0.0';
    }

    /**
     * @method Using RegExp parse the type of string
     * @return {number} of space
     */
    GetCharCatalog(str) {
        if (str === " ") {
            return CharCatalog.Space;
        }

        if (str.match(SYMBOLS) !== null) {
            return CharCatalog.CJK_SYMBOLS;
        }

        if (str.match(new RegExp(`[${CJK}]`)) !== null) {
            return CharCatalog.CJK;
        }

        return CharCatalog.Others;
    }

    ProcessCJKSpace(data) {
        if (data.length < 2) {
            return data;
        }

        const html = data.match(HTML_STRING);
        if (html != null) {
            return data;
        }

        const maxIndex = data.length - 1;
        let newText = ""
        let currCatalog = this.GetCharCatalog(data[0]);

        for (let index = 0; index < maxIndex; index++) {
            const curr = data[index];
            const next = data[index + 1];
            const nextCatalog = this.GetCharCatalog(next);

            if (currCatalog === CharCatalog.Space && nextCatalog === CharCatalog.Space) {
                continue;
            }

            if (currCatalog === CharCatalog.Others && nextCatalog === CharCatalog.CJK) {
                newText += curr + " ";
                currCatalog = nextCatalog;
                continue;
            }

            if (currCatalog === CharCatalog.CJK && nextCatalog === CharCatalog.Others) {
                newText += curr + " ";
                currCatalog = nextCatalog;
                continue;
            }

            if (currCatalog === CharCatalog.Space && nextCatalog === CharCatalog.CJK_SYMBOLS) {
                currCatalog = nextCatalog;
                continue;
            }

            if (currCatalog === CharCatalog.CJK_SYMBOLS && nextCatalog === CharCatalog.Space) {
                newText += curr;
                index += 1;
                continue;
            }

            newText += curr;
            currCatalog = nextCatalog;
        }

        const tailCatalog = currCatalog;
        let tail = newText[newText.length - 1];
        currCatalog = this.GetCharCatalog(tail);
        tail = data[data.length - 1]

        if (currCatalog === CharCatalog.Space && tailCatalog === CharCatalog.Space) {
            return newText;
        }

        if (currCatalog === CharCatalog.Others && tailCatalog === CharCatalog.CJK) {
            newText += " " + tail;
            return newText;
        }

        if (currCatalog === CharCatalog.CJK && tailCatalog === CharCatalog.Others) {
            newText += " " + tail;
            return newText;
        }

        if (currCatalog === CharCatalog.Space && tailCatalog === CharCatalog.CJK_SYMBOLS) {
            newText = newText.substr(0, newText.length - 1) + tail;
            return newText;
        }

        if (currCatalog === CharCatalog.CJK_SYMBOLS && tailCatalog === CharCatalog.Space) {
            return newText;
        }

        newText += tail;
        return newText;
    }




    WalkTable(table) {
        for (let index = 0; index < table.content.length; index++) {
            const element = table.content[index];
            let tt = typeof (element)
            if (tt === "string") {
                table.content[index] = this.ProcessCJKSpace(element)
            } else {
                this.WalkTable(element)
            }
        }
    }

    ProcessNodeLeftCJKSpace(ast, index) {
        let curr = ast[index].text[0];
        let preElement = ast[index - 1];
        if (curr.length > 0 && preElement.length > 0) {
            const preTail = preElement[preElement.length - 1];
            const currHead = curr[0];
            const currCatalog = this.GetCharCatalog(currHead);
            const preCatalog = this.GetCharCatalog(preTail);
            if (preCatalog === CharCatalog.Others && currCatalog === CharCatalog.CJK) {
                ast[index - 1] = preElement + " ";
            }

            if (preCatalog === CharCatalog.CJK && currCatalog === CharCatalog.Others) {
                ast[index - 1] = preElement + " ";
            }
        }
    }

    ProcessNodeRightCJKSpace(ast, index) {
        let preElement = ast[index - 1].text[0];
        let curr = ast[index];
        if (curr.length > 0 && preElement.length > 0) {
            const preTail = preElement[preElement.length - 1];
            const currHead = curr[0];
            const currCatalog = this.GetCharCatalog(currHead);
            const preCatalog = this.GetCharCatalog(preTail);
            if (preCatalog === CharCatalog.Others && currCatalog === CharCatalog.CJK) {
                ast[index] = " " + curr;
            }

            if (preCatalog === CharCatalog.CJK && currCatalog === CharCatalog.Others) {
                ast[index] = " " + curr;
            }
        }
    }

    WalkArray(ast) {
        let preType;
        for (let index = 0; index < ast.length; index++) {
            const element = ast[index];
            let currType = element.type;
            // easy for undifiend type to boolean, by implicit conversion
            if (!currType) {
                ast[index] = this.ProcessCJKSpace(element)
            } else {
                this.walk(element)
            }

            if (index > 0 && !preType && (currType === "codespan" || currType === "strong" || currType === "em")) {
                this.ProcessNodeLeftCJKSpace(ast, index);
            }

            if (!currType && (preType === "codespan" || preType === "strong" || preType === "em")) {
                this.ProcessNodeRightCJKSpace(ast, index);
            }
            preType = currType;
        }
    }

    walk(ast) {
        const type = ast.type;
        switch (type) {
            case 'list':
                this.WalkArray(ast.body);
                break;

            case 'blockquote':
                this.WalkArray(ast.quote);
                break;

            case 'table':
                ast.header.forEach(h => WalkTable(h));
                ast.body.forEach(b => WalkTable(b));
                break;

            case (type !== "code" && type !== "hr"):
                this.WalkArray(ast.text);
                break;
        }

        const textType = typeof (ast.text);
        if (textType === "string") {
            ast.text = this.ProcessCJKSpace(ast.text);
            return;
        }
    }

    MarkdownCJKSpace(md) {
        const ast = marked.parse(md);
        console.log(`ast`, ast);
        ast.forEach(_ast => this.walk(_ast));
        md = toMarkdown(ast);
        return md;
    }
}


const cjkspace = new CJKSpace();
module.exports = cjkspace;
module.exports.default = cjkspace;
module.exports.Pangu = cjkspace;