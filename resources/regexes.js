const Resources = require( 'nodejs-core/resources' );

const REGEXES = {
	...Resources.REGEXES,
	ALLOWANCE: '^\\s*(?=.*[0-9])[0-9]*(?:\\.[0|5]{1})?\\s*$',
};

module.exports = REGEXES;
