/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*
 * This module only exports 'compile' which compiles a JSON language definition
 * into a typed and checked ILexer definition.
 */
import * as objects from '../../../../base/common/objects.js';
import * as monarchCommon from './monarchCommon.js';
/*
 * Type helpers
 *
 * Note: this is just for sanity checks on the JSON description which is
 * helpful for the programmer. No checks are done anymore once the lexer is
 * already 'compiled and checked'.
 *
 */
function isArrayOf(elemType, obj) {
    if (!obj) {
        return false;
    }
    if (!(Array.isArray(obj))) {
        return false;
    }
    for (var idx in obj) {
        if (obj.hasOwnProperty(idx)) {
            if (!(elemType(obj[idx]))) {
                return false;
            }
        }
    }
    return true;
}
function bool(prop, defValue) {
    if (typeof prop === 'boolean') {
        return prop;
    }
    return defValue;
}
function string(prop, defValue) {
    if (typeof (prop) === 'string') {
        return prop;
    }
    return defValue;
}
// Lexer helpers
/**
 * Compiles a regular expression string, adding the 'i' flag if 'ignoreCase' is set.
 * Also replaces @\w+ or sequences with the content of the specified attribute
 */
function compileRegExp(lexer, str) {
    var n = 0;
    while (str.indexOf('@') >= 0 && n < 5) { // at most 5 expansions
        n++;
        str = str.replace(/@(\w+)/g, function (s, attr) {
            var sub = '';
            if (typeof (lexer[attr]) === 'string') {
                sub = lexer[attr];
            }
            else if (lexer[attr] && lexer[attr] instanceof RegExp) {
                sub = lexer[attr].source;
            }
            else {
                if (lexer[attr] === undefined) {
                    throw monarchCommon.createError(lexer, 'language definition does not contain attribute \'' + attr + '\', used at: ' + str);
                }
                else {
                    throw monarchCommon.createError(lexer, 'attribute reference \'' + attr + '\' must be a string, used at: ' + str);
                }
            }
            return (monarchCommon.empty(sub) ? '' : '(?:' + sub + ')');
        });
    }
    return new RegExp(str, (lexer.ignoreCase ? 'i' : ''));
}
/**
 * Compiles guard functions for case matches.
 * This compiles 'cases' attributes into efficient match functions.
 *
 */
