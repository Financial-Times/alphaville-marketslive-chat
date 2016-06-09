const oCommentUtilities = require('o-comment-utilities');
const userDialogs = require('./userDialogs');
const oCommentApi = require('o-comment-api');
const globalEvents = require('./globalEvents.js');
const envConfig = require('./config.js');


let loggedIn = false;

/**
 * Pseudonym is still missing.
 * @type {Boolean}
 */
exports.pseudonymMissing = false;

/**
 * Tries to obtain the user's login data. Calls a callback with the resulted status,
 * and also fires an event if the user can be logged in.
 * @param  {Function} callback Called with two parameters: loginStatus, authData.
 * @returns {undefined}
 */
exports.login = function (callback) {
	if (typeof callback !== 'function') {
		callback = function () {};
	}

	oCommentApi.api.getAuth(function (err, authData) {
		if (err) {
			callback(false);
			return;
		}

		if (authData) {
			if (authData.token) {
				callback(true, authData);
				loggedIn = true;
				globalEvents.trigger('auth.login', authData);
			} else if (authData.pseudonym === false) {
				// the user doesn't have pseudonym

				exports.pseudonymMissing = true;
				callback(false, authData);
			} else {
				callback(false, authData);
			}
		} else {
			callback(false);
		}
	});
};

/**
 * Broadcasts a logout event.
 * @returns {undefined}
 */
exports.logout = function () {
	oCommentApi.cache.clearAuth();
	globalEvents.trigger('auth.logout');
	loggedIn = false;
};

/**
 * Login required and pseudonym is missing
 * @param  {Function} callback function (err, authData)
 * @returns {undefined}
 */
function loginRequiredPseudonymMissing (callback) {
	if (typeof callback !== 'function') {
		callback = function () {};
	}

	oCommentUtilities.logger.log('pseudonymMissing');

	userDialogs.showSetPseudonymDialog(function (err, authData) {
		if (err) {
			callback(err);
			return;
		}

		if (authData && authData.token) {
			exports.login(function (loginStatus, authData) {
				if (loginStatus) {
					callback(null, authData);
				} else {
					callback(new Error("Not logged in."));
				}
			});
		} else {
			callback(new Error("Login failed."));
		}
	});
}

/**
 * Login required, first attempt of the login process is successful.
 * If the user is still not logged in, then fail.
 * If the user has no pseudonym, ask for a pseudonym.
 * @param  {Function} callback function (err, authData)
 * @returns {undefined}
 */
function loginRequiredAfterASuccess (callback) {
	if (typeof callback !== 'function') {
		callback = function () {};
	}

	oCommentApi.api.getAuth({
		force: true
	}, function (err, authData) {
		if (authData && authData.pseudonym === false) {
			loginRequiredPseudonymMissing(callback);
		} else {
			callback(err || new Error("Login failed."));
		}
	});
}


exports.loginRequiredDefaultBehavior = function () {
	window.location.href = envConfig.get('loginUrl') + '?location=' + encodeURIComponent(document.location.href);
};

const loginRequiredDefaultBehaviorWrapper = function (evt) {
	exports.loginRequiredDefaultBehavior(evt.detail.callback);
};
exports.setLoginRequiredDefaultBehavior = function () {
	// add event handler as lowest priority
	globalEvents.off('auth.loginRequired', loginRequiredDefaultBehaviorWrapper);
	globalEvents.on('auth.loginRequired', loginRequiredDefaultBehaviorWrapper);
};

/**
 * Login is required.
 * If pseudonym is missing, ask for a pseudonym.
 * If there is no known method to login the user, generate a `loginRequired.authAction` event that can be handled at the integration level.
 * If successful, check if the user is logged in.
 * @param {Function} callback function (err, authData)
 * @param {Boolean} force Forces checking the login status of the user by a call to SUDS
 * @returns {undefined}
 */
exports.loginRequired = function (callback, force) {
	if (typeof callback !== 'function') {
		callback = function () {};
	}

	oCommentApi.api.getAuth({
		force: force
	}, function (err, authData) {
		if (authData && authData.pseudonym === false) {
			loginRequiredPseudonymMissing(callback);
		} else if (!authData || !authData.token) {
			if (!oCommentUtilities.ftUser.isLoggedIn()) {
				oCommentUtilities.logger.log('user should log in');

				exports.setLoginRequiredDefaultBehavior();

				globalEvents.trigger('auth.loginRequired', {
					callback: function (errExt) {
						if (errExt) {
							callback(errExt || new Error("Login failed."));
							return;
						}

						loginRequiredAfterASuccess(callback);
					}
				});
			} else {
				oCommentUtilities.logger.log('session expired, show inactivity message');

				userDialogs.showInactivityMessage({
					submit: function () {
						window.location.href = envConfig.get('loginUrl') + '?location=' + encodeURIComponent(document.location.href);
					},
					close: function () {
						callback(new Error("Login failed."));
					}
				});
			}
		} else {
			if (!loggedIn) {
				exports.login(function (loginStatus, authData) {
					if (loginStatus) {
						callback(null, authData);
					} else {
						callback(new Error("Not logged in."));
					}
				});
			} else {
				callback(null);
			}
		}
	});
};
