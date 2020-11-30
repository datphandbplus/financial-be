const path = require( 'path' );

const Helpers = require( 'nodejs-core/multi_db/helpers' );

class Factory extends Helpers.Factory {

	/**
	* Get public upload folder
	* @static
	* @param {string} channelId
	* @param {string} pathStr
	* @return {string} Public upload path
	*/
	static getUploadDir( channelId, pathStr = null ) {
		return Helpers.Factory.getUploadDir(
			path.join( 'public/uploads', 'channel_' + channelId ),
			pathStr
		);
	}

}

module.exports = Factory;
