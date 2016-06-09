const oCommentUi = require('o-comment-ui');

/**
 * List of the templates available.
 * @type {Object}
 */
module.exports = {
	editor: oCommentUi.templatingEngine.compile(requireText('../templates/editor.html')),
	comments: oCommentUi.templatingEngine.compile(requireText('../templates/comments.html')),
	comment: oCommentUi.templatingEngine.compile(requireText('../templates/comment.html')),
	signIn: oCommentUi.templatingEngine.compile(requireText('../templates/signIn.html')),
	loggedIn: oCommentUi.templatingEngine.compile(requireText('../templates/loggedIn.html')),
	notification: oCommentUi.templatingEngine.compile(requireText('../templates/notification.html'))
};
