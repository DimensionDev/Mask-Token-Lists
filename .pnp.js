#!/usr/bin/env node

/* eslint-disable max-len, flowtype/require-valid-file-annotation, flowtype/require-return-type */
/* global packageInformationStores, null, $$SETUP_STATIC_TABLES */

// Used for the resolveUnqualified part of the resolution (ie resolving folder/index.js & file extensions)
// Deconstructed so that they aren't affected by any fs monkeypatching occuring later during the execution
const { statSync, lstatSync, readlinkSync, readFileSync, existsSync, realpathSync } = require('fs')

const Module = require('module')
const path = require('path')
const StringDecoder = require('string_decoder')

const ignorePattern = null ? new RegExp(null) : null

const pnpFile = path.resolve(__dirname, __filename)
const builtinModules = new Set(Module.builtinModules || Object.keys(process.binding('natives')))

const topLevelLocator = { name: null, reference: null }
const blacklistedLocator = { name: NaN, reference: NaN }

// Used for compatibility purposes - cf setupCompatibilityLayer
const patchedModules = []
const fallbackLocators = [topLevelLocator]

// Matches backslashes of Windows paths
const backwardSlashRegExp = /\\/g

// Matches if the path must point to a directory (ie ends with /)
const isDirRegExp = /\/$/

// Matches if the path starts with a valid path qualifier (./, ../, /)
// eslint-disable-next-line no-unused-vars
const isStrictRegExp = /^\.{0,2}\//

// Splits a require request into its components, or return null if the request is a file path
const pathRegExp = /^(?![a-zA-Z]:[\\\/]|\\\\|\.{0,2}(?:\/|$))((?:@[^\/]+\/)?[^\/]+)\/?(.*|)$/

// Keep a reference around ("module" is a common name in this context, so better rename it to something more significant)
const pnpModule = module

/**
 * Used to disable the resolution hooks (for when we want to fallback to the previous resolution - we then need
 * a way to "reset" the environment temporarily)
 */

let enableNativeHooks = true

/**
 * Simple helper function that assign an error code to an error, so that it can more easily be caught and used
 * by third-parties.
 */

function makeError(code, message, data = {}) {
  const error = new Error(message)
  return Object.assign(error, { code, data })
}

/**
 * Ensures that the returned locator isn't a blacklisted one.
 *
 * Blacklisted packages are packages that cannot be used because their dependencies cannot be deduced. This only
 * happens with peer dependencies, which effectively have different sets of dependencies depending on their parents.
 *
 * In order to deambiguate those different sets of dependencies, the Yarn implementation of PnP will generate a
 * symlink for each combination of <package name>/<package version>/<dependent package> it will find, and will
 * blacklist the target of those symlinks. By doing this, we ensure that files loaded through a specific path
 * will always have the same set of dependencies, provided the symlinks are correctly preserved.
 *
 * Unfortunately, some tools do not preserve them, and when it happens PnP isn't able anymore to deduce the set of
 * dependencies based on the path of the file that makes the require calls. But since we've blacklisted those paths,
 * we're able to print a more helpful error message that points out that a third-party package is doing something
 * incompatible!
 */

// eslint-disable-next-line no-unused-vars
function blacklistCheck(locator) {
  if (locator === blacklistedLocator) {
    throw makeError(
      `BLACKLISTED`,
      [
        `A package has been resolved through a blacklisted path - this is usually caused by one of your tools calling`,
        `"realpath" on the return value of "require.resolve". Since the returned values use symlinks to disambiguate`,
        `peer dependencies, they must be passed untransformed to "require".`,
      ].join(` `),
    )
  }

  return locator
}

