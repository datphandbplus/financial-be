const ProjectSheet = require( './project_sheet' );
const Repository = require( '@models/repository' );

class ProjectSheetRepository extends Repository {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		super( ProjectSheet( channelId ) );
	}

}

module.exports = ProjectSheetRepository;
