const oCommentUtilities = require('o-comment-utilities');


/**
 * Base name for the message queue session storage container, which is completed with the collectionId.
 * @type {String}
 */
const storageBaseName = "o-chat-comment-queue-";

/**
 * MessageQueue saves a message to the session storage to preserve it
 * after a page reload.
 * @param {Number|String} collectionId Collection ID.
 * @returns {undefined}
 */
function MessageQueue (collectionId) {
	if (typeof collectionId === "undefined") {
		throw "Collection ID not provided.";
	}

	/**
	 * Saves a comment to the session storage.
	 * @param  {String} commentBody  Body of the comment
	 * @returns {undefined}
	 */
	this.save = function (commentBody) {
		oCommentUtilities.storageWrapper.sessionStorage.setItem(storageBaseName + collectionId, commentBody);
	};

	/**
	 * Verifies if there are comments for the provided collection id.
	 * @return {Boolean} If there are comments saved
	 */
	this.hasComment = function () {
		if (oCommentUtilities.storageWrapper.sessionStorage.hasItem(storageBaseName + collectionId)) {
			return true;
		}

		return false;
	};

	/**
	 * Returns the comment saved in the storage.
	 * @return {String} The saved comment.
	 */
	this.getComment = function () {
		if (this.hasComment(collectionId)) {
			return oCommentUtilities.storageWrapper.sessionStorage.getItem(storageBaseName + collectionId);
		}

		return undefined;
	};

	/**
	 * Clears the storage attached to the provided collectionId.
	 * @return {[type]} [description]
	 */
	this.clear = function () {
		oCommentUtilities.storageWrapper.sessionStorage.removeItem(storageBaseName + collectionId);
	};

	this.destroy = function () {

	};
}
module.exports = MessageQueue;
