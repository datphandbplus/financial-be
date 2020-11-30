const User = require( './user' );
const Repository = require( '@models/repository' );

class UserRepository extends Repository {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		super( User( channelId ) );
	}

}

module.exports = UserRepository;
