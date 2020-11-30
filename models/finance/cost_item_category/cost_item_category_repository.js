const CostItemCategory = require( './cost_item_category' );
const Repository = require( '@models/repository' );

class CostItemCategoryRepository extends Repository {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		super( CostItemCategory( channelId ) );
	}

}

module.exports = CostItemCategoryRepository;
