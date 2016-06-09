const oCommentUtilities = require('o-comment-utilities');
const globalEvents = require('./globalEvents');

/**
 * Tracks a comment post.
 * @param  {number} collectionId Livefyre collection ID.
 * @return {undefined}
 */
exports.trackPost = function (collectionId) {
	globalEvents.trigger('event', 'oTracking', {
		category: 'comment',
		action: 'post',
		collectionId: collectionId
	});
	oCommentUtilities.logger.debug('tracking - post', collectionId);
};

/**
 * Tracks when CCS is down.
 * @return {undefined}
 */
exports.trackCcsDown = function () {
	globalEvents.trigger('event', 'oTracking', {
		category: 'component',
		action: 'error',
		error: 'commentsCCSCommunication'
	});
	oCommentUtilities.logger.debug('tracking - ccs down');
};

/**
 * Tracks when the widget is successfully loaded.
 * @return {undefined}
 */
exports.trackSuccessLoad = function () {
	globalEvents.trigger('event', 'oTracking', {
		category: 'component',
		action: 'load',
		component: 'comments'
	});
	oCommentUtilities.logger.debug('tracking - success load');
};
