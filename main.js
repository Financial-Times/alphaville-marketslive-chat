const globalEvents = require('./src/javascripts/globalEvents');
const config = require('./src/javascripts/config.js');
const oCommentApi = require('o-comment-api');
const defaultConfig = require('./config.js');
const oCommentUtilities = require('o-comment-utilities');
const Widget = require('./src/javascripts/Widget.js');

/**
 * Default config (prod) is set.
 */
config.set(defaultConfig);

/**
 * Set user's session data if it's available.
 */
const userSession = oCommentUtilities.ftUser.getSession();
if (userSession) {
	config.set('sessionId', userSession);
	oCommentApi.setConfig('sessionId', userSession);
}

/**
 * Enable data caching.
 */
oCommentApi.setConfig('cache', true);



/**
 * Widget.js exposed as main constructor
 * @type {object}
 */
module.exports = Widget;

/**
 * Adds or overrides configuration options.
 *
 * @param  {string|object} keyOrObject Key or actually an object with key-value pairs.
 * @param  {anything} value Optional. Should be specified only if keyOrObject is actually a key (string).
 * @return {undefined}
 */
module.exports.setConfig = function () {
	config.set.apply(this, arguments);
};

module.exports.init = function (el) {
	return oCommentUtilities.initDomConstruct({
		context: el,
		classNamespace: 'o-chat',
		eventNamespace: 'oChat',
		module: module.exports
	});
};

module.exports.utilities = oCommentUtilities;
module.exports.dataService = oCommentApi;

/**
 * Enables logging.
 * @return {undefined}
 */
module.exports.enableLogging = function () {
	oCommentUtilities.logger.enable.apply(this, arguments);
};

/**
 * Disables logging.
 * @return {undefined}
 */
module.exports.disableLogging = function () {
	oCommentUtilities.logger.disable.apply(this, arguments);
};

/**
 * Sets logging level.
 * @return {undefined}
 */
module.exports.setLoggingLevel = function () {
	oCommentUtilities.logger.setLevel.apply(this, arguments);
};

document.addEventListener('o.DOMContentLoaded', function () {
	try {
		const configInDomEl = document.querySelector('script[type="application/json"][data-o-chat-config]');
		if (configInDomEl) {
			const configInDom = JSON.parse(configInDomEl.innerHTML);

			module.exports.setConfig(configInDom);
		}
	} catch (e) {
		oCommentUtilities.logger.log('Invalid config in the DOM.', e);
	}

	oCommentUtilities.initDomConstruct({
		classNamespace: 'o-chat',
		eventNamespace: 'oChat',
		module: module.exports,
		auto: true
	});
});

module.exports.on = globalEvents.on;
module.exports.off = globalEvents.off;
