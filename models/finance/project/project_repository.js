const Project = require( './project' );
const Repository = require( '@models/repository' );

class ProjectRepository extends Repository {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		super( Project( channelId ) );
	}

}

module.exports = ProjectRepository;
