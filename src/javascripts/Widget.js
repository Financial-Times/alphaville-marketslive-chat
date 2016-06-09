const auth = require('./auth.js');
const MessageQueue = require('./MessageQueue.js');
const WidgetUi = require('./WidgetUi.js');
const oCommentUi = require('o-comment-ui');
const oCommentApi = require('o-comment-api');
const oCommentUtilities = require('o-comment-utilities');
const userDialogs = require('./userDialogs.js');
const i18n = require('./i18n.js');
const globalEvents = require('./globalEvents.js');
const envConfig = require('./config.js');
const oTrackingIntegration = require('./oTrackingIntegration');

/**
 * Incorporates the communication with the content creation service,
 * Livefyre authentication, live streaming, and creation of the markup
 * of the commenting widget.
 *
 * The Widget is configurable and customizable.
 *
 *
 * #### Configuration:
 * ##### Mandatory fields:
 *  - articleId: ID of the article, any string
 *  - url: canonical URL of the page
 *  - title: Title of the page
 *
 * ##### Optional fields:
 *  - order: This specifies how the widget is built. It can have two values:
 *      + normal: the commenting box is placed on top of the comment stream, and the comments are ordered as newest on top.
 *      + inverted: the commenting box is placed at the bottom of the comment stream, and the comments are ordered newest on bottom.
 *      <br/>Default value is 'normal'.
 *  - layout: Specifies the layout style of the widget. It can have two values:
 *      + normal: When placed in the main area of the page.
 *      + side: When placed in the side area of the page.
 *      <br/>Default value is 'normal'.
 *  - datetimeFormat: How to format the timestamps. This is an object and has two fields:
 *      + minutesUntilAbsoluteTime: specifies after how many minutes to switch from relative time to absolute.
 *      If -1 is specified, the timestamps will be in the absolute format immediately.
 *      By default it is set to 14 days.
 *      + absoluteFormat: specifies the format with which the absolute timestamp is rendered.
 *      For more information about the possible values please visit:
 *      https://github.com/Financial-Times/o-date#o-dateformatdate-tpl
 *  - section: Override the default mapping based on URL or CAPI with an explicit mapping. Section parameter should be a valid FT metadata term (Primary section)
 *  - tags: Tags which will be added to the collection in Livefyre
 *
 * @param {object|string} rootEl Root element in which the widget should be loaded.
 * @param {object}        config Configuration object. See in the description the fields that are mandatory.
 * @returns {undefined}
 */
