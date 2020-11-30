const LezoProject = require( './lezo_project' );
const Repository = require( '@models/repository' );

class LezoProjectRepository extends Repository {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		super( LezoProject( channelId ) );
	}

}

module.exports = LezoProjectRepository;
