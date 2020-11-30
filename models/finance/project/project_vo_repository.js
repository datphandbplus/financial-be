const Repository = require( '@models/repository' );
const ProjectVO = require( './project_vo' );

class ProjectVORepository extends Repository {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		super( ProjectVO( channelId ) );
	}

}

module.exports = ProjectVORepository;
