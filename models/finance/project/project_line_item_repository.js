const ProjectLineItem = require( './project_line_item' );
const Repository = require( '@models/repository' );

class ProjectLineItemRepository extends Repository {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		super( ProjectLineItem( channelId ) );
	}

}

module.exports = ProjectLineItemRepository;
