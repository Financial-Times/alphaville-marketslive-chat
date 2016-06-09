const oCommentUi = require('o-comment-ui');
const oCommentApi = require('o-comment-api');
const Overlay = require('o-overlay');

/**
 * Shows a dialog for setting the initial pseudonym (shown when the user doesn't have a pseudonym set).
 * @param  {Function} callback Optional. function (err, authData)
 * @returns {undefined}
 */
exports.showSetPseudonymDialog = function (callback) {
	callback = callback || function () {};

	oCommentUi.userDialogs.showSetPseudonymDialog({
		submit: function (formData, responseCallback) {
			if (formData && formData.pseudonym) {
				oCommentApi.api.updateUser({
					pseudonym: formData.pseudonym
				}, function (err) {
					if (err) {
						if (typeof err === 'object' && err.sudsError) {
							if (oCommentUi.i18n.serviceMessageOverrides.hasOwnProperty(err.error)) {
								responseCallback(oCommentUi.i18n.serviceMessageOverrides[err.error]);
							} else {
								responseCallback(err.error);
							}
						} else {
							responseCallback(oCommentUi.i18n.texts.changePseudonymError);
						}

						return;
					}


					oCommentApi.api.getAuth({
						force: true
					}, function (err, authData) {
						if (err) {
							responseCallback(oCommentUi.i18n.texts.changePseudonymError);
							callback(err);
							return;
						}

						callback(null, authData);
						responseCallback();
					});
				});
			} else {
				responseCallback(oCommentUi.i18n.texts.changePseudonymBlankError);
			}
		},
		close: function () {
			callback(new Error("Closed or cancelled"));
		}
	});
};

/**
 * Settings dialog where the user can change its pseudonym or email preferences.
 * @param  {Object} currentPseudonym Required. Current pseudonym of the user.
 * @param  {Function} callback Optional. function (err, authData)
 * @returns {undefined}
 */
exports.showChangePseudonymDialog = function (currentPseudonym, callback) {
	callback = callback || function () {};

	oCommentUi.userDialogs.showChangePseudonymDialog(currentPseudonym, {
		submit: function (formData, responseCallback) {
			if (formData) {
				oCommentApi.api.updateUser(formData, function (err) {
					if (err) {
						if (typeof err === 'object' && err.sudsError) {
							if (oCommentUi.i18n.serviceMessageOverrides.hasOwnProperty(err.error)) {
								responseCallback(oCommentUi.i18n.serviceMessageOverrides[err.error]);
							} else {
								responseCallback(err.error);
							}
						} else {
							responseCallback(oCommentUi.i18n.texts.genericError);
						}

						return;
					}

					oCommentApi.api.getAuth({
						force: true
					}, function (err, authData) {
						if (err) {
							callback(err);
							responseCallback(oCommentUi.i18n.texts.genericError);
							return;
						}

						callback(null, authData);
						responseCallback();
					});
				});
			} else {
				responseCallback(oCommentUi.i18n.texts.genericError);
			}
		},
		close: function () {
			callback(new Error("Closed or cancelled."));
		}
	});
};

/**
 * Shows a dialog with a sign in link to re-login after a session expire.
 * @param  {Object} callbacks Object with callback functions. Possible fields:
 *                                - submit: Required. Function that is called when the form is submitted
 *                                - close:  Optional. Function that is called when the dialog is closed.
 */
exports.showInactivityMessage = oCommentUi.userDialogs.showInactivityMessage;


/**
 * Shows a message to the user in a dialog (not modal).
 * @param  {String} title   Title of the dialog
 * @param  {String} message The content of the dialog (the message).
 * @returns {undefined}
 */
exports.showMessage = function (title, message) {
	const idOfTheOverlay = "oChat_showMessage";
	const overlay = new Overlay(idOfTheOverlay, {
		html: message,
		heading: {
			title: title
		},
		modal: false
	});

	overlay.open();
};
