const LineItemCategory = require( './line_item_category' );
const Repository = require( '@models/repository' );

class LineItemCategoryRepository extends Repository {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		super( LineItemCategory( channelId ) );
	}

}

module.exports = LineItemCategoryRepository;
