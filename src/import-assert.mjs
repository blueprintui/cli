import { path } from 'zx';

// temp workaround due to package "string-to-template-literal" not shipping valid esm module

// string-to-template-literal
var illegalChars = new Map();
illegalChars.set('\\', '\\\\');
illegalChars.set('`', '\\`');
illegalChars.set('$', '\\$');
function convert(s) {
    if (!s) {
        return '``';
    }
    var res = '';
    for (var i = 0; i < s.length; i++) {
        var c = s.charAt(i);
        res += illegalChars.get(c) || c;
    }
    return "`" + res + "`";
}

// rollup-plugin-import-assert
function getObjects(obj, key, val) {
    let objects = [];
    for (let prop in obj) {
        if (!obj.hasOwnProperty(prop)) {
            continue;
        }
        if (typeof obj[prop] == 'object') {
            objects = objects.concat(getObjects(obj[prop], key, val));
        }
        else if (prop == key && obj[prop] == val || prop == key && val == '') { //
            objects.push(obj);
        }
        else if (obj[prop] == val && key == '') {
            if (objects.lastIndexOf(obj) == -1) {
                objects.push(obj);
            }
        }
    }
    return objects;
}
const assertionMap = new Map();
const filePattern = /\.(js|ts|jsx|tsx)$/;
const getImportPath = (id, source) => path.resolve(path.dirname(id), source);
export function importAssertionsPlugin() {
    return {
        name: 'rollup-plugin-import-assert',
        transform(data, id) {
            let code = data;
            /** If the file is a JS-like file, continue */
            if (filePattern.exec(id)) {
                /** Get the AST data, must be using acorn-import-assertions for this to work */
                const ast = this.parse(data);
                /** @ts-ignore this does exist apparently */
                const { body } = ast;
                const importDeclarations = getObjects(body, 'type', 'ImportDeclaration');
                const importExpressions = getObjects(body, 'type', 'ImportExpression');
                importDeclarations.forEach(node => {
                    if (node.assertions) {
                        const [assertion] = node.assertions;
                        const assert = { type: assertion.value.value };
                        const importPath = getImportPath(id, node.source.value);
                        assertionMap.set(importPath, assert);
                    }
                });
                importExpressions.forEach(node => {
                    // Skip dynamic imports with expressions
                    // @example: import(`./foo/${bar}.js`); // NOK
                    // @example: import(`./foo/bar.js`); // OK
                    if (node.source.type === "TemplateLiteral" && node.source.quasis.length > 1) {
                        return;
                    }
                    // @example: `import(foo);` NOK
                    if (!node.source.value)
                        return;
                    const source = node.source.value || node.source.quasis[0].value.raw;
                    const importPath = getImportPath(id, source);
                    // TODO: We can still make this better
                    if (node.hasOwnProperty('arguments') && getObjects(node, 'name', 'assert')) {
                        const assert = { type: node.arguments[0].properties[0]?.value?.properties[0].value.value };
                        assertionMap.set(importPath, assert);
                        const matches = code.match(/import\(.*\)/gi);
                        const replacements = matches.map(match => match.replace(/\{(\s?)assert:(\s?)\{.*\}/gi, ''));
                        if (matches) {
                            matches.forEach((match, index) => code = code.replace(match, replacements[index]));
                            code.match(/import\(.*(\s?),(\s?)\)/gi).forEach(match => {
                                code = code.replace(match, match.replace(',', ''));
                            });
                        }
                    }
                });
            }
            const assertion = assertionMap.get(id);
            /** If an import assertion exists for the file, parse it differently */
            if (assertion) {
                const { type } = assertion;
                let code = data;
                if (type === 'css') {
                    /** Parse files asserted as CSS to use constructible stylesheets */
                    code = `const sheet = new CSSStyleSheet();sheet.replaceSync(${convert(data)});export default sheet;`;
                }
                else if (type === 'json') {
                    /** Parse files asserted as JSON as a JS object */
                    code = `export default ${data}`;
                }
                /** Return the new data and map it back to the original source file */
                return { code, mappings: id };
            }
            /** If none of the above exists, just continue as normal */
            return { code };
        }
    };
}
