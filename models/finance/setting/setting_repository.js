const Setting = require( './setting' );
const Repository = require( '@models/repository' );

class SettingRepository extends Repository {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		super( Setting( channelId ) );
	}

}

module.exports = SettingRepository;