function selectScrutinee(id, matches, state, num) {
    if (num < 0) {
        return id;
    }
    if (num < matches.length) {
        return matches[num];
    }
    if (num >= 100) {
        num = num - 100;
        var parts = state.split('.');
        parts.unshift(state);
        if (num < parts.length) {
            return parts[num];
        }
    }
    return null;
}
function createGuard(lexer, ruleName, tkey, val) {
    // get the scrutinee and pattern
    var scrut = -1; // -1: $!, 0-99: $n, 100+n: $Sn
    var oppat = tkey;
    var matches = tkey.match(/^\$(([sS]?)(\d\d?)|#)(.*)$/);
    if (matches) {
        if (matches[3]) { // if digits
            scrut = parseInt(matches[3]);
            if (matches[2]) {
                scrut = scrut + 100; // if [sS] present
            }
        }
        oppat = matches[4];
    }
    // get operator
    var op = '~';
    var pat = oppat;
    if (!oppat || oppat.length === 0) {
        op = '!=';
        pat = '';
    }
    else if (/^\w*$/.test(pat)) { // just a word
        op = '==';
    }
    else {
        matches = oppat.match(/^(@|!@|~|!~|==|!=)(.*)$/);
        if (matches) {
            op = matches[1];
            pat = matches[2];
        }
    }
    // set the tester function
    var tester;
    // special case a regexp that matches just words
    if ((op === '~' || op === '!~') && /^(\w|\|)*$/.test(pat)) {
        var inWords_1 = objects.createKeywordMatcher(pat.split('|'), lexer.ignoreCase);
        tester = function (s) { return (op === '~' ? inWords_1(s) : !inWords_1(s)); };
    }
    else if (op === '@' || op === '!@') {
        var words = lexer[pat];
        if (!words) {
            throw monarchCommon.createError(lexer, 'the @ match target \'' + pat + '\' is not defined, in rule: ' + ruleName);
        }
        if (!(isArrayOf(function (elem) { return (typeof (elem) === 'string'); }, words))) {
            throw monarchCommon.createError(lexer, 'the @ match target \'' + pat + '\' must be an array of strings, in rule: ' + ruleName);
        }
        var inWords_2 = objects.createKeywordMatcher(words, lexer.ignoreCase);
        tester = function (s) { return (op === '@' ? inWords_2(s) : !inWords_2(s)); };
    }
    else if (op === '~' || op === '!~') {
        if (pat.indexOf('$') < 0) {
            // precompile regular expression
            var re_1 = compileRegExp(lexer, '^' + pat + '$');
            tester = function (s) { return (op === '~' ? re_1.test(s) : !re_1.test(s)); };
        }
        else {
            tester = function (s, id, matches, state) {
                var re = compileRegExp(lexer, '^' + monarchCommon.substituteMatches(lexer, pat, id, matches, state) + '$');
                return re.test(s);
            };
        }
    }
    else { // if (op==='==' || op==='!=') {
        if (pat.indexOf('$') < 0) {
            var patx_1 = monarchCommon.fixCase(lexer, pat);
            tester = function (s) { return (op === '==' ? s === patx_1 : s !== patx_1); };
        }
        else {
            var patx_2 = monarchCommon.fixCase(lexer, pat);
            tester = function (s, id, matches, state, eos) {
                var patexp = monarchCommon.substituteMatches(lexer, patx_2, id, matches, state);
                return (op === '==' ? s === patexp : s !== patexp);
            };
        }
    }
    // return the branch object
    if (scrut === -1) {
        return {
            name: tkey, value: val, test: function (id, matches, state, eos) {
                return tester(id, id, matches, state, eos);
            }
        };
    }
    else {
        return {
            name: tkey, value: val, test: function (id, matches, state, eos) {
                var scrutinee = selectScrutinee(id, matches, state, scrut);
                return tester(!scrutinee ? '' : scrutinee, id, matches, state, eos);
            }
        };
    }
}
/**
 * Compiles an action: i.e. optimize regular expressions and case matches
 * and do many sanity checks.
 *
 * This is called only during compilation but if the lexer definition
 * contains user functions as actions (which is usually not allowed), then this
 * may be called during lexing. It is important therefore to compile common cases efficiently
 */
function compileAction(lexer, ruleName, action) {
    if (!action) {
        return { token: '' };
    }
    else if (typeof (action) === 'string') {
        return action; // { token: action };
    }
    else if (action.token || action.token === '') {
        if (typeof (action.token) !== 'string') {
            throw monarchCommon.createError(lexer, 'a \'token\' attribute must be of type string, in rule: ' + ruleName);
        }
        else {
            // only copy specific typed fields (only happens once during compile Lexer)
            var newAction = { token: action.token };
            if (action.token.indexOf('$') >= 0) {
                newAction.tokenSubst = true;
            }
            if (typeof (action.bracket) === 'string') {
                if (action.bracket === '@open') {
                    newAction.bracket = 1 /* Open */;
                }
                else if (action.bracket === '@close') {
                    newAction.bracket = -1 /* Close */;
                }
                else {
                    throw monarchCommon.createError(lexer, 'a \'bracket\' attribute must be either \'@open\' or \'@close\', in rule: ' + ruleName);
                }
            }
            if (action.next) {
                if (typeof (action.next) !== 'string') {
                    throw monarchCommon.createError(lexer, 'the next state must be a string value in rule: ' + ruleName);
                }
                else {
                    var next = action.next;
                    if (!/^(@pop|@push|@popall)$/.test(next)) {
                        if (next[0] === '@') {
                            next = next.substr(1); // peel off starting @ sign
                        }
                        if (next.indexOf('$') < 0) { // no dollar substitution, we can check if the state exists
                            if (!monarchCommon.stateExists(lexer, monarchCommon.substituteMatches(lexer, next, '', [], ''))) {
                                throw monarchCommon.createError(lexer, 'the next state \'' + action.next + '\' is not defined in rule: ' + ruleName);
                            }
                        }
                    }
                    newAction.next = next;
                }
            }
            if (typeof (action.goBack) === 'number') {
                newAction.goBack = action.goBack;
            }
            if (typeof (action.switchTo) === 'string') {
                newAction.switchTo = action.switchTo;
            }
            if (typeof (action.log) === 'string') {
                newAction.log = action.log;
            }
            if (typeof (action.nextEmbedded) === 'string') {
                newAction.nextEmbedded = action.nextEmbedded;
                lexer.usesEmbedded = true;
            }
            return newAction;
        }
    }
    else if (Array.isArray(action)) {
        var results = [];
        for (var idx in action) {
            if (action.hasOwnProperty(idx)) {
                results[idx] = compileAction(lexer, ruleName, action[idx]);
            }
        }
        return { group: results };
    }
    else if (action.cases) {
        // build an array of test cases
        var cases_1 = [];
        // for each case, push a test function and result value
        for (var tkey in action.cases) {
            if (action.cases.hasOwnProperty(tkey)) {
                var val = compileAction(lexer, ruleName, action.cases[tkey]);
                // what kind of case
                if (tkey === '@default' || tkey === '@' || tkey === '') {
                    cases_1.push({ test: undefined, value: val, name: tkey });
                }
                else if (tkey === '@eos') {
                    cases_1.push({ test: function (id, matches, state, eos) { return eos; }, value: val, name: tkey });
                }
                else {
                    cases_1.push(createGuard(lexer, ruleName, tkey, val)); // call separate function to avoid local variable capture
                }
            }
        }
        // create a matching function
        var def_1 = lexer.defaultToken;
        return {
            test: function (id, matches, state, eos) {
                for (var idx in cases_1) {
                    if (cases_1.hasOwnProperty(idx)) {
                        var _case = cases_1[idx];
                        var didmatch = (!_case.test || _case.test(id, matches, state, eos));
                        if (didmatch) {
                            return _case.value;
                        }
                    }
                }
                return def_1;
            }
        };
    }
    else {
        throw monarchCommon.createError(lexer, 'an action must be a string, an object with a \'token\' or \'cases\' attribute, or an array of actions; in rule: ' + ruleName);
    }
}
/**
 * Helper class for creating matching rules
 */
var Rule = /** @class */ (function () {
    function Rule(name) {
        this.regex = new RegExp('');
        this.action = { token: '' };
        this.matchOnlyAtLineStart = false;
        this.name = '';
        this.name = name;
    }
    Rule.prototype.setRegex = function (lexer, re) {
        var sregex;
        if (typeof (re) === 'string') {
            sregex = re;
        }
        else if (re instanceof RegExp) {
            sregex = re.source;
        }
        else {
            throw monarchCommon.createError(lexer, 'rules must start with a match string or regular expression: ' + this.name);
        }
        this.matchOnlyAtLineStart = (sregex.length > 0 && sregex[0] === '^');
        this.name = this.name + ': ' + sregex;
        this.regex = compileRegExp(lexer, '^(?:' + (this.matchOnlyAtLineStart ? sregex.substr(1) : sregex) + ')');
    };
    Rule.prototype.setAction = function (lexer, act) {
        this.action = compileAction(lexer, this.name, act);
    };
    return Rule;
}());
/**
 * Compiles a json description function into json where all regular expressions,
 * case matches etc, are compiled and all include rules are expanded.
 * We also compile the bracket definitions, supply defaults, and do many sanity checks.
 * If the 'jsonStrict' parameter is 'false', we allow at certain locations
 * regular expression objects and functions that get called during lexing.
 * (Currently we have no samples that need this so perhaps we should always have
 * jsonStrict to true).
 */
export function compile(languageId, json) {
    if (!json || typeof (json) !== 'object') {
        throw new Error('Monarch: expecting a language definition object');
    }
    // Create our lexer
    var lexer = {};
    lexer.languageId = languageId;
    lexer.noThrow = false; // raise exceptions during compilation
    lexer.maxStack = 100;
    // Set standard fields: be defensive about types
    lexer.start = (typeof json.start === 'string' ? json.start : null);
    lexer.ignoreCase = bool(json.ignoreCase, false);
    lexer.tokenPostfix = string(json.tokenPostfix, '.' + lexer.languageId);
    lexer.defaultToken = string(json.defaultToken, 'source');
    lexer.usesEmbedded = false; // becomes true if we find a nextEmbedded action
    // For calling compileAction later on
    var lexerMin = json;
    lexerMin.languageId = languageId;
    lexerMin.ignoreCase = lexer.ignoreCase;
    lexerMin.noThrow = lexer.noThrow;
    lexerMin.usesEmbedded = lexer.usesEmbedded;
    lexerMin.stateNames = json.tokenizer;
    lexerMin.defaultToken = lexer.defaultToken;
    // Compile an array of rules into newrules where RegExp objects are created.
    function addRules(state, newrules, rules) {
        for (var idx in rules) {
            if (rules.hasOwnProperty(idx)) {
                var rule = rules[idx];
                var include = rule.include;
                if (include) {
                    if (typeof (include) !== 'string') {
                        throw monarchCommon.createError(lexer, 'an \'include\' attribute must be a string at: ' + state);
                    }
                    if (include[0] === '@') {
                        include = include.substr(1); // peel off starting @
                    }
                    if (!json.tokenizer[include]) {
                        throw monarchCommon.createError(lexer, 'include target \'' + include + '\' is not defined at: ' + state);
                    }
                    addRules(state + '.' + include, newrules, json.tokenizer[include]);
                }
                else {
                    var newrule = new Rule(state);
                    // Set up new rule attributes
                    if (Array.isArray(rule) && rule.length >= 1 && rule.length <= 3) {
                        newrule.setRegex(lexerMin, rule[0]);
                        if (rule.length >= 3) {
                            if (typeof (rule[1]) === 'string') {
                                newrule.setAction(lexerMin, { token: rule[1], next: rule[2] });
                            }
                            else if (typeof (rule[1]) === 'object') {
                                var rule1 = rule[1];
                                rule1.next = rule[2];
                                newrule.setAction(lexerMin, rule1);
                            }
                            else {
                                throw monarchCommon.createError(lexer, 'a next state as the last element of a rule can only be given if the action is either an object or a string, at: ' + state);
                            }
                        }
                        else {
                            newrule.setAction(lexerMin, rule[1]);
                        }
                    }
                    else {
                        if (!rule.regex) {
                            throw monarchCommon.createError(lexer, 'a rule must either be an array, or an object with a \'regex\' or \'include\' field at: ' + state);
                        }
                        if (rule.name) {
                            if (typeof rule.name === 'string') {
                                newrule.name = rule.name;
                            }
                        }
                        if (rule.matchOnlyAtStart) {
                            newrule.matchOnlyAtLineStart = bool(rule.matchOnlyAtLineStart, false);
                        }
                        newrule.setRegex(lexerMin, rule.regex);
                        newrule.setAction(lexerMin, rule.action);
                    }
                    newrules.push(newrule);
                }
            }
        }
    }
    // compile the tokenizer rules
    if (!json.tokenizer || typeof (json.tokenizer) !== 'object') {
        throw monarchCommon.createError(lexer, 'a language definition must define the \'tokenizer\' attribute as an object');
    }
    lexer.tokenizer = [];
    for (var key in json.tokenizer) {
        if (json.tokenizer.hasOwnProperty(key)) {
            if (!lexer.start) {
                lexer.start = key;
            }
            var rules = json.tokenizer[key];
            lexer.tokenizer[key] = new Array();
            addRules('tokenizer.' + key, lexer.tokenizer[key], rules);
        }
    }
    lexer.usesEmbedded = lexerMin.usesEmbedded; // can be set during compileAction
    // Set simple brackets
    if (json.brackets) {
        if (!(Array.isArray(json.brackets))) {
            throw monarchCommon.createError(lexer, 'the \'brackets\' attribute must be defined as an array');
        }
    }
    else {
        json.brackets = [
            { open: '{', close: '}', token: 'delimiter.curly' },
            { open: '[', close: ']', token: 'delimiter.square' },
            { open: '(', close: ')', token: 'delimiter.parenthesis' },
            { open: '<', close: '>', token: 'delimiter.angle' }
        ];
    }
    var brackets = [];
    for (var bracketIdx in json.brackets) {
        if (json.brackets.hasOwnProperty(bracketIdx)) {
            var desc = json.brackets[bracketIdx];
            if (desc && Array.isArray(desc) && desc.length === 3) {
                desc = { token: desc[2], open: desc[0], close: desc[1] };
            }
            if (desc.open === desc.close) {
                throw monarchCommon.createError(lexer, 'open and close brackets in a \'brackets\' attribute must be different: ' + desc.open +
                    '\n hint: use the \'bracket\' attribute if matching on equal brackets is required.');
            }
            if (typeof desc.open === 'string' && typeof desc.token === 'string' && typeof desc.close === 'string') {
                brackets.push({
                    token: desc.token + lexer.tokenPostfix,
                    open: monarchCommon.fixCase(lexer, desc.open),
                    close: monarchCommon.fixCase(lexer, desc.close)
                });
            }
            else {
                throw monarchCommon.createError(lexer, 'every element in the \'brackets\' array must be a \'{open,close,token}\' object or array');
            }
        }
    }
    lexer.brackets = brackets;
    // Disable throw so the syntax highlighter goes, no matter what
    lexer.noThrow = true;
    return lexer;
}
