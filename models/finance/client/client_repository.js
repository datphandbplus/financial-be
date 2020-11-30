const Client = require( './client' );
const Repository = require( '@models/repository' );

class ClientRepository extends Repository {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		super( Client( channelId ) );
	}

}

module.exports = ClientRepository;
