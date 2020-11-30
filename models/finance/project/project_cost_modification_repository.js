const ProjectCostModification = require( './project_cost_modification' );
const Repository = require( '@models/repository' );

class ProjectCostModificationRepository extends Repository {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		super( ProjectCostModification( channelId ) );
	}

}

module.exports = ProjectCostModificationRepository;