const Widget = function () {
	oCommentUi.Widget.apply(this, arguments);

	let self = this;

	if (!this.config) {
		return;
	}


	this.config.order = this.config.order || "inverted";
	this.config.layout = this.config.layout || 'side';


	// add appropriate classes to the widget container
	if (this.getWidgetEl().className.indexOf('o-chat') === -1) {
		this.getWidgetEl().className += ' o-chat';
	}
	this.getWidgetEl().className += ' o-chat--order-' + this.config.order;
	this.getWidgetEl().setAttribute('data-o-chat-built', 'true');

	if (this.config.layout) {
		this.getWidgetEl().className += ' o-chat--comment-layout-' + this.config.layout;
	}

	/**
	 * Collection ID.
	 * @type {Number}
	 */
	this.collectionId = null;

	/**
	 * Message queue which is responsible to save comments when a page reload is needed
	 * to authenticate (when posting a comment).
	 * @type {[type]}
	 */
	this.messageQueue = null;

	const defaultDatetimeFormat = {
		minutesUntilAbsoluteTime: -1,
		absoluteFormat: 'hh:mm a'
	};

	this.config.datetimeFormat = defaultDatetimeFormat;

	if (!this.config.datetimeFormat) {
		if (!this.config.datetimeformat) {
			if (this.config.minutesuntilabsolutetime) {
				this.config.datetimeFormat.minutesUntilAbsoluteTime = this.config.minutesuntilabsolutetime;
			}

			if (this.config.absoluteformat) {
				this.config.datetimeFormat.absoluteFormat = this.config.absoluteformat;
			}
		} else {
			this.config.datetimeFormat = this.config.datetimeformat;
		}
	} else {
		// merge user date preferences with the default preferences
		if (typeof this.config.datetimeFormat === 'string') {
			defaultDatetimeFormat.absoluteFormat = this.config.datetimeFormat;
		} else if (typeof this.config.datetimeFormat === 'object') {
			if (this.config.datetimeFormat.hasOwnProperty('minutesUntilAbsoluteTime')) {
				defaultDatetimeFormat.minutesUntilAbsoluteTime = this.config.datetimeFormat.minutesUntilAbsoluteTime;
			}

			if (this.config.datetimeFormat.hasOwnProperty('absoluteFormat')) {
				defaultDatetimeFormat.absoluteFormat = this.config.datetimeFormat.absoluteFormat;
			}
		}

		this.config.datetimeFormat = defaultDatetimeFormat;
	}


	let nextPageNumber;
	let isMorePageAvailable = false;
	let nextPageFetchInProgress = false;
	let loginStatus = false;
	let userIsAdmin = false;
	let renderComplete = false;

	let commentIds = [];
	let ownCommentIds = [];
	const commentVisibilities = {};

	let destroyed = false;
	const executeWhenNotDestroyed = function (func) {
		return function () {
			if (!destroyed) {
				func.apply(this, arguments);
			}
		};
	};

	/**
	 * Comment IDs are saved to avoid duplicates. This returns if an ID already exists.
	 * @param  {Number}  id ID of a comment.
	 * @return {Boolean} If the comment ID was already processed or not.
	 */
	const hasCommentId = function (id) {
		if (Array.prototype.indexOf) {
			return commentIds.indexOf(id) !== -1 ? true : false;
		} else {
			for (let i = 0; i < commentIds.length; i++) {
				if (commentIds[i] === id) {
					return true;
				}
			}
			return false;
		}
	};

	/**
	 * Removes a comment ID from the list of existing comments IDs.
	 * @param  {Number} id ID of a comment.
	 * @return {Boolean} If the ID was already saved or not.
	 */
	const removeCommentId = function (id) {
		let index;
		if (Array.prototype.indexOf) {
			index = commentIds.indexOf(id);
			if (index !== -1) {
				commentIds.splice(index, 1);
				return true;
			}
			return false;
		} else {
			for (index = 0; index < commentIds.length; index++) {
				if (commentIds[index] === id) {
					commentIds.splice(index, 1);
					return true;
				}
			}
			return false;
		}
	};

	/**
	 * Instance of WidgetUi. This can handle the UI part of the widget.
	 * @type {WidgetUi}
	 */
	this.ui = new WidgetUi(this.getWidgetEl(), {
		datetimeFormat: this.config.datetimeFormat,
		orderType: self.config.order
	});

	/**
	 * Override of oCommentUi.Widget.init function.
	 * This is responsible to load the comments and the article related data.
	 * This function also initiates live stream from Livefyre.
	 *
	 * @param  {Function} callback function(err, data), where data contains collectionId and comments. See o-comment-api.api.getComments
	 * @returns {undefined}
	 */
	this.loadInitData = function (callback) {
		const config = {
			title: self.config.title,
			url: self.config.url,
			articleId: self.config.articleId,
			stream: true
		};
		if (typeof self.config.section !== 'undefined') {
			config.section = self.config.section;
		}
		if (typeof self.config.tags !== 'undefined') {
			config.tags = self.config.tags;
		}

		self.config.stream = true;

		oCommentApi.api.getComments(config, executeWhenNotDestroyed(function (err, data) {
			if (err) {
				callback(err);
				return;
			}

			if (data.hasOwnProperty('collection')) {
				// initial collection info

				if (typeof data.collection.nextPage === 'number') {
					nextPageNumber = data.collection.nextPage;
					isMorePageAvailable = true;
				} else {
					isMorePageAvailable = false;
				}

				callback(null, data.collection);
			} else if (data.hasOwnProperty('stream')) {
				// streaming info
				if (renderComplete) {
					handleStream(data.stream);
				} else {
					self.on('widget.renderComplete', function () {
						handleStream(data.stream);
					});
				}
			}
		}));
	};

	/**
	 * Decides what happens when an error occurs. It clears the container.
	 * If the article is flagged as unclassified, no message appears.
	 * If any other error occurs, show a generic not available message.
	 * @param  {Object|String} err Error object or string.
	 * @returns {undefined}
	 */
	this.onError = function (err) {
		self.ui.clearContainer();

		if (typeof err === 'object'&& err.unclassifiedArticle !== true && err.notAllowedToCreateCollection !== true) {
			self.ui.addNotAvailableMessage();
		}
	};

	/**
	 * Handle the comments, render them, and initiate the login process as well.
	 * @param  {Object}   commentsData Object with collectionId and comments.
	 * @param  {Function} callback     Called when the initial rendering completed.
	 * @returns {undefined}
	 */
	this.render = function (commentsData, callback) {
		if (commentsData && !destroyed) {
			if (commentsData.unclassifiedArticle !== true && commentsData.notAllowedToCreateCollection !== true) {
				self.collectionId = commentsData.collectionId;
				self.messageQueue = new MessageQueue(self.collectionId);

				self.trigger('widget.ready');
				self.trigger('widget.load');
				oTrackingIntegration.trackSuccessLoad();

				auth.login(executeWhenNotDestroyed(function (loggedIn, authData) {
					if (!authData) {
						authData = null;
					}

					self.trigger('data.auth', authData);

					if (authData) {
						if (authData.admin || authData.moderator) {
							userIsAdmin = true;
						}
					}

					// normalize the comments data
					commentsData.comments = preprocessCommentData(commentsData.comments);

					// clear container
					self.ui.clearContainer();
					// render the widget in the DOM
					self.ui.render(commentsData.comments, userIsAdmin, isMorePageAvailable);

					if (envConfig.get().showEnvironment === true) {
						self.ui.showEnvironment(envConfig.get().livefyre.network);
					}

					// all fine, no errors with the rendering
					callback();
					self.trigger('widget.renderComplete');
					renderComplete = true;

					// determine if there are messages to post before being logged in.
					// in this case a flag is set and the user is forced to finish the login process (e.g. no pseudonym)
					if (self.messageQueue.hasComment()) {
						oCommentUtilities.logger.log("Force flag set.");

						self.forceMode = true;
					}

					if (!loggedIn) {
						if (authData) {
							if (authData.pseudonym === false) {
								// the user is forced to finish the login process
								// ask to set a pseudonym instantly
								if (self.forceMode === true) {
									auth.loginRequiredPseudonymMissing(function (err) {
										if (err) {
											return;
										}

										const messageInTheQueue = self.messageQueue.getComment();
										self.ui.repopulateCommentArea(messageInTheQueue);
										self.messageQueue.clear();
									});
								}

								self.ui.hideSignInLink();
							} else if (authData.serviceUp === false) {
								self.ui.makeReadOnly();
								self.ui.hideSignInLink();
								self.ui.addAuthNotAvailableMessage();
								self.ui.hideEditor();
							}
						} else if (self.forceMode === true) {
							const messageInTheQueue = self.messageQueue.getComment();
							self.ui.repopulateCommentArea(messageInTheQueue);
						}
					}
				}));
			} else {
				if (commentsData.unclassifiedArticle === true) {
					callback({
						unclassifiedArticle: true
					});
				} else if (commentsData.notAllowedToCreateCollection === true) {
					callback({
						notAllowedToCreateCollection: true
					});
				}
			}
		}
	};

	/**
	 * Calling this method with a height in pixels as parameter will adapt the UI
	 * to shrink within that height. If the current UI is smaller, it will fill the
	 * space to occupy the full height, or if the current UI is taller, a scroll
	 * will appear on the comments.
	 *
	 * @param  {Number} height Desired height in pixels.
	 * @returns {undefined}
	 */
	this.adaptToHeight = function (height) {
		if (height) {
			self.ui.adaptToHeight(height);
		}
	};

	this.clearHeight = function () {
		self.ui.clearHeight();
	};

	this.stretchVertical = function () {
		self.ui.stretchVertical();
	};

	this.clearStretch = function () {
		self.ui.clearStretch();
	};

	if (self.config.height) {
		if (!destroyed) {
			self.adaptToHeight(self.config.height);
		}
	}

	if (self.config.stretchVertical) {
		if (!destroyed) {
			self.stretchVertical();
		}
	}

	/**
	 * Adds the following parameters to an existing comment object:
	 *
	 *  - dateToShow: date in the format that is rendered in the UI
	 *  - datetime: date in ISO format
	 *  - relativeTime: if dateToShow is in relative time format
	 *  - timestamp: normalized timestamp (in milliseconds)
	 *  - author.displayName truncated to 50 characters
	 *
	 * @param  {Object} aComment A comment object, which respects the format the oCommentApi.api.getComments returns.
	 * @return {Object} Processed comment
	 */
	function processOneComment (aComment) {
		aComment.dateToShow = self.ui.formatTimestamp(aComment.timestamp);
		aComment.datetime = oCommentUtilities.dateHelper.toISOString(aComment.timestamp);
		if (self.ui.isRelativeTime(aComment.timestamp)) {
			aComment.relativeTime = true;
		}
		aComment.timestamp = oCommentUtilities.dateHelper.toTimestamp(aComment.timestamp);
		aComment.author.displayName = aComment.author.displayName.substring(0, 50);

		if (!hasCommentId(aComment.commentId)) {
			commentIds.push(aComment.commentId);
		}

		return aComment;
	}

	/**
	 * Iterates over an array of comments and applies the modifications made by the
	 * processOneComment function.
	 *
	 * @param  {Array} comments Array with comments objects, which respects the format the oCommentApi.api.getComments returns.
	 * @return {Array} Processed comment array
	 */
	function preprocessCommentData (comments) {
		if (comments) {
			if (typeof comments.length === 'number') {
				for (let index = 0; index < comments.length; index++) {
					comments[index] = processOneComment(comments[index]);
				}

				return comments;
			} else {
				return processOneComment(comments);
			}
		}

		return comments;
	}

	/**
	 * New comment received over the stream, this function handles it.
	 * @param  {Object} commentData A comment object, in Livefyre format.
	 * @returns {undefined}
	 */
	function newCommentReceived (commentData) {
		if (!hasCommentId(commentData.commentId) && (commentData.visibility === 1 || userIsAdmin) && commentData.content) {
			commentIds.push(commentData.commentId);
			self.ui.addComment({
				id: commentData.commentId,
				content: commentData.content,
				timestamp: commentData.timestamp,
				displayName: commentData.author.displayName
			}, (commentData.author.displayName.substring(0, 50) === self.ui.getCurrentPseudonym()), userIsAdmin);
		}

		oCommentUtilities.logger.log('new comment, handling visibility');
		handleStreamEventForBadgingComments(commentData);
	}

	function removeComment (commentId) {
		oCommentUtilities.logger.log('comment removed', commentId);
		removeCommentId(commentId);
		self.ui.removeComment(commentId);
	}

	function commentUpdated (commentData) {
		if (commentData.content) {
			if (hasCommentId(commentData.commentId)) {
				self.ui.updateComment(commentData.commentId, commentData.content);
			} else {
				commentIds.push(commentData.commentId);
				self.ui.addComment({
					id: commentData.commentId,
					content: commentData.content,
					timestamp: commentData.timestamp,
					displayName: commentData.author.displayName
				}, (commentData.author.displayName.substring(0, 50) === self.ui.getCurrentPseudonym()), userIsAdmin);
			}
		}

		handleStreamEventForBadgingComments(commentData);
	}


	function handleStream (streamData) {
		if (streamData.comment) {
			commentVisibilities[streamData.comment.commentId] = streamData.comment.visibility;

			// comment related
			if (streamData.comment.deleted === true) {
				commentVisibilities[streamData.comment.commentId] = 0;
				// comment deleted
				removeComment(streamData.comment.commentId);
			} else if (streamData.comment.updated === true) {
				commentUpdated(streamData.comment);
			} else if (streamData.comment.commentId) {
				// new comment
				newCommentReceived(streamData.comment);
			}
		}

		if (streamData.collection) {
			// collection related

			if (streamData.collection.hasOwnProperty('commentsEnabled')) {
				if (streamData.collection.commentsEnabled === false) {
					self.ui.close();
				} else if (streamData.collection.commentsEnabled === true) {
					self.ui.open();
				}
			}
		}
	}


	function login (evt) {
		loginStatus = true;
		const authData = evt.detail;

		self.ui.login(authData.token, authData.displayName, authData.admin || authData.moderator);
		self.ui.addSettingsLink({
			onClick: function () {
				const showSettingsDialog = executeWhenNotDestroyed(function () {
					oCommentApi.api.getAuth(function (authErr, currentAuthData) {
						if (!authErr && currentAuthData) {
							userDialogs.showChangePseudonymDialog(currentAuthData.displayName, function (err, newAuthData) {
								if (err) {
									return;
								}

								if (newAuthData && newAuthData.token) {
									logout();
									login({
										detail: newAuthData
									});
								}
							});
						}
					});
				});

				auth.loginRequired(function (err) {
					if (err) {
						return;
					}

					showSettingsDialog();
				});
			}
		});


		// after login, post the comments from the message queue
		if (self.forceMode && self.messageQueue.hasComment()) {
			const messageInTheQueue = self.messageQueue.getComment();
			self.messageQueue.clear();

			self.ui.repopulateCommentArea(messageInTheQueue);
			postComment(messageInTheQueue);
		}
	}
	globalEvents.on('auth.login', login);

	function logout () {
		loginStatus = false;
		self.ui.logout();
		self.ui.removeSettingsLink();
	}
	globalEvents.on('auth.logout', logout);


	function sessionExpired (onCancel) {
		userDialogs.showInactivityMessage({
			submit: function () {
				window.location.href = envConfig.get('loginUrl') + '?location=' + encodeURIComponent(document.location.href);
			},
			close: function () {
				if (typeof onCancel === 'function') {
					onCancel();
				}
			}
		});
	};



	// sign in button pressed
	self.ui.on('signIn', function () {
		auth.loginRequired();
	});

	self.ui.on('nextPage', function () {
		if (isMorePageAvailable && !nextPageFetchInProgress) {
			// fetch next page
			oCommentUtilities.logger.log('fetch next page');

			nextPageFetchInProgress = true;

			const config = {
				title: self.config.title,
				url: self.config.url,
				articleId: self.config.articleId,
				page: nextPageNumber
			};
			if (typeof self.config.section !== 'undefined') {
				config.section = self.config.section;
			}
			if (typeof self.config.tags !== 'undefined') {
				config.tags = self.config.tags;
			}

			oCommentApi.api.getComments(config, executeWhenNotDestroyed(function (err, data) {
				if (err) {
					isMorePageAvailable = false;
					self.ui.disablePagination();
					return;
				}

				if (typeof data.collection.nextPage === 'number') {
					nextPageNumber = data.collection.nextPage;
				} else {
					isMorePageAvailable = false;
					self.ui.disablePagination();
				}

				self.ui.addNextPageComments(preprocessCommentData(data.collection.comments), userIsAdmin);

				// wait until the DOM rendering has finished
				setTimeout(function () {
					nextPageFetchInProgress = false;
				}, 200);
			}));
		}
	});

	function triggerCommentPostedEvent (commentInfo) {
		self.trigger('tracking.postComment', {
			collectionId: self.collectionId,
			comment: {
				bodyHtml: commentInfo.commentBody,
				id: commentInfo.commentId,
				author: {
					displayName: commentInfo.author.displayName
				}
			}
		});
		oTrackingIntegration.trackPost(self.colleciontId);
	}


	let errorTrackSent = false;
	this.on('error.init', function () {
		if (!errorTrackSent) {
			errorTrackSent = true;
			oTrackingIntegration.trackCcsDown();
		}
	});

	/**
	 * Post a comment.
	 * Known fact is that the user is logged in and the comment body is not blank.
	 *
	 * Insert the comment in the DOM instantly, and try to post the comment with the API.
	 * If successful, leave the comment in the DOM and change the ID with the real comment ID.
	 * If unsuccessful, remove the comment from the DOM, repopulate the comment area with the comment and show the error message.
	 *
	 * @param {String} commentBody Text of the comment
	 * @param {Boolean} retryingToPostAfterReLogin Second trial
	 * @returns {undefined}
	 */
	const postComment = function (commentBody, retryingToPostAfterReLogin) {
		oCommentApi.api.postComment({
			collectionId: self.collectionId,
			commentBody: commentBody
		}, executeWhenNotDestroyed(function (err, postCommentResult) {
			self.ui.makeEditable();

			if (err) {
				oCommentUtilities.logger.debug('postComment error:', err);

				self.ui.setEditorError(oCommentUi.i18n.texts.genericError);

				return;
			}

			oCommentUtilities.logger.debug('postComment result:', postCommentResult);

			if (postCommentResult) {
				if (postCommentResult.success === true) {
					self.ui.emptyCommentArea();

					oCommentApi.api.getAuth(executeWhenNotDestroyed(function (authErr, authData) {
						if (authData) {
							triggerCommentPostedEvent({
								commentId: postCommentResult.commentId,
								commentBody: postCommentResult.bodyHtml,
								author: {
									displayName: authData.displayName
								}
							});

							oCommentUtilities.logger.log('own comment', postCommentResult.commentId);

							ownCommentIds.push(postCommentResult.commentId);

							if (!hasCommentId(postCommentResult.commentId)) {
								commentIds.push(postCommentResult.commentId);
								self.ui.addComment({
									id: postCommentResult.commentId,
									content: postCommentResult.bodyHtml,
									timestamp: postCommentResult.createdAt,
									displayName: authData.displayName
								}, true, userIsAdmin);
							}

							if (commentVisibilities.hasOwnProperty(postCommentResult.commentId)) {
								oCommentUtilities.logger.log('own comment, handling visibility');
								handleStreamEventForBadgingComments({
									commentId: postCommentResult.commentId,
									visibility: commentVisibilities[postCommentResult.commentId]
								});
							} else {
								oCommentUtilities.logger.log('own comment, no comment visibility known yet', postCommentResult.commentId);
							}
						}
					}));
				} else if (postCommentResult.invalidSession === true) {
					if (!retryingToPostAfterReLogin) {
						loginRequiredToPostComment(commentBody);
					} else {
						self.messageQueue.save(commentBody);
						sessionExpired(function () {
							self.messageQueue.clear();
						});
					}
				} else {
					if (postCommentResult.errorMessage) {
						let match;
						let errMsg = postCommentResult.errorMessage;
						let msgToOverride;

						for (msgToOverride in oCommentUi.i18n.serviceMessageOverrides) {
							if (oCommentUi.i18n.serviceMessageOverrides.hasOwnProperty(msgToOverride)) {
								match = postCommentResult.errorMessage.match(new RegExp(msgToOverride));
								if (match && match.length) {
									errMsg = oCommentUi.i18n.serviceMessageOverrides[msgToOverride];
								}
							}
						}

						self.ui.setEditorError(errMsg);
					} else {
						let errMsg = oCommentUi.i18n.texts.genericError;

						if (postCommentResult.code && oCommentUi.i18n.serviceCodeMessages[postCommentResult.code]) {
							errMsg = oCommentUi.i18n.serviceCodeMessages[postCommentResult.code];
						}

						self.ui.setEditorError(errMsg);
					}

					return;
				}
			} else {
				self.ui.setEditorError(oCommentUi.i18n.texts.genericError);
			}
		}));
	};

	function loginRequiredToPostComment (commentBody) {
		self.messageQueue.save(commentBody);
		oCommentUtilities.logger.log('user not actively logged in, save comment to the storage');

		const force = true;

		auth.loginRequired(executeWhenNotDestroyed(function (err) {
			if (err) {
				self.ui.setEditorError(oCommentUi.i18n.texts.genericError);
				self.messageQueue.clear();
				return;
			}

			self.messageQueue.clear();

			postComment(commentBody, true);
		}), force);
	}

	// the 'Submit comment' button is pressed
	self.ui.on('postComment', function () {
		const commentBody = self.ui.getCurrentComment();

		oCommentUtilities.logger.debug('postComment', 'comment: "'+ commentBody +'"');

		if (!commentBody) {
			self.ui.setEditorError(i18n.errors.emptyComment);
			return;
		}

		self.ui.makeReadOnly();

		postComment(commentBody);
	});





	function deleteComment (commentId, retryingToPostAfterReLogin) {
		oCommentApi.api.deleteComment({
			collectionId: self.collectionId,
			commentId: commentId
		}, executeWhenNotDestroyed(function (err, deleteCommentResult) {
			if (err) {
				userDialogs.showMessage("Delete comment", oCommentUi.i18n.texts.genericError);
				oCommentUtilities.logger.log("delete comment call error: ", err);
				return;
			}

			if (deleteCommentResult) {
				if (deleteCommentResult.success === true) {
					removeComment(commentId);

					self.trigger('tracking.deleteComment', {
						collectionId: self.collectionId,
						comment: {
							id: commentId
						}
					});
				} else if (deleteCommentResult.invalidSession === true) {
					if (!retryingToPostAfterReLogin) {
						loginRequiredToDeleteComment(commentId);
					} else {
						sessionExpired(function () {
							self.ui.markCommentAsDeleteInProgressEnded(commentId);
						});
					}
				} else {
					self.ui.markCommentAsDeleteInProgressEnded(commentId);

					if (deleteCommentResult.errorMessage) {
						let match;
						let errMsg = deleteCommentResult.errorMessage;
						let msgToOverride;

						for (msgToOverride in oCommentUi.i18n.serviceMessageOverrides) {
							if (oCommentUi.i18n.serviceMessageOverrides.hasOwnProperty(msgToOverride)) {
								match = deleteCommentResult.errorMessage.match(new RegExp(msgToOverride));
								if (match && match.length) {
									errMsg = oCommentUi.i18n.serviceMessageOverrides[msgToOverride];
								}
							}
						}

						userDialogs.showMessage("Delete comment", errMsg);
					} else {
						let errMsg = oCommentUi.i18n.texts.genericError;

						if (deleteCommentResult.code && oCommentUi.i18n.serviceCodeMessages[deleteCommentResult.code]) {
							errMsg = oCommentUi.i18n.serviceCodeMessages[deleteCommentResult.code];
						}

						userDialogs.showMessage("Delete comment", errMsg);
					}

					return;
				}
			} else {
				self.ui.markCommentAsDeleteInProgressEnded(commentId);

				userDialogs.showMessage("Delete comment", oCommentUi.i18n.texts.genericError);
			}
		}));
	}

	function loginRequiredToDeleteComment (commentId) {
		const force = true;

		auth.loginRequired(executeWhenNotDestroyed(function (err) {
			if (err) {
				self.ui.markCommentAsDeleteInProgressEnded(commentId);
				userDialogs.showMessage("Delete comment", oCommentUi.i18n.texts.genericError);

				return;
			}

			deleteComment(commentId, true);
		}), force);
	}

	self.ui.on('deleteComment', function (commentId) {
		self.ui.markCommentAsDeleteInProgress(commentId);

		oCommentApi.api.getAuth(executeWhenNotDestroyed(function (err, authData) {
			if (!authData || !authData.token) {
				loginRequiredToDeleteComment(commentId);
			} else {
				if (!loginStatus) {
					auth.login();
				}
				deleteComment(commentId);
			}
		}));
	});


	function handleStreamEventForBadgingComments (commentData) {
		if (commentData) {
			if (ownCommentIds.indexOf(commentData.commentId) === -1 && !userIsAdmin) {
				if (commentData.visibility !== 1) {
					removeComment(commentData.commentId);
				}
			} else {
				if (commentData.lastVisibility === 2) {
					self.ui.removeOwnCommentBadge(commentData.commentId, 'blocked');
				}

				if (commentData.lastVisibility === 3) {
					self.ui.removeOwnCommentBadge(commentData.commentId, 'pending');
				}

				if (commentData.visibility === 2) {
					oCommentUtilities.logger.log('comment marked blocked');
					self.ui.showOwnCommentBadge(commentData.commentId, 'blocked');
				}

				if (commentData.visibility === 3) {
					oCommentUtilities.logger.log('comment marked pending');
					self.ui.showOwnCommentBadge(commentData.commentId, 'pending');
				}
			}
		}
	}


	let __superDestroy = this.destroy;
	this.destroy = function () {
		self.ui.off();

		destroyed = true;

		nextPageNumber = null;
		isMorePageAvailable = null;
		nextPageFetchInProgress = null;
		loginStatus = null;
		userIsAdmin = null;
		renderComplete = null;
		commentIds = null;
		ownCommentIds = null;

		self.collectionId = null;

		if (self.messageQueue) {
			self.messageQueue.destroy();
		}
		self.messageQueue = null;

		globalEvents.off('auth.login', login);
		globalEvents.off('auth.logout', logout);

		__superDestroy();
		__superDestroy = null;

		self = null;
	};


	// init
	if (this.config.autoInit !== false) {
		this.init.call(this);
	}
};
oCommentUi.Widget.__extend(Widget, 'oChat', 'o-chat');

Widget.__extend = function(child, eventNamespace, classNamespace) {
	if (typeof Object.create === 'function') {
		child.prototype = Object.create(Widget.prototype);
	} else {
		const Tmp = function () {};
		Tmp.prototype = Widget.prototype;
		child.prototype = new Tmp();
		child.prototype.constructor = child;
	}

	if (eventNamespace) {
		child.prototype.eventNamespace = eventNamespace;
	}

	if (classNamespace) {
		child.prototype.classNamespace = classNamespace;
	}
};

module.exports = Widget;