let packageInformationStores = new Map([
  [
    '@types/lodash',
    new Map([
      [
        '4.14.186',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@types-lodash-4.14.186-integrity/node_modules/@types/lodash/',
          ),
          packageDependencies: new Map([['@types/lodash', '4.14.186']]),
        },
      ],
    ]),
  ],
  [
    'axios',
    new Map([
      [
        '1.1.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-axios-1.1.3-integrity/node_modules/axios/',
          ),
          packageDependencies: new Map([
            ['follow-redirects', '1.15.2'],
            ['form-data', '4.0.0'],
            ['proxy-from-env', '1.1.0'],
            ['axios', '1.1.3'],
          ]),
        },
      ],
    ]),
  ],
  [
    'follow-redirects',
    new Map([
      [
        '1.15.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-follow-redirects-1.15.2-integrity/node_modules/follow-redirects/',
          ),
          packageDependencies: new Map([['follow-redirects', '1.15.2']]),
        },
      ],
    ]),
  ],
  [
    'form-data',
    new Map([
      [
        '4.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-form-data-4.0.0-integrity/node_modules/form-data/',
          ),
          packageDependencies: new Map([
            ['asynckit', '0.4.0'],
            ['combined-stream', '1.0.8'],
            ['mime-types', '2.1.35'],
            ['form-data', '4.0.0'],
          ]),
        },
      ],
      [
        '3.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-form-data-3.0.1-integrity/node_modules/form-data/',
          ),
          packageDependencies: new Map([
            ['asynckit', '0.4.0'],
            ['combined-stream', '1.0.8'],
            ['mime-types', '2.1.35'],
            ['form-data', '3.0.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'asynckit',
    new Map([
      [
        '0.4.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-asynckit-0.4.0-integrity/node_modules/asynckit/',
          ),
          packageDependencies: new Map([['asynckit', '0.4.0']]),
        },
      ],
    ]),
  ],
  [
    'combined-stream',
    new Map([
      [
        '1.0.8',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-combined-stream-1.0.8-integrity/node_modules/combined-stream/',
          ),
          packageDependencies: new Map([
            ['delayed-stream', '1.0.0'],
            ['combined-stream', '1.0.8'],
          ]),
        },
      ],
    ]),
  ],
  [
    'delayed-stream',
    new Map([
      [
        '1.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-delayed-stream-1.0.0-integrity/node_modules/delayed-stream/',
          ),
          packageDependencies: new Map([['delayed-stream', '1.0.0']]),
        },
      ],
    ]),
  ],
  [
    'mime-types',
    new Map([
      [
        '2.1.35',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-mime-types-2.1.35-integrity/node_modules/mime-types/',
          ),
          packageDependencies: new Map([
            ['mime-db', '1.52.0'],
            ['mime-types', '2.1.35'],
          ]),
        },
      ],
    ]),
  ],
  [
    'mime-db',
    new Map([
      [
        '1.52.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-mime-db-1.52.0-integrity/node_modules/mime-db/',
          ),
          packageDependencies: new Map([['mime-db', '1.52.0']]),
        },
      ],
    ]),
  ],
  [
    'proxy-from-env',
    new Map([
      [
        '1.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-proxy-from-env-1.1.0-integrity/node_modules/proxy-from-env/',
          ),
          packageDependencies: new Map([['proxy-from-env', '1.1.0']]),
        },
      ],
    ]),
  ],
  [
    'cheerio',
    new Map([
      [
        '1.0.0-rc.12',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-cheerio-1.0.0-rc.12-integrity/node_modules/cheerio/',
          ),
          packageDependencies: new Map([
            ['cheerio-select', '2.1.0'],
            ['dom-serializer', '2.0.0'],
            ['domhandler', '5.0.3'],
            ['domutils', '3.0.1'],
            ['htmlparser2', '8.0.1'],
            ['parse5', '7.1.1'],
            ['parse5-htmlparser2-tree-adapter', '7.0.0'],
            ['cheerio', '1.0.0-rc.12'],
          ]),
        },
      ],
    ]),
  ],
  [
    'cheerio-select',
    new Map([
      [
        '2.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-cheerio-select-2.1.0-integrity/node_modules/cheerio-select/',
          ),
          packageDependencies: new Map([
            ['boolbase', '1.0.0'],
            ['css-select', '5.1.0'],
            ['css-what', '6.1.0'],
            ['domelementtype', '2.3.0'],
            ['domhandler', '5.0.3'],
            ['domutils', '3.0.1'],
            ['cheerio-select', '2.1.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'boolbase',
    new Map([
      [
        '1.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-boolbase-1.0.0-integrity/node_modules/boolbase/',
          ),
          packageDependencies: new Map([['boolbase', '1.0.0']]),
        },
      ],
    ]),
  ],
  [
    'css-select',
    new Map([
      [
        '5.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-css-select-5.1.0-integrity/node_modules/css-select/',
          ),
          packageDependencies: new Map([
            ['boolbase', '1.0.0'],
            ['css-what', '6.1.0'],
            ['domhandler', '5.0.3'],
            ['domutils', '3.0.1'],
            ['nth-check', '2.1.1'],
            ['css-select', '5.1.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'css-what',
    new Map([
      [
        '6.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-css-what-6.1.0-integrity/node_modules/css-what/',
          ),
          packageDependencies: new Map([['css-what', '6.1.0']]),
        },
      ],
    ]),
  ],
  [
    'domhandler',
    new Map([
      [
        '5.0.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-domhandler-5.0.3-integrity/node_modules/domhandler/',
          ),
          packageDependencies: new Map([
            ['domelementtype', '2.3.0'],
            ['domhandler', '5.0.3'],
          ]),
        },
      ],
    ]),
  ],
  [
    'domelementtype',
    new Map([
      [
        '2.3.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-domelementtype-2.3.0-integrity/node_modules/domelementtype/',
          ),
          packageDependencies: new Map([['domelementtype', '2.3.0']]),
        },
      ],
    ]),
  ],
  [
    'domutils',
    new Map([
      [
        '3.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-domutils-3.0.1-integrity/node_modules/domutils/',
          ),
          packageDependencies: new Map([
            ['dom-serializer', '2.0.0'],
            ['domelementtype', '2.3.0'],
            ['domhandler', '5.0.3'],
            ['domutils', '3.0.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'dom-serializer',
    new Map([
      [
        '2.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-dom-serializer-2.0.0-integrity/node_modules/dom-serializer/',
          ),
          packageDependencies: new Map([
            ['domelementtype', '2.3.0'],
            ['domhandler', '5.0.3'],
            ['entities', '4.4.0'],
            ['dom-serializer', '2.0.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'entities',
    new Map([
      [
        '4.4.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-entities-4.4.0-integrity/node_modules/entities/',
          ),
          packageDependencies: new Map([['entities', '4.4.0']]),
        },
      ],
    ]),
  ],
  [
    'nth-check',
    new Map([
      [
        '2.1.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-nth-check-2.1.1-integrity/node_modules/nth-check/',
          ),
          packageDependencies: new Map([
            ['boolbase', '1.0.0'],
            ['nth-check', '2.1.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'htmlparser2',
    new Map([
      [
        '8.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-htmlparser2-8.0.1-integrity/node_modules/htmlparser2/',
          ),
          packageDependencies: new Map([
            ['domelementtype', '2.3.0'],
            ['domhandler', '5.0.3'],
            ['domutils', '3.0.1'],
            ['entities', '4.4.0'],
            ['htmlparser2', '8.0.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'parse5',
    new Map([
      [
        '7.1.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-parse5-7.1.1-integrity/node_modules/parse5/',
          ),
          packageDependencies: new Map([
            ['entities', '4.4.0'],
            ['parse5', '7.1.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'parse5-htmlparser2-tree-adapter',
    new Map([
      [
        '7.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-parse5-htmlparser2-tree-adapter-7.0.0-integrity/node_modules/parse5-htmlparser2-tree-adapter/',
          ),
          packageDependencies: new Map([
            ['domhandler', '5.0.3'],
            ['parse5', '7.1.1'],
            ['parse5-htmlparser2-tree-adapter', '7.0.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'commander',
    new Map([
      [
        '9.4.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-commander-9.4.1-integrity/node_modules/commander/',
          ),
          packageDependencies: new Map([['commander', '9.4.1']]),
        },
      ],
      [
        '2.20.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-commander-2.20.3-integrity/node_modules/commander/',
          ),
          packageDependencies: new Map([['commander', '2.20.3']]),
        },
      ],
    ]),
  ],
  [
    'fast-json-stringify',
    new Map([
      [
        '5.4.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-fast-json-stringify-5.4.0-integrity/node_modules/fast-json-stringify/',
          ),
          packageDependencies: new Map([
            ['@fastify/deepmerge', '1.1.0'],
            ['ajv', '8.11.0'],
            ['ajv-formats', '2.1.1'],
            ['fast-deep-equal', '3.1.3'],
            ['fast-uri', '2.1.0'],
            ['rfdc', '1.3.0'],
            ['fast-json-stringify', '5.4.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    '@fastify/deepmerge',
    new Map([
      [
        '1.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@fastify-deepmerge-1.1.0-integrity/node_modules/@fastify/deepmerge/',
          ),
          packageDependencies: new Map([['@fastify/deepmerge', '1.1.0']]),
        },
      ],
    ]),
  ],
  [
    'ajv',
    new Map([
      [
        '8.11.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-ajv-8.11.0-integrity/node_modules/ajv/',
          ),
          packageDependencies: new Map([
            ['fast-deep-equal', '3.1.3'],
            ['json-schema-traverse', '1.0.0'],
            ['require-from-string', '2.0.2'],
            ['uri-js', '4.4.1'],
            ['ajv', '8.11.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'fast-deep-equal',
    new Map([
      [
        '3.1.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-fast-deep-equal-3.1.3-integrity/node_modules/fast-deep-equal/',
          ),
          packageDependencies: new Map([['fast-deep-equal', '3.1.3']]),
        },
      ],
    ]),
  ],
  [
    'json-schema-traverse',
    new Map([
      [
        '1.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-json-schema-traverse-1.0.0-integrity/node_modules/json-schema-traverse/',
          ),
          packageDependencies: new Map([['json-schema-traverse', '1.0.0']]),
        },
      ],
    ]),
  ],
  [
    'require-from-string',
    new Map([
      [
        '2.0.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-require-from-string-2.0.2-integrity/node_modules/require-from-string/',
          ),
          packageDependencies: new Map([['require-from-string', '2.0.2']]),
        },
      ],
    ]),
  ],
  [
    'uri-js',
    new Map([
      [
        '4.4.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-uri-js-4.4.1-integrity/node_modules/uri-js/',
          ),
          packageDependencies: new Map([
            ['punycode', '2.1.1'],
            ['uri-js', '4.4.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'punycode',
    new Map([
      [
        '2.1.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-punycode-2.1.1-integrity/node_modules/punycode/',
          ),
          packageDependencies: new Map([['punycode', '2.1.1']]),
        },
      ],
    ]),
  ],
  [
    'ajv-formats',
    new Map([
      [
        '2.1.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-ajv-formats-2.1.1-integrity/node_modules/ajv-formats/',
          ),
          packageDependencies: new Map([
            ['ajv', '8.11.0'],
            ['ajv-formats', '2.1.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'fast-uri',
    new Map([
      [
        '2.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-fast-uri-2.1.0-integrity/node_modules/fast-uri/',
          ),
          packageDependencies: new Map([['fast-uri', '2.1.0']]),
        },
      ],
    ]),
  ],
  [
    'rfdc',
    new Map([
      [
        '1.3.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-rfdc-1.3.0-integrity/node_modules/rfdc/',
          ),
          packageDependencies: new Map([['rfdc', '1.3.0']]),
        },
      ],
    ]),
  ],
  [
    'lodash',
    new Map([
      [
        '4.17.21',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-lodash-4.17.21-integrity/node_modules/lodash/',
          ),
          packageDependencies: new Map([['lodash', '4.17.21']]),
        },
      ],
    ]),
  ],
  [
    'puppeteer',
    new Map([
      [
        '19.1.1',
        {
          packageLocation: path.resolve(
            __dirname,
            './.pnp/unplugged/npm-puppeteer-19.1.1-integrity/node_modules/puppeteer/',
          ),
          packageDependencies: new Map([
            ['cosmiconfig', '7.0.1'],
            ['https-proxy-agent', '5.0.1'],
            ['progress', '2.0.3'],
            ['proxy-from-env', '1.1.0'],
            ['puppeteer-core', '19.1.1'],
            ['puppeteer', '19.1.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'cosmiconfig',
    new Map([
      [
        '7.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-cosmiconfig-7.0.1-integrity/node_modules/cosmiconfig/',
          ),
          packageDependencies: new Map([
            ['@types/parse-json', '4.0.0'],
            ['import-fresh', '3.3.0'],
            ['parse-json', '5.2.0'],
            ['path-type', '4.0.0'],
            ['yaml', '1.10.2'],
            ['cosmiconfig', '7.0.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    '@types/parse-json',
    new Map([
      [
        '4.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@types-parse-json-4.0.0-integrity/node_modules/@types/parse-json/',
          ),
          packageDependencies: new Map([['@types/parse-json', '4.0.0']]),
        },
      ],
    ]),
  ],
  [
    'import-fresh',
    new Map([
      [
        '3.3.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-import-fresh-3.3.0-integrity/node_modules/import-fresh/',
          ),
          packageDependencies: new Map([
            ['parent-module', '1.0.1'],
            ['resolve-from', '4.0.0'],
            ['import-fresh', '3.3.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'parent-module',
    new Map([
      [
        '1.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-parent-module-1.0.1-integrity/node_modules/parent-module/',
          ),
          packageDependencies: new Map([
            ['callsites', '3.1.0'],
            ['parent-module', '1.0.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'callsites',
    new Map([
      [
        '3.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-callsites-3.1.0-integrity/node_modules/callsites/',
          ),
          packageDependencies: new Map([['callsites', '3.1.0']]),
        },
      ],
    ]),
  ],
  [
    'resolve-from',
    new Map([
      [
        '4.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-resolve-from-4.0.0-integrity/node_modules/resolve-from/',
          ),
          packageDependencies: new Map([['resolve-from', '4.0.0']]),
        },
      ],
    ]),
  ],
  [
    'parse-json',
    new Map([
      [
        '5.2.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-parse-json-5.2.0-integrity/node_modules/parse-json/',
          ),
          packageDependencies: new Map([
            ['@babel/code-frame', '7.18.6'],
            ['error-ex', '1.3.2'],
            ['json-parse-even-better-errors', '2.3.1'],
            ['lines-and-columns', '1.2.4'],
            ['parse-json', '5.2.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    '@babel/code-frame',
    new Map([
      [
        '7.18.6',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@babel-code-frame-7.18.6-integrity/node_modules/@babel/code-frame/',
          ),
          packageDependencies: new Map([
            ['@babel/highlight', '7.18.6'],
            ['@babel/code-frame', '7.18.6'],
          ]),
        },
      ],
    ]),
  ],
  [
    '@babel/highlight',
    new Map([
      [
        '7.18.6',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@babel-highlight-7.18.6-integrity/node_modules/@babel/highlight/',
          ),
          packageDependencies: new Map([
            ['@babel/helper-validator-identifier', '7.19.1'],
            ['chalk', '2.4.2'],
            ['js-tokens', '4.0.0'],
            ['@babel/highlight', '7.18.6'],
          ]),
        },
      ],
    ]),
  ],
  [
    '@babel/helper-validator-identifier',
    new Map([
      [
        '7.19.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@babel-helper-validator-identifier-7.19.1-integrity/node_modules/@babel/helper-validator-identifier/',
          ),
          packageDependencies: new Map([['@babel/helper-validator-identifier', '7.19.1']]),
        },
      ],
    ]),
  ],
  [
    'chalk',
    new Map([
      [
        '2.4.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-chalk-2.4.2-integrity/node_modules/chalk/',
          ),
          packageDependencies: new Map([
            ['ansi-styles', '3.2.1'],
            ['escape-string-regexp', '1.0.5'],
            ['supports-color', '5.5.0'],
            ['chalk', '2.4.2'],
          ]),
        },
      ],
      [
        '4.1.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-chalk-4.1.1-integrity/node_modules/chalk/',
          ),
          packageDependencies: new Map([
            ['ansi-styles', '4.3.0'],
            ['supports-color', '7.2.0'],
            ['chalk', '4.1.1'],
          ]),
        },
      ],
      [
        '3.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-chalk-3.0.0-integrity/node_modules/chalk/',
          ),
          packageDependencies: new Map([
            ['ansi-styles', '4.3.0'],
            ['supports-color', '7.2.0'],
            ['chalk', '3.0.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'ansi-styles',
    new Map([
      [
        '3.2.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-ansi-styles-3.2.1-integrity/node_modules/ansi-styles/',
          ),
          packageDependencies: new Map([
            ['color-convert', '1.9.3'],
            ['ansi-styles', '3.2.1'],
          ]),
        },
      ],
      [
        '4.3.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-ansi-styles-4.3.0-integrity/node_modules/ansi-styles/',
          ),
          packageDependencies: new Map([
            ['color-convert', '2.0.1'],
            ['ansi-styles', '4.3.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'color-convert',
    new Map([
      [
        '1.9.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-color-convert-1.9.3-integrity/node_modules/color-convert/',
          ),
          packageDependencies: new Map([
            ['color-name', '1.1.3'],
            ['color-convert', '1.9.3'],
          ]),
        },
      ],
      [
        '2.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-color-convert-2.0.1-integrity/node_modules/color-convert/',
          ),
          packageDependencies: new Map([
            ['color-name', '1.1.4'],
            ['color-convert', '2.0.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'color-name',
    new Map([
      [
        '1.1.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-color-name-1.1.3-integrity/node_modules/color-name/',
          ),
          packageDependencies: new Map([['color-name', '1.1.3']]),
        },
      ],
      [
        '1.1.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-color-name-1.1.4-integrity/node_modules/color-name/',
          ),
          packageDependencies: new Map([['color-name', '1.1.4']]),
        },
      ],
    ]),
  ],
  [
    'escape-string-regexp',
    new Map([
      [
        '1.0.5',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-escape-string-regexp-1.0.5-integrity/node_modules/escape-string-regexp/',
          ),
          packageDependencies: new Map([['escape-string-regexp', '1.0.5']]),
        },
      ],
    ]),
  ],
  [
    'supports-color',
    new Map([
      [
        '5.5.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-supports-color-5.5.0-integrity/node_modules/supports-color/',
          ),
          packageDependencies: new Map([
            ['has-flag', '3.0.0'],
            ['supports-color', '5.5.0'],
          ]),
        },
      ],
      [
        '7.2.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-supports-color-7.2.0-integrity/node_modules/supports-color/',
          ),
          packageDependencies: new Map([
            ['has-flag', '4.0.0'],
            ['supports-color', '7.2.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'has-flag',
    new Map([
      [
        '3.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-has-flag-3.0.0-integrity/node_modules/has-flag/',
          ),
          packageDependencies: new Map([['has-flag', '3.0.0']]),
        },
      ],
      [
        '4.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-has-flag-4.0.0-integrity/node_modules/has-flag/',
          ),
          packageDependencies: new Map([['has-flag', '4.0.0']]),
        },
      ],
    ]),
  ],
  [
    'js-tokens',
    new Map([
      [
        '4.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-js-tokens-4.0.0-integrity/node_modules/js-tokens/',
          ),
          packageDependencies: new Map([['js-tokens', '4.0.0']]),
        },
      ],
    ]),
  ],
  [
    'error-ex',
    new Map([
      [
        '1.3.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-error-ex-1.3.2-integrity/node_modules/error-ex/',
          ),
          packageDependencies: new Map([
            ['is-arrayish', '0.2.1'],
            ['error-ex', '1.3.2'],
          ]),
        },
      ],
    ]),
  ],
  [
    'is-arrayish',
    new Map([
      [
        '0.2.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-arrayish-0.2.1-integrity/node_modules/is-arrayish/',
          ),
          packageDependencies: new Map([['is-arrayish', '0.2.1']]),
        },
      ],
    ]),
  ],
  [
    'json-parse-even-better-errors',
    new Map([
      [
        '2.3.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-json-parse-even-better-errors-2.3.1-integrity/node_modules/json-parse-even-better-errors/',
          ),
          packageDependencies: new Map([['json-parse-even-better-errors', '2.3.1']]),
        },
      ],
    ]),
  ],
  [
    'lines-and-columns',
    new Map([
      [
        '1.2.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-lines-and-columns-1.2.4-integrity/node_modules/lines-and-columns/',
          ),
          packageDependencies: new Map([['lines-and-columns', '1.2.4']]),
        },
      ],
    ]),
  ],
  [
    'path-type',
    new Map([
      [
        '4.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-path-type-4.0.0-integrity/node_modules/path-type/',
          ),
          packageDependencies: new Map([['path-type', '4.0.0']]),
        },
      ],
    ]),
  ],
  [
    'yaml',
    new Map([
      [
        '1.10.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-yaml-1.10.2-integrity/node_modules/yaml/',
          ),
          packageDependencies: new Map([['yaml', '1.10.2']]),
        },
      ],
    ]),
  ],
  [
    'https-proxy-agent',
    new Map([
      [
        '5.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-https-proxy-agent-5.0.1-integrity/node_modules/https-proxy-agent/',
          ),
          packageDependencies: new Map([
            ['agent-base', '6.0.2'],
            ['debug', '4.3.4'],
            ['https-proxy-agent', '5.0.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'agent-base',
    new Map([
      [
        '6.0.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-agent-base-6.0.2-integrity/node_modules/agent-base/',
          ),
          packageDependencies: new Map([
            ['debug', '4.3.4'],
            ['agent-base', '6.0.2'],
          ]),
        },
      ],
    ]),
  ],
  [
    'debug',
    new Map([
      [
        '4.3.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-debug-4.3.4-integrity/node_modules/debug/',
          ),
          packageDependencies: new Map([
            ['ms', '2.1.2'],
            ['debug', '4.3.4'],
          ]),
        },
      ],
    ]),
  ],
  [
    'ms',
    new Map([
      [
        '2.1.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-ms-2.1.2-integrity/node_modules/ms/',
          ),
          packageDependencies: new Map([['ms', '2.1.2']]),
        },
      ],
    ]),
  ],
  [
    'progress',
    new Map([
      [
        '2.0.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-progress-2.0.3-integrity/node_modules/progress/',
          ),
          packageDependencies: new Map([['progress', '2.0.3']]),
        },
      ],
    ]),
  ],
  [
    'puppeteer-core',
    new Map([
      [
        '19.1.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-puppeteer-core-19.1.1-integrity/node_modules/puppeteer-core/',
          ),
          packageDependencies: new Map([
            ['cross-fetch', '3.1.5'],
            ['debug', '4.3.4'],
            ['devtools-protocol', '0.0.1045489'],
            ['extract-zip', '2.0.1'],
            ['https-proxy-agent', '5.0.1'],
            ['proxy-from-env', '1.1.0'],
            ['rimraf', '3.0.2'],
            ['tar-fs', '2.1.1'],
            ['unbzip2-stream', '1.4.3'],
            ['ws', '8.9.0'],
            ['puppeteer-core', '19.1.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'cross-fetch',
    new Map([
      [
        '3.1.5',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-cross-fetch-3.1.5-integrity/node_modules/cross-fetch/',
          ),
          packageDependencies: new Map([
            ['node-fetch', 'pnp:1051c6cb6ac62fd42022d1570aaba9b7409861bd'],
            ['cross-fetch', '3.1.5'],
          ]),
        },
      ],
    ]),
  ],
  [
    'node-fetch',
    new Map([
      [
        'pnp:1051c6cb6ac62fd42022d1570aaba9b7409861bd',
        {
          packageLocation: path.resolve(
            __dirname,
            './.pnp/externals/pnp-1051c6cb6ac62fd42022d1570aaba9b7409861bd/node_modules/node-fetch/',
          ),
          packageDependencies: new Map([
            ['whatwg-url', '5.0.0'],
            ['node-fetch', 'pnp:1051c6cb6ac62fd42022d1570aaba9b7409861bd'],
          ]),
        },
      ],
      [
        'pnp:982153c1d9d071a0501dbce5b86403d2fa9ccf39',
        {
          packageLocation: path.resolve(
            __dirname,
            './.pnp/externals/pnp-982153c1d9d071a0501dbce5b86403d2fa9ccf39/node_modules/node-fetch/',
          ),
          packageDependencies: new Map([
            ['whatwg-url', '5.0.0'],
            ['node-fetch', 'pnp:982153c1d9d071a0501dbce5b86403d2fa9ccf39'],
          ]),
        },
      ],
      [
        'pnp:cb38786f845c724406f632a5fa232107f429d878',
        {
          packageLocation: path.resolve(
            __dirname,
            './.pnp/externals/pnp-cb38786f845c724406f632a5fa232107f429d878/node_modules/node-fetch/',
          ),
          packageDependencies: new Map([
            ['whatwg-url', '5.0.0'],
            ['node-fetch', 'pnp:cb38786f845c724406f632a5fa232107f429d878'],
          ]),
        },
      ],
    ]),
  ],
  [
    'whatwg-url',
    new Map([
      [
        '5.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-whatwg-url-5.0.0-integrity/node_modules/whatwg-url/',
          ),
          packageDependencies: new Map([
            ['tr46', '0.0.3'],
            ['webidl-conversions', '3.0.1'],
            ['whatwg-url', '5.0.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'tr46',
    new Map([
      [
        '0.0.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-tr46-0.0.3-integrity/node_modules/tr46/',
          ),
          packageDependencies: new Map([['tr46', '0.0.3']]),
        },
      ],
    ]),
  ],
  [
    'webidl-conversions',
    new Map([
      [
        '3.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-webidl-conversions-3.0.1-integrity/node_modules/webidl-conversions/',
          ),
          packageDependencies: new Map([['webidl-conversions', '3.0.1']]),
        },
      ],
    ]),
  ],
  [
    'devtools-protocol',
    new Map([
      [
        '0.0.1045489',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-devtools-protocol-0.0.1045489-integrity/node_modules/devtools-protocol/',
          ),
          packageDependencies: new Map([['devtools-protocol', '0.0.1045489']]),
        },
      ],
    ]),
  ],
  [
    'extract-zip',
    new Map([
      [
        '2.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-extract-zip-2.0.1-integrity/node_modules/extract-zip/',
          ),
          packageDependencies: new Map([
            ['debug', '4.3.4'],
            ['get-stream', '5.2.0'],
            ['yauzl', '2.10.0'],
            ['@types/yauzl', '2.10.0'],
            ['extract-zip', '2.0.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'get-stream',
    new Map([
      [
        '5.2.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-get-stream-5.2.0-integrity/node_modules/get-stream/',
          ),
          packageDependencies: new Map([
            ['pump', '3.0.0'],
            ['get-stream', '5.2.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'pump',
    new Map([
      [
        '3.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-pump-3.0.0-integrity/node_modules/pump/',
          ),
          packageDependencies: new Map([
            ['end-of-stream', '1.4.4'],
            ['once', '1.4.0'],
            ['pump', '3.0.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'end-of-stream',
    new Map([
      [
        '1.4.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-end-of-stream-1.4.4-integrity/node_modules/end-of-stream/',
          ),
          packageDependencies: new Map([
            ['once', '1.4.0'],
            ['end-of-stream', '1.4.4'],
          ]),
        },
      ],
    ]),
  ],
  [
    'once',
    new Map([
      [
        '1.4.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-once-1.4.0-integrity/node_modules/once/',
          ),
          packageDependencies: new Map([
            ['wrappy', '1.0.2'],
            ['once', '1.4.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'wrappy',
    new Map([
      [
        '1.0.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-wrappy-1.0.2-integrity/node_modules/wrappy/',
          ),
          packageDependencies: new Map([['wrappy', '1.0.2']]),
        },
      ],
    ]),
  ],
  [
    'yauzl',
    new Map([
      [
        '2.10.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-yauzl-2.10.0-integrity/node_modules/yauzl/',
          ),
          packageDependencies: new Map([
            ['buffer-crc32', '0.2.13'],
            ['fd-slicer', '1.1.0'],
            ['yauzl', '2.10.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'buffer-crc32',
    new Map([
      [
        '0.2.13',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-buffer-crc32-0.2.13-integrity/node_modules/buffer-crc32/',
          ),
          packageDependencies: new Map([['buffer-crc32', '0.2.13']]),
        },
      ],
    ]),
  ],
  [
    'fd-slicer',
    new Map([
      [
        '1.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-fd-slicer-1.1.0-integrity/node_modules/fd-slicer/',
          ),
          packageDependencies: new Map([
            ['pend', '1.2.0'],
            ['fd-slicer', '1.1.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'pend',
    new Map([
      [
        '1.2.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-pend-1.2.0-integrity/node_modules/pend/',
          ),
          packageDependencies: new Map([['pend', '1.2.0']]),
        },
      ],
    ]),
  ],
  [
    '@types/yauzl',
    new Map([
      [
        '2.10.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@types-yauzl-2.10.0-integrity/node_modules/@types/yauzl/',
          ),
          packageDependencies: new Map([
            ['@types/node', '18.11.5'],
            ['@types/yauzl', '2.10.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    '@types/node',
    new Map([
      [
        '18.11.5',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@types-node-18.11.5-integrity/node_modules/@types/node/',
          ),
          packageDependencies: new Map([['@types/node', '18.11.5']]),
        },
      ],
    ]),
  ],
  [
    'rimraf',
    new Map([
      [
        '3.0.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-rimraf-3.0.2-integrity/node_modules/rimraf/',
          ),
          packageDependencies: new Map([
            ['glob', '7.1.6'],
            ['rimraf', '3.0.2'],
          ]),
        },
      ],
    ]),
  ],
  [
    'glob',
    new Map([
      [
        '7.1.6',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-glob-7.1.6-integrity/node_modules/glob/',
          ),
          packageDependencies: new Map([
            ['fs.realpath', '1.0.0'],
            ['inflight', '1.0.6'],
            ['inherits', '2.0.4'],
            ['minimatch', '3.0.4'],
            ['once', '1.4.0'],
            ['path-is-absolute', '1.0.1'],
            ['glob', '7.1.6'],
          ]),
        },
      ],
    ]),
  ],
  [
    'fs.realpath',
    new Map([
      [
        '1.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-fs-realpath-1.0.0-integrity/node_modules/fs.realpath/',
          ),
          packageDependencies: new Map([['fs.realpath', '1.0.0']]),
        },
      ],
    ]),
  ],
  [
    'inflight',
    new Map([
      [
        '1.0.6',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-inflight-1.0.6-integrity/node_modules/inflight/',
          ),
          packageDependencies: new Map([
            ['once', '1.4.0'],
            ['wrappy', '1.0.2'],
            ['inflight', '1.0.6'],
          ]),
        },
      ],
    ]),
  ],
  [
    'inherits',
    new Map([
      [
        '2.0.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-inherits-2.0.4-integrity/node_modules/inherits/',
          ),
          packageDependencies: new Map([['inherits', '2.0.4']]),
        },
      ],
    ]),
  ],
  [
    'minimatch',
    new Map([
      [
        '3.0.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-minimatch-3.0.4-integrity/node_modules/minimatch/',
          ),
          packageDependencies: new Map([
            ['brace-expansion', '1.1.11'],
            ['minimatch', '3.0.4'],
          ]),
        },
      ],
    ]),
  ],
  [
    'brace-expansion',
    new Map([
      [
        '1.1.11',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-brace-expansion-1.1.11-integrity/node_modules/brace-expansion/',
          ),
          packageDependencies: new Map([
            ['balanced-match', '1.0.0'],
            ['concat-map', '0.0.1'],
            ['brace-expansion', '1.1.11'],
          ]),
        },
      ],
    ]),
  ],
  [
    'balanced-match',
    new Map([
      [
        '1.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-balanced-match-1.0.0-integrity/node_modules/balanced-match/',
          ),
          packageDependencies: new Map([['balanced-match', '1.0.0']]),
        },
      ],
    ]),
  ],
  [
    'concat-map',
    new Map([
      [
        '0.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-concat-map-0.0.1-integrity/node_modules/concat-map/',
          ),
          packageDependencies: new Map([['concat-map', '0.0.1']]),
        },
      ],
    ]),
  ],
  [
    'path-is-absolute',
    new Map([
      [
        '1.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-path-is-absolute-1.0.1-integrity/node_modules/path-is-absolute/',
          ),
          packageDependencies: new Map([['path-is-absolute', '1.0.1']]),
        },
      ],
    ]),
  ],
  [
    'tar-fs',
    new Map([
      [
        '2.1.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-tar-fs-2.1.1-integrity/node_modules/tar-fs/',
          ),
          packageDependencies: new Map([
            ['chownr', '1.1.4'],
            ['mkdirp-classic', '0.5.3'],
            ['pump', '3.0.0'],
            ['tar-stream', '2.2.0'],
            ['tar-fs', '2.1.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'chownr',
    new Map([
      [
        '1.1.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-chownr-1.1.4-integrity/node_modules/chownr/',
          ),
          packageDependencies: new Map([['chownr', '1.1.4']]),
        },
      ],
    ]),
  ],
  [
    'mkdirp-classic',
    new Map([
      [
        '0.5.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-mkdirp-classic-0.5.3-integrity/node_modules/mkdirp-classic/',
          ),
          packageDependencies: new Map([['mkdirp-classic', '0.5.3']]),
        },
      ],
    ]),
  ],
  [
    'tar-stream',
    new Map([
      [
        '2.2.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-tar-stream-2.2.0-integrity/node_modules/tar-stream/',
          ),
          packageDependencies: new Map([
            ['bl', '4.1.0'],
            ['end-of-stream', '1.4.4'],
            ['fs-constants', '1.0.0'],
            ['inherits', '2.0.4'],
            ['readable-stream', '3.6.0'],
            ['tar-stream', '2.2.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'bl',
    new Map([
      [
        '4.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-bl-4.1.0-integrity/node_modules/bl/',
          ),
          packageDependencies: new Map([
            ['buffer', '5.7.1'],
            ['inherits', '2.0.4'],
            ['readable-stream', '3.6.0'],
            ['bl', '4.1.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'buffer',
    new Map([
      [
        '5.7.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-buffer-5.7.1-integrity/node_modules/buffer/',
          ),
          packageDependencies: new Map([
            ['base64-js', '1.5.1'],
            ['ieee754', '1.2.1'],
            ['buffer', '5.7.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'base64-js',
    new Map([
      [
        '1.5.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-base64-js-1.5.1-integrity/node_modules/base64-js/',
          ),
          packageDependencies: new Map([['base64-js', '1.5.1']]),
        },
      ],
    ]),
  ],
  [
    'ieee754',
    new Map([
      [
        '1.2.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-ieee754-1.2.1-integrity/node_modules/ieee754/',
          ),
          packageDependencies: new Map([['ieee754', '1.2.1']]),
        },
      ],
    ]),
  ],
  [
    'readable-stream',
    new Map([
      [
        '3.6.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-readable-stream-3.6.0-integrity/node_modules/readable-stream/',
          ),
          packageDependencies: new Map([
            ['inherits', '2.0.4'],
            ['string_decoder', '1.3.0'],
            ['util-deprecate', '1.0.2'],
            ['readable-stream', '3.6.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'string_decoder',
    new Map([
      [
        '1.3.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-string-decoder-1.3.0-integrity/node_modules/string_decoder/',
          ),
          packageDependencies: new Map([
            ['safe-buffer', '5.2.1'],
            ['string_decoder', '1.3.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'safe-buffer',
    new Map([
      [
        '5.2.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-safe-buffer-5.2.1-integrity/node_modules/safe-buffer/',
          ),
          packageDependencies: new Map([['safe-buffer', '5.2.1']]),
        },
      ],
    ]),
  ],
  [
    'util-deprecate',
    new Map([
      [
        '1.0.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-util-deprecate-1.0.2-integrity/node_modules/util-deprecate/',
          ),
          packageDependencies: new Map([['util-deprecate', '1.0.2']]),
        },
      ],
    ]),
  ],
  [
    'fs-constants',
    new Map([
      [
        '1.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-fs-constants-1.0.0-integrity/node_modules/fs-constants/',
          ),
          packageDependencies: new Map([['fs-constants', '1.0.0']]),
        },
      ],
    ]),
  ],
  [
    'unbzip2-stream',
    new Map([
      [
        '1.4.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-unbzip2-stream-1.4.3-integrity/node_modules/unbzip2-stream/',
          ),
          packageDependencies: new Map([
            ['buffer', '5.7.1'],
            ['through', '2.3.8'],
            ['unbzip2-stream', '1.4.3'],
          ]),
        },
      ],
    ]),
  ],
  [
    'through',
    new Map([
      [
        '2.3.8',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-through-2.3.8-integrity/node_modules/through/',
          ),
          packageDependencies: new Map([['through', '2.3.8']]),
        },
      ],
    ]),
  ],
  [
    'ws',
    new Map([
      [
        '8.9.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-ws-8.9.0-integrity/node_modules/ws/',
          ),
          packageDependencies: new Map([['ws', '8.9.0']]),
        },
      ],
    ]),
  ],
  [
    'puppeteer-extra',
    new Map([
      [
        '3.3.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-puppeteer-extra-3.3.4-integrity/node_modules/puppeteer-extra/',
          ),
          packageDependencies: new Map([
            ['@types/puppeteer', '5.4.7'],
            ['puppeteer', '19.1.1'],
            ['@types/debug', '4.1.7'],
            ['debug', '4.3.4'],
            ['deepmerge', '4.2.2'],
            ['puppeteer-extra', '3.3.4'],
          ]),
        },
      ],
    ]),
  ],
  [
    '@types/debug',
    new Map([
      [
        '4.1.7',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@types-debug-4.1.7-integrity/node_modules/@types/debug/',
          ),
          packageDependencies: new Map([
            ['@types/ms', '0.7.31'],
            ['@types/debug', '4.1.7'],
          ]),
        },
      ],
    ]),
  ],
  [
    '@types/ms',
    new Map([
      [
        '0.7.31',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@types-ms-0.7.31-integrity/node_modules/@types/ms/',
          ),
          packageDependencies: new Map([['@types/ms', '0.7.31']]),
        },
      ],
    ]),
  ],
  [
    'deepmerge',
    new Map([
      [
        '4.2.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-deepmerge-4.2.2-integrity/node_modules/deepmerge/',
          ),
          packageDependencies: new Map([['deepmerge', '4.2.2']]),
        },
      ],
    ]),
  ],
  [
    'puppeteer-extra-plugin-stealth',
    new Map([
      [
        '2.11.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-puppeteer-extra-plugin-stealth-2.11.1-integrity/node_modules/puppeteer-extra-plugin-stealth/',
          ),
          packageDependencies: new Map([
            ['puppeteer-extra', '3.3.4'],
            ['debug', '4.3.4'],
            ['puppeteer-extra-plugin', 'pnp:c653a96c771aac800a2a271897621ea0c5b1e8c6'],
            ['puppeteer-extra-plugin-user-preferences', '2.4.0'],
            ['puppeteer-extra-plugin-stealth', '2.11.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'puppeteer-extra-plugin',
    new Map([
      [
        'pnp:c653a96c771aac800a2a271897621ea0c5b1e8c6',
        {
          packageLocation: path.resolve(
            __dirname,
            './.pnp/externals/pnp-c653a96c771aac800a2a271897621ea0c5b1e8c6/node_modules/puppeteer-extra-plugin/',
          ),
          packageDependencies: new Map([
            ['puppeteer-extra', '3.3.4'],
            ['@types/debug', '4.1.7'],
            ['debug', '4.3.4'],
            ['merge-deep', '3.0.3'],
            ['puppeteer-extra-plugin', 'pnp:c653a96c771aac800a2a271897621ea0c5b1e8c6'],
          ]),
        },
      ],
      [
        'pnp:c7efd42446eda755f31981769587162dcfc0f568',
        {
          packageLocation: path.resolve(
            __dirname,
            './.pnp/externals/pnp-c7efd42446eda755f31981769587162dcfc0f568/node_modules/puppeteer-extra-plugin/',
          ),
          packageDependencies: new Map([
            ['puppeteer-extra', '3.3.4'],
            ['@types/debug', '4.1.7'],
            ['debug', '4.3.4'],
            ['merge-deep', '3.0.3'],
            ['puppeteer-extra-plugin', 'pnp:c7efd42446eda755f31981769587162dcfc0f568'],
          ]),
        },
      ],
      [
        'pnp:1d20218fd2f0b5d536811ca02955bd2d90b6cf4c',
        {
          packageLocation: path.resolve(
            __dirname,
            './.pnp/externals/pnp-1d20218fd2f0b5d536811ca02955bd2d90b6cf4c/node_modules/puppeteer-extra-plugin/',
          ),
          packageDependencies: new Map([
            ['puppeteer-extra', '3.3.4'],
            ['@types/debug', '4.1.7'],
            ['debug', '4.3.4'],
            ['merge-deep', '3.0.3'],
            ['puppeteer-extra-plugin', 'pnp:1d20218fd2f0b5d536811ca02955bd2d90b6cf4c'],
          ]),
        },
      ],
    ]),
  ],
  [
    'merge-deep',
    new Map([
      [
        '3.0.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-merge-deep-3.0.3-integrity/node_modules/merge-deep/',
          ),
          packageDependencies: new Map([
            ['arr-union', '3.1.0'],
            ['clone-deep', '0.2.4'],
            ['kind-of', '3.2.2'],
            ['merge-deep', '3.0.3'],
          ]),
        },
      ],
    ]),
  ],
  [
    'arr-union',
    new Map([
      [
        '3.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-arr-union-3.1.0-integrity/node_modules/arr-union/',
          ),
          packageDependencies: new Map([['arr-union', '3.1.0']]),
        },
      ],
    ]),
  ],
  [
    'clone-deep',
    new Map([
      [
        '0.2.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-clone-deep-0.2.4-integrity/node_modules/clone-deep/',
          ),
          packageDependencies: new Map([
            ['for-own', '0.1.5'],
            ['is-plain-object', '2.0.4'],
            ['kind-of', '3.2.2'],
            ['lazy-cache', '1.0.4'],
            ['shallow-clone', '0.1.2'],
            ['clone-deep', '0.2.4'],
          ]),
        },
      ],
    ]),
  ],
  [
    'for-own',
    new Map([
      [
        '0.1.5',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-for-own-0.1.5-integrity/node_modules/for-own/',
          ),
          packageDependencies: new Map([
            ['for-in', '1.0.2'],
            ['for-own', '0.1.5'],
          ]),
        },
      ],
    ]),
  ],
  [
    'for-in',
    new Map([
      [
        '1.0.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-for-in-1.0.2-integrity/node_modules/for-in/',
          ),
          packageDependencies: new Map([['for-in', '1.0.2']]),
        },
      ],
      [
        '0.1.8',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-for-in-0.1.8-integrity/node_modules/for-in/',
          ),
          packageDependencies: new Map([['for-in', '0.1.8']]),
        },
      ],
    ]),
  ],
  [
    'is-plain-object',
    new Map([
      [
        '2.0.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-plain-object-2.0.4-integrity/node_modules/is-plain-object/',
          ),
          packageDependencies: new Map([
            ['isobject', '3.0.1'],
            ['is-plain-object', '2.0.4'],
          ]),
        },
      ],
    ]),
  ],
  [
    'isobject',
    new Map([
      [
        '3.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-isobject-3.0.1-integrity/node_modules/isobject/',
          ),
          packageDependencies: new Map([['isobject', '3.0.1']]),
        },
      ],
    ]),
  ],
  [
    'kind-of',
    new Map([
      [
        '3.2.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-kind-of-3.2.2-integrity/node_modules/kind-of/',
          ),
          packageDependencies: new Map([
            ['is-buffer', '1.1.6'],
            ['kind-of', '3.2.2'],
          ]),
        },
      ],
      [
        '2.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-kind-of-2.0.1-integrity/node_modules/kind-of/',
          ),
          packageDependencies: new Map([
            ['is-buffer', '1.1.6'],
            ['kind-of', '2.0.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'is-buffer',
    new Map([
      [
        '1.1.6',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-buffer-1.1.6-integrity/node_modules/is-buffer/',
          ),
          packageDependencies: new Map([['is-buffer', '1.1.6']]),
        },
      ],
    ]),
  ],
  [
    'lazy-cache',
    new Map([
      [
        '1.0.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-lazy-cache-1.0.4-integrity/node_modules/lazy-cache/',
          ),
          packageDependencies: new Map([['lazy-cache', '1.0.4']]),
        },
      ],
      [
        '0.2.7',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-lazy-cache-0.2.7-integrity/node_modules/lazy-cache/',
          ),
          packageDependencies: new Map([['lazy-cache', '0.2.7']]),
        },
      ],
    ]),
  ],
  [
    'shallow-clone',
    new Map([
      [
        '0.1.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-shallow-clone-0.1.2-integrity/node_modules/shallow-clone/',
          ),
          packageDependencies: new Map([
            ['is-extendable', '0.1.1'],
            ['kind-of', '2.0.1'],
            ['lazy-cache', '0.2.7'],
            ['mixin-object', '2.0.1'],
            ['shallow-clone', '0.1.2'],
          ]),
        },
      ],
    ]),
  ],
  [
    'is-extendable',
    new Map([
      [
        '0.1.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-extendable-0.1.1-integrity/node_modules/is-extendable/',
          ),
          packageDependencies: new Map([['is-extendable', '0.1.1']]),
        },
      ],
    ]),
  ],
  [
    'mixin-object',
    new Map([
      [
        '2.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-mixin-object-2.0.1-integrity/node_modules/mixin-object/',
          ),
          packageDependencies: new Map([
            ['for-in', '0.1.8'],
            ['is-extendable', '0.1.1'],
            ['mixin-object', '2.0.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'puppeteer-extra-plugin-user-preferences',
    new Map([
      [
        '2.4.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-puppeteer-extra-plugin-user-preferences-2.4.0-integrity/node_modules/puppeteer-extra-plugin-user-preferences/',
          ),
          packageDependencies: new Map([
            ['puppeteer-extra', '3.3.4'],
            ['debug', '4.3.4'],
            ['deepmerge', '4.2.2'],
            ['puppeteer-extra-plugin', 'pnp:c7efd42446eda755f31981769587162dcfc0f568'],
            ['puppeteer-extra-plugin-user-data-dir', '2.4.0'],
            ['puppeteer-extra-plugin-user-preferences', '2.4.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'puppeteer-extra-plugin-user-data-dir',
    new Map([
      [
        '2.4.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-puppeteer-extra-plugin-user-data-dir-2.4.0-integrity/node_modules/puppeteer-extra-plugin-user-data-dir/',
          ),
          packageDependencies: new Map([
            ['puppeteer-extra', '3.3.4'],
            ['debug', '4.3.4'],
            ['fs-extra', '10.1.0'],
            ['puppeteer-extra-plugin', 'pnp:1d20218fd2f0b5d536811ca02955bd2d90b6cf4c'],
            ['rimraf', '3.0.2'],
            ['puppeteer-extra-plugin-user-data-dir', '2.4.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'fs-extra',
    new Map([
      [
        '10.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-fs-extra-10.1.0-integrity/node_modules/fs-extra/',
          ),
          packageDependencies: new Map([
            ['graceful-fs', '4.2.4'],
            ['jsonfile', '6.1.0'],
            ['universalify', '2.0.0'],
            ['fs-extra', '10.1.0'],
          ]),
        },
      ],
      [
        '8.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-fs-extra-8.1.0-integrity/node_modules/fs-extra/',
          ),
          packageDependencies: new Map([
            ['graceful-fs', '4.2.4'],
            ['jsonfile', '4.0.0'],
            ['universalify', '0.1.2'],
            ['fs-extra', '8.1.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'graceful-fs',
    new Map([
      [
        '4.2.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-graceful-fs-4.2.4-integrity/node_modules/graceful-fs/',
          ),
          packageDependencies: new Map([['graceful-fs', '4.2.4']]),
        },
      ],
    ]),
  ],
  [
    'jsonfile',
    new Map([
      [
        '6.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-jsonfile-6.1.0-integrity/node_modules/jsonfile/',
          ),
          packageDependencies: new Map([
            ['universalify', '2.0.0'],
            ['graceful-fs', '4.2.4'],
            ['jsonfile', '6.1.0'],
          ]),
        },
      ],
      [
        '4.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-jsonfile-4.0.0-integrity/node_modules/jsonfile/',
          ),
          packageDependencies: new Map([
            ['graceful-fs', '4.2.4'],
            ['jsonfile', '4.0.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'universalify',
    new Map([
      [
        '2.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-universalify-2.0.0-integrity/node_modules/universalify/',
          ),
          packageDependencies: new Map([['universalify', '2.0.0']]),
        },
      ],
      [
        '0.1.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-universalify-0.1.2-integrity/node_modules/universalify/',
          ),
          packageDependencies: new Map([['universalify', '0.1.2']]),
        },
      ],
    ]),
  ],
  [
    'typescript',
    new Map([
      [
        '4.8.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-typescript-4.8.4-integrity/node_modules/typescript/',
          ),
          packageDependencies: new Map([['typescript', '4.8.4']]),
        },
      ],
    ]),
  ],
  [
    'urlcat',
    new Map([
      [
        '2.0.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-urlcat-2.0.4-integrity/node_modules/urlcat/',
          ),
          packageDependencies: new Map([['urlcat', '2.0.4']]),
        },
      ],
    ]),
  ],
  [
    'wallet.ts',
    new Map([
      [
        '1.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-wallet-ts-1.0.1-integrity/node_modules/wallet.ts/',
          ),
          packageDependencies: new Map([
            ['bn.js', '5.2.1'],
            ['bs58', '4.0.1'],
            ['elliptic', '6.5.4'],
            ['keccak', '3.0.1'],
            ['wallet.ts', '1.0.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'bn.js',
    new Map([
      [
        '5.2.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-bn-js-5.2.1-integrity/node_modules/bn.js/',
          ),
          packageDependencies: new Map([['bn.js', '5.2.1']]),
        },
      ],
      [
        '4.11.9',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-bn-js-4.11.9-integrity/node_modules/bn.js/',
          ),
          packageDependencies: new Map([['bn.js', '4.11.9']]),
        },
      ],
      [
        '4.11.6',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-bn-js-4.11.6-integrity/node_modules/bn.js/',
          ),
          packageDependencies: new Map([['bn.js', '4.11.6']]),
        },
      ],
    ]),
  ],
  [
    'bs58',
    new Map([
      [
        '4.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-bs58-4.0.1-integrity/node_modules/bs58/',
          ),
          packageDependencies: new Map([
            ['base-x', '3.0.8'],
            ['bs58', '4.0.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'base-x',
    new Map([
      [
        '3.0.8',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-base-x-3.0.8-integrity/node_modules/base-x/',
          ),
          packageDependencies: new Map([
            ['safe-buffer', '5.2.1'],
            ['base-x', '3.0.8'],
          ]),
        },
      ],
    ]),
  ],
  [
    'elliptic',
    new Map([
      [
        '6.5.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-elliptic-6.5.4-integrity/node_modules/elliptic/',
          ),
          packageDependencies: new Map([
            ['bn.js', '4.11.9'],
            ['brorand', '1.1.0'],
            ['hash.js', '1.1.7'],
            ['hmac-drbg', '1.0.1'],
            ['inherits', '2.0.4'],
            ['minimalistic-assert', '1.0.1'],
            ['minimalistic-crypto-utils', '1.0.1'],
            ['elliptic', '6.5.4'],
          ]),
        },
      ],
    ]),
  ],
  [
    'brorand',
    new Map([
      [
        '1.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-brorand-1.1.0-integrity/node_modules/brorand/',
          ),
          packageDependencies: new Map([['brorand', '1.1.0']]),
        },
      ],
    ]),
  ],
  [
    'hash.js',
    new Map([
      [
        '1.1.7',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-hash-js-1.1.7-integrity/node_modules/hash.js/',
          ),
          packageDependencies: new Map([
            ['inherits', '2.0.4'],
            ['minimalistic-assert', '1.0.1'],
            ['hash.js', '1.1.7'],
          ]),
        },
      ],
    ]),
  ],
  [
    'minimalistic-assert',
    new Map([
      [
        '1.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-minimalistic-assert-1.0.1-integrity/node_modules/minimalistic-assert/',
          ),
          packageDependencies: new Map([['minimalistic-assert', '1.0.1']]),
        },
      ],
    ]),
  ],
  [
    'hmac-drbg',
    new Map([
      [
        '1.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-hmac-drbg-1.0.1-integrity/node_modules/hmac-drbg/',
          ),
          packageDependencies: new Map([
            ['hash.js', '1.1.7'],
            ['minimalistic-assert', '1.0.1'],
            ['minimalistic-crypto-utils', '1.0.1'],
            ['hmac-drbg', '1.0.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'minimalistic-crypto-utils',
    new Map([
      [
        '1.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-minimalistic-crypto-utils-1.0.1-integrity/node_modules/minimalistic-crypto-utils/',
          ),
          packageDependencies: new Map([['minimalistic-crypto-utils', '1.0.1']]),
        },
      ],
    ]),
  ],
  [
    'keccak',
    new Map([
      [
        '3.0.1',
        {
          packageLocation: path.resolve(__dirname, './.pnp/unplugged/npm-keccak-3.0.1-integrity/node_modules/keccak/'),
          packageDependencies: new Map([
            ['node-addon-api', '2.0.2'],
            ['node-gyp-build', '4.2.3'],
            ['keccak', '3.0.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'node-addon-api',
    new Map([
      [
        '2.0.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-node-addon-api-2.0.2-integrity/node_modules/node-addon-api/',
          ),
          packageDependencies: new Map([['node-addon-api', '2.0.2']]),
        },
      ],
    ]),
  ],
  [
    'node-gyp-build',
    new Map([
      [
        '4.2.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-node-gyp-build-4.2.3-integrity/node_modules/node-gyp-build/',
          ),
          packageDependencies: new Map([['node-gyp-build', '4.2.3']]),
        },
      ],
    ]),
  ],
  [
    'web3-utils',
    new Map([
      [
        '1.8.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-web3-utils-1.8.0-integrity/node_modules/web3-utils/',
          ),
          packageDependencies: new Map([
            ['bn.js', '5.2.1'],
            ['ethereum-bloom-filters', '1.0.10'],
            ['ethereumjs-util', '7.1.5'],
            ['ethjs-unit', '0.1.6'],
            ['number-to-bn', '1.7.0'],
            ['randombytes', '2.1.0'],
            ['utf8', '3.0.0'],
            ['web3-utils', '1.8.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'ethereum-bloom-filters',
    new Map([
      [
        '1.0.10',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-ethereum-bloom-filters-1.0.10-integrity/node_modules/ethereum-bloom-filters/',
          ),
          packageDependencies: new Map([
            ['js-sha3', '0.8.0'],
            ['ethereum-bloom-filters', '1.0.10'],
          ]),
        },
      ],
    ]),
  ],
  [
    'js-sha3',
    new Map([
      [
        '0.8.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-js-sha3-0.8.0-integrity/node_modules/js-sha3/',
          ),
          packageDependencies: new Map([['js-sha3', '0.8.0']]),
        },
      ],
    ]),
  ],
  [
    'ethereumjs-util',
    new Map([
      [
        '7.1.5',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-ethereumjs-util-7.1.5-integrity/node_modules/ethereumjs-util/',
          ),
          packageDependencies: new Map([
            ['@types/bn.js', '5.1.1'],
            ['bn.js', '5.2.1'],
            ['create-hash', '1.2.0'],
            ['ethereum-cryptography', '0.1.3'],
            ['rlp', '2.2.7'],
            ['ethereumjs-util', '7.1.5'],
          ]),
        },
      ],
    ]),
  ],
  [
    '@types/bn.js',
    new Map([
      [
        '5.1.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@types-bn-js-5.1.1-integrity/node_modules/@types/bn.js/',
          ),
          packageDependencies: new Map([
            ['@types/node', '18.11.5'],
            ['@types/bn.js', '5.1.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'create-hash',
    new Map([
      [
        '1.2.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-create-hash-1.2.0-integrity/node_modules/create-hash/',
          ),
          packageDependencies: new Map([
            ['cipher-base', '1.0.4'],
            ['inherits', '2.0.4'],
            ['md5.js', '1.3.5'],
            ['ripemd160', '2.0.2'],
            ['sha.js', '2.4.11'],
            ['create-hash', '1.2.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'cipher-base',
    new Map([
      [
        '1.0.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-cipher-base-1.0.4-integrity/node_modules/cipher-base/',
          ),
          packageDependencies: new Map([
            ['inherits', '2.0.4'],
            ['safe-buffer', '5.2.1'],
            ['cipher-base', '1.0.4'],
          ]),
        },
      ],
    ]),
  ],
  [
    'md5.js',
    new Map([
      [
        '1.3.5',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-md5-js-1.3.5-integrity/node_modules/md5.js/',
          ),
          packageDependencies: new Map([
            ['hash-base', '3.1.0'],
            ['inherits', '2.0.4'],
            ['safe-buffer', '5.2.1'],
            ['md5.js', '1.3.5'],
          ]),
        },
      ],
    ]),
  ],
  [
    'hash-base',
    new Map([
      [
        '3.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-hash-base-3.1.0-integrity/node_modules/hash-base/',
          ),
          packageDependencies: new Map([
            ['inherits', '2.0.4'],
            ['readable-stream', '3.6.0'],
            ['safe-buffer', '5.2.1'],
            ['hash-base', '3.1.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'ripemd160',
    new Map([
      [
        '2.0.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-ripemd160-2.0.2-integrity/node_modules/ripemd160/',
          ),
          packageDependencies: new Map([
            ['hash-base', '3.1.0'],
            ['inherits', '2.0.4'],
            ['ripemd160', '2.0.2'],
          ]),
        },
      ],
    ]),
  ],
  [
    'sha.js',
    new Map([
      [
        '2.4.11',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-sha-js-2.4.11-integrity/node_modules/sha.js/',
          ),
          packageDependencies: new Map([
            ['inherits', '2.0.4'],
            ['safe-buffer', '5.2.1'],
            ['sha.js', '2.4.11'],
          ]),
        },
      ],
    ]),
  ],
  [
    'ethereum-cryptography',
    new Map([
      [
        '0.1.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-ethereum-cryptography-0.1.3-integrity/node_modules/ethereum-cryptography/',
          ),
          packageDependencies: new Map([
            ['@types/pbkdf2', '3.1.0'],
            ['@types/secp256k1', '4.0.3'],
            ['blakejs', '1.2.1'],
            ['browserify-aes', '1.2.0'],
            ['bs58check', '2.1.2'],
            ['create-hash', '1.2.0'],
            ['create-hmac', '1.1.7'],
            ['hash.js', '1.1.7'],
            ['keccak', '3.0.1'],
            ['pbkdf2', '3.1.2'],
            ['randombytes', '2.1.0'],
            ['safe-buffer', '5.2.1'],
            ['scrypt-js', '3.0.1'],
            ['secp256k1', '4.0.3'],
            ['setimmediate', '1.0.5'],
            ['ethereum-cryptography', '0.1.3'],
          ]),
        },
      ],
    ]),
  ],
  [
    '@types/pbkdf2',
    new Map([
      [
        '3.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@types-pbkdf2-3.1.0-integrity/node_modules/@types/pbkdf2/',
          ),
          packageDependencies: new Map([
            ['@types/node', '18.11.5'],
            ['@types/pbkdf2', '3.1.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    '@types/secp256k1',
    new Map([
      [
        '4.0.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@types-secp256k1-4.0.3-integrity/node_modules/@types/secp256k1/',
          ),
          packageDependencies: new Map([
            ['@types/node', '18.11.5'],
            ['@types/secp256k1', '4.0.3'],
          ]),
        },
      ],
    ]),
  ],
  [
    'blakejs',
    new Map([
      [
        '1.2.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-blakejs-1.2.1-integrity/node_modules/blakejs/',
          ),
          packageDependencies: new Map([['blakejs', '1.2.1']]),
        },
      ],
    ]),
  ],
  [
    'browserify-aes',
    new Map([
      [
        '1.2.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-browserify-aes-1.2.0-integrity/node_modules/browserify-aes/',
          ),
          packageDependencies: new Map([
            ['buffer-xor', '1.0.3'],
            ['cipher-base', '1.0.4'],
            ['create-hash', '1.2.0'],
            ['evp_bytestokey', '1.0.3'],
            ['inherits', '2.0.4'],
            ['safe-buffer', '5.2.1'],
            ['browserify-aes', '1.2.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'buffer-xor',
    new Map([
      [
        '1.0.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-buffer-xor-1.0.3-integrity/node_modules/buffer-xor/',
          ),
          packageDependencies: new Map([['buffer-xor', '1.0.3']]),
        },
      ],
    ]),
  ],
  [
    'evp_bytestokey',
    new Map([
      [
        '1.0.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-evp-bytestokey-1.0.3-integrity/node_modules/evp_bytestokey/',
          ),
          packageDependencies: new Map([
            ['md5.js', '1.3.5'],
            ['safe-buffer', '5.2.1'],
            ['evp_bytestokey', '1.0.3'],
          ]),
        },
      ],
    ]),
  ],
  [
    'bs58check',
    new Map([
      [
        '2.1.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-bs58check-2.1.2-integrity/node_modules/bs58check/',
          ),
          packageDependencies: new Map([
            ['bs58', '4.0.1'],
            ['create-hash', '1.2.0'],
            ['safe-buffer', '5.2.1'],
            ['bs58check', '2.1.2'],
          ]),
        },
      ],
    ]),
  ],
  [
    'create-hmac',
    new Map([
      [
        '1.1.7',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-create-hmac-1.1.7-integrity/node_modules/create-hmac/',
          ),
          packageDependencies: new Map([
            ['cipher-base', '1.0.4'],
            ['create-hash', '1.2.0'],
            ['inherits', '2.0.4'],
            ['ripemd160', '2.0.2'],
            ['safe-buffer', '5.2.1'],
            ['sha.js', '2.4.11'],
            ['create-hmac', '1.1.7'],
          ]),
        },
      ],
    ]),
  ],
  [
    'pbkdf2',
    new Map([
      [
        '3.1.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-pbkdf2-3.1.2-integrity/node_modules/pbkdf2/',
          ),
          packageDependencies: new Map([
            ['create-hash', '1.2.0'],
            ['create-hmac', '1.1.7'],
            ['ripemd160', '2.0.2'],
            ['safe-buffer', '5.2.1'],
            ['sha.js', '2.4.11'],
            ['pbkdf2', '3.1.2'],
          ]),
        },
      ],
    ]),
  ],
  [
    'randombytes',
    new Map([
      [
        '2.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-randombytes-2.1.0-integrity/node_modules/randombytes/',
          ),
          packageDependencies: new Map([
            ['safe-buffer', '5.2.1'],
            ['randombytes', '2.1.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'scrypt-js',
    new Map([
      [
        '3.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-scrypt-js-3.0.1-integrity/node_modules/scrypt-js/',
          ),
          packageDependencies: new Map([['scrypt-js', '3.0.1']]),
        },
      ],
    ]),
  ],
  [
    'secp256k1',
    new Map([
      [
        '4.0.3',
        {
          packageLocation: path.resolve(
            __dirname,
            './.pnp/unplugged/npm-secp256k1-4.0.3-integrity/node_modules/secp256k1/',
          ),
          packageDependencies: new Map([
            ['elliptic', '6.5.4'],
            ['node-addon-api', '2.0.2'],
            ['node-gyp-build', '4.2.3'],
            ['secp256k1', '4.0.3'],
          ]),
        },
      ],
    ]),
  ],
  [
    'setimmediate',
    new Map([
      [
        '1.0.5',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-setimmediate-1.0.5-integrity/node_modules/setimmediate/',
          ),
          packageDependencies: new Map([['setimmediate', '1.0.5']]),
        },
      ],
    ]),
  ],
  [
    'rlp',
    new Map([
      [
        '2.2.7',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-rlp-2.2.7-integrity/node_modules/rlp/',
          ),
          packageDependencies: new Map([
            ['bn.js', '5.2.1'],
            ['rlp', '2.2.7'],
          ]),
        },
      ],
    ]),
  ],
  [
    'ethjs-unit',
    new Map([
      [
        '0.1.6',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-ethjs-unit-0.1.6-integrity/node_modules/ethjs-unit/',
          ),
          packageDependencies: new Map([
            ['bn.js', '4.11.6'],
            ['number-to-bn', '1.7.0'],
            ['ethjs-unit', '0.1.6'],
          ]),
        },
      ],
    ]),
  ],
  [
    'number-to-bn',
    new Map([
      [
        '1.7.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-number-to-bn-1.7.0-integrity/node_modules/number-to-bn/',
          ),
          packageDependencies: new Map([
            ['bn.js', '4.11.6'],
            ['strip-hex-prefix', '1.0.0'],
            ['number-to-bn', '1.7.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'strip-hex-prefix',
    new Map([
      [
        '1.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-strip-hex-prefix-1.0.0-integrity/node_modules/strip-hex-prefix/',
          ),
          packageDependencies: new Map([
            ['is-hex-prefixed', '1.0.0'],
            ['strip-hex-prefix', '1.0.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'is-hex-prefixed',
    new Map([
      [
        '1.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-hex-prefixed-1.0.0-integrity/node_modules/is-hex-prefixed/',
          ),
          packageDependencies: new Map([['is-hex-prefixed', '1.0.0']]),
        },
      ],
    ]),
  ],
  [
    'utf8',
    new Map([
      [
        '3.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-utf8-3.0.0-integrity/node_modules/utf8/',
          ),
          packageDependencies: new Map([['utf8', '3.0.0']]),
        },
      ],
    ]),
  ],
  [
    '@types/node-fetch',
    new Map([
      [
        '2.6.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@types-node-fetch-2.6.1-integrity/node_modules/@types/node-fetch/',
          ),
          packageDependencies: new Map([
            ['@types/node', '18.11.5'],
            ['form-data', '3.0.1'],
            ['@types/node-fetch', '2.6.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    '@types/prettier',
    new Map([
      [
        '2.4.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@types-prettier-2.4.4-integrity/node_modules/@types/prettier/',
          ),
          packageDependencies: new Map([['@types/prettier', '2.4.4']]),
        },
      ],
    ]),
  ],
  [
    '@types/puppeteer',
    new Map([
      [
        '5.4.7',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@types-puppeteer-5.4.7-integrity/node_modules/@types/puppeteer/',
          ),
          packageDependencies: new Map([
            ['@types/node', '18.11.5'],
            ['@types/puppeteer', '5.4.7'],
          ]),
        },
      ],
    ]),
  ],
  [
    'gh-pages',
    new Map([
      [
        '3.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-gh-pages-3.1.0-integrity/node_modules/gh-pages/',
          ),
          packageDependencies: new Map([
            ['async', '2.6.3'],
            ['commander', '2.20.3'],
            ['email-addresses', '3.1.0'],
            ['filenamify-url', '1.0.0'],
            ['find-cache-dir', '3.3.1'],
            ['fs-extra', '8.1.0'],
            ['globby', '6.1.0'],
            ['gh-pages', '3.1.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'async',
    new Map([
      [
        '2.6.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-async-2.6.3-integrity/node_modules/async/',
          ),
          packageDependencies: new Map([
            ['lodash', '4.17.21'],
            ['async', '2.6.3'],
          ]),
        },
      ],
    ]),
  ],
  [
    'email-addresses',
    new Map([
      [
        '3.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-email-addresses-3.1.0-integrity/node_modules/email-addresses/',
          ),
          packageDependencies: new Map([['email-addresses', '3.1.0']]),
        },
      ],
    ]),
  ],
  [
    'filenamify-url',
    new Map([
      [
        '1.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-filenamify-url-1.0.0-integrity/node_modules/filenamify-url/',
          ),
          packageDependencies: new Map([
            ['filenamify', '1.2.1'],
            ['humanize-url', '1.0.1'],
            ['filenamify-url', '1.0.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'filenamify',
    new Map([
      [
        '1.2.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-filenamify-1.2.1-integrity/node_modules/filenamify/',
          ),
          packageDependencies: new Map([
            ['filename-reserved-regex', '1.0.0'],
            ['strip-outer', '1.0.1'],
            ['trim-repeated', '1.0.0'],
            ['filenamify', '1.2.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'filename-reserved-regex',
    new Map([
      [
        '1.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-filename-reserved-regex-1.0.0-integrity/node_modules/filename-reserved-regex/',
          ),
          packageDependencies: new Map([['filename-reserved-regex', '1.0.0']]),
        },
      ],
    ]),
  ],
  [
    'strip-outer',
    new Map([
      [
        '1.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-strip-outer-1.0.1-integrity/node_modules/strip-outer/',
          ),
          packageDependencies: new Map([
            ['escape-string-regexp', '1.0.5'],
            ['strip-outer', '1.0.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'trim-repeated',
    new Map([
      [
        '1.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-trim-repeated-1.0.0-integrity/node_modules/trim-repeated/',
          ),
          packageDependencies: new Map([
            ['escape-string-regexp', '1.0.5'],
            ['trim-repeated', '1.0.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'humanize-url',
    new Map([
      [
        '1.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-humanize-url-1.0.1-integrity/node_modules/humanize-url/',
          ),
          packageDependencies: new Map([
            ['normalize-url', '1.9.1'],
            ['strip-url-auth', '1.0.1'],
            ['humanize-url', '1.0.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'normalize-url',
    new Map([
      [
        '1.9.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-normalize-url-1.9.1-integrity/node_modules/normalize-url/',
          ),
          packageDependencies: new Map([
            ['object-assign', '4.1.1'],
            ['prepend-http', '1.0.4'],
            ['query-string', '4.3.4'],
            ['sort-keys', '1.1.2'],
            ['normalize-url', '1.9.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'object-assign',
    new Map([
      [
        '4.1.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-object-assign-4.1.1-integrity/node_modules/object-assign/',
          ),
          packageDependencies: new Map([['object-assign', '4.1.1']]),
        },
      ],
    ]),
  ],
  [
    'prepend-http',
    new Map([
      [
        '1.0.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-prepend-http-1.0.4-integrity/node_modules/prepend-http/',
          ),
          packageDependencies: new Map([['prepend-http', '1.0.4']]),
        },
      ],
    ]),
  ],
  [
    'query-string',
    new Map([
      [
        '4.3.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-query-string-4.3.4-integrity/node_modules/query-string/',
          ),
          packageDependencies: new Map([
            ['object-assign', '4.1.1'],
            ['strict-uri-encode', '1.1.0'],
            ['query-string', '4.3.4'],
          ]),
        },
      ],
    ]),
  ],
  [
    'strict-uri-encode',
    new Map([
      [
        '1.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-strict-uri-encode-1.1.0-integrity/node_modules/strict-uri-encode/',
          ),
          packageDependencies: new Map([['strict-uri-encode', '1.1.0']]),
        },
      ],
    ]),
  ],
  [
    'sort-keys',
    new Map([
      [
        '1.1.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-sort-keys-1.1.2-integrity/node_modules/sort-keys/',
          ),
          packageDependencies: new Map([
            ['is-plain-obj', '1.1.0'],
            ['sort-keys', '1.1.2'],
          ]),
        },
      ],
    ]),
  ],
  [
    'is-plain-obj',
    new Map([
      [
        '1.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-plain-obj-1.1.0-integrity/node_modules/is-plain-obj/',
          ),
          packageDependencies: new Map([['is-plain-obj', '1.1.0']]),
        },
      ],
    ]),
  ],
  [
    'strip-url-auth',
    new Map([
      [
        '1.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-strip-url-auth-1.0.1-integrity/node_modules/strip-url-auth/',
          ),
          packageDependencies: new Map([['strip-url-auth', '1.0.1']]),
        },
      ],
    ]),
  ],
  [
    'find-cache-dir',
    new Map([
      [
        '3.3.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-find-cache-dir-3.3.1-integrity/node_modules/find-cache-dir/',
          ),
          packageDependencies: new Map([
            ['commondir', '1.0.1'],
            ['make-dir', '3.1.0'],
            ['pkg-dir', '4.2.0'],
            ['find-cache-dir', '3.3.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'commondir',
    new Map([
      [
        '1.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-commondir-1.0.1-integrity/node_modules/commondir/',
          ),
          packageDependencies: new Map([['commondir', '1.0.1']]),
        },
      ],
    ]),
  ],
  [
    'make-dir',
    new Map([
      [
        '3.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-make-dir-3.1.0-integrity/node_modules/make-dir/',
          ),
          packageDependencies: new Map([
            ['semver', '6.3.0'],
            ['make-dir', '3.1.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'semver',
    new Map([
      [
        '6.3.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-semver-6.3.0-integrity/node_modules/semver/',
          ),
          packageDependencies: new Map([['semver', '6.3.0']]),
        },
      ],
    ]),
  ],
  [
    'pkg-dir',
    new Map([
      [
        '4.2.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-pkg-dir-4.2.0-integrity/node_modules/pkg-dir/',
          ),
          packageDependencies: new Map([
            ['find-up', '4.1.0'],
            ['pkg-dir', '4.2.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'find-up',
    new Map([
      [
        '4.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-find-up-4.1.0-integrity/node_modules/find-up/',
          ),
          packageDependencies: new Map([
            ['locate-path', '5.0.0'],
            ['path-exists', '4.0.0'],
            ['find-up', '4.1.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'locate-path',
    new Map([
      [
        '5.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-locate-path-5.0.0-integrity/node_modules/locate-path/',
          ),
          packageDependencies: new Map([
            ['p-locate', '4.1.0'],
            ['locate-path', '5.0.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'p-locate',
    new Map([
      [
        '4.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-p-locate-4.1.0-integrity/node_modules/p-locate/',
          ),
          packageDependencies: new Map([
            ['p-limit', '2.3.0'],
            ['p-locate', '4.1.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'p-limit',
    new Map([
      [
        '2.3.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-p-limit-2.3.0-integrity/node_modules/p-limit/',
          ),
          packageDependencies: new Map([
            ['p-try', '2.2.0'],
            ['p-limit', '2.3.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'p-try',
    new Map([
      [
        '2.2.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-p-try-2.2.0-integrity/node_modules/p-try/',
          ),
          packageDependencies: new Map([['p-try', '2.2.0']]),
        },
      ],
    ]),
  ],
  [
    'path-exists',
    new Map([
      [
        '4.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-path-exists-4.0.0-integrity/node_modules/path-exists/',
          ),
          packageDependencies: new Map([['path-exists', '4.0.0']]),
        },
      ],
    ]),
  ],
  [
    'globby',
    new Map([
      [
        '6.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-globby-6.1.0-integrity/node_modules/globby/',
          ),
          packageDependencies: new Map([
            ['array-union', '1.0.2'],
            ['glob', '7.1.6'],
            ['object-assign', '4.1.1'],
            ['pify', '2.3.0'],
            ['pinkie-promise', '2.0.1'],
            ['globby', '6.1.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'array-union',
    new Map([
      [
        '1.0.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-array-union-1.0.2-integrity/node_modules/array-union/',
          ),
          packageDependencies: new Map([
            ['array-uniq', '1.0.3'],
            ['array-union', '1.0.2'],
          ]),
        },
      ],
      [
        '2.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-array-union-2.1.0-integrity/node_modules/array-union/',
          ),
          packageDependencies: new Map([['array-union', '2.1.0']]),
        },
      ],
    ]),
  ],
  [
    'array-uniq',
    new Map([
      [
        '1.0.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-array-uniq-1.0.3-integrity/node_modules/array-uniq/',
          ),
          packageDependencies: new Map([['array-uniq', '1.0.3']]),
        },
      ],
    ]),
  ],
  [
    'pify',
    new Map([
      [
        '2.3.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-pify-2.3.0-integrity/node_modules/pify/',
          ),
          packageDependencies: new Map([['pify', '2.3.0']]),
        },
      ],
    ]),
  ],
  [
    'pinkie-promise',
    new Map([
      [
        '2.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-pinkie-promise-2.0.1-integrity/node_modules/pinkie-promise/',
          ),
          packageDependencies: new Map([
            ['pinkie', '2.0.4'],
            ['pinkie-promise', '2.0.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'pinkie',
    new Map([
      [
        '2.0.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-pinkie-2.0.4-integrity/node_modules/pinkie/',
          ),
          packageDependencies: new Map([['pinkie', '2.0.4']]),
        },
      ],
    ]),
  ],
  [
    'husky',
    new Map([
      [
        '7.0.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-husky-7.0.4-integrity/node_modules/husky/',
          ),
          packageDependencies: new Map([['husky', '7.0.4']]),
        },
      ],
    ]),
  ],
  [
    'install',
    new Map([
      [
        '0.13.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-install-0.13.0-integrity/node_modules/install/',
          ),
          packageDependencies: new Map([['install', '0.13.0']]),
        },
      ],
    ]),
  ],
  [
    'msw',
    new Map([
      [
        '0.47.4',
        {
          packageLocation: path.resolve(__dirname, './.pnp/unplugged/npm-msw-0.47.4-integrity/node_modules/msw/'),
          packageDependencies: new Map([
            ['typescript', '4.8.4'],
            ['@mswjs/cookies', '0.2.2'],
            ['@mswjs/interceptors', '0.17.6'],
            ['@open-draft/until', '1.0.3'],
            ['@types/cookie', '0.4.1'],
            ['@types/js-levenshtein', '1.1.1'],
            ['chalk', '4.1.1'],
            ['chokidar', '3.5.3'],
            ['cookie', '0.4.2'],
            ['graphql', '16.6.0'],
            ['headers-polyfill', '3.1.2'],
            ['inquirer', '8.2.5'],
            ['is-node-process', '1.0.1'],
            ['js-levenshtein', '1.1.6'],
            ['node-fetch', 'pnp:982153c1d9d071a0501dbce5b86403d2fa9ccf39'],
            ['outvariant', '1.3.0'],
            ['path-to-regexp', '6.2.1'],
            ['statuses', '2.0.1'],
            ['strict-event-emitter', '0.2.8'],
            ['type-fest', '2.19.0'],
            ['yargs', '17.6.0'],
            ['msw', '0.47.4'],
          ]),
        },
      ],
    ]),
  ],
  [
    '@mswjs/cookies',
    new Map([
      [
        '0.2.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@mswjs-cookies-0.2.2-integrity/node_modules/@mswjs/cookies/',
          ),
          packageDependencies: new Map([
            ['@types/set-cookie-parser', '2.4.2'],
            ['set-cookie-parser', '2.5.1'],
            ['@mswjs/cookies', '0.2.2'],
          ]),
        },
      ],
    ]),
  ],
  [
    '@types/set-cookie-parser',
    new Map([
      [
        '2.4.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@types-set-cookie-parser-2.4.2-integrity/node_modules/@types/set-cookie-parser/',
          ),
          packageDependencies: new Map([
            ['@types/node', '18.11.5'],
            ['@types/set-cookie-parser', '2.4.2'],
          ]),
        },
      ],
    ]),
  ],
  [
    'set-cookie-parser',
    new Map([
      [
        '2.5.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-set-cookie-parser-2.5.1-integrity/node_modules/set-cookie-parser/',
          ),
          packageDependencies: new Map([['set-cookie-parser', '2.5.1']]),
        },
      ],
    ]),
  ],
  [
    '@mswjs/interceptors',
    new Map([
      [
        '0.17.6',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@mswjs-interceptors-0.17.6-integrity/node_modules/@mswjs/interceptors/',
          ),
          packageDependencies: new Map([
            ['@open-draft/until', '1.0.3'],
            ['@types/debug', '4.1.7'],
            ['@xmldom/xmldom', '0.8.3'],
            ['debug', '4.3.4'],
            ['headers-polyfill', '3.1.2'],
            ['outvariant', '1.3.0'],
            ['strict-event-emitter', '0.2.8'],
            ['web-encoding', '1.1.5'],
            ['@mswjs/interceptors', '0.17.6'],
          ]),
        },
      ],
    ]),
  ],
  [
    '@open-draft/until',
    new Map([
      [
        '1.0.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@open-draft-until-1.0.3-integrity/node_modules/@open-draft/until/',
          ),
          packageDependencies: new Map([['@open-draft/until', '1.0.3']]),
        },
      ],
    ]),
  ],
  [
    '@xmldom/xmldom',
    new Map([
      [
        '0.8.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@xmldom-xmldom-0.8.3-integrity/node_modules/@xmldom/xmldom/',
          ),
          packageDependencies: new Map([['@xmldom/xmldom', '0.8.3']]),
        },
      ],
    ]),
  ],
  [
    'headers-polyfill',
    new Map([
      [
        '3.1.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-headers-polyfill-3.1.2-integrity/node_modules/headers-polyfill/',
          ),
          packageDependencies: new Map([['headers-polyfill', '3.1.2']]),
        },
      ],
    ]),
  ],
  [
    'outvariant',
    new Map([
      [
        '1.3.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-outvariant-1.3.0-integrity/node_modules/outvariant/',
          ),
          packageDependencies: new Map([['outvariant', '1.3.0']]),
        },
      ],
    ]),
  ],
  [
    'strict-event-emitter',
    new Map([
      [
        '0.2.8',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-strict-event-emitter-0.2.8-integrity/node_modules/strict-event-emitter/',
          ),
          packageDependencies: new Map([
            ['events', '3.3.0'],
            ['strict-event-emitter', '0.2.8'],
          ]),
        },
      ],
    ]),
  ],
  [
    'events',
    new Map([
      [
        '3.3.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-events-3.3.0-integrity/node_modules/events/',
          ),
          packageDependencies: new Map([['events', '3.3.0']]),
        },
      ],
    ]),
  ],
  [
    'web-encoding',
    new Map([
      [
        '1.1.5',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-web-encoding-1.1.5-integrity/node_modules/web-encoding/',
          ),
          packageDependencies: new Map([
            ['util', '0.12.5'],
            ['@zxing/text-encoding', '0.9.0'],
            ['web-encoding', '1.1.5'],
          ]),
        },
      ],
    ]),
  ],
  [
    'util',
    new Map([
      [
        '0.12.5',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-util-0.12.5-integrity/node_modules/util/',
          ),
          packageDependencies: new Map([
            ['inherits', '2.0.4'],
            ['is-arguments', '1.1.1'],
            ['is-generator-function', '1.0.10'],
            ['is-typed-array', '1.1.9'],
            ['which-typed-array', '1.1.8'],
            ['util', '0.12.5'],
          ]),
        },
      ],
    ]),
  ],
  [
    'is-arguments',
    new Map([
      [
        '1.1.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-arguments-1.1.1-integrity/node_modules/is-arguments/',
          ),
          packageDependencies: new Map([
            ['call-bind', '1.0.2'],
            ['has-tostringtag', '1.0.0'],
            ['is-arguments', '1.1.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'call-bind',
    new Map([
      [
        '1.0.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-call-bind-1.0.2-integrity/node_modules/call-bind/',
          ),
          packageDependencies: new Map([
            ['function-bind', '1.1.1'],
            ['get-intrinsic', '1.1.3'],
            ['call-bind', '1.0.2'],
          ]),
        },
      ],
    ]),
  ],
  [
    'function-bind',
    new Map([
      [
        '1.1.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-function-bind-1.1.1-integrity/node_modules/function-bind/',
          ),
          packageDependencies: new Map([['function-bind', '1.1.1']]),
        },
      ],
    ]),
  ],
  [
    'get-intrinsic',
    new Map([
      [
        '1.1.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-get-intrinsic-1.1.3-integrity/node_modules/get-intrinsic/',
          ),
          packageDependencies: new Map([
            ['function-bind', '1.1.1'],
            ['has', '1.0.3'],
            ['has-symbols', '1.0.3'],
            ['get-intrinsic', '1.1.3'],
          ]),
        },
      ],
    ]),
  ],
  [
    'has',
    new Map([
      [
        '1.0.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-has-1.0.3-integrity/node_modules/has/',
          ),
          packageDependencies: new Map([
            ['function-bind', '1.1.1'],
            ['has', '1.0.3'],
          ]),
        },
      ],
    ]),
  ],
  [
    'has-symbols',
    new Map([
      [
        '1.0.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-has-symbols-1.0.3-integrity/node_modules/has-symbols/',
          ),
          packageDependencies: new Map([['has-symbols', '1.0.3']]),
        },
      ],
    ]),
  ],
  [
    'has-tostringtag',
    new Map([
      [
        '1.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-has-tostringtag-1.0.0-integrity/node_modules/has-tostringtag/',
          ),
          packageDependencies: new Map([
            ['has-symbols', '1.0.3'],
            ['has-tostringtag', '1.0.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'is-generator-function',
    new Map([
      [
        '1.0.10',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-generator-function-1.0.10-integrity/node_modules/is-generator-function/',
          ),
          packageDependencies: new Map([
            ['has-tostringtag', '1.0.0'],
            ['is-generator-function', '1.0.10'],
          ]),
        },
      ],
    ]),
  ],
  [
    'is-typed-array',
    new Map([
      [
        '1.1.9',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-typed-array-1.1.9-integrity/node_modules/is-typed-array/',
          ),
          packageDependencies: new Map([
            ['available-typed-arrays', '1.0.5'],
            ['call-bind', '1.0.2'],
            ['es-abstract', '1.20.4'],
            ['for-each', '0.3.3'],
            ['has-tostringtag', '1.0.0'],
            ['is-typed-array', '1.1.9'],
          ]),
        },
      ],
    ]),
  ],
  [
    'available-typed-arrays',
    new Map([
      [
        '1.0.5',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-available-typed-arrays-1.0.5-integrity/node_modules/available-typed-arrays/',
          ),
          packageDependencies: new Map([['available-typed-arrays', '1.0.5']]),
        },
      ],
    ]),
  ],
  [
    'es-abstract',
    new Map([
      [
        '1.20.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-es-abstract-1.20.4-integrity/node_modules/es-abstract/',
          ),
          packageDependencies: new Map([
            ['call-bind', '1.0.2'],
            ['es-to-primitive', '1.2.1'],
            ['function-bind', '1.1.1'],
            ['function.prototype.name', '1.1.5'],
            ['get-intrinsic', '1.1.3'],
            ['get-symbol-description', '1.0.0'],
            ['has', '1.0.3'],
            ['has-property-descriptors', '1.0.0'],
            ['has-symbols', '1.0.3'],
            ['internal-slot', '1.0.3'],
            ['is-callable', '1.2.7'],
            ['is-negative-zero', '2.0.2'],
            ['is-regex', '1.1.4'],
            ['is-shared-array-buffer', '1.0.2'],
            ['is-string', '1.0.7'],
            ['is-weakref', '1.0.2'],
            ['object-inspect', '1.12.2'],
            ['object-keys', '1.1.1'],
            ['object.assign', '4.1.4'],
            ['regexp.prototype.flags', '1.4.3'],
            ['safe-regex-test', '1.0.0'],
            ['string.prototype.trimend', '1.0.5'],
            ['string.prototype.trimstart', '1.0.5'],
            ['unbox-primitive', '1.0.2'],
            ['es-abstract', '1.20.4'],
          ]),
        },
      ],
    ]),
  ],
  [
    'es-to-primitive',
    new Map([
      [
        '1.2.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-es-to-primitive-1.2.1-integrity/node_modules/es-to-primitive/',
          ),
          packageDependencies: new Map([
            ['is-callable', '1.2.7'],
            ['is-date-object', '1.0.5'],
            ['is-symbol', '1.0.4'],
            ['es-to-primitive', '1.2.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'is-callable',
    new Map([
      [
        '1.2.7',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-callable-1.2.7-integrity/node_modules/is-callable/',
          ),
          packageDependencies: new Map([['is-callable', '1.2.7']]),
        },
      ],
    ]),
  ],
  [
    'is-date-object',
    new Map([
      [
        '1.0.5',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-date-object-1.0.5-integrity/node_modules/is-date-object/',
          ),
          packageDependencies: new Map([
            ['has-tostringtag', '1.0.0'],
            ['is-date-object', '1.0.5'],
          ]),
        },
      ],
    ]),
  ],
  [
    'is-symbol',
    new Map([
      [
        '1.0.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-symbol-1.0.4-integrity/node_modules/is-symbol/',
          ),
          packageDependencies: new Map([
            ['has-symbols', '1.0.3'],
            ['is-symbol', '1.0.4'],
          ]),
        },
      ],
    ]),
  ],
  [
    'function.prototype.name',
    new Map([
      [
        '1.1.5',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-function-prototype-name-1.1.5-integrity/node_modules/function.prototype.name/',
          ),
          packageDependencies: new Map([
            ['call-bind', '1.0.2'],
            ['define-properties', '1.1.4'],
            ['es-abstract', '1.20.4'],
            ['functions-have-names', '1.2.3'],
            ['function.prototype.name', '1.1.5'],
          ]),
        },
      ],
    ]),
  ],
  [
    'define-properties',
    new Map([
      [
        '1.1.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-define-properties-1.1.4-integrity/node_modules/define-properties/',
          ),
          packageDependencies: new Map([
            ['has-property-descriptors', '1.0.0'],
            ['object-keys', '1.1.1'],
            ['define-properties', '1.1.4'],
          ]),
        },
      ],
    ]),
  ],
  [
    'has-property-descriptors',
    new Map([
      [
        '1.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-has-property-descriptors-1.0.0-integrity/node_modules/has-property-descriptors/',
          ),
          packageDependencies: new Map([
            ['get-intrinsic', '1.1.3'],
            ['has-property-descriptors', '1.0.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'object-keys',
    new Map([
      [
        '1.1.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-object-keys-1.1.1-integrity/node_modules/object-keys/',
          ),
          packageDependencies: new Map([['object-keys', '1.1.1']]),
        },
      ],
    ]),
  ],
  [
    'functions-have-names',
    new Map([
      [
        '1.2.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-functions-have-names-1.2.3-integrity/node_modules/functions-have-names/',
          ),
          packageDependencies: new Map([['functions-have-names', '1.2.3']]),
        },
      ],
    ]),
  ],
  [
    'get-symbol-description',
    new Map([
      [
        '1.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-get-symbol-description-1.0.0-integrity/node_modules/get-symbol-description/',
          ),
          packageDependencies: new Map([
            ['call-bind', '1.0.2'],
            ['get-intrinsic', '1.1.3'],
            ['get-symbol-description', '1.0.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'internal-slot',
    new Map([
      [
        '1.0.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-internal-slot-1.0.3-integrity/node_modules/internal-slot/',
          ),
          packageDependencies: new Map([
            ['get-intrinsic', '1.1.3'],
            ['has', '1.0.3'],
            ['side-channel', '1.0.4'],
            ['internal-slot', '1.0.3'],
          ]),
        },
      ],
    ]),
  ],
  [
    'side-channel',
    new Map([
      [
        '1.0.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-side-channel-1.0.4-integrity/node_modules/side-channel/',
          ),
          packageDependencies: new Map([
            ['call-bind', '1.0.2'],
            ['get-intrinsic', '1.1.3'],
            ['object-inspect', '1.12.2'],
            ['side-channel', '1.0.4'],
          ]),
        },
      ],
    ]),
  ],
  [
    'object-inspect',
    new Map([
      [
        '1.12.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-object-inspect-1.12.2-integrity/node_modules/object-inspect/',
          ),
          packageDependencies: new Map([['object-inspect', '1.12.2']]),
        },
      ],
    ]),
  ],
  [
    'is-negative-zero',
    new Map([
      [
        '2.0.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-negative-zero-2.0.2-integrity/node_modules/is-negative-zero/',
          ),
          packageDependencies: new Map([['is-negative-zero', '2.0.2']]),
        },
      ],
    ]),
  ],
  [
    'is-regex',
    new Map([
      [
        '1.1.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-regex-1.1.4-integrity/node_modules/is-regex/',
          ),
          packageDependencies: new Map([
            ['call-bind', '1.0.2'],
            ['has-tostringtag', '1.0.0'],
            ['is-regex', '1.1.4'],
          ]),
        },
      ],
    ]),
  ],
  [
    'is-shared-array-buffer',
    new Map([
      [
        '1.0.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-shared-array-buffer-1.0.2-integrity/node_modules/is-shared-array-buffer/',
          ),
          packageDependencies: new Map([
            ['call-bind', '1.0.2'],
            ['is-shared-array-buffer', '1.0.2'],
          ]),
        },
      ],
    ]),
  ],
  [
    'is-string',
    new Map([
      [
        '1.0.7',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-string-1.0.7-integrity/node_modules/is-string/',
          ),
          packageDependencies: new Map([
            ['has-tostringtag', '1.0.0'],
            ['is-string', '1.0.7'],
          ]),
        },
      ],
    ]),
  ],
  [
    'is-weakref',
    new Map([
      [
        '1.0.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-weakref-1.0.2-integrity/node_modules/is-weakref/',
          ),
          packageDependencies: new Map([
            ['call-bind', '1.0.2'],
            ['is-weakref', '1.0.2'],
          ]),
        },
      ],
    ]),
  ],
  [
    'object.assign',
    new Map([
      [
        '4.1.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-object-assign-4.1.4-integrity/node_modules/object.assign/',
          ),
          packageDependencies: new Map([
            ['call-bind', '1.0.2'],
            ['define-properties', '1.1.4'],
            ['has-symbols', '1.0.3'],
            ['object-keys', '1.1.1'],
            ['object.assign', '4.1.4'],
          ]),
        },
      ],
    ]),
  ],
  [
    'regexp.prototype.flags',
    new Map([
      [
        '1.4.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-regexp-prototype-flags-1.4.3-integrity/node_modules/regexp.prototype.flags/',
          ),
          packageDependencies: new Map([
            ['call-bind', '1.0.2'],
            ['define-properties', '1.1.4'],
            ['functions-have-names', '1.2.3'],
            ['regexp.prototype.flags', '1.4.3'],
          ]),
        },
      ],
    ]),
  ],
  [
    'safe-regex-test',
    new Map([
      [
        '1.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-safe-regex-test-1.0.0-integrity/node_modules/safe-regex-test/',
          ),
          packageDependencies: new Map([
            ['call-bind', '1.0.2'],
            ['get-intrinsic', '1.1.3'],
            ['is-regex', '1.1.4'],
            ['safe-regex-test', '1.0.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'string.prototype.trimend',
    new Map([
      [
        '1.0.5',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-string-prototype-trimend-1.0.5-integrity/node_modules/string.prototype.trimend/',
          ),
          packageDependencies: new Map([
            ['call-bind', '1.0.2'],
            ['define-properties', '1.1.4'],
            ['es-abstract', '1.20.4'],
            ['string.prototype.trimend', '1.0.5'],
          ]),
        },
      ],
    ]),
  ],
  [
    'string.prototype.trimstart',
    new Map([
      [
        '1.0.5',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-string-prototype-trimstart-1.0.5-integrity/node_modules/string.prototype.trimstart/',
          ),
          packageDependencies: new Map([
            ['call-bind', '1.0.2'],
            ['define-properties', '1.1.4'],
            ['es-abstract', '1.20.4'],
            ['string.prototype.trimstart', '1.0.5'],
          ]),
        },
      ],
    ]),
  ],
  [
    'unbox-primitive',
    new Map([
      [
        '1.0.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-unbox-primitive-1.0.2-integrity/node_modules/unbox-primitive/',
          ),
          packageDependencies: new Map([
            ['call-bind', '1.0.2'],
            ['has-bigints', '1.0.2'],
            ['has-symbols', '1.0.3'],
            ['which-boxed-primitive', '1.0.2'],
            ['unbox-primitive', '1.0.2'],
          ]),
        },
      ],
    ]),
  ],
  [
    'has-bigints',
    new Map([
      [
        '1.0.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-has-bigints-1.0.2-integrity/node_modules/has-bigints/',
          ),
          packageDependencies: new Map([['has-bigints', '1.0.2']]),
        },
      ],
    ]),
  ],
  [
    'which-boxed-primitive',
    new Map([
      [
        '1.0.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-which-boxed-primitive-1.0.2-integrity/node_modules/which-boxed-primitive/',
          ),
          packageDependencies: new Map([
            ['is-bigint', '1.0.4'],
            ['is-boolean-object', '1.1.2'],
            ['is-number-object', '1.0.7'],
            ['is-string', '1.0.7'],
            ['is-symbol', '1.0.4'],
            ['which-boxed-primitive', '1.0.2'],
          ]),
        },
      ],
    ]),
  ],
  [
    'is-bigint',
    new Map([
      [
        '1.0.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-bigint-1.0.4-integrity/node_modules/is-bigint/',
          ),
          packageDependencies: new Map([
            ['has-bigints', '1.0.2'],
            ['is-bigint', '1.0.4'],
          ]),
        },
      ],
    ]),
  ],
  [
    'is-boolean-object',
    new Map([
      [
        '1.1.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-boolean-object-1.1.2-integrity/node_modules/is-boolean-object/',
          ),
          packageDependencies: new Map([
            ['call-bind', '1.0.2'],
            ['has-tostringtag', '1.0.0'],
            ['is-boolean-object', '1.1.2'],
          ]),
        },
      ],
    ]),
  ],
  [
    'is-number-object',
    new Map([
      [
        '1.0.7',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-number-object-1.0.7-integrity/node_modules/is-number-object/',
          ),
          packageDependencies: new Map([
            ['has-tostringtag', '1.0.0'],
            ['is-number-object', '1.0.7'],
          ]),
        },
      ],
    ]),
  ],
  [
    'for-each',
    new Map([
      [
        '0.3.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-for-each-0.3.3-integrity/node_modules/for-each/',
          ),
          packageDependencies: new Map([
            ['is-callable', '1.2.7'],
            ['for-each', '0.3.3'],
          ]),
        },
      ],
    ]),
  ],
  [
    'which-typed-array',
    new Map([
      [
        '1.1.8',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-which-typed-array-1.1.8-integrity/node_modules/which-typed-array/',
          ),
          packageDependencies: new Map([
            ['available-typed-arrays', '1.0.5'],
            ['call-bind', '1.0.2'],
            ['es-abstract', '1.20.4'],
            ['for-each', '0.3.3'],
            ['has-tostringtag', '1.0.0'],
            ['is-typed-array', '1.1.9'],
            ['which-typed-array', '1.1.8'],
          ]),
        },
      ],
    ]),
  ],
  [
    '@zxing/text-encoding',
    new Map([
      [
        '0.9.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@zxing-text-encoding-0.9.0-integrity/node_modules/@zxing/text-encoding/',
          ),
          packageDependencies: new Map([['@zxing/text-encoding', '0.9.0']]),
        },
      ],
    ]),
  ],
  [
    '@types/cookie',
    new Map([
      [
        '0.4.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@types-cookie-0.4.1-integrity/node_modules/@types/cookie/',
          ),
          packageDependencies: new Map([['@types/cookie', '0.4.1']]),
        },
      ],
    ]),
  ],
  [
    '@types/js-levenshtein',
    new Map([
      [
        '1.1.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@types-js-levenshtein-1.1.1-integrity/node_modules/@types/js-levenshtein/',
          ),
          packageDependencies: new Map([['@types/js-levenshtein', '1.1.1']]),
        },
      ],
    ]),
  ],
  [
    'chokidar',
    new Map([
      [
        '3.5.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-chokidar-3.5.3-integrity/node_modules/chokidar/',
          ),
          packageDependencies: new Map([
            ['anymatch', '3.1.2'],
            ['braces', '3.0.2'],
            ['glob-parent', '5.1.2'],
            ['is-binary-path', '2.1.0'],
            ['is-glob', '4.0.3'],
            ['normalize-path', '3.0.0'],
            ['readdirp', '3.6.0'],
            ['fsevents', '2.3.2'],
            ['chokidar', '3.5.3'],
          ]),
        },
      ],
    ]),
  ],
  [
    'anymatch',
    new Map([
      [
        '3.1.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-anymatch-3.1.2-integrity/node_modules/anymatch/',
          ),
          packageDependencies: new Map([
            ['normalize-path', '3.0.0'],
            ['picomatch', '2.3.1'],
            ['anymatch', '3.1.2'],
          ]),
        },
      ],
    ]),
  ],
  [
    'normalize-path',
    new Map([
      [
        '3.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-normalize-path-3.0.0-integrity/node_modules/normalize-path/',
          ),
          packageDependencies: new Map([['normalize-path', '3.0.0']]),
        },
      ],
    ]),
  ],
  [
    'picomatch',
    new Map([
      [
        '2.3.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-picomatch-2.3.1-integrity/node_modules/picomatch/',
          ),
          packageDependencies: new Map([['picomatch', '2.3.1']]),
        },
      ],
    ]),
  ],
  [
    'braces',
    new Map([
      [
        '3.0.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-braces-3.0.2-integrity/node_modules/braces/',
          ),
          packageDependencies: new Map([
            ['fill-range', '7.0.1'],
            ['braces', '3.0.2'],
          ]),
        },
      ],
    ]),
  ],
  [
    'fill-range',
    new Map([
      [
        '7.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-fill-range-7.0.1-integrity/node_modules/fill-range/',
          ),
          packageDependencies: new Map([
            ['to-regex-range', '5.0.1'],
            ['fill-range', '7.0.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'to-regex-range',
    new Map([
      [
        '5.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-to-regex-range-5.0.1-integrity/node_modules/to-regex-range/',
          ),
          packageDependencies: new Map([
            ['is-number', '7.0.0'],
            ['to-regex-range', '5.0.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'is-number',
    new Map([
      [
        '7.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-number-7.0.0-integrity/node_modules/is-number/',
          ),
          packageDependencies: new Map([['is-number', '7.0.0']]),
        },
      ],
    ]),
  ],
  [
    'glob-parent',
    new Map([
      [
        '5.1.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-glob-parent-5.1.2-integrity/node_modules/glob-parent/',
          ),
          packageDependencies: new Map([
            ['is-glob', '4.0.3'],
            ['glob-parent', '5.1.2'],
          ]),
        },
      ],
    ]),
  ],
  [
    'is-glob',
    new Map([
      [
        '4.0.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-glob-4.0.3-integrity/node_modules/is-glob/',
          ),
          packageDependencies: new Map([
            ['is-extglob', '2.1.1'],
            ['is-glob', '4.0.3'],
          ]),
        },
      ],
    ]),
  ],
  [
    'is-extglob',
    new Map([
      [
        '2.1.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-extglob-2.1.1-integrity/node_modules/is-extglob/',
          ),
          packageDependencies: new Map([['is-extglob', '2.1.1']]),
        },
      ],
    ]),
  ],
  [
    'is-binary-path',
    new Map([
      [
        '2.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-binary-path-2.1.0-integrity/node_modules/is-binary-path/',
          ),
          packageDependencies: new Map([
            ['binary-extensions', '2.2.0'],
            ['is-binary-path', '2.1.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'binary-extensions',
    new Map([
      [
        '2.2.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-binary-extensions-2.2.0-integrity/node_modules/binary-extensions/',
          ),
          packageDependencies: new Map([['binary-extensions', '2.2.0']]),
        },
      ],
    ]),
  ],
  [
    'readdirp',
    new Map([
      [
        '3.6.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-readdirp-3.6.0-integrity/node_modules/readdirp/',
          ),
          packageDependencies: new Map([
            ['picomatch', '2.3.1'],
            ['readdirp', '3.6.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'fsevents',
    new Map([
      [
        '2.3.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-fsevents-2.3.2-integrity/node_modules/fsevents/',
          ),
          packageDependencies: new Map([['fsevents', '2.3.2']]),
        },
      ],
    ]),
  ],
  [
    'cookie',
    new Map([
      [
        '0.4.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-cookie-0.4.2-integrity/node_modules/cookie/',
          ),
          packageDependencies: new Map([['cookie', '0.4.2']]),
        },
      ],
    ]),
  ],
  [
    'graphql',
    new Map([
      [
        '16.6.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-graphql-16.6.0-integrity/node_modules/graphql/',
          ),
          packageDependencies: new Map([['graphql', '16.6.0']]),
        },
      ],
    ]),
  ],
  [
    'inquirer',
    new Map([
      [
        '8.2.5',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-inquirer-8.2.5-integrity/node_modules/inquirer/',
          ),
          packageDependencies: new Map([
            ['ansi-escapes', '4.3.2'],
            ['chalk', '4.1.1'],
            ['cli-cursor', '3.1.0'],
            ['cli-width', '3.0.0'],
            ['external-editor', '3.1.0'],
            ['figures', '3.2.0'],
            ['lodash', '4.17.21'],
            ['mute-stream', '0.0.8'],
            ['ora', '5.4.1'],
            ['run-async', '2.4.1'],
            ['rxjs', '7.5.7'],
            ['string-width', '4.2.3'],
            ['strip-ansi', '6.0.1'],
            ['through', '2.3.8'],
            ['wrap-ansi', '7.0.0'],
            ['inquirer', '8.2.5'],
          ]),
        },
      ],
    ]),
  ],
  [
    'ansi-escapes',
    new Map([
      [
        '4.3.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-ansi-escapes-4.3.2-integrity/node_modules/ansi-escapes/',
          ),
          packageDependencies: new Map([
            ['type-fest', '0.21.3'],
            ['ansi-escapes', '4.3.2'],
          ]),
        },
      ],
    ]),
  ],
  [
    'type-fest',
    new Map([
      [
        '0.21.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-type-fest-0.21.3-integrity/node_modules/type-fest/',
          ),
          packageDependencies: new Map([['type-fest', '0.21.3']]),
        },
      ],
      [
        '2.19.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-type-fest-2.19.0-integrity/node_modules/type-fest/',
          ),
          packageDependencies: new Map([['type-fest', '2.19.0']]),
        },
      ],
    ]),
  ],
  [
    'cli-cursor',
    new Map([
      [
        '3.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-cli-cursor-3.1.0-integrity/node_modules/cli-cursor/',
          ),
          packageDependencies: new Map([
            ['restore-cursor', '3.1.0'],
            ['cli-cursor', '3.1.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'restore-cursor',
    new Map([
      [
        '3.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-restore-cursor-3.1.0-integrity/node_modules/restore-cursor/',
          ),
          packageDependencies: new Map([
            ['onetime', '5.1.2'],
            ['signal-exit', '3.0.7'],
            ['restore-cursor', '3.1.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'onetime',
    new Map([
      [
        '5.1.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-onetime-5.1.2-integrity/node_modules/onetime/',
          ),
          packageDependencies: new Map([
            ['mimic-fn', '2.1.0'],
            ['onetime', '5.1.2'],
          ]),
        },
      ],
    ]),
  ],
  [
    'mimic-fn',
    new Map([
      [
        '2.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-mimic-fn-2.1.0-integrity/node_modules/mimic-fn/',
          ),
          packageDependencies: new Map([['mimic-fn', '2.1.0']]),
        },
      ],
    ]),
  ],
  [
    'signal-exit',
    new Map([
      [
        '3.0.7',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-signal-exit-3.0.7-integrity/node_modules/signal-exit/',
          ),
          packageDependencies: new Map([['signal-exit', '3.0.7']]),
        },
      ],
    ]),
  ],
  [
    'cli-width',
    new Map([
      [
        '3.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-cli-width-3.0.0-integrity/node_modules/cli-width/',
          ),
          packageDependencies: new Map([['cli-width', '3.0.0']]),
        },
      ],
    ]),
  ],
  [
    'external-editor',
    new Map([
      [
        '3.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-external-editor-3.1.0-integrity/node_modules/external-editor/',
          ),
          packageDependencies: new Map([
            ['chardet', '0.7.0'],
            ['iconv-lite', '0.4.24'],
            ['tmp', '0.0.33'],
            ['external-editor', '3.1.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'chardet',
    new Map([
      [
        '0.7.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-chardet-0.7.0-integrity/node_modules/chardet/',
          ),
          packageDependencies: new Map([['chardet', '0.7.0']]),
        },
      ],
    ]),
  ],
  [
    'iconv-lite',
    new Map([
      [
        '0.4.24',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-iconv-lite-0.4.24-integrity/node_modules/iconv-lite/',
          ),
          packageDependencies: new Map([
            ['safer-buffer', '2.1.2'],
            ['iconv-lite', '0.4.24'],
          ]),
        },
      ],
    ]),
  ],
  [
    'safer-buffer',
    new Map([
      [
        '2.1.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-safer-buffer-2.1.2-integrity/node_modules/safer-buffer/',
          ),
          packageDependencies: new Map([['safer-buffer', '2.1.2']]),
        },
      ],
    ]),
  ],
  [
    'tmp',
    new Map([
      [
        '0.0.33',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-tmp-0.0.33-integrity/node_modules/tmp/',
          ),
          packageDependencies: new Map([
            ['os-tmpdir', '1.0.2'],
            ['tmp', '0.0.33'],
          ]),
        },
      ],
    ]),
  ],
  [
    'os-tmpdir',
    new Map([
      [
        '1.0.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-os-tmpdir-1.0.2-integrity/node_modules/os-tmpdir/',
          ),
          packageDependencies: new Map([['os-tmpdir', '1.0.2']]),
        },
      ],
    ]),
  ],
  [
    'figures',
    new Map([
      [
        '3.2.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-figures-3.2.0-integrity/node_modules/figures/',
          ),
          packageDependencies: new Map([
            ['escape-string-regexp', '1.0.5'],
            ['figures', '3.2.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'mute-stream',
    new Map([
      [
        '0.0.8',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-mute-stream-0.0.8-integrity/node_modules/mute-stream/',
          ),
          packageDependencies: new Map([['mute-stream', '0.0.8']]),
        },
      ],
    ]),
  ],
  [
    'ora',
    new Map([
      [
        '5.4.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-ora-5.4.1-integrity/node_modules/ora/',
          ),
          packageDependencies: new Map([
            ['bl', '4.1.0'],
            ['chalk', '4.1.1'],
            ['cli-cursor', '3.1.0'],
            ['cli-spinners', '2.7.0'],
            ['is-interactive', '1.0.0'],
            ['is-unicode-supported', '0.1.0'],
            ['log-symbols', '4.1.0'],
            ['strip-ansi', '6.0.1'],
            ['wcwidth', '1.0.1'],
            ['ora', '5.4.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'cli-spinners',
    new Map([
      [
        '2.7.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-cli-spinners-2.7.0-integrity/node_modules/cli-spinners/',
          ),
          packageDependencies: new Map([['cli-spinners', '2.7.0']]),
        },
      ],
    ]),
  ],
  [
    'is-interactive',
    new Map([
      [
        '1.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-interactive-1.0.0-integrity/node_modules/is-interactive/',
          ),
          packageDependencies: new Map([['is-interactive', '1.0.0']]),
        },
      ],
    ]),
  ],
  [
    'is-unicode-supported',
    new Map([
      [
        '0.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-unicode-supported-0.1.0-integrity/node_modules/is-unicode-supported/',
          ),
          packageDependencies: new Map([['is-unicode-supported', '0.1.0']]),
        },
      ],
    ]),
  ],
  [
    'log-symbols',
    new Map([
      [
        '4.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-log-symbols-4.1.0-integrity/node_modules/log-symbols/',
          ),
          packageDependencies: new Map([
            ['chalk', '4.1.1'],
            ['is-unicode-supported', '0.1.0'],
            ['log-symbols', '4.1.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'strip-ansi',
    new Map([
      [
        '6.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-strip-ansi-6.0.1-integrity/node_modules/strip-ansi/',
          ),
          packageDependencies: new Map([
            ['ansi-regex', '5.0.1'],
            ['strip-ansi', '6.0.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'ansi-regex',
    new Map([
      [
        '5.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-ansi-regex-5.0.1-integrity/node_modules/ansi-regex/',
          ),
          packageDependencies: new Map([['ansi-regex', '5.0.1']]),
        },
      ],
    ]),
  ],
  [
    'wcwidth',
    new Map([
      [
        '1.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-wcwidth-1.0.1-integrity/node_modules/wcwidth/',
          ),
          packageDependencies: new Map([
            ['defaults', '1.0.4'],
            ['wcwidth', '1.0.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'defaults',
    new Map([
      [
        '1.0.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-defaults-1.0.4-integrity/node_modules/defaults/',
          ),
          packageDependencies: new Map([
            ['clone', '1.0.4'],
            ['defaults', '1.0.4'],
          ]),
        },
      ],
    ]),
  ],
  [
    'clone',
    new Map([
      [
        '1.0.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-clone-1.0.4-integrity/node_modules/clone/',
          ),
          packageDependencies: new Map([['clone', '1.0.4']]),
        },
      ],
    ]),
  ],
  [
    'run-async',
    new Map([
      [
        '2.4.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-run-async-2.4.1-integrity/node_modules/run-async/',
          ),
          packageDependencies: new Map([['run-async', '2.4.1']]),
        },
      ],
    ]),
  ],
  [
    'rxjs',
    new Map([
      [
        '7.5.7',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-rxjs-7.5.7-integrity/node_modules/rxjs/',
          ),
          packageDependencies: new Map([
            ['tslib', '2.4.0'],
            ['rxjs', '7.5.7'],
          ]),
        },
      ],
    ]),
  ],
  [
    'tslib',
    new Map([
      [
        '2.4.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-tslib-2.4.0-integrity/node_modules/tslib/',
          ),
          packageDependencies: new Map([['tslib', '2.4.0']]),
        },
      ],
    ]),
  ],
  [
    'string-width',
    new Map([
      [
        '4.2.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-string-width-4.2.3-integrity/node_modules/string-width/',
          ),
          packageDependencies: new Map([
            ['emoji-regex', '8.0.0'],
            ['is-fullwidth-code-point', '3.0.0'],
            ['strip-ansi', '6.0.1'],
            ['string-width', '4.2.3'],
          ]),
        },
      ],
    ]),
  ],
  [
    'emoji-regex',
    new Map([
      [
        '8.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-emoji-regex-8.0.0-integrity/node_modules/emoji-regex/',
          ),
          packageDependencies: new Map([['emoji-regex', '8.0.0']]),
        },
      ],
    ]),
  ],
  [
    'is-fullwidth-code-point',
    new Map([
      [
        '3.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-fullwidth-code-point-3.0.0-integrity/node_modules/is-fullwidth-code-point/',
          ),
          packageDependencies: new Map([['is-fullwidth-code-point', '3.0.0']]),
        },
      ],
    ]),
  ],
  [
    'wrap-ansi',
    new Map([
      [
        '7.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-wrap-ansi-7.0.0-integrity/node_modules/wrap-ansi/',
          ),
          packageDependencies: new Map([
            ['ansi-styles', '4.3.0'],
            ['string-width', '4.2.3'],
            ['strip-ansi', '6.0.1'],
            ['wrap-ansi', '7.0.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'is-node-process',
    new Map([
      [
        '1.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-node-process-1.0.1-integrity/node_modules/is-node-process/',
          ),
          packageDependencies: new Map([['is-node-process', '1.0.1']]),
        },
      ],
    ]),
  ],
  [
    'js-levenshtein',
    new Map([
      [
        '1.1.6',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-js-levenshtein-1.1.6-integrity/node_modules/js-levenshtein/',
          ),
          packageDependencies: new Map([['js-levenshtein', '1.1.6']]),
        },
      ],
    ]),
  ],
  [
    'path-to-regexp',
    new Map([
      [
        '6.2.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-path-to-regexp-6.2.1-integrity/node_modules/path-to-regexp/',
          ),
          packageDependencies: new Map([['path-to-regexp', '6.2.1']]),
        },
      ],
    ]),
  ],
  [
    'statuses',
    new Map([
      [
        '2.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-statuses-2.0.1-integrity/node_modules/statuses/',
          ),
          packageDependencies: new Map([['statuses', '2.0.1']]),
        },
      ],
    ]),
  ],
  [
    'yargs',
    new Map([
      [
        '17.6.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-yargs-17.6.0-integrity/node_modules/yargs/',
          ),
          packageDependencies: new Map([
            ['cliui', '8.0.1'],
            ['escalade', '3.1.1'],
            ['get-caller-file', '2.0.5'],
            ['require-directory', '2.1.1'],
            ['string-width', '4.2.3'],
            ['y18n', '5.0.8'],
            ['yargs-parser', '21.1.1'],
            ['yargs', '17.6.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'cliui',
    new Map([
      [
        '8.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-cliui-8.0.1-integrity/node_modules/cliui/',
          ),
          packageDependencies: new Map([
            ['string-width', '4.2.3'],
            ['strip-ansi', '6.0.1'],
            ['wrap-ansi', '7.0.0'],
            ['cliui', '8.0.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'escalade',
    new Map([
      [
        '3.1.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-escalade-3.1.1-integrity/node_modules/escalade/',
          ),
          packageDependencies: new Map([['escalade', '3.1.1']]),
        },
      ],
    ]),
  ],
  [
    'get-caller-file',
    new Map([
      [
        '2.0.5',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-get-caller-file-2.0.5-integrity/node_modules/get-caller-file/',
          ),
          packageDependencies: new Map([['get-caller-file', '2.0.5']]),
        },
      ],
    ]),
  ],
  [
    'require-directory',
    new Map([
      [
        '2.1.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-require-directory-2.1.1-integrity/node_modules/require-directory/',
          ),
          packageDependencies: new Map([['require-directory', '2.1.1']]),
        },
      ],
    ]),
  ],
  [
    'y18n',
    new Map([
      [
        '5.0.8',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-y18n-5.0.8-integrity/node_modules/y18n/',
          ),
          packageDependencies: new Map([['y18n', '5.0.8']]),
        },
      ],
    ]),
  ],
  [
    'yargs-parser',
    new Map([
      [
        '21.1.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-yargs-parser-21.1.1-integrity/node_modules/yargs-parser/',
          ),
          packageDependencies: new Map([['yargs-parser', '21.1.1']]),
        },
      ],
    ]),
  ],
  [
    'prettier',
    new Map([
      [
        '2.7.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-prettier-2.7.1-integrity/node_modules/prettier/',
          ),
          packageDependencies: new Map([['prettier', '2.7.1']]),
        },
      ],
    ]),
  ],
  [
    'pretty-quick',
    new Map([
      [
        '3.1.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-pretty-quick-3.1.3-integrity/node_modules/pretty-quick/',
          ),
          packageDependencies: new Map([
            ['prettier', '2.7.1'],
            ['chalk', '3.0.0'],
            ['execa', '4.1.0'],
            ['find-up', '4.1.0'],
            ['ignore', '5.2.0'],
            ['mri', '1.2.0'],
            ['multimatch', '4.0.0'],
            ['pretty-quick', '3.1.3'],
          ]),
        },
      ],
    ]),
  ],
  [
    'execa',
    new Map([
      [
        '4.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-execa-4.1.0-integrity/node_modules/execa/',
          ),
          packageDependencies: new Map([
            ['cross-spawn', '7.0.3'],
            ['get-stream', '5.2.0'],
            ['human-signals', '1.1.1'],
            ['is-stream', '2.0.1'],
            ['merge-stream', '2.0.0'],
            ['npm-run-path', '4.0.1'],
            ['onetime', '5.1.2'],
            ['signal-exit', '3.0.7'],
            ['strip-final-newline', '2.0.0'],
            ['execa', '4.1.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'cross-spawn',
    new Map([
      [
        '7.0.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-cross-spawn-7.0.3-integrity/node_modules/cross-spawn/',
          ),
          packageDependencies: new Map([
            ['path-key', '3.1.1'],
            ['shebang-command', '2.0.0'],
            ['which', '2.0.2'],
            ['cross-spawn', '7.0.3'],
          ]),
        },
      ],
    ]),
  ],
  [
    'path-key',
    new Map([
      [
        '3.1.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-path-key-3.1.1-integrity/node_modules/path-key/',
          ),
          packageDependencies: new Map([['path-key', '3.1.1']]),
        },
      ],
    ]),
  ],
  [
    'shebang-command',
    new Map([
      [
        '2.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-shebang-command-2.0.0-integrity/node_modules/shebang-command/',
          ),
          packageDependencies: new Map([
            ['shebang-regex', '3.0.0'],
            ['shebang-command', '2.0.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'shebang-regex',
    new Map([
      [
        '3.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-shebang-regex-3.0.0-integrity/node_modules/shebang-regex/',
          ),
          packageDependencies: new Map([['shebang-regex', '3.0.0']]),
        },
      ],
    ]),
  ],
  [
    'which',
    new Map([
      [
        '2.0.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-which-2.0.2-integrity/node_modules/which/',
          ),
          packageDependencies: new Map([
            ['isexe', '2.0.0'],
            ['which', '2.0.2'],
          ]),
        },
      ],
    ]),
  ],
  [
    'isexe',
    new Map([
      [
        '2.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-isexe-2.0.0-integrity/node_modules/isexe/',
          ),
          packageDependencies: new Map([['isexe', '2.0.0']]),
        },
      ],
    ]),
  ],
  [
    'human-signals',
    new Map([
      [
        '1.1.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-human-signals-1.1.1-integrity/node_modules/human-signals/',
          ),
          packageDependencies: new Map([['human-signals', '1.1.1']]),
        },
      ],
    ]),
  ],
  [
    'is-stream',
    new Map([
      [
        '2.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-stream-2.0.1-integrity/node_modules/is-stream/',
          ),
          packageDependencies: new Map([['is-stream', '2.0.1']]),
        },
      ],
    ]),
  ],
  [
    'merge-stream',
    new Map([
      [
        '2.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-merge-stream-2.0.0-integrity/node_modules/merge-stream/',
          ),
          packageDependencies: new Map([['merge-stream', '2.0.0']]),
        },
      ],
    ]),
  ],
  [
    'npm-run-path',
    new Map([
      [
        '4.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-npm-run-path-4.0.1-integrity/node_modules/npm-run-path/',
          ),
          packageDependencies: new Map([
            ['path-key', '3.1.1'],
            ['npm-run-path', '4.0.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'strip-final-newline',
    new Map([
      [
        '2.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-strip-final-newline-2.0.0-integrity/node_modules/strip-final-newline/',
          ),
          packageDependencies: new Map([['strip-final-newline', '2.0.0']]),
        },
      ],
    ]),
  ],
  [
    'ignore',
    new Map([
      [
        '5.2.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-ignore-5.2.0-integrity/node_modules/ignore/',
          ),
          packageDependencies: new Map([['ignore', '5.2.0']]),
        },
      ],
    ]),
  ],
  [
    'mri',
    new Map([
      [
        '1.2.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-mri-1.2.0-integrity/node_modules/mri/',
          ),
          packageDependencies: new Map([['mri', '1.2.0']]),
        },
      ],
    ]),
  ],
  [
    'multimatch',
    new Map([
      [
        '4.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-multimatch-4.0.0-integrity/node_modules/multimatch/',
          ),
          packageDependencies: new Map([
            ['@types/minimatch', '3.0.5'],
            ['array-differ', '3.0.0'],
            ['array-union', '2.1.0'],
            ['arrify', '2.0.1'],
            ['minimatch', '3.0.4'],
            ['multimatch', '4.0.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    '@types/minimatch',
    new Map([
      [
        '3.0.5',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@types-minimatch-3.0.5-integrity/node_modules/@types/minimatch/',
          ),
          packageDependencies: new Map([['@types/minimatch', '3.0.5']]),
        },
      ],
    ]),
  ],
  [
    'array-differ',
    new Map([
      [
        '3.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-array-differ-3.0.0-integrity/node_modules/array-differ/',
          ),
          packageDependencies: new Map([['array-differ', '3.0.0']]),
        },
      ],
    ]),
  ],
  [
    'arrify',
    new Map([
      [
        '2.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-arrify-2.0.1-integrity/node_modules/arrify/',
          ),
          packageDependencies: new Map([['arrify', '2.0.1']]),
        },
      ],
    ]),
  ],
  [
    'ts-node',
    new Map([
      [
        '10.9.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-ts-node-10.9.1-integrity/node_modules/ts-node/',
          ),
          packageDependencies: new Map([
            ['@types/node', '18.11.5'],
            ['typescript', '4.8.4'],
            ['@cspotcode/source-map-support', '0.8.1'],
            ['@tsconfig/node10', '1.0.8'],
            ['@tsconfig/node12', '1.0.9'],
            ['@tsconfig/node14', '1.0.1'],
            ['@tsconfig/node16', '1.0.2'],
            ['acorn', '8.8.1'],
            ['acorn-walk', '8.2.0'],
            ['arg', '4.1.3'],
            ['create-require', '1.1.1'],
            ['diff', '4.0.2'],
            ['make-error', '1.3.6'],
            ['v8-compile-cache-lib', '3.0.1'],
            ['yn', '3.1.1'],
            ['ts-node', '10.9.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    '@cspotcode/source-map-support',
    new Map([
      [
        '0.8.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@cspotcode-source-map-support-0.8.1-integrity/node_modules/@cspotcode/source-map-support/',
          ),
          packageDependencies: new Map([
            ['@jridgewell/trace-mapping', '0.3.9'],
            ['@cspotcode/source-map-support', '0.8.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    '@jridgewell/trace-mapping',
    new Map([
      [
        '0.3.9',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@jridgewell-trace-mapping-0.3.9-integrity/node_modules/@jridgewell/trace-mapping/',
          ),
          packageDependencies: new Map([
            ['@jridgewell/resolve-uri', '3.1.0'],
            ['@jridgewell/sourcemap-codec', '1.4.14'],
            ['@jridgewell/trace-mapping', '0.3.9'],
          ]),
        },
      ],
    ]),
  ],
  [
    '@jridgewell/resolve-uri',
    new Map([
      [
        '3.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@jridgewell-resolve-uri-3.1.0-integrity/node_modules/@jridgewell/resolve-uri/',
          ),
          packageDependencies: new Map([['@jridgewell/resolve-uri', '3.1.0']]),
        },
      ],
    ]),
  ],
  [
    '@jridgewell/sourcemap-codec',
    new Map([
      [
        '1.4.14',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@jridgewell-sourcemap-codec-1.4.14-integrity/node_modules/@jridgewell/sourcemap-codec/',
          ),
          packageDependencies: new Map([['@jridgewell/sourcemap-codec', '1.4.14']]),
        },
      ],
    ]),
  ],
  [
    '@tsconfig/node10',
    new Map([
      [
        '1.0.8',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@tsconfig-node10-1.0.8-integrity/node_modules/@tsconfig/node10/',
          ),
          packageDependencies: new Map([['@tsconfig/node10', '1.0.8']]),
        },
      ],
    ]),
  ],
  [
    '@tsconfig/node12',
    new Map([
      [
        '1.0.9',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@tsconfig-node12-1.0.9-integrity/node_modules/@tsconfig/node12/',
          ),
          packageDependencies: new Map([['@tsconfig/node12', '1.0.9']]),
        },
      ],
    ]),
  ],
  [
    '@tsconfig/node14',
    new Map([
      [
        '1.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@tsconfig-node14-1.0.1-integrity/node_modules/@tsconfig/node14/',
          ),
          packageDependencies: new Map([['@tsconfig/node14', '1.0.1']]),
        },
      ],
    ]),
  ],
  [
    '@tsconfig/node16',
    new Map([
      [
        '1.0.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@tsconfig-node16-1.0.2-integrity/node_modules/@tsconfig/node16/',
          ),
          packageDependencies: new Map([['@tsconfig/node16', '1.0.2']]),
        },
      ],
    ]),
  ],
  [
    'acorn',
    new Map([
      [
        '8.8.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-acorn-8.8.1-integrity/node_modules/acorn/',
          ),
          packageDependencies: new Map([['acorn', '8.8.1']]),
        },
      ],
    ]),
  ],
  [
    'acorn-walk',
    new Map([
      [
        '8.2.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-acorn-walk-8.2.0-integrity/node_modules/acorn-walk/',
          ),
          packageDependencies: new Map([['acorn-walk', '8.2.0']]),
        },
      ],
    ]),
  ],
  [
    'arg',
    new Map([
      [
        '4.1.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-arg-4.1.3-integrity/node_modules/arg/',
          ),
          packageDependencies: new Map([['arg', '4.1.3']]),
        },
      ],
    ]),
  ],
  [
    'create-require',
    new Map([
      [
        '1.1.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-create-require-1.1.1-integrity/node_modules/create-require/',
          ),
          packageDependencies: new Map([['create-require', '1.1.1']]),
        },
      ],
    ]),
  ],
  [
    'diff',
    new Map([
      [
        '4.0.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-diff-4.0.2-integrity/node_modules/diff/',
          ),
          packageDependencies: new Map([['diff', '4.0.2']]),
        },
      ],
    ]),
  ],
  [
    'make-error',
    new Map([
      [
        '1.3.6',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-make-error-1.3.6-integrity/node_modules/make-error/',
          ),
          packageDependencies: new Map([['make-error', '1.3.6']]),
        },
      ],
    ]),
  ],
  [
    'v8-compile-cache-lib',
    new Map([
      [
        '3.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-v8-compile-cache-lib-3.0.1-integrity/node_modules/v8-compile-cache-lib/',
          ),
          packageDependencies: new Map([['v8-compile-cache-lib', '3.0.1']]),
        },
      ],
    ]),
  ],
  [
    'yn',
    new Map([
      [
        '3.1.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-yn-3.1.1-integrity/node_modules/yn/',
          ),
          packageDependencies: new Map([['yn', '3.1.1']]),
        },
      ],
    ]),
  ],
  [
    'tsc',
    new Map([
      [
        '2.0.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-tsc-2.0.4-integrity/node_modules/tsc/',
          ),
          packageDependencies: new Map([['tsc', '2.0.4']]),
        },
      ],
    ]),
  ],
  [
    'vitest',
    new Map([
      [
        '0.24.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-vitest-0.24.3-integrity/node_modules/vitest/',
          ),
          packageDependencies: new Map([
            ['@types/chai', '4.3.3'],
            ['@types/chai-subset', '1.3.3'],
            ['@types/node', '18.11.5'],
            ['chai', '4.3.6'],
            ['debug', '4.3.4'],
            ['local-pkg', '0.4.2'],
            ['strip-literal', '0.4.2'],
            ['tinybench', '2.3.1'],
            ['tinypool', '0.3.0'],
            ['tinyspy', '1.0.2'],
            ['vite', '3.1.8'],
            ['vitest', '0.24.3'],
          ]),
        },
      ],
    ]),
  ],
  [
    '@types/chai',
    new Map([
      [
        '4.3.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@types-chai-4.3.3-integrity/node_modules/@types/chai/',
          ),
          packageDependencies: new Map([['@types/chai', '4.3.3']]),
        },
      ],
    ]),
  ],
  [
    '@types/chai-subset',
    new Map([
      [
        '1.3.3',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-@types-chai-subset-1.3.3-integrity/node_modules/@types/chai-subset/',
          ),
          packageDependencies: new Map([
            ['@types/chai', '4.3.3'],
            ['@types/chai-subset', '1.3.3'],
          ]),
        },
      ],
    ]),
  ],
  [
    'chai',
    new Map([
      [
        '4.3.6',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-chai-4.3.6-integrity/node_modules/chai/',
          ),
          packageDependencies: new Map([
            ['assertion-error', '1.1.0'],
            ['check-error', '1.0.2'],
            ['deep-eql', '3.0.1'],
            ['get-func-name', '2.0.0'],
            ['loupe', '2.3.4'],
            ['pathval', '1.1.1'],
            ['type-detect', '4.0.8'],
            ['chai', '4.3.6'],
          ]),
        },
      ],
    ]),
  ],
  [
    'assertion-error',
    new Map([
      [
        '1.1.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-assertion-error-1.1.0-integrity/node_modules/assertion-error/',
          ),
          packageDependencies: new Map([['assertion-error', '1.1.0']]),
        },
      ],
    ]),
  ],
  [
    'check-error',
    new Map([
      [
        '1.0.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-check-error-1.0.2-integrity/node_modules/check-error/',
          ),
          packageDependencies: new Map([['check-error', '1.0.2']]),
        },
      ],
    ]),
  ],
  [
    'deep-eql',
    new Map([
      [
        '3.0.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-deep-eql-3.0.1-integrity/node_modules/deep-eql/',
          ),
          packageDependencies: new Map([
            ['type-detect', '4.0.8'],
            ['deep-eql', '3.0.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'type-detect',
    new Map([
      [
        '4.0.8',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-type-detect-4.0.8-integrity/node_modules/type-detect/',
          ),
          packageDependencies: new Map([['type-detect', '4.0.8']]),
        },
      ],
    ]),
  ],
  [
    'get-func-name',
    new Map([
      [
        '2.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-get-func-name-2.0.0-integrity/node_modules/get-func-name/',
          ),
          packageDependencies: new Map([['get-func-name', '2.0.0']]),
        },
      ],
    ]),
  ],
  [
    'loupe',
    new Map([
      [
        '2.3.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-loupe-2.3.4-integrity/node_modules/loupe/',
          ),
          packageDependencies: new Map([
            ['get-func-name', '2.0.0'],
            ['loupe', '2.3.4'],
          ]),
        },
      ],
    ]),
  ],
  [
    'pathval',
    new Map([
      [
        '1.1.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-pathval-1.1.1-integrity/node_modules/pathval/',
          ),
          packageDependencies: new Map([['pathval', '1.1.1']]),
        },
      ],
    ]),
  ],
  [
    'local-pkg',
    new Map([
      [
        '0.4.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-local-pkg-0.4.2-integrity/node_modules/local-pkg/',
          ),
          packageDependencies: new Map([['local-pkg', '0.4.2']]),
        },
      ],
    ]),
  ],
  [
    'strip-literal',
    new Map([
      [
        '0.4.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-strip-literal-0.4.2-integrity/node_modules/strip-literal/',
          ),
          packageDependencies: new Map([
            ['acorn', '8.8.1'],
            ['strip-literal', '0.4.2'],
          ]),
        },
      ],
    ]),
  ],
  [
    'tinybench',
    new Map([
      [
        '2.3.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-tinybench-2.3.1-integrity/node_modules/tinybench/',
          ),
          packageDependencies: new Map([['tinybench', '2.3.1']]),
        },
      ],
    ]),
  ],
  [
    'tinypool',
    new Map([
      [
        '0.3.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-tinypool-0.3.0-integrity/node_modules/tinypool/',
          ),
          packageDependencies: new Map([['tinypool', '0.3.0']]),
        },
      ],
    ]),
  ],
  [
    'tinyspy',
    new Map([
      [
        '1.0.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-tinyspy-1.0.2-integrity/node_modules/tinyspy/',
          ),
          packageDependencies: new Map([['tinyspy', '1.0.2']]),
        },
      ],
    ]),
  ],
  [
    'vite',
    new Map([
      [
        '3.1.8',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-vite-3.1.8-integrity/node_modules/vite/',
          ),
          packageDependencies: new Map([
            ['esbuild', '0.15.12'],
            ['postcss', '8.4.18'],
            ['resolve', '1.22.1'],
            ['rollup', '2.78.1'],
            ['fsevents', '2.3.2'],
            ['vite', '3.1.8'],
          ]),
        },
      ],
    ]),
  ],
  [
    'esbuild',
    new Map([
      [
        '0.15.12',
        {
          packageLocation: path.resolve(
            __dirname,
            './.pnp/unplugged/npm-esbuild-0.15.12-integrity/node_modules/esbuild/',
          ),
          packageDependencies: new Map([
            ['esbuild-darwin-64', '0.15.12'],
            ['esbuild', '0.15.12'],
          ]),
        },
      ],
    ]),
  ],
  [
    'esbuild-darwin-64',
    new Map([
      [
        '0.15.12',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-esbuild-darwin-64-0.15.12-integrity/node_modules/esbuild-darwin-64/',
          ),
          packageDependencies: new Map([['esbuild-darwin-64', '0.15.12']]),
        },
      ],
    ]),
  ],
  [
    'postcss',
    new Map([
      [
        '8.4.18',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-postcss-8.4.18-integrity/node_modules/postcss/',
          ),
          packageDependencies: new Map([
            ['nanoid', '3.3.4'],
            ['picocolors', '1.0.0'],
            ['source-map-js', '1.0.2'],
            ['postcss', '8.4.18'],
          ]),
        },
      ],
    ]),
  ],
  [
    'nanoid',
    new Map([
      [
        '3.3.4',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-nanoid-3.3.4-integrity/node_modules/nanoid/',
          ),
          packageDependencies: new Map([['nanoid', '3.3.4']]),
        },
      ],
    ]),
  ],
  [
    'picocolors',
    new Map([
      [
        '1.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-picocolors-1.0.0-integrity/node_modules/picocolors/',
          ),
          packageDependencies: new Map([['picocolors', '1.0.0']]),
        },
      ],
    ]),
  ],
  [
    'source-map-js',
    new Map([
      [
        '1.0.2',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-source-map-js-1.0.2-integrity/node_modules/source-map-js/',
          ),
          packageDependencies: new Map([['source-map-js', '1.0.2']]),
        },
      ],
    ]),
  ],
  [
    'resolve',
    new Map([
      [
        '1.22.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-resolve-1.22.1-integrity/node_modules/resolve/',
          ),
          packageDependencies: new Map([
            ['is-core-module', '2.11.0'],
            ['path-parse', '1.0.7'],
            ['supports-preserve-symlinks-flag', '1.0.0'],
            ['resolve', '1.22.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    'is-core-module',
    new Map([
      [
        '2.11.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-is-core-module-2.11.0-integrity/node_modules/is-core-module/',
          ),
          packageDependencies: new Map([
            ['has', '1.0.3'],
            ['is-core-module', '2.11.0'],
          ]),
        },
      ],
    ]),
  ],
  [
    'path-parse',
    new Map([
      [
        '1.0.7',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-path-parse-1.0.7-integrity/node_modules/path-parse/',
          ),
          packageDependencies: new Map([['path-parse', '1.0.7']]),
        },
      ],
    ]),
  ],
  [
    'supports-preserve-symlinks-flag',
    new Map([
      [
        '1.0.0',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-supports-preserve-symlinks-flag-1.0.0-integrity/node_modules/supports-preserve-symlinks-flag/',
          ),
          packageDependencies: new Map([['supports-preserve-symlinks-flag', '1.0.0']]),
        },
      ],
    ]),
  ],
  [
    'rollup',
    new Map([
      [
        '2.78.1',
        {
          packageLocation: path.resolve(
            __dirname,
            '../../Library/Caches/Yarn/v6/npm-rollup-2.78.1-integrity/node_modules/rollup/',
          ),
          packageDependencies: new Map([
            ['fsevents', '2.3.2'],
            ['rollup', '2.78.1'],
          ]),
        },
      ],
    ]),
  ],
  [
    null,
    new Map([
      [
        null,
        {
          packageLocation: path.resolve(__dirname, './'),
          packageDependencies: new Map([
            ['@types/lodash', '4.14.186'],
            ['axios', '1.1.3'],
            ['cheerio', '1.0.0-rc.12'],
            ['commander', '9.4.1'],
            ['fast-json-stringify', '5.4.0'],
            ['lodash', '4.17.21'],
            ['puppeteer', '19.1.1'],
            ['puppeteer-extra', '3.3.4'],
            ['puppeteer-extra-plugin-stealth', '2.11.1'],
            ['typescript', '4.8.4'],
            ['urlcat', '2.0.4'],
            ['wallet.ts', '1.0.1'],
            ['web3-utils', '1.8.0'],
            ['@types/node', '18.11.5'],
            ['@types/node-fetch', '2.6.1'],
            ['@types/prettier', '2.4.4'],
            ['@types/puppeteer', '5.4.7'],
            ['gh-pages', '3.1.0'],
            ['husky', '7.0.4'],
            ['install', '0.13.0'],
            ['msw', '0.47.4'],
            ['node-fetch', 'pnp:cb38786f845c724406f632a5fa232107f429d878'],
            ['prettier', '2.7.1'],
            ['pretty-quick', '3.1.3'],
            ['ts-node', '10.9.1'],
            ['tsc', '2.0.4'],
            ['vitest', '0.24.3'],
            ['bn.js', '5.2.1'],
          ]),
        },
      ],
    ]),
  ],
])

