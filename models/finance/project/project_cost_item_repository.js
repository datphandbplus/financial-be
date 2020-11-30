const ProjectCostItem = require( './project_cost_item' );
const Repository = require( '@models/repository' );

class ProjectCostItemRepository extends Repository {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		super( ProjectCostItem( channelId ) );
	}

}

module.exports = ProjectCostItemRepository;
