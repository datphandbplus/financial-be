const UserRole = require( './user_role' );
const Repository = require( '@models/repository' );

class UserRoleRepository extends Repository {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		super( UserRole( channelId ) );
	}

}

module.exports = UserRoleRepository;
