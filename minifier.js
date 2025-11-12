var assert = require('assert');

/**
 * Test whether a module exists.
 * null for exists, false for not-exists.
 *
 * @param {String} name
 */
function testModule(name) {
  var module = null;
  try {
    require.resolve(name);
  } catch (ignore) {
    module = false;
  }
  return module;
}

/**
 * @typedef {{ errorHandler?: Object, uglifyJsModule?: Object }} Options
 * @param {Options} [options]
 */
function Minifier (options) {
  options = options || {};
  this.handleError = options.errorHandler || Minifier.defaultErrorHandler;
  this.uglifyJsModule = testModule('terser');
  this.cleanCssModule = testModule('clean-css');
  this.dispatchMap = {
    js: this._minifyJavaScript,
    css: this._minifyCss,
    json: this._minifyJson,
  };
};

Minifier.defaultErrorHandler = function (errorInfo, callback) {
  if (errorInfo.stage === 'compile') {
    callback(errorInfo.error, JSON.stringify(errorInfo.error));
    return;
  }
  callback(errorInfo.error, errorInfo.body);
};

Minifier.prototype._minifyJavaScript = function (options, body, callback) {
  assert(typeof callback === 'function');
  if (!this.uglifyJsModule) {
    this.uglifyJsModule = require('terser');
  }
  if (options.minify === false) {
    return callback(null, body);
  }
  var result = this.uglifyJsModule.minify(body, options.js);
  if (result.error) {
    return callback({ stage: 'minify', error: result.error, body: body }, null);
  }
  callback(null, result.code);
};

Minifier.prototype._minifyCss = function (options, body, callback) {
  assert(typeof callback === 'function');
  if (!this.cleanCssModule) {
    this.cleanCssModule = require('clean-css');
  }
  if (options.minify === false) {
    return callback(null, body);
  }
  var result = new (this.cleanCssModule)(options.css).minify(body);
  if (result.errors && result.errors.length > 0) {
    return callback({ stage: 'minify', error: result.errors, body: body }, null);
  }
  callback(null, result.styles);
};

Minifier.prototype._minifyJson = function (options, body, callback) {
  assert(typeof callback === 'function');
  if (options.minify === false) {
    return callback(null, body);
  }
  var result;
  try {
    result = JSON.stringify(JSON.parse(body));
  } catch (err) {
    return callback({ stage: 'minify', error: err, body: body }, null);
  }
  callback(null, result);
};
Minifier.prototype._compileAndMinify = function (assetType, options, body, callback) {
  assert(typeof callback === 'function');
  var processor = this.dispatchMap[assetType];
  if (processor !== undefined) {
    processor.call(this, options, body, callback);
  } else {
    callback(null, body);
  }
};

Minifier.prototype.compileAndMinify = function (assetType, options, body, callback) {
  assert(typeof callback === 'function');
  var self = this;
  this._compileAndMinify(assetType, options, body, function (errInfo, result) {
    if (errInfo) {
      errInfo = Object.assign({
        assetType: assetType,
        options: options,
      }, errInfo);
      self.handleError(errInfo, callback);
      return;
    }
    callback(null, result);
  });
};

module.exports = Minifier;
