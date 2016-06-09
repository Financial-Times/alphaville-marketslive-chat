const templates = require('./templates.js');
const oCommentUi = require('o-comment-ui');
const oCommentUtilities = require('o-comment-utilities');

function NewCommentNotification (widgetUi, container, position) {
	let self = this;

	if (position !== "bottom" && position !== "top") {
		position = "top";
	}

	let notificationId = Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 5);

	let active = false;

	container.parentNode.appendChild(oCommentUi.utils.toDOM(templates.notification.render({
		id: notificationId,
		position: position,
		arrowIconClass: (position === 'bottom' ? 'downwards' : 'upwards')
	})));
	let notificationElement = document.querySelector('#o-chat--notification-' + notificationId);
	let notificationButton = document.querySelector('.o-chat--notification-button', notificationElement);


	let onClickButton = function () {
		self.reset();
		if (position === "bottom") {
			container.scrollTop = container.scrollHeight - container.clientHeight;
		} else {
			container.scrollTop = 0;
		}
	};
	notificationButton.addEventListener('click', onClickButton);

	let onClickElement = function () {
		container.focus();
	};
	notificationElement.addEventListener('click', onClickElement);

	const verifyNotificationStatus = function (scrollPos) {
		if (position === "bottom") {
			if (scrollPos >= container.scrollHeight - container.clientHeight - 3) {
				if (active === true) {
					self.reset();
				}
				active = false;
			} else {
				active = true;
			}
		} else {
			if (scrollPos <= 3) {
				if (active === true) {
					self.reset();
				}
				active = false;
			} else {
				active = true;
			}
		}
	};
	const scrollMonitorForNotification = new oCommentUtilities.dom.ScrollMonitor(container, verifyNotificationStatus);
	verifyNotificationStatus(container.scrollTop);

	this.newComment = function () {
		verifyNotificationStatus(container.scrollTop);
		if (active) {
			oCommentUtilities.logger.debug('notification activated');
			notificationElement.style.display = 'block';
		}
	};

	this.reset = function () {
		notificationElement.style.display = 'none';

		oCommentUtilities.logger.debug('notification reset');
	};

	this.destroy = function () {
		scrollMonitorForNotification.destroy();

		notificationId = null;
		active = null;

		notificationButton.removeEventListener('click', onClickButton);
		onClickButton = null;

		notificationElement.removeEventListener('click', onClickElement);
		onClickElement = null;

		notificationElement.parentNode.removeChild(notificationElement);
		notificationElement = null;
		notificationButton = null;

		self = null;
	};
}

module.exports = NewCommentNotification;
