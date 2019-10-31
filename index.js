const marked = require("marked-ast");
const { toMarkdown } = require("marked-ast-markdown");


const CharCatalog = {
    CJK: 0,
    Space: 1,
    CJK_SYMBOLS: 2,
    Others: 3
}

const CJK = "\u2e80-\u2eff\u2f00-\u2fdf\u3040-\u309f\u30a0-\u30fa\u30fc-\u30ff\u3100-\u312f\u3200-\u32ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff";

CJK_SYMBOLS = /[，。、？“”‘’：；【】（）￥！~·]/;


const ANY_CJK = new RegExp(`[${CJK}]`);

const HTML_STRING = /<\S.+?>/

class CJKSpace {
    constructor() {
        this.version = '1.0.0';
    }

    GetCharCatalog(str) {
        if (str == " ") {
            return CharCatalog.Space;
        }

        let t = str.match(CJK_SYMBOLS);
        if (t != null) {
            return CharCatalog.CJK_SYMBOLS;
        }

        t = str.match(ANY_CJK);
        if (t != null) {
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

            if (currCatalog == CharCatalog.Space && nextCatalog == CharCatalog.Space) {
                continue;
            }

            if (currCatalog == CharCatalog.Others && nextCatalog == CharCatalog.CJK) {
                newText += curr + " ";
                currCatalog = nextCatalog;
                continue;
            }

            if (currCatalog == CharCatalog.CJK && nextCatalog == CharCatalog.Others) {
                newText += curr + " ";
                currCatalog = nextCatalog;
                continue;
            }

            if (currCatalog == CharCatalog.Space && nextCatalog == CharCatalog.CJK_SYMBOLS) {
                currCatalog = nextCatalog;
                continue;
            }

            if (currCatalog == CharCatalog.CJK_SYMBOLS && nextCatalog == CharCatalog.Space) {
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

        if (currCatalog == CharCatalog.Space && tailCatalog == CharCatalog.Space) {
            return newText;
        }

        if (currCatalog == CharCatalog.Others && tailCatalog == CharCatalog.CJK) {
            newText += " " + tail;
            return newText;
        }

        if (currCatalog == CharCatalog.CJK && tailCatalog == CharCatalog.Others) {
            newText += " " + tail;
            return newText;
        }

        if (currCatalog == CharCatalog.Space && tailCatalog == CharCatalog.CJK_SYMBOLS) {
            newText = newText.substr(0, newText.length - 1) + tail;
            return newText;
        }

        if (currCatalog == CharCatalog.CJK_SYMBOLS && tailCatalog == CharCatalog.Space) {
            return newText;
        }

        newText += tail;
        return newText;
    }




    WalkTable(table) {
        for (let index = 0; index < table.content.length; index++) {
            const element = table.content[index];
            let tt = typeof (element)
            if (tt == "string") {
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
            if (preCatalog == CharCatalog.Others && currCatalog == CharCatalog.CJK) {
                ast[index - 1] = preElement + " ";
            }

            if (preCatalog == CharCatalog.CJK && currCatalog == CharCatalog.Others) {
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
            if (preCatalog == CharCatalog.Others && currCatalog == CharCatalog.CJK) {
                ast[index] = " " + curr;
            }

            if (preCatalog == CharCatalog.CJK && currCatalog == CharCatalog.Others) {
                ast[index] = " " + curr;
            }
        }
    }

    WalkArray(ast) {
        let preType;
        for (let index = 0; index < ast.length; index++) {
            const element = ast[index];
            let currType = element.type;
            if (currType == undefined) {
                ast[index] = this.ProcessCJKSpace(element)
            } else {
                this.walk(element)
            }

            if (index>0 && preType == undefined && (currType == "codespan" || currType == "strong" || currType == "em")) {
                this.ProcessNodeLeftCJKSpace(ast, index);
            }

            if (currType == undefined && (preType == "codespan" || preType == "strong" || preType == "em")) {
                this.ProcessNodeRightCJKSpace(ast, index);
            }
            preType = currType;
        }
    }

    walk(ast) {
        let t = ast.type;
        if (t == "list") {
            this.WalkArray(ast.body);
            return;
        }

        if (t == "blockquote") {
            this.WalkArray(ast.quote);
            return;
        }

        if (t == "table") {
            for (let index = 0; index < ast.header.length; index++) {
                this.WalkTable(ast.header[index])

            }
            for (let index = 0; index < ast.body.length; index++) {
                this.WalkTable(ast.body[index])
            }
            return;
        }

        const textType = typeof(ast.text);
        if (textType == "string") {
            ast.text = this.ProcessCJKSpace(ast.text);
            return;
        }


        if (t != "code" && t != "hr") {
            try {
                this.WalkArray(ast.text);
            } catch (error) {
                console.log(error)
            }
        }
    }

    MarkdownCJKSpace(md) {
        const ast = marked.parse(md);
        for (let index = 0; index < ast.length; index++) {
            const element = ast[index];
            this.walk(element);
        }

        md = toMarkdown(ast);
        return md;
    }
}


const cjkspace = new CJKSpace();
module.exports = cjkspace;
module.exports.default = cjkspace;
module.exports.Pangu = cjkspace;