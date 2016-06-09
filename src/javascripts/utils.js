const strings = {
	/**
	 * Shim of String.trim for older browsers. Trims a string.
	 * @param  {String} string String to be trimmed.
	 * @return {String} Trimmed string
	 */
	trim: function (string) {
		if (String.prototype.trim) {
			return string.trim();
		} else {
			return string.replace(/^\s+|\s+$/g, '');
		}
	}
};
exports.strings = strings;
