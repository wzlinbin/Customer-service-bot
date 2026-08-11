"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const widgetPath = path.join(__dirname, "..", "static", "chat-widget.js");
const source = fs.readFileSync(widgetPath, "utf8");
const setupStart = source.indexOf("    var translations = {");
const setupEnd = source.indexOf("    var storagePrefix = ");

assert.notEqual(setupStart, -1, "translation setup was not found");
assert.notEqual(setupEnd, -1, "translation setup boundary was not found");

const createI18n = new Function(
    "window",
    source.slice(setupStart, setupEnd) +
        "\nreturn { locale: locale, translations: translations, t: t };"
);

const localeCases = [
    { languages: ["en-US"], expected: "en" },
    { languages: ["de-CH"], expected: "de" },
    { languages: ["es-MX"], expected: "es" },
    { languages: ["ja-JP"], expected: "ja" },
    { languages: ["zh-CN"], expected: "zh-CN" },
    { languages: ["zh-Hans-SG"], expected: "zh-CN" },
    { languages: ["zh-TW"], expected: "zh-TW" },
    { languages: ["zh-Hant-HK"], expected: "zh-TW" },
    { languages: ["fr-FR", "es-ES"], expected: "es" },
    { languages: ["fr-FR"], expected: "zh-CN" }
];

for (const testCase of localeCases) {
    const i18n = createI18n({
        navigator: {
            languages: testCase.languages,
            language: testCase.languages[0]
        }
    });
    assert.equal(
        i18n.locale,
        testCase.expected,
        `${testCase.languages.join(", ")} should resolve to ${testCase.expected}`
    );
}

const withoutLanguages = createI18n({
    navigator: { languages: undefined, language: "ja-JP" }
});
assert.equal(withoutLanguages.locale, "ja");

const i18n = createI18n({
    navigator: { languages: ["en-US"], language: "en-US" }
});
const expectedChineseGreeting =
    "欢迎使用在线客服系统，请输入您的问题或请求，稍后客服会进行答复，对话期间请勿关闭窗口。";
assert.equal(
    i18n.translations["zh-CN"].conversationGreeting,
    expectedChineseGreeting
);
const expectedKeys = Object.keys(i18n.translations.en).sort();
for (const [language, messages] of Object.entries(i18n.translations)) {
    assert.deepEqual(
        Object.keys(messages).sort(),
        expectedKeys,
        `${language} must define the complete translation set`
    );
    for (const [key, value] of Object.entries(messages)) {
        assert.ok(value.trim(), `${language}.${key} must not be empty`);
    }
}

const templatePath = path.join(__dirname, "..", "templates", "chat_widget.html");
const templateSource = fs.readFileSync(templatePath, "utf8");
const templateSetupStart = templateSource.indexOf("    const chatTranslations = {");
const templateSetupEnd = templateSource.indexOf("    const chatLocale = ");

assert.notEqual(templateSetupStart, -1, "template translation setup was not found");
assert.notEqual(templateSetupEnd, -1, "template translation setup boundary was not found");

const createTemplateI18n = new Function(
    templateSource.slice(templateSetupStart, templateSetupEnd) +
        "\nreturn { translations: chatTranslations, resolve: resolveChatLocale };"
);
const templateI18n = createTemplateI18n();
assert.equal(
    templateI18n.translations["zh-CN"].conversationGreeting,
    expectedChineseGreeting
);
for (const testCase of localeCases) {
    assert.equal(
        templateI18n.resolve(testCase.languages, testCase.languages[0]),
        testCase.expected,
        `template ${testCase.languages.join(", ")} should resolve to ${testCase.expected}`
    );
}

const expectedTemplateKeys = Object.keys(templateI18n.translations.en).sort();
for (const [language, messages] of Object.entries(templateI18n.translations)) {
    assert.deepEqual(
        Object.keys(messages).sort(),
        expectedTemplateKeys,
        `template ${language} must define the complete translation set`
    );
}

console.log("chat-widget i18n tests passed");