let locatorsByLocations = new Map([
  ['./.pnp/externals/pnp-cb38786f845c724406f632a5fa232107f429d878/node_modules/node-fetch/', blacklistedLocator],
  ['./.pnp/externals/pnp-1051c6cb6ac62fd42022d1570aaba9b7409861bd/node_modules/node-fetch/', blacklistedLocator],
  [
    './.pnp/externals/pnp-c653a96c771aac800a2a271897621ea0c5b1e8c6/node_modules/puppeteer-extra-plugin/',
    blacklistedLocator,
  ],
  [
    './.pnp/externals/pnp-c7efd42446eda755f31981769587162dcfc0f568/node_modules/puppeteer-extra-plugin/',
    blacklistedLocator,
  ],
  [
    './.pnp/externals/pnp-1d20218fd2f0b5d536811ca02955bd2d90b6cf4c/node_modules/puppeteer-extra-plugin/',
    blacklistedLocator,
  ],
  ['./.pnp/externals/pnp-982153c1d9d071a0501dbce5b86403d2fa9ccf39/node_modules/node-fetch/', blacklistedLocator],
  [
    '../../Library/Caches/Yarn/v6/npm-@types-lodash-4.14.186-integrity/node_modules/@types/lodash/',
    { name: '@types/lodash', reference: '4.14.186' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-axios-1.1.3-integrity/node_modules/axios/', { name: 'axios', reference: '1.1.3' }],
  [
    '../../Library/Caches/Yarn/v6/npm-follow-redirects-1.15.2-integrity/node_modules/follow-redirects/',
    { name: 'follow-redirects', reference: '1.15.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-form-data-4.0.0-integrity/node_modules/form-data/',
    { name: 'form-data', reference: '4.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-form-data-3.0.1-integrity/node_modules/form-data/',
    { name: 'form-data', reference: '3.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-asynckit-0.4.0-integrity/node_modules/asynckit/',
    { name: 'asynckit', reference: '0.4.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-combined-stream-1.0.8-integrity/node_modules/combined-stream/',
    { name: 'combined-stream', reference: '1.0.8' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-delayed-stream-1.0.0-integrity/node_modules/delayed-stream/',
    { name: 'delayed-stream', reference: '1.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-mime-types-2.1.35-integrity/node_modules/mime-types/',
    { name: 'mime-types', reference: '2.1.35' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-mime-db-1.52.0-integrity/node_modules/mime-db/',
    { name: 'mime-db', reference: '1.52.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-proxy-from-env-1.1.0-integrity/node_modules/proxy-from-env/',
    { name: 'proxy-from-env', reference: '1.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-cheerio-1.0.0-rc.12-integrity/node_modules/cheerio/',
    { name: 'cheerio', reference: '1.0.0-rc.12' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-cheerio-select-2.1.0-integrity/node_modules/cheerio-select/',
    { name: 'cheerio-select', reference: '2.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-boolbase-1.0.0-integrity/node_modules/boolbase/',
    { name: 'boolbase', reference: '1.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-css-select-5.1.0-integrity/node_modules/css-select/',
    { name: 'css-select', reference: '5.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-css-what-6.1.0-integrity/node_modules/css-what/',
    { name: 'css-what', reference: '6.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-domhandler-5.0.3-integrity/node_modules/domhandler/',
    { name: 'domhandler', reference: '5.0.3' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-domelementtype-2.3.0-integrity/node_modules/domelementtype/',
    { name: 'domelementtype', reference: '2.3.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-domutils-3.0.1-integrity/node_modules/domutils/',
    { name: 'domutils', reference: '3.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-dom-serializer-2.0.0-integrity/node_modules/dom-serializer/',
    { name: 'dom-serializer', reference: '2.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-entities-4.4.0-integrity/node_modules/entities/',
    { name: 'entities', reference: '4.4.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-nth-check-2.1.1-integrity/node_modules/nth-check/',
    { name: 'nth-check', reference: '2.1.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-htmlparser2-8.0.1-integrity/node_modules/htmlparser2/',
    { name: 'htmlparser2', reference: '8.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-parse5-7.1.1-integrity/node_modules/parse5/',
    { name: 'parse5', reference: '7.1.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-parse5-htmlparser2-tree-adapter-7.0.0-integrity/node_modules/parse5-htmlparser2-tree-adapter/',
    { name: 'parse5-htmlparser2-tree-adapter', reference: '7.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-commander-9.4.1-integrity/node_modules/commander/',
    { name: 'commander', reference: '9.4.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-commander-2.20.3-integrity/node_modules/commander/',
    { name: 'commander', reference: '2.20.3' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-fast-json-stringify-5.4.0-integrity/node_modules/fast-json-stringify/',
    { name: 'fast-json-stringify', reference: '5.4.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@fastify-deepmerge-1.1.0-integrity/node_modules/@fastify/deepmerge/',
    { name: '@fastify/deepmerge', reference: '1.1.0' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-ajv-8.11.0-integrity/node_modules/ajv/', { name: 'ajv', reference: '8.11.0' }],
  [
    '../../Library/Caches/Yarn/v6/npm-fast-deep-equal-3.1.3-integrity/node_modules/fast-deep-equal/',
    { name: 'fast-deep-equal', reference: '3.1.3' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-json-schema-traverse-1.0.0-integrity/node_modules/json-schema-traverse/',
    { name: 'json-schema-traverse', reference: '1.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-require-from-string-2.0.2-integrity/node_modules/require-from-string/',
    { name: 'require-from-string', reference: '2.0.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-uri-js-4.4.1-integrity/node_modules/uri-js/',
    { name: 'uri-js', reference: '4.4.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-punycode-2.1.1-integrity/node_modules/punycode/',
    { name: 'punycode', reference: '2.1.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-ajv-formats-2.1.1-integrity/node_modules/ajv-formats/',
    { name: 'ajv-formats', reference: '2.1.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-fast-uri-2.1.0-integrity/node_modules/fast-uri/',
    { name: 'fast-uri', reference: '2.1.0' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-rfdc-1.3.0-integrity/node_modules/rfdc/', { name: 'rfdc', reference: '1.3.0' }],
  [
    '../../Library/Caches/Yarn/v6/npm-lodash-4.17.21-integrity/node_modules/lodash/',
    { name: 'lodash', reference: '4.17.21' },
  ],
  [
    './.pnp/unplugged/npm-puppeteer-19.1.1-integrity/node_modules/puppeteer/',
    { name: 'puppeteer', reference: '19.1.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-cosmiconfig-7.0.1-integrity/node_modules/cosmiconfig/',
    { name: 'cosmiconfig', reference: '7.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@types-parse-json-4.0.0-integrity/node_modules/@types/parse-json/',
    { name: '@types/parse-json', reference: '4.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-import-fresh-3.3.0-integrity/node_modules/import-fresh/',
    { name: 'import-fresh', reference: '3.3.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-parent-module-1.0.1-integrity/node_modules/parent-module/',
    { name: 'parent-module', reference: '1.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-callsites-3.1.0-integrity/node_modules/callsites/',
    { name: 'callsites', reference: '3.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-resolve-from-4.0.0-integrity/node_modules/resolve-from/',
    { name: 'resolve-from', reference: '4.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-parse-json-5.2.0-integrity/node_modules/parse-json/',
    { name: 'parse-json', reference: '5.2.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@babel-code-frame-7.18.6-integrity/node_modules/@babel/code-frame/',
    { name: '@babel/code-frame', reference: '7.18.6' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@babel-highlight-7.18.6-integrity/node_modules/@babel/highlight/',
    { name: '@babel/highlight', reference: '7.18.6' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@babel-helper-validator-identifier-7.19.1-integrity/node_modules/@babel/helper-validator-identifier/',
    { name: '@babel/helper-validator-identifier', reference: '7.19.1' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-chalk-2.4.2-integrity/node_modules/chalk/', { name: 'chalk', reference: '2.4.2' }],
  ['../../Library/Caches/Yarn/v6/npm-chalk-4.1.1-integrity/node_modules/chalk/', { name: 'chalk', reference: '4.1.1' }],
  ['../../Library/Caches/Yarn/v6/npm-chalk-3.0.0-integrity/node_modules/chalk/', { name: 'chalk', reference: '3.0.0' }],
  [
    '../../Library/Caches/Yarn/v6/npm-ansi-styles-3.2.1-integrity/node_modules/ansi-styles/',
    { name: 'ansi-styles', reference: '3.2.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-ansi-styles-4.3.0-integrity/node_modules/ansi-styles/',
    { name: 'ansi-styles', reference: '4.3.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-color-convert-1.9.3-integrity/node_modules/color-convert/',
    { name: 'color-convert', reference: '1.9.3' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-color-convert-2.0.1-integrity/node_modules/color-convert/',
    { name: 'color-convert', reference: '2.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-color-name-1.1.3-integrity/node_modules/color-name/',
    { name: 'color-name', reference: '1.1.3' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-color-name-1.1.4-integrity/node_modules/color-name/',
    { name: 'color-name', reference: '1.1.4' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-escape-string-regexp-1.0.5-integrity/node_modules/escape-string-regexp/',
    { name: 'escape-string-regexp', reference: '1.0.5' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-supports-color-5.5.0-integrity/node_modules/supports-color/',
    { name: 'supports-color', reference: '5.5.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-supports-color-7.2.0-integrity/node_modules/supports-color/',
    { name: 'supports-color', reference: '7.2.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-has-flag-3.0.0-integrity/node_modules/has-flag/',
    { name: 'has-flag', reference: '3.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-has-flag-4.0.0-integrity/node_modules/has-flag/',
    { name: 'has-flag', reference: '4.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-js-tokens-4.0.0-integrity/node_modules/js-tokens/',
    { name: 'js-tokens', reference: '4.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-error-ex-1.3.2-integrity/node_modules/error-ex/',
    { name: 'error-ex', reference: '1.3.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-arrayish-0.2.1-integrity/node_modules/is-arrayish/',
    { name: 'is-arrayish', reference: '0.2.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-json-parse-even-better-errors-2.3.1-integrity/node_modules/json-parse-even-better-errors/',
    { name: 'json-parse-even-better-errors', reference: '2.3.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-lines-and-columns-1.2.4-integrity/node_modules/lines-and-columns/',
    { name: 'lines-and-columns', reference: '1.2.4' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-path-type-4.0.0-integrity/node_modules/path-type/',
    { name: 'path-type', reference: '4.0.0' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-yaml-1.10.2-integrity/node_modules/yaml/', { name: 'yaml', reference: '1.10.2' }],
  [
    '../../Library/Caches/Yarn/v6/npm-https-proxy-agent-5.0.1-integrity/node_modules/https-proxy-agent/',
    { name: 'https-proxy-agent', reference: '5.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-agent-base-6.0.2-integrity/node_modules/agent-base/',
    { name: 'agent-base', reference: '6.0.2' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-debug-4.3.4-integrity/node_modules/debug/', { name: 'debug', reference: '4.3.4' }],
  ['../../Library/Caches/Yarn/v6/npm-ms-2.1.2-integrity/node_modules/ms/', { name: 'ms', reference: '2.1.2' }],
  [
    '../../Library/Caches/Yarn/v6/npm-progress-2.0.3-integrity/node_modules/progress/',
    { name: 'progress', reference: '2.0.3' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-puppeteer-core-19.1.1-integrity/node_modules/puppeteer-core/',
    { name: 'puppeteer-core', reference: '19.1.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-cross-fetch-3.1.5-integrity/node_modules/cross-fetch/',
    { name: 'cross-fetch', reference: '3.1.5' },
  ],
  [
    './.pnp/externals/pnp-1051c6cb6ac62fd42022d1570aaba9b7409861bd/node_modules/node-fetch/',
    { name: 'node-fetch', reference: 'pnp:1051c6cb6ac62fd42022d1570aaba9b7409861bd' },
  ],
  [
    './.pnp/externals/pnp-982153c1d9d071a0501dbce5b86403d2fa9ccf39/node_modules/node-fetch/',
    { name: 'node-fetch', reference: 'pnp:982153c1d9d071a0501dbce5b86403d2fa9ccf39' },
  ],
  [
    './.pnp/externals/pnp-cb38786f845c724406f632a5fa232107f429d878/node_modules/node-fetch/',
    { name: 'node-fetch', reference: 'pnp:cb38786f845c724406f632a5fa232107f429d878' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-whatwg-url-5.0.0-integrity/node_modules/whatwg-url/',
    { name: 'whatwg-url', reference: '5.0.0' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-tr46-0.0.3-integrity/node_modules/tr46/', { name: 'tr46', reference: '0.0.3' }],
  [
    '../../Library/Caches/Yarn/v6/npm-webidl-conversions-3.0.1-integrity/node_modules/webidl-conversions/',
    { name: 'webidl-conversions', reference: '3.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-devtools-protocol-0.0.1045489-integrity/node_modules/devtools-protocol/',
    { name: 'devtools-protocol', reference: '0.0.1045489' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-extract-zip-2.0.1-integrity/node_modules/extract-zip/',
    { name: 'extract-zip', reference: '2.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-get-stream-5.2.0-integrity/node_modules/get-stream/',
    { name: 'get-stream', reference: '5.2.0' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-pump-3.0.0-integrity/node_modules/pump/', { name: 'pump', reference: '3.0.0' }],
  [
    '../../Library/Caches/Yarn/v6/npm-end-of-stream-1.4.4-integrity/node_modules/end-of-stream/',
    { name: 'end-of-stream', reference: '1.4.4' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-once-1.4.0-integrity/node_modules/once/', { name: 'once', reference: '1.4.0' }],
  [
    '../../Library/Caches/Yarn/v6/npm-wrappy-1.0.2-integrity/node_modules/wrappy/',
    { name: 'wrappy', reference: '1.0.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-yauzl-2.10.0-integrity/node_modules/yauzl/',
    { name: 'yauzl', reference: '2.10.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-buffer-crc32-0.2.13-integrity/node_modules/buffer-crc32/',
    { name: 'buffer-crc32', reference: '0.2.13' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-fd-slicer-1.1.0-integrity/node_modules/fd-slicer/',
    { name: 'fd-slicer', reference: '1.1.0' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-pend-1.2.0-integrity/node_modules/pend/', { name: 'pend', reference: '1.2.0' }],
  [
    '../../Library/Caches/Yarn/v6/npm-@types-yauzl-2.10.0-integrity/node_modules/@types/yauzl/',
    { name: '@types/yauzl', reference: '2.10.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@types-node-18.11.5-integrity/node_modules/@types/node/',
    { name: '@types/node', reference: '18.11.5' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-rimraf-3.0.2-integrity/node_modules/rimraf/',
    { name: 'rimraf', reference: '3.0.2' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-glob-7.1.6-integrity/node_modules/glob/', { name: 'glob', reference: '7.1.6' }],
  [
    '../../Library/Caches/Yarn/v6/npm-fs-realpath-1.0.0-integrity/node_modules/fs.realpath/',
    { name: 'fs.realpath', reference: '1.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-inflight-1.0.6-integrity/node_modules/inflight/',
    { name: 'inflight', reference: '1.0.6' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-inherits-2.0.4-integrity/node_modules/inherits/',
    { name: 'inherits', reference: '2.0.4' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-minimatch-3.0.4-integrity/node_modules/minimatch/',
    { name: 'minimatch', reference: '3.0.4' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-brace-expansion-1.1.11-integrity/node_modules/brace-expansion/',
    { name: 'brace-expansion', reference: '1.1.11' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-balanced-match-1.0.0-integrity/node_modules/balanced-match/',
    { name: 'balanced-match', reference: '1.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-concat-map-0.0.1-integrity/node_modules/concat-map/',
    { name: 'concat-map', reference: '0.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-path-is-absolute-1.0.1-integrity/node_modules/path-is-absolute/',
    { name: 'path-is-absolute', reference: '1.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-tar-fs-2.1.1-integrity/node_modules/tar-fs/',
    { name: 'tar-fs', reference: '2.1.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-chownr-1.1.4-integrity/node_modules/chownr/',
    { name: 'chownr', reference: '1.1.4' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-mkdirp-classic-0.5.3-integrity/node_modules/mkdirp-classic/',
    { name: 'mkdirp-classic', reference: '0.5.3' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-tar-stream-2.2.0-integrity/node_modules/tar-stream/',
    { name: 'tar-stream', reference: '2.2.0' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-bl-4.1.0-integrity/node_modules/bl/', { name: 'bl', reference: '4.1.0' }],
  [
    '../../Library/Caches/Yarn/v6/npm-buffer-5.7.1-integrity/node_modules/buffer/',
    { name: 'buffer', reference: '5.7.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-base64-js-1.5.1-integrity/node_modules/base64-js/',
    { name: 'base64-js', reference: '1.5.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-ieee754-1.2.1-integrity/node_modules/ieee754/',
    { name: 'ieee754', reference: '1.2.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-readable-stream-3.6.0-integrity/node_modules/readable-stream/',
    { name: 'readable-stream', reference: '3.6.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-string-decoder-1.3.0-integrity/node_modules/string_decoder/',
    { name: 'string_decoder', reference: '1.3.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-safe-buffer-5.2.1-integrity/node_modules/safe-buffer/',
    { name: 'safe-buffer', reference: '5.2.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-util-deprecate-1.0.2-integrity/node_modules/util-deprecate/',
    { name: 'util-deprecate', reference: '1.0.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-fs-constants-1.0.0-integrity/node_modules/fs-constants/',
    { name: 'fs-constants', reference: '1.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-unbzip2-stream-1.4.3-integrity/node_modules/unbzip2-stream/',
    { name: 'unbzip2-stream', reference: '1.4.3' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-through-2.3.8-integrity/node_modules/through/',
    { name: 'through', reference: '2.3.8' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-ws-8.9.0-integrity/node_modules/ws/', { name: 'ws', reference: '8.9.0' }],
  [
    '../../Library/Caches/Yarn/v6/npm-puppeteer-extra-3.3.4-integrity/node_modules/puppeteer-extra/',
    { name: 'puppeteer-extra', reference: '3.3.4' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@types-debug-4.1.7-integrity/node_modules/@types/debug/',
    { name: '@types/debug', reference: '4.1.7' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@types-ms-0.7.31-integrity/node_modules/@types/ms/',
    { name: '@types/ms', reference: '0.7.31' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-deepmerge-4.2.2-integrity/node_modules/deepmerge/',
    { name: 'deepmerge', reference: '4.2.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-puppeteer-extra-plugin-stealth-2.11.1-integrity/node_modules/puppeteer-extra-plugin-stealth/',
    { name: 'puppeteer-extra-plugin-stealth', reference: '2.11.1' },
  ],
  [
    './.pnp/externals/pnp-c653a96c771aac800a2a271897621ea0c5b1e8c6/node_modules/puppeteer-extra-plugin/',
    { name: 'puppeteer-extra-plugin', reference: 'pnp:c653a96c771aac800a2a271897621ea0c5b1e8c6' },
  ],
  [
    './.pnp/externals/pnp-c7efd42446eda755f31981769587162dcfc0f568/node_modules/puppeteer-extra-plugin/',
    { name: 'puppeteer-extra-plugin', reference: 'pnp:c7efd42446eda755f31981769587162dcfc0f568' },
  ],
  [
    './.pnp/externals/pnp-1d20218fd2f0b5d536811ca02955bd2d90b6cf4c/node_modules/puppeteer-extra-plugin/',
    { name: 'puppeteer-extra-plugin', reference: 'pnp:1d20218fd2f0b5d536811ca02955bd2d90b6cf4c' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-merge-deep-3.0.3-integrity/node_modules/merge-deep/',
    { name: 'merge-deep', reference: '3.0.3' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-arr-union-3.1.0-integrity/node_modules/arr-union/',
    { name: 'arr-union', reference: '3.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-clone-deep-0.2.4-integrity/node_modules/clone-deep/',
    { name: 'clone-deep', reference: '0.2.4' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-for-own-0.1.5-integrity/node_modules/for-own/',
    { name: 'for-own', reference: '0.1.5' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-for-in-1.0.2-integrity/node_modules/for-in/',
    { name: 'for-in', reference: '1.0.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-for-in-0.1.8-integrity/node_modules/for-in/',
    { name: 'for-in', reference: '0.1.8' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-plain-object-2.0.4-integrity/node_modules/is-plain-object/',
    { name: 'is-plain-object', reference: '2.0.4' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-isobject-3.0.1-integrity/node_modules/isobject/',
    { name: 'isobject', reference: '3.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-kind-of-3.2.2-integrity/node_modules/kind-of/',
    { name: 'kind-of', reference: '3.2.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-kind-of-2.0.1-integrity/node_modules/kind-of/',
    { name: 'kind-of', reference: '2.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-buffer-1.1.6-integrity/node_modules/is-buffer/',
    { name: 'is-buffer', reference: '1.1.6' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-lazy-cache-1.0.4-integrity/node_modules/lazy-cache/',
    { name: 'lazy-cache', reference: '1.0.4' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-lazy-cache-0.2.7-integrity/node_modules/lazy-cache/',
    { name: 'lazy-cache', reference: '0.2.7' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-shallow-clone-0.1.2-integrity/node_modules/shallow-clone/',
    { name: 'shallow-clone', reference: '0.1.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-extendable-0.1.1-integrity/node_modules/is-extendable/',
    { name: 'is-extendable', reference: '0.1.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-mixin-object-2.0.1-integrity/node_modules/mixin-object/',
    { name: 'mixin-object', reference: '2.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-puppeteer-extra-plugin-user-preferences-2.4.0-integrity/node_modules/puppeteer-extra-plugin-user-preferences/',
    { name: 'puppeteer-extra-plugin-user-preferences', reference: '2.4.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-puppeteer-extra-plugin-user-data-dir-2.4.0-integrity/node_modules/puppeteer-extra-plugin-user-data-dir/',
    { name: 'puppeteer-extra-plugin-user-data-dir', reference: '2.4.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-fs-extra-10.1.0-integrity/node_modules/fs-extra/',
    { name: 'fs-extra', reference: '10.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-fs-extra-8.1.0-integrity/node_modules/fs-extra/',
    { name: 'fs-extra', reference: '8.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-graceful-fs-4.2.4-integrity/node_modules/graceful-fs/',
    { name: 'graceful-fs', reference: '4.2.4' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-jsonfile-6.1.0-integrity/node_modules/jsonfile/',
    { name: 'jsonfile', reference: '6.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-jsonfile-4.0.0-integrity/node_modules/jsonfile/',
    { name: 'jsonfile', reference: '4.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-universalify-2.0.0-integrity/node_modules/universalify/',
    { name: 'universalify', reference: '2.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-universalify-0.1.2-integrity/node_modules/universalify/',
    { name: 'universalify', reference: '0.1.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-typescript-4.8.4-integrity/node_modules/typescript/',
    { name: 'typescript', reference: '4.8.4' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-urlcat-2.0.4-integrity/node_modules/urlcat/',
    { name: 'urlcat', reference: '2.0.4' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-wallet-ts-1.0.1-integrity/node_modules/wallet.ts/',
    { name: 'wallet.ts', reference: '1.0.1' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-bn-js-5.2.1-integrity/node_modules/bn.js/', { name: 'bn.js', reference: '5.2.1' }],
  [
    '../../Library/Caches/Yarn/v6/npm-bn-js-4.11.9-integrity/node_modules/bn.js/',
    { name: 'bn.js', reference: '4.11.9' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-bn-js-4.11.6-integrity/node_modules/bn.js/',
    { name: 'bn.js', reference: '4.11.6' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-bs58-4.0.1-integrity/node_modules/bs58/', { name: 'bs58', reference: '4.0.1' }],
  [
    '../../Library/Caches/Yarn/v6/npm-base-x-3.0.8-integrity/node_modules/base-x/',
    { name: 'base-x', reference: '3.0.8' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-elliptic-6.5.4-integrity/node_modules/elliptic/',
    { name: 'elliptic', reference: '6.5.4' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-brorand-1.1.0-integrity/node_modules/brorand/',
    { name: 'brorand', reference: '1.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-hash-js-1.1.7-integrity/node_modules/hash.js/',
    { name: 'hash.js', reference: '1.1.7' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-minimalistic-assert-1.0.1-integrity/node_modules/minimalistic-assert/',
    { name: 'minimalistic-assert', reference: '1.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-hmac-drbg-1.0.1-integrity/node_modules/hmac-drbg/',
    { name: 'hmac-drbg', reference: '1.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-minimalistic-crypto-utils-1.0.1-integrity/node_modules/minimalistic-crypto-utils/',
    { name: 'minimalistic-crypto-utils', reference: '1.0.1' },
  ],
  ['./.pnp/unplugged/npm-keccak-3.0.1-integrity/node_modules/keccak/', { name: 'keccak', reference: '3.0.1' }],
  [
    '../../Library/Caches/Yarn/v6/npm-node-addon-api-2.0.2-integrity/node_modules/node-addon-api/',
    { name: 'node-addon-api', reference: '2.0.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-node-gyp-build-4.2.3-integrity/node_modules/node-gyp-build/',
    { name: 'node-gyp-build', reference: '4.2.3' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-web3-utils-1.8.0-integrity/node_modules/web3-utils/',
    { name: 'web3-utils', reference: '1.8.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-ethereum-bloom-filters-1.0.10-integrity/node_modules/ethereum-bloom-filters/',
    { name: 'ethereum-bloom-filters', reference: '1.0.10' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-js-sha3-0.8.0-integrity/node_modules/js-sha3/',
    { name: 'js-sha3', reference: '0.8.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-ethereumjs-util-7.1.5-integrity/node_modules/ethereumjs-util/',
    { name: 'ethereumjs-util', reference: '7.1.5' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@types-bn-js-5.1.1-integrity/node_modules/@types/bn.js/',
    { name: '@types/bn.js', reference: '5.1.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-create-hash-1.2.0-integrity/node_modules/create-hash/',
    { name: 'create-hash', reference: '1.2.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-cipher-base-1.0.4-integrity/node_modules/cipher-base/',
    { name: 'cipher-base', reference: '1.0.4' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-md5-js-1.3.5-integrity/node_modules/md5.js/',
    { name: 'md5.js', reference: '1.3.5' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-hash-base-3.1.0-integrity/node_modules/hash-base/',
    { name: 'hash-base', reference: '3.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-ripemd160-2.0.2-integrity/node_modules/ripemd160/',
    { name: 'ripemd160', reference: '2.0.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-sha-js-2.4.11-integrity/node_modules/sha.js/',
    { name: 'sha.js', reference: '2.4.11' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-ethereum-cryptography-0.1.3-integrity/node_modules/ethereum-cryptography/',
    { name: 'ethereum-cryptography', reference: '0.1.3' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@types-pbkdf2-3.1.0-integrity/node_modules/@types/pbkdf2/',
    { name: '@types/pbkdf2', reference: '3.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@types-secp256k1-4.0.3-integrity/node_modules/@types/secp256k1/',
    { name: '@types/secp256k1', reference: '4.0.3' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-blakejs-1.2.1-integrity/node_modules/blakejs/',
    { name: 'blakejs', reference: '1.2.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-browserify-aes-1.2.0-integrity/node_modules/browserify-aes/',
    { name: 'browserify-aes', reference: '1.2.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-buffer-xor-1.0.3-integrity/node_modules/buffer-xor/',
    { name: 'buffer-xor', reference: '1.0.3' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-evp-bytestokey-1.0.3-integrity/node_modules/evp_bytestokey/',
    { name: 'evp_bytestokey', reference: '1.0.3' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-bs58check-2.1.2-integrity/node_modules/bs58check/',
    { name: 'bs58check', reference: '2.1.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-create-hmac-1.1.7-integrity/node_modules/create-hmac/',
    { name: 'create-hmac', reference: '1.1.7' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-pbkdf2-3.1.2-integrity/node_modules/pbkdf2/',
    { name: 'pbkdf2', reference: '3.1.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-randombytes-2.1.0-integrity/node_modules/randombytes/',
    { name: 'randombytes', reference: '2.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-scrypt-js-3.0.1-integrity/node_modules/scrypt-js/',
    { name: 'scrypt-js', reference: '3.0.1' },
  ],
  ['./.pnp/unplugged/npm-secp256k1-4.0.3-integrity/node_modules/secp256k1/', { name: 'secp256k1', reference: '4.0.3' }],
  [
    '../../Library/Caches/Yarn/v6/npm-setimmediate-1.0.5-integrity/node_modules/setimmediate/',
    { name: 'setimmediate', reference: '1.0.5' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-rlp-2.2.7-integrity/node_modules/rlp/', { name: 'rlp', reference: '2.2.7' }],
  [
    '../../Library/Caches/Yarn/v6/npm-ethjs-unit-0.1.6-integrity/node_modules/ethjs-unit/',
    { name: 'ethjs-unit', reference: '0.1.6' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-number-to-bn-1.7.0-integrity/node_modules/number-to-bn/',
    { name: 'number-to-bn', reference: '1.7.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-strip-hex-prefix-1.0.0-integrity/node_modules/strip-hex-prefix/',
    { name: 'strip-hex-prefix', reference: '1.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-hex-prefixed-1.0.0-integrity/node_modules/is-hex-prefixed/',
    { name: 'is-hex-prefixed', reference: '1.0.0' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-utf8-3.0.0-integrity/node_modules/utf8/', { name: 'utf8', reference: '3.0.0' }],
  [
    '../../Library/Caches/Yarn/v6/npm-@types-node-fetch-2.6.1-integrity/node_modules/@types/node-fetch/',
    { name: '@types/node-fetch', reference: '2.6.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@types-prettier-2.4.4-integrity/node_modules/@types/prettier/',
    { name: '@types/prettier', reference: '2.4.4' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@types-puppeteer-5.4.7-integrity/node_modules/@types/puppeteer/',
    { name: '@types/puppeteer', reference: '5.4.7' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-gh-pages-3.1.0-integrity/node_modules/gh-pages/',
    { name: 'gh-pages', reference: '3.1.0' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-async-2.6.3-integrity/node_modules/async/', { name: 'async', reference: '2.6.3' }],
  [
    '../../Library/Caches/Yarn/v6/npm-email-addresses-3.1.0-integrity/node_modules/email-addresses/',
    { name: 'email-addresses', reference: '3.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-filenamify-url-1.0.0-integrity/node_modules/filenamify-url/',
    { name: 'filenamify-url', reference: '1.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-filenamify-1.2.1-integrity/node_modules/filenamify/',
    { name: 'filenamify', reference: '1.2.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-filename-reserved-regex-1.0.0-integrity/node_modules/filename-reserved-regex/',
    { name: 'filename-reserved-regex', reference: '1.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-strip-outer-1.0.1-integrity/node_modules/strip-outer/',
    { name: 'strip-outer', reference: '1.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-trim-repeated-1.0.0-integrity/node_modules/trim-repeated/',
    { name: 'trim-repeated', reference: '1.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-humanize-url-1.0.1-integrity/node_modules/humanize-url/',
    { name: 'humanize-url', reference: '1.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-normalize-url-1.9.1-integrity/node_modules/normalize-url/',
    { name: 'normalize-url', reference: '1.9.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-object-assign-4.1.1-integrity/node_modules/object-assign/',
    { name: 'object-assign', reference: '4.1.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-prepend-http-1.0.4-integrity/node_modules/prepend-http/',
    { name: 'prepend-http', reference: '1.0.4' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-query-string-4.3.4-integrity/node_modules/query-string/',
    { name: 'query-string', reference: '4.3.4' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-strict-uri-encode-1.1.0-integrity/node_modules/strict-uri-encode/',
    { name: 'strict-uri-encode', reference: '1.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-sort-keys-1.1.2-integrity/node_modules/sort-keys/',
    { name: 'sort-keys', reference: '1.1.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-plain-obj-1.1.0-integrity/node_modules/is-plain-obj/',
    { name: 'is-plain-obj', reference: '1.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-strip-url-auth-1.0.1-integrity/node_modules/strip-url-auth/',
    { name: 'strip-url-auth', reference: '1.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-find-cache-dir-3.3.1-integrity/node_modules/find-cache-dir/',
    { name: 'find-cache-dir', reference: '3.3.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-commondir-1.0.1-integrity/node_modules/commondir/',
    { name: 'commondir', reference: '1.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-make-dir-3.1.0-integrity/node_modules/make-dir/',
    { name: 'make-dir', reference: '3.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-semver-6.3.0-integrity/node_modules/semver/',
    { name: 'semver', reference: '6.3.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-pkg-dir-4.2.0-integrity/node_modules/pkg-dir/',
    { name: 'pkg-dir', reference: '4.2.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-find-up-4.1.0-integrity/node_modules/find-up/',
    { name: 'find-up', reference: '4.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-locate-path-5.0.0-integrity/node_modules/locate-path/',
    { name: 'locate-path', reference: '5.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-p-locate-4.1.0-integrity/node_modules/p-locate/',
    { name: 'p-locate', reference: '4.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-p-limit-2.3.0-integrity/node_modules/p-limit/',
    { name: 'p-limit', reference: '2.3.0' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-p-try-2.2.0-integrity/node_modules/p-try/', { name: 'p-try', reference: '2.2.0' }],
  [
    '../../Library/Caches/Yarn/v6/npm-path-exists-4.0.0-integrity/node_modules/path-exists/',
    { name: 'path-exists', reference: '4.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-globby-6.1.0-integrity/node_modules/globby/',
    { name: 'globby', reference: '6.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-array-union-1.0.2-integrity/node_modules/array-union/',
    { name: 'array-union', reference: '1.0.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-array-union-2.1.0-integrity/node_modules/array-union/',
    { name: 'array-union', reference: '2.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-array-uniq-1.0.3-integrity/node_modules/array-uniq/',
    { name: 'array-uniq', reference: '1.0.3' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-pify-2.3.0-integrity/node_modules/pify/', { name: 'pify', reference: '2.3.0' }],
  [
    '../../Library/Caches/Yarn/v6/npm-pinkie-promise-2.0.1-integrity/node_modules/pinkie-promise/',
    { name: 'pinkie-promise', reference: '2.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-pinkie-2.0.4-integrity/node_modules/pinkie/',
    { name: 'pinkie', reference: '2.0.4' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-husky-7.0.4-integrity/node_modules/husky/', { name: 'husky', reference: '7.0.4' }],
  [
    '../../Library/Caches/Yarn/v6/npm-install-0.13.0-integrity/node_modules/install/',
    { name: 'install', reference: '0.13.0' },
  ],
  ['./.pnp/unplugged/npm-msw-0.47.4-integrity/node_modules/msw/', { name: 'msw', reference: '0.47.4' }],
  [
    '../../Library/Caches/Yarn/v6/npm-@mswjs-cookies-0.2.2-integrity/node_modules/@mswjs/cookies/',
    { name: '@mswjs/cookies', reference: '0.2.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@types-set-cookie-parser-2.4.2-integrity/node_modules/@types/set-cookie-parser/',
    { name: '@types/set-cookie-parser', reference: '2.4.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-set-cookie-parser-2.5.1-integrity/node_modules/set-cookie-parser/',
    { name: 'set-cookie-parser', reference: '2.5.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@mswjs-interceptors-0.17.6-integrity/node_modules/@mswjs/interceptors/',
    { name: '@mswjs/interceptors', reference: '0.17.6' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@open-draft-until-1.0.3-integrity/node_modules/@open-draft/until/',
    { name: '@open-draft/until', reference: '1.0.3' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@xmldom-xmldom-0.8.3-integrity/node_modules/@xmldom/xmldom/',
    { name: '@xmldom/xmldom', reference: '0.8.3' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-headers-polyfill-3.1.2-integrity/node_modules/headers-polyfill/',
    { name: 'headers-polyfill', reference: '3.1.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-outvariant-1.3.0-integrity/node_modules/outvariant/',
    { name: 'outvariant', reference: '1.3.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-strict-event-emitter-0.2.8-integrity/node_modules/strict-event-emitter/',
    { name: 'strict-event-emitter', reference: '0.2.8' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-events-3.3.0-integrity/node_modules/events/',
    { name: 'events', reference: '3.3.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-web-encoding-1.1.5-integrity/node_modules/web-encoding/',
    { name: 'web-encoding', reference: '1.1.5' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-util-0.12.5-integrity/node_modules/util/', { name: 'util', reference: '0.12.5' }],
  [
    '../../Library/Caches/Yarn/v6/npm-is-arguments-1.1.1-integrity/node_modules/is-arguments/',
    { name: 'is-arguments', reference: '1.1.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-call-bind-1.0.2-integrity/node_modules/call-bind/',
    { name: 'call-bind', reference: '1.0.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-function-bind-1.1.1-integrity/node_modules/function-bind/',
    { name: 'function-bind', reference: '1.1.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-get-intrinsic-1.1.3-integrity/node_modules/get-intrinsic/',
    { name: 'get-intrinsic', reference: '1.1.3' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-has-1.0.3-integrity/node_modules/has/', { name: 'has', reference: '1.0.3' }],
  [
    '../../Library/Caches/Yarn/v6/npm-has-symbols-1.0.3-integrity/node_modules/has-symbols/',
    { name: 'has-symbols', reference: '1.0.3' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-has-tostringtag-1.0.0-integrity/node_modules/has-tostringtag/',
    { name: 'has-tostringtag', reference: '1.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-generator-function-1.0.10-integrity/node_modules/is-generator-function/',
    { name: 'is-generator-function', reference: '1.0.10' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-typed-array-1.1.9-integrity/node_modules/is-typed-array/',
    { name: 'is-typed-array', reference: '1.1.9' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-available-typed-arrays-1.0.5-integrity/node_modules/available-typed-arrays/',
    { name: 'available-typed-arrays', reference: '1.0.5' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-es-abstract-1.20.4-integrity/node_modules/es-abstract/',
    { name: 'es-abstract', reference: '1.20.4' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-es-to-primitive-1.2.1-integrity/node_modules/es-to-primitive/',
    { name: 'es-to-primitive', reference: '1.2.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-callable-1.2.7-integrity/node_modules/is-callable/',
    { name: 'is-callable', reference: '1.2.7' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-date-object-1.0.5-integrity/node_modules/is-date-object/',
    { name: 'is-date-object', reference: '1.0.5' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-symbol-1.0.4-integrity/node_modules/is-symbol/',
    { name: 'is-symbol', reference: '1.0.4' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-function-prototype-name-1.1.5-integrity/node_modules/function.prototype.name/',
    { name: 'function.prototype.name', reference: '1.1.5' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-define-properties-1.1.4-integrity/node_modules/define-properties/',
    { name: 'define-properties', reference: '1.1.4' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-has-property-descriptors-1.0.0-integrity/node_modules/has-property-descriptors/',
    { name: 'has-property-descriptors', reference: '1.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-object-keys-1.1.1-integrity/node_modules/object-keys/',
    { name: 'object-keys', reference: '1.1.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-functions-have-names-1.2.3-integrity/node_modules/functions-have-names/',
    { name: 'functions-have-names', reference: '1.2.3' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-get-symbol-description-1.0.0-integrity/node_modules/get-symbol-description/',
    { name: 'get-symbol-description', reference: '1.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-internal-slot-1.0.3-integrity/node_modules/internal-slot/',
    { name: 'internal-slot', reference: '1.0.3' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-side-channel-1.0.4-integrity/node_modules/side-channel/',
    { name: 'side-channel', reference: '1.0.4' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-object-inspect-1.12.2-integrity/node_modules/object-inspect/',
    { name: 'object-inspect', reference: '1.12.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-negative-zero-2.0.2-integrity/node_modules/is-negative-zero/',
    { name: 'is-negative-zero', reference: '2.0.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-regex-1.1.4-integrity/node_modules/is-regex/',
    { name: 'is-regex', reference: '1.1.4' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-shared-array-buffer-1.0.2-integrity/node_modules/is-shared-array-buffer/',
    { name: 'is-shared-array-buffer', reference: '1.0.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-string-1.0.7-integrity/node_modules/is-string/',
    { name: 'is-string', reference: '1.0.7' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-weakref-1.0.2-integrity/node_modules/is-weakref/',
    { name: 'is-weakref', reference: '1.0.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-object-assign-4.1.4-integrity/node_modules/object.assign/',
    { name: 'object.assign', reference: '4.1.4' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-regexp-prototype-flags-1.4.3-integrity/node_modules/regexp.prototype.flags/',
    { name: 'regexp.prototype.flags', reference: '1.4.3' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-safe-regex-test-1.0.0-integrity/node_modules/safe-regex-test/',
    { name: 'safe-regex-test', reference: '1.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-string-prototype-trimend-1.0.5-integrity/node_modules/string.prototype.trimend/',
    { name: 'string.prototype.trimend', reference: '1.0.5' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-string-prototype-trimstart-1.0.5-integrity/node_modules/string.prototype.trimstart/',
    { name: 'string.prototype.trimstart', reference: '1.0.5' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-unbox-primitive-1.0.2-integrity/node_modules/unbox-primitive/',
    { name: 'unbox-primitive', reference: '1.0.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-has-bigints-1.0.2-integrity/node_modules/has-bigints/',
    { name: 'has-bigints', reference: '1.0.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-which-boxed-primitive-1.0.2-integrity/node_modules/which-boxed-primitive/',
    { name: 'which-boxed-primitive', reference: '1.0.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-bigint-1.0.4-integrity/node_modules/is-bigint/',
    { name: 'is-bigint', reference: '1.0.4' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-boolean-object-1.1.2-integrity/node_modules/is-boolean-object/',
    { name: 'is-boolean-object', reference: '1.1.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-number-object-1.0.7-integrity/node_modules/is-number-object/',
    { name: 'is-number-object', reference: '1.0.7' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-for-each-0.3.3-integrity/node_modules/for-each/',
    { name: 'for-each', reference: '0.3.3' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-which-typed-array-1.1.8-integrity/node_modules/which-typed-array/',
    { name: 'which-typed-array', reference: '1.1.8' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@zxing-text-encoding-0.9.0-integrity/node_modules/@zxing/text-encoding/',
    { name: '@zxing/text-encoding', reference: '0.9.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@types-cookie-0.4.1-integrity/node_modules/@types/cookie/',
    { name: '@types/cookie', reference: '0.4.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@types-js-levenshtein-1.1.1-integrity/node_modules/@types/js-levenshtein/',
    { name: '@types/js-levenshtein', reference: '1.1.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-chokidar-3.5.3-integrity/node_modules/chokidar/',
    { name: 'chokidar', reference: '3.5.3' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-anymatch-3.1.2-integrity/node_modules/anymatch/',
    { name: 'anymatch', reference: '3.1.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-normalize-path-3.0.0-integrity/node_modules/normalize-path/',
    { name: 'normalize-path', reference: '3.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-picomatch-2.3.1-integrity/node_modules/picomatch/',
    { name: 'picomatch', reference: '2.3.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-braces-3.0.2-integrity/node_modules/braces/',
    { name: 'braces', reference: '3.0.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-fill-range-7.0.1-integrity/node_modules/fill-range/',
    { name: 'fill-range', reference: '7.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-to-regex-range-5.0.1-integrity/node_modules/to-regex-range/',
    { name: 'to-regex-range', reference: '5.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-number-7.0.0-integrity/node_modules/is-number/',
    { name: 'is-number', reference: '7.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-glob-parent-5.1.2-integrity/node_modules/glob-parent/',
    { name: 'glob-parent', reference: '5.1.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-glob-4.0.3-integrity/node_modules/is-glob/',
    { name: 'is-glob', reference: '4.0.3' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-extglob-2.1.1-integrity/node_modules/is-extglob/',
    { name: 'is-extglob', reference: '2.1.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-binary-path-2.1.0-integrity/node_modules/is-binary-path/',
    { name: 'is-binary-path', reference: '2.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-binary-extensions-2.2.0-integrity/node_modules/binary-extensions/',
    { name: 'binary-extensions', reference: '2.2.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-readdirp-3.6.0-integrity/node_modules/readdirp/',
    { name: 'readdirp', reference: '3.6.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-fsevents-2.3.2-integrity/node_modules/fsevents/',
    { name: 'fsevents', reference: '2.3.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-cookie-0.4.2-integrity/node_modules/cookie/',
    { name: 'cookie', reference: '0.4.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-graphql-16.6.0-integrity/node_modules/graphql/',
    { name: 'graphql', reference: '16.6.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-inquirer-8.2.5-integrity/node_modules/inquirer/',
    { name: 'inquirer', reference: '8.2.5' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-ansi-escapes-4.3.2-integrity/node_modules/ansi-escapes/',
    { name: 'ansi-escapes', reference: '4.3.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-type-fest-0.21.3-integrity/node_modules/type-fest/',
    { name: 'type-fest', reference: '0.21.3' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-type-fest-2.19.0-integrity/node_modules/type-fest/',
    { name: 'type-fest', reference: '2.19.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-cli-cursor-3.1.0-integrity/node_modules/cli-cursor/',
    { name: 'cli-cursor', reference: '3.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-restore-cursor-3.1.0-integrity/node_modules/restore-cursor/',
    { name: 'restore-cursor', reference: '3.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-onetime-5.1.2-integrity/node_modules/onetime/',
    { name: 'onetime', reference: '5.1.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-mimic-fn-2.1.0-integrity/node_modules/mimic-fn/',
    { name: 'mimic-fn', reference: '2.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-signal-exit-3.0.7-integrity/node_modules/signal-exit/',
    { name: 'signal-exit', reference: '3.0.7' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-cli-width-3.0.0-integrity/node_modules/cli-width/',
    { name: 'cli-width', reference: '3.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-external-editor-3.1.0-integrity/node_modules/external-editor/',
    { name: 'external-editor', reference: '3.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-chardet-0.7.0-integrity/node_modules/chardet/',
    { name: 'chardet', reference: '0.7.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-iconv-lite-0.4.24-integrity/node_modules/iconv-lite/',
    { name: 'iconv-lite', reference: '0.4.24' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-safer-buffer-2.1.2-integrity/node_modules/safer-buffer/',
    { name: 'safer-buffer', reference: '2.1.2' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-tmp-0.0.33-integrity/node_modules/tmp/', { name: 'tmp', reference: '0.0.33' }],
  [
    '../../Library/Caches/Yarn/v6/npm-os-tmpdir-1.0.2-integrity/node_modules/os-tmpdir/',
    { name: 'os-tmpdir', reference: '1.0.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-figures-3.2.0-integrity/node_modules/figures/',
    { name: 'figures', reference: '3.2.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-mute-stream-0.0.8-integrity/node_modules/mute-stream/',
    { name: 'mute-stream', reference: '0.0.8' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-ora-5.4.1-integrity/node_modules/ora/', { name: 'ora', reference: '5.4.1' }],
  [
    '../../Library/Caches/Yarn/v6/npm-cli-spinners-2.7.0-integrity/node_modules/cli-spinners/',
    { name: 'cli-spinners', reference: '2.7.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-interactive-1.0.0-integrity/node_modules/is-interactive/',
    { name: 'is-interactive', reference: '1.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-unicode-supported-0.1.0-integrity/node_modules/is-unicode-supported/',
    { name: 'is-unicode-supported', reference: '0.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-log-symbols-4.1.0-integrity/node_modules/log-symbols/',
    { name: 'log-symbols', reference: '4.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-strip-ansi-6.0.1-integrity/node_modules/strip-ansi/',
    { name: 'strip-ansi', reference: '6.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-ansi-regex-5.0.1-integrity/node_modules/ansi-regex/',
    { name: 'ansi-regex', reference: '5.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-wcwidth-1.0.1-integrity/node_modules/wcwidth/',
    { name: 'wcwidth', reference: '1.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-defaults-1.0.4-integrity/node_modules/defaults/',
    { name: 'defaults', reference: '1.0.4' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-clone-1.0.4-integrity/node_modules/clone/', { name: 'clone', reference: '1.0.4' }],
  [
    '../../Library/Caches/Yarn/v6/npm-run-async-2.4.1-integrity/node_modules/run-async/',
    { name: 'run-async', reference: '2.4.1' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-rxjs-7.5.7-integrity/node_modules/rxjs/', { name: 'rxjs', reference: '7.5.7' }],
  ['../../Library/Caches/Yarn/v6/npm-tslib-2.4.0-integrity/node_modules/tslib/', { name: 'tslib', reference: '2.4.0' }],
  [
    '../../Library/Caches/Yarn/v6/npm-string-width-4.2.3-integrity/node_modules/string-width/',
    { name: 'string-width', reference: '4.2.3' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-emoji-regex-8.0.0-integrity/node_modules/emoji-regex/',
    { name: 'emoji-regex', reference: '8.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-fullwidth-code-point-3.0.0-integrity/node_modules/is-fullwidth-code-point/',
    { name: 'is-fullwidth-code-point', reference: '3.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-wrap-ansi-7.0.0-integrity/node_modules/wrap-ansi/',
    { name: 'wrap-ansi', reference: '7.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-node-process-1.0.1-integrity/node_modules/is-node-process/',
    { name: 'is-node-process', reference: '1.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-js-levenshtein-1.1.6-integrity/node_modules/js-levenshtein/',
    { name: 'js-levenshtein', reference: '1.1.6' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-path-to-regexp-6.2.1-integrity/node_modules/path-to-regexp/',
    { name: 'path-to-regexp', reference: '6.2.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-statuses-2.0.1-integrity/node_modules/statuses/',
    { name: 'statuses', reference: '2.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-yargs-17.6.0-integrity/node_modules/yargs/',
    { name: 'yargs', reference: '17.6.0' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-cliui-8.0.1-integrity/node_modules/cliui/', { name: 'cliui', reference: '8.0.1' }],
  [
    '../../Library/Caches/Yarn/v6/npm-escalade-3.1.1-integrity/node_modules/escalade/',
    { name: 'escalade', reference: '3.1.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-get-caller-file-2.0.5-integrity/node_modules/get-caller-file/',
    { name: 'get-caller-file', reference: '2.0.5' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-require-directory-2.1.1-integrity/node_modules/require-directory/',
    { name: 'require-directory', reference: '2.1.1' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-y18n-5.0.8-integrity/node_modules/y18n/', { name: 'y18n', reference: '5.0.8' }],
  [
    '../../Library/Caches/Yarn/v6/npm-yargs-parser-21.1.1-integrity/node_modules/yargs-parser/',
    { name: 'yargs-parser', reference: '21.1.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-prettier-2.7.1-integrity/node_modules/prettier/',
    { name: 'prettier', reference: '2.7.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-pretty-quick-3.1.3-integrity/node_modules/pretty-quick/',
    { name: 'pretty-quick', reference: '3.1.3' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-execa-4.1.0-integrity/node_modules/execa/', { name: 'execa', reference: '4.1.0' }],
  [
    '../../Library/Caches/Yarn/v6/npm-cross-spawn-7.0.3-integrity/node_modules/cross-spawn/',
    { name: 'cross-spawn', reference: '7.0.3' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-path-key-3.1.1-integrity/node_modules/path-key/',
    { name: 'path-key', reference: '3.1.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-shebang-command-2.0.0-integrity/node_modules/shebang-command/',
    { name: 'shebang-command', reference: '2.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-shebang-regex-3.0.0-integrity/node_modules/shebang-regex/',
    { name: 'shebang-regex', reference: '3.0.0' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-which-2.0.2-integrity/node_modules/which/', { name: 'which', reference: '2.0.2' }],
  ['../../Library/Caches/Yarn/v6/npm-isexe-2.0.0-integrity/node_modules/isexe/', { name: 'isexe', reference: '2.0.0' }],
  [
    '../../Library/Caches/Yarn/v6/npm-human-signals-1.1.1-integrity/node_modules/human-signals/',
    { name: 'human-signals', reference: '1.1.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-stream-2.0.1-integrity/node_modules/is-stream/',
    { name: 'is-stream', reference: '2.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-merge-stream-2.0.0-integrity/node_modules/merge-stream/',
    { name: 'merge-stream', reference: '2.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-npm-run-path-4.0.1-integrity/node_modules/npm-run-path/',
    { name: 'npm-run-path', reference: '4.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-strip-final-newline-2.0.0-integrity/node_modules/strip-final-newline/',
    { name: 'strip-final-newline', reference: '2.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-ignore-5.2.0-integrity/node_modules/ignore/',
    { name: 'ignore', reference: '5.2.0' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-mri-1.2.0-integrity/node_modules/mri/', { name: 'mri', reference: '1.2.0' }],
  [
    '../../Library/Caches/Yarn/v6/npm-multimatch-4.0.0-integrity/node_modules/multimatch/',
    { name: 'multimatch', reference: '4.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@types-minimatch-3.0.5-integrity/node_modules/@types/minimatch/',
    { name: '@types/minimatch', reference: '3.0.5' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-array-differ-3.0.0-integrity/node_modules/array-differ/',
    { name: 'array-differ', reference: '3.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-arrify-2.0.1-integrity/node_modules/arrify/',
    { name: 'arrify', reference: '2.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-ts-node-10.9.1-integrity/node_modules/ts-node/',
    { name: 'ts-node', reference: '10.9.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@cspotcode-source-map-support-0.8.1-integrity/node_modules/@cspotcode/source-map-support/',
    { name: '@cspotcode/source-map-support', reference: '0.8.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@jridgewell-trace-mapping-0.3.9-integrity/node_modules/@jridgewell/trace-mapping/',
    { name: '@jridgewell/trace-mapping', reference: '0.3.9' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@jridgewell-resolve-uri-3.1.0-integrity/node_modules/@jridgewell/resolve-uri/',
    { name: '@jridgewell/resolve-uri', reference: '3.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@jridgewell-sourcemap-codec-1.4.14-integrity/node_modules/@jridgewell/sourcemap-codec/',
    { name: '@jridgewell/sourcemap-codec', reference: '1.4.14' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@tsconfig-node10-1.0.8-integrity/node_modules/@tsconfig/node10/',
    { name: '@tsconfig/node10', reference: '1.0.8' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@tsconfig-node12-1.0.9-integrity/node_modules/@tsconfig/node12/',
    { name: '@tsconfig/node12', reference: '1.0.9' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@tsconfig-node14-1.0.1-integrity/node_modules/@tsconfig/node14/',
    { name: '@tsconfig/node14', reference: '1.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@tsconfig-node16-1.0.2-integrity/node_modules/@tsconfig/node16/',
    { name: '@tsconfig/node16', reference: '1.0.2' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-acorn-8.8.1-integrity/node_modules/acorn/', { name: 'acorn', reference: '8.8.1' }],
  [
    '../../Library/Caches/Yarn/v6/npm-acorn-walk-8.2.0-integrity/node_modules/acorn-walk/',
    { name: 'acorn-walk', reference: '8.2.0' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-arg-4.1.3-integrity/node_modules/arg/', { name: 'arg', reference: '4.1.3' }],
  [
    '../../Library/Caches/Yarn/v6/npm-create-require-1.1.1-integrity/node_modules/create-require/',
    { name: 'create-require', reference: '1.1.1' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-diff-4.0.2-integrity/node_modules/diff/', { name: 'diff', reference: '4.0.2' }],
  [
    '../../Library/Caches/Yarn/v6/npm-make-error-1.3.6-integrity/node_modules/make-error/',
    { name: 'make-error', reference: '1.3.6' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-v8-compile-cache-lib-3.0.1-integrity/node_modules/v8-compile-cache-lib/',
    { name: 'v8-compile-cache-lib', reference: '3.0.1' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-yn-3.1.1-integrity/node_modules/yn/', { name: 'yn', reference: '3.1.1' }],
  ['../../Library/Caches/Yarn/v6/npm-tsc-2.0.4-integrity/node_modules/tsc/', { name: 'tsc', reference: '2.0.4' }],
  [
    '../../Library/Caches/Yarn/v6/npm-vitest-0.24.3-integrity/node_modules/vitest/',
    { name: 'vitest', reference: '0.24.3' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@types-chai-4.3.3-integrity/node_modules/@types/chai/',
    { name: '@types/chai', reference: '4.3.3' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-@types-chai-subset-1.3.3-integrity/node_modules/@types/chai-subset/',
    { name: '@types/chai-subset', reference: '1.3.3' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-chai-4.3.6-integrity/node_modules/chai/', { name: 'chai', reference: '4.3.6' }],
  [
    '../../Library/Caches/Yarn/v6/npm-assertion-error-1.1.0-integrity/node_modules/assertion-error/',
    { name: 'assertion-error', reference: '1.1.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-check-error-1.0.2-integrity/node_modules/check-error/',
    { name: 'check-error', reference: '1.0.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-deep-eql-3.0.1-integrity/node_modules/deep-eql/',
    { name: 'deep-eql', reference: '3.0.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-type-detect-4.0.8-integrity/node_modules/type-detect/',
    { name: 'type-detect', reference: '4.0.8' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-get-func-name-2.0.0-integrity/node_modules/get-func-name/',
    { name: 'get-func-name', reference: '2.0.0' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-loupe-2.3.4-integrity/node_modules/loupe/', { name: 'loupe', reference: '2.3.4' }],
  [
    '../../Library/Caches/Yarn/v6/npm-pathval-1.1.1-integrity/node_modules/pathval/',
    { name: 'pathval', reference: '1.1.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-local-pkg-0.4.2-integrity/node_modules/local-pkg/',
    { name: 'local-pkg', reference: '0.4.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-strip-literal-0.4.2-integrity/node_modules/strip-literal/',
    { name: 'strip-literal', reference: '0.4.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-tinybench-2.3.1-integrity/node_modules/tinybench/',
    { name: 'tinybench', reference: '2.3.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-tinypool-0.3.0-integrity/node_modules/tinypool/',
    { name: 'tinypool', reference: '0.3.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-tinyspy-1.0.2-integrity/node_modules/tinyspy/',
    { name: 'tinyspy', reference: '1.0.2' },
  ],
  ['../../Library/Caches/Yarn/v6/npm-vite-3.1.8-integrity/node_modules/vite/', { name: 'vite', reference: '3.1.8' }],
  ['./.pnp/unplugged/npm-esbuild-0.15.12-integrity/node_modules/esbuild/', { name: 'esbuild', reference: '0.15.12' }],
  [
    '../../Library/Caches/Yarn/v6/npm-esbuild-darwin-64-0.15.12-integrity/node_modules/esbuild-darwin-64/',
    { name: 'esbuild-darwin-64', reference: '0.15.12' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-postcss-8.4.18-integrity/node_modules/postcss/',
    { name: 'postcss', reference: '8.4.18' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-nanoid-3.3.4-integrity/node_modules/nanoid/',
    { name: 'nanoid', reference: '3.3.4' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-picocolors-1.0.0-integrity/node_modules/picocolors/',
    { name: 'picocolors', reference: '1.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-source-map-js-1.0.2-integrity/node_modules/source-map-js/',
    { name: 'source-map-js', reference: '1.0.2' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-resolve-1.22.1-integrity/node_modules/resolve/',
    { name: 'resolve', reference: '1.22.1' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-is-core-module-2.11.0-integrity/node_modules/is-core-module/',
    { name: 'is-core-module', reference: '2.11.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-path-parse-1.0.7-integrity/node_modules/path-parse/',
    { name: 'path-parse', reference: '1.0.7' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-supports-preserve-symlinks-flag-1.0.0-integrity/node_modules/supports-preserve-symlinks-flag/',
    { name: 'supports-preserve-symlinks-flag', reference: '1.0.0' },
  ],
  [
    '../../Library/Caches/Yarn/v6/npm-rollup-2.78.1-integrity/node_modules/rollup/',
    { name: 'rollup', reference: '2.78.1' },
  ],
  ['./', topLevelLocator],
])
exports.findPackageLocator = function findPackageLocator(location) {
  let relativeLocation = normalizePath(path.relative(__dirname, location))

  if (!relativeLocation.match(isStrictRegExp)) relativeLocation = `./${relativeLocation}`

  if (location.match(isDirRegExp) && relativeLocation.charAt(relativeLocation.length - 1) !== '/')
    relativeLocation = `${relativeLocation}/`

  let match

  if (relativeLocation.length >= 142 && relativeLocation[141] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 142)))) return blacklistCheck(match)

  if (relativeLocation.length >= 136 && relativeLocation[135] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 136)))) return blacklistCheck(match)

  if (relativeLocation.length >= 133 && relativeLocation[132] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 133)))) return blacklistCheck(match)

  if (relativeLocation.length >= 126 && relativeLocation[125] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 126)))) return blacklistCheck(match)

  if (relativeLocation.length >= 125 && relativeLocation[124] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 125)))) return blacklistCheck(match)

  if (relativeLocation.length >= 122 && relativeLocation[121] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 122)))) return blacklistCheck(match)

  if (relativeLocation.length >= 119 && relativeLocation[118] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 119)))) return blacklistCheck(match)

  if (relativeLocation.length >= 116 && relativeLocation[115] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 116)))) return blacklistCheck(match)

  if (relativeLocation.length >= 114 && relativeLocation[113] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 114)))) return blacklistCheck(match)

  if (relativeLocation.length >= 112 && relativeLocation[111] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 112)))) return blacklistCheck(match)

  if (relativeLocation.length >= 110 && relativeLocation[109] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 110)))) return blacklistCheck(match)

  if (relativeLocation.length >= 109 && relativeLocation[108] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 109)))) return blacklistCheck(match)

  if (relativeLocation.length >= 108 && relativeLocation[107] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 108)))) return blacklistCheck(match)

  if (relativeLocation.length >= 107 && relativeLocation[106] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 107)))) return blacklistCheck(match)

  if (relativeLocation.length >= 106 && relativeLocation[105] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 106)))) return blacklistCheck(match)

  if (relativeLocation.length >= 104 && relativeLocation[103] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 104)))) return blacklistCheck(match)

  if (relativeLocation.length >= 103 && relativeLocation[102] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 103)))) return blacklistCheck(match)

  if (relativeLocation.length >= 102 && relativeLocation[101] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 102)))) return blacklistCheck(match)

  if (relativeLocation.length >= 100 && relativeLocation[99] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 100)))) return blacklistCheck(match)

  if (relativeLocation.length >= 99 && relativeLocation[98] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 99)))) return blacklistCheck(match)

  if (relativeLocation.length >= 98 && relativeLocation[97] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 98)))) return blacklistCheck(match)

  if (relativeLocation.length >= 97 && relativeLocation[96] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 97)))) return blacklistCheck(match)

  if (relativeLocation.length >= 96 && relativeLocation[95] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 96)))) return blacklistCheck(match)

  if (relativeLocation.length >= 95 && relativeLocation[94] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 95)))) return blacklistCheck(match)

  if (relativeLocation.length >= 94 && relativeLocation[93] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 94)))) return blacklistCheck(match)

  if (relativeLocation.length >= 93 && relativeLocation[92] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 93)))) return blacklistCheck(match)

  if (relativeLocation.length >= 92 && relativeLocation[91] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 92)))) return blacklistCheck(match)

  if (relativeLocation.length >= 90 && relativeLocation[89] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 90)))) return blacklistCheck(match)

  if (relativeLocation.length >= 89 && relativeLocation[88] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 89)))) return blacklistCheck(match)

  if (relativeLocation.length >= 88 && relativeLocation[87] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 88)))) return blacklistCheck(match)

  if (relativeLocation.length >= 87 && relativeLocation[86] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 87)))) return blacklistCheck(match)

  if (relativeLocation.length >= 86 && relativeLocation[85] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 86)))) return blacklistCheck(match)

  if (relativeLocation.length >= 85 && relativeLocation[84] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 85)))) return blacklistCheck(match)

  if (relativeLocation.length >= 84 && relativeLocation[83] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 84)))) return blacklistCheck(match)

  if (relativeLocation.length >= 83 && relativeLocation[82] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 83)))) return blacklistCheck(match)

  if (relativeLocation.length >= 82 && relativeLocation[81] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 82)))) return blacklistCheck(match)

  if (relativeLocation.length >= 81 && relativeLocation[80] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 81)))) return blacklistCheck(match)

  if (relativeLocation.length >= 80 && relativeLocation[79] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 80)))) return blacklistCheck(match)

  if (relativeLocation.length >= 79 && relativeLocation[78] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 79)))) return blacklistCheck(match)

  if (relativeLocation.length >= 78 && relativeLocation[77] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 78)))) return blacklistCheck(match)

  if (relativeLocation.length >= 77 && relativeLocation[76] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 77)))) return blacklistCheck(match)

  if (relativeLocation.length >= 76 && relativeLocation[75] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 76)))) return blacklistCheck(match)

  if (relativeLocation.length >= 75 && relativeLocation[74] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 75)))) return blacklistCheck(match)

  if (relativeLocation.length >= 74 && relativeLocation[73] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 74)))) return blacklistCheck(match)

  if (relativeLocation.length >= 73 && relativeLocation[72] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 73)))) return blacklistCheck(match)

  if (relativeLocation.length >= 72 && relativeLocation[71] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 72)))) return blacklistCheck(match)

  if (relativeLocation.length >= 71 && relativeLocation[70] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 71)))) return blacklistCheck(match)

  if (relativeLocation.length >= 70 && relativeLocation[69] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 70)))) return blacklistCheck(match)

  if (relativeLocation.length >= 68 && relativeLocation[67] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 68)))) return blacklistCheck(match)

  if (relativeLocation.length >= 64 && relativeLocation[63] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 64)))) return blacklistCheck(match)

  if (relativeLocation.length >= 59 && relativeLocation[58] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 59)))) return blacklistCheck(match)

  if (relativeLocation.length >= 2 && relativeLocation[1] === '/')
    if ((match = locatorsByLocations.get(relativeLocation.substr(0, 2)))) return blacklistCheck(match)

  return null
}

/**
 * Returns the module that should be used to resolve require calls. It's usually the direct parent, except if we're
 * inside an eval expression.
 */

function getIssuerModule(parent) {
  let issuer = parent

  while (issuer && (issuer.id === '[eval]' || issuer.id === '<repl>' || !issuer.filename)) {
    issuer = issuer.parent
  }

  return issuer
}

/**
 * Returns information about a package in a safe way (will throw if they cannot be retrieved)
 */

function getPackageInformationSafe(packageLocator) {
  const packageInformation = exports.getPackageInformation(packageLocator)

  if (!packageInformation) {
    throw makeError(
      `INTERNAL`,
      `Couldn't find a matching entry in the dependency tree for the specified parent (this is probably an internal error)`,
    )
  }

  return packageInformation
}

/**
 * Implements the node resolution for folder access and extension selection
 */

function applyNodeExtensionResolution(unqualifiedPath, { extensions }) {
  // We use this "infinite while" so that we can restart the process as long as we hit package folders
  while (true) {
    let stat

    try {
      stat = statSync(unqualifiedPath)
    } catch (error) {}

    // If the file exists and is a file, we can stop right there

    if (stat && !stat.isDirectory()) {
      // If the very last component of the resolved path is a symlink to a file, we then resolve it to a file. We only
      // do this first the last component, and not the rest of the path! This allows us to support the case of bin
      // symlinks, where a symlink in "/xyz/pkg-name/.bin/bin-name" will point somewhere else (like "/xyz/pkg-name/index.js").
      // In such a case, we want relative requires to be resolved relative to "/xyz/pkg-name/" rather than "/xyz/pkg-name/.bin/".
      //
      // Also note that the reason we must use readlink on the last component (instead of realpath on the whole path)
      // is that we must preserve the other symlinks, in particular those used by pnp to deambiguate packages using
      // peer dependencies. For example, "/xyz/.pnp/local/pnp-01234569/.bin/bin-name" should see its relative requires
      // be resolved relative to "/xyz/.pnp/local/pnp-0123456789/" rather than "/xyz/pkg-with-peers/", because otherwise
      // we would lose the information that would tell us what are the dependencies of pkg-with-peers relative to its
      // ancestors.

      if (lstatSync(unqualifiedPath).isSymbolicLink()) {
        unqualifiedPath = path.normalize(path.resolve(path.dirname(unqualifiedPath), readlinkSync(unqualifiedPath)))
      }

      return unqualifiedPath
    }

    // If the file is a directory, we must check if it contains a package.json with a "main" entry

    if (stat && stat.isDirectory()) {
      let pkgJson

      try {
        pkgJson = JSON.parse(readFileSync(`${unqualifiedPath}/package.json`, 'utf-8'))
      } catch (error) {}

      let nextUnqualifiedPath

      if (pkgJson && pkgJson.main) {
        nextUnqualifiedPath = path.resolve(unqualifiedPath, pkgJson.main)
      }

      // If the "main" field changed the path, we start again from this new location

      if (nextUnqualifiedPath && nextUnqualifiedPath !== unqualifiedPath) {
        const resolution = applyNodeExtensionResolution(nextUnqualifiedPath, { extensions })

        if (resolution !== null) {
          return resolution
        }
      }
    }

    // Otherwise we check if we find a file that match one of the supported extensions

    const qualifiedPath = extensions
      .map((extension) => {
        return `${unqualifiedPath}${extension}`
      })
      .find((candidateFile) => {
        return existsSync(candidateFile)
      })

    if (qualifiedPath) {
      return qualifiedPath
    }

    // Otherwise, we check if the path is a folder - in such a case, we try to use its index

    if (stat && stat.isDirectory()) {
      const indexPath = extensions
        .map((extension) => {
          return `${unqualifiedPath}/index${extension}`
        })
        .find((candidateFile) => {
          return existsSync(candidateFile)
        })

      if (indexPath) {
        return indexPath
      }
    }

    // Otherwise there's nothing else we can do :(

    return null
  }
}

/**
 * This function creates fake modules that can be used with the _resolveFilename function.
 * Ideally it would be nice to be able to avoid this, since it causes useless allocations
 * and cannot be cached efficiently (we recompute the nodeModulePaths every time).
 *
 * Fortunately, this should only affect the fallback, and there hopefully shouldn't be a
 * lot of them.
 */

function makeFakeModule(path) {
  const fakeModule = new Module(path, false)
  fakeModule.filename = path
  fakeModule.paths = Module._nodeModulePaths(path)
  return fakeModule
}

/**
 * Normalize path to posix format.
 */

function normalizePath(fsPath) {
  fsPath = path.normalize(fsPath)

  if (process.platform === 'win32') {
    fsPath = fsPath.replace(backwardSlashRegExp, '/')
  }

  return fsPath
}

/**
 * Forward the resolution to the next resolver (usually the native one)
 */

function callNativeResolution(request, issuer) {
  if (issuer.endsWith('/')) {
    issuer += 'internal.js'
  }

  try {
    enableNativeHooks = false

    // Since we would need to create a fake module anyway (to call _resolveLookupPath that
    // would give us the paths to give to _resolveFilename), we can as well not use
    // the {paths} option at all, since it internally makes _resolveFilename create another
    // fake module anyway.
    return Module._resolveFilename(request, makeFakeModule(issuer), false)
  } finally {
    enableNativeHooks = true
  }
}

/**
 * This key indicates which version of the standard is implemented by this resolver. The `std` key is the
 * Plug'n'Play standard, and any other key are third-party extensions. Third-party extensions are not allowed
 * to override the standard, and can only offer new methods.
 *
 * If an new version of the Plug'n'Play standard is released and some extensions conflict with newly added
 * functions, they'll just have to fix the conflicts and bump their own version number.
 */

exports.VERSIONS = { std: 1 }

/**
 * Useful when used together with getPackageInformation to fetch information about the top-level package.
 */

exports.topLevel = { name: null, reference: null }

/**
 * Gets the package information for a given locator. Returns null if they cannot be retrieved.
 */

exports.getPackageInformation = function getPackageInformation({ name, reference }) {
  const packageInformationStore = packageInformationStores.get(name)

  if (!packageInformationStore) {
    return null
  }

  const packageInformation = packageInformationStore.get(reference)

  if (!packageInformation) {
    return null
  }

  return packageInformation
}

/**
 * Transforms a request (what's typically passed as argument to the require function) into an unqualified path.
 * This path is called "unqualified" because it only changes the package name to the package location on the disk,
 * which means that the end result still cannot be directly accessed (for example, it doesn't try to resolve the
 * file extension, or to resolve directories to their "index.js" content). Use the "resolveUnqualified" function
 * to convert them to fully-qualified paths, or just use "resolveRequest" that do both operations in one go.
 *
 * Note that it is extremely important that the `issuer` path ends with a forward slash if the issuer is to be
 * treated as a folder (ie. "/tmp/foo/" rather than "/tmp/foo" if "foo" is a directory). Otherwise relative
 * imports won't be computed correctly (they'll get resolved relative to "/tmp/" instead of "/tmp/foo/").
 */

exports.resolveToUnqualified = function resolveToUnqualified(request, issuer, { considerBuiltins = true } = {}) {
  // The 'pnpapi' request is reserved and will always return the path to the PnP file, from everywhere

  if (request === `pnpapi`) {
    return pnpFile
  }

  // Bailout if the request is a native module

  if (considerBuiltins && builtinModules.has(request)) {
    return null
  }

  // We allow disabling the pnp resolution for some subpaths. This is because some projects, often legacy,
  // contain multiple levels of dependencies (ie. a yarn.lock inside a subfolder of a yarn.lock). This is
  // typically solved using workspaces, but not all of them have been converted already.

  if (ignorePattern && ignorePattern.test(normalizePath(issuer))) {
    const result = callNativeResolution(request, issuer)

    if (result === false) {
      throw makeError(
        `BUILTIN_NODE_RESOLUTION_FAIL`,
        `The builtin node resolution algorithm was unable to resolve the module referenced by "${request}" and requested from "${issuer}" (it didn't go through the pnp resolver because the issuer was explicitely ignored by the regexp "null")`,
        {
          request,
          issuer,
        },
      )
    }

    return result
  }

  let unqualifiedPath

  // If the request is a relative or absolute path, we just return it normalized

  const dependencyNameMatch = request.match(pathRegExp)

  if (!dependencyNameMatch) {
    if (path.isAbsolute(request)) {
      unqualifiedPath = path.normalize(request)
    } else if (issuer.match(isDirRegExp)) {
      unqualifiedPath = path.normalize(path.resolve(issuer, request))
    } else {
      unqualifiedPath = path.normalize(path.resolve(path.dirname(issuer), request))
    }
  }

  // Things are more hairy if it's a package require - we then need to figure out which package is needed, and in
  // particular the exact version for the given location on the dependency tree

  if (dependencyNameMatch) {
    const [, dependencyName, subPath] = dependencyNameMatch

    const issuerLocator = exports.findPackageLocator(issuer)

    // If the issuer file doesn't seem to be owned by a package managed through pnp, then we resort to using the next
    // resolution algorithm in the chain, usually the native Node resolution one

    if (!issuerLocator) {
      const result = callNativeResolution(request, issuer)

      if (result === false) {
        throw makeError(
          `BUILTIN_NODE_RESOLUTION_FAIL`,
          `The builtin node resolution algorithm was unable to resolve the module referenced by "${request}" and requested from "${issuer}" (it didn't go through the pnp resolver because the issuer doesn't seem to be part of the Yarn-managed dependency tree)`,
          {
            request,
            issuer,
          },
        )
      }

      return result
    }

    const issuerInformation = getPackageInformationSafe(issuerLocator)

    // We obtain the dependency reference in regard to the package that request it

    let dependencyReference = issuerInformation.packageDependencies.get(dependencyName)

    // If we can't find it, we check if we can potentially load it from the packages that have been defined as potential fallbacks.
    // It's a bit of a hack, but it improves compatibility with the existing Node ecosystem. Hopefully we should eventually be able
    // to kill this logic and become stricter once pnp gets enough traction and the affected packages fix themselves.

    if (issuerLocator !== topLevelLocator) {
      for (let t = 0, T = fallbackLocators.length; dependencyReference === undefined && t < T; ++t) {
        const fallbackInformation = getPackageInformationSafe(fallbackLocators[t])
        dependencyReference = fallbackInformation.packageDependencies.get(dependencyName)
      }
    }

    // If we can't find the path, and if the package making the request is the top-level, we can offer nicer error messages

    if (!dependencyReference) {
      if (dependencyReference === null) {
        if (issuerLocator === topLevelLocator) {
          throw makeError(
            `MISSING_PEER_DEPENDENCY`,
            `You seem to be requiring a peer dependency ("${dependencyName}"), but it is not installed (which might be because you're the top-level package)`,
            { request, issuer, dependencyName },
          )
        } else {
          throw makeError(
            `MISSING_PEER_DEPENDENCY`,
            `Package "${issuerLocator.name}@${issuerLocator.reference}" is trying to access a peer dependency ("${dependencyName}") that should be provided by its direct ancestor but isn't`,
            { request, issuer, issuerLocator: Object.assign({}, issuerLocator), dependencyName },
          )
        }
      } else {
        if (issuerLocator === topLevelLocator) {
          throw makeError(
            `UNDECLARED_DEPENDENCY`,
            `You cannot require a package ("${dependencyName}") that is not declared in your dependencies (via "${issuer}")`,
            { request, issuer, dependencyName },
          )
        } else {
          const candidates = Array.from(issuerInformation.packageDependencies.keys())
          throw makeError(
            `UNDECLARED_DEPENDENCY`,
            `Package "${issuerLocator.name}@${
              issuerLocator.reference
            }" (via "${issuer}") is trying to require the package "${dependencyName}" (via "${request}") without it being listed in its dependencies (${candidates.join(
              `, `,
            )})`,
            { request, issuer, issuerLocator: Object.assign({}, issuerLocator), dependencyName, candidates },
          )
        }
      }
    }

    // We need to check that the package exists on the filesystem, because it might not have been installed

    const dependencyLocator = { name: dependencyName, reference: dependencyReference }
    const dependencyInformation = exports.getPackageInformation(dependencyLocator)
    const dependencyLocation = path.resolve(__dirname, dependencyInformation.packageLocation)

    if (!dependencyLocation) {
      throw makeError(
        `MISSING_DEPENDENCY`,
        `Package "${dependencyLocator.name}@${dependencyLocator.reference}" is a valid dependency, but hasn't been installed and thus cannot be required (it might be caused if you install a partial tree, such as on production environments)`,
        { request, issuer, dependencyLocator: Object.assign({}, dependencyLocator) },
      )
    }

    // Now that we know which package we should resolve to, we only have to find out the file location

    if (subPath) {
      unqualifiedPath = path.resolve(dependencyLocation, subPath)
    } else {
      unqualifiedPath = dependencyLocation
    }
  }

  return path.normalize(unqualifiedPath)
}

/**
 * Transforms an unqualified path into a qualified path by using the Node resolution algorithm (which automatically
 * appends ".js" / ".json", and transforms directory accesses into "index.js").
 */

exports.resolveUnqualified = function resolveUnqualified(
  unqualifiedPath,
  { extensions = Object.keys(Module._extensions) } = {},
) {
  const qualifiedPath = applyNodeExtensionResolution(unqualifiedPath, { extensions })

  if (qualifiedPath) {
    return path.normalize(qualifiedPath)
  } else {
    throw makeError(
      `QUALIFIED_PATH_RESOLUTION_FAILED`,
      `Couldn't find a suitable Node resolution for unqualified path "${unqualifiedPath}"`,
      { unqualifiedPath },
    )
  }
}

/**
 * Transforms a request into a fully qualified path.
 *
 * Note that it is extremely important that the `issuer` path ends with a forward slash if the issuer is to be
 * treated as a folder (ie. "/tmp/foo/" rather than "/tmp/foo" if "foo" is a directory). Otherwise relative
 * imports won't be computed correctly (they'll get resolved relative to "/tmp/" instead of "/tmp/foo/").
 */

exports.resolveRequest = function resolveRequest(request, issuer, { considerBuiltins, extensions } = {}) {
  let unqualifiedPath

  try {
    unqualifiedPath = exports.resolveToUnqualified(request, issuer, { considerBuiltins })
  } catch (originalError) {
    // If we get a BUILTIN_NODE_RESOLUTION_FAIL error there, it means that we've had to use the builtin node
    // resolution, which usually shouldn't happen. It might be because the user is trying to require something
    // from a path loaded through a symlink (which is not possible, because we need something normalized to
    // figure out which package is making the require call), so we try to make the same request using a fully
    // resolved issuer and throws a better and more actionable error if it works.
    if (originalError.code === `BUILTIN_NODE_RESOLUTION_FAIL`) {
      let realIssuer

      try {
        realIssuer = realpathSync(issuer)
      } catch (error) {}

      if (realIssuer) {
        if (issuer.endsWith(`/`)) {
          realIssuer = realIssuer.replace(/\/?$/, `/`)
        }

        try {
          exports.resolveToUnqualified(request, realIssuer, { considerBuiltins })
        } catch (error) {
          // If an error was thrown, the problem doesn't seem to come from a path not being normalized, so we
          // can just throw the original error which was legit.
          throw originalError
        }

        // If we reach this stage, it means that resolveToUnqualified didn't fail when using the fully resolved
        // file path, which is very likely caused by a module being invoked through Node with a path not being
        // correctly normalized (ie you should use "node $(realpath script.js)" instead of "node script.js").
        throw makeError(
          `SYMLINKED_PATH_DETECTED`,
          `A pnp module ("${request}") has been required from what seems to be a symlinked path ("${issuer}"). This is not possible, you must ensure that your modules are invoked through their fully resolved path on the filesystem (in this case "${realIssuer}").`,
          {
            request,
            issuer,
            realIssuer,
          },
        )
      }
    }
    throw originalError
  }

  if (unqualifiedPath === null) {
    return null
  }

  try {
    return exports.resolveUnqualified(unqualifiedPath, { extensions })
  } catch (resolutionError) {
    if (resolutionError.code === 'QUALIFIED_PATH_RESOLUTION_FAILED') {
      Object.assign(resolutionError.data, { request, issuer })
    }
    throw resolutionError
  }
}

/**
 * Setups the hook into the Node environment.
 *
 * From this point on, any call to `require()` will go through the "resolveRequest" function, and the result will
 * be used as path of the file to load.
 */

exports.setup = function setup() {
  // A small note: we don't replace the cache here (and instead use the native one). This is an effort to not
  // break code similar to "delete require.cache[require.resolve(FOO)]", where FOO is a package located outside
  // of the Yarn dependency tree. In this case, we defer the load to the native loader. If we were to replace the
  // cache by our own, the native loader would populate its own cache, which wouldn't be exposed anymore, so the
  // delete call would be broken.

  const originalModuleLoad = Module._load

  Module._load = function (request, parent, isMain) {
    if (!enableNativeHooks) {
      return originalModuleLoad.call(Module, request, parent, isMain)
    }

    // Builtins are managed by the regular Node loader

    if (builtinModules.has(request)) {
      try {
        enableNativeHooks = false
        return originalModuleLoad.call(Module, request, parent, isMain)
      } finally {
        enableNativeHooks = true
      }
    }

    // The 'pnpapi' name is reserved to return the PnP api currently in use by the program

    if (request === `pnpapi`) {
      return pnpModule.exports
    }

    // Request `Module._resolveFilename` (ie. `resolveRequest`) to tell us which file we should load

    const modulePath = Module._resolveFilename(request, parent, isMain)

    // Check if the module has already been created for the given file

    const cacheEntry = Module._cache[modulePath]

    if (cacheEntry) {
      return cacheEntry.exports
    }

    // Create a new module and store it into the cache

    const module = new Module(modulePath, parent)
    Module._cache[modulePath] = module

    // The main module is exposed as global variable

    if (isMain) {
      process.mainModule = module
      module.id = '.'
    }

    // Try to load the module, and remove it from the cache if it fails

    let hasThrown = true

    try {
      module.load(modulePath)
      hasThrown = false
    } finally {
      if (hasThrown) {
        delete Module._cache[modulePath]
      }
    }

    // Some modules might have to be patched for compatibility purposes

    for (const [filter, patchFn] of patchedModules) {
      if (filter.test(request)) {
        module.exports = patchFn(exports.findPackageLocator(parent.filename), module.exports)
      }
    }

    return module.exports
  }

  const originalModuleResolveFilename = Module._resolveFilename

  Module._resolveFilename = function (request, parent, isMain, options) {
    if (!enableNativeHooks) {
      return originalModuleResolveFilename.call(Module, request, parent, isMain, options)
    }

    let issuers

    if (options) {
      const optionNames = new Set(Object.keys(options))
      optionNames.delete('paths')

      if (optionNames.size > 0) {
        throw makeError(
          `UNSUPPORTED`,
          `Some options passed to require() aren't supported by PnP yet (${Array.from(optionNames).join(', ')})`,
        )
      }

      if (options.paths) {
        issuers = options.paths.map((entry) => `${path.normalize(entry)}/`)
      }
    }

    if (!issuers) {
      const issuerModule = getIssuerModule(parent)
      const issuer = issuerModule ? issuerModule.filename : `${process.cwd()}/`

      issuers = [issuer]
    }

    let firstError

    for (const issuer of issuers) {
      let resolution

      try {
        resolution = exports.resolveRequest(request, issuer)
      } catch (error) {
        firstError = firstError || error
        continue
      }

      return resolution !== null ? resolution : request
    }

    throw firstError
  }

  const originalFindPath = Module._findPath

  Module._findPath = function (request, paths, isMain) {
    if (!enableNativeHooks) {
      return originalFindPath.call(Module, request, paths, isMain)
    }

    for (const path of paths || []) {
      let resolution

      try {
        resolution = exports.resolveRequest(request, path)
      } catch (error) {
        continue
      }

      if (resolution) {
        return resolution
      }
    }

    return false
  }

  process.versions.pnp = String(exports.VERSIONS.std)
}

exports.setupCompatibilityLayer = () => {
  // ESLint currently doesn't have any portable way for shared configs to specify their own
  // plugins that should be used (https://github.com/eslint/eslint/issues/10125). This will
  // likely get fixed at some point, but it'll take time and in the meantime we'll just add
  // additional fallback entries for common shared configs.

  for (const name of [`react-scripts`]) {
    const packageInformationStore = packageInformationStores.get(name)
    if (packageInformationStore) {
      for (const reference of packageInformationStore.keys()) {
        fallbackLocators.push({ name, reference })
      }
    }
  }

  // Modern versions of `resolve` support a specific entry point that custom resolvers can use
  // to inject a specific resolution logic without having to patch the whole package.
  //
  // Cf: https://github.com/browserify/resolve/pull/174

  patchedModules.push([
    /^\.\/normalize-options\.js$/,
    (issuer, normalizeOptions) => {
      if (!issuer || issuer.name !== 'resolve') {
        return normalizeOptions
      }

      return (request, opts) => {
        opts = opts || {}

        if (opts.forceNodeResolution) {
          return opts
        }

        opts.preserveSymlinks = true
        opts.paths = function (request, basedir, getNodeModulesDir, opts) {
          // Extract the name of the package being requested (1=full name, 2=scope name, 3=local name)
          const parts = request.match(/^((?:(@[^\/]+)\/)?([^\/]+))/)

          // make sure that basedir ends with a slash
          if (basedir.charAt(basedir.length - 1) !== '/') {
            basedir = path.join(basedir, '/')
          }
          // This is guaranteed to return the path to the "package.json" file from the given package
          const manifestPath = exports.resolveToUnqualified(`${parts[1]}/package.json`, basedir)

          // The first dirname strips the package.json, the second strips the local named folder
          let nodeModules = path.dirname(path.dirname(manifestPath))

          // Strips the scope named folder if needed
          if (parts[2]) {
            nodeModules = path.dirname(nodeModules)
          }

          return [nodeModules]
        }

        return opts
      }
    },
  ])
}

if (module.parent && module.parent.id === 'internal/preload') {
  exports.setupCompatibilityLayer()

  exports.setup()
}

if (process.mainModule === module) {
  exports.setupCompatibilityLayer()

  const reportError = (code, message, data) => {
    process.stdout.write(`${JSON.stringify([{ code, message, data }, null])}\n`)
  }

  const reportSuccess = (resolution) => {
    process.stdout.write(`${JSON.stringify([null, resolution])}\n`)
  }

  const processResolution = (request, issuer) => {
    try {
      reportSuccess(exports.resolveRequest(request, issuer))
    } catch (error) {
      reportError(error.code, error.message, error.data)
    }
  }

  const processRequest = (data) => {
    try {
      const [request, issuer] = JSON.parse(data)
      processResolution(request, issuer)
    } catch (error) {
      reportError(`INVALID_JSON`, error.message, error.data)
    }
  }

  if (process.argv.length > 2) {
    if (process.argv.length !== 4) {
      process.stderr.write(`Usage: ${process.argv[0]} ${process.argv[1]} <request> <issuer>\n`)
      process.exitCode = 64 /* EX_USAGE */
    } else {
      processResolution(process.argv[2], process.argv[3])
    }
  } else {
    let buffer = ''
    const decoder = new StringDecoder.StringDecoder()

    process.stdin.on('data', (chunk) => {
      buffer += decoder.write(chunk)

      do {
        const index = buffer.indexOf('\n')
        if (index === -1) {
          break
        }

        const line = buffer.slice(0, index)
        buffer = buffer.slice(index + 1)

        processRequest(line)
      } while (true)
    })
  }
}
