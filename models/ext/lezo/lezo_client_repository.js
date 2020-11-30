const LezoClient = require( './lezo_client' );
const Repository = require( '@models/repository' );

class LezoClientRepository extends Repository {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		super( LezoClient( channelId ) );
	}

}

module.exports = LezoClientRepository;
